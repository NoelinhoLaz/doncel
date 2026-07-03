"use server";

import nodemailer from "nodemailer";
import { createAdminServerClient } from "@/lib/supabaseServer";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentUserEmailConfig } from "./usuarios";
import { verifyToken } from "@/lib/encryption";

interface Destinatario {
  viajero_id: string;  // "p-<entidad_id>" o "v-<id>"
  nombre: string;
  email: string;
  telefono?: string;
  rol?: "pagador" | "viajero";
}

interface AdjuntoInfo {
  nombre: string;
  tamanio: number;
  contenido: string; // base64
  tipo: string;
}

interface SendEmailParams {
  expedienteId: string;
  asunto: string;
  cuerpo: string;
  destinatarios: Destinatario[];
  adjuntos?: AdjuntoInfo[];
  appBaseUrl: string; // para construir la URL del pixel de tracking
}

export async function sendExpedienteEmail(params: SendEmailParams) {
  const { expedienteId, asunto, cuerpo, destinatarios, adjuntos = [], appBaseUrl } = params;

  const adminSupabase = await createAdminServerClient();
  const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
  if (userError || !user) return { success: false, error: "Usuario no autenticado." };

  const configRes = await getCurrentUserEmailConfig();
  if (!configRes.success || !configRes.data?.email_address) {
    return { success: false, error: "No hay configuración de correo activa. Configura tu cuenta en Ajustes > Correo." };
  }

  const config = configRes.data;
  const isGmail = config.email_provider === "gmail" || config.email_address?.endsWith("@gmail.com") || config.email_address?.endsWith("@googlemail.com");
  const smtpHost = config.email_smtp_host || (isGmail ? "smtp.gmail.com" : "smtp.office365.com");
  const smtpPort = config.email_smtp_port ? Number(config.email_smtp_port) : (isGmail ? 587 : 587);
  const secure = smtpPort === 465;

  const decryptedPassword = verifyToken(config.email_password_enc || "");
  console.log(`[SMTP debug] host=${smtpHost} port=${smtpPort} secure=${secure} user=${config.email_address} decrypt_ok=${decryptedPassword !== null} enc_len=${(config.email_password_enc || "").length}`);
  const emailPassword = decryptedPassword;
  if (!emailPassword) {
    return { success: false, error: "No se pudo descifrar la contraseña de correo. Vuelve a guardar tu configuración en Ajustes → Correo." };
  }

  const destinatariosValidos = destinatarios.filter((d) => d.email && d.email.includes("@"));
  if (destinatariosValidos.length === 0) {
    return { success: false, error: "Ningún destinatario tiene email válido." };
  }

  let transporter: nodemailer.Transporter;
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        type: "LOGIN",
        user: config.email_address,
        pass: emailPassword,
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      socketTimeout: 30000,
    });
  } catch (err: any) {
    return { success: false, error: `Error al crear el transporter SMTP: ${err.message}` };
  }

  try {
    await transporter.verify();
    console.log("[SMTP debug] verify OK");
  } catch (err: any) {
    console.error("[SMTP debug] verify FAILED:", err.message);
    return { success: false, error: `Error de conexión SMTP: ${err.message}` };
  }

  const attachments = adjuntos.map((a) => ({
    filename: a.nombre,
    content: Buffer.from(a.contenido, "base64"),
    contentType: a.tipo,
  }));

  // Crear registro principal de la comunicación primero (necesitamos el ID para las FK)
  const agencyDb = await getAgencyDbClient();
  const { data: comunicacionData, error: comunicacionError } = await agencyDb
    .from("comunicaciones_expediente")
    .insert({
      expediente_id: expedienteId,
      agente_id: user.id,
      canal: "email",
      asunto,
      cuerpo,
      destinatarios: destinatariosValidos.map((d) => ({
        viajero_id: d.viajero_id,
        nombre: d.nombre,
        email: d.email,
        rol: d.rol ?? (d.viajero_id?.startsWith("p-") ? "pagador" : "viajero"),
      })),
      adjuntos: adjuntos.map((a) => ({ nombre: a.nombre, tamanio: a.tamanio })),
      estado: "enviado",
    })
    .select("id")
    .single();

  if (comunicacionError || !comunicacionData) {
    console.error("[comunicaciones] Error al crear registro en BD:", comunicacionError);
    return { success: false, error: "Error al guardar la comunicación en base de datos." };
  }

  const comunicacionId = (comunicacionData as any).id as string;

  // Insertar un registro por destinatario con token único para tracking
  const destinatariosInsert = destinatariosValidos.map((d) => ({
    comunicacion_id: comunicacionId,
    contacto_key: d.viajero_id,
    rol: d.rol ?? (d.viajero_id?.startsWith("p-") ? "pagador" : "viajero"),
    nombre: d.nombre,
    email: d.email,
    telefono: d.telefono ?? null,
    estado: "enviado",
  }));

  const { data: destinatariosData, error: destError } = await agencyDb
    .from("comunicaciones_destinatarios")
    .insert(destinatariosInsert)
    .select("id, email, token");

  if (destError || !destinatariosData) {
    console.error("[comunicaciones] Error al insertar destinatarios:", destError);
    // No bloqueamos — el envío puede continuar aunque el tracking falle
  }

  // Enviar a cada destinatario con su pixel de tracking único
  const resultados: Array<{ email: string; ok: boolean; error?: string; destinatarioId?: string }> = [];

  for (const dest of destinatariosValidos) {
    // Encontrar el registro del destinatario para su token
    const destRecord = (destinatariosData as any[])?.find((r: any) => r.email === dest.email);
    const trackingPixel = destRecord
      ? `<img src="${appBaseUrl}/api/track/${destRecord.token}" width="1" height="1" style="display:none" alt="" />`
      : "";

    const htmlCuerpo = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#334155;">${cuerpo.replace(/\n/g, "<br/>")}</div>${trackingPixel}`;

    try {
      await transporter.sendMail({
        from: `"${config.email_address}" <${config.email_address}>`,
        to: dest.email,
        bcc: config.email_address,
        subject: asunto,
        text: cuerpo,
        html: htmlCuerpo,
        attachments,
      });
      resultados.push({ email: dest.email, ok: true, destinatarioId: destRecord?.id });
    } catch (err: any) {
      const raw: string = err.message ?? "";
      let mensajeError = raw;
      if (raw.includes("535") || raw.toLowerCase().includes("authentication failed") || raw.toLowerCase().includes("username and password not accepted")) {
        mensajeError = isGmail
          ? "GMAIL_AUTH_FAILED"
          : "AUTH_FAILED:" + raw;
      }
      resultados.push({ email: dest.email, ok: false, error: mensajeError, destinatarioId: destRecord?.id });
    }
  }

  const enviados = resultados.filter((r) => r.ok);
  const errores = resultados.filter((r) => !r.ok);

  const estado =
    enviados.length === 0 ? "error"
    : errores.length > 0 ? "parcial"
    : "enviado";

  const errorDetalle = errores.length > 0
    ? errores.map((e) => `${e.email}: ${e.error}`).join("; ")
    : null;

  // Actualizar estado del registro principal y de los destinatarios con error
  await agencyDb
    .from("comunicaciones_expediente")
    .update({ estado, error_detalle: errorDetalle })
    .eq("id", comunicacionId);

  // Marcar como error los destinatarios que fallaron
  const errorIds = errores.map((e) => e.destinatarioId).filter(Boolean);
  if (errorIds.length > 0) {
    await agencyDb
      .from("comunicaciones_destinatarios")
      .update({ estado: "error", error_detalle: errores.find((e) => e.destinatarioId === errorIds[0])?.error ?? null })
      .in("id", errorIds);
  }

  if (estado === "error") {
    return { success: false, error: errorDetalle || "Error desconocido al enviar." };
  }

  return {
    success: true,
    enviados: enviados.length,
    errores: errores.length,
    estado,
  };
}

