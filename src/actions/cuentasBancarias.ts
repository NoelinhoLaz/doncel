"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

export async function getCuentasBancarias() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_cuentas_bancarias")
      .select("*, config_oficinas(nombre)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching cuentas bancarias:", error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error("Failed to get cuentas bancarias:", error.message);
    throw new Error(error.message || "Failed to fetch cuentas bancarias");
  }
}

export async function createCuentaBancaria(payload: {
  oficina_id: string;
  banco: string;
  iban: string | null;
  swift?: string;
  descripcion?: string;
  cuenta_contable?: string | null;
  activa?: boolean;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_cuentas_bancarias")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Error creating cuenta bancaria:", error);
      throw error;
    }

    revalidatePath("/settings");
    return data;
  } catch (error: any) {
    console.error("Failed to create cuenta bancaria:", error.message);
    throw new Error(error.message || "Failed to create cuenta bancaria");
  }
}

export async function updateCuentaBancaria(
  id: string,
  payload: {
    oficina_id: string;
    banco: string;
    iban: string | null;
    swift?: string;
    descripcion?: string;
    cuenta_contable?: string | null;
    activa?: boolean;
  }
) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_cuentas_bancarias")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating cuenta bancaria:", error);
      throw error;
    }

    revalidatePath("/settings");
    return data;
  } catch (error: any) {
    console.error("Failed to update cuenta bancaria:", error.message);
    throw new Error(error.message || "Failed to update cuenta bancaria");
  }
}
