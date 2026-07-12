"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

// UUID_REGEX lives here: createExpedienteServicio and createGroupedExpedienteServicio use it
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getExpedienteServicios(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("*, lineas:operativa_expediente_servicio_lineas(*)")
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const servicios = data || [];
    const servicioIds = servicios.map((s: any) => s.id).filter(Boolean);

    const abonoMap = new Map<string, number>();
    if (servicioIds.length > 0) {
      const { data: abonos } = await agencyDb
        .from("v_abonados_servicios")
        .select("servicio_id, total_abonado")
        .in("servicio_id", servicioIds);
      if (abonos) {
        for (const a of abonos) abonoMap.set(a.servicio_id, Number(a.total_abonado || 0));
      }
    }

    const { data: movimientos } = await agencyDb
      .from("contabilidad_movimientos")
      .select("id, importe_total, concepto, created_at, movimiento_banco_id, medio_pago")
      .eq("tipo", "pago")
      .eq("estado", "confirmado")
      .eq("expediente_id", expedienteId);

    const bancoIds = [...new Set((movimientos || []).map((m: any) => m.movimiento_banco_id).filter(Boolean))];
    const bancosPorId = new Map<string, any>();
    if (bancoIds.length > 0) {
      const { data: bancos } = await agencyDb
        .from("contabilidad_movimientos_banco")
        .select("id, fecha_operacion, concepto_original, importe, match_metadatos")
        .in("id", bancoIds);
      for (const b of (bancos || [])) bancosPorId.set(b.id, b);
    }

    const result = servicios.map((s: any) => {
      const docId = s.documento_id;
      const seen = new Set<string>();
      const movsVinculados: any[] = [];

      for (const m of (movimientos || [])) {
        const banco = bancosPorId.get(m.movimiento_banco_id);
        if (!banco) continue;
        const mm = banco.match_metadatos;
        if (!mm) continue;

        let linked = false;
        if (mm.servicio_id === s.id) linked = true;
        else if (docId && mm.pagos) linked = mm.pagos.some((p: any) => p.documento_id === docId);
        else if (mm.origen === "servicio" && mm.pagos && s.lineas) {
          const lineaIds = new Set((s.lineas || []).map((l: any) => l.cotizacion_linea_id).filter(Boolean));
          linked = mm.pagos.some((p: any) => lineaIds.has(p.id));
        }
        if (linked && !seen.has(banco.id)) {
          seen.add(banco.id);
          movsVinculados.push({
            id: banco.id,
            importe: Math.abs(Number(banco.importe || 0)),
            fecha: banco.fecha_operacion,
            concepto: banco.concepto_original || m.concepto,
            medio_pago: m.medio_pago,
          });
        }
      }

      return { ...s, abonado: abonoMap.get(s.id) || 0, pagos: movsVinculados };
    });

    return result;
  } catch (error: any) {
    console.error("Failed to get expediente servicios:", error.message);
    return [];
  }
}

