"use server";

import nodemailer from "nodemailer";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentUserEmailConfig } from "./usuarios";
import { verifyToken } from "@/lib/encryption";

// Crea una encuesta, guarda los servicios seleccionados y manda el email al cliente
export async function crearYEnviarEncuesta({
  expedienteId,
  serviciosIds,
  emailDestinatario,
  nombreDestinatario,
  appBaseUrl,
}: {
  expedienteId: string;
  serviciosIds: string[];
  emailDestinatario: string;
  nombreDestinatario: string;
  appBaseUrl: string;
}) {
  const agencyDb = await getAgencyDbClient();

  const { data: encuesta, error: encuestaError } = await agencyDb
    .from("valoraciones_encuestas")
    .insert({
      expediente_id: expedienteId,
      servicios_ids: serviciosIds,
      enviado_a: emailDestinatario,
      enviado_at: new Date().toISOString(),
    })
    .select("id, token")
    .single();

  if (encuestaError || !encuesta) {
    return { success: false, error: "Error al crear la encuesta." };
  }

  const url = `${appBaseUrl}/portal/valoracion/${(encuesta as any).token}`;

  const configRes = await getCurrentUserEmailConfig();
  if (!configRes.success || !configRes.data?.email_address) {
    return { success: false, error: "No hay configuración de correo. Configura tu cuenta en Ajustes > Correo." };
  }

  const config = configRes.data;
  const smtpHost = config.email_smtp_host || (config.email_provider === "gmail" ? "smtp.gmail.com" : "smtp.office365.com");
  const smtpPort = config.email_smtp_port ? Number(config.email_smtp_port) : 465;
  const emailPassword = verifyToken(config.email_password_enc || "") || config.email_password_enc;

  if (!emailPassword) {
    return { success: false, error: "No se pudo obtener la contraseña de correo." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: config.email_address, pass: emailPassword },
      connectionTimeout: 15000,
      socketTimeout: 30000,
    });

    await transporter.sendMail({
      from: config.email_address,
      to: emailDestinatario,
      subject: "¿Cómo fue tu viaje? Cuéntanos tu experiencia",
      html: buildEmailHtml(nombreDestinatario, url),
    });

    return { success: true, token: (encuesta as any).token };
  } catch (err: any) {
    return { success: false, error: `Error al enviar el email: ${err.message}` };
  }
}

// Lee la encuesta por token (página pública)
export async function getEncuestaByToken(token: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: encuesta, error } = await agencyDb
    .from("valoraciones_encuestas")
    .select("id, expediente_id, servicios_ids, completado_at")
    .eq("token", token)
    .single();

  if (error || !encuesta) return null;

  const enc = encuesta as any;
  if (!enc.servicios_ids?.length) return { ...enc, servicios: [] };

  const { data: lineas } = await agencyDb
    .from("operativa_cotizacion_lineas")
    .select("id, descripcion, tipo, config_tipos_servicios(etiqueta, icono), detalles")
    .in("id", enc.servicios_ids);

  const { data: valoraciones } = await agencyDb
    .from("valoraciones_servicios")
    .select("linea_id, rating, comentario")
    .eq("encuesta_id", enc.id);

  const valoracionesByLinea: Record<string, any> = {};
  for (const v of (valoraciones ?? []) as any[]) {
    valoracionesByLinea[v.linea_id] = v;
  }

  const servicios = (lineas ?? []).map((l: any) => ({
    ...l,
    valoracion: valoracionesByLinea[l.id] ?? null,
  }));

  return { ...enc, servicios };
}

// Guarda las valoraciones del cliente (página pública)
export async function guardarValoraciones(
  token: string,
  valoraciones: Array<{ linea_id: string; rating: number; comentario?: string }>
) {
  const agencyDb = await getAgencyDbClient();

  const { data: encuesta, error: encErr } = await agencyDb
    .from("valoraciones_encuestas")
    .select("id, completado_at")
    .eq("token", token)
    .single();

  if (encErr || !encuesta) return { success: false, error: "Encuesta no encontrada." };
  if ((encuesta as any).completado_at) return { success: false, error: "Esta encuesta ya fue completada." };

  const inserts = valoraciones.map((v) => ({
    encuesta_id: (encuesta as any).id,
    linea_id: v.linea_id,
    rating: v.rating,
    comentario: v.comentario || null,
  }));

  const { error: insertErr } = await agencyDb.from("valoraciones_servicios").insert(inserts);
  if (insertErr) return { success: false, error: "Error al guardar las valoraciones." };

  await agencyDb
    .from("valoraciones_encuestas")
    .update({ completado_at: new Date().toISOString() })
    .eq("id", (encuesta as any).id);

  return { success: true };
}

// Rating promedio de una línea de servicio (para mostrar en el modal)
export async function getRatingLinea(lineaId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data } = await agencyDb
    .from("valoraciones_servicios")
    .select("rating, comentario, created_at")
    .eq("linea_id", lineaId);

  if (!data?.length) return null;
  const ratings = (data as any[]).map((v) => v.rating);
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { avg: Math.round(avg * 10) / 10, count: ratings.length, valoraciones: data };
}

// Resumen de satisfacción para un expediente
export async function getResumenSatisfaccion(expedienteId: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: encuestas } = await agencyDb
    .from("valoraciones_encuestas")
    .select("id, completado_at, enviado_at, enviado_a")
    .eq("expediente_id", expedienteId);

  if (!encuestas?.length) return null;

  const encuestaIds = (encuestas as any[]).map((e) => e.id);
  const { data: valoraciones } = await agencyDb
    .from("valoraciones_servicios")
    .select("rating, linea_id")
    .in("encuesta_id", encuestaIds);

  const vals = (valoraciones ?? []) as any[];
  if (!vals.length) {
    return {
      encuestas: encuestas as any[],
      totalValoraciones: 0,
      promedioGlobal: null,
    };
  }

  const promedioGlobal = Math.round((vals.reduce((a, v) => a + v.rating, 0) / vals.length) * 10) / 10;

  return {
    encuestas: encuestas as any[],
    totalValoraciones: vals.length,
    promedioGlobal,
  };
}

function buildEmailHtml(nombre: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    <div style="background:var(--primary-color,#475569);padding:32px 40px">
      <h1 style="margin:0;color:#fff;font-size:1.4rem;font-weight:700">¿Cómo fue tu viaje?</h1>
    </div>
    <div style="padding:32px 40px">
      <p style="margin:0 0 16px;color:#334155;font-size:0.95rem">Hola <strong>${nombre}</strong>,</p>
      <p style="margin:0 0 24px;color:#475569;font-size:0.9rem;line-height:1.6">
        Nos encantaría saber tu opinión sobre los servicios de tu viaje. Tu valoración nos ayuda a mejorar y a ofrecerte cada vez mejores experiencias.
      </p>
      <a href="${url}" style="display:inline-block;background:#475569;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:0.9rem;font-weight:600">
        Valorar mi viaje
      </a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:0.78rem">
        Si el botón no funciona, copia este enlace en tu navegador:<br>
        <a href="${url}" style="color:#475569">${url}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
