"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

// UUID_REGEX lives here: createExpedienteServicio and createGroupedExpedienteServicio use it
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getExpedienteServicios(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    // Fetch travelers to count selections for optional services
    const { data: viajeros } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select("extras")
      .eq("expediente_id", expedienteId);

    const countsMap = new Map<string, number>();
    for (const v of (viajeros || [])) {
      let extrasList = [];
      if (Array.isArray(v.extras)) {
        extrasList = v.extras;
      } else if (typeof v.extras === "string") {
        try {
          extrasList = JSON.parse(v.extras);
        } catch {
          extrasList = [];
        }
      }
      if (Array.isArray(extrasList)) {
        for (const extra of extrasList) {
          if (extra?.id) {
            countsMap.set(extra.id, (countsMap.get(extra.id) || 0) + 1);
          }
        }
      }
    }

    const { data, error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("*, lineas:operativa_expediente_servicio_lineas(*), maestro_destinos(id, nombre, nombre_comercial, admin_area_l1, admin_area_l2)")
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const servicios = data || [];
    const servicioIds = servicios.map((s: any) => s.id).filter(Boolean);

    // Detalles del formulario dinámico: viven únicamente en la línea de cotización vinculada
    // (si existe) para no duplicar ese dato en dos tablas.
    const lineaIdsPorServicio = new Map<string, string>();
    for (const s of servicios) {
      const lineaId = (s.lineas || []).find((l: any) => l.cotizacion_linea_id)?.cotizacion_linea_id;
      if (lineaId) lineaIdsPorServicio.set(s.id, lineaId);
    }
    const detallesPorLinea = new Map<string, any>();
    const tipoConfigPorLinea = new Map<string, any>();
    const lineaIds = [...new Set(lineaIdsPorServicio.values())];
    if (lineaIds.length > 0) {
      const { data: lineasCot } = await agencyDb
        .from("operativa_cotizacion_lineas")
        .select("id, detalles, config_tipos_servicios(id, etiqueta, icono, contenido, idx)")
        .in("id", lineaIds);
      for (const l of (lineasCot || [])) {
        detallesPorLinea.set(l.id, l.detalles);
        tipoConfigPorLinea.set(l.id, l.config_tipos_servicios);
      }
    }

    // Resolve provider names if they are stored as UUID strings
    const providerIds = [...new Set(servicios.map((s: any) => s.proveedor).filter((p: any) => p && UUID_REGEX.test(p)))];
    const providerMap = new Map<string, string>();
    const providerEmailMap = new Map<string, string>();
    if (providerIds.length > 0) {
      const { data: provs } = await agencyDb
        .from("contabilidad_proveedores")
        .select("id, nombre, razon_social, email")
        .in("id", providerIds);
      if (provs) {
        provs.forEach((p: any) => {
          providerMap.set(p.id, p.nombre || p.razon_social || p.id);
          if (p.email) providerEmailMap.set(p.id, p.email);
        });
      }
    }

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

    // Pagos directos (tarjeta/efectivo o banco vinculado explícitamente) via tabla puente
    const directPagosPorServicio = new Map<string, any[]>();
    if (servicioIds.length > 0) {
      const { data: sp } = await agencyDb
        .from("operativa_servicio_pagos")
        .select("servicio_id, importe, movimiento_id")
        .in("servicio_id", servicioIds);
      const movIdsDirectos = [...new Set((sp || []).map((r: any) => r.movimiento_id))];
      const movimientosMap = new Map<string, any>(
        (movimientos || []).filter((m: any) => movIdsDirectos.includes(m.id)).map((m: any) => [m.id, m])
      );
      for (const r of (sp || [])) {
        const mov = movimientosMap.get(r.movimiento_id);
        if (!mov) continue;
        const list = directPagosPorServicio.get(r.servicio_id) || [];
        list.push({
          id: mov.id,
          importe: Number(r.importe),
          fecha: mov.created_at,
          concepto: mov.concepto,
          medio_pago: mov.medio_pago,
        });
        directPagosPorServicio.set(r.servicio_id, list);
      }
    }

    const result = servicios.map((s: any) => {
      let resolvedProveedor = s.proveedor;
      const proveedorEmail = s.proveedor && UUID_REGEX.test(s.proveedor) ? providerEmailMap.get(s.proveedor) || "" : "";
      if (resolvedProveedor && UUID_REGEX.test(resolvedProveedor) && providerMap.has(resolvedProveedor)) {
        resolvedProveedor = providerMap.get(resolvedProveedor);
      }
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

      for (const dp of (directPagosPorServicio.get(s.id) || [])) {
        if (!seen.has(dp.id)) {
          seen.add(dp.id);
          movsVinculados.push(dp);
        }
      }

      const proveedorId = s.proveedor && UUID_REGEX.test(s.proveedor) ? s.proveedor : null;
      const lineaId = lineaIdsPorServicio.get(s.id);

      return {
        ...s,
        proveedor: resolvedProveedor,
        proveedor_id: proveedorId,
        proveedor_email: proveedorEmail,
        abonado: abonoMap.get(s.id) || 0,
        pagos: movsVinculados,
        viajeros_count: countsMap.get(s.id) || 0,
        detalles: lineaId ? detallesPorLinea.get(lineaId) ?? {} : undefined,
        config_tipos_servicios: lineaId ? tipoConfigPorLinea.get(lineaId) ?? null : undefined,
      };
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
  destino?: string | null;
  noches?: number | null;
  plazas?: number | null;
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
    // Keep proveedor as raw id (not resolved to a display name) so the service
    // stays properly linked to contabilidad_proveedores, same as destino/maestro_destinos.
    const proveedor = payload.proveedor || null;

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
        plazas: payload.plazas ?? 1,
        condiciones: payload.condiciones || [],
        opcional: payload.opcional,
        minimo_plazas: payload.opcional ? (payload.minimo_plazas || null) : null,
        documento_id: payload.documento_id || null,
        destino: payload.destino || null,
        noches: payload.noches ?? null,
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

    // Check if any travelers have selected this service in their extras
    const { data: viajeros } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select("extras")
      .eq("expediente_id", expedienteId);

    const isSelectedByTravelers = (viajeros || []).some((v: any) => {
      let extrasList = [];
      if (Array.isArray(v.extras)) {
        extrasList = v.extras;
      } else if (typeof v.extras === "string") {
        try {
          extrasList = JSON.parse(v.extras);
        } catch {
          extrasList = [];
        }
      }
      return Array.isArray(extrasList) && extrasList.some((extra: any) => extra?.id === id);
    });

    if (isSelectedByTravelers) {
      throw new Error("No se puede eliminar este servicio porque ya ha sido seleccionado por uno o más viajeros.");
    }

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

// Vincula un servicio de expediente (creado manualmente, sin línea de cotización)
// a la cotización del expediente: crea la línea de cotización con los datos actuales
// del servicio y la tabla puente, para que a partir de ahora funcione igual que el
// resto de servicios vinculados. Solo aplica si el expediente ya tiene una cotización;
// no se crea una cotización nueva desde aquí.
export async function vincularServicioACotizacion(servicioId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: servicio, error: errServicio } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("*")
      .eq("id", servicioId)
      .single();
    if (errServicio) throw errServicio;

    const yaVinculado = await getCotizacionLineaIdForServicio(servicioId);
    if (yaVinculado) return { success: true, data: { cotizacion_linea_id: yaVinculado } };

    const { data: cotizacion } = await agencyDb
      .from("operativa_cotizaciones")
      .select("id")
      .eq("expediente_id", servicio.expediente_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cotizacion) {
      throw new Error("Este expediente no tiene ninguna cotización vinculada. Crea primero una cotización para poder añadir el servicio.");
    }

    const nochesServicio = Number(servicio.noches || 0) || 1;
    const { createCotizacionLinea } = await import("@/actions/cotizaciones");
    const lineaRes = await createCotizacionLinea({
      cotizacion_id: cotizacion.id,
      tipo: servicio.tipo || undefined,
      descripcion: servicio.descripcion,
      proveedor: servicio.proveedor || undefined,
      destino: servicio.destino || undefined,
      plazas: servicio.plazas ?? null,
      noches: servicio.noches ?? null,
      neto: servicio.neto ?? 0,
      pvp: servicio.pvp ?? 0,
      total_neto: (servicio.neto ?? 0) * (servicio.plazas || 1) * nochesServicio,
      total_pvp: (servicio.pvp ?? 0) * (servicio.plazas || 1) * nochesServicio,
      opcional: servicio.opcional,
    });
    if (!lineaRes.success || !lineaRes.data) throw new Error("No se pudo crear la línea de cotización");

    const { error: errPuente } = await agencyDb
      .from("operativa_expediente_servicio_lineas")
      .insert([{
        servicio_id: servicioId,
        cotizacion_linea_id: lineaRes.data.id,
        tipo: servicio.tipo || null,
        descripcion: servicio.descripcion,
        neto: servicio.neto,
        pvp: servicio.pvp,
      }]);
    if (errPuente) throw errPuente;

    revalidatePath(`/expedientes/${servicio.expediente_id}`);
    return { success: true, data: { cotizacion_linea_id: lineaRes.data.id } };
  } catch (error: any) {
    console.error("Failed to vincular servicio a cotizacion:", error.message);
    return { success: false, error: error.message || "Failed to vincular servicio a cotizacion" };
  }
}

// Vincula una línea de cotización (sin servicio de expediente asociado) al expediente
// vinculado a esa cotización: crea el servicio de expediente con los datos actuales
// de la línea y la tabla puente, para que a partir de ahora funcione igual que el
// resto de líneas vinculadas. Solo aplica si la cotización tiene un expediente vinculado.
export async function vincularCotizacionLineaAExpediente(cotizacionLineaId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: linea, error: errLinea } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("*, operativa_cotizaciones(expediente_id)")
      .eq("id", cotizacionLineaId)
      .single();
    if (errLinea) throw errLinea;

    const expedienteId = (linea as any).operativa_cotizaciones?.expediente_id;
    if (!expedienteId) {
      throw new Error("Esta cotización no está vinculada a ningún expediente.");
    }

    const { data: yaVinculada } = await agencyDb
      .from("operativa_expediente_servicio_lineas")
      .select("servicio_id")
      .eq("cotizacion_linea_id", cotizacionLineaId)
      .maybeSingle();
    if (yaVinculada) return { success: true, data: { servicio_id: yaVinculada.servicio_id } };

    const pvpVal = Number(linea.pvp || 0);
    const netoVal = Number(linea.neto || 0);
    const plazasVal = Number(linea.plazas || 1);
    const nochesLinea = Number(linea.noches || 0) || 1;

    const res = await createGroupedExpedienteServicio({
      expediente_id: expedienteId,
      tipo: linea.tipo,
      proveedor: linea.proveedor || "",
      descripcion: linea.descripcion,
      neto: netoVal,
      pvp: pvpVal,
      total: pvpVal * plazasVal * nochesLinea,
      opcional: !!linea.opcional,
      destino: linea.destino || null,
      noches: linea.noches ?? null,
      plazas: plazasVal,
      origenes: [{
        cotizacion_linea_id: linea.id,
        tipo: linea.tipo,
        descripcion: linea.descripcion,
        neto: netoVal,
        pvp: pvpVal,
      }],
    });
    if (!res.success || !res.data) throw new Error("No se pudo crear el servicio del expediente");

    return { success: true, data: { servicio_id: res.data.id } };
  } catch (error: any) {
    console.error("Failed to vincular cotizacion linea a expediente:", error.message);
    return { success: false, error: error.message || "Failed to vincular cotizacion linea a expediente" };
  }
}

