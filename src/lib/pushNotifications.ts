import webpush from "web-push";
import { getAgencyDbClient } from "@/lib/agencyDb";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:hola@kanso.consulting",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export async function guardarPushSubscription(
  usuarioId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<{ success: boolean; error?: string }> {
  const agencyDb = await getAgencyDbClient();

  const { error } = await agencyDb.from("config_push_subscriptions").upsert(
    {
      usuario_id: usuarioId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function eliminarPushSubscription(endpoint: string): Promise<{ success: boolean }> {
  const agencyDb = await getAgencyDbClient();
  await agencyDb.from("config_push_subscriptions").delete().eq("endpoint", endpoint);
  return { success: true };
}

/**
 * Envía una notificación push a un usuario concreto (todos sus dispositivos
 * suscritos). Server-to-server: recibe el agencyDb ya resuelto (cron) o lo
 * resuelve por sesión si se omite.
 */
export async function enviarPushAUsuario(
  agencyDbParam: any,
  usuarioId: string,
  payload: { title: string; body: string; url?: string }
): Promise<{ enviados: number }> {
  const agencyDb = agencyDbParam || (await getAgencyDbClient());

  const { data: subs } = await agencyDb
    .from("config_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("usuario_id", usuarioId);

  if (!subs || subs.length === 0) return { enviados: 0 };

  let enviados = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      enviados++;
    } catch (err: any) {
      // Suscripción caducada/inválida (410 Gone o 404): se elimina para no reintentar.
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await agencyDb.from("config_push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("Error enviando push:", err?.message || err);
      }
    }
  }

  return { enviados };
}

/**
 * Envía una notificación push a todas las suscripciones registradas en la
 * agencia (todos los usuarios/dispositivos que la hayan activado), usado
 * tras una comprobación manual de OFIviaje desde la UI.
 */
export async function enviarPushATodaLaAgencia(payload: { title: string; body: string; url?: string }): Promise<{ enviados: number }> {
  const agencyDb = await getAgencyDbClient();

  const { data: subs } = await agencyDb.from("config_push_subscriptions").select("id, endpoint, p256dh, auth");
  if (!subs || subs.length === 0) return { enviados: 0 };

  let enviados = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      enviados++;
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await agencyDb.from("config_push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("Error enviando push:", err?.message || err);
      }
    }
  }

  return { enviados };
}
