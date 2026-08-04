import { ejecutarConciliacionGroomy } from "@/lib/GroomyConciliationService";

/** Recalcula el estado de un movimiento bancario comparando su importe con la suma de:
 *  - contabilidad_movimientos confirmados vinculados (movimiento_banco_id)
 *  - ofi_pagos y ofi_cobros vinculados (movimiento_banco_id), donde importe_pendiente=0 significa conciliado
 *  Si no cubre el importe total queda 'parcial', permitiendo completarlo con más OFI/pagos. */
export async function recalcularEstadoMovimientoBanco(
  agencyDb: any,
  movimientoBancoId: string,
  conciliacionTipo: "automatica" | "manual" = "manual"
): Promise<"conciliado" | "parcial" | "pendiente"> {
  const { data: banco } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("importe")
    .eq("id", movimientoBancoId)
    .single();

  const { data: pagos } = await agencyDb
    .from("contabilidad_movimientos")
    .select("importe_total")
    .eq("movimiento_banco_id", movimientoBancoId)
    .eq("estado", "confirmado");

  const { data: ofiPagos } = await agencyDb
    .from("ofi_pagos")
    .select("importe_conciliado")
    .eq("movimiento_banco_id", movimientoBancoId);

  const { data: ofiCobros } = await agencyDb
    .from("ofi_cobros")
    .select("importe_conciliado")
    .eq("movimiento_banco_id", movimientoBancoId);

  const totalContable = (pagos || []).reduce((sum: number, p: any) => sum + Number(p.importe_total || 0), 0);
  const totalOfiPagos = (ofiPagos || []).reduce((sum: number, p: any) => sum + Math.abs(Number(p.importe_conciliado || 0)), 0);
  const totalOfiCobros = (ofiCobros || []).reduce((sum: number, c: any) => sum + Math.abs(Number(c.importe_conciliado || 0)), 0);

  // Los OFI son la fuente de verdad. Si hay OFI vinculados, contar solo esos.
  // Si no hay OFI, contar contabilidad_movimientos (legacy).
  const totalConciliado = (ofiPagos || []).length > 0 || (ofiCobros || []).length > 0
    ? totalOfiPagos + totalOfiCobros
    : totalContable;
  const importeMovimiento = Math.abs(Number(banco?.importe || 0));

  let nuevoEstado: "conciliado" | "pendiente" | "parcial";
  if (totalConciliado === 0) {
    nuevoEstado = "pendiente";
  } else if (totalConciliado + 0.01 >= importeMovimiento) {
    nuevoEstado = "conciliado";
  } else {
    nuevoEstado = "parcial";
  }

  await agencyDb
    .from("contabilidad_movimientos_banco")
    .update({
      estado: nuevoEstado,
      conciliacion_tipo: conciliacionTipo,
      conciliado_at: nuevoEstado === "conciliado" ? new Date().toISOString() : null,
    })
    .eq("id", movimientoBancoId);

  return nuevoEstado;
}