export async function createExpedienteServicio(payload: {
  expediente_id: string;
  tipo: string;
  proveedor: string;
  descripcion: string;
  neto: number;
  pvp: number;
  condiciones?: any[];
  opcional: boolean;
  minimo_plazas?: number | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    let proveedor = payload.proveedor;
    if (proveedor && UUID_REGEX.test(proveedor)) {
      const { data: prov } = await agencyDb
        .from("contabilidad_proveedores")
        .select("nombre, razon_social")
        .eq("id", proveedor)
        .maybeSingle();
      if (prov) proveedor = prov.nombre || prov.razon_social || proveedor;
    }

    const { data, error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .insert([{
        expediente_id: payload.expediente_id,
        tipo: payload.tipo,
        proveedor,
        descripcion: payload.descripcion,
        neto: payload.neto,
        pvp: payload.pvp,
        condiciones: payload.condiciones || [],
        opcional: payload.opcional,
        minimo_plazas: payload.opcional ? (payload.minimo_plazas || null) : null,
      }])
      .select()
      .single();

    if (error) throw error;
    revalidatePath(`/expedientes/${payload.expediente_id}`);
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to create expediente servicio:", error.message);
    throw new Error(error.message || "Failed to create expediente servicio");
  }
}

export async function createGroupedExpedienteServicio(payload: {
  expediente_id: string;
  tipo: string;
  proveedor: string;
  descripcion: string;
  neto: number;
  pvp: number;
  total: number;
  condiciones?: any[];
  opcional: boolean;
  minimo_plazas?: number | null;
  documento_id?: string | null;
  origenes: Array<{
    cotizacion_linea_id?: string | null;
    tipo: string;
    descripcion: string;
    neto: number;
    pvp: number;
  }>;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    let proveedor = payload.proveedor;
    if (proveedor && UUID_REGEX.test(proveedor)) {
      const { data: prov } = await agencyDb
        .from("contabilidad_proveedores")
        .select("nombre, razon_social")
        .eq("id", proveedor)
        .maybeSingle();
      if (prov) proveedor = prov.nombre || prov.razon_social || proveedor;
    }

    const { data: servicio, error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .insert([{
        expediente_id: payload.expediente_id,
        tipo: payload.tipo,
        proveedor,
        descripcion: payload.descripcion,
        neto: payload.neto,
        pvp: payload.pvp,
        total: payload.total,
        plazas: 1,
        condiciones: payload.condiciones || [],
        opcional: payload.opcional,
        minimo_plazas: payload.opcional ? (payload.minimo_plazas || null) : null,
        documento_id: payload.documento_id || null,
      }])
      .select()
      .single();

    if (error) throw error;

    if (payload.origenes.length > 0) {
      const { error: err2 } = await agencyDb
        .from("operativa_expediente_servicio_lineas")
        .insert(payload.origenes.map((o) => ({
          servicio_id: servicio.id,
          cotizacion_linea_id: o.cotizacion_linea_id || null,
          tipo: o.tipo,
          descripcion: o.descripcion,
          neto: o.neto,
          pvp: o.pvp,
        })));
      if (err2) throw err2;
    }

    if (payload.documento_id) {
      await agencyDb
        .from("operativa_documentos_lineas")
        .update({ expediente_id: payload.expediente_id })
        .eq("documento_id", payload.documento_id);

      const { error: errLink } = await agencyDb
        .from("operativa_documentos_expedientes")
        .insert({
          documento_id: payload.documento_id,
          expediente_id: payload.expediente_id,
          es_principal: true,
        });

      if (errLink) console.error("[Link Documento] Error al vincular documento con expediente:", errLink);
    }

    revalidatePath(`/expedientes/${payload.expediente_id}`);
    return { success: true, data: servicio };
  } catch (error: any) {
    console.error("Failed to create grouped expediente servicio:", error.message);
    throw new Error(error.message || "Failed to create grouped expediente servicio");
  }
}

export async function deleteExpedienteServicio(id: string, expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .delete()
      .eq("id", id);

    if (error) throw error;
    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete expediente servicio:", error.message);
    throw new Error(error.message || "Failed to delete expediente servicio");
  }
}

export async function updateExpedienteServicio(id: string, payload: {
  tipo?: string;
  proveedor?: string;
  descripcion?: string;
  neto?: number;
  pvp?: number;
  plazas?: number;
  total?: number;
  opcional?: boolean;
  minimo_plazas?: number | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const updatePayload: any = {};
    if (payload.tipo !== undefined) updatePayload.tipo = payload.tipo;
    if (payload.proveedor !== undefined) updatePayload.proveedor = payload.proveedor;
    if (payload.descripcion !== undefined) updatePayload.descripcion = payload.descripcion;
    if (payload.neto !== undefined) updatePayload.neto = payload.neto;
    if (payload.pvp !== undefined) updatePayload.pvp = payload.pvp;
    if (payload.plazas !== undefined) updatePayload.plazas = payload.plazas;
    if (payload.total !== undefined) updatePayload.total = payload.total;
    if (payload.opcional !== undefined) updatePayload.opcional = payload.opcional;
    updatePayload.minimo_plazas = payload.opcional ? (payload.minimo_plazas || null) : null;

    const { data, error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (data?.expediente_id) revalidatePath(`/expedientes/${data.expediente_id}`);
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update expediente servicio:", error.message);
    throw new Error(error.message || "Failed to update expediente servicio");
  }
}

export async function getExtrasIconMap(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data: servicios } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("id, tipo, config_tipos_servicios(icono)")
      .eq("expediente_id", expedienteId);

    const map: Record<string, string> = {};
    (servicios || []).forEach((s: any) => {
      map[s.id] = s.config_tipos_servicios?.icono || "";
    });
    return map;
  } catch (error: any) {
    console.error("Failed to get extras icon map:", error.message);
    return {};
  }
}

