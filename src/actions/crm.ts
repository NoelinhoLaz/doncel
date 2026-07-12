"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { getCurrentUsuario } from "@/actions/usuarios";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getCurrentAgente() {
  const adminClient = await createAdminServerClient();
  const { data: { user }, error } = await adminClient.auth.getUser();
  if (error || !user) throw new Error("No autenticado");

  const adminServiceClient = createAdminServiceClient();
  const { data: usuario } = await adminServiceClient
    .from("usuarios")
    .select("id, rol")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuario) throw new Error("Usuario no encontrado");
  return { authUid: user.id, usuarioId: usuario.id as string, rol: usuario.rol as string };
}

export async function getCurrentAgentePublic() {
  return getCurrentAgente();
}

function isAdmin(rol: string) {
  return ["Admin", "SuperAdmin", "Owner"].includes(rol);
}

// ─── CAMPAÑAS ────────────────────────────────────────────────────────────────

export async function getCampanas() {
  const { usuarioId, rol } = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();

  let query = agencyDb
    .from("crm_campanas")
    .select(`
      *,
      crm_campanas_estados(id, nombre, orden, color, es_final, es_ganado),
      crm_campanas_agentes(agente_id, rol, objetivo_num, objetivo_valor, crm_agentes!crm_campanas_agentes_agente_id_fkey(id, nombre, apellidos, avatar_url)),
      crm_oportunidades(valor_estimado, estado_id, agente_id)
    `)
    .order("created_at", { ascending: false });

  // Agente solo ve sus campañas
  if (!isAdmin(rol)) {
    const { data: misIds } = await agencyDb
      .from("crm_campanas_agentes")
      .select("campana_id")
      .eq("agente_id", usuarioId);
    const ids = (misIds ?? []).map((r: any) => r.campana_id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!isAdmin(rol) && data) {
    return data.map((campana: any) => ({
      ...campana,
      crm_oportunidades: (campana.crm_oportunidades ?? []).filter((o: any) => o.agente_id === usuarioId),
      crm_campanas_agentes: (campana.crm_campanas_agentes ?? []).filter((a: any) => a.agente_id === usuarioId),
    }));
  }

  return data ?? [];
}

export async function getCampana(id: string) {
  const { usuarioId, rol } = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_campanas")
    .select(`
      *,
      crm_campanas_estados(id, nombre, orden, color, es_final, es_ganado),
      crm_campanas_agentes(
        agente_id, rol, objetivo_num, objetivo_valor,
        crm_agentes!crm_campanas_agentes_agente_id_fkey(id, nombre, apellidos, avatar_url)
      )
    `)
    .eq("id", id)
    .single();
  if (error) throw error;

  if (!isAdmin(rol) && data) {
    const isParticipant = (data.crm_campanas_agentes ?? []).some((a: any) => a.agente_id === usuarioId);
    if (!isParticipant) {
      throw new Error("No autorizado para ver esta campaña");
    }
    return {
      ...data,
      crm_campanas_agentes: (data.crm_campanas_agentes ?? []).filter((a: any) => a.agente_id === usuarioId),
    };
  }

  return data;
}

export async function createCampana(payload: {
  nombre: string;
  descripcion?: string;
  tipo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  oficina_id?: string;
}) {
  const { usuarioId, rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede crear campañas");

  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_campanas")
    .insert({ ...payload, estado: "planificada", created_by: usuarioId })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/campanas");
  return data;
}

export async function updateCampana(id: string, payload: Partial<{
  nombre: string;
  descripcion: string;
  tipo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  oficina_id: string;
}>) {
  const { rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede editar campañas");

  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_campanas")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/campanas");
  return data;
}

export async function deleteCampana(id: string) {
  const { rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede eliminar campañas");

  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb.from("crm_campanas").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/campanas");
}

export async function duplicarCampana(id: string, conContactos: boolean) {
  const { usuarioId, rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede duplicar campañas");

  const agencyDb = await getAgencyDbClient();

  // 1. Leer campaña original con sus estados y oportunidades
  const { data: original, error: errOrig } = await agencyDb
    .from("crm_campanas")
    .select(`
      *,
      crm_campanas_estados(id, nombre, orden, color, es_final, es_ganado),
      crm_campanas_agentes(agente_id, rol, objetivo_num, objetivo_valor)
    `)
    .eq("id", id)
    .single();
  if (errOrig || !original) throw errOrig ?? new Error("Campaña no encontrada");

  // 2. Crear nueva campaña
  const { data: nueva, error: errNueva } = await agencyDb
    .from("crm_campanas")
    .insert({
      nombre: `${original.nombre} (copia)`,
      descripcion: original.descripcion,
      tipo: original.tipo,
      estado: "planificada",
      fecha_inicio: original.fecha_inicio,
      fecha_fin: original.fecha_fin,
      oficina_id: original.oficina_id,
      created_by: usuarioId,
    })
    .select()
    .single();
  if (errNueva || !nueva) throw errNueva ?? new Error("Error creando campaña");

  // 3. Duplicar estados, guardando mapa id_viejo → id_nuevo
  const estadosOrdenados = [...(original.crm_campanas_estados ?? [])].sort((a: any, b: any) => a.orden - b.orden);
  const estadoIdMap: Record<string, string> = {};
  for (const e of estadosOrdenados) {
    const { data: nuevoEstado, error: errE } = await agencyDb
      .from("crm_campanas_estados")
      .insert({ campana_id: nueva.id, nombre: e.nombre, orden: e.orden, color: e.color, es_final: e.es_final, es_ganado: e.es_ganado })
      .select("id")
      .single();
    if (errE || !nuevoEstado) throw errE ?? new Error("Error creando estado");
    estadoIdMap[e.id] = nuevoEstado.id;
  }

  // 4. Duplicar agentes de la campaña
  if ((original.crm_campanas_agentes ?? []).length > 0) {
    const agentesPayload = (original.crm_campanas_agentes as any[]).map((a: any) => ({
      campana_id: nueva.id,
      agente_id: a.agente_id,
      rol: a.rol,
      objetivo_num: a.objetivo_num,
      objetivo_valor: a.objetivo_valor,
    }));
    await agencyDb.from("crm_campanas_agentes").insert(agentesPayload);
  }

  // 5. Si conContactos, copiar oportunidades respetando su estado actual
  if (conContactos) {
    const { data: ops, error: opsErr } = await agencyDb
      .from("crm_oportunidades")
      .select("titulo, entidad_id, contacto_id, agente_id, valor_estimado, prioridad, descripcion")
      .eq("campana_id", id);

    if (opsErr) throw opsErr;

    const primerEstadoNuevo = estadosOrdenados[0] ? estadoIdMap[estadosOrdenados[0].id] : null;
    if (ops && ops.length > 0) {
      const hoy = new Date().toISOString().split("T")[0];
      const opsPayload = ops.map((o: any) => ({
        campana_id: nueva.id,
        titulo: o.titulo,
        entidad_id: o.entidad_id,
        contacto_id: o.contacto_id,
        agente_id: o.agente_id,
        valor_estimado: o.valor_estimado,
        prioridad: o.prioridad,
        descripcion: o.descripcion,
        estado_id: primerEstadoNuevo,
        fecha_cierre_est: hoy,
      }));
      await agencyDb.from("crm_oportunidades").insert(opsPayload);
    }
  }

  revalidatePath("/campanas");
  return nueva;
}

// ─── ESTADOS DE CAMPAÑA ──────────────────────────────────────────────────────

export async function getEstadosCampana(campanaId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_campanas_estados")
    .select("*")
    .eq("campana_id", campanaId)
    .order("orden", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createEstadoCampana(campanaId: string, payload: {
  nombre: string;
  orden: number;
  color?: string;
  es_final?: boolean;
  es_ganado?: boolean;
}) {
  const { rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede gestionar estados");

  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_campanas_estados")
    .insert({ campana_id: campanaId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEstadoCampana(id: string, payload: Partial<{
  nombre: string;
  orden: number;
  color: string;
  es_final: boolean;
  es_ganado: boolean;
}>) {
  const { rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede gestionar estados");

  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_campanas_estados")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEstadoCampana(id: string) {
  const { rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede gestionar estados");

  const agencyDb = await getAgencyDbClient();
  // RESTRICT en FK: fallará si hay oportunidades en este estado (correcto)
  const { error } = await agencyDb.from("crm_campanas_estados").delete().eq("id", id);
  if (error) throw error;
}

// ─── AGENTES DE CAMPAÑA ──────────────────────────────────────────────────────

export async function getAgentesCampana(campanaId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_campanas_agentes")
    .select("*, crm_agentes!crm_campanas_agentes_agente_id_fkey(id, nombre, apellidos, avatar_url, rol)")
    .eq("campana_id", campanaId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertAgenteCampana(campanaId: string, payload: {
  agente_id: string;
  rol?: string;
  objetivo_num?: number;
  objetivo_valor?: number;
}) {
  const { usuarioId, rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede asignar agentes");

  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_campanas_agentes")
    .upsert(
      { campana_id: campanaId, ...payload, added_by: usuarioId },
      { onConflict: "campana_id,agente_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeAgenteCampana(campanaId: string, agenteId: string) {
  const { rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede gestionar agentes");

  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb
    .from("crm_campanas_agentes")
    .delete()
    .eq("campana_id", campanaId)
    .eq("agente_id", agenteId);
  if (error) throw error;
}

// ─── OPORTUNIDADES ───────────────────────────────────────────────────────────

export async function getOportunidades(campanaId?: string) {
  const { usuarioId, rol } = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();

  let query = agencyDb
    .from("crm_oportunidades")
    .select(`
      *,
      crm_campanas_estados(id, nombre, color, es_final, es_ganado),
      crm_agentes(id, nombre, apellidos, avatar_url),
      contabilidad_entidades!entidad_id(id, nombre, tipo_entidad, email, telefono, otros_tlfs, otros_emails, lat, lng, direccion, crm_contactos!entidad_id(id, nombre, cargo, telefono, email, metadatos)),
      crm_contactos!contacto_id(id, nombre, cargo, email, telefono)
    `)
    .order("created_at", { ascending: false });

  if (campanaId) {
    query = query.eq("campana_id", campanaId)
      .order("prioridad", { ascending: true, nullsFirst: false });
  }

  if (!isAdmin(rol)) {
    query = query.eq("agente_id", usuarioId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const oportunidades = data ?? [];

  if (campanaId && oportunidades.length > 0) {
    const entidadIds = [...new Set(oportunidades.map((o: any) => o.entidad_id).filter(Boolean))];
    const opIds = oportunidades.map((o: any) => o.id);

    const [
      campanaData,
      prevData,
      logsData,
      entidadesData,
    ] = await Promise.all([
      agencyDb.from("crm_campanas").select("created_at").eq("id", campanaId).single().then(r => r.data),
      agencyDb
        .from("crm_oportunidades")
        .select("id, entidad_id, campana_id, estado_id, descripcion, crm_campanas_estados!estado_id(id, nombre, color), crm_campanas!campana_id(nombre)")
        .in("entidad_id", entidadIds)
        .neq("campana_id", campanaId)
        .order("created_at", { ascending: false })
        .then(r => r.data ?? []),
      agencyDb
        .from("crm_oportunidades_estados_log")
        .select("oportunidad_id, estado_nuevo_id, notas, created_at")
        .in("oportunidad_id", opIds)
        .order("created_at", { ascending: false })
        .then(r => r.data ?? []),
      agencyDb
        .from("contabilidad_entidades")
        .select("id, metadatos")
        .in("id", entidadIds)
        .then(r => r.data ?? []),
    ]);

    const campanaCreatedAt = campanaData?.created_at ?? null;

    // Mapa de mig_centro_id → para la query de migración
    const centroIdByEntidad: Record<string, string> = {};
    for (const e of entidadesData as any[]) {
      const migCentroId = e.metadatos?.mig_centro_id;
      if (migCentroId) centroIdByEntidad[e.id] = migCentroId;
    }

    // Queries dependientes — en paralelo, sin la de logs previos (lenta con 500+ IDs)
    const campanaIdsEnResultado = [...new Set((prevData as any[]).map((r: any) => r.campana_id).filter(Boolean))];
    const centroIds = Object.values(centroIdByEntidad);

    const [campanasPrevData, migData] = await Promise.all([
      campanaIdsEnResultado.length > 0
        ? agencyDb.from("crm_campanas").select("id, created_at").in("id", campanaIdsEnResultado).then(r => r.data ?? [])
        : Promise.resolve([]),
      centroIds.length > 0
        ? agencyDb
            .from("mig_campanas_visita")
            .select("centro_id, notas")
            .in("centro_id", centroIds)
            .not("notas", "is", null)
            .order("updated_at", { ascending: false })
            .then(r => r.data ?? [])
        : Promise.resolve([]),
    ]);

;

    const campanaCreatedAtMap: Record<string, string> = {};
    for (const c of campanasPrevData as any[]) campanaCreatedAtMap[c.id] = c.created_at;

    const logByOp: Record<string, { notas: string | null; created_at: string }> = {};
    for (const log of logsData as any[]) {
      if (logByOp[log.oportunidad_id]) continue;
      const op = oportunidades.find((o: any) => o.id === log.oportunidad_id);
      if (op && log.estado_nuevo_id === op.estado_id) {
        logByOp[log.oportunidad_id] = { notas: log.notas, created_at: log.created_at };
      }
    }

    const migByCentro: Record<string, any> = {};
    for (const row of migData as any[]) {
      if (!migByCentro[row.centro_id]) migByCentro[row.centro_id] = row.notas;
    }
    const migNotasByEntidad: Record<string, any> = {};
    for (const [entidadId, centroId] of Object.entries(centroIdByEntidad)) {
      if (migByCentro[centroId]) migNotasByEntidad[entidadId] = migByCentro[centroId];
    }

    // La estrategia se extrae de descripcion en el frontend (limpiarDescripcionLegado)
    const seenCampana = new Set<string>();
    const prevByEntidad: Record<string, { nombre: string; color: string; descripcion: string | null; campana: string | null; estrategia: string | null; campanaCreatedAt: string | null }[]> = {};
    for (const row of prevData as any[]) {
      if (!row.entidad_id || !row.campana_id) continue;
      const rowCampanaDate = campanaCreatedAtMap[row.campana_id];
      if (campanaCreatedAt && rowCampanaDate && rowCampanaDate >= campanaCreatedAt) continue;
      const e = Array.isArray(row.crm_campanas_estados) ? row.crm_campanas_estados[0] : row.crm_campanas_estados;
      if (!e) continue;
      const key = `${row.entidad_id}:${row.campana_id}`;
      if (seenCampana.has(key)) continue;
      seenCampana.add(key);
      if (!prevByEntidad[row.entidad_id]) prevByEntidad[row.entidad_id] = [];
      prevByEntidad[row.entidad_id].push({
        nombre: e.nombre,
        color: e.color,
        descripcion: row.descripcion ?? null,
        campana: (Array.isArray(row.crm_campanas) ? row.crm_campanas[0] : row.crm_campanas)?.nombre ?? null,
        estrategia: null,
        campanaCreatedAt: campanaCreatedAtMap[row.campana_id] ?? null,
      });
    }

    return oportunidades.map((o: any) => ({
      ...o,
      estados_campanas_anteriores: prevByEntidad[o.entidad_id] ?? [],
      ultima_nota_log: logByOp[o.id]?.notas ?? null,
      fecha_ultimo_cambio_estado: logByOp[o.id]?.created_at ?? null,
      mig_notas: migNotasByEntidad[o.entidad_id] ?? null,
    }));
  }

  return oportunidades;
}

export async function getOportunidad(id: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_oportunidades")
    .select(`
      *,
      crm_campanas(id, nombre),
      crm_campanas_estados(id, nombre, color, es_final, es_ganado),
      crm_agentes(id, nombre, apellidos, avatar_url),
      contabilidad_entidades!entidad_id(id, nombre, tipo_entidad, documento, telefono, email),
      crm_contactos!contacto_id(id, nombre, cargo, email, telefono)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getHistorialEstados(oportunidadId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_oportunidades_estados_log")
    .select(`
      *,
      estado_anterior:crm_campanas_estados!estado_anterior_id(id, nombre, color),
      estado_nuevo:crm_campanas_estados!estado_nuevo_id(id, nombre, color),
      crm_agentes!cambiado_por(id, nombre, apellidos)
    `)
    .eq("oportunidad_id", oportunidadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createOportunidad(payload: {
  titulo: string;
  descripcion?: string;
  campana_id: string;
  entidad_id?: string;
  contacto_id?: string;
  agente_id?: string;
  estado_id: string;
  valor_estimado?: number;
  fecha_cierre_est?: string;
  origen?: string;
}) {
  const currentUser = await getCurrentUsuario();
  if (currentUser && currentUser.oficina_id) {
    if (currentUser.parametros?.permisos_radar_oportunidades?.crear === false) {
      throw new Error("No tienes permisos para crear oportunidades en este tenant.");
    }
  }

  const { usuarioId, rol } = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();

  // Si no es admin, el agente_id es siempre el suyo
  const agenteId = isAdmin(rol) ? (payload.agente_id ?? usuarioId) : usuarioId;

  const { data, error } = await agencyDb
    .from("crm_oportunidades")
    .insert({ ...payload, agente_id: agenteId })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/campanas");
  return data;
}

export async function updateOportunidad(id: string, payload: Partial<{
  titulo: string;
  descripcion: string;
  entidad_id: string;
  contacto_id: string;
  agente_id: string | null;
  valor_estimado: number;
  prioridad: number | null;
  fecha_cierre_est: string;
}>) {
  const currentUser = await getCurrentUsuario();
  if (currentUser && currentUser.oficina_id) {
    if (currentUser.parametros?.permisos_radar_oportunidades?.editar === false) {
      throw new Error("No tienes permisos para editar oportunidades en este tenant.");
    }
  }

  const { usuarioId, rol } = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();

  // Agente solo puede editar las suyas
  let query = agencyDb.from("crm_oportunidades").update(payload).eq("id", id);
  if (!isAdmin(rol)) query = query.eq("agente_id", usuarioId);

  const { data, error } = await query.select().single();
  if (error) throw error;
  revalidatePath("/campanas");
  return data;
}

export async function deleteOportunidad(id: string) {
  const currentUser = await getCurrentUsuario();
  if (currentUser && currentUser.oficina_id) {
    if (currentUser.parametros?.permisos_radar_oportunidades?.borrar === false) {
      throw new Error("No tienes permisos para borrar oportunidades en este tenant.");
    }
  }

  const { usuarioId, rol } = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();
  let query = agencyDb.from("crm_oportunidades").delete().eq("id", id);
  if (!isAdmin(rol)) query = (query as any).eq("agente_id", usuarioId);
  const { error } = await query;
  if (error) throw error;
  revalidatePath("/campanas");
}

export async function cambiarEstadoOportunidad(
  id: string,
  estadoId: string,
  notas?: string
) {
  const { usuarioId, rol } = await getCurrentAgente();
  const agencyDb = await getAgencyDbClient();

  // Obtener estado actual antes de actualizar
  const { data: current } = await agencyDb
    .from("crm_oportunidades")
    .select("estado_id")
    .eq("id", id)
    .single();

  const mismoEstado = current?.estado_id === estadoId;

  if (!mismoEstado) {
    // Pasar el agente que hace el cambio al trigger via variable de sesión
    await agencyDb.rpc("set_config", {
      setting_name: "app.current_agent_id",
      new_value: usuarioId,
      is_local: true,
    }).maybeSingle();

    let query = agencyDb
      .from("crm_oportunidades")
      .update({ estado_id: estadoId })
      .eq("id", id);

    if (!isAdmin(rol)) query = query.eq("agente_id", usuarioId);

    const { data, error } = await query.select().single();
    if (error) throw error;
  }

  // Siempre persistir las notas en el log del estado actual
  if (notas !== undefined) {
    const { data: logRow } = await agencyDb
      .from("crm_oportunidades_estados_log")
      .select("id")
      .eq("oportunidad_id", id)
      .eq("estado_nuevo_id", estadoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (logRow?.id) {
      await agencyDb
        .from("crm_oportunidades_estados_log")
        .update({ notas })
        .eq("id", logRow.id);
    } else {
      // No hay log para este estado (ej. oportunidad migrada): crear uno
      await agencyDb
        .from("crm_oportunidades_estados_log")
        .insert({ oportunidad_id: id, estado_nuevo_id: estadoId, cambiado_por: usuarioId, notas });
    }
  }

  revalidatePath("/campanas");

  const { data: updated } = await agencyDb
    .from("crm_oportunidades")
    .select()
    .eq("id", id)
    .single();
  return updated;
}

export async function convertirOportunidadAExpediente(
  oportunidadId: string,
  expedienteId: string
) {
  const { rol } = await getCurrentAgente();
  if (!isAdmin(rol)) throw new Error("Solo Admin puede convertir oportunidades");

  const agencyDb = await getAgencyDbClient();

  // Vincular en ambas direcciones
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    agencyDb
      .from("crm_oportunidades")
      .update({ expediente_id: expedienteId, convertida_at: new Date().toISOString() })
      .eq("id", oportunidadId),
    agencyDb
      .from("operativa_expedientes")
      .update({ oportunidad_id: oportunidadId })
      .eq("id", expedienteId),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;

  revalidatePath("/campanas");
  revalidatePath("/expedientes");
}

// ─── CONTACTOS ───────────────────────────────────────────────────────────────

export async function getContactos(entidadId?: string) {
  const agencyDb = await getAgencyDbClient();
  let query = agencyDb
    .from("crm_contactos")
    .select(`
      *,
      contabilidad_entidades!entidad_id(id, nombre, tipo_entidad)
    `)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (entidadId) query = query.eq("entidad_id", entidadId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getContacto(id: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_contactos")
    .select(`
      *,
      contabilidad_entidades!entidad_id(id, nombre, tipo_entidad),
      crm_contactos_organizaciones(
        id, entidad_id, fecha_inicio, fecha_fin, es_activa, motivo,
        contabilidad_entidades!entidad_id(id, nombre)
      )
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createContacto(payload: {
  nombre: string;
  entidad_id?: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  es_principal?: boolean;
  metadatos?: Record<string, unknown>;
}) {
  const agencyDb = await getAgencyDbClient();

  const { data: contacto, error } = await agencyDb
    .from("crm_contactos")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  // Si tiene entidad, registrar en historial de organizaciones
  if (payload.entidad_id) {
    await agencyDb.from("crm_contactos_organizaciones").insert({
      contacto_id: contacto.id,
      entidad_id: payload.entidad_id,
      fecha_inicio: new Date().toISOString().split("T")[0],
      es_activa: true,
    });
  }

  return contacto;
}

export async function updateContacto(id: string, payload: Partial<{
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  es_principal: boolean;
  activo: boolean;
  metadatos: Record<string, unknown>;
}>) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_contactos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cambiarOrganizacionContacto(
  contactoId: string,
  nuevaEntidadId: string,
  motivo?: string
) {
  const agencyDb = await getAgencyDbClient();

  // Insertar nueva relación — el trigger fn_crm_contacto_org_unica desactiva la anterior
  const { error } = await agencyDb.from("crm_contactos_organizaciones").insert({
    contacto_id: contactoId,
    entidad_id: nuevaEntidadId,
    fecha_inicio: new Date().toISOString().split("T")[0],
    es_activa: true,
    motivo: motivo ?? null,
  });
  if (error) throw error;
}

// ─── AGENTES (lectura para selectores UI) ────────────────────────────────────

export async function getAgentes() {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_agentes")
    .select("id, nombre, apellidos, avatar_url, rol")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ─── Historial completo de una entidad (todas sus campañas) ──────────────────

export async function getEntidadHistorial(entidadId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("crm_oportunidades")
    .select(`
      id, titulo, valor_estimado, prioridad,
      crm_campanas!campana_id(id, nombre, fecha_inicio, fecha_fin),
      crm_campanas_estados!estado_id(id, nombre, color, es_ganado, es_final),
      crm_agentes!agente_id(id, nombre, apellidos)
    `)
    .eq("entidad_id", entidadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEntidadResumen(entidadId: string) {
  const agencyDb = await getAgencyDbClient();
  const [presupuestosRes, expedientesRes, cotizacionesDirectasRes] = await Promise.all([
    agencyDb
      .from("operativa_presupuestos")
      .select("id, titulo_viaje, estado, tipo_presupuesto, pvp_estimado, fecha_salida_estimada, created_at")
      .eq("entidad_id", entidadId)
      .order("created_at", { ascending: false }),
    agencyDb
      .from("operativa_expedientes")
      .select("id, numero, referencia, estado, fecha_inicio, fecha_fin, pvp_total, created_at, operativa_cotizaciones(id, titulo, estado, pvp_viajero, plazas, total_ingresos, fecha_salida, created_at)")
      .eq("entidad_id", entidadId)
      .order("created_at", { ascending: false }),
    agencyDb
      .from("operativa_cotizaciones")
      .select("id, titulo, estado, pvp_viajero, plazas, total_ingresos, fecha_salida, created_at")
      .eq("contacto", entidadId)
      .order("created_at", { ascending: false }),
  ]);
  const expedientes = expedientesRes.data ?? [];
  const cotizacionesDeExpedientes = expedientes.flatMap((e: any) =>
    (e.operativa_cotizaciones ?? []).map((c: any) => ({ ...c, expediente_ref: e.numero || e.referencia?.slice(0, 20) }))
  );
  // Merge: cotizaciones directas (por contacto) + las de expedientes, sin duplicados
  const idsExpediente = new Set(cotizacionesDeExpedientes.map((c: any) => c.id));
  const cotizacionesDirectas = (cotizacionesDirectasRes.data ?? []).filter((c: any) => !idsExpediente.has(c.id));
  const cotizaciones = [...cotizacionesDeExpedientes, ...cotizacionesDirectas]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return {
    presupuestos: presupuestosRes.data ?? [],
    cotizaciones,
    expedientes,
  };
}
