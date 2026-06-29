"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

export async function getOficinas() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_oficinas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching oficinas:", error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error("Failed to get oficinas:", error.message);
    throw new Error(error.message || "Failed to fetch oficinas");
  }
}

export async function createOficina(payload: {
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: any;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_oficinas")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Error creating oficina:", error);
      throw error;
    }

    revalidatePath("/settings");
    return data;
  } catch (error: any) {
    console.error("Failed to create oficina:", error.message);
    throw new Error(error.message || "Failed to create oficina");
  }
}
