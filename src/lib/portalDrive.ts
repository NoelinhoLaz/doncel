import { google } from "googleapis";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { decrypt } from "@/lib/encryption";
import { Readable } from "stream";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const UAParser = require("ua-parser-js");

const CONTRACT_TEMPLATE_ID = "16WuHl5rF_mQNEW87ukSHryNYUPJDSc19WZzezdJDAwQ";

export interface ContractData {
  expedienteId: string;
  numero: string;
  referencia: string;
  destino: string;
  fechaInicio: string;
  fechaFin: string;
  clienteNombre: string;
  clienteDocumento: string;
  clienteEmail: string;
  viajeros: string;
  precio: string;
  servicios: string;
}

export interface FirmaData {
  ip: string;
  userAgent: string;
  acceptLanguage: string;
  screenResolution: string;
}

function parseUserAgent(ua: string): { dispositivo: string; navegador: string } {
  try {
    const parser = new UAParser(ua);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    const dispositivo = device.type === "mobile"
      ? `Móvil (${os.name || ""} ${os.version || ""})`.trim()
      : device.vendor
        ? `${device.vendor} ${device.model || ""}`.trim()
        : `PC (${os.name || ""} ${os.version || ""})`.trim();

    const navegador = `${browser.name || ""} ${browser.version || ""}`.trim();

    return { dispositivo, navegador };
  } catch {
    return { dispositivo: "Desconocido", navegador: ua.slice(0, 80) };
  }
}

async function getPortalAuth() {
  const adminService = createAdminServiceClient();

  const { data: users, error } = await adminService
    .from("usuarios")
    .select("drive_access_token, drive_refresh_token, drive_token_expiry, metadata")
    .not("drive_access_token", "is", null)
    .limit(1);

  if (error || !users || users.length === 0) {
    throw new Error("No hay usuario con Google Drive conectado");
  }

  const userData = users[0];
  let accessToken = userData.drive_access_token;

  if (!accessToken) {
    const driveConfig = userData.metadata?.drive_config;
    accessToken = driveConfig?.drive_access_token || null;
  }

  if (!accessToken) throw new Error("Google Drive no conectado");

  const oauth2Client = new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: userData.drive_refresh_token,
  });

  return oauth2Client;
}

export async function generateContractPreview(
  contractData: ContractData,
): Promise<Buffer> {
  const auth = await getPortalAuth();
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });

  const copyName = `Contrato_Preview_${contractData.expedienteId}`;

  const { data: copy } = await drive.files.copy({
    fileId: CONTRACT_TEMPLATE_ID,
    requestBody: { name: copyName },
  });

  const copyId = copy.id;
  if (!copyId) throw new Error("No se pudo copiar la plantilla");

  try {
    const replacements = buildContractReplacements(contractData);

    await docs.documents.batchUpdate({
      documentId: copyId,
      requestBody: {
        requests: replacements.map((r) => ({
          replaceAllText: {
            containsText: { text: r.marker, matchCase: true },
            replaceText: r.value,
          },
        })),
      },
    });

    const pdfBuffer = await exportAndFixBuffer(drive, copyId);
    return pdfBuffer;
  } finally {
    await drive.files.delete({ fileId: copyId }).catch(() => {});
  }
}

