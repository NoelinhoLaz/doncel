"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

export async function getTiposServicios() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_tipos_servicios")
      .select("*")
      .order("etiqueta", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to get config_tipos_servicios:", error.message);
    return [];
  }
}

export async function createTipoServicio(payload: {
  etiqueta: string;
  icono: string;
  contenido?: any;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_tipos_servicios")
      .insert([{
        etiqueta: payload.etiqueta,
        icono: payload.icono,
        contenido: payload.contenido || {}
      }])
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/settings");
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to create config_tipo_servicio:", error.message);
    throw new Error(error.message || "Failed to create tipo servicio");
  }
}

export async function updateTipoServicio(id: string, payload: {
  etiqueta: string;
  icono: string;
  contenido?: any;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_tipos_servicios")
      .update({
        etiqueta: payload.etiqueta,
        icono: payload.icono,
        contenido: payload.contenido || {}
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/settings");
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update config_tipo_servicio:", error.message);
    throw new Error(error.message || "Failed to update tipo servicio");
  }
}

export async function deleteTipoServicio(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("config_tipos_servicios")
      .delete()
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete config_tipo_servicio:", error.message);
    throw new Error(error.message || "Failed to delete tipo servicio");
  }
}
