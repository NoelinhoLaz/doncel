"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { decryptAllergies, encryptAllergies } from "@/lib/encryption";
import { revalidatePath } from "next/cache";

export async function getViajerosByExpediente(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select("id, estado, datos_viaje, extras, importe_extras, alergias, entidad_id, tutor_id, pagador_id, contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(id, nombre, documento, documento_caducidad, email, telefono, metadatos), tutores:contabilidad_entidades!operativa_viajeros_expedientes_tutor_id_fkey(id, nombre, documento, email, telefono)")
      .eq("expediente_id", expedienteId);

    if (error) {
      console.error("getViajerosByExpediente error:", error);
      return [];
    }

    const decryptedData = (data || []).map((row: any) => {
      let decryptedAlergias = row.alergias;
      try {
        decryptedAlergias = decryptAllergies(row.alergias);
      } catch (err) {
        console.error("Error decrypting allergies for traveler", row.id, err);
      }
      return {
        ...row,
        alergias: decryptedAlergias
      };
    });

    return decryptedData;
  } catch (error: any) {
    console.error("Failed to get viajeros:", error.message);
    return [];
  }
}

export async function anularViajero(viajeroId: string, motivo?: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .update({
        estado: "anulado",
        fecha_anulacion: new Date().toISOString().split("T")[0],
        motivo_anulacion: motivo || null,
      })
      .eq("id", viajeroId);

    if (error) throw error;
    revalidatePath("/expedientes");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to anular viajero:", error.message);
    return { success: false, error: error.message };
  }
}

export type TipoViajero = "pasajero" | "acompanante" | "chofer";