export async function generateSignedContract(
  contractData: ContractData,
  firmaData: FirmaData,
): Promise<{ pdfBuffer: Buffer; driveFileId: string }> {
  const auth = await getPortalAuth();
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });

  const { data: copy } = await drive.files.copy({
    fileId: CONTRACT_TEMPLATE_ID,
    requestBody: { name: `Contrato_Firmado_${contractData.expedienteId}` },
  });

  const copyId = copy.id;
  if (!copyId) throw new Error("No se pudo copiar la plantilla");

  try {
    const replacements = buildContractReplacements(contractData);
    const parsed = parseUserAgent(firmaData.userAgent);
    const now = new Date();
    const fechaHora = now.toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

    replacements.push(
      { marker: "CONTRATO_FIRMANTE_MARKER", value: contractData.clienteNombre || "—" },
      { marker: "CONTRATO_EMAIL_MARKER", value: contractData.clienteEmail || "—" },
      { marker: "CONTRATO_FECHA_MARKER", value: fechaHora },
      { marker: "CONTRATO_IP_MARKER", value: firmaData.ip || "No detectada" },
      { marker: "CONTRATO_DISPOSITIVO_MARKER", value: parsed.dispositivo || "Terminal de escritorio" },
      { marker: "CONTRATO_NAVEGADOR_MARKER", value: parsed.navegador || "Navegador moderno" },
      { marker: "CONTRATO_IDIOMA_MARKER", value: firmaData.acceptLanguage || "es-ES" },
      { marker: "CONTRATO_PANTALLA_MARKER", value: firmaData.screenResolution || "Resolución no detectada" },
    );

    await docs.documents.batchUpdate({
      documentId: copyId,
      requestBody: {
        requests: replacements.map((r) => ({
          replaceAllText: {
            containsText: { text: r.marker, matchCase: true },
            replaceText: r.value,
          },
        })),
      },
    });

    // 1. Averiguar en qué carpeta de Drive está la plantilla original
    const templateMetadata = await drive.files.get({
      fileId: CONTRACT_TEMPLATE_ID,
      fields: "parents",
    });
    const parentFolderId = templateMetadata.data.parents?.[0];

    // 2. Exportar el documento ya firmado a PDF en memoria (ArrayBuffer)
    const googleResponse = await drive.files.export({
      fileId: copyId,
      mimeType: "application/pdf",
      responseType: "arraybuffer",
    } as any);

    let rawData = googleResponse.data;
    if (rawData && typeof (rawData as any).arrayBuffer === "function") {
      rawData = await (rawData as any).arrayBuffer();
    }
    const pdfBuffer = Buffer.from(rawData as any);

    // 3. Guardar el PDF definitivo en la misma carpeta que la plantilla
    const pdfStream = new Readable();
    pdfStream.push(pdfBuffer);
    pdfStream.push(null);

    const { data: uploaded } = await drive.files.create({
      requestBody: {
        name: `Contrato_Firmado_${contractData.numero || contractData.expedienteId}.pdf`,
        mimeType: "application/pdf",
        parents: parentFolderId ? [parentFolderId] : undefined,
      },
      media: {
        mimeType: "application/pdf",
        body: pdfStream,
      },
    });

    if (!uploaded.id) throw new Error("No se pudo guardar el PDF firmado");

    // 4. Limpieza: borrar el Docs temporal
    await drive.files.delete({ fileId: copyId }).catch(() => {});

    return { pdfBuffer, driveFileId: uploaded.id };
  } finally {
    await drive.files.delete({ fileId: copyId }).catch(() => {});
  }
}

function buildContractReplacements(data: ContractData) {
  return [
    { marker: "{{nombre_cliente}}", value: data.clienteNombre },
    { marker: "{{documento_cliente}}", value: data.clienteDocumento },
    { marker: "{{email_cliente}}", value: data.clienteEmail },
    { marker: "{{numero_expediente}}", value: data.numero },
    { marker: "{{referencia}}", value: data.referencia },
    { marker: "{{destino}}", value: data.destino },
    { marker: "{{fecha_inicio}}", value: data.fechaInicio },
    { marker: "{{fecha_fin}}", value: data.fechaFin },
    { marker: "{{viajeros}}", value: data.viajeros },
    { marker: "{{precio}}", value: data.precio },
    { marker: "{{servicios}}", value: data.servicios },
  ];
}

async function exportAndFixBuffer(drive: any, fileId: string): Promise<Buffer> {
  const response = await drive.files.export({
    fileId,
    mimeType: "application/pdf",
    responseType: "arraybuffer",
  } as any);

  let rawData = response.data;
  if (rawData && typeof (rawData as any).arrayBuffer === "function") {
    rawData = await (rawData as any).arrayBuffer();
  }

  return Buffer.from(rawData as any);
}
