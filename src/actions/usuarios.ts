"use server";

import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";
import { signToken, verifyToken } from "@/lib/encryption";

export async function getAgencyUsuarios() {
  try {
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
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario) {
      console.error("Error al obtener usuario actual:", usuarioError);
      throw new Error("Usuario no encontrado en la base de datos.");
    }

    if (!usuario.agencia_id) {
      throw new Error("El usuario no tiene una agencia asignada.");
    }

    // 3. Obtener todos los usuarios de esa agencia usando el Service Role client de Admin DB
    const { data: usuarios, error: usuariosError } = await adminServiceSupabase
      .from("usuarios")
      .select("id, nombre, apellidos, email, rol, estado, esta_activo, telefono")
      .eq("agencia_id", usuario.agencia_id)
      .order("nombre", { ascending: true });

    if (usuariosError) {
      console.error("Error al cargar los usuarios de la agencia:", usuariosError);
      throw usuariosError;
    }

    // 4. Obtener las configuraciones de usuario de la Agency DB
    let configs: any[] = [];
    try {
      const agencyDb = await getAgencyDbClient();
      const { data, error } = await agencyDb
        .from("config_usuarios")
        .select("usuario_id, oficina, cuentas_bancarias");
      
      if (!error && data) {
        configs = data;
      } else {
        console.warn("No se pudieron cargar configuraciones de usuario (es posible que la tabla no esté actualizada aún):", error?.message);
      }
    } catch (dbErr: any) {
      console.warn("Error al intentar conectar con la Agency DB para config_usuarios:", dbErr.message);
    }

    // 5. Fusionar datos
    const mergedUsuarios = usuarios.map((u: any) => {
      const config = configs.find((c: any) => c.usuario_id === u.id);
      return {
        ...u,
        oficina: config?.oficina || "",
        cuentas_bancarias: config?.cuentas_bancarias || []
      };
    });

    return mergedUsuarios;
  } catch (error: any) {
    console.error("Failed to get agency users:", error.message);
    throw new Error(error.message || "Failed to fetch users");
  }
}

