"use server";

import nodemailer from "nodemailer";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { getCurrentUsuario, getCurrentUserEmailConfig } from "./usuarios";
import { verifyToken } from "@/lib/encryption";

async function getAgenciaId(): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) return "";
  const svc = createAdminServiceClient();
  const { data } = await svc.from("usuarios").select("agencia_id").eq("auth_user_id", user.id).single();
  return data?.agencia_id ?? "";
}

export type TipoPregunta = "rating" | "texto_libre" | "opcion_unica" | "opcion_multiple" | "si_no" | "nps";

export interface PreguntaInput {
  texto: string;
  tipo: TipoPregunta;
  opciones?: string[];
  obligatoria?: boolean;
}

// Lista las plantillas de encuesta de la agencia
export async function getPlantillas() {
  const agencyDb = await getAgencyDbClient();

  const { data: plantillas, error } = await agencyDb
    .from("encuestas_plantillas")
    .select("id, nombre, descripcion, activa, created_at")
    .order("created_at", { ascending: false });

  if (error || !plantillas) return [];

  const ids = (plantillas as any[]).map((p) => p.id);
  if (ids.length === 0) return plantillas as any[];

  const { data: preguntas } = await agencyDb
    .from("encuestas_preguntas")
    .select("id, plantilla_id")
    .in("plantilla_id", ids);

  const { data: envios } = await agencyDb
    .from("encuestas_envios")
    .select("id, plantilla_id")
    .in("plantilla_id", ids);

  const countBy = (rows: any[] | null, key: string) => {
    const map: Record<string, number> = {};
    for (const r of rows ?? []) map[r[key]] = (map[r[key]] ?? 0) + 1;
    return map;
  };

  const preguntasCount = countBy(preguntas, "plantilla_id");
  const enviosCount = countBy(envios, "plantilla_id");

  return (plantillas as any[]).map((p) => ({
    ...p,
    numPreguntas: preguntasCount[p.id] ?? 0,
    numEnvios: enviosCount[p.id] ?? 0,
  }));
}

// Plantilla + preguntas ordenadas
export async function getPlantilla(id: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: plantilla, error } = await agencyDb
    .from("encuestas_plantillas")
    .select("id, nombre, descripcion, activa, created_at")
    .eq("id", id)
    .single();

  if (error || !plantilla) return null;

  const { data: preguntas } = await agencyDb
    .from("encuestas_preguntas")
    .select("id, orden, texto, tipo, opciones, obligatoria")
    .eq("plantilla_id", id)
    .order("orden", { ascending: true });

  return { ...(plantilla as any), preguntas: preguntas ?? [] };
}

// Crea una plantilla con sus preguntas
export async function crearPlantilla({
  nombre,
  descripcion,
  preguntas,
}: {
  nombre: string;
  descripcion?: string;
  preguntas: PreguntaInput[];
}) {
  if (!nombre.trim()) return { success: false, error: "El nombre es obligatorio." };
  if (!preguntas.length) return { success: false, error: "Añade al menos una pregunta." };

  const agencyDb = await getAgencyDbClient();
  const usuario = await getCurrentUsuario();

  const { data: plantilla, error: plantillaError } = await agencyDb
    .from("encuestas_plantillas")
    .insert({
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      creado_por: usuario?.id ?? null,
    })
    .select("id")
    .single();

  if (plantillaError || !plantilla) {
    return { success: false, error: "Error al crear la plantilla." };
  }

  const plantillaId = (plantilla as any).id;

  const { error: preguntasError } = await agencyDb.from("encuestas_preguntas").insert(
    preguntas.map((p, i) => ({
      plantilla_id: plantillaId,
      orden: i,
      texto: p.texto.trim(),
      tipo: p.tipo,
      opciones: p.opciones && p.opciones.length ? p.opciones : null,
      obligatoria: !!p.obligatoria,
    }))
  );

  if (preguntasError) {
    await agencyDb.from("encuestas_plantillas").delete().eq("id", plantillaId);
    return { success: false, error: "Error al guardar las preguntas." };
  }

  return { success: true, id: plantillaId };
}

