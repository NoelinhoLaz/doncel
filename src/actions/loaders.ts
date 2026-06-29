export interface RecalcularMatchesData {
  pagosPendientes: any[];
  pagadoresConViajeros: any[];
  reembolsosCobro: any[];
  reembolsosPago: any[];
  serviciosPendientes: any[];
}

export async function loadRecalcularMatchesData(agencyDb: any): Promise<RecalcularMatchesData> {
  const { data: pagosPendientes, error: errorPagos } = await agencyDb
    .from("operativa_documentos_pagos")
    .select(`
      id,
      documento_id,
      importe,
      metodo_pago,
      referencia,
      fecha_movimiento,
      operativa_documentos_proveedor(
        documento_numero,
        total_documento,
        extraccion_json,
        contabilidad_proveedores(
          nombre,
          razon_social,
          CIF
        ),
        operativa_documentos_expedientes(
          es_principal,
          operativa_expedientes(
            id,
            numero,
            referencia
          )
        )
      )
    `)
    .is("movimiento_banco_id", null);

  if (errorPagos) {
    console.error("Error fetching pending payments for batch calculation:", errorPagos);
    throw errorPagos;
  }

  const { data: pagadoresPendientes, error: errorPagadores } = await agencyDb
    .from("operativa_pagadores_expedientes")
    .select(`
      id,
      expediente_id,
      entidad_id,
      importe_total,
      importe_abonado,
      cuenta_bancaria,
      plazos,
      metadatos_match,
      contabilidad_entidades!operativa_pagadores_expedientes_entidad_id_fkey(
        id, nombre, documento, metadatos
      ),
      operativa_expedientes(
        id, referencia, numero
      )
    `)
    .in("estado", ["pendiente", "parcial", "completado"]);

  if (errorPagadores) {
    console.error("Error fetching pending pagadores for batch calculation:", errorPagadores);
    throw errorPagadores;
  }

  const expedienteIds = (pagadoresPendientes || [])
    .map((p: any) => p.expediente_id)
    .filter(Boolean);

  let viajerosData: any[] = [];
  if (expedienteIds.length > 0) {
    let page = 0;
    const limit = 1000;

    while (true) {
      const { data: vData, error: vError } = await agencyDb
        .from("operativa_viajeros_expedientes")
        .select(`
          id,
          expediente_id,
          entidad_id,
          tutor_id,
          pagador_id,
          contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(id, nombre, metadatos)
        `)
        .in("expediente_id", expedienteIds)
        .range(page * limit, (page + 1) * limit - 1);

      if (vError) {
        console.error("Error fetching viajerosData in loader:", vError);
        break;
      }

      if (!vData || vData.length === 0) break;
      viajerosData = viajerosData.concat(vData);
      if (vData.length < limit) break;
      page++;
    }
  }

  const pagadoresConViajeros = (pagadoresPendientes || []).map((p: any) => {
    const pagadorNombre: string = p.contabilidad_entidades?.nombre || "";

    // Primer apellido del pagador — usado como red de seguridad para detectar
    // viajeros familiares cuando pagador_id no está explícitamente enlazado
    const primerApellidoPagador = pagadorNombre.split(/\s+/)[1]?.toLowerCase() || "";

    const viajerosDirectos = viajerosData.filter(
      (v) => v.expediente_id === p.expediente_id && (v.pagador_id === p.entidad_id || v.tutor_id === p.entidad_id)
    );

    // La contingencia por apellido solo se activa cuando no hay ningún viajero con enlace directo,
    // para evitar que pagadores con el mismo apellido "roben" viajeros de otro pagador del mismo expediente.
    const viajeros = viajerosDirectos.length > 0
      ? viajerosDirectos
      : viajerosData.filter((v) => {
          if (v.expediente_id !== p.expediente_id) return false;
          if (primerApellidoPagador.length >= 3) {
            const nombreViajero: string = (v.contabilidad_entidades?.nombre || "").toLowerCase();
            if (nombreViajero.includes(primerApellidoPagador)) return true;
            const metV = v.contabilidad_entidades?.metadatos;
            const metVObj = typeof metV === "string" ? (() => { try { return JSON.parse(metV); } catch { return null; } })() : (metV ?? null);
            const palabrasMatch: string[] = metVObj?.palabras_match || [];
            if (palabrasMatch.includes(primerApellidoPagador)) return true;
          }
          return false;
        });

    return {
      ...p,
      id: p.expediente_id,      // el motor usa e.id como expediente_id en el resultado
      pagador_id: p.entidad_id, // el motor devuelve e.pagador_id como entidad UUID del tutor
      pagador_nombre: pagadorNombre,
      viajero_nombre: viajeros
        .map((v) => {
          const nombre: string = v.contabilidad_entidades?.nombre || "";
          const metV = v.contabilidad_entidades?.metadatos;
          const metVObj = typeof metV === "string" ? (() => { try { return JSON.parse(metV); } catch { return null; } })() : (metV ?? null);
          const palabrasMatch: string[] = metVObj?.palabras_match || [];
          const extra = palabrasMatch.filter((w: string) => !nombre.toLowerCase().includes(w)).join(" ");
          return extra ? `${nombre} ${extra}` : nombre;
        })
        .filter(Boolean)
        .join(" "),
      expediente_numero: p.operativa_expedientes?.numero || "",
      expediente_referencia: p.operativa_expedientes?.referencia || "",
      viajeros: viajeros.map((v) => ({
        id: v.entidad_id,
        nombre: v.contabilidad_entidades?.nombre || "",
        palabras_match: (() => {
          const metV = v.contabilidad_entidades?.metadatos;
          const metVObj = typeof metV === "string" ? (() => { try { return JSON.parse(metV); } catch { return null; } })() : (metV ?? null);
          return metVObj?.palabras_match ?? [];
        })(),
      })),
      operativa_viajeros_expedientes: viajeros,
    };
  }) || [];

  const { data: reembolsosPendientes, error: errorReembolsos } = await agencyDb
    .from("contabilidad_movimientos")
    .select("id, concepto, importe_total, expediente_id, tipo")
    .in("tipo", ["reembolso_cobro", "reembolso_pago"])
    .is("movimiento_banco_id", null);

  if (errorReembolsos) {
    console.error("Error fetching pending reembolsos for batch calculation:", errorReembolsos);
    throw errorReembolsos;
  }

  const reembolsoExpedienteIds = Array.from(new Set(
    (reembolsosPendientes || [])
      .map((r: any) => r.expediente_id)
      .filter(Boolean)
  ));

  const nombresPorExpediente = new Map<string, { viajeros: Set<string>; tutores: Set<string> }>();
  if (reembolsoExpedienteIds.length > 0) {
    const { data: viajerosReembolso, error: errorViajerosReembolso } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select(`
        expediente_id,
        viajero:contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(id, nombre),
        tutor:contabilidad_entidades!operativa_viajeros_expedientes_tutor_id_fkey(id, nombre)
      `)
      .in("expediente_id", reembolsoExpedienteIds);

    if (!errorViajerosReembolso && viajerosReembolso) {
      for (const row of viajerosReembolso) {
        const key = row.expediente_id;
        const entry = nombresPorExpediente.get(key) || { viajeros: new Set(), tutores: new Set() };
        if (row.viajero?.nombre) entry.viajeros.add(row.viajero.nombre);
        if (row.tutor?.nombre) entry.tutores.add(row.tutor.nombre);
        nombresPorExpediente.set(key, entry);
      }
    }
  }

  const reembolsosConNombres = (reembolsosPendientes || []).map((r: any) => {
    const names = nombresPorExpediente.get(r.expediente_id);
    return {
      ...r,
      viajero_nombre: names ? Array.from(names.viajeros).join(" ") : "",
      tutor_nombre: names ? Array.from(names.tutores).join(" ") : "",
    };
  });

  let serviciosPendientes: any[];
  {
    const { data: vData } = await agencyDb
      .from("v_servicios_match")
      .select("id, expediente_id, proveedor, descripcion, importe_efectivo, exp_numero, exp_referencia");
    if (vData) {
      serviciosPendientes = vData;
    } else {
      const { data: raw } = await agencyDb
        .from("operativa_expedientes_servicios")
        .select("id, expediente_id, proveedor, descripcion, total, pvp, neto");
      const rawMap = (raw || []).map((sv: any) => {
        const importe = Number(sv.total) || Number(sv.pvp) || Number(sv.neto) || 0;
        return { ...sv, importe_efectivo: importe };
      });
      const expIds = [...new Set(rawMap.map((sv: any) => sv.expediente_id).filter(Boolean))] as string[];
      let expMap: Record<string, { numero: string; referencia: string }> = {};
      if (expIds.length > 0) {
        const { data: exps } = await agencyDb
          .from("operativa_expedientes")
          .select("id, numero, referencia")
          .in("id", expIds);
        (exps || []).forEach((e: any) => { expMap[e.id] = e; });
      }
      serviciosPendientes = rawMap.map((sv: any) => ({
        ...sv,
        exp_numero: expMap[sv.expediente_id]?.numero || "",
        exp_referencia: expMap[sv.expediente_id]?.referencia || "",
      }));
    }
  }

  return {
    pagosPendientes: pagosPendientes || [],
    pagadoresConViajeros,
    reembolsosCobro: reembolsosConNombres.filter((r: any) => r.tipo === "reembolso_cobro"),
    reembolsosPago: reembolsosConNombres.filter((r: any) => r.tipo === "reembolso_pago"),
    serviciosPendientes: serviciosPendientes || [],
  };
}
