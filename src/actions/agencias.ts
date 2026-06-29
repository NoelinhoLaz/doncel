"use server";

import { encrypt } from "@/lib/encryption";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

export async function encryptAgencySecrets(
  serviceRoleKey: string,
  anonKey?: string
) {
  const srk = encrypt(serviceRoleKey);

  const result: Record<string, string | null> = {
    supabase_service_role_key_enc: srk.encryptedData,
    iv: srk.iv,
    auth_tag: srk.authTag,
  };

  if (anonKey) {
    const ak = encrypt(anonKey);
    result.supabase_anon_key_enc = ak.encryptedData;
    result.supabase_anon_key_iv  = ak.iv;
    result.supabase_anon_key_tag = ak.authTag;
  }

  return result;
}

export async function encryptAnonKey(anonKey: string) {
  const { encryptedData, iv, authTag } = encrypt(anonKey);
  return {
    supabase_anon_key_enc: encryptedData,
    supabase_anon_key_iv:  iv,
    supabase_anon_key_tag: authTag,
  };
}

export async function getCurrentAgencyDetails() {
  try {
    const adminSupabase = await createAdminServerClient();

    // 1. Obtener el usuario actual de forma segura
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return null;
    }

    // 2. Obtener el agencia_id del usuario actual usando el Service Role client
    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.agencia_id) {
      return null;
    }

    // 3. Obtener el logo_url, nombre_comercial, color_corporativo y color_secundario de la tabla agencias
    const { data: agencia, error: agenciaError } = await adminServiceSupabase
      .from("agencias")
      .select("logo_url, nombre_comercial, color_corporativo, color_secundario")
      .eq("id", usuario.agencia_id)
      .single();

    if (agenciaError || !agencia) {
      return null;
    }

    return {
      logo_url: agencia.logo_url,
      nombre_comercial: agencia.nombre_comercial,
      color_corporativo: agencia.color_corporativo,
      color_secundario: agencia.color_secundario
    };
  } catch (error) {
    console.error("Failed to get current agency details:", error);
    return null;
  }
}

import { revalidatePath } from "next/cache";

export async function updateAgencyColor(color: string) {
  try {
    const adminSupabase = await createAdminServerClient();

    // 1. Obtener el usuario actual de forma segura
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error("No authenticated session found");
    }

    // 2. Obtener el agencia_id del usuario actual
    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.agencia_id) {
      throw new Error("User agency not found");
    }

    // 3. Actualizar color_corporativo en la tabla agencias
    const { error: updateError } = await adminServiceSupabase
      .from("agencias")
      .update({ color_corporativo: color })
      .eq("id", usuario.agencia_id);

    if (updateError) {
      throw updateError;
    }

    // Revalidar las rutas para refrescar en caliente
    revalidatePath("/", "layout");
    revalidatePath("/settings");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update agency color:", error);
    throw new Error(error.message || "Failed to update agency color");
  }
}

export async function updateAgencyLogo(logoUrl: string | null) {
  try {
    const adminSupabase = await createAdminServerClient();

    // 1. Obtener el usuario actual de forma segura
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error("No authenticated session found");
    }

    // 2. Obtener el agencia_id del usuario actual
    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.agencia_id) {
      throw new Error("User agency not found");
    }

    // 3. Actualizar logo_url en la tabla agencias
    const { error: updateError } = await adminServiceSupabase
      .from("agencias")
      .update({ logo_url: logoUrl })
      .eq("id", usuario.agencia_id);

    if (updateError) {
      throw updateError;
    }

    // Revalidar las rutas para refrescar en caliente
    revalidatePath("/", "layout");
    revalidatePath("/settings");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update agency logo:", error);
    throw new Error(error.message || "Failed to update agency logo");
  }
}

export async function getAgencyUsers(): Promise<{ id: string; nombre: string; apellidos: string }[]> {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) return [];

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!usuario?.agencia_id) return [];

    const { data: users } = await adminServiceSupabase
      .from("usuarios")
      .select("id, nombre, apellidos")
      .eq("agencia_id", usuario.agencia_id)
      .order("nombre");

    return (users || []).map(u => ({ id: u.id, nombre: u.nombre || "", apellidos: u.apellidos || "" }));
  } catch {
    return [];
  }
}

export async function updateAgencySecondaryColor(color: string) {
  try {
    const adminSupabase = await createAdminServerClient();

    // 1. Obtener el usuario actual de forma segura
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error("No authenticated session found");
    }

    // 2. Obtener el agencia_id del usuario actual
    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.agencia_id) {
      throw new Error("User agency not found");
    }

    // 3. Actualizar color_secundario en la tabla agencias
    const { error: updateError } = await adminServiceSupabase
      .from("agencias")
      .update({ color_secundario: color })
      .eq("id", usuario.agencia_id);

    if (updateError) {
      throw updateError;
    }

    // Revalidar las rutas para refrescar en caliente
    revalidatePath("/", "layout");
    revalidatePath("/settings");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update agency secondary color:", error);
    throw new Error(error.message || "Failed to update agency secondary color");
  }
}
