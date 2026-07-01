"use server";

import { cookies } from "next/headers";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/encryption";

const COOKIE_NAME = "proveedor_session";

// ── Session ────────────────────────────────────────────────────────────────

export async function getProveedorSession(): Promise<{
  userId: string;
  nombre: string;
  email: string;
  cifNif: string;
} | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return null;
    const { d, iv, t } = JSON.parse(raw);
    if (!d || !iv || !t) return null;
    return JSON.parse(decrypt(d, iv, t));
  } catch {
    return null;
  }
}

export async function clearProveedorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function loginProveedor(email: string, cifNif: string) {
  const emailTrimmed = email.trim().toLowerCase();
  const cifTrimmed = cifNif.trim().toUpperCase();

  if (!emailTrimmed || !cifTrimmed) {
    return { error: "Introduce el email y el CIF/NIF" };
  }

  try {
    const adminService = createAdminServiceClient();

    // Verificar en la tabla de usuarios Admin que existe un proveedor con ese email + CIF
    const { data: usuario, error: userError } = await (adminService
      .from("usuarios")
      .select("id, nombre, email, cif_nif, rol")
      .eq("email", emailTrimmed)
      .eq("cif_nif", cifTrimmed)
      .eq("rol", "Proveedor")
      .maybeSingle() as any);

    if (userError) return { error: `Error BD: ${userError.message}` };
    if (!usuario) return { error: "Datos incorrectos o usuario no autorizado" };

    const { encryptedData, iv, authTag } = encrypt(
      JSON.stringify({
        userId: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        cifNif: usuario.cif_nif,
      }),
    );

    const cookieStore = await cookies();
    cookieStore.set(
      COOKIE_NAME,
      JSON.stringify({ d: encryptedData, iv, t: authTag }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      },
    );

    return { success: true };
  } catch (err: any) {
    console.error("[proveedor] Error en login:", err);
    return { error: `Error interno: ${err.message}` };
  }
}

// ── Dashboard: barrido multi-tenant ───────────────────────────────────────

export type ServicioProveedor = {
  id: string;
  concepto: string | null;
  importe: number;
  importe_pagado: number;
  estado: "pendiente" | "parcial" | "confirmado" | "opcional" | "anulado";
  fecha: string | null;
  medio_pago: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  expediente_referencia: string | null;
  expediente_numero: string | null;
  agencia_id: string;
  agencia_nombre: string;
};

export async function getProveedorDashboard(): Promise<ServicioProveedor[]> {
  try {
    const session = await getProveedorSession();
    console.log("[proveedor] session:", session);
    if (!session) return [];

    const adminService = createAdminServiceClient();

    const { data: agencias, error: agError } = await (adminService
      .from("agencias")
      .select(
        "id, nombre_comercial, supabase_url, supabase_service_role_key_enc, iv, auth_tag",
      )
      .eq("estado", "Activo") as any);

    console.log("[proveedor] agencias:", agencias?.length, agError);
    if (agError || !agencias || agencias.length === 0) return [];

    const resultsPorTenant = await Promise.all(
      agencias.map(async (agencia: any) => {
        try {
          if (
            !agencia.supabase_service_role_key_enc ||
            !agencia.iv ||
            !agencia.auth_tag
          )
            return [];

          const serviceRoleKey = decrypt(
            agencia.supabase_service_role_key_enc,
            agencia.iv,
            agencia.auth_tag,
          );

          const tenantDb = createClient(agencia.supabase_url, serviceRoleKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          });

          // Buscar el proveedor en este tenant por CIF
          const { data: prov, error: provError } = await tenantDb
            .from("contabilidad_proveedores")
            .select("id, nombre, razon_social")
            .eq('"CIF"', session.cifNif)
            .maybeSingle();

          console.log(`[proveedor] tenant ${agencia.nombre_comercial} prov:`, prov, provError);
          if (!prov) return [];

          // Buscar servicios vinculados a este proveedor
          const { data: servicios, error: svcError } = await tenantDb
            .from("operativa_expedientes_servicios")
            .select(
              `id, descripcion, neto, pvp, plazas, total, opcional, created_at, documento_id,
               operativa_expedientes!expediente_id(id, referencia, numero, fecha_inicio, fecha_fin)`,
            )
            .eq("proveedor_id", prov.id)
            .order("created_at", { ascending: false });

          console.log(`[proveedor] servicios tenant ${agencia.nombre_comercial}:`, servicios?.length, svcError);
          if (svcError || !servicios) return [];

          // Obtener documentos de proveedor para los servicios que tienen documento_id
          const documentoIds = [...new Set(
            servicios.map((s: any) => s.documento_id).filter(Boolean)
          )];

          const docMap = new Map<string, { total_documento: number; importe_pagado: number; metodo_pago: string | null }>();
          if (documentoIds.length > 0) {
            const { data: docs } = await tenantDb
              .from("operativa_documentos_proveedor")
              .select("id, total_documento, importe_pagado, metodo_pago")
              .in("id", documentoIds);
            for (const d of docs ?? []) {
              docMap.set(d.id, {
                total_documento: Number(d.total_documento || 0),
                importe_pagado:  Number(d.importe_pagado  || 0),
                metodo_pago:     d.metodo_pago ?? null,
              });
            }
          }

          return servicios.map((s: any) => {
            const exp = s.operativa_expedientes as any;
            const doc = s.documento_id ? docMap.get(s.documento_id) : null;
            const importe       = Number(s.total || 0);
            const importePagado = doc?.importe_pagado ?? 0;
            const totalDoc      = doc?.total_documento ?? importe;

            let estado: ServicioProveedor["estado"];
            if (s.opcional) {
              estado = "opcional";
            } else if (importePagado <= 0) {
              estado = "pendiente";
            } else if (importePagado >= totalDoc - 0.01) {
              estado = "confirmado";
            } else {
              estado = "parcial";
            }

            return {
              id: s.id,
              concepto: s.descripcion ?? null,
              importe,
              importe_pagado: importePagado,
              estado,
              fecha: exp?.fecha_inicio ?? null,
              medio_pago: doc?.metodo_pago ?? null,
              fecha_inicio: exp?.fecha_inicio ?? null,
              fecha_fin: exp?.fecha_fin ?? null,
              expediente_referencia: exp?.referencia ?? null,
              expediente_numero: exp?.numero?.toString() ?? null,
              agencia_id: agencia.id,
              agencia_nombre: agencia.nombre_comercial ?? agencia.id,
            } satisfies ServicioProveedor;
          });
        } catch (err) {
          console.error(
            `[proveedor] Error barriendo tenant ${agencia.nombre_comercial}:`,
            err,
          );
          return [];
        }
      }),
    );

    return resultsPorTenant.flat();
  } catch (err: any) {
    console.error("[proveedor] Error inesperado en getProveedorDashboard:", err);
    return [];
  }
}
