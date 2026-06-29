import { NextRequest } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";
import { generateInvoiceDoc } from "@/lib/googleDrive";

function getPortalSession(request: NextRequest) {
  try {
    const raw = request.cookies.get("portal_session")?.value;
    if (!raw) return null;
    const { d, iv, t } = JSON.parse(raw);
    if (!d || !iv || !t) return null;
    const decrypted = decrypt(d, iv, t);
    return JSON.parse(decrypted) as { entityId: string; entityName: string; email: string };
  } catch {
    return null;
  }
}

async function getAgencyDbFromAdmin() {
  const adminService = createAdminServiceClient();
  const agencias = (await adminService
    .from("agencias")
    .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag")
    .limit(5)) as unknown as { data: any[] | null; error: any };
  const agencia = (agencias.data || []).find(
    (a: any) => a.supabase_service_role_key_enc && a.iv && a.auth_tag,
  );
  if (!agencia) throw new Error("No se encontró agencia");
  const serviceRoleKey = decrypt(
    agencia.supabase_service_role_key_enc,
    agencia.iv,
    agencia.auth_tag,
  );
  return createClient(agencia.supabase_url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const portalSession = getPortalSession(_req);
    const agencyDb = portalSession ? await getAgencyDbFromAdmin() : await getAgencyDbClient();
    const { data: factura, error } = await agencyDb
      .from("facturas_emitidas")
      .select(`
        *,
        facturas_emitidas_lineas (*)
      `)
      .eq("id", id)
      .single();

    if (error || !factura) {
      return Response.json(
        { error: "Factura no encontrada" },
        { status: 404 },
      );
    }

    if (portalSession) {
      const isPagador = factura.pagador_id === portalSession.entityId;
      const { data: expediente } = await agencyDb
        .from("operativa_expedientes")
        .select("entidad_id")
        .eq("id", factura.expediente_id)
        .single();
      const isMainContact = expediente?.entidad_id === portalSession.entityId;
      if (!isPagador && !isMainContact) {
        return Response.json(
          { error: "No autorizado" },
          { status: 403 },
        );
      }
    }

    const linea = factura.facturas_emitidas_lineas?.[0];

    let urlHaciendaText: string | undefined;
    if (factura.verifactu_mensaje) {
      const urlMatch = factura.verifactu_mensaje.match(/url:(https:\/\/[^\s|]+)/);
      if (urlMatch) urlHaciendaText = urlMatch[1];
    }
    if (!urlHaciendaText && factura.verifactu_qr && !factura.verifactu_qr.startsWith("data:image")) {
      urlHaciendaText = factura.verifactu_qr;
    }

    const pdf = await generateInvoiceDoc({
      numero_factura: factura.numero_factura,
      cliente_nombre: factura.cliente_nombre,
      cliente_nif: factura.cliente_nif,
      concepto: linea?.concepto || "—",
      importe_total: Number(factura.importe_total),
      fecha_emision: factura.fecha_emision,
      verifactu_qr: urlHaciendaText,
    });

    let pdfData: any = pdf;
    if (pdf && typeof (pdf as any).arrayBuffer === "function") {
      pdfData = await (pdf as any).arrayBuffer();
    } else if (pdf && typeof (pdf as any).toBuffer === "function") {
      pdfData = (pdf as any).toBuffer();
    }

    return new Response(pdfData, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${factura.numero_factura}.pdf"`,
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (err: any) {
    console.error("[generar-doc]", err);
    return Response.json(
      { error: err.message || "Error al generar documento" },
      { status: 500 },
    );
  }
}
