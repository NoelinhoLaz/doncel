"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

export async function getTiposCliente() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_tipos_cliente")
      .select("*")
      .order("orden", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to get config_tipos_cliente:", error.message);
    return [];
  }
}

export async function createTipoCliente(payload: { etiqueta: string; orden?: number }) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_tipos_cliente")
      .insert([{ etiqueta: payload.etiqueta, orden: payload.orden ?? 0 }])
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/settings");
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to create config_tipo_cliente:", error.message);
    throw new Error(error.message || "Failed to create tipo cliente");
  }
}

export async function updateTipoCliente(id: string, payload: { etiqueta: string; orden?: number }) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_tipos_cliente")
      .update({ etiqueta: payload.etiqueta, orden: payload.orden ?? 0 })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/settings");
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update config_tipo_cliente:", error.message);
    throw new Error(error.message || "Failed to update tipo cliente");
  }
}

export async function deleteTipoCliente(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("config_tipos_cliente")
      .delete()
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete config_tipo_cliente:", error.message);
    throw new Error(error.message || "Failed to delete tipo cliente");
  }
}
