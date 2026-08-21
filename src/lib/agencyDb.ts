import { createClient } from "@supabase/supabase-js";
import { createAdminServerClient, createAdminServiceClient } from "./supabaseServer";
import { decrypt, signToken, verifyToken } from "./encryption";
import { cache } from "react";
import { headers, cookies } from "next/headers";

const AGENCY_CTX_COOKIE = "agency_ctx";
const AGENCY_CTX_MAX_AGE = 8 * 60 * 60; // 8 horas

type AgencyCtxCookiePayload = {
  v: 1;
  authUserId: string;
  agenciaId: string;
  schemaName: string;
};

function readAgencyCtxCookie(raw: string | undefined, authUserId: string): { agenciaId: string; schemaName: string } | null {
  if (!raw) return null;
  const decoded = verifyToken(raw);
  if (!decoded) return null;
  try {
    const payload = JSON.parse(decoded) as AgencyCtxCookiePayload;
    if (payload.v !== 1 || payload.authUserId !== authUserId || !payload.agenciaId || !payload.schemaName) return null;
    return { agenciaId: payload.agenciaId, schemaName: payload.schemaName };
  } catch {
    return null;
  }
}

// Best-effort: escribe/actualiza la cookie de contexto de agencia. No lanza si
// se llama desde un contexto donde Next no permite escribir cookies (p.ej. un
// Server Component puro durante el render) — simplemente no cachea esa vez.
async function writeAgencyCtxCookie(authUserId: string, agenciaId: string, schemaName: string) {
  try {
    const payload: AgencyCtxCookiePayload = { v: 1, authUserId, agenciaId, schemaName };
    const token = signToken(JSON.stringify(payload));
    const cookieStore = await cookies();
    cookieStore.set(AGENCY_CTX_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AGENCY_CTX_MAX_AGE,
    });
  } catch {
    // No se puede escribir cookies fuera de Server Actions / Route Handlers.
  }
}

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
export const getAgencyDbClientByDomain = cache(async (dominio: string) => {
  const adminServiceSupabase = createAdminServiceClient();

  // Coincidencia por dominio exacto, por subdomain exacto, o por el subdominio
  // implícito en dominio (p.ej. doncel.vercel.app -> doncel) — en una sola query.
  const parts = dominio.split(".");
  const potentialSubdomain = parts.length > 1 ? parts[0] : null;
  const subdomainValues = [...new Set([dominio, ...(potentialSubdomain ? [potentialSubdomain] : [])])];
  const orFilter = [`dominio.eq.${dominio}`, ...subdomainValues.map((v) => `subdomain.eq.${v}`)].join(",");

  const { data: candidatos } = await adminServiceSupabase
    .from("agencias")
    .select("id, conexion_bd_id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, subdomain, dominio, schema_name")
    .or(orFilter);

  const agencia =
    (candidatos ?? []).find((a: any) => a.dominio === dominio) ??
    (potentialSubdomain ? (candidatos ?? []).find((a: any) => a.subdomain === potentialSubdomain) : null) ??
    (candidatos ?? []).find((a: any) => a.subdomain === dominio) ??
    null;

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
});

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

// Resuelve el auth_user_id del usuario autenticado, evitando la llamada de
// red a auth.getUser() cuando la cookie agency_ctx es válida (su authUserId
// solo pudo haber sido firmado por este servidor, AES-GCM autenticado — es
// tan fiable como el resultado de auth.getUser()). Reemplazo directo de
// `(await createAdminServerClient()).auth.getUser()` en Server Actions que
// solo necesitan el id, sin la fila completa de `usuarios`.
export const getAuthUserId = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(AGENCY_CTX_COOKIE)?.value;
  const decoded = rawCookie ? verifyToken(rawCookie) : null;

  if (decoded) {
    try {
      const payload = JSON.parse(decoded) as AgencyCtxCookiePayload;
      if (payload.v === 1 && payload.authUserId) return payload.authUserId;
    } catch {
      // cookie corrupta, cae al flujo normal
    }
  }

  const adminSupabase = await createAdminServerClient();
  const { data: { user }, error } = await adminSupabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
});

// Resuelve el agencia_id + schema_name de la agencia del usuario actual,
// sin abrir conexión. Cacheado por request igual que getAgencyDbClient.
//
// Intenta primero un fast path leyendo agenciaId/schemaName de la cookie
// agency_ctx (evita la query a `usuarios`); si no hay cookie válida, cae al
// flujo completo y reescribe la cookie con el resultado fresco (best-effort).
export const getAgencyContext = cache(async () => {
  const authUserId = await getAuthUserId();
  if (!authUserId) {
    throw new Error("No hay usuario autenticado.");
  }

  const adminServiceSupabase = createAdminServiceClient();

  const cookieStore = await cookies();
  const cached = readAgencyCtxCookie(cookieStore.get(AGENCY_CTX_COOKIE)?.value, authUserId);

  let agenciaId: string;
  let schemaNameFromCookie: string | null = null;

  if (cached) {
    agenciaId = cached.agenciaId;
    schemaNameFromCookie = cached.schemaName;
  } else {
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id, rol")
      .eq("auth_user_id", authUserId)
      .single();

    if (usuarioError || !usuario) {
      console.error("Error al obtener usuario:", usuarioError);
      throw new Error("Usuario no encontrado en la base de datos de administración.");
    }

    if (!usuario.agencia_id) {
      throw new Error("El usuario no tiene una agencia asignada.");
    }

    agenciaId = usuario.agencia_id as string;
  }

  const { data: agencia, error: agenciaError } = await adminServiceSupabase
    .from("agencias")
    .select("conexion_bd_id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, schema_name")
    .eq("id", agenciaId)
    .single();

  if (agenciaError || !agencia) {
    console.error("Error al consultar la tabla agencias con Service Role por ID:", agenciaError);
    throw new Error("No se encontraron los datos de la agencia.");
  }

  const conexion = await resolveConexion(adminServiceSupabase, agencia);
  if (!conexion) {
    throw new Error("Las credenciales de la agencia están incompletas o no están configuradas.");
  }

  const schemaName = schemaNameFromCookie || (agencia.schema_name as string | null) || "public";

  if (!cached) {
    await writeAgencyCtxCookie(authUserId, agenciaId, schemaName);
  }

  return {
    agenciaId,
    schemaName,
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