export async function saveAgencyUsuario(
  userId: string | null,
  payload: {
    nombre: string;
    apellidos: string;
    email: string;
    telefono: string;
    rol: string;
    oficina: string | null;
    cuentas_bancarias: string[];
  }
) {
  try {
    const adminSupabase = await createAdminServerClient();

    // 1. Obtener el usuario actual de forma segura
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error("No authenticated session found");
    }

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.agencia_id) {
      throw new Error("User agency not found");
    }

    const currentAgencyId = usuario.agencia_id;
    let targetUserId = userId;

    if (!targetUserId) {
      // A. Invitar al usuario — Supabase envía un email para que establezca su contraseña
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const { data: authUser, error: authError } = await adminServiceSupabase.auth.admin.inviteUserByEmail(
        payload.email,
        {
          data: { nombre: payload.nombre, apellidos: payload.apellidos },
          redirectTo: `${appUrl}/login`,
        }
      );

      if (authError || !authUser?.user) {
        console.error("Error al invitar usuario:", authError);
        throw new Error(authError?.message || "Failed to invite user");
      }

      targetUserId = authUser.user.id;

      // B. Crear registro en la tabla usuarios de la BD Admin
      const { error: insertError } = await adminServiceSupabase
        .from("usuarios")
        .insert({
          id: targetUserId,
          auth_user_id: targetUserId,
          agencia_id: currentAgencyId,
          email: payload.email,
          nombre: payload.nombre,
          apellidos: payload.apellidos,
          telefono: payload.telefono || null,
          rol: payload.rol || "Agente",
          estado: "Activo",
          esta_activo: true
        });

      if (insertError) {
        console.error("Error al registrar usuario en la BD Admin:", insertError);
        // Deshacer creación de auth user en caso de error para no dejar huérfanos
        await adminServiceSupabase.auth.admin.deleteUser(targetUserId);
        throw insertError;
      }
    } else {
      // A. Modificar en la tabla usuarios de la BD Admin
      const { error: updateError } = await adminServiceSupabase
        .from("usuarios")
        .update({
          nombre: payload.nombre,
          apellidos: payload.apellidos,
          email: payload.email,
          telefono: payload.telefono || null,
          rol: payload.rol || "Agente"
        })
        .eq("id", targetUserId);

      if (updateError) {
        console.error("Error al actualizar usuario en la BD Admin:", updateError);
        throw updateError;
      }

      // B. Sincronizar cambios en Supabase Auth
      const { error: authUpdateError } = await adminServiceSupabase.auth.admin.updateUserById(targetUserId, {
        email: payload.email,
        user_metadata: { nombre: payload.nombre, apellidos: payload.apellidos }
      });
      if (authUpdateError) {
        console.warn("No se pudo actualizar el email de autenticación:", authUpdateError.message);
      }
    }

    // 2. Persistir configuración del usuario (oficina y cuentas) en la Agency DB
    try {
      const agencyDb = await getAgencyDbClient();
      const { error: configError } = await agencyDb
        .from("config_usuarios")
        .upsert({
          usuario_id: targetUserId,
          oficina: payload.oficina || null,
          cuentas_bancarias: payload.cuentas_bancarias || []
        }, {
          onConflict: "usuario_id"
        });

      if (configError) {
        console.error("Error al guardar la configuración de usuario en la Agency DB:", configError);
        throw configError;
      }

      // 2b. Sincronizar agente en crm_agentes (espejo para CRM)
      const { data: usuarioSyncData } = await createAdminServiceClient()
        .from("usuarios")
        .select("id, auth_user_id, nombre, apellidos, avatar_url, rol, esta_activo")
        .eq("id", targetUserId)
        .single();

      if (usuarioSyncData?.auth_user_id) {
        await agencyDb.from("crm_agentes").upsert({
          id:         usuarioSyncData.id,
          auth_uid:   usuarioSyncData.auth_user_id,
          nombre:     usuarioSyncData.nombre ?? '',
          apellidos:  usuarioSyncData.apellidos ?? null,
          avatar_url: usuarioSyncData.avatar_url ?? null,
          rol:        usuarioSyncData.rol,
          activo:     usuarioSyncData.esta_activo ?? true,
          synced_at:  new Date().toISOString(),
        }, { onConflict: 'id' });
      }
    } catch (agencyDbErr: any) {
      console.warn("No se pudo persistir la configuración en la Agency DB (comprobar si se ha ejecutado el SQL de migración):", agencyDbErr.message);
    }

    // 3. Revalidar Ajustes
    revalidatePath("/settings");

    return { success: true, userId: targetUserId };
  } catch (error: any) {
    console.error("Failed to save agency user:", error);
    throw new Error(error.message || "Failed to save agency user");
  }
}

export async function getCurrentUsuario() {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return null;
    }

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("id, nombre, apellidos, email, rol")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario) {
      console.error("Error al obtener usuario actual:", usuarioError);
      return null;
    }

    // 3. Obtener la configuración de oficina en Agency DB
    let oficina_id = null;
    try {
      const agencyDb = await getAgencyDbClient();
      const { data: config } = await agencyDb
        .from("config_usuarios")
        .select("oficina")
        .eq("usuario_id", usuario.id)
        .single();

      if (config && config.oficina) {
        oficina_id = config.oficina;
      }
    } catch (dbErr) {
      console.warn("Could not load config_usuarios for current user:", dbErr);
    }

    return {
      ...usuario,
      oficina_id
    };
  } catch (error) {
    console.error("Error in getCurrentUsuario:", error);
    return null;
  }
}

