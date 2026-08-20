"use server";

import nodemailer from "nodemailer";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentUserEmailConfig } from "./usuarios";
import { verifyToken } from "@/lib/encryption";

export async function getDifusiones() {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("fidelizacion_difusiones")
    .select("id, asunto, origen, num_destinatarios, num_enviados, num_errores, estado, created_at, crm_campanas(nombre), crm_etiquetas(nombre)")
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return data ?? [];
}

type Destinatario = { entidad_id: string; nombre: string; email: string };
type Adjunto = { nombre: string; tamanio: number; contenido: string; tipo: string };
type EmailOpcion = { email: string; etiqueta: string; principal: boolean; tipo: "institucional" | "contacto" };
export type EntidadDestinatarios = { entidad_id: string; nombre: string; emails: EmailOpcion[] };

async function getCurrentAgente() {
  const adminClient = await createAdminServerClient();
  const { data: { user }, error } = await adminClient.auth.getUser();
  if (error || !user) throw new Error("No autenticado");

  const adminServiceClient = createAdminServiceClient();
  const { data: usuario } = await adminServiceClient
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!usuario) throw new Error("Usuario no encontrado");
  return usuario.id as string;
}

type EntidadBase = { id: string; nombre: string; email: string | null; otros_emails?: string[] | null };

async function buildEmailsPorEntidad(entidades: EntidadBase[]): Promise<EntidadDestinatarios[]> {
  const agencyDb = await getAgencyDbClient();
  const ids = entidades.map((e) => e.id);

  // Los contactos vigentes de una entidad se resuelven vía crm_contactos_organizaciones
  // (tabla puente N:M), no vía crm_contactos.entidad_id — ese campo queda congelado en el
  // valor original al crear el contacto y no se actualiza al reasignarlo a otra entidad.
  const { data: rels, error: errContactos } = ids.length
    ? await agencyDb
        .from("crm_contactos_organizaciones")
        .select("entidad_id, crm_contactos(nombre, email, es_principal, activo)")
        .in("entidad_id", ids)
        .eq("es_activa", true)
    : { data: [], error: null };
  if (errContactos) throw errContactos;

  const contactosPorEntidad = new Map<string, { nombre: string; email: string; es_principal: boolean }[]>();
  for (const row of (rels ?? []) as any[]) {
    const c = row.crm_contactos;
    if (!c?.email || !c?.activo) continue;
    const list = contactosPorEntidad.get(row.entidad_id) ?? [];
    list.push(c);
    contactosPorEntidad.set(row.entidad_id, list);
  }

  const result: EntidadDestinatarios[] = [];
  for (const ent of entidades) {
    const emails: EmailOpcion[] = [];
    const vistos = new Set<string>();

    if (ent.email) {
      emails.push({ email: ent.email, etiqueta: "Grupo", principal: true, tipo: "institucional" });
      vistos.add(ent.email);
    }

    for (const otro of ent.otros_emails ?? []) {
      if (!otro || vistos.has(otro)) continue;
      vistos.add(otro);
      emails.push({ email: otro, etiqueta: "Otro email", principal: false, tipo: "institucional" });
    }

    for (const c of contactosPorEntidad.get(ent.id) ?? []) {
      if (!c.email || vistos.has(c.email)) continue;
      vistos.add(c.email);
      emails.push({ email: c.email, etiqueta: c.nombre, principal: c.es_principal && !ent.email, tipo: "contacto" });
    }

    if (emails.length > 0) {
      result.push({ entidad_id: ent.id, nombre: ent.nombre, emails });
    }
  }
  return result;
}

export async function getDestinatariosPorCampana(campanaId: string): Promise<EntidadDestinatarios[]> {
  const agenteId = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_oportunidades")
    .select("entidad_id, contabilidad_entidades(id, nombre, email, otros_emails)")
    .eq("campana_id", campanaId)
    .eq("agente_id", agenteId)
    .not("entidad_id", "is", null);
  if (error) throw error;
  const seen = new Set<string>();
  const entidades: EntidadBase[] = [];
  for (const row of (data ?? []) as any[]) {
    const ent = row.contabilidad_entidades;
    if (!ent || seen.has(ent.id)) continue;
    seen.add(ent.id);
    entidades.push(ent);
  }
  return buildEmailsPorEntidad(entidades);
}

export async function getDestinatariosPorEtiqueta(etiquetaId: string): Promise<EntidadDestinatarios[]> {
  const agenteId = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_entidades_etiquetas")
    .select("contabilidad_entidades!inner(id, nombre, email, otros_emails, agente_id)")
    .eq("etiqueta_id", etiquetaId)
    .eq("contabilidad_entidades.agente_id", agenteId);
  if (error) throw error;
  const seen = new Set<string>();
  const entidades: EntidadBase[] = [];
  for (const row of (data ?? []) as any[]) {
    const ent = row.contabilidad_entidades;
    if (!ent || seen.has(ent.id)) continue;
    seen.add(ent.id);
    entidades.push(ent);
  }
  return buildEmailsPorEntidad(entidades);
}

export async function getEmailsDeEntidad(entidadId: string): Promise<EntidadDestinatarios | null> {
  const agencyDb = await getAgencyDbClient();
  const { data: ent, error } = await agencyDb
    .from("contabilidad_entidades")
    .select("id, nombre, email, otros_emails")
    .eq("id", entidadId)
    .single();
  if (error || !ent) return null;
  const [resultado] = await buildEmailsPorEntidad([ent as any]);
  return resultado ?? null;
}

