"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";

export async function getEntidades() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_entidades")
      .select("id, nombre, documento, email, telefono, roles, metadatos")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error fetching entidades:", error);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error("Failed to get entidades:", error.message);
    throw new Error(error.message || "Failed to fetch entidades");
  }
}

export async function createEntidad(nombre: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_entidades")
      .insert([{ nombre: nombre.trim() }])
      .select("id, nombre, documento, email")
      .single();

    if (error) {
      console.error("Error creating entidad:", error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error("Failed to create entidad:", error.message);
    throw new Error(error.message || "Failed to create entidad");
  }
}

export async function createEntidadCompleta(payload: {
  nombre: string;
  email?: string;
  direccion?: {
    calle?: string;
    ciudad?: string;
    provincia?: string;
  };
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_entidades")
      .insert([{
        nombre: payload.nombre.trim(),
        email: payload.email?.trim() || null,
        direccion: payload.direccion || null,
        roles: { contacto: true }
      }])
      .select("id, nombre, documento, email")
      .single();

    if (error) {
      console.error("Error creating entidad completa:", error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error("Failed to create entidad completa:", error.message);
    throw new Error(error.message || "Failed to create entidad completa");
  }
}


