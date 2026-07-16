"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
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
    const adminSupabase = await createAdminServerClient();
    const { data: { user } } = await adminSupabase.auth.getUser();
    if (!user) throw new Error("No hay usuario autenticado.");

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario } = await adminServiceSupabase
      .from("usuarios")
      .select("agencia_id")
      .eq("auth_user_id", user.id)
      .single();

    if (usuario?.agencia_id) {
      const { data: agencia } = await adminServiceSupabase
        .from("agencias")
        .select("capacidad_tipo")
        .eq("id", usuario.agencia_id)
        .single();

      if ((agencia?.capacidad_tipo || "Starter") === "Starter") {
        throw new Error("Tu plan Starter no permite crear sucursales adicionales. Contacta con tu agencia para ampliar a Growth.");
      }
    }

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
