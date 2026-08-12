"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

async function getCurrentAgenteConOficina() {
  const adminClient = await createAdminServerClient();
  const { data: { user }, error } = await adminClient.auth.getUser();
  if (error || !user) throw new Error("No autenticado");

  const adminServiceClient = createAdminServiceClient();
  const { data: usuario } = await adminServiceClient
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!usuario) throw new Error("Usuario no encontrado");

  const agencyDb = await getAgencyDbClient();
  const { data: config } = await agencyDb
    .from("config_usuarios")
    .select("oficina")
    .eq("usuario_id", usuario.id)
    .single();

  return { agenteId: usuario.id as string, oficinaId: (config?.oficina as string | null) ?? null };
}

// Etiquetas según el filtro elegido por quien consulta:
// 'agente' -> solo las creadas por él, 'sucursal' -> las de su oficina, 'agencia' -> todas
export async function getEtiquetas(scope: "agente" | "sucursal" | "agencia" = "agencia") {
  const { agenteId, oficinaId } = await getCurrentAgenteConOficina();
  const agencyDb = await getAgencyDbClient();

  let query = agencyDb
    .from("crm_etiquetas")
    .select("id, nombre, color, oficina_id, agente_id, created_by")
    .order("nombre", { ascending: true });

  if (scope === "agente") {
    query = query.eq("agente_id", agenteId);
  } else if (scope === "sucursal") {
    if (!oficinaId) return [];
    query = query.eq("oficina_id", oficinaId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function crearEtiqueta(payload: { nombre: string; color?: string }) {
  const { agenteId, oficinaId } = await getCurrentAgenteConOficina();
  const agencyDb = await getAgencyDbClient();

  const insert: Record<string, any> = {
    nombre: payload.nombre.trim(),
    color: payload.color || "#64748b",
    agente_id: agenteId,
    oficina_id: oficinaId,
    created_by: agenteId,
  };

  const { data, error } = await agencyDb
    .from("crm_etiquetas")
    .insert([insert])
    .select("id, nombre, color, oficina_id, agente_id")
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarEtiqueta(etiquetaId: string) {
  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb.from("crm_etiquetas").delete().eq("id", etiquetaId);
  if (error) throw error;
}

export async function getEtiquetasEntidad(entidadId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_entidades_etiquetas")
    .select("etiqueta_id, crm_etiquetas(id, nombre, color, oficina_id, agente_id)")
    .eq("entidad_id", entidadId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.crm_etiquetas).filter(Boolean);
}

export async function asignarEtiqueta(entidadId: string, etiquetaId: string) {
  const { agenteId } = await getCurrentAgenteConOficina();
  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb
    .from("crm_entidades_etiquetas")
    .upsert({ entidad_id: entidadId, etiqueta_id: etiquetaId, added_by: agenteId }, { onConflict: "entidad_id,etiqueta_id" });
  if (error) throw error;
}

export async function quitarEtiqueta(entidadId: string, etiquetaId: string) {
  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb
    .from("crm_entidades_etiquetas")
    .delete()
    .eq("entidad_id", entidadId)
    .eq("etiqueta_id", etiquetaId);
  if (error) throw error;
}
