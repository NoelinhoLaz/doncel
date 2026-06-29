"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

async function getDefaultTipoId(agencyDb: any): Promise<string | null> {
  const { data } = await agencyDb
    .from("config_tipos_servicios")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  return data?.id || null;
}export async function getCotizaciones() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_cotizaciones")
      .select("*, contabilidad_entidades!contacto(id, nombre), operativa_cotizacion_lineas(id, tipo, descripcion, plazas, noches, neto, pvp, total_neto, total_pvp, checked, opcional, maestro_destinos(id, nombre, nombre_comercial, lat, lng), contabilidad_proveedores!proveedor(id, nombre), config_tipos_servicios(id, etiqueta, icono, contenido))")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Load agent profiles
    let adminUsers: any[] = [];
    try {
      const adminServiceSupabase = createAdminServiceClient();
      const { data: users } = await adminServiceSupabase
        .from("usuarios")
        .select("id, auth_user_id, nombre, apellidos, avatar_url");
      adminUsers = users || [];
    } catch (dbErr) {
      console.warn("Could not load users for agent avatars:", dbErr);
    }

    // Collect all destination IDs from c.destinos across all quotes
    const allDestIds = new Set<string>();
    (data || []).forEach((c: any) => {
      const dests: any[] = c.destinos || [];
      dests.forEach((d: any) => {
        if (d && d.id) allDestIds.add(d.id);
      });
    });

    // Fetch lat/lng for these destination IDs
    const destCoordsMap = new Map<string, { lat: number; lng: number }>();
    if (allDestIds.size > 0) {
      const { data: coords, error: coordsErr } = await agencyDb
        .from("maestro_destinos")
        .select("id, lat, lng")
        .in("id", Array.from(allDestIds));
      if (!coordsErr && coords) {
        coords.forEach((item: any) => {
          if (item.lat != null && item.lng != null) {
            destCoordsMap.set(item.id, {
              lat: Number(item.lat),
              lng: Number(item.lng)
            });
          }
        });
      }
    }

    return (data || []).map((c: any) => {
      const lineas: any[] = c.operativa_cotizacion_lineas || [];
      const checked = lineas.filter((l: any) => l.checked !== false);
      const total_coste = checked.reduce((sum: number, l: any) => {
        return sum + Number(l.total_neto ?? (Number(l.neto || 0) * Number(l.plazas || 0) * Number(l.noches || 0)));
      }, 0);
      const total_ingresos = Number(c.pvp_viajero || 0) * Number(c.plazas || 0);
      const total_beneficio = total_ingresos - total_coste;
      const margen_beneficio = total_ingresos > 0 ? (total_beneficio / total_ingresos) * 100 : 0;

      // Extract unique destinations
      const uniqueDestinosMap = new Map();
      lineas.forEach((l: any) => {
        const d = l.maestro_destinos;
        if (d && d.id) {
          uniqueDestinosMap.set(d.id, d.nombre_comercial || d.nombre);
        }
      });
      const destinos_unicos = Array.from(uniqueDestinosMap.values());

      const agent = adminUsers.find(
        (u: any) => u.id === c.agente_id || u.auth_user_id === c.agente_id
      );
      const agente = agent
        ? {
            nombre: `${agent.nombre ?? ''} ${agent.apellidos ?? ''}`.trim(),
            iniciales: ((agent.nombre?.charAt(0) ?? '') + (agent.apellidos?.charAt(0) ?? '')).toUpperCase() || 'NC',
            avatar_url: agent.avatar_url ?? null,
          }
        : { nombre: 'Agente', iniciales: c.agente_id?.substring(0, 2).toUpperCase() ?? 'NC', avatar_url: null };

      // Map destinations with their coordinates
      const destinosWithCoords = (c.destinos || []).map((d: any) => {
        const coords = destCoordsMap.get(d.id);
        return {
          ...d,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null
        };
      });

      return { ...c, total_coste, total_ingresos, total_beneficio, margen_beneficio, agente, destinos_unicos, destinos: destinosWithCoords };
    });
  } catch (error: any) {
    console.error("Failed to get cotizaciones:", error.message);
    return [];
  }
}


export async function getAllCotizaciones() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_cotizaciones")
      .select("id, titulo, expediente_id, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to get all cotizaciones:", error.message);
    return [];
  }
}

export async function getCotizacionWithLineas(cotizacionId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: cotizacion, error: err1 } = await agencyDb
      .from("operativa_cotizaciones")
      .select("*, contabilidad_entidades!contacto(id, nombre)")
      .eq("id", cotizacionId)
      .single();

    if (err1) throw err1;

    const { data: lineas, error: err2 } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("*, maestro_destinos(id, nombre, nombre_comercial, lat, lng, admin_area_l2, admin_area_l1), config_tipos_servicios(id, etiqueta, icono, contenido), contabilidad_proveedores!proveedor(id, nombre, razon_social)")
      .eq("cotizacion_id", cotizacionId)
      .order("created_at", { ascending: true });

    if (err2) throw err2;

    return { ...cotizacion, operativa_cotizacion_lineas: lineas || [] };
  } catch (error: any) {
    console.error("Failed to load cotizacion with lineas:", error.message);
    return null;
  }
}

