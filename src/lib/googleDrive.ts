import { google } from "googleapis";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

const TEMPLATE_ID = "19mPXihNH571L0QvFAINSw0vjrODE3fjcTc0nmbhviG4";

interface FacturaData {
  numero_factura: string;
  cliente_nombre: string;
  cliente_nif: string;
  concepto: string;
  importe_total: number;
  fecha_emision: string;
  verifactu_qr?: string;
}

async function getAuthenticatedClient() {
  const adminSupabase = await createAdminServerClient();
  const { data: { user }, error: userError } = await adminSupabase.auth.getUser();

  if (userError || !user) {
    const adminServiceSupabase = createAdminServiceClient();
    const { data: users, error } = await adminServiceSupabase
      .from("usuarios")
      .select("drive_access_token, drive_refresh_token, drive_token_expiry, metadata")
      .not("drive_access_token", "is", null)
      .limit(1);

    if (error || !users || users.length === 0) {
      throw new Error("No autenticado");
    }

    const userData = users[0];
    let accessToken = userData.drive_access_token;
    let refreshToken = userData.drive_refresh_token;

    if (!accessToken) {
      const driveConfig = userData.metadata?.drive_config;
      accessToken = driveConfig?.drive_access_token || null;
      refreshToken = refreshToken || driveConfig?.drive_refresh_token || null;
    }

    if (!accessToken) throw new Error("Google Drive no conectado");

    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return oauth2Client;
  }

  const adminServiceSupabase = createAdminServiceClient();
  const { data: userData, error: dataError } = await adminServiceSupabase
    .from("usuarios")
    .select("drive_access_token, drive_refresh_token, drive_token_expiry, metadata")
    .eq("auth_user_id", user.id)
    .single();

  if (dataError || !userData) throw new Error("No se encontraron datos del usuario");

  let accessToken = userData.drive_access_token;
  let refreshToken = userData.drive_refresh_token;

  if (!accessToken) {
    const driveConfig = userData.metadata?.drive_config;
    accessToken = driveConfig?.drive_access_token || null;
    refreshToken = refreshToken || driveConfig?.drive_refresh_token || null;
  }

  if (!accessToken) throw new Error("Google Drive no conectado");

  const oauth2Client = new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

export async function generateInvoiceDoc(data: FacturaData): Promise<Buffer> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });

  // 1. Copy template
  const { data: copy } = await drive.files.copy({
    fileId: TEMPLATE_ID,
    requestBody: {
      name: `${data.numero_factura} - ${data.cliente_nombre}`,
    },
  });

  const copyId = copy.id;
  if (!copyId) throw new Error("No se pudo copiar la plantilla");

  // 2. Prepare text replacements
  const formatEuro = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

  const textReplacements: { text: string; replace: string }[] = [
    { text: "{{numero_factura}}", replace: data.numero_factura },
    { text: "{{nombre_cliente}}", replace: data.cliente_nombre },
    { text: "{{dni_cliente}}", replace: data.cliente_nif },
    { text: "{{concepto_factura}}", replace: data.concepto },
    { text: "{{total_factura}}", replace: formatEuro(data.importe_total) },
    { text: "{{fecha_emision}}", replace: new Date(data.fecha_emision).toLocaleDateString("es-ES") },
    { text: "{{fecha_factura}}", replace: new Date(data.fecha_emision).toLocaleDateString("es-ES") },
  ];

  try {
    // 3. Do all text replacements first
    await docs.documents.batchUpdate({
      documentId: copyId,
      requestBody: {
        requests: textReplacements.map((r) => ({
          replaceAllText: {
            containsText: { text: r.text, matchCase: true },
            replaceText: r.replace,
          },
        })),
      },
    });

    // 4. Find QR placeholder position (document is stable after replacements)
    let qrIndex: number | null | undefined = null;
    if (data.verifactu_qr) {
      const docContent = await docs.documents.get({ documentId: copyId });
      const body = docContent.data.body?.content;
      if (body) {
        const searchPlaceholder = (elements: any[]): number | null | undefined => {
          for (const el of elements) {
            if (el.paragraph) {
              for (const run of el.paragraph.elements || []) {
                const text = run.textRun?.content;
                if (text && text.includes("{{QR_CODE_PLACEHOLDER}}")) {
                  return run.startIndex;
                }
              }
            }
            if (el.table) {
              for (const row of el.table.tableRows || []) {
                for (const cell of row.tableCells || []) {
                  const found = searchPlaceholder(cell.content || []);
                  if (found != null) return found;
                }
              }
            }
          }
          return null;
        };
        qrIndex = searchPlaceholder(body);
      }
    }

    // 5. Insert QR image if available
    if (qrIndex != null && data.verifactu_qr) {
      const qrText = encodeURIComponent(data.verifactu_qr);
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrText}`;

      const placeholderLength = "{{QR_CODE_PLACEHOLDER}}".length;
      await docs.documents.batchUpdate({
        documentId: copyId,
        requestBody: {
          requests: [
            {
              deleteContentRange: {
                range: {
                  startIndex: qrIndex,
                  endIndex: qrIndex + placeholderLength,
                },
              },
            },
            {
              insertInlineImage: {
                location: { index: qrIndex },
                uri: qrApiUrl,
                objectSize: {
                  width: { magnitude: 80, unit: "PT" },
                  height: { magnitude: 80, unit: "PT" },
                },
              },
            },
          ],
        },
      });
    }

    // 6. Export as PDF
    const response = await drive.files.export({
      fileId: copyId,
      mimeType: "application/pdf",
      responseType: "arraybuffer",
    } as any);

    let rawData = response.data;
    if (rawData && typeof (rawData as any).arrayBuffer === "function") {
      rawData = await (rawData as any).arrayBuffer();
    }

    const pdfBuffer = Buffer.from(rawData as any);

    return pdfBuffer;
  } finally {
    // 7. Cleanup – delete temp doc
    await drive.files.delete({ fileId: copyId }).catch(() => {});
  }
}
