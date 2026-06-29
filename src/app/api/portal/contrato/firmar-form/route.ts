import { NextRequest, NextResponse } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";
import { generateSignedContract } from "@/lib/portalDrive";

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

function base(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
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

export async function POST(request: NextRequest) {
  const b = base(request);
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.redirect(`${b}/portal/login`, { status: 303 });
    }

    const formData = await request.formData();
    const expedienteId = (formData.get("expedienteId") as string || "").trim();

    if (!expedienteId) {
      return NextResponse.redirect(`${b}/portal/dashboard?tab=docs`, { status: 303 });
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
      return NextResponse.redirect(`${b}/portal/dashboard?tab=docs`, { status: 303 });
    }

    const isMain = (exp as any).entidad_id === session.entityId;
    const { data: pagLinks } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("id")
      .eq("expediente_id", expedienteId)
      .eq("entidad_id", session.entityId)
      .limit(1);

    if (!isMain && !(pagLinks && pagLinks.length > 0)) {
      return NextResponse.redirect(`${b}/portal/dashboard?tab=docs`, { status: 303 });
    }

    const { data: entityData } = await agencyDb
      .from("contabilidad_entidades")
      .select("nombre, documento, email")
      .eq("id", session.entityId)
      .single();

    const entity = entityData || { nombre: session.entityName, documento: "", email: session.email };
    const viajeros = ((exp as any).operativa_viajeros_expedientes || []) as any[];
    const servicios = ((exp as any).operativa_expedientes_servicios || []) as any[];
    const fmt = (n: number) =>
      new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    await generateSignedContract(
      {
        expedienteId: (exp as any).id,
        numero: (exp as any).numero?.toString() || "",
        referencia: (exp as any).referencia || "",
        destino: ((exp as any).maestro_destinos as any)?.nombre || "",
        fechaInicio: (exp as any).fecha_inicio
          ? new Date((exp as any).fecha_inicio).toLocaleDateString("es-ES") : "",
        fechaFin: (exp as any).fecha_fin
          ? new Date((exp as any).fecha_fin).toLocaleDateString("es-ES") : "",
        clienteNombre: (entity as any).nombre || "",
        clienteDocumento: (entity as any).documento || "",
        clienteEmail: (entity as any).email || "",
        viajeros: viajeros.map((v: any) => v.contabilidad_entidades?.nombre).filter(Boolean).join(", "),
        precio: fmt(Number((exp as any).pvp_total || (exp as any).pvp_viajero || 0)),
        servicios: servicios.map((s: any) => s.descripcion).filter(Boolean).join("\n"),
      },
      {
        ip,
        userAgent: request.headers.get("user-agent") || "",
        acceptLanguage: request.headers.get("accept-language") || "",
        screenResolution: "Desconocida",
      },
    );

    return NextResponse.redirect(`${b}/portal/dashboard?tab=docs&firmado=1`, { status: 303 });
  } catch (err: any) {
    console.error("[contrato/firmar-form]", err);
    return NextResponse.redirect(`${b}/portal/dashboard?tab=docs`, { status: 303 });
  }
}
