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

  // Evita duplicados "por nombre": si la entidad ya tiene una etiqueta distinta
  // con el mismo nombre (creada por otro agente), no se vuelve a asignar.
  const { data: nueva, error: errNueva } = await agencyDb
    .from("crm_etiquetas")
    .select("nombre")
    .eq("id", etiquetaId)
    .single();
  if (errNueva) throw errNueva;

  const { data: yaAsignadas, error: errAsignadas } = await agencyDb
    .from("crm_entidades_etiquetas")
    .select("etiqueta_id, crm_etiquetas(nombre)")
    .eq("entidad_id", entidadId);
  if (errAsignadas) throw errAsignadas;

  const yaTieneMismoNombre = (yaAsignadas ?? []).some(
    (r: any) => r.crm_etiquetas?.nombre?.toLowerCase() === nueva.nombre.toLowerCase()
  );
  if (yaTieneMismoNombre) return;

  const { error } = await agencyDb
    .from("crm_entidades_etiquetas")
    .upsert({ entidad_id: entidadId, etiqueta_id: etiquetaId, added_by: agenteId }, { onConflict: "entidad_id,etiqueta_id" });
  if (error) throw error;
}

// Versión masiva de asignarEtiqueta: resuelve todo en pocas queries en vez de
// una invocación de server action por entidad (evita saturar el servidor con
// cientos de llamadas en paralelo cuando se aplica a un listado filtrado grande).
export async function asignarEtiquetaMasiva(entidadIds: string[], etiquetaId: string) {
  if (entidadIds.length === 0) return;

  const { agenteId } = await getCurrentAgenteConOficina();
  const agencyDb = await getAgencyDbClient();

  const { data: nueva, error: errNueva } = await agencyDb
    .from("crm_etiquetas")
    .select("nombre")
    .eq("id", etiquetaId)
    .single();
  if (errNueva) throw errNueva;

  const { data: yaAsignadas, error: errAsignadas } = await agencyDb
    .from("crm_entidades_etiquetas")
    .select("entidad_id, crm_etiquetas(nombre)")
    .in("entidad_id", entidadIds);
  if (errAsignadas) throw errAsignadas;

  const entidadesConMismoNombre = new Set(
    (yaAsignadas ?? [])
      .filter((r: any) => r.crm_etiquetas?.nombre?.toLowerCase() === nueva.nombre.toLowerCase())
      .map((r: any) => r.entidad_id)
  );

  const rows = entidadIds
    .filter((id) => !entidadesConMismoNombre.has(id))
    .map((entidadId) => ({ entidad_id: entidadId, etiqueta_id: etiquetaId, added_by: agenteId }));

  if (rows.length === 0) return;

  const { error } = await agencyDb
    .from("crm_entidades_etiquetas")
    .upsert(rows, { onConflict: "entidad_id,etiqueta_id" });
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
