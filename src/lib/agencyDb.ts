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

type CredencialesConexion = {
  supabase_url: string;
  supabase_service_role_key_enc: string;
  iv: string;
  auth_tag: string;
};

// Resuelve las credenciales de conexión reales de una agencia: si tiene
// conexion_bd_id, las lee de conexiones_bd (posiblemente compartida con
// otras agencias); si no, cae a las columnas legadas de `agencias` (agencias
// aún no migradas al modelo de conexión separada). Ver ADR-0002.
async function resolveConexion(
  adminServiceSupabase: ReturnType<typeof createAdminServiceClient>,
  agencia: { conexion_bd_id?: string | null } & Partial<CredencialesConexion>
): Promise<CredencialesConexion | null> {
  if (agencia.conexion_bd_id) {
    const { data: conexion, error } = await adminServiceSupabase
      .from("conexiones_bd")
      .select("supabase_url, supabase_service_role_key_enc, iv, auth_tag")
      .eq("id", agencia.conexion_bd_id)
      .single();

    if (error || !conexion) return null;
    return conexion as CredencialesConexion;
  }

  if (
    agencia.supabase_url &&
    agencia.supabase_service_role_key_enc &&
    agencia.iv &&
    agencia.auth_tag
  ) {
    return agencia as CredencialesConexion;
  }

  return null;
}

// Resuelve las credenciales de agencia a partir de su dominio (para viajeros no autenticados)
export async function getAgencyDbClientByDomain(dominio: string) {
  const adminServiceSupabase = createAdminServiceClient();

  // 1. Try to search by dominio (exact match)
  let { data: agencia, error } = await adminServiceSupabase
    .from("agencias")
    .select("id, conexion_bd_id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, subdomain, dominio, schema_name")
    .eq("dominio", dominio)
    .maybeSingle();

  // 2. If not found, try to search by subdomain (e.g. doncel.vercel.app -> doncel)
  if (!agencia) {
    const parts = dominio.split(".");
    if (parts.length > 1) {
      const potentialSubdomain = parts[0];
      const { data: subAgencia } = await adminServiceSupabase
        .from("agencias")
        .select("id, conexion_bd_id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, subdomain, dominio, schema_name")
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
      .select("id, conexion_bd_id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, subdomain, dominio, schema_name")
      .eq("subdomain", dominio)
      .maybeSingle();

    if (subAgencia) {
      agencia = subAgencia;
    }
  }

  if (!agencia) return null;

  const conexion = await resolveConexion(adminServiceSupabase, agencia);
  if (!conexion) return null;

  const serviceRoleKey = decrypt(
    conexion.supabase_service_role_key_enc,
    conexion.iv,
    conexion.auth_tag
  );

  if (!serviceRoleKey) return null;

  return {
    agenciaId: agencia.id as string,
    db: createClient(conexion.supabase_url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      db: { schema: (agencia.schema_name as string | null) || "public" },
    }),
  };
}

// Resuelve las credenciales de una agencia directamente por su ID (sin depender
// de la sesión del usuario actual). Uso: webhooks, crons, o cualquier contexto
// server-to-server que ya conoce el agencia_id de antemano.
export async function getAgencyDbClientById(agenciaId: string) {
  const adminServiceSupabase = createAdminServiceClient();

  const { data: agencia, error } = await adminServiceSupabase
    .from("agencias")
    .select("conexion_bd_id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, schema_name")
    .eq("id", agenciaId)
    .single();

  if (error || !agencia) {
    throw new Error("No se encontraron los datos de la agencia.");
  }

  const conexion = await resolveConexion(adminServiceSupabase, agencia);
  if (!conexion) {
    throw new Error("Las credenciales de la agencia están incompletas o no están configuradas.");
  }

  const serviceRoleKey = decrypt(
    conexion.supabase_service_role_key_enc,
    conexion.iv,
    conexion.auth_tag
  );

  if (!serviceRoleKey) {
    throw new Error("Error al desencriptar las credenciales de la agencia.");
  }

  return createClient(conexion.supabase_url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: (agencia.schema_name as string | null) || "public" },
  });
}

// Resuelve el agencia_id + schema_name de la agencia del usuario actual,
// sin abrir conexión. Cacheado por request igual que getAgencyDbClient.
export const getAgencyContext = cache(async () => {
  const adminSupabase = await createAdminServerClient();

  const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
  if (userError || !user) {
    throw new Error("No hay usuario autenticado.");
  }

  const adminServiceSupabase = createAdminServiceClient();

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

  const { data: agencia, error: agenciaError } = await adminServiceSupabase
    .from("agencias")
    .select("conexion_bd_id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, schema_name")
    .eq("id", usuario.agencia_id)
    .single();

  if (agenciaError || !agencia) {
    console.error("Error al consultar la tabla agencias con Service Role por ID:", agenciaError);
    throw new Error("No se encontraron los datos de la agencia.");
  }

  const conexion = await resolveConexion(adminServiceSupabase, agencia);
  if (!conexion) {
    throw new Error("Las credenciales de la agencia están incompletas o no están configuradas.");
  }

  return {
    agenciaId: usuario.agencia_id as string,
    schemaName: (agencia.schema_name as string | null) || "public",
    conexion,
  };
});

// Nombre de schema Postgres de la agencia del usuario actual ('public' para
// agencias con BD dedicada). Usado para namespacing de Storage buckets.
export async function getCurrentSchemaName(): Promise<string> {
  const { schemaName } = await getAgencyContext();
  return schemaName;
}

// Deriva el nombre de bucket de Storage a partir del nombre legado (el usado
// hoy, fijo) y el schema de la agencia. Agencias con BD dedicada
// (schema_name === 'public') conservan el nombre legado sin cambios, para no
// requerir ninguna migración de storage existente. Ver docs/adr/ADR-0002.
export function bucketNameForSchema(nombreLegado: string, schemaName: string): string {
  return schemaName === "public" ? nombreLegado : `${nombreLegado}__${schemaName}`;
}

export const getAgencyDbClient = cache(async () => {
  const { schemaName, conexion } = await getAgencyContext();

  // Desencriptar la Service Role Key
  const serviceRoleKey = decrypt(
    conexion.supabase_service_role_key_enc,
    conexion.iv,
    conexion.auth_tag
  );

  if (!serviceRoleKey) {
    throw new Error("Error al desencriptar las credenciales de la agencia.");
  }

  // Instanciar y devolver el cliente de Supabase, fijado al schema de la
  // agencia (permite que varias agencias compartan proyecto Supabase).
  // Retornamos un cliente estándar de supabase-js con la service_role_key (bypasses RLS)
  return createClient(conexion.supabase_url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    db: {
      schema: schemaName,
    },
  });
});
