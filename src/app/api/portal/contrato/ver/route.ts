import { NextRequest } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { decrypt, verifyToken } from "@/lib/encryption";
import { generateContractPreview } from "@/lib/portalDrive";

async function getAgencyDb() {
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

function getSessionFromRequest(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const expedienteId = searchParams.get("expedienteId");
    const token = searchParams.get("token");

    if (!expedienteId || !token) {
      return Response.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return Response.json({ error: "Token inválido" }, { status: 403 });
    }

    let parsed: { expedienteId: string; entityId: string };
    try {
      parsed = JSON.parse(payload);
    } catch {
      return Response.json({ error: "Token inválido" }, { status: 403 });
    }

    if (parsed.expedienteId !== expedienteId || parsed.entityId !== session.entityId) {
      return Response.json({ error: "Token inválido" }, { status: 403 });
    }

    const agencyDb = await getAgencyDb();

    const { data: expediente, error: expError } = await agencyDb
      .from("operativa_expedientes")
      .select(`
        id, numero, referencia, destino_principal, fecha_inicio, fecha_fin,
        pvp_viajero, pvp_total,
        maestro_destinos(nombre),
        contabilidad_entidades(nombre, documento, email),
        operativa_expedientes_servicios(descripcion),
        operativa_viajeros_expedientes(
          contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(nombre)
        )
      `)
      .eq("id", expedienteId)
      .single();

    if (expError || !expediente) {
      return Response.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const viajeros = (expediente.operativa_viajeros_expedientes || []) as any[];
    const servicios = (expediente.operativa_expedientes_servicios || []) as any[];

    const formatEuro = (n: number) =>
      new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

    const entity = expediente.contabilidad_entidades as any || {};

    const contractData = {
      expedienteId: expediente.id,
      numero: expediente.numero?.toString() || "",
      referencia: expediente.referencia || "",
      destino: (expediente.maestro_destinos as any)?.nombre || "",
      fechaInicio: expediente.fecha_inicio
        ? new Date(expediente.fecha_inicio).toLocaleDateString("es-ES") : "",
      fechaFin: expediente.fecha_fin
        ? new Date(expediente.fecha_fin).toLocaleDateString("es-ES") : "",
      clienteNombre: entity?.nombre || "",
      clienteDocumento: entity?.documento || "",
      clienteEmail: entity?.email || "",
      viajeros: viajeros
        .map((v: any) => v.contabilidad_entidades?.nombre)
        .filter(Boolean)
        .join(", "),
      precio: formatEuro(Number(expediente.pvp_total || expediente.pvp_viajero || 0)),
      servicios: servicios
        .map((s: any) => s.descripcion)
        .filter(Boolean)
        .join("\n"),
    };

    const bucketName = "contratos-preview";
    const storagePath = `${expedienteId}.pdf`;

    const { data: cachedPdf } = await agencyDb.storage
      .from(bucketName)
      .download(storagePath);

    let pdf: Uint8Array;

    if (cachedPdf) {
      pdf = new Uint8Array(await cachedPdf.arrayBuffer());
    } else {
      pdf = await generateContractPreview(contractData);

      await agencyDb.storage
        .from(bucketName)
        .upload(storagePath, pdf, {
          contentType: "application/pdf",
          upsert: true,
        })
        .catch(() => {});
    }

    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="contrato_${expedienteId}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("[contrato/ver]", err);
    return Response.json({ error: err.message || "Error" }, { status: 500 });
  }
}