export async function createCotizacion(payload: {
  expediente_id?: string | null;
  titulo?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const insertObj: any = {};
    if (payload.expediente_id) insertObj.expediente_id = payload.expediente_id;
    if (payload.titulo) insertObj.titulo = payload.titulo;

    // Capture creating agent
    try {
      const adminSupabase = await createAdminServerClient();
      const { data: { user } } = await adminSupabase.auth.getUser();
      if (user?.id) insertObj.agente_id = user.id;
    } catch {
      // non-blocking
    }

    const { data, error } = await agencyDb
      .from("operativa_cotizaciones")
      .insert([insertObj])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to create cotizacion:", error.message);
    throw new Error(error.message || "Failed to create cotizacion");
  }
}

export async function createCotizacionLinea(payload: {
  cotizacion_id: string;
  tipo?: string;
  descripcion?: string;
  proveedor?: string;
  destino?: string;
  plazas?: number | null;
  noches?: number | null;
  neto?: number | null;
  pvp?: number | null;
  total_neto?: number | null;
  total_pvp?: number | null;
  detalles?: any;
  opcional?: boolean;
  grupo_alternativa_id?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const tipoId = payload.tipo?.trim() ? payload.tipo : await getDefaultTipoId(agencyDb);
    if (!tipoId) throw new Error("No hay tipos de servicio disponibles");

    const insertObj: any = {
      cotizacion_id: payload.cotizacion_id,
      tipo: tipoId,
      descripcion: payload.descripcion || "",
      proveedor: payload.proveedor || null,
      destino: payload.destino || null,
      plazas: payload.plazas ?? null,
      noches: payload.noches ?? null,
      neto: payload.neto ?? 0,
      pvp: payload.pvp ?? 0,
      total_neto: payload.total_neto ?? 0,
      total_pvp: payload.total_pvp ?? 0,
      detalles: payload.detalles ?? {},
    };
    if (payload.opcional !== undefined) insertObj.opcional = payload.opcional;
    if (payload.grupo_alternativa_id !== undefined) insertObj.grupo_alternativa_id = payload.grupo_alternativa_id;

    const { data, error } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .insert([insertObj])
      .select("*, maestro_destinos(id, nombre, nombre_comercial, lat, lng, admin_area_l2, admin_area_l1), config_tipos_servicios(id, etiqueta, icono, contenido), contabilidad_proveedores!proveedor(id, nombre, razon_social)")
      .single();

    if (error) throw error;
    revalidatePath("/cotizaciones");
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to create cotizacion linea:", error.message);
    throw new Error(error.message || "Failed to create cotizacion linea");
  }
}

export async function updateCotizacionLinea(id: string, payload: {
  tipo?: string;
  descripcion?: string;
  proveedor?: string;
  destino?: string;
  plazas?: number | null;
  noches?: number | null;
  neto?: number | null;
  pvp?: number | null;
  total_neto?: number | null;
  total_pvp?: number | null;
  detalles?: any;
  checked?: boolean;
  grupo_alternativa_id?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const updatePayload: any = {};
    if (payload.tipo !== undefined) updatePayload.tipo = payload.tipo;
    if (payload.descripcion !== undefined) updatePayload.descripcion = payload.descripcion;
    if (payload.proveedor !== undefined) updatePayload.proveedor = payload.proveedor;
    if (payload.destino !== undefined) updatePayload.destino = payload.destino;
    if (payload.plazas !== undefined) updatePayload.plazas = payload.plazas;
    if (payload.noches !== undefined) updatePayload.noches = payload.noches;
    if (payload.neto !== undefined) updatePayload.neto = payload.neto;
    if (payload.pvp !== undefined) updatePayload.pvp = payload.pvp;
    if (payload.total_neto !== undefined) updatePayload.total_neto = payload.total_neto;
    if (payload.total_pvp !== undefined) updatePayload.total_pvp = payload.total_pvp;
    if (payload.detalles !== undefined) updatePayload.detalles = payload.detalles;
    if (payload.checked !== undefined) updatePayload.checked = payload.checked;
    if (payload.grupo_alternativa_id !== undefined) updatePayload.grupo_alternativa_id = payload.grupo_alternativa_id;

    if (Object.keys(updatePayload).length === 0) return { success: true, data: null };

    const { data, error } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .update(updatePayload)
      .eq("id", id)
      .select("*, maestro_destinos(id, nombre, nombre_comercial, lat, lng, admin_area_l2, admin_area_l1), config_tipos_servicios(id, etiqueta, icono, contenido), contabilidad_proveedores!proveedor(id, nombre, razon_social)")
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update cotizacion linea:", error.message);
    throw new Error(error.message || "Failed to update cotizacion linea");
  }
}

