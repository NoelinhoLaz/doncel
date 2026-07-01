"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { decryptAllergies } from "@/lib/encryption";

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