// Actualiza nombre/descripción y, si la plantilla no tiene envíos, sus preguntas
export async function actualizarPlantilla(
  id: string,
  { nombre, descripcion, preguntas }: { nombre: string; descripcion?: string; preguntas?: PreguntaInput[] }
) {
  const agencyDb = await getAgencyDbClient();

  const { count } = await agencyDb
    .from("encuestas_envios")
    .select("id", { count: "exact", head: true })
    .eq("plantilla_id", id);

  if (preguntas && (count ?? 0) > 0) {
    return { success: false, error: "Esta plantilla ya tiene envíos y sus preguntas no se pueden modificar. Desactívala y crea una nueva." };
  }

  const { error: updateError } = await agencyDb
    .from("encuestas_plantillas")
    .update({ nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
    .eq("id", id);

  if (updateError) return { success: false, error: "Error al actualizar la plantilla." };

  if (preguntas) {
    await agencyDb.from("encuestas_preguntas").delete().eq("plantilla_id", id);
    const { error: preguntasError } = await agencyDb.from("encuestas_preguntas").insert(
      preguntas.map((p, i) => ({
        plantilla_id: id,
        orden: i,
        texto: p.texto.trim(),
        tipo: p.tipo,
        opciones: p.opciones && p.opciones.length ? p.opciones : null,
        obligatoria: !!p.obligatoria,
      }))
    );
    if (preguntasError) return { success: false, error: "Error al guardar las preguntas." };
  }

  return { success: true };
}

// Activa/desactiva una plantilla
export async function toggleActivaPlantilla(id: string, activa: boolean) {
  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb.from("encuestas_plantillas").update({ activa }).eq("id", id);
  if (error) return { success: false, error: "Error al actualizar la plantilla." };
  return { success: true };
}

// Elimina una plantilla sin envíos
export async function eliminarPlantilla(id: string) {
  const agencyDb = await getAgencyDbClient();

  const { count } = await agencyDb
    .from("encuestas_envios")
    .select("id", { count: "exact", head: true })
    .eq("plantilla_id", id);

  if ((count ?? 0) > 0) {
    return { success: false, error: "No se puede eliminar: esta plantilla ya tiene envíos." };
  }

  const { error } = await agencyDb.from("encuestas_plantillas").delete().eq("id", id);
  if (error) return { success: false, error: "Error al eliminar la plantilla." };
  return { success: true };
}

// Crea un envío y manda el email con el enlace de la encuesta
export async function enviarEncuesta({
  plantillaId,
  entidadId,
  expedienteId,
  emailDestino,
  appBaseUrl,
}: {
  plantillaId: string;
  entidadId?: string;
  expedienteId?: string;
  emailDestino: string;
  appBaseUrl: string;
}) {
  const agencyDb = await getAgencyDbClient();
  const usuario = await getCurrentUsuario();

  const { data: envio, error: envioError } = await agencyDb
    .from("encuestas_envios")
    .insert({
      plantilla_id: plantillaId,
      entidad_id: entidadId || null,
      expediente_id: expedienteId || null,
      email_destino: emailDestino,
      enviado_por: usuario?.id ?? null,
      enviado_at: new Date().toISOString(),
    })
    .select("id, token")
    .single();

  if (envioError || !envio) {
    return { success: false, error: "Error al crear el envío." };
  }

  const url = `${appBaseUrl}/portal/encuesta/${(envio as any).token}`;

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
      to: emailDestino,
      subject: "Nos encantaría conocer tu opinión",
      html: buildEmailHtml(url),
    });

    return { success: true, token: (envio as any).token };
  } catch (err: any) {
    return { success: false, error: `Error al enviar el email: ${err.message}` };
  }
}

// Lee la plantilla + preguntas para previsualización (sin envío real, uso interno del agente)
export async function getPlantillaPreview(plantillaId: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: plantilla } = await agencyDb
    .from("encuestas_plantillas")
    .select("nombre, descripcion")
    .eq("id", plantillaId)
    .single();

  if (!plantilla) return null;

  const { data: preguntas } = await agencyDb
    .from("encuestas_preguntas")
    .select("id, orden, texto, tipo, opciones, obligatoria")
    .eq("plantilla_id", plantillaId)
    .order("orden", { ascending: true });

  return {
    nombre: (plantilla as any).nombre,
    descripcion: (plantilla as any).descripcion,
    preguntas: preguntas ?? [],
  };
}

