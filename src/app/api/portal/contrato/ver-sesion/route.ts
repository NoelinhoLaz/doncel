import { NextRequest } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";
import { generateContractPreview } from "@/lib/portalDrive";

function getSession(request: NextRequest) {
  try {
    const raw = request.cookies.get("portal_session")?.value;
    if (!raw) return null;
    const { d, iv, t } = JSON.parse(raw);
    if (!d || !iv || !t) return null;
    return JSON.parse(decrypt(d, iv, t)) as {
      entityId: string;
      entityName: string;
      email: string;
    };
  } catch {
    return null;
  }
}

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
  const key = decrypt(agencia.supabase_service_role_key_enc, agencia.iv, agencia.auth_tag);
  return createClient(agencia.supabase_url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session) {
      return Response.redirect(new URL("/portal/login", request.url));
    }

    const expedienteId = new URL(request.url).searchParams.get("expedienteId");
    if (!expedienteId) {
      return Response.json({ error: "Falta expedienteId" }, { status: 400 });
    }

    const agencyDb = await getAgencyDb();

    const { data: exp, error: expError } = await agencyDb
      .from("operativa_expedientes")
      .select(`
        id, numero, referencia, entidad_id, fecha_inicio, fecha_fin,
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

    if (expError || !exp) {
      return Response.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const isMain = (exp as any).entidad_id === session.entityId;
    const { data: pagLinks } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("id")
      .eq("expediente_id", expedienteId)
      .eq("entidad_id", session.entityId)
      .limit(1);

    if (!isMain && !(pagLinks && pagLinks.length > 0)) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const viajeros = ((exp as any).operativa_viajeros_expedientes || []) as any[];
    const servicios = ((exp as any).operativa_expedientes_servicios || []) as any[];
    const entity = (exp as any).contabilidad_entidades as any || {};
    const fmt = (n: number) =>
      new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

    const bucketName = "contratos-preview";
    const storagePath = `${expedienteId}.pdf`;

    const { data: cachedPdf } = await agencyDb.storage
      .from(bucketName)
      .download(storagePath);

    let pdf: Uint8Array;

    if (cachedPdf) {
      pdf = new Uint8Array(await cachedPdf.arrayBuffer());
    } else {
      pdf = await generateContractPreview({
        expedienteId: (exp as any).id,
        numero: (exp as any).numero?.toString() || "",
        referencia: (exp as any).referencia || "",
        destino: ((exp as any).maestro_destinos as any)?.nombre || "",
        fechaInicio: (exp as any).fecha_inicio
          ? new Date((exp as any).fecha_inicio).toLocaleDateString("es-ES") : "",
        fechaFin: (exp as any).fecha_fin
          ? new Date((exp as any).fecha_fin).toLocaleDateString("es-ES") : "",
        clienteNombre: entity.nombre || "",
        clienteDocumento: entity.documento || "",
        clienteEmail: entity.email || "",
        viajeros: viajeros.map((v: any) => v.contabilidad_entidades?.nombre).filter(Boolean).join(", "),
        precio: fmt(Number((exp as any).pvp_total || (exp as any).pvp_viajero || 0)),
        servicios: servicios.map((s: any) => s.descripcion).filter(Boolean).join("\n"),
      });

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
    console.error("[contrato/ver-sesion]", err);
    return Response.json({ error: err.message || "Error" }, { status: 500 });
  }
}