export async function getDestinatariosPorEntidadIds(entidadIds: string[]): Promise<EntidadDestinatarios[]> {
  const ids = [...new Set(entidadIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("contabilidad_entidades")
    .select("id, nombre, email, otros_emails")
    .in("id", ids);
  if (error) throw error;
  return buildEmailsPorEntidad((data ?? []) as any[]);
}

export async function getEntidadCompleta(entidadId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("contabilidad_entidades")
    .select(`
      id, nombre, tipo_entidad, email, telefono, otros_tlfs, otros_emails, lat, lng, direccion,
      agente_id, documento, fecha_nacimiento, created_at, tipo_cliente_id,
      config_tipos_cliente(id, etiqueta),
      crm_agentes(id, nombre, apellidos, avatar_url),
      crm_contactos(id, nombre, cargo, telefono, email, metadatos)
    `)
    .eq("id", entidadId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getDestinatariosClientesAgente(): Promise<EntidadDestinatarios[]> {
  const agenteId = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("contabilidad_entidades")
    .select("id, nombre, email, otros_emails")
    .eq("agente_id", agenteId);
  if (error) throw error;
  return buildEmailsPorEntidad((data ?? []) as any[]);
}

export async function crearDifusion(payload: {
  asunto: string;
  cuerpo: string;
  origen: "campana" | "etiqueta" | "clientes_agente";
  campanaId?: string | null;
  etiquetaId?: string | null;
  destinatarios: Destinatario[];
  adjuntos?: Adjunto[];
}) {
  const { asunto, cuerpo, origen, campanaId, etiquetaId, destinatarios, adjuntos = [] } = payload;

  const destinatariosValidos = destinatarios.filter((d) => d.email && d.email.includes("@"));
  if (destinatariosValidos.length === 0) {
    return { success: false, error: "No hay destinatarios con email válido." };
  }

  const agenteId = await getCurrentAgente();

  const configRes = await getCurrentUserEmailConfig();
  if (!configRes.success || !configRes.data?.email_address) {
    return { success: false, error: "No hay configuración de correo activa. Configura tu cuenta en Ajustes > Correo." };
  }
  const config = configRes.data;
  const isGmail = config.email_provider === "gmail" || config.email_address?.endsWith("@gmail.com") || config.email_address?.endsWith("@googlemail.com");
  const smtpHost = config.email_smtp_host || (isGmail ? "smtp.gmail.com" : "smtp.office365.com");
  const smtpPort = config.email_smtp_port ? Number(config.email_smtp_port) : 587;
  const secure = smtpPort === 465;

  const emailPassword = verifyToken(config.email_password_enc || "");
  if (!emailPassword) {
    return { success: false, error: "No se pudo descifrar la contraseña de correo. Vuelve a guardar tu configuración en Ajustes → Correo." };
  }

  let transporter: nodemailer.Transporter;
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: { type: "LOGIN", user: config.email_address, pass: emailPassword },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      socketTimeout: 30000,
    });
    await transporter.verify();
  } catch (err: any) {
    return { success: false, error: `Error de conexión SMTP: ${err.message}` };
  }

  const htmlCuerpo = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#334155;">${cuerpo.replace(/\n/g, "<br/>")}</div>`;
  const attachments = adjuntos.map((a) => ({
    filename: a.nombre,
    content: Buffer.from(a.contenido, "base64"),
    contentType: a.tipo,
  }));

  const agencyDb = await getAgencyDbClient();
  const { data: difusion, error: difusionError } = await agencyDb
    .from("fidelizacion_difusiones")
    .insert({
      asunto,
      cuerpo,
      origen,
      campana_id: campanaId || null,
      etiqueta_id: etiquetaId || null,
      num_destinatarios: destinatariosValidos.length,
      agente_id: agenteId,
      estado: "enviando",
    })
    .select("id")
    .single();
  if (difusionError || !difusion) {
    return { success: false, error: "Error al crear el registro de difusión." };
  }
  const difusionId = (difusion as any).id as string;

  let numEnviados = 0;
  let numErrores = 0;
  const destinatariosInsert: any[] = [];

  for (const d of destinatariosValidos) {
    try {
      await transporter.sendMail({
        from: `"${config.email_address}" <${config.email_address}>`,
        to: d.email,
        subject: asunto,
        text: cuerpo,
        html: htmlCuerpo,
        attachments,
      });
      numEnviados++;
      destinatariosInsert.push({ difusion_id: difusionId, entidad_id: d.entidad_id, nombre: d.nombre, email: d.email, estado: "enviado" });
    } catch (err: any) {
      numErrores++;
      destinatariosInsert.push({ difusion_id: difusionId, entidad_id: d.entidad_id, nombre: d.nombre, email: d.email, estado: "error", error_detalle: err.message ?? "Error desconocido" });
    }
  }

  if (destinatariosInsert.length > 0) {
    await agencyDb.from("fidelizacion_difusiones_destinatarios").insert(destinatariosInsert);
  }

  await agencyDb
    .from("fidelizacion_difusiones")
    .update({ num_enviados: numEnviados, num_errores: numErrores, estado: numErrores === 0 ? "enviado" : (numEnviados === 0 ? "error" : "enviado") })
    .eq("id", difusionId);

  if (numEnviados === 0) {
    return { success: false, error: "No se pudo enviar a ningún destinatario." };
  }
  return { success: true, numEnviados, numErrores };
}