export async function getCurrentUserEmailConfig() {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "No authenticated user" };
    }

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select(`
        id, metadata,
        email_provider, email_address, email_password_enc,
        email_imap_host, email_imap_port, email_smtp_host,
        email_smtp_port, email_use_ssl
      `)
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario) {
      console.error("Error al obtener config de email:", usuarioError);
      return { success: false, error: "User record not found in Admin DB" };
    }

    // Try dedicated columns first
    if (usuario.email_provider) {
      return {
        success: true,
        data: {
          email_provider: usuario.email_provider,
          email_address: usuario.email_address,
          email_password_enc: usuario.email_password_enc,
          email_imap_host: usuario.email_imap_host,
          email_imap_port: usuario.email_imap_port,
          email_smtp_host: usuario.email_smtp_host,
          email_smtp_port: usuario.email_smtp_port,
          email_use_ssl: usuario.email_use_ssl
        }
      };
    }

    // Gracefully fallback to JSONB metadata if present
    const meta = usuario.metadata || {};
    if (meta.email_config) {
      return {
        success: true,
        data: meta.email_config
      };
    }

    return { success: true, data: null };
  } catch (err: any) {
    console.error("Error loading email configuration:", err);
    return { success: false, error: err.message || "Failed to load email configuration" };
  }
}

export async function saveEmailConfiguration(payload: any) {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "No authenticated user" };
    }

    const adminServiceSupabase = createAdminServiceClient();

    // 1. Attempt to save using dedicated database columns
    try {
      const { error: columnUpdateError } = await adminServiceSupabase
        .from("usuarios")
        .update({
          email_provider: payload.email_provider || null,
          email_address: payload.email_address || null,
          email_password_enc: payload.email_password_enc ? signToken(payload.email_password_enc) : null,
          email_imap_host: payload.email_imap_host || null,
          email_imap_port: payload.email_imap_port ? Number(payload.email_imap_port) : null,
          email_smtp_host: payload.email_smtp_host || null,
          email_smtp_port: payload.email_smtp_port ? Number(payload.email_smtp_port) : null,
          email_use_ssl: payload.email_use_ssl !== undefined ? payload.email_use_ssl : true
        })
        .eq("auth_user_id", user.id);

      if (columnUpdateError) {
        // If it's a column not found error (usually Postgrest code 'PGRST' / '42703' or similar), throw to trigger metadata fallback
        throw columnUpdateError;
      }

      return { success: true, method: "columns" };
    } catch (columnErr: any) {
      console.warn("Dedicated columns update failed or SQL migration not executed. Falling back to JSONB metadata:", columnErr.message || columnErr);

      // 2. Fetch current metadata row
      const { data: usuario, error: fetchError } = await adminServiceSupabase
        .from("usuarios")
        .select("metadata")
        .eq("auth_user_id", user.id)
        .single();

      if (fetchError || !usuario) {
        throw new Error(fetchError?.message || "Failed to fetch user metadata for fallback");
      }

      const currentMetadata = usuario.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        email_config: {
          ...payload,
          email_password_enc: payload.email_password_enc ? signToken(payload.email_password_enc) : null,
        }
      };

      // 3. Save inside JSONB metadata column
      const { error: metadataUpdateError } = await adminServiceSupabase
        .from("usuarios")
        .update({ metadata: updatedMetadata })
        .eq("auth_user_id", user.id);

      if (metadataUpdateError) {
        throw metadataUpdateError;
      }

      return { success: true, method: "metadata" };
    }
  } catch (err: any) {
    console.error("Error saving email configuration:", err);
    return { success: false, error: err.message || "Failed to save email configuration" };
  }
}

export async function getCurrentUserDriveConfig() {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "No authenticated user" };
    }

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select(`
        id, metadata,
        drive_access_token, drive_refresh_token, drive_token_expiry
      `)
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario) {
      console.error("Error al obtener config de Drive:", usuarioError);
      return { success: false, error: "User record not found" };
    }

    // Try dedicated columns first
    if (usuario.drive_access_token || usuario.drive_refresh_token) {
      return {
        success: true,
        data: {
          drive_access_token: usuario.drive_access_token,
          drive_refresh_token: usuario.drive_refresh_token,
          drive_token_expiry: usuario.drive_token_expiry,
          drive_folder: usuario.metadata?.drive_config?.drive_folder || null
        }
      };
    }

    // Fallback a metadata
    const meta = usuario.metadata || {};
    if (meta.drive_config) {
      return {
        success: true,
        data: meta.drive_config
      };
    }

    return { success: true, data: null };
  } catch (err: any) {
    console.error("Error loading Drive configuration:", err);
    return { success: false, error: err.message || "Failed to load Drive configuration" };
  }
}