// Lee el envío + plantilla + preguntas por token (página pública)
export async function getEncuestaByToken(token: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: envio, error } = await agencyDb
    .from("encuestas_envios")
    .select("id, plantilla_id, completado_at")
    .eq("token", token)
    .single();

  if (error || !envio) return null;

  const env = envio as any;

  const { data: plantilla } = await agencyDb
    .from("encuestas_plantillas")
    .select("nombre, descripcion")
    .eq("id", env.plantilla_id)
    .single();

  const { data: preguntas } = await agencyDb
    .from("encuestas_preguntas")
    .select("id, orden, texto, tipo, opciones, obligatoria")
    .eq("plantilla_id", env.plantilla_id)
    .order("orden", { ascending: true });

  return {
    id: env.id,
    completado_at: env.completado_at,
    nombre: plantilla?.nombre ?? "Encuesta",
    descripcion: plantilla?.descripcion ?? null,
    preguntas: preguntas ?? [],
  };
}

// Guarda las respuestas del cliente (página pública)
export async function guardarRespuestas(
  token: string,
  respuestas: Array<{ pregunta_id: string; tipo: TipoPregunta; valor: string | number | string[] }>
) {
  const agencyDb = await getAgencyDbClient();

  const { data: envio, error: envioErr } = await agencyDb
    .from("encuestas_envios")
    .select("id, completado_at")
    .eq("token", token)
    .single();

  if (envioErr || !envio) return { success: false, error: "Encuesta no encontrada." };
  if ((envio as any).completado_at) return { success: false, error: "Esta encuesta ya fue completada." };

  const inserts = respuestas.map((r) => {
    const base = { envio_id: (envio as any).id, pregunta_id: r.pregunta_id };
    if (r.tipo === "rating" || r.tipo === "nps") {
      return { ...base, valor_numero: Number(r.valor) };
    }
    if (r.tipo === "opcion_unica" || r.tipo === "opcion_multiple") {
      return { ...base, valor_opciones: Array.isArray(r.valor) ? r.valor : [r.valor] };
    }
    return { ...base, valor_texto: String(r.valor) };
  });

  const { error: insertErr } = await agencyDb.from("encuestas_respuestas").insert(inserts);
  if (insertErr) return { success: false, error: "Error al guardar las respuestas." };

  const normalizados = respuestas
    .filter((r) => r.tipo === "rating" || r.tipo === "nps")
    .map((r) => (r.tipo === "rating" ? (Number(r.valor) - 1) / 5 : Number(r.valor) / 10));
  const valoracionPromedio = normalizados.length
    ? Math.round((normalizados.reduce((a, b) => a + b, 0) / normalizados.length) * 100) / 100
    : null;

  await agencyDb
    .from("encuestas_envios")
    .update({ completado_at: new Date().toISOString(), valoracion_promedio: valoracionPromedio })
    .eq("id", (envio as any).id);

  return { success: true };
}

// Constancia: listado de envíos de una plantilla (quién ha respondido)
// Elimina un envío (y en cascada sus respuestas)
export async function eliminarEnvio(envioId: string) {
  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb.from("encuestas_envios").delete().eq("id", envioId);
  if (error) return { success: false, error: "Error al eliminar el envío." };
  return { success: true };
}

export async function getEnviosDePlantilla(plantillaId: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: envios, error } = await agencyDb
    .from("encuestas_envios")
    .select("id, entidad_id, expediente_id, email_destino, enviado_at, completado_at, valoracion_promedio, valoracion_resumen")
    .eq("plantilla_id", plantillaId)
    .order("enviado_at", { ascending: false });

  if (error) console.error("Error en getEnviosDePlantilla:", error);
  if (error || !envios?.length) return [];

  const entidadIds = [...new Set((envios as any[]).map((e) => e.entidad_id).filter(Boolean))];
  const nombreById: Record<string, string> = {};
  if (entidadIds.length > 0) {
    const { data: entidades } = await agencyDb
      .from("contabilidad_entidades")
      .select("id, nombre")
      .in("id", entidadIds);
    for (const e of (entidades ?? []) as any[]) nombreById[e.id] = e.nombre;
  }

  return (envios as any[]).map((e) => ({ ...e, entidad_nombre: e.entidad_id ? (nombreById[e.entidad_id] ?? "—") : e.email_destino }));
}

