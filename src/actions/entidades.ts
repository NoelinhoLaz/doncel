"use server";

import { getAgencyDbClient, getAuthUserId } from "@/lib/agencyDb";
import { getCurrentUsuario } from "@/actions/usuarios";
import { SIN_AGENTE_ID } from "@/lib/filtrosClientes";

async function getCurrentAgenteId(agencyDb: Awaited<ReturnType<typeof getAgencyDbClient>>) {
  const authUserId = await getAuthUserId();
  if (!authUserId) return null;
  const { data } = await agencyDb
    .from("crm_agentes")
    .select("id")
    .eq("auth_uid", authUserId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getEntidades() {
  try {
    const agencyDb = await getAgencyDbClient();
    const pageSize = 1000;
    let from = 0;
    let all: any[] = [];
    while (true) {
      const { data, error } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre, documento, email, telefono, roles, metadatos, direccion, tipo_cliente_id, config_tipos_cliente:tipo_cliente_id(id, etiqueta)")
        .order("nombre", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Error fetching entidades:", error);
        throw error;
      }
      all = all.concat(data ?? []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    return all;
  } catch (error: any) {
    console.error("Failed to get entidades:", error.message);
    throw new Error(error.message || "Failed to fetch entidades");
  }
}

export async function reasignarAgenteMasivo(entidadIds: string[], agenteId: string) {
  if (entidadIds.length === 0) return { success: true, count: 0 };
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("contabilidad_entidades")
      .update({ agente_id: agenteId })
      .in("id", entidadIds);
    if (error) throw error;
    return { success: true, count: entidadIds.length };
  } catch (error: any) {
    console.error("Failed to reasignar agente masivo:", error.message);
    return { success: false, error: error.message };
  }
}

export async function buscarEntidadPorDocumento(documento: string) {
  try {
    const doc = documento.trim().toUpperCase();
    if (!doc) return null;
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_entidades")
      .select("id, nombre, documento, email, telefono, tipo_entidad, roles")
      .eq("documento", doc)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } catch (error: any) {
    console.error("Failed to buscar entidad por documento:", error.message);
    return null;
  }
}

export async function createEntidad(nombre: string) {
  try {
    const currentUser = await getCurrentUsuario();
    if (currentUser && currentUser.oficina_id) {
      const allowed = currentUser.parametros?.permisos_studio_clientes?.crear;
      if (allowed === false) {
        throw new Error("No tienes permisos para registrar clientes en este tenant.");
      }
    }

    const agencyDb = await getAgencyDbClient();
    const agenteId = await getCurrentAgenteId(agencyDb);
    const { data, error } = await agencyDb
      .from("contabilidad_entidades")
      .insert([{ nombre: nombre.trim(), agente_id: agenteId }])
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
    direccion?: string;
    cp?: string;
    ciudad?: string;
    provincia?: string;
  };
}) {
  try {
    const currentUser = await getCurrentUsuario();
    if (currentUser && currentUser.oficina_id) {
      const allowed = currentUser.parametros?.permisos_studio_clientes?.crear;
      if (allowed === false) {
        throw new Error("No tienes permisos para registrar clientes en este tenant.");
      }
    }

    const agencyDb = await getAgencyDbClient();
    const agenteId = await getCurrentAgenteId(agencyDb);
    const { data, error } = await agencyDb
      .from("contabilidad_entidades")
      .insert([{
        nombre: payload.nombre.trim(),
        email: payload.email?.trim() || null,
        direccion: payload.direccion || null,
        roles: { contacto: true },
        agente_id: agenteId
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

export async function buscarEntidades(query: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_entidades")
      .select("id, nombre, direccion, email")
      .ilike("nombre", `%${query.trim()}%`)
      .order("nombre", { ascending: true })
      .limit(30);

    if (error) {
      console.error("Error searching entidades:", error);
      throw error;
    }

    return (data || []).map((e: any) => ({
      id: e.id,
      nombre: e.nombre,
      localidad: e.direccion?.ciudad || null,
      email: e.email || null,
    }));
  } catch (error: any) {
    console.error("Failed to search entidades:", error.message);
    return [];
  }
}

export type EntidadBusquedaAvanzada = {
  id: string;
  nombre: string;
  localidad: string | null;
  email: string | null;
  sucursal: string | null;
  agenteId: string | null;
  agenteNombre: string | null;
  tipoClienteId: string | null;
  tipoClienteEtiqueta: string | null;
};

// Búsqueda con filtros (sucursal/agente/tipo de cliente) usada en el buscador
// de "Añadir oportunidad" — a diferencia de buscarEntidades() (solo texto),
// esta permite listar TODOS los clientes de la agencia que cumplan los
// filtros, sin exigir texto de búsqueda.
export async function buscarEntidadesAvanzado(filtros: {
  query?: string;
  agenteIds?: string[]; // puede incluir SIN_AGENTE_ID
  tipoClienteIds?: string[];
  excluirIds?: string[];
}) {
  try {
    const agencyDb = await getAgencyDbClient();

    let q = agencyDb
      .from("contabilidad_entidades")
      .select("id, nombre, direccion, email, agente_id, tipo_cliente_id, config_tipos_cliente:tipo_cliente_id(id, etiqueta)")
      .order("nombre", { ascending: true })
      .limit(500);

    if (filtros.query?.trim()) {
      q = q.ilike("nombre", `%${filtros.query.trim()}%`);
    }

    const agenteIds = filtros.agenteIds ?? [];
    const quiereSinAgente = agenteIds.includes(SIN_AGENTE_ID);
    const agenteIdsReales = agenteIds.filter((id) => id !== SIN_AGENTE_ID);
    if (agenteIds.length > 0) {
      if (quiereSinAgente && agenteIdsReales.length > 0) {
        q = q.or(`agente_id.is.null,agente_id.in.(${agenteIdsReales.join(",")})`);
      } else if (quiereSinAgente) {
        q = q.is("agente_id", null);
      } else {
        q = q.in("agente_id", agenteIdsReales);
      }
    }

    if (filtros.tipoClienteIds && filtros.tipoClienteIds.length > 0) {
      q = q.in("tipo_cliente_id", filtros.tipoClienteIds);
    }

    if (filtros.excluirIds && filtros.excluirIds.length > 0) {
      q = q.not("id", "in", `(${filtros.excluirIds.join(",")})`);
    }

    const { data, error } = await q;
    if (error) {
      console.error("Error searching entidades (avanzado):", error);
      throw error;
    }

    // Oficina/sucursal de cada agente (vía config_usuarios -> config_oficinas)
    const [{ data: agentesRows }, { data: configUsuarios }, { data: oficinas }] = await Promise.all([
      agencyDb.from("crm_agentes").select("id, nombre, apellidos"),
      agencyDb.from("config_usuarios").select("usuario_id, oficina"),
      agencyDb.from("config_oficinas").select("id, nombre"),
    ]);
    const oficinaNombrePorId = new Map((oficinas ?? []).map((o: any) => [o.id, o.nombre]));
    const oficinaIdPorAgente = new Map((configUsuarios ?? []).map((cu: any) => [cu.usuario_id, cu.oficina]));
    const agentePorId = new Map((agentesRows ?? []).map((a: any) => [a.id, a]));

    return (data || []).map((e: any): EntidadBusquedaAvanzada => {
      const agente = e.agente_id ? agentePorId.get(e.agente_id) : null;
      const oficinaId = e.agente_id ? oficinaIdPorAgente.get(e.agente_id) : null;
      return {
        id: e.id,
        nombre: e.nombre,
        localidad: e.direccion?.ciudad || null,
        email: e.email || null,
        sucursal: oficinaId ? (oficinaNombrePorId.get(oficinaId) ?? null) : null,
        agenteId: e.agente_id ?? null,
        agenteNombre: agente ? `${agente.nombre} ${agente.apellidos ?? ""}`.trim() : null,
        tipoClienteId: e.tipo_cliente_id ?? null,
        tipoClienteEtiqueta: e.config_tipos_cliente?.etiqueta ?? null,
      };
    });
  } catch (error: any) {
    console.error("Failed to search entidades (avanzado):", error.message);
    return [];
  }
}

// Agentes de la agencia con su sucursal, para poblar el filtro del buscador
// de oportunidades (mismo shape que AgenteOpcion de SucursalAgenteFilter).
export async function getAgentesConSucursal() {
  try {
    const agencyDb = await getAgencyDbClient();
    const [{ data: agentesRows }, { data: configUsuarios }, { data: oficinas }] = await Promise.all([
      agencyDb.from("crm_agentes").select("id, nombre, apellidos"),
      agencyDb.from("config_usuarios").select("usuario_id, oficina"),
      agencyDb.from("config_oficinas").select("id, nombre"),
    ]);
    const oficinaNombrePorId = new Map((oficinas ?? []).map((o: any) => [o.id, o.nombre]));
    const oficinaIdPorAgente = new Map((configUsuarios ?? []).map((cu: any) => [cu.usuario_id, cu.oficina]));

    return (agentesRows ?? [])
      .map((a: any) => {
        const oficinaId = oficinaIdPorAgente.get(a.id);
        return {
          id: a.id,
          nombre: `${a.nombre} ${a.apellidos ?? ""}`.trim(),
          sucursal: oficinaId ? (oficinaNombrePorId.get(oficinaId) ?? null) : null,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  } catch (error: any) {
    console.error("Failed to get agentes con sucursal:", error.message);
    return [];
  }
}

// Tipos de cliente configurados por la agencia (para el filtro del buscador de oportunidades)
export async function getTiposClienteOptions() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_tipos_cliente")
      .select("id, etiqueta")
      .order("etiqueta", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (error: any) {
    console.error("Failed to get tipos cliente:", error.message);
    return [];
  }
}