export async function getCotizacionLineaIdForServicio(servicioId: string): Promise<string | null> {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data: linkRow } = await agencyDb
      .from("operativa_expediente_servicio_lineas")
      .select("cotizacion_linea_id")
      .eq("servicio_id", servicioId)
      .not("cotizacion_linea_id", "is", null)
      .maybeSingle();
    return linkRow?.cotizacion_linea_id || null;
  } catch (error: any) {
    console.error("Failed to get cotizacion linea id for servicio:", error.message);
    return null;
  }
}

export async function updateExpedienteServicio(id: string, payload: {
  tipo?: string;
  proveedor?: string;
  descripcion?: string;
  neto?: number;
  pvp?: number;
  plazas?: number;
  noches?: number | null;
  destino?: string | null;
  total?: number;
  opcional?: boolean;
  minimo_plazas?: number | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();

    // total incluye noches (igual que total_neto/total_pvp en cotización), así que hay que
    // recalcularlo si cambia cualquiera de sus factores.
    const recalculaTotal = payload.pvp !== undefined || payload.plazas !== undefined || payload.noches !== undefined;
    let totalCalculado: number | undefined;
    if (recalculaTotal) {
      const { data: actual } = await agencyDb
        .from("operativa_expedientes_servicios")
        .select("pvp, plazas, noches")
        .eq("id", id)
        .single();
      const pvpBase = payload.pvp !== undefined ? payload.pvp : Number(actual?.pvp || 0);
      const plazasBase = payload.plazas !== undefined ? payload.plazas : Number(actual?.plazas || 1);
      const nochesBase = Number((payload.noches !== undefined ? payload.noches : actual?.noches) || 0) || 1;
      totalCalculado = pvpBase * (plazasBase || 1) * nochesBase;
    }

    const updatePayload: any = {};
    if (payload.tipo !== undefined) updatePayload.tipo = payload.tipo;
    if (payload.proveedor !== undefined) updatePayload.proveedor = payload.proveedor;
    if (payload.descripcion !== undefined) updatePayload.descripcion = payload.descripcion;
    if (payload.neto !== undefined) updatePayload.neto = payload.neto;
    if (payload.pvp !== undefined) updatePayload.pvp = payload.pvp;
    if (payload.plazas !== undefined) updatePayload.plazas = payload.plazas;
    if (payload.noches !== undefined) updatePayload.noches = payload.noches;
    if (payload.destino !== undefined) updatePayload.destino = payload.destino;
    if (payload.total !== undefined) updatePayload.total = payload.total;
    else if (totalCalculado !== undefined) updatePayload.total = totalCalculado;
    if (payload.opcional !== undefined) updatePayload.opcional = payload.opcional;
    updatePayload.minimo_plazas = payload.opcional ? (payload.minimo_plazas || null) : null;

    const { data, error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Check if linked to cotización
    const { data: linkRow } = await agencyDb
      .from("operativa_expediente_servicio_lineas")
      .select("cotizacion_linea_id")
      .eq("servicio_id", id)
      .not("cotizacion_linea_id", "is", null)
      .maybeSingle();

    if (linkRow && linkRow.cotizacion_linea_id) {
      const { updateCotizacionLinea } = await import("@/actions/cotizaciones");
      
      const pvpVal = payload.pvp !== undefined ? payload.pvp : data.pvp;
      const netoVal = payload.neto !== undefined ? payload.neto : data.neto;
      const plazasVal = payload.plazas !== undefined ? payload.plazas : data.plazas;
      const nochesVal = Number((payload.noches !== undefined ? payload.noches : data.noches) || 0) || 1;

      await updateCotizacionLinea(linkRow.cotizacion_linea_id, {
        descripcion: payload.descripcion,
        pvp: pvpVal,
        neto: netoVal,
        total_pvp: pvpVal * plazasVal * nochesVal,
        total_neto: netoVal * plazasVal * nochesVal,
        tipo: payload.tipo,
        proveedor: payload.proveedor ? String(payload.proveedor) : undefined,
        destino: payload.destino,
        noches: payload.noches,
      });

      // Update intermediate line
      await agencyDb
        .from("operativa_expediente_servicio_lineas")
        .update({
          descripcion: payload.descripcion,
          pvp: pvpVal,
          neto: netoVal,
          tipo: payload.tipo,
        })
        .eq("servicio_id", id);

      // Si el cambio afecta al total (pvp/plazas/noches), el pago existente puede haber
      // dejado de cubrirlo (o pasar a cubrirlo): mantener sincronizado el confirmado.
      if (payload.pvp !== undefined || payload.plazas !== undefined || payload.noches !== undefined) {
        await sincronizarConfirmadoSegunPago(agencyDb, id);
      }
    }

    if (data?.expediente_id) revalidatePath(`/expedientes/${data.expediente_id}`);
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update expediente servicio:", error.message);
    throw new Error(error.message || "Failed to update expediente servicio");
  }
}

/** Resolve (or fallback to) a contabilidad_entidades id for a provider name, mirroring
 *  the lookup used by conciliarPagoProveedor for bank-reconciled payments. */
/** Mantiene sincronizado el estado "confirmado" de la línea de cotización vinculada con el
 *  estado real de pago del servicio (mismo criterio que EstadoPagoBadge: Pagado = abonado
 *  cubre pvp*plazas*noches). Se llama tanto al registrar un pago como al editar importes,
 *  plazas o noches, para que una línea deje de estar "confirmado" si el cambio hace que el
 *  pago ya no cubra el total (vuelve a pendiente hasta que se complete el pago de nuevo). */
async function sincronizarConfirmadoSegunPago(agencyDb: any, servicioId: string) {
  try {
    const { data: servicio } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("pvp, plazas, noches")
      .eq("id", servicioId)
      .single();
    if (!servicio) return;

    const { data: abono } = await agencyDb
      .from("v_abonados_servicios")
      .select("total_abonado")
      .eq("servicio_id", servicioId)
      .maybeSingle();

    const totalPvp = Number(servicio.pvp || 0) * Number(servicio.plazas || 1) * (Number(servicio.noches || 0) || 1);
    const abonado = Number(abono?.total_abonado || 0);
    const estaPagadoCompleto = totalPvp > 0 && abonado >= totalPvp;

    const { data: linkRow } = await agencyDb
      .from("operativa_expediente_servicio_lineas")
      .select("cotizacion_linea_id")
      .eq("servicio_id", servicioId)
      .not("cotizacion_linea_id", "is", null)
      .maybeSingle();

    if (linkRow?.cotizacion_linea_id) {
      const { updateCotizacionLinea } = await import("@/actions/cotizaciones");
      await updateCotizacionLinea(linkRow.cotizacion_linea_id, { confirmado: estaPagadoCompleto });
    }
  } catch (error: any) {
    console.error("Failed to sincronizar confirmado según pago:", error.message);
  }
}

async function resolveEntidadIdParaProveedor(agencyDb: any, proveedorNombre: string | null | undefined) {
  if (proveedorNombre) {
    const { data: entByName } = await agencyDb
      .from("contabilidad_entidades")
      .select("id")
      .ilike("nombre", `%${proveedorNombre}%`)
      .limit(1);
    if (entByName && entByName.length > 0) return entByName[0].id;
  }
  const { data: fallbackEnts } = await agencyDb
    .from("contabilidad_entidades")
    .select("id")
    .limit(1);
  if (fallbackEnts && fallbackEnts.length > 0) return fallbackEnts[0].id;
  throw new Error("No hay ninguna entidad registrada en contabilidad_entidades. Debe crear al menos una entidad para continuar.");
}

/** Registrar un pago directo (tarjeta/efectivo) contra uno o varios servicios del expediente.
 *  Un pago (contabilidad_movimientos) es siempre de un único proveedor: si los servicios
 *  seleccionados pertenecen a proveedores distintos, se crea un movimiento por cada proveedor,
 *  agrupando dentro de él los servicios que lo comparten (mismo patrón que
 *  vincularServiciosAMovimientoBanco: un movimiento + N filas en operativa_servicio_pagos). */
export async function registrarPagoServicios(payload: {
  expediente_id: string;
  medio_pago: "efectivo" | "tarjeta";
  servicios: Array<{ id: string; importe: number; proveedor?: string | null; proveedor_id?: string | null }>;
  concepto?: string;
  fecha?: string;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { expediente_id, medio_pago, servicios, concepto, fecha } = payload;

    const serviciosValidos = (servicios || []).filter((s) => s.importe && s.importe > 0);
    if (serviciosValidos.length === 0) {
      throw new Error("Debes seleccionar al menos un servicio para registrar el pago.");
    }

    // Se agrupa por proveedor_id (identificador real, sin ambigüedad) cuando existe; si no,
    // por el texto de proveedor tal cual — usar solo el nombre resuelto puede agrupar mal
    // servicios del mismo proveedor si difieren en formato/espacios/mayúsculas.
    const gruposPorProveedor = new Map<string, typeof serviciosValidos>();
    for (const ser of serviciosValidos) {
      const key = ser.proveedor_id || ser.proveedor || "__sin_proveedor__";
      const grupo = gruposPorProveedor.get(key) || [];
      grupo.push(ser);
      gruposPorProveedor.set(key, grupo);
    }

    const results: { servicio_id: string; movimiento_id: string }[] = [];

    for (const grupo of gruposPorProveedor.values()) {
      const importeGrupo = grupo.reduce((sum, s) => sum + s.importe, 0);
      const entidadId = await resolveEntidadIdParaProveedor(agencyDb, grupo[0].proveedor);

      const { data: movimiento, error: movError } = await agencyDb
        .from("contabilidad_movimientos")
        .insert([{
          entidad_id: entidadId,
          usuario_id: "550e8400-e29b-41d4-a716-446655440000",
          tipo: "pago",
          importe_total: importeGrupo,
          moneda: "EUR",
          medio_pago,
          tipo_servicio: "Proveedor - Pago",
          fecha: fecha || new Date().toISOString().split("T")[0],
          concepto: concepto || `Pago ${medio_pago === "efectivo" ? "en efectivo" : "con tarjeta"} - ${grupo[0].proveedor || "Proveedor"}`,
          estado: "confirmado",
          expediente_id,
        }])
        .select("id")
        .single();

      if (movError) throw movError;

      const { error: bridgeError } = await agencyDb
        .from("operativa_servicio_pagos")
        .insert(grupo.map((ser) => ({ servicio_id: ser.id, movimiento_id: movimiento.id, importe: ser.importe })));

      if (bridgeError) throw bridgeError;

      for (const ser of grupo) {
        results.push({ servicio_id: ser.id, movimiento_id: movimiento.id });
        await sincronizarConfirmadoSegunPago(agencyDb, ser.id);
      }
    }

    revalidatePath(`/expedientes/${expediente_id}`);
    return { success: true, data: results };
  } catch (error: any) {
    console.error("Failed to registrar pago servicios:", error.message);
    return { success: false, error: error.message || "Error al registrar el pago" };
  }
}

/** Vincular uno o varios servicios a un movimiento bancario existente (conciliación directa),
 *  creando el contabilidad_movimientos correspondiente igual que conciliarPagoProveedor. */
export async function vincularServiciosAMovimientoBanco(payload: {
  expediente_id: string;
  movimiento_banco_id: string;
  servicios: Array<{ id: string; importe: number; proveedor?: string | null }>;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { expediente_id, movimiento_banco_id, servicios } = payload;

    if (!servicios || servicios.length === 0) {
      throw new Error("Debes seleccionar al menos un servicio para registrar el pago.");
    }

    const { data: movBanco, error: movBancoError } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("*")
      .eq("id", movimiento_banco_id)
      .maybeSingle();

    if (movBancoError || !movBanco) throw new Error("Movimiento bancario no encontrado");

    const results: { servicio_id: string; movimiento_id: string }[] = [];

    for (const ser of servicios) {
      if (!ser.importe || ser.importe <= 0) continue;
      const entidadId = await resolveEntidadIdParaProveedor(agencyDb, ser.proveedor);

      const { data: movimiento, error: movError } = await agencyDb
        .from("contabilidad_movimientos")
        .insert([{
          entidad_id: entidadId,
          usuario_id: "550e8400-e29b-41d4-a716-446655440000",
          tipo: "pago",
          importe_total: ser.importe,
          moneda: movBanco.moneda || "EUR",
          medio_pago: "banco",
          tipo_servicio: "Proveedor - Pago",
          fecha: movBanco.fecha_operacion || new Date().toISOString().split("T")[0],
          concepto: `Pago Servicio - ${ser.proveedor || "Proveedor"}`,
          estado: "confirmado",
          movimiento_banco_id,
          expediente_id,
        }])
        .select("id")
        .single();

      if (movError) throw movError;

      const { error: bridgeError } = await agencyDb
        .from("operativa_servicio_pagos")
        .insert([{ servicio_id: ser.id, movimiento_id: movimiento.id, importe: ser.importe }]);

      if (bridgeError) throw bridgeError;

      results.push({ servicio_id: ser.id, movimiento_id: movimiento.id });
      await sincronizarConfirmadoSegunPago(agencyDb, ser.id);
    }

    // Concilia el movimiento bancario: queda marcado como conciliado y vinculado al
    // expediente a través del contabilidad_movimientos recién creado (expediente_id).
    await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({ estado: "conciliado", conciliacion_tipo: "manual", conciliado_at: new Date().toISOString() })
      .eq("id", movimiento_banco_id);

    revalidatePath(`/expedientes/${expediente_id}`);
    return { success: true, data: results };
  } catch (error: any) {
    console.error("Failed to vincular servicios a movimiento banco:", error.message);
    return { success: false, error: error.message || "Error al registrar el pago" };
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

export async function updateExpedienteServicioNoches(id: string, noches: number | null, expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: actual } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("pvp, plazas")
      .eq("id", id)
      .single();
    const nochesFactor = Number(noches || 0) || 1;
    const totalCalculado = Number(actual?.pvp || 0) * Number(actual?.plazas || 1) * nochesFactor;

    const { data: updated, error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .update({ noches, total: totalCalculado })
      .eq("id", id)
      .select("*, lineas:operativa_expediente_servicio_lineas(*)")
      .single();
    if (error) throw error;

    // Sync to linked cotización line, if any, recalculando los totales con las noches nuevas
    const linkRow = (updated?.lineas || []).find((l: any) => l.cotizacion_linea_id);
    if (linkRow?.cotizacion_linea_id) {
      const { updateCotizacionLinea } = await import("@/actions/cotizaciones");
      const plazasVal = updated.plazas || 1;
      const nochesVal = Number(noches || 0) || 1;
      await updateCotizacionLinea(linkRow.cotizacion_linea_id, {
        noches,
        total_neto: Number(updated.neto || 0) * plazasVal * nochesVal,
        total_pvp: Number(updated.pvp || 0) * plazasVal * nochesVal,
      });
    }

    await sincronizarConfirmadoSegunPago(agencyDb, id);

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update expediente servicio noches:", error.message);
    return { success: false, error: error.message };
  }
}

export async function updateExpedienteServicioDestino(id: string, destino: string | null, expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_expedientes_servicios")
      .update({ destino: destino || null })
      .eq("id", id);
    if (error) throw error;

    // Sync to linked cotización line, if any
    const { data: linkRow } = await agencyDb
      .from("operativa_expediente_servicio_lineas")
      .select("cotizacion_linea_id")
      .eq("servicio_id", id)
      .not("cotizacion_linea_id", "is", null)
      .maybeSingle();

    if (linkRow && linkRow.cotizacion_linea_id) {
      const { updateCotizacionLinea } = await import("@/actions/cotizaciones");
      await updateCotizacionLinea(linkRow.cotizacion_linea_id, { destino: destino || null });
    }

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update expediente servicio destino:", error.message);
    return { success: false, error: error.message };
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
      .select("id, descripcion, pvp, neto, tipo, proveedor, plazas, noches, destino")
      .in("id", lineIds);

    if (lineasError) throw lineasError;
    if (!lineas || lineas.length === 0) return { success: false, error: "No lines found to import" };

    // Keep proveedor/destino as raw ids (not resolved to display names) so the
    // service stays properly linked to contabilidad_proveedores/maestro_destinos.
    const servicesToInsert = lineas.map((line: any) => {
      const nochesLine = Number(line.noches || 0) || 1;
      return {
        expediente_id: expedienteId,
        tipo: line.tipo,
        proveedor: line.proveedor || null,
        descripcion: line.descripcion,
        neto: Number(line.neto || 0),
        pvp: Number(line.pvp || 0),
        plazas: Number(line.plazas || 1),
        noches: line.noches ?? null,
        destino: line.destino || null,
        total: Number(line.pvp || 0) * Number(line.plazas || 1) * nochesLine,
        opcional: true,
      };
    });

    const { data: insertedServices, error: insertError } = await agencyDb
      .from("operativa_expedientes_servicios")
      .insert(servicesToInsert)
      .select();

    if (insertError) throw insertError;

    if (insertedServices && insertedServices.length > 0) {
      // Map the inserted services back to their original quote line IDs
      const lineasToInsert = insertedServices.map((service: any, index: number) => {
        const originalLine = lineas[index];
        return {
          servicio_id: service.id,
          cotizacion_linea_id: originalLine.id,
          tipo: originalLine.tipo,
          descripcion: originalLine.descripcion,
          neto: Number(originalLine.neto || 0),
          pvp: Number(originalLine.pvp || 0),
        };
      });

      const { error: lineasInsertError } = await agencyDb
        .from("operativa_expediente_servicio_lineas")
        .insert(lineasToInsert);

      if (lineasInsertError) {
        console.error("Error creating intermediate link lines:", lineasInsertError.message);
      }
    }

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to import optional services:", error.message);
    return { success: false, error: error.message };
  }
}

/** Update neto/pvp on an expediente service, syncing to cotización linea if linked.
 *  Returns error object (not throw) if the service has travelers already assigned. */
export async function updateExpedienteServicioImportes(
  id: string,
  payload: { neto?: number; pvp?: number },
  expedienteId: string
) {
  try {
    const agencyDb = await getAgencyDbClient();

    // Block if travelers are assigned to this service
    const { data: viajeros } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select("extras")
      .eq("expediente_id", expedienteId);

    const isSelectedByTravelers = (viajeros || []).some((v: any) => {
      let extrasList: any[] = [];
      if (Array.isArray(v.extras)) extrasList = v.extras;
      else if (typeof v.extras === "string") {
        try { extrasList = JSON.parse(v.extras); } catch { extrasList = []; }
      }
      return Array.isArray(extrasList) && extrasList.some((e: any) => e?.id === id);
    });

    // El PVP ya está comprometido con los viajeros que lo contrataron, así que no se puede
    // tocar una vez hay alguno vinculado. El neto (coste a pagar al proveedor) sí puede
    // cambiar libremente, ya que no afecta a lo que el viajero ya vio/pagó.
    if (isSelectedByTravelers && payload.pvp !== undefined) {
      return { success: false, error: "No se puede modificar el PVP porque hay viajeros vinculados a este servicio." };
    }

    const updateFields: any = {};
    if (payload.neto !== undefined) updateFields.neto = payload.neto;
    if (payload.pvp !== undefined) updateFields.pvp = payload.pvp;

    if (payload.pvp !== undefined) {
      const { data: actual } = await agencyDb
        .from("operativa_expedientes_servicios")
        .select("plazas, noches")
        .eq("id", id)
        .single();
      const nochesFactor = Number(actual?.noches || 0) || 1;
      updateFields.total = payload.pvp * Number(actual?.plazas || 1) * nochesFactor;
    }

    const { data: updated, error: updErr } = await agencyDb
      .from("operativa_expedientes_servicios")
      .update(updateFields)
      .eq("id", id)
      .select("*, lineas:operativa_expediente_servicio_lineas(*)")
      .single();

    if (updErr) throw updErr;

    // Sync to cotización linea if linked
    const linkRow = (updated?.lineas || []).find((l: any) => l.cotizacion_linea_id);
    if (linkRow?.cotizacion_linea_id) {
      const { updateCotizacionLinea } = await import("@/actions/cotizaciones");
      const pvpVal = payload.pvp ?? updated.pvp;
      const netoVal = payload.neto ?? updated.neto;
      const plazasVal = updated.plazas || 1;
      const nochesVal = Number(updated.noches || 0) || 1;
      await updateCotizacionLinea(linkRow.cotizacion_linea_id, {
        pvp: pvpVal,
        neto: netoVal,
        total_pvp: pvpVal * plazasVal * nochesVal,
        total_neto: netoVal * plazasVal * nochesVal,
      });
      await agencyDb
        .from("operativa_expediente_servicio_lineas")
        .update({ pvp: pvpVal, neto: netoVal })
        .eq("servicio_id", id);
    }

    if (payload.pvp !== undefined) {
      await sincronizarConfirmadoSegunPago(agencyDb, id);
    }

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Failed to update expediente servicio importes:", error.message);
    return { success: false, error: error.message };
  }
}

/** Get non-optional lines from the cotización linked to this expediente */
export async function getNonOptionalServicesFromLinkedQuote(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: cotizaciones, error: cotError } = await agencyDb
      .from("operativa_cotizaciones")
      .select("id, titulo")
      .eq("expediente_id", expedienteId);

    if (cotError) throw cotError;
    if (!cotizaciones || cotizaciones.length === 0) return [];

    const cotIds = cotizaciones.map((c: any) => c.id);

    const { data: lineas, error: lineasError } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("id, descripcion, pvp, neto, tipo, proveedor, plazas, cotizacion_id")
      .in("cotizacion_id", cotIds)
      .eq("opcional", false);

    if (lineasError) throw lineasError;

    const cotsMap = new Map(cotizaciones.map((c: any) => [c.id, c.titulo]));
    return (lineas || []).map((l: any) => ({
      ...l,
      cotizacion_titulo: cotsMap.get(l.cotizacion_id) || "Cotización",
    }));
  } catch (error: any) {
    console.error("Failed to get non-optional services from linked quote:", error.message);
    return [];
  }
}

