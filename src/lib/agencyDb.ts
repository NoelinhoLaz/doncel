import { createClient } from "@supabase/supabase-js";
import { createAdminServerClient, createAdminServiceClient } from "./supabaseServer";
import { decrypt } from "./encryption";
import { cache } from "react";
import { headers } from "next/headers";

/**
 * Resuelve el dominio "público" actual para páginas sin sesión de usuario.
 * En local (localhost/IP privada) usa NEXT_PUBLIC_AGENCY_DOMAIN_OVERRIDE para simular
 * el dominio de una agencia real, igual que hace /registro/[slug].
 */
export async function getDominioActualPublico(): Promise<string | null> {
  const override = process.env.NEXT_PUBLIC_AGENCY_DOMAIN_OVERRIDE;
  if (override) return override;

  const h = await headers();
  const host = h.get("x-tenant-host") || h.get("host") || "";
  if (!host || host.startsWith("localhost") || host.startsWith("127.0.0.1") || /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return null;
  }
  return host.split(":")[0];
}

// Resuelve las credenciales de agencia a partir de su dominio (para viajeros no autenticados)
export async function getAgencyDbClientByDomain(dominio: string) {
  const adminServiceSupabase = createAdminServiceClient();

  // 1. Try to search by dominio (exact match)
  let { data: agencia, error } = await adminServiceSupabase
    .from("agencias")
    .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, subdomain, dominio")
    .eq("dominio", dominio)
    .maybeSingle();

  // 2. If not found, try to search by subdomain (e.g. doncel.vercel.app -> doncel)
  if (!agencia) {
    const parts = dominio.split(".");
    if (parts.length > 1) {
      const potentialSubdomain = parts[0];
      const { data: subAgencia } = await adminServiceSupabase
        .from("agencias")
        .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, subdomain, dominio")
        .eq("subdomain", potentialSubdomain)
        .maybeSingle();

      if (subAgencia) {
        agencia = subAgencia;
      }
    }
  }

  // 3. Fallback: if dominio matches subdomain directly (e.g. in local dev)
  if (!agencia) {
    const { data: subAgencia } = await adminServiceSupabase
      .from("agencias")
      .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, subdomain, dominio")
      .eq("subdomain", dominio)
      .maybeSingle();

    if (subAgencia) {
      agencia = subAgencia;
    }
  }

  if (!agencia) return null;
  if (!agencia.supabase_service_role_key_enc || !agencia.iv || !agencia.auth_tag) return null;

  const serviceRoleKey = decrypt(
    agencia.supabase_service_role_key_enc,
    agencia.iv,
    agencia.auth_tag
  );

  if (!serviceRoleKey) return null;

  return {
    agenciaId: agencia.id as string,
    db: createClient(agencia.supabase_url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
}

export const getAgencyDbClient = cache(async () => {
  const adminSupabase = await createAdminServerClient();

  // 1. Obtener el usuario actual de forma segura
  const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error("No hay usuario autenticado.");
  }

  const adminServiceSupabase = createAdminServiceClient();

  // 2. Obtener el agencia_id del usuario actual usando el Service Role client
  const { data: usuario, error: usuarioError } = await adminServiceSupabase
    .from("usuarios")
    .select("agencia_id, rol")
    .eq("auth_user_id", user.id)
    .single();

  if (usuarioError || !usuario) {
    console.error("Error al obtener usuario:", usuarioError);
    throw new Error("Usuario no encontrado en la base de datos de administración.");
  }

  if (!usuario.agencia_id) {
    throw new Error("El usuario no tiene una agencia asignada.");
  }
  const agenciaId = usuario.agencia_id;

  // 3. Obtener las credenciales de la agencia desde la tabla agencias usando el ID
  const { data: agencia, error: agenciaError } = await adminServiceSupabase
    .from("agencias")
    .select("supabase_url, supabase_service_role_key_enc, iv, auth_tag")
    .eq("id", agenciaId)
    .single();

  if (agenciaError || !agencia) {
    console.error("Error al consultar la tabla agencias con Service Role por ID:", agenciaError);
    throw new Error("No se encontraron los datos de la agencia.");
  }


  if (!agencia.supabase_service_role_key_enc || !agencia.iv || !agencia.auth_tag) {
    throw new Error("Las credenciales de la agencia están incompletas o no están configuradas.");
  }

  // 4. Desencriptar la Service Role Key
  const serviceRoleKey = decrypt(
    agencia.supabase_service_role_key_enc,
    agencia.iv,
    agencia.auth_tag
  );

  if (!serviceRoleKey) {
    throw new Error("Error al desencriptar las credenciales de la agencia.");
  }

  // 5. Instanciar y devolver el cliente de Supabase
  // Retornamos un cliente estándar de supabase-js con la service_role_key (bypasses RLS)
  return createClient(agencia.supabase_url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
});