export async function conciliarPagoProveedor(
  agencyDb: any,
  pagoId: string,
  movimientoBancoId: string
): Promise<{ success: boolean; documento_id?: string; proveedor_id?: string | null; expediente_id?: string | null; entidad_id?: string | null }> {
  const { data: pago, error: pagoError } = await agencyDb
    .from("operativa_documentos_pagos")
    .select("*")
    .eq("id", pagoId)
    .maybeSingle();

  if (pagoError || !pago) {
    throw new Error(`Plazo de pago no encontrado: ${pagoError?.message || ""}`);
  }

  const { data: movBanco, error: movBancoError } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("*")
    .eq("id", movimientoBancoId)
    .maybeSingle();

  if (movBancoError || !movBanco) {
    throw new Error(`Movimiento bancario no encontrado: ${movBancoError?.message || ""}`);
  }

  const { data: doc, error: docError } = await agencyDb
    .from("operativa_documentos_proveedor")
    .select("*")
    .eq("id", pago.documento_id)
    .maybeSingle();

  if (docError || !doc) {
    throw new Error(`Documento de proveedor no encontrado: ${docError?.message || ""}`);
  }

  const { data: docExp } = await agencyDb
    .from("operativa_documentos_expedientes")
    .select("expediente_id")
    .eq("documento_id", doc.id)
    .limit(1)
    .maybeSingle();
  const expedienteId = docExp?.expediente_id || null;

  let entidadId: string | null = null;

  if (doc.extraccion_json?.cabecera?.proveedor_nif) {
    const { data: entByNif } = await agencyDb
      .from("contabilidad_entidades")
      .select("id")
      .eq("documento", doc.extraccion_json.cabecera.proveedor_nif)
      .maybeSingle();
    if (entByNif) entidadId = entByNif.id;
  }

  if (!entidadId && doc.extraccion_json?.cabecera?.proveedor_nombre) {
    const { data: entByName } = await agencyDb
      .from("contabilidad_entidades")
      .select("id")
      .ilike("nombre", `%${doc.extraccion_json.cabecera.proveedor_nombre}%`)
      .limit(1);
    if (entByName && entByName.length > 0) {
      entidadId = entByName[0].id;
    }
  }

  if (!entidadId) {
    const { data: fallbackEnts } = await agencyDb
      .from("contabilidad_entidades")
      .select("id")
      .limit(1);
    if (fallbackEnts && fallbackEnts.length > 0) {
      entidadId = fallbackEnts[0].id;
    } else {
      throw new Error("No hay ninguna entidad registrada en contabilidad_entidades. Debe crear al menos una entidad para continuar.");
    }
  }

  const { data: movContable, error: mcError } = await agencyDb
    .from("contabilidad_movimientos")
    .insert([{ 
      entidad_id: entidadId,
      usuario_id: "550e8400-e29b-41d4-a716-446655440000",
      tipo: "pago",
      importe_total: Math.abs(Number(pago.importe)),
      moneda: movBanco.moneda || "EUR",
      medio_pago: "banco",
      tipo_servicio: "Proveedor - Pago",
      fecha: movBanco.fecha_operacion || new Date().toISOString().split("T")[0],
      concepto: `Pago Factura ${doc.documento_numero || ""} - ${doc.extraccion_json?.cabecera?.proveedor_nombre || "Proveedor"}`,
      estado: "confirmado",
      movimiento_banco_id: movimientoBancoId,
      expediente_id: expedienteId,
    }])
    .select("id")
    .single();

  if (mcError || !movContable) {
    throw new Error(`Error al insertar movimiento contable: ${mcError?.message || ""}`);
  }

  const { error: updPagoError } = await agencyDb
    .from("operativa_documentos_pagos")
    .update({ movimiento_banco_id: movimientoBancoId })
    .eq("id", pagoId);

  if (updPagoError) {
    console.error("Error linking payment installment to bank movement:", updPagoError);
  }

  await recalcularEstadoMovimientoBanco(agencyDb, movimientoBancoId, "manual");

  const { data: todosPagos } = await agencyDb
    .from("operativa_documentos_pagos")
    .select("id, importe, movimiento_banco_id")
    .eq("documento_id", doc.id);

  const nuevoAbonado = (todosPagos || []).reduce((acc: number, p: any) => {
    if (p.movimiento_banco_id || p.id === pagoId) {
      return acc + Number(p.importe || 0);
    }
    return acc;
  }, 0);

  const nuevoEstado = nuevoAbonado >= Number(doc.total_documento)
    ? "PAGADO"
    : nuevoAbonado > 0
      ? "PARCIAL"
      : "PENDIENTE";

  const { error: updDocError } = await agencyDb
    .from("operativa_documentos_proveedor")
    .update({
      importe_pagado: nuevoAbonado,
      estado_pago: nuevoEstado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  if (updDocError) {
    console.error("Error updating provider document summary:", updDocError);
  }

  return { success: true, documento_id: doc.id, proveedor_id: doc.proveedor_id, expediente_id: expedienteId, entidad_id: entidadId };
}

export async function generarApuntesPagoProveedor(
  agencyDb: any,
  params: {
    movimientoBancoId: string;
    importeTotal: number;
    proveedorId: string | null;
    expedienteId: string | null;
    entidadId: string | null;
    concepto: string;
    fecha: string;
  }
): Promise<{ apunteId: string | null }> {
  let apunteId: string | null = null;
  try {
    const { data: movBanco } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("cuenta_bancaria_id")
      .eq("id", params.movimientoBancoId)
      .maybeSingle();

    if (!movBanco) return { apunteId: null };

    const { data: cuentaBancaria } = await agencyDb
      .from("config_cuentas_bancarias")
      .select("cuenta_contable")
      .eq("id", movBanco.cuenta_bancaria_id)
      .maybeSingle();

    const cuentaBancoCodigo = cuentaBancaria?.cuenta_contable || "572";

    let cuentaProveedorCodigo = "400";
    if (params.proveedorId) {
      const { data: prov } = await agencyDb
        .from("contabilidad_proveedores")
        .select("cuenta_contable")
        .eq("id", params.proveedorId)
        .maybeSingle();
      if (prov?.cuenta_contable) cuentaProveedorCodigo = prov.cuenta_contable;
    }

    const { data: cuentasContables } = await agencyDb
      .from("config_cuentas_contables")
      .select("id, codigo")
      .in("codigo", [cuentaBancoCodigo, cuentaProveedorCodigo]);

    let uuidDebe = cuentasContables?.find((c: any) => c.codigo === cuentaProveedorCodigo)?.id;
    let uuidHaber = cuentasContables?.find((c: any) => c.codigo === cuentaBancoCodigo)?.id;

    if (!uuidDebe || !uuidHaber) {
      const { data: fallbackCuentas } = await agencyDb
        .from("config_cuentas_contables")
        .select("id")
        .limit(2);
      uuidDebe = uuidDebe || fallbackCuentas?.[0]?.id;
      uuidHaber = uuidHaber || fallbackCuentas?.[1]?.id || fallbackCuentas?.[0]?.id;
    }

    if (uuidDebe && uuidHaber) {
      const importe = Math.abs(params.importeTotal);

      const { data: apuntesCreados } = await agencyDb
        .from("contabilidad_apuntes")
        .insert([
          {
            asiento_id: null,
            fecha: params.fecha,
            cuenta_id: uuidDebe,
            entidad_id: null,
            proveedor_id: params.proveedorId,
            subcuenta: cuentaProveedorCodigo,
            debe: importe,
            haber: 0,
            concepto: params.concepto,
            expediente_id: params.expedienteId,
          },
          {
            asiento_id: null,
            fecha: params.fecha,
            cuenta_id: uuidHaber,
            entidad_id: null,
            proveedor_id: params.proveedorId,
            subcuenta: cuentaBancoCodigo,
            debe: 0,
            haber: importe,
            concepto: params.concepto,
            expediente_id: params.expedienteId,
          },
        ])
        .select("id");

      apunteId = apuntesCreados?.[0]?.id || null;
    }

    if (apunteId) {
      await agencyDb
        .from("contabilidad_movimientos_banco")
        .update({ apunte_id: apunteId })
        .eq("id", params.movimientoBancoId);
    }
  } catch (acError) {
    console.error("Error creating pending apuntes for provider payment:", acError);
  }

  return { apunteId };
}

export async function ejecutarConciliacionMovimiento(
  agencyDb: any,
  movimientoBancoId: string,
  pagoDocumentoIds: string[]
): Promise<{ success: boolean; error?: string; documento_id?: string; proveedor_id?: string | null; expediente_id?: string | null; entidad_id?: string | null }> {
  const { data: movimiento } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("importe, fecha_operacion, match_metadatos, moneda")
    .eq("id", movimientoBancoId)
    .maybeSingle();

  if (!movimiento) {
    return { success: false, error: "Movimiento bancario no encontrado" };
  }

  const meta = movimiento.match_metadatos as any;
  const esServicio = meta?.origen === "servicio";

  if (esServicio) {
    if (!meta?.expediente_id) {
      return { success: false, error: "El servicio no está vinculado a un expediente" };
    }

    let entidadId: string | null = null;
    if (meta.proveedor_nombre) {
      const { data: entByName } = await agencyDb
        .from("contabilidad_entidades")
        .select("id")
        .ilike("nombre", `%${meta.proveedor_nombre}%`)
        .limit(1);
      if (entByName && entByName.length > 0) entidadId = entByName[0].id;
    }

    if (!entidadId) {
      const { data: fallbackEnts } = await agencyDb.from("contabilidad_entidades").select("id").limit(1);
      entidadId = fallbackEnts?.[0]?.id || null;
    }

    const importeTotal = Math.abs(Number(movimiento.importe || 0));
    const proveedorNombre = meta.proveedor_nombre || "Proveedor";

    const { data: movContable, error: mcError } = await agencyDb
      .from("contabilidad_movimientos")
      .insert([{ 
        entidad_id: entidadId,
        usuario_id: "550e8400-e29b-41d4-a716-446655440000",
        tipo: "pago",
        importe_total: importeTotal,
        moneda: movimiento.moneda || "EUR",
        medio_pago: "banco",
        tipo_servicio: "Proveedor - Pago",
        fecha: movimiento.fecha_operacion || new Date().toISOString().split("T")[0],
        concepto: `Pago Servicio: ${proveedorNombre}`,
        estado: "confirmado",
        movimiento_banco_id: movimientoBancoId,
        expediente_id: meta.expediente_id,
      }])
      .select("id")
      .single();

    if (mcError || !movContable) {
      return { success: false, error: `Error al insertar movimiento contable: ${mcError?.message || ""}` };
    }

    await recalcularEstadoMovimientoBanco(agencyDb, movimientoBancoId, "manual");

    return { success: true, documento_id: meta.documento_id, proveedor_id: meta.proveedor_id || null, expediente_id: meta.expediente_id, entidad_id: entidadId };
  }

  if (!pagoDocumentoIds || pagoDocumentoIds.length === 0) {
    return { success: false, error: "Debes seleccionar al menos un plazo" };
  }

  const { data: pagos, error: pagosError } = await agencyDb
    .from("operativa_documentos_pagos")
    .select("id, importe, documento_id")
    .in("id", pagoDocumentoIds);

  if (pagosError || !pagos || pagos.length === 0) {
    return { success: false, error: "No se encontraron los pagos seleccionados" };
  }

  const sumaPagos = pagos.reduce((sum: number, p: any) => sum + Number(p.importe || 0), 0);
  const exceso = sumaPagos - Math.abs(Number(movimiento.importe || 0));
  if (exceso > 5) {
    return { success: false, error: `Los pagos seleccionados superan el importe del movimiento en ${exceso.toFixed(2)}€` };
  }

  let lastResult: any = null;
  for (const pago of pagos) {
    const result = await conciliarPagoProveedor(agencyDb, pago.id, movimientoBancoId);
    if (!result.success) {
      return { success: false, error: `Error conciliando pago ${pago.id}` };
    }
    lastResult = result;
  }

  return { success: true, documento_id: lastResult?.documento_id, proveedor_id: lastResult?.proveedor_id || null, expediente_id: lastResult?.expediente_id || null, entidad_id: lastResult?.entidad_id || null };
}

/**
 * Conciliación manual libre: el agente introduce un importe (por defecto el
 * pendiente del movimiento bancario) y opcionalmente un expediente OFI de
 * referencia, sin necesidad de un documento/proveedor concreto. Si el
 * importe no cubre el total del movimiento, queda en estado "parcial" y se
 * puede volver a conciliar más adelante con el resto (mismo mecanismo que
 * las demás conciliaciones, vía recalcularEstadoMovimientoBanco).
 */
export async function ejecutarConciliacionManual(
  agencyDb: any,
  movimientoBancoId: string,
  importe: number,
  expedienteOfi?: string,
  usuarioId?: string,
  voboDc?: boolean,
  nota?: string,
  esGastoFinanciero?: boolean
): Promise<{ success: boolean; error?: string; estado?: "conciliado" | "parcial" | "pendiente" }> {
  const { data: movimiento, error: movError } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("importe, fecha_operacion, moneda, concepto_original")
    .eq("id", movimientoBancoId)
    .maybeSingle();

  if (movError || !movimiento) {
    return { success: false, error: "Movimiento bancario no encontrado" };
  }

  if (!importe || importe <= 0) {
    return { success: false, error: "El importe debe ser mayor que 0" };
  }

  const { data: pagosExistentes } = await agencyDb
    .from("contabilidad_movimientos")
    .select("importe_total")
    .eq("movimiento_banco_id", movimientoBancoId)
    .eq("estado", "confirmado");

  const yaConciliado = (pagosExistentes || []).reduce((sum: number, p: any) => sum + Number(p.importe_total || 0), 0);
  const importeMovimiento = Math.abs(Number(movimiento.importe || 0));
  const exceso = yaConciliado + importe - importeMovimiento;
  if (exceso > 0.01) {
    return { success: false, error: `El importe supera lo pendiente por conciliar (quedan ${(importeMovimiento - yaConciliado).toFixed(2)}€)` };
  }

  const { error: mcError } = await agencyDb.from("contabilidad_movimientos").insert([
    {
      entidad_id: null,
      usuario_id: usuarioId || "550e8400-e29b-41d4-a716-446655440000",
      tipo: "pago",
      importe_total: importe,
      moneda: movimiento.moneda || "EUR",
      medio_pago: "banco",
      tipo_servicio: "Conciliación manual",
      fecha: movimiento.fecha_operacion || new Date().toISOString().split("T")[0],
      concepto: expedienteOfi
        ? `Conciliación manual · Expediente OFI: ${expedienteOfi}`
        : movimiento.concepto_original || "Conciliación manual",
      estado: "confirmado",
      movimiento_banco_id: movimientoBancoId,
      expediente_id: null,
      vobo_dc: !!voboDc,
      nota: nota || null,
      es_gasto_financiero: !!esGastoFinanciero,
    },
  ]);

  if (mcError) {
    return { success: false, error: `Error al registrar la conciliación: ${mcError.message}` };
  }

  if (esGastoFinanciero) {
    const { error: updateError } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({ es_gasto_financiero: true })
      .eq("id", movimientoBancoId);
    if (updateError) {
      console.error("Error actualizando es_gasto_financiero:", updateError);
    }
  }

  const nuevoEstado = await recalcularEstadoMovimientoBanco(agencyDb, movimientoBancoId, "manual");

  return { success: true, estado: nuevoEstado };
}

export async function ejecutarConciliacionTutor(
  movimientoId: string,
  expedienteId: string,
  entidadId: string,
  importeMovimiento: number
) {
  const result = await ejecutarConciliacionGroomy({
    movimientoBancoId: movimientoId,
    entidadId,
    expedienteId,
    usuarioId: "550e8400-e29b-41d4-a716-446655440000",
    importeImputado: importeMovimiento,
  });

  return result;
}