export async function crearViajeroCompleto(payload: {
  expedienteId: string;
  tipo: TipoViajero;
  viajero: {
    nombre: string;
    apellidos: string;
    dni: string;
    dni_caducidad?: string | null;
    pasaporte?: string | null;
    pasaporte_caducidad?: string | null;
    fecha_nacimiento?: string | null;
    sexo?: "M" | "F" | null;
    numero_soporte?: string | null;
    email?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    lat?: number | null;
    lng?: number | null;
    alergias?: string[];
    extras?: { id: string; nombre: string; pvp: number; cantidad: number }[];
    tutor?: { nombre: string; telefono: string; email: string } | null;
  };
  // Pagador: obligatorio solo para tipo "pasajero". Si se pasa pagadorEntidadId,
  // se reutiliza un pagador ya existente en el expediente; si no, se crea uno
  // nuevo con los datos de "pagadorNuevo".
  pagadorEntidadId?: string | null;
  pagadorNuevo?: {
    nombre: string;
    apellidos: string;
    dni: string;
    direccion?: string | null;
    lat?: number | null;
    lng?: number | null;
    email?: string | null;
    telefono?: string | null;
  } | null;
  importeTotal?: number;
  medioPago?: string;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { expedienteId, tipo, viajero: v } = payload;

    // Columnas reales de contabilidad_entidades: nombre, documento,
    // documento_caducidad, email, telefono, direccion, roles, metadatos.
    // fecha_nacimiento, sexo, pasaporte, numero_soporte van en metadatos (JSONB).
    async function upsertEntidad(datos: {
      nombre: string;
      documento: string;
      documento_caducidad?: string | null;
      email?: string | null;
      telefono?: string | null;
      direccion?: string | null;
      lat?: number | null;
      lng?: number | null;
      metadatos?: Record<string, any>;
      rolNuevo: string;
    }): Promise<string | null> {
      const doc = datos.documento.trim().toUpperCase();
      const { data: existing } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, roles, metadatos")
        .eq("documento", doc)
        .maybeSingle();

      if (existing) {
        const rolesActualizados = { ...(existing.roles || {}), [datos.rolNuevo]: true };
        const metadatosActualizados = { ...(existing.metadatos || {}), ...(datos.metadatos || {}) };
        await agencyDb
          .from("contabilidad_entidades")
          .update({
            roles: rolesActualizados,
            metadatos: metadatosActualizados,
            ...(datos.documento_caducidad && { documento_caducidad: datos.documento_caducidad }),
            ...(datos.email && { email: datos.email }),
            ...(datos.telefono && { telefono: datos.telefono }),
            ...(datos.direccion && { direccion: { direccion: datos.direccion } }),
            ...(datos.lat != null && { lat: datos.lat }),
            ...(datos.lng != null && { lng: datos.lng }),
          })
          .eq("id", existing.id);
        return existing.id;
      } else {
        const { data: newEnt, error } = await agencyDb
          .from("contabilidad_entidades")
          .insert({
            nombre: datos.nombre.trim(),
            documento: doc,
            documento_caducidad: datos.documento_caducidad || null,
            email: datos.email || null,
            telefono: datos.telefono || null,
            direccion: datos.direccion ? { direccion: datos.direccion } : null,
            lat: datos.lat ?? null,
            lng: datos.lng ?? null,
            roles: { [datos.rolNuevo]: true },
            metadatos: datos.metadatos || {},
          })
          .select("id")
          .single();
        if (error) throw error;
        return newEnt?.id ?? null;
      }
    }

    // ── 1. Pagador (solo para pasajeros) ──────────────────────────────────────
    let pagadorEntidadId: string | null = null;
    if (tipo === "pasajero") {
      if (payload.pagadorEntidadId) {
        pagadorEntidadId = payload.pagadorEntidadId;
      } else if (payload.pagadorNuevo) {
        const p = payload.pagadorNuevo;
        pagadorEntidadId = await upsertEntidad({
          nombre: `${p.nombre} ${p.apellidos}`,
          documento: p.dni,
          email: p.email || null,
          telefono: p.telefono || null,
          direccion: p.direccion || null,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          rolNuevo: "cliente",
        });
        if (!pagadorEntidadId) return { success: false, error: "Error al crear el pagador" };
      } else {
        return { success: false, error: "Falta el pagador para este viajero" };
      }
    }

    // ── 2. Entidad del viajero ─────────────────────────────────────────────────
    const docViajero = (v.dni || v.pasaporte || "").trim().toUpperCase();
    if (!docViajero) return { success: false, error: "Falta el documento del viajero" };

    const metadatosViajero: Record<string, any> = {};
    if (v.fecha_nacimiento) metadatosViajero.fecha_nacimiento = v.fecha_nacimiento;
    if (v.sexo) metadatosViajero.sexo = v.sexo;
    if (v.numero_soporte) metadatosViajero.numero_soporte = v.numero_soporte.trim().toUpperCase();
    if (v.pasaporte) metadatosViajero.pasaporte = v.pasaporte.trim().toUpperCase();
    if (v.pasaporte_caducidad) metadatosViajero.pasaporte_caducidad = v.pasaporte_caducidad;

    const entidadId = await upsertEntidad({
      nombre: `${v.nombre} ${v.apellidos}`,
      documento: docViajero,
      documento_caducidad: v.dni_caducidad || v.pasaporte_caducidad || null,
      email: v.email || null,
      telefono: v.telefono || null,
      direccion: v.direccion || null,
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      metadatos: Object.keys(metadatosViajero).length ? metadatosViajero : undefined,
      rolNuevo: "viajero",
    });
    if (!entidadId) return { success: false, error: "Error al crear el viajero" };

    // ── 2a. Tutor (si es menor) ────────────────────────────────────────────────
    let tutorEntidadId: string | null = null;
    if (v.tutor?.nombre) {
      const tutorDoc = v.tutor.email?.trim().toUpperCase() ||
        v.tutor.nombre.replace(/\s+/g, "").toUpperCase().slice(0, 20);
      tutorEntidadId = await upsertEntidad({
        nombre: v.tutor.nombre,
        documento: tutorDoc,
        email: v.tutor.email || null,
        telefono: v.tutor.telefono || null,
        rolNuevo: "tutor",
      });
    }

    // ── 2b. Extras ──────────────────────────────────────────────────────────────
    const extrasViajero = v.extras ?? [];
    const importeExtrasViajero = extrasViajero.reduce((s, e) => s + e.pvp * e.cantidad, 0);
    const extrasJsonb = extrasViajero.map((e) => ({
      id: e.id,
      descripcion: e.nombre,
      precio: e.pvp,
      cantidad: e.cantidad,
    }));

    // ── 2c. operativa_viajeros_expedientes ─────────────────────────────────────
    const { data: existingVE } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select("id")
      .eq("expediente_id", expedienteId)
      .eq("entidad_id", entidadId)
      .maybeSingle();

    const vePayload = {
      estado: "pendiente" as const,
      extras: extrasJsonb,
      importe_extras: importeExtrasViajero,
      alergias: encryptAllergies(v.alergias ?? []),
      pagador_id: pagadorEntidadId,
      tutor_id: tutorEntidadId,
      datos_viaje: { tipo, medio_pago: payload.medioPago || null },
    };

    let viajeroExpId: string | null = null;
    if (existingVE) {
      await agencyDb.from("operativa_viajeros_expedientes").update(vePayload).eq("id", existingVE.id);
      viajeroExpId = existingVE.id;
    } else {
      const { data: insertedVE, error: errVE } = await agencyDb
        .from("operativa_viajeros_expedientes")
        .insert({ expediente_id: expedienteId, entidad_id: entidadId, ...vePayload })
        .select("id")
        .single();
      if (errVE) throw errVE;
      viajeroExpId = insertedVE?.id ?? null;
    }

    // ── 2d. operativa_viajero_servicios (extras normalizados) ──────────────────
    if (viajeroExpId && extrasViajero.length > 0) {
      await agencyDb.from("operativa_viajero_servicios").delete().eq("viajero_id", viajeroExpId);
      const serviciosRows = extrasViajero.flatMap((e) =>
        Array.from({ length: e.cantidad }, () => ({
          viajero_id: viajeroExpId,
          servicio_id: e.id,
          pagado: false,
        }))
      );
      if (serviciosRows.length > 0) {
        await agencyDb.from("operativa_viajero_servicios").insert(serviciosRows);
      }
    }

    // ── 3. operativa_pagadores_expedientes (solo pasajeros) ────────────────────
    if (tipo === "pasajero" && pagadorEntidadId) {
      const importeTotalViajero = (payload.importeTotal ?? 0) + importeExtrasViajero;

      const { data: existingPag } = await agencyDb
        .from("operativa_pagadores_expedientes")
        .select("id, importe_total")
        .eq("expediente_id", expedienteId)
        .eq("entidad_id", pagadorEntidadId)
        .maybeSingle();

      if (existingPag) {
        await agencyDb
          .from("operativa_pagadores_expedientes")
          .update({ importe_total: Number(existingPag.importe_total || 0) + importeTotalViajero })
          .eq("id", existingPag.id);
      } else {
        await agencyDb.from("operativa_pagadores_expedientes").insert({
          expediente_id: expedienteId,
          entidad_id: pagadorEntidadId,
          importe_total: importeTotalViajero,
          estado: "pendiente",
        });
      }
    }

    revalidatePath("/expedientes");
    return { success: true, viajeroId: viajeroExpId };
  } catch (error: any) {
    console.error("Failed to crear viajero completo:", error.message);
    return { success: false, error: error.message || "Error al crear el viajero" };
  }
}

export async function reactivarViajero(viajeroId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .update({
        estado: "pendiente",
        fecha_anulacion: null,
        motivo_anulacion: null,
      })
      .eq("id", viajeroId);

    if (error) throw error;
    revalidatePath("/expedientes");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to reactivar viajero:", error.message);
    return { success: false, error: error.message };
  }
}

export async function getViajerosConPagadorByExpediente(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select(`
        id, entidad_id, pagador_id,
        viajero:contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(id, nombre),
        pagador:contabilidad_entidades!operativa_viajeros_expedientes_pagador_id_fkey(id, nombre)
      `)
      .eq("expediente_id", expedienteId);

    if (error) {
      console.error("getViajerosConPagadorByExpediente error:", error);
      return [];
    }
    return data || [];
  } catch (error: any) {
    console.error("Failed to get viajeros con pagador:", error.message);
    return [];
  }
}