export async function getComunicacionesByExpediente(expedienteId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("comunicaciones_expediente")
    .select("*, comunicaciones_destinatarios(id, contacto_key, rol, nombre, email, estado, abierto_at, entregado_at, error_detalle)")
    .eq("expediente_id", expedienteId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

export async function markEmailAbierto(token: string) {
  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb
    .from("comunicaciones_destinatarios")
    .update({ estado: "abierto", abierto_at: new Date().toISOString() })
    .eq("token", token)
    .is("abierto_at", null); // solo la primera vez
  return { success: !error };
}

export async function assignEmailToExpediente(expedienteId: string, emailData: {
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
  attachments?: Array<{ nombre: string; tamanio: number }>;
}) {
  const adminSupabase = await createAdminServerClient();
  const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
  if (userError || !user) return { success: false, error: "Usuario no autenticado." };

  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("comunicaciones_expediente")
    .insert({
      expediente_id: expedienteId,
      agente_id: user.id,
      canal: "email",
      asunto: emailData.subject,
      cuerpo: emailData.body,
      destinatarios: [{
        nombre: emailData.senderName,
        email: emailData.senderEmail,
        rol: "remitente"
      }],
      adjuntos: emailData.attachments || [],
      estado: "enviado",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[comunicaciones] Error al asignar email a expediente:", error);
    return { success: false, error: "Error al guardar el email en la base de datos." };
  }
  return { success: true, id: data.id };
}

export async function getComunicacionesByEntity(params: {
  expedienteId?: string | null;
  cotizacionId?: string | null;
  propuestaId?: string | null;
  presupuestoId?: string | null;
}) {
  const agencyDb = await getAgencyDbClient();

  // Collect all IDs that could link to communications
  const conditions: string[] = [];
  if (params.expedienteId) conditions.push(`expediente_id.eq.${params.expedienteId}`);
  if (params.cotizacionId) conditions.push(`cotizacion_id.eq.${params.cotizacionId}`);
  if (params.propuestaId) conditions.push(`propuesta_id.eq.${params.propuestaId}`);
  if (params.presupuestoId) conditions.push(`presupuesto_id.eq.${params.presupuestoId}`);

  if (conditions.length === 0) return { success: true, data: [] };

  const { data, error } = await agencyDb
    .from("comunicaciones_expediente")
    .select("*, comunicaciones_destinatarios(id, contacto_key, rol, nombre, email, estado, abierto_at, entregado_at, error_detalle)")
    .or(conditions.join(","))
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

export async function saveComunicacion(params: {
  expedienteId?: string | null;
  cotizacionId?: string | null;
  propuestaId?: string | null;
  presupuestoId?: string | null;
  canal: "email" | "whatsapp" | "nota";
  asunto?: string;
  cuerpo: string;
  destinatarios?: Array<{ nombre: string; email?: string; telefono?: string; rol?: string }>;
  adjuntos?: Array<{ nombre: string; tamanio: number }>;
}) {
  const adminSupabase = await createAdminServerClient();
  const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
  if (userError || !user) return { success: false, error: "Usuario no autenticado." };

  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("comunicaciones_expediente")
    .insert({
      expediente_id: params.expedienteId || null,
      cotizacion_id: params.cotizacionId || null,
      propuesta_id: params.propuestaId || null,
      presupuesto_id: params.presupuestoId || null,
      agente_id: user.id,
      canal: params.canal,
      asunto: params.asunto || null,
      cuerpo: params.cuerpo,
      destinatarios: params.destinatarios || [],
      adjuntos: params.adjuntos || [],
      estado: "enviado",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id };
}

export async function getContactosByEntity(params: {
  expedienteId?: string | null;
  cotizacionId?: string | null;
  propuestaId?: string | null;
  presupuestoId?: string | null;
}): Promise<Array<{ key: string; nombre: string; email: string; telefono: string; rol: "pagador" | "viajero" }>> {
  const agencyDb = await getAgencyDbClient();

  // Si hay expediente, cargar los pagadores reales de operativa_pagadores_expedientes
  if (params.expedienteId) {
    const { data } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("entidad_id, contabilidad_entidades!operativa_pagadores_expedientes_entidad_id_fkey(id, nombre, email, telefono)")
      .eq("expediente_id", params.expedienteId);
    if (data && data.length > 0) {
      return data
        .map((p: any) => {
          const ent = p.contabilidad_entidades || {};
          return { key: `p-${ent.id}`, nombre: ent.nombre || "Sin nombre", email: ent.email || "", telefono: ent.telefono || "", rol: "pagador" as const };
        })
        .filter((c, i, arr) => arr.findIndex(x => x.key === c.key) === i);
    }
  }

  // Sin expediente: resolver entidad principal subiendo la cadena
  let entidadId: string | null = null;
  let cotizacionId = params.cotizacionId;

  if (params.presupuestoId && !entidadId) {
    const { data } = await agencyDb.from("operativa_presupuestos").select("entidad_id, cotizaciones:operativa_cotizaciones(id, contacto)").eq("id", params.presupuestoId).maybeSingle();
    if (data?.entidad_id) entidadId = data.entidad_id;
    if (!cotizacionId && (data as any)?.cotizaciones?.[0]?.id) cotizacionId = (data as any).cotizaciones[0].id;
  }

  if (cotizacionId && !entidadId) {
    const { data } = await agencyDb.from("operativa_cotizaciones").select("contacto").eq("id", cotizacionId).maybeSingle();
    if (data?.contacto) entidadId = data.contacto;
  }

  if (params.propuestaId && !entidadId) {
    const { data } = await agencyDb.from("operativa_propuestas").select("cotizacion_id").eq("id", params.propuestaId).maybeSingle();
    if (data?.cotizacion_id) {
      const { data: cot } = await agencyDb.from("operativa_cotizaciones").select("contacto").eq("id", data.cotizacion_id).maybeSingle();
      if (cot?.contacto) entidadId = cot.contacto;
    }
  }

  if (!entidadId) return [];

  const { data: ent } = await agencyDb.from("contabilidad_entidades").select("id, nombre, email, telefono").eq("id", entidadId).maybeSingle();
  if (!ent) return [];

  return [{ key: `p-${ent.id}`, nombre: ent.nombre || "Sin nombre", email: ent.email || "", telefono: ent.telefono || "", rol: "pagador" }];
}

export async function getAllSavedCommunications() {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("comunicaciones_expediente")
    .select("id, asunto, expediente_id")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[comunicaciones] Error fetching saved communications:", error);
    return [];
  }
  return data || [];
}
