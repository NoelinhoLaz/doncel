"use server";

import { cookies } from "next/headers";
import { decrypt } from "@/lib/encryption";
import { getAgencyDbClientByDomain } from "@/lib/agencyDb";
import { upsertEntidad } from "@/lib/entidades/upsertEntidad";
import { subirDocumentoViajero, getUrlFirmadaDocumentoViajero } from "@/lib/documentos/storage";

const COOKIE_NAME = "responsable_session";

export type ResponsableSession = {
  expedienteId: string;
  entidadId: string;
  email: string;
  dominio: string;
};

export async function getResponsableSession(): Promise<ResponsableSession | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return null;

    const { d, iv, t } = JSON.parse(raw);
    if (!d || !iv || !t) return null;

    const decrypted = decrypt(d, iv, t);
    return JSON.parse(decrypted) as ResponsableSession;
  } catch {
    return null;
  }
}

export async function clearResponsableSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

async function getAgencyForSession(session: ResponsableSession) {
  const agency = await getAgencyDbClientByDomain(session.dominio);
  if (!agency) throw new Error("Agencia no encontrada");
  return agency;
}

async function getAgencyDbForSession(session: ResponsableSession) {
  return (await getAgencyForSession(session)).db;
}

async function assertViajeroEnExpediente(
  agencyDb: Awaited<ReturnType<typeof getAgencyDbForSession>>,
  viajeroExpedienteId: string,
  expedienteId: string
) {
  const { data } = await agencyDb
    .from("operativa_viajeros_expedientes")
    .select("id, expediente_id")
    .eq("id", viajeroExpedienteId)
    .maybeSingle();
  return !!data && data.expediente_id === expedienteId;
}

export async function getResponsableExpediente() {
  const session = await getResponsableSession();
  if (!session) return null;

  const agencyDb = await getAgencyDbForSession(session);

  const { data: expediente, error } = await agencyDb
    .from("operativa_expedientes")
    .select("id, numero, referencia, destino_principal, fecha_inicio, fecha_fin, estado, maestro_destinos(nombre)")
    .eq("id", session.expedienteId)
    .single();

  if (error || !expediente) return null;

  return {
    id: expediente.id,
    numero: expediente.numero?.toString() || "",
    referencia: expediente.referencia || "",
    destino: (expediente.maestro_destinos as any)?.nombre || "",
    fechaInicio: expediente.fecha_inicio || "",
    fechaFin: expediente.fecha_fin || "",
    estado: expediente.estado || "",
  };
}

export type ResponsableViajero = {
  id: string; // operativa_viajeros_expedientes.id
  entidadId: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  documento: string | null;
  estado: string | null;
  extras: { id: string; descripcion: string; precio: number; cantidad: number }[];
  importeExtras: number;
};

