"use server";

import nodemailer from "nodemailer";
import { headers } from "next/headers";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentUserEmailConfig, getCurrentUsuario } from "./usuarios";
import { verifyToken } from "@/lib/encryption";

export async function getDifusiones() {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("fidelizacion_difusiones")
    .select("id, asunto, origen, num_destinatarios, num_enviados, num_errores, estado, created_at, crm_campanas(nombre), crm_etiquetas(nombre), crm_agentes(id, nombre, apellidos, avatar_url)")
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return data ?? [];
}

export async function eliminarDifusion(difusionId: string) {
  const usuario = await getCurrentUsuario();
  const rol = (usuario?.rol ?? "").toLowerCase();
  if (!usuario || (rol !== "owner" && rol !== "superadmin")) {
    return { success: false, error: "Solo los usuarios con rol Owner pueden eliminar difusiones." };
  }

  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb
    .from("fidelizacion_difusiones")
    .delete()
    .eq("id", difusionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getDifusionDetalle(difusionId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data: difusion, error: difError } = await agencyDb
    .from("fidelizacion_difusiones")
    .select("id, asunto, cuerpo, origen, num_destinatarios, num_enviados, num_errores, estado, created_at, crm_campanas(nombre), crm_etiquetas(nombre), crm_agentes(id, nombre, apellidos, avatar_url)")
    .eq("id", difusionId)
    .single();

  if (difError || !difusion) return null;

  const { data: destinatarios, error: destError } = await agencyDb
    .from("fidelizacion_difusiones_destinatarios")
    .select("id, entidad_id, nombre, email, estado, error_detalle, token, abierto_at, num_aperturas, created_at, contabilidad_entidades(id, nombre)")
    .eq("difusion_id", difusionId)
    .order("nombre", { ascending: true });

  if (destError) throw destError;

  return {
    ...difusion,
    destinatarios: destinatarios ?? [],
  };
}

export async function markDifusionEmailAbierto(token: string) {
  const agencyDb = await getAgencyDbClient();
  const { data: dest } = await agencyDb
    .from("fidelizacion_difusiones_destinatarios")
    .select("id, abierto_at, num_aperturas")
    .eq("token", token)
    .single();

  if (!dest) return { success: false };

  const updates: any = {
    num_aperturas: (dest.num_aperturas || 0) + 1,
  };
  if (!dest.abierto_at) {
    updates.abierto_at = new Date().toISOString();
  }

  const { error } = await agencyDb
    .from("fidelizacion_difusiones_destinatarios")
    .update(updates)
    .eq("id", dest.id);

  return { success: !error };
}

export async function getMetricasDifusiones() {
  const agencyDb = await getAgencyDbClient();
  const { data: difusiones, error: errD } = await agencyDb
    .from("fidelizacion_difusiones")
    .select("id, num_destinatarios, num_enviados, num_errores, estado, created_at, agente_id, crm_agentes(nombre, apellidos)");
  if (errD && errD.code !== "42P01") throw errD;

  const { data: dests, error: errDest } = await agencyDb
    .from("fidelizacion_difusiones_destinatarios")
    .select("id, difusion_id, estado, abierto_at, num_aperturas");
  if (errDest && errDest.code !== "42P01") throw errDest;

  const listaDif = difusiones ?? [];
  const listaDest = dests ?? [];

  const totalDifusiones = listaDif.length;
  const totalDestinatarios = listaDif.reduce((acc, d) => acc + (d.num_destinatarios || 0), 0);
  const totalEnviados = listaDif.reduce((acc, d) => acc + (d.num_enviados || 0), 0);
  const totalErrores = listaDif.reduce((acc, d) => acc + (d.num_errores || 0), 0);

  const totalAbiertos = listaDest.filter((d) => d.abierto_at !== null).length;
  const tasaEntrega = totalDestinatarios > 0 ? Math.round((totalEnviados / totalDestinatarios) * 100) : 100;
  const tasaApertura = totalEnviados > 0 ? Math.round((totalAbiertos / totalEnviados) * 100) : 0;

  const ahora = new Date();
  const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
  const enviadosEsteMes = listaDif
    .filter((d) => d.created_at >= primerDiaMes)
    .reduce((acc, d) => acc + (d.num_enviados || 0), 0);

  return {
    totalDifusiones,
    totalDestinatarios,
    totalEnviados,
    totalErrores,
    totalAbiertos,
    tasaEntrega,
    tasaApertura,
    enviadosEsteMes,
  };
}

export async function getUltimasDifusionesPorEntidad(entidadIds: string[]) {
  if (!entidadIds || entidadIds.length === 0) return {};
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("fidelizacion_difusiones_destinatarios")
    .select("entidad_id, created_at, difusion_id, fidelizacion_difusiones(asunto)")
    .in("entidad_id", entidadIds)
    .eq("estado", "enviado")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return {};
    throw error;
  }

  const mapa: Record<string, { fecha: string; asunto: string }> = {};
  for (const row of (data ?? []) as any[]) {
    if (row.entidad_id && !mapa[row.entidad_id]) {
      mapa[row.entidad_id] = {
        fecha: row.created_at,
        asunto: row.fidelizacion_difusiones?.asunto ?? "Difusión",
      };
    }
  }
  return mapa;
}

