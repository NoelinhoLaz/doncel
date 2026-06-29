"use server";

import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";
const ALGORITHM = "aes-256-cbc";

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.warn("ADVERTENCIA: ENCRYPTION_KEY debe ser un string hexadecimal de 64 caracteres para AES-256.");
}

function encrypt(text: string) {
  if (!ENCRYPTION_KEY) throw new Error("Missing ENCRYPTION_KEY in environment");
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return {
    iv: iv.toString("hex"),
    encryptedData: encrypted,
  };
}

function decrypt(encryptedData: string, ivHex: string) {
  if (!ENCRYPTION_KEY) throw new Error("Missing ENCRYPTION_KEY in environment");
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function guardarApiKey(nombre: string, apiKey: string) {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "No autenticado." };
    }

    const adminServiceSupabase = createAdminServiceClient();
    
    // Obtener la agencia del usuario
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.agencia_id) {
      return { success: false, error: "Usuario o agencia no encontrados." };
    }

    const agenciaId = usuario.agencia_id;

    // Encriptar la clave
    const { iv, encryptedData } = encrypt(apiKey);

    // Guardar en agencias_api_keys
    const { data, error } = await adminServiceSupabase
      .from("agencias_api_keys")
      .insert({
        agencia_id: agenciaId,
        nombre,
        key_encrypted: encryptedData,
        iv,
        estado: "Activa"
      })
      .select()
      .single();

    if (error) {
      console.error("Error al guardar API key:", error);
      return { success: false, error: "Error al guardar en la base de datos." };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Excepción en guardarApiKey:", error);
    return { success: false, error: error.message };
  }
}

export async function obtenerApiKeys() {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "No autenticado." };
    }

    const adminServiceSupabase = createAdminServiceClient();
    
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.agencia_id) {
      return { success: false, error: "Agencia no encontrada." };
    }

    const agenciaId = usuario.agencia_id;

    const { data, error } = await adminServiceSupabase
      .from("agencias_api_keys")
      .select("*")
      .eq("agencia_id", agenciaId)
      .order("creado", { ascending: false });

    if (error) {
      console.error("Error al obtener API keys:", error);
      return { success: false, error: "Error al obtener claves." };
    }

    // Mapear los datos para devolver una vista segura
    const keysSeguras = data.map((item) => {
      // Intentar mostrar los últimos 4 caracteres, o usar un fallback
      let showLast4 = "...";
      try {
        const decrypted = decrypt(item.key_encrypted, item.iv);
        if (decrypted.length > 4) {
          showLast4 = `...${decrypted.slice(-4)}`;
        } else {
          showLast4 = "...";
        }
      } catch (e) {
        showLast4 = "...[Error desc]";
      }

      return {
        id: item.id,
        nombre: item.nombre,
        key: `${item.nombre.toLowerCase().replace(/\s+/g, '_')}_${showLast4}`,
        creado: new Date(item.creado).toLocaleDateString(),
        estado: item.estado
      };
    });

    return { success: true, data: keysSeguras };
  } catch (error: any) {
    console.error("Excepción en obtenerApiKeys:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene y desencripta la API key de un proveedor guardada en la BD Admin.
 * Uso exclusivo en código server-side (Server Actions / Route Handlers).
 * @param nombre - El nombre exacto con el que se guardó la key (ej. "Anthropic Claude")
 * @param agenciaId - UUID de la agencia a la que pertenece la key
 */
export async function obtenerApiKeyDesencriptada(
  nombre: string,
  agenciaId: string
): Promise<string> {
  const adminServiceSupabase = createAdminServiceClient();

  const { data, error } = await adminServiceSupabase
    .from("agencias_api_keys")
    .select("key_encrypted, iv")
    .eq("agencia_id", agenciaId)
    .eq("nombre", nombre)
    .eq("estado", "Activa")
    .order("creado", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`API Key "${nombre}" no encontrada para la agencia.`);
  }

  return decrypt(data.key_encrypted, data.iv);
}