export async function getResponsableViajeros(): Promise<ResponsableViajero[]> {
  const session = await getResponsableSession();
  if (!session) return [];

  const agencyDb = await getAgencyDbForSession(session);

  const { data, error } = await agencyDb
    .from("operativa_viajeros_expedientes")
    .select(
      "id, estado, extras, importe_extras, contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(id, nombre, email, telefono, documento)"
    )
    .eq("expediente_id", session.expedienteId);

  if (error) {
    console.error("[responsable] Error fetching viajeros:", error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.contabilidad_entidades)
    .map((row: any) => {
      const e = row.contabilidad_entidades;
      const parts = (e.nombre || "").trim().split(/\s+/);
      return {
        id: row.id,
        entidadId: e.id,
        nombre: parts[0] ?? e.nombre,
        apellidos: parts.slice(1).join(" ") || null,
        email: e.email ?? null,
        telefono: e.telefono ?? null,
        documento: e.documento ?? null,
        estado: row.estado ?? null,
        extras: Array.isArray(row.extras) ? row.extras : [],
        importeExtras: Number(row.importe_extras || 0),
      };
    });
}

export async function upsertViajeroResponsable(payload: {
  viajeroExpedienteId?: string; // si es edición
  nombre: string;
  apellidos: string;
  documento: string;
  documento_caducidad?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: "M" | "F" | null;
  email?: string | null;
  telefono?: string | null;
  extras?: { id: string; nombre: string; pvp: number; cantidad: number }[];
}) {
  const session = await getResponsableSession();
  if (!session) return { error: "No autenticado" };

  const doc = (payload.documento || "").trim();
  if (!doc) return { error: "Falta el documento del viajero" };

  try {
    const agencyDb = await getAgencyDbForSession(session);

    // Si es edición, verificar que el viajero pertenece al expediente de la sesión (evita IDOR)
    if (payload.viajeroExpedienteId) {
      const pertenece = await assertViajeroEnExpediente(agencyDb, payload.viajeroExpedienteId, session.expedienteId);
      if (!pertenece) return { error: "Viajero no encontrado en este expediente" };
    }

    const metadatos: Record<string, any> = {};
    if (payload.fecha_nacimiento) metadatos.fecha_nacimiento = payload.fecha_nacimiento;
    if (payload.sexo) metadatos.sexo = payload.sexo;

    const entidadId = await upsertEntidad(agencyDb, {
      nombre: `${payload.nombre} ${payload.apellidos}`.trim(),
      documento: doc,
      documento_caducidad: payload.documento_caducidad || null,
      email: payload.email || null,
      telefono: payload.telefono || null,
      metadatos: Object.keys(metadatos).length ? metadatos : undefined,
      rolNuevo: "viajero",
    });
    if (!entidadId) return { error: "Error al guardar los datos del viajero" };

    const extras = payload.extras ?? [];
    const importeExtras = extras.reduce((s, e) => s + e.pvp * e.cantidad, 0);
    const extrasJsonb = extras.map((e) => ({
      id: e.id,
      descripcion: e.nombre,
      precio: e.pvp,
      cantidad: e.cantidad,
    }));

    let viajeroExpId = payload.viajeroExpedienteId ?? null;

    if (viajeroExpId) {
      await agencyDb
        .from("operativa_viajeros_expedientes")
        .update({ extras: extrasJsonb, importe_extras: importeExtras })
        .eq("id", viajeroExpId);
    } else {
      const { data: existingVE } = await agencyDb
        .from("operativa_viajeros_expedientes")
        .select("id")
        .eq("expediente_id", session.expedienteId)
        .eq("entidad_id", entidadId)
        .maybeSingle();

      if (existingVE) {
        viajeroExpId = existingVE.id;
        await agencyDb
          .from("operativa_viajeros_expedientes")
          .update({ extras: extrasJsonb, importe_extras: importeExtras })
          .eq("id", viajeroExpId);
      } else {
        const { data: inserted, error: insertError } = await agencyDb
          .from("operativa_viajeros_expedientes")
          .insert({
            expediente_id: session.expedienteId,
            entidad_id: entidadId,
            estado: "pendiente",
            extras: extrasJsonb,
            importe_extras: importeExtras,
            pagador_id: session.entidadId,
          })
          .select("id")
          .single();
        if (insertError) return { error: "Error al crear el viajero en el expediente" };
        viajeroExpId = inserted?.id ?? null;
      }
    }

    // Reinsertar operativa_viajero_servicios (extras normalizados)
    if (viajeroExpId) {
      await agencyDb.from("operativa_viajero_servicios").delete().eq("viajero_id", viajeroExpId);
      const serviciosRows = extras.flatMap((e) =>
        Array.from({ length: e.cantidad }, () => ({
          viajero_id: viajeroExpId,
          servicio_id: e.id,
          pagado: false,
        }))
      );
      if (serviciosRows.length > 0) {
        await agencyDb.from("operativa_viajero_servicios").insert(serviciosRows);
      }

      // Reparto de pago: el responsable (contacto principal) como pagador único por defecto
      await agencyDb.from("operativa_viajero_pagadores").delete().eq("viajero_expediente_id", viajeroExpId);
      await agencyDb.from("operativa_viajero_pagadores").insert({
        viajero_expediente_id: viajeroExpId,
        pagador_entidad_id: session.entidadId,
        es_principal: true,
        orden: 0,
      });
    }

    return { success: true, viajeroExpedienteId: viajeroExpId };
  } catch (err: any) {
    console.error("[responsable] Error en upsertViajeroResponsable:", err);
    return { error: err.message || "Error al guardar el viajero" };
  }
}

const TIPOS_DOCUMENTO = ["dni", "pasaporte", "otro"] as const;
const MIME_A_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;

export type ResponsableDocumento = {
  id: string;
  tipoDocumento: string;
  nombreOriginal: string | null;
  subidoEn: string;
  url: string;
};

export async function subirDocumentoResponsable(payload: {
  viajeroExpedienteId: string;
  tipoDocumento: (typeof TIPOS_DOCUMENTO)[number];
  base64: string;
  mimeType: string;
  nombreOriginal: string;
}) {
  const session = await getResponsableSession();
  if (!session) return { error: "No autenticado" };

  if (!TIPOS_DOCUMENTO.includes(payload.tipoDocumento)) return { error: "Tipo de documento inválido" };
  const extension = MIME_A_EXT[payload.mimeType];
  if (!extension) return { error: "Formato no permitido (solo JPG, PNG o PDF)" };

  const buffer = Buffer.from(payload.base64, "base64");
  if (buffer.byteLength > MAX_DOCUMENTO_BYTES) return { error: "El archivo supera el tamaño máximo (10MB)" };

  try {
    const agency = await getAgencyForSession(session);
    const pertenece = await assertViajeroEnExpediente(agency.db, payload.viajeroExpedienteId, session.expedienteId);
    if (!pertenece) return { error: "Viajero no encontrado en este expediente" };

    const { storage_path } = await subirDocumentoViajero(
      agency.db,
      agency.schemaName,
      buffer,
      payload.mimeType,
      payload.viajeroExpedienteId,
      payload.tipoDocumento,
      extension
    );

    const { error } = await agency.db.from("operativa_viajero_documentos").insert({
      viajero_expediente_id: payload.viajeroExpedienteId,
      tipo_documento: payload.tipoDocumento,
      storage_path,
      nombre_original: payload.nombreOriginal,
      subido_por: "responsable",
    });
    if (error) return { error: "Error al guardar el documento" };

    return { success: true };
  } catch (err: any) {
    console.error("[responsable] Error en subirDocumentoResponsable:", err);
    return { error: err.message || "Error al subir el documento" };
  }
}

export async function getDocumentosViajeroResponsable(
  viajeroExpedienteId: string
): Promise<ResponsableDocumento[]> {
  const session = await getResponsableSession();
  if (!session) return [];

  try {
    const agency = await getAgencyForSession(session);
    const pertenece = await assertViajeroEnExpediente(agency.db, viajeroExpedienteId, session.expedienteId);
    if (!pertenece) return [];

    const { data, error } = await agency.db
      .from("operativa_viajero_documentos")
      .select("id, tipo_documento, storage_path, nombre_original, subido_en")
      .eq("viajero_expediente_id", viajeroExpedienteId)
      .order("subido_en", { ascending: false });

    if (error || !data) return [];

    return Promise.all(
      data.map(async (d: any) => ({
        id: d.id,
        tipoDocumento: d.tipo_documento,
        nombreOriginal: d.nombre_original,
        subidoEn: d.subido_en,
        url: await getUrlFirmadaDocumentoViajero(agency.db, agency.schemaName, d.storage_path),
      }))
    );
  } catch (err: any) {
    console.error("[responsable] Error en getDocumentosViajeroResponsable:", err);
    return [];
  }
}