export async function getHistorialDifusionesEntidad(entidadId: string) {
  if (!entidadId) return [];
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("fidelizacion_difusiones_destinatarios")
    .select("id, nombre, email, estado, error_detalle, abierto_at, num_aperturas, created_at, fidelizacion_difusiones(id, asunto, origen, created_at, crm_agentes(nombre, apellidos))")
    .eq("entidad_id", entidadId)
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

export async function buildEmailsPorEntidad(entidades: EntidadBase[]): Promise<EntidadDestinatarios[]> {
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

export async function getClientesPersona(): Promise<EntidadDestinatarios[]> {
  const agenteId = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("contabilidad_entidades")
    .select("id, nombre, email, otros_emails")
    .eq("agente_id", agenteId)
    .eq("tipo_entidad", "persona");
  if (error) throw error;
  return buildEmailsPorEntidad((data ?? []) as any[]);
}

export async function getGruposEmpresa(): Promise<EntidadDestinatarios[]> {
  const agenteId = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("contabilidad_entidades")
    .select("id, nombre, email, otros_emails")
    .eq("agente_id", agenteId)
    .in("tipo_entidad", ["organizacion", "empresa"]);
  if (error) throw error;
  return buildEmailsPorEntidad((data ?? []) as any[]);
}

function extraerNombrePila(nombreCompleto: string): string {
  const limpio = (nombreCompleto || "").trim();
  if (!limpio) return "";

  const palabras = limpio.split(/\s+/);
  if (palabras.length <= 1) return palabras[0] || "";

  // Casos de María / Maria con "del", "de la", "de los", "de las"
  const matchCompuestoDe = limpio.match(/^(mar[ií]a|mª|m\.)\s+(del?\s+(carmen|pilar|mar|rosario|valle|sol|consuelo|coro|camino|puerto|remedio|prado|monte|loreto|henar|almudena|roc[ií]o)|de\s+la\s+\w+|de\s+los\s+\w+|de\s+las\s+\w+)/i);
  if (matchCompuestoDe) return matchCompuestoDe[0];

  const PRIMEROS_COMPUESTOS = new Set([
    "jose", "josé",
    "juan",
    "maria", "maría",
    "ana",
    "francisco",
    "miguel",
    "carlos",
    "luis",
    "victor", "víctor",
    "angel", "ángel",
    "pedro",
    "jesus", "jesús",
    "fco", "fco.",
    "ma", "mª", "m."
  ]);

  const p0 = palabras[0].toLowerCase();

  if (PRIMEROS_COMPUESTOS.has(p0) && palabras.length >= 2) {
    const SEGUNDOS_NOMBRES = new Set([
      "luis", "manuel", "antonio", "carlos", "miguel", "angel", "ángel", "javier", "alberto", "ramon", "ramón",
      "fernando", "david", "pablo", "diego", "ignacio", "alejandro", "vicente", "adrian", "adrián", "andres", "andrés",
      "maria", "maría", "jose", "josé", "jesus", "jesús", "teresa", "isabel", "luisa", "dolores", "carmen", "pilar",
      "elena", "victoria", "belen", "belén", "rosa", "cristina", "lucia", "lucía", "marta", "patricia", "laura",
      "borja", "guillermo", "enrique", "jaime", "alfonso", "eduardo", "rafael", "joaquin", "joaquín", "gabriel"
    ]);

    const p1 = palabras[1].toLowerCase();
    if (SEGUNDOS_NOMBRES.has(p1)) {
      return `${palabras[0]} ${palabras[1]}`;
    }
  }

  return palabras[0];
}

function personalizarTexto(texto: string, d: { nombre: string; email: string }) {
  const nombreCompleto = d.nombre || "";
  const nombrePila = extraerNombrePila(nombreCompleto);
  const email = d.email || "";

  return texto
    .replace(/\{\{\s*nombre_responsable\s*\}\}/gi, nombreCompleto)
    .replace(/\{\{\s*nombre\s*\}\}/gi, nombrePila)
    .replace(/\{\{\s*(email_destinatario|email)\s*\}\}/gi, email);
}

export async function crearDifusion(payload: {
  asunto: string;
  cuerpo: string;
  origen: "campana" | "etiqueta" | "clientes_agente" | "difusion";
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

  const htmlCuerpo = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#334155;">${cuerpo}</div>`;
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
  let appBaseUrl = "";
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    if (host) appBaseUrl = `${proto}://${host}`;
  } catch {
    // fallback
  }

  const destinatariosInsert: any[] = [];

  for (const d of destinatariosValidos) {
    const token = crypto.randomUUID();
    const subjectPersonalizado = personalizarTexto(asunto, d);
    const textPersonalizado = personalizarTexto(cuerpo, d);

    // Pixel de tracking individual
    const trackingPixel = appBaseUrl
      ? `<img src="${appBaseUrl}/api/track/${token}" width="1" height="1" style="display:none;" alt="" />`
      : "";
    const htmlPersonalizado = `${personalizarTexto(htmlCuerpo, d)}${trackingPixel}`;

    try {
      await transporter.sendMail({
        from: `"${config.email_address}" <${config.email_address}>`,
        to: d.email,
        subject: subjectPersonalizado,
        text: textPersonalizado,
        html: htmlPersonalizado,
        attachments,
      });
      numEnviados++;
      destinatariosInsert.push({
        difusion_id: difusionId,
        entidad_id: d.entidad_id,
        nombre: d.nombre,
        email: d.email,
        estado: "enviado",
        token,
      });
    } catch (err: any) {
      numErrores++;
      destinatariosInsert.push({
        difusion_id: difusionId,
        entidad_id: d.entidad_id,
        nombre: d.nombre,
        email: d.email,
        estado: "error",
        error_detalle: err.message ?? "Error desconocido",
        token,
      });
    }

    // Throttling de seguridad: pausa de 120ms entre envíos para proteger reputación de IP/SMTP
    await new Promise((r) => setTimeout(r, 120));
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
