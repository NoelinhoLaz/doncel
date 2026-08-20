"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentUsuario } from "@/actions/usuarios";

export async function getTopProveedores() {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: usageData } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("proveedor");

    const freqMap: Record<string, number> = {};
    if (usageData) {
      usageData.forEach((row: any) => {
        const name = row.proveedor?.trim().toLowerCase();
        if (name) freqMap[name] = (freqMap[name] || 0) + 1;
      });
    }

    const { data: allProv, error: provError } = await agencyDb
      .from("contabilidad_proveedores")
      .select("*");

    if (provError) throw provError;
    if (!allProv || allProv.length === 0) return [];

    const sorted = [...allProv].sort((a: any, b: any) => {
      const freqA = freqMap[a.nombre?.trim().toLowerCase()] || 0;
      const freqB = freqMap[b.nombre?.trim().toLowerCase()] || 0;
      if (freqA !== freqB) return freqB - freqA;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });

    return sorted.slice(0, 5);
  } catch (error: any) {
    console.error("Failed to get top proveedores:", error.message);
    return [];
  }
}

export async function getAllProveedores() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .select("id, nombre, razon_social");
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to get all proveedores:", error.message);
    return [];
  }
}

export async function getProveedorById(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .select("id, nombre, razon_social")
      .eq("id", id)
      .single();
    if (error) return null;
    return data;
  } catch (error: any) {
    console.error("Failed to get proveedor by id:", error.message);
    return null;
  }
}

export async function searchProveedores(searchQuery: string) {
  try {
    if (!searchQuery || searchQuery.trim().length < 3) return [];
    const agencyDb = await getAgencyDbClient();
    const cleanQuery = searchQuery.trim().toLowerCase();

    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .select("*")
      .or(`nombre.ilike.%${cleanQuery}%,razon_social.ilike.%${cleanQuery}%,"CIF".ilike.%${cleanQuery}%,cuenta_contable.ilike.%${cleanQuery}%`);

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to search proveedores:", error.message);
    return [];
  }
}

export async function getProveedorResumen(proveedorId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const [cotizacionesRes, expedientesRes, pagosRes] = await Promise.all([
      agencyDb
        .from("operativa_cotizacion_lineas")
        .select("id, descripcion, tipo, neto, pvp, plazas, noches, cotizacion_id, operativa_cotizaciones(id, titulo, estado, fecha_salida), config_tipos_servicios(id, etiqueta, icono)")
        .eq("proveedor", proveedorId)
        .order("id", { ascending: false }),
      agencyDb
        .from("operativa_expedientes_servicios")
        .select("id, descripcion, tipo, neto, pvp, plazas, noches, opcional, created_at, expediente_id")
        .eq("proveedor", proveedorId)
        .order("created_at", { ascending: false }),
      agencyDb
        .from("contabilidad_movimientos")
        .select("id, tipo, importe_total, concepto, fecha, estado, expediente_id")
        .eq("proveedor_id", proveedorId)
        .eq("tipo", "pago")
        .eq("estado", "confirmado")
        .order("fecha", { ascending: false, nullsFirst: false }),
    ]);

    if (cotizacionesRes.error) console.error("Failed to get cotizaciones for proveedor:", cotizacionesRes.error.message);
    if (expedientesRes.error) console.error("Failed to get expedientes for proveedor:", expedientesRes.error.message);
    if (pagosRes.error) console.error("Failed to get pagos for proveedor:", pagosRes.error.message);

    const cotizaciones = cotizacionesRes.data ?? [];
    const servicios = expedientesRes.data ?? [];
    const pagos = pagosRes.data ?? [];

    const expedienteIds = [...new Set(servicios.map((s: any) => s.expediente_id).filter(Boolean))];
    let expedientesPorId = new Map<string, any>();
    if (expedienteIds.length > 0) {
      const { data: expData, error: expError } = await agencyDb
        .from("operativa_expedientes")
        .select("id, numero, referencia, estado, contabilidad_entidades(nombre)")
        .in("id", expedienteIds);
      if (expError) console.error("Failed to get expedientes detalle for proveedor:", expError.message);
      expedientesPorId = new Map((expData ?? []).map((e: any) => [e.id, e]));
    }
    const serviciosConExpediente = servicios.map((s: any) => ({
      ...s,
      operativa_expedientes: expedientesPorId.get(s.expediente_id) ?? null,
    }));

    const totalPagado = pagos.reduce((sum: number, p: any) => sum + Number(p.importe_total || 0), 0);

    return { cotizaciones, servicios: serviciosConExpediente, pagos, totalPagado };
  } catch (error: any) {
    console.error("Failed to get proveedor resumen:", error.message);
    return { cotizaciones: [], servicios: [], pagos: [], totalPagado: 0 };
  }
}

export async function updateProveedor(proveedorId: string, payload: {
  nombre?: string;
  razon_social?: string | null;
  cif?: string | null;
  tipo?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  localidad?: string | null;
  comunidad?: string | null;
  pais?: string | null;
  nombre_contacto?: string | null;
  cargo?: string | null;
  observaciones?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .update({
        nombre: payload.nombre,
        razon_social: payload.razon_social || null,
        "CIF": payload.cif || null,
        tipo: payload.tipo || null,
        email: payload.email || null,
        telefono: payload.telefono || null,
        direccion: payload.direccion || null,
        codigo_postal: payload.codigo_postal || null,
        localidad: payload.localidad || null,
        comunidad: payload.comunidad || null,
        pais: payload.pais || null,
        nombre_contacto: payload.nombre_contacto || null,
        cargo: payload.cargo || null,
        observaciones: payload.observaciones || null,
      })
      .eq("id", proveedorId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update proveedor:", error.message);
    return { success: false, error: error.message || "Failed to update proveedor" };
  }
}

export async function updateProveedorAlias(proveedorId: string, alias: string[]) {
  try {
    const agencyDb = await getAgencyDbClient();
    const limpios = [...new Set(alias.map((a) => a.trim()).filter(Boolean))];
    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .update({ alias: limpios })
      .eq("id", proveedorId)
      .select("id, alias")
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update proveedor alias:", error.message);
    return { success: false, error: error.message || "Failed to update proveedor alias" };
  }
}

export async function createProveedor(payload: {
  id?: string;
  nombre: string;
  razon_social?: string;
  cif?: string;
  cuenta_contable?: string;
  tipo?: string;
  observaciones?: string;
}) {
  try {
    const currentUser = await getCurrentUsuario();
    if (currentUser && currentUser.oficina_id) {
      const allowed = currentUser.parametros?.permisos_studio_proveedores?.crear;
      if (allowed === false) {
        throw new Error("No tienes permisos para crear proveedores en este tenant.");
      }
    }

    const agencyDb = await getAgencyDbClient();
    const newId = payload.id || Math.random().toString(36).substring(2, 11).toUpperCase();

    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .insert([{
        id: newId,
        nombre: payload.nombre,
        razon_social: payload.razon_social || null,
        "CIF": payload.cif || null,
        cuenta_contable: payload.cuenta_contable || null,
        tipo: payload.tipo || null,
        observaciones: payload.observaciones || null,
        creado_en: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to create proveedor:", error.message);
    throw new Error(error.message || "Failed to create proveedor");
  }
}
