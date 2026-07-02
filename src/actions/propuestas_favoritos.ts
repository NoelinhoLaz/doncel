"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import type { Seccion, SeccionFavorita } from "@/app/propuestas/nueva/types";

async function getUsuarioId(): Promise<string> {
  const adminClient = await createAdminServerClient();
  const { data: { user }, error } = await adminClient.auth.getUser();
  if (error || !user) throw new Error("No autenticado");

  const svc = createAdminServiceClient();
  const { data: usuario } = await svc
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuario) throw new Error("Usuario no encontrado");
  return usuario.id as string;
}

export async function getFavoritos(): Promise<SeccionFavorita[]> {
  try {
    const usuarioId = await getUsuarioId();
    const db = await getAgencyDbClient();
    const { data, error } = await db
      .from("propuestas_secciones_favoritas")
      .select("*")
      .eq("usuario_id", usuarioId)
      .order("saved_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      ...row.seccion_data,
      favId: row.fav_id,
      savedAt: new Date(row.saved_at).getTime(),
    }));
  } catch (e: any) {
    console.error("getFavoritos error:", e?.message);
    return [];
  }
}

export async function toggleFavoritoAction(seccion: Seccion): Promise<{ favs: SeccionFavorita[] }> {
  try {
    const usuarioId = await getUsuarioId();
    const db = await getAgencyDbClient();

    const { data: existing } = await db
      .from("propuestas_secciones_favoritas")
      .select("id")
      .eq("usuario_id", usuarioId)
      .eq("fav_id", seccion.uid)
      .single();

    if (existing) {
      await db
        .from("propuestas_secciones_favoritas")
        .delete()
        .eq("id", existing.id);
    } else {
      await db
        .from("propuestas_secciones_favoritas")
        .insert({
          usuario_id: usuarioId,
          fav_id: seccion.uid,
          seccion_data: seccion,
          saved_at: new Date().toISOString(),
        });
    }

    const favs = await getFavoritos();
    return { favs };
  } catch (e: any) {
    console.error("toggleFavoritoAction error:", e?.message);
    return { favs: [] };
  }
}