export async function getServiciosOpcionalesByDomain(expedienteId: string, domain: string) {
  try {
    const { getAgencyDbClientByDomain } = await import("@/lib/agencyDb");
    const agency = await getAgencyDbClientByDomain(domain);
    if (!agency) return [];
    const { data, error } = await agency.db
      .from("operativa_expedientes_servicios")
      .select("id, descripcion, pvp, opcional")
      .eq("expediente_id", expedienteId)
      .eq("opcional", true)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((s: any) => ({
      id: s.id,
      nombre: s.descripcion,
      pvp: parseFloat(s.pvp) || 0,
    }));
  } catch (error: any) {
    console.error("Failed to get servicios opcionales:", error.message);
    return [];
  }
}

export async function toggleServicioOpcional(id: string, opcional: boolean) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .update({ opcional })
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to toggle servicio opcional:", error.message);
    throw new Error(error.message);
  }
}

export async function getAllServicios() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to get all services:", error.message);
    return [];
  }
}

export async function getOptionalServicesFromLinkedQuote(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    // Find the linked cotizaciones for this expediente
    const { data: cotizaciones, error: cotError } = await agencyDb
      .from("operativa_cotizaciones")
      .select("id, titulo")
      .eq("expediente_id", expedienteId);

    if (cotError) throw cotError;
    if (!cotizaciones || cotizaciones.length === 0) return [];

    const cotIds = cotizaciones.map((c: any) => c.id);

    // Get optional lines from those cotizaciones
    const { data: lineas, error: lineasError } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("id, descripcion, pvp, neto, tipo, proveedor, plazas, cotizacion_id")
      .in("cotizacion_id", cotIds)
      .eq("opcional", true);

    if (lineasError) throw lineasError;

    // Map each line with its cotización title
    const cotsMap = new Map(cotizaciones.map((c: any) => [c.id, c.titulo]));
    return (lineas || []).map((l: any) => ({
      ...l,
      cotizacion_titulo: cotsMap.get(l.cotizacion_id) || "Cotización",
    }));

  } catch (error: any) {
    console.error("Failed to get optional services from linked quote:", error.message);
    return [];
  }
}

export async function importOptionalServicesToExpediente(expedienteId: string, lineIds: string[]) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    // Fetch the lines to import
    const { data: lineas, error: lineasError } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("id, descripcion, pvp, neto, tipo, proveedor, plazas")
      .in("id", lineIds);

    if (lineasError) throw lineasError;
    if (!lineas || lineas.length === 0) return { success: false, error: "No lines found to import" };

    const servicesToInsert = lineas.map((line: any) => ({
      expediente_id: expedienteId,
      tipo: line.tipo,
      proveedor: line.proveedor ? String(line.proveedor) : null,
      descripcion: line.descripcion,
      neto: Number(line.neto || 0),
      pvp: Number(line.pvp || 0),
      plazas: Number(line.plazas || 1),
      total: Number(line.pvp || 0) * Number(line.plazas || 1),
      opcional: true,
    }));

    const { error: insertError } = await agencyDb
      .from("operativa_expedientes_servicios")
      .insert(servicesToInsert);

    if (insertError) throw insertError;

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to import optional services:", error.message);
    return { success: false, error: error.message };
  }
}