export async function deleteCotizacionLinea(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .delete()
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/cotizaciones");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete cotizacion linea:", error.message);
    throw new Error(error.message || "Failed to delete cotizacion linea");
  }
}

export async function updateCotizacionMeta(cotizacionId: string, payload: { titulo?: string; contacto?: string | null; fecha_salida?: string | null; fecha_regreso?: string | null; pvp_viajero?: number | null; plazas?: number | null; free?: number | null }) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_cotizaciones")
      .update(payload)
      .eq("id", cotizacionId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update cotizacion meta:", error.message);
    throw new Error(error.message);
  }
}

export async function addDestinoCotizacion(cotizacionId: string, destino: { id: string; nombre: string }) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data: current, error: fetchError } = await agencyDb
      .from("operativa_cotizaciones")
      .select("destinos")
      .eq("id", cotizacionId)
      .single();
    if (fetchError) throw fetchError;

    const existing: any[] = current?.destinos || [];
    if (existing.some((d: any) => d.id === destino.id)) return { success: true, destinos: existing };

    const updated = [...existing, destino];
    const { error } = await agencyDb
      .from("operativa_cotizaciones")
      .update({ destinos: updated })
      .eq("id", cotizacionId);
    if (error) throw error;

    return { success: true, destinos: updated };
  } catch (error: any) {
    console.error("Failed to add destino to cotizacion:", error.message);
    throw new Error(error.message);
  }
}

export async function removeDestinoCotizacion(cotizacionId: string, destinoId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data: current, error: fetchError } = await agencyDb
      .from("operativa_cotizaciones")
      .select("destinos")
      .eq("id", cotizacionId)
      .single();
    if (fetchError) throw fetchError;

    const updated = (current?.destinos || []).filter((d: any) => d.id !== destinoId);
    const { error } = await agencyDb
      .from("operativa_cotizaciones")
      .update({ destinos: updated })
      .eq("id", cotizacionId);
    if (error) throw error;

    return { success: true, destinos: updated };
  } catch (error: any) {
    console.error("Failed to remove destino from cotizacion:", error.message);
    throw new Error(error.message);
  }
}

export async function deleteCotizacion(cotizacionId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    // Lines deleted by cascade if FK is set; delete explicitly to be safe
    await agencyDb.from("operativa_cotizacion_lineas").delete().eq("cotizacion_id", cotizacionId);
    const { error } = await agencyDb.from("operativa_cotizaciones").delete().eq("id", cotizacionId);
    if (error) throw error;
    revalidatePath("/cotizaciones");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}

export async function duplicateCotizacion(cotizacionId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: orig, error: e1 } = await agencyDb
      .from("operativa_cotizaciones")
      .select("titulo, expediente_id, pvp_viajero, plazas, free")
      .eq("id", cotizacionId)
      .single();
    if (e1) throw e1;

    const { data: newCot, error: e2 } = await agencyDb
      .from("operativa_cotizaciones")
      .insert([{ titulo: `${orig.titulo || 'Cotización'} (copia)`, expediente_id: orig.expediente_id || null, pvp_viajero: orig.pvp_viajero, plazas: orig.plazas, free: orig.free }])
      .select()
      .single();
    if (e2) throw e2;

    const { data: lineas, error: e3 } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("tipo, descripcion, proveedor, destino, plazas, noches, neto, pvp, total_neto, total_pvp, opcional, detalles, checked, grupo_alternativa_id")
      .eq("cotizacion_id", cotizacionId)
      .order("created_at", { ascending: true });
    if (e3) throw e3;

    if (lineas && lineas.length > 0) {
      const newLineas = lineas.map((l: any) => ({ ...l, cotizacion_id: newCot.id }));
      const { error: e4 } = await agencyDb.from("operativa_cotizacion_lineas").insert(newLineas);
      if (e4) throw e4;
    }

    revalidatePath("/cotizaciones");
    return { success: true, data: newCot };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}

export async function getCotizacionLineasToCopy(cotizacionId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("id, tipo, descripcion, proveedor, contabilidad_proveedores!proveedor(nombre, razon_social), destino, plazas, noches, neto, pvp, total_neto, total_pvp, opcional, detalles")
      .eq("cotizacion_id", cotizacionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map((l: any) => ({
      ...l,
      proveedor_nombre: l.contabilidad_proveedores?.nombre || l.contabilidad_proveedores?.razon_social || l.proveedor || "",
    }));
  } catch (error: any) {
    console.error("Failed to get cotizacion lineas:", error.message);
    return [];
  }
}