// Constancia: listado de envíos de encuesta hechos desde un expediente concreto
export async function getEnviosDeExpediente(expedienteId: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: envios, error } = await agencyDb
    .from("encuestas_envios")
    .select("id, plantilla_id, entidad_id, email_destino, enviado_at, completado_at, valoracion_promedio, valoracion_resumen")
    .eq("expediente_id", expedienteId)
    .order("enviado_at", { ascending: false });

  if (error) console.error("Error en getEnviosDeExpediente:", error);
  if (error || !envios?.length) return [];

  const plantillaIds = [...new Set((envios as any[]).map((e) => e.plantilla_id))];
  const { data: plantillas } = await agencyDb
    .from("encuestas_plantillas")
    .select("id, nombre")
    .in("id", plantillaIds);

  const nombreById: Record<string, string> = {};
  for (const p of (plantillas ?? []) as any[]) nombreById[p.id] = p.nombre;

  return (envios as any[]).map((e) => ({ ...e, plantilla_nombre: nombreById[e.plantilla_id] ?? "—" }));
}

// Detalle de respuestas de un envío concreto
export async function getRespuestasDeEnvio(envioId: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: envio } = await agencyDb
    .from("encuestas_envios")
    .select("id, plantilla_id, entidad_id, email_destino, enviado_at, completado_at, valoracion_promedio, valoracion_resumen")
    .eq("id", envioId)
    .single();

  if (!envio) return null;

  const { data: preguntas } = await agencyDb
    .from("encuestas_preguntas")
    .select("id, orden, texto, tipo")
    .eq("plantilla_id", (envio as any).plantilla_id)
    .order("orden", { ascending: true });

  const { data: respuestas } = await agencyDb
    .from("encuestas_respuestas")
    .select("pregunta_id, valor_texto, valor_numero, valor_opciones")
    .eq("envio_id", envioId);

  const respuestaByPregunta: Record<string, any> = {};
  for (const r of (respuestas ?? []) as any[]) respuestaByPregunta[r.pregunta_id] = r;

  const items = (preguntas ?? []).map((p: any) => ({
    ...p,
    respuesta: respuestaByPregunta[p.id] ?? null,
  }));

  return { envio, items };
}

// Genera (bajo demanda) un resumen corto con IA de las respuestas de un envío, y lo guarda
export async function generarResumenValoracion(envioId: string) {
  const agencyDb = await getAgencyDbClient();

  const { data: envio } = await agencyDb
    .from("encuestas_envios")
    .select("id, completado_at, valoracion_promedio")
    .eq("id", envioId)
    .single();

  if (!envio || !(envio as any).completado_at) {
    return { success: false, error: "Este envío todavía no ha sido respondido." };
  }

  const detalle = await getRespuestasDeEnvio(envioId);
  if (!detalle) return { success: false, error: "Envío no encontrado." };

  const lineas = detalle.items
    .map((it: any) => {
      let valor = "(sin responder)";
      if (it.respuesta) {
        if (it.tipo === "rating" || it.tipo === "nps") valor = String(it.respuesta.valor_numero);
        else if (it.tipo === "opcion_unica" || it.tipo === "opcion_multiple") valor = (it.respuesta.valor_opciones || []).join(", ");
        else valor = it.respuesta.valor_texto || "(sin responder)";
      }
      return `- ${it.texto}: ${valor}`;
    })
    .join("\n");

  const agenciaId = await getAgenciaId();
  if (!agenciaId) return { success: false, error: "No se pudo identificar la agencia." };

  try {
    const anthropic = await getAnthropicClient(agenciaId);
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "Eres un asistente de una agencia de viajes. Resume en una sola frase, en español, la valoración de un cliente a partir de sus respuestas a una encuesta de satisfacción. Sé conciso y concreto, sin repetir literalmente las preguntas.",
      messages: [{ role: "user", content: `Respuestas del cliente:\n${lineas}` }],
    });

    const resumen = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (!resumen) return { success: false, error: "No se pudo generar el resumen." };

    await agencyDb
      .from("encuestas_envios")
      .update({ valoracion_resumen: resumen, valoracion_resumen_at: new Date().toISOString() })
      .eq("id", envioId);

    return { success: true, resumen };
  } catch (err: any) {
    return { success: false, error: `Error al generar el resumen: ${err.message}` };
  }
}

function buildEmailHtml(url: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    <div style="background:var(--primary-color,#475569);padding:32px 40px">
      <h1 style="margin:0;color:#fff;font-size:1.4rem;font-weight:700">Tu opinión nos importa</h1>
    </div>
    <div style="padding:32px 40px">
      <p style="margin:0 0 24px;color:#475569;font-size:0.9rem;line-height:1.6">
        Tenemos una breve encuesta para ti. Solo te llevará un minuto y nos ayuda a mejorar.
      </p>
      <a href="${url}" style="display:inline-block;background:#475569;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:0.9rem;font-weight:600">
        Responder encuesta
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