/** Import non-optional cotización lines as expediente services (opcional=false) */
export async function importNonOptionalServicesToExpediente(expedienteId: string, lineIds: string[]) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: lineas, error: lineasError } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("id, descripcion, pvp, neto, tipo, proveedor, plazas, noches, destino")
      .in("id", lineIds);

    if (lineasError) throw lineasError;
    if (!lineas || lineas.length === 0) return { success: false, error: "No lines found to import" };

    // Keep proveedor/destino as raw ids (not resolved to display names) so the
    // service stays properly linked to contabilidad_proveedores/maestro_destinos.
    const servicesToInsert = lineas.map((line: any) => {
      const nochesLine = Number(line.noches || 0) || 1;
      return {
        expediente_id: expedienteId,
        tipo: line.tipo,
        proveedor: line.proveedor || null,
        descripcion: line.descripcion,
        neto: Number(line.neto || 0),
        pvp: Number(line.pvp || 0),
        plazas: Number(line.plazas || 1),
        noches: line.noches ?? null,
        destino: line.destino || null,
        total: Number(line.pvp || 0) * Number(line.plazas || 1) * nochesLine,
        opcional: false,
      };
    });

    const { data: insertedServices, error: insertError } = await agencyDb
      .from("operativa_expedientes_servicios")
      .insert(servicesToInsert)
      .select();

    if (insertError) throw insertError;

    if (insertedServices && insertedServices.length > 0) {
      const lineasToInsert = insertedServices.map((service: any, index: number) => {
        const originalLine = lineas[index];
        return {
          servicio_id: service.id,
          cotizacion_linea_id: originalLine.id,
          tipo: originalLine.tipo,
          descripcion: originalLine.descripcion,
          neto: Number(originalLine.neto || 0),
          pvp: Number(originalLine.pvp || 0),
        };
      });

      const { error: lineasInsertError } = await agencyDb
        .from("operativa_expediente_servicio_lineas")
        .insert(lineasToInsert);

      if (lineasInsertError) {
        console.error("Error creating intermediate link lines:", lineasInsertError.message);
      }
    }

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to import non-optional services:", error.message);
    return { success: false, error: error.message };
  }
}
