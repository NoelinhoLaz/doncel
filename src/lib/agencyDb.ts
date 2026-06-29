import { createClient } from "@supabase/supabase-js";
import { createAdminServerClient, createAdminServiceClient } from "./supabaseServer";
import { decrypt } from "./encryption";
import { cache } from "react";

// Resuelve las credenciales de agencia a partir de su dominio (para viajeros no autenticados)
export async function getAgencyDbClientByDomain(dominio: string) {
  const adminServiceSupabase = createAdminServiceClient();

  const { data: agencia, error } = await adminServiceSupabase
    .from("agencias")
    .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag")
    .eq("dominio", dominio)
    .single();

  if (error || !agencia) return null;
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