export async function saveDriveConfiguration(payload: any) {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "No authenticated user" };
    }

    const adminServiceSupabase = createAdminServiceClient();

    // Try to save using dedicated database columns
    try {
      const { error: columnUpdateError } = await adminServiceSupabase
        .from("usuarios")
        .update({
          drive_access_token: payload.drive_access_token || null,
          drive_refresh_token: payload.drive_refresh_token || null,
          drive_token_expiry: payload.drive_token_expiry || null
        })
        .eq("auth_user_id", user.id);

      if (columnUpdateError) {
        throw columnUpdateError;
      }

      return { success: true, method: "columns" };
    } catch (columnErr: any) {
      console.warn("Dedicated columns update failed. Falling back to metadata:", columnErr.message);

      // Fallback to metadata
      const { data: usuario, error: fetchError } = await adminServiceSupabase
        .from("usuarios")
        .select("metadata")
        .eq("auth_user_id", user.id)
        .single();

      if (fetchError || !usuario) {
        throw new Error(fetchError?.message || "Failed to fetch user metadata");
      }

      const currentMetadata = usuario.metadata || {};
      const currentDriveConfig = currentMetadata.drive_config || {};
      const updatedMetadata = {
        ...currentMetadata,
        drive_config: {
          ...currentDriveConfig,
          ...payload
        }
      };

      const { error: metadataUpdateError } = await adminServiceSupabase
        .from("usuarios")
        .update({ metadata: updatedMetadata })
        .eq("auth_user_id", user.id);

      if (metadataUpdateError) {
        throw metadataUpdateError;
      }

      return { success: true, method: "metadata" };
    }
  } catch (err: any) {
    console.error("Error saving Drive configuration:", err);
    return { success: false, error: err.message || "Failed to save Drive configuration" };
  }
}

export async function saveDriveFolderSelection(folder: { id: string; name: string }) {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "No authenticated user" };
    }

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("metadata")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario) {
      return { success: false, error: "User record not found" };
    }

    const currentMetadata = usuario.metadata || {};
    const currentDriveConfig = currentMetadata.drive_config || {};
    const updatedMetadata = {
      ...currentMetadata,
      drive_config: {
        ...currentDriveConfig,
        drive_folder: {
          id: folder.id,
          name: folder.name
        }
      }
    };

    const { error: updateError } = await adminServiceSupabase
      .from("usuarios")
      .update({ metadata: updatedMetadata })
      .eq("auth_user_id", user.id);

    if (updateError) {
      return { success: false, error: updateError.message || "Failed to save folder selection" };
    }

    return { success: true, data: { drive_folder: updatedMetadata.drive_config.drive_folder } };
  } catch (err: any) {
    console.error("Error saving Drive folder selection:", err);
    return { success: false, error: err.message || "Failed to save Drive folder selection" };
  }
}

export async function clearDriveConfiguration() {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "No authenticated user" };
    }

    const adminServiceSupabase = createAdminServiceClient();

    // Clear dedicated columns
    try {
      await adminServiceSupabase
        .from("usuarios")
        .update({
          drive_access_token: null,
          drive_refresh_token: null,
          drive_token_expiry: null
        })
        .eq("auth_user_id", user.id);
    } catch {
      // Fallback to metadata
      const { data: usuario } = await adminServiceSupabase
        .from("usuarios")
        .select("metadata")
        .eq("auth_user_id", user.id)
        .single();

      if (usuario) {
        const currentMetadata = usuario.metadata || {};
        currentMetadata.drive_config = null;

        await adminServiceSupabase
          .from("usuarios")
          .update({ metadata: currentMetadata })
          .eq("auth_user_id", user.id);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error clearing Drive configuration:", err);
    return { success: false, error: err.message || "Failed to clear Drive configuration" };
  }
}

