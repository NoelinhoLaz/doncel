"use server";

import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { guardarPushSubscription, eliminarPushSubscription, enviarPushATodaLaAgencia } from "@/lib/pushNotifications";

// Devuelve el id de fila en `usuarios` (Admin DB) del usuario de la sesión
// actual — el mismo identificador que usa el cron para el Owner, no el
// auth_user_id de Supabase Auth.
async function getCurrentUsuarioId(): Promise<string | null> {
  const adminSupabase = await createAdminServerClient();
  const {
    data: { user },
  } = await adminSupabase.auth.getUser();
  if (!user) return null;

  const adminServiceClient = createAdminServiceClient();
  const { data: usuario } = await adminServiceClient
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  return usuario?.id || null;
}

export async function suscribirNotificacionesPush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const usuarioId = await getCurrentUsuarioId();
  if (!usuarioId) return { success: false, error: "No autenticado" };
  return guardarPushSubscription(usuarioId, subscription);
}

export async function desuscribirNotificacionesPush(endpoint: string) {
  return eliminarPushSubscription(endpoint);
}

export async function notificarComprobacionOfiviaje(payload: { title: string; body: string; url?: string }) {
  return enviarPushATodaLaAgencia(payload);
}
