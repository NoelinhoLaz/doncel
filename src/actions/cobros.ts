"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

export async function getCobrosByExpediente(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: pagadoresData, error: err1 } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("*, contabilidad_entidades!operativa_pagadores_expedientes_entidad_id_fkey(id, nombre, documento, email, telefono)")
      .eq("expediente_id", expedienteId);
    if (err1) throw err1;

    const { data: movimientosData, error: err2 } = await agencyDb
      .from("contabilidad_movimientos")
      .select("*, contabilidad_entidades!contabilidad_movimientos_entidad_id_fkey(id, nombre), contabilidad_movimientos_imputaciones(*, contabilidad_entidades!contabilidad_movimientos_imputaciones_viajero_id_fkey(id, nombre))")
      .eq("expediente_id", expedienteId)
      .order("fecha", { ascending: false });
    if (err2) throw err2;

    const movimientos = (movimientosData || []).map((mov: any) => {
      const viajeros = (mov.contabilidad_movimientos_imputaciones || []).map((imp: any) => ({
        viajero_id: imp.viajero_id,
        viajero_nombre: imp.contabilidad_entidades?.nombre || "",
        importe: imp.importe,
      }));
      return { ...mov, entidad_nombre: mov.contabilidad_entidades?.nombre || "", viajeros };
    });

    const { data: bancosData, error: err3 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("*, config_cuentas_bancarias(banco, iban)")
      .eq("deleted", false)
      .eq("match_metadatos->>expediente_id", expedienteId)
      .order("fecha_operacion", { ascending: false });
    if (err3) throw err3;

    return {
      pagadores: pagadoresData || [],
      movimientos: movimientos || [],
      movimientosBanco: bancosData || [],
    };
  } catch (error: any) {
    console.error("Failed to get cobros by expediente:", error.message);
    return { pagadores: [], movimientos: [], movimientosBanco: [] };
  }
}

export async function updateExpedientePvp(expedienteId: string, payload: {
  pvp_viajero?: number | null;
  pvp_total?: number | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const updatePayload: any = {};
    if (payload.pvp_viajero !== undefined) updatePayload.pvp_viajero = payload.pvp_viajero;
    if (payload.pvp_total !== undefined) updatePayload.pvp_total = payload.pvp_total;

    const { error } = await agencyDb
      .from("operativa_expedientes")
      .update(updatePayload)
      .eq("id", expedienteId);

    if (error) throw error;
    revalidatePath("/expedientes");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update expediente pvp:", error.message);
    throw new Error(error.message || "Failed to update expediente pvp");
  }
}

export async function getReembolsosByExpediente(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_movimientos")
      .select("*, contabilidad_entidades!contabilidad_movimientos_entidad_id_fkey(id, nombre)")
      .eq("expediente_id", expedienteId)
      .in("tipo", ["reembolso_cobro", "reembolso_pago"])
      .order("fecha", { ascending: false });

    if (error) {
      console.error("getReembolsosByExpediente error:", error);
      return [];
    }
    return (data || []).map((r: any) => ({
      ...r,
      entidad_nombre: r.contabilidad_entidades?.nombre || "",
    }));
  } catch (error: any) {
    console.error("Failed to get reembolsos:", error.message);
    return [];
  }
}

export async function createReembolsoMovimiento(payload: {
  expediente_id: string;
  entidad_id: string;
  tipo: "reembolso_cobro" | "reembolso_pago";
  importe_total: number;
  concepto: string;
  medio_pago: "banco" | "efectivo" | "tarjeta" | "online";
  fecha: string;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_movimientos")
      .insert([{
        entidad_id: payload.entidad_id,
        usuario_id: "550e8400-e29b-41d4-a716-446655440000",
        tipo: payload.tipo,
        importe_total: payload.importe_total,
        moneda: "EUR",
        medio_pago: payload.medio_pago,
        fecha: payload.fecha,
        concepto: payload.concepto,
        estado: "pendiente",
        expediente_id: payload.expediente_id,
      }])
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, id: (data as any).id };
  } catch (error: any) {
    console.error("Failed to create reembolso movimiento:", error.message);
    return { success: false, error: error.message };
  }
}

export async function vincularReembolsoAMovimientoBanco(reembolsoId: string, movimientoBancoId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { error: errMov } = await agencyDb
      .from("contabilidad_movimientos")
      .update({ movimiento_banco_id: movimientoBancoId, estado: "confirmado" })
      .eq("id", reembolsoId);
    if (errMov) throw errMov;

    const { error: errBanco } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({ estado: "conciliado" })
      .eq("id", movimientoBancoId);
    if (errBanco) throw errBanco;

    revalidatePath("/expedientes");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to vincular reembolso a movimiento banco:", error.message);
    return { success: false, error: error.message };
  }
}

export async function registrarCobroOficina(payload: {
  expediente_id: string;
  medio_pago: "efectivo" | "tarjeta" | "transferencia";
  cuenta_bancaria_id: string;
  selectedViajerosIds: string[];
  selectedClientesIds: string[];
  importe: number;
  tique?: string;
  fecha?: string;
  movimiento_banco_id?: string | null;
  // Cuando un viajero (operativa_viajeros_expedientes.id) tiene varios pagadores, permite
  // elegir explícitamente a cuál se imputa el cobro. Si no se indica, se usa el pagador principal.
  pagadorPorViajero?: Record<string, string>;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { expediente_id, medio_pago, cuenta_bancaria_id, selectedViajerosIds, selectedClientesIds, importe, tique, movimiento_banco_id, pagadorPorViajero = {} } = payload;

    const { data: expediente, error: errExp } = await agencyDb
      .from("operativa_expedientes")
      .select("genera_apunte")
      .eq("id", expediente_id)
      .maybeSingle();

    if (errExp) throw errExp;
    const generaApunte = expediente?.genera_apunte ?? false;

    const { data: cBancaria, error: errCb } = await agencyDb
      .from("config_cuentas_bancarias")
      .select("cuenta_contable")
      .eq("id", cuenta_bancaria_id)
      .maybeSingle();

    if (errCb) throw errCb;
    const subcuentaBanco = cBancaria?.cuenta_contable || (medio_pago === "efectivo" ? "57000010000" : medio_pago === "tarjeta" ? "57250010000" : "57200010000");

    const entitiesToInsert: Array<{ entityId: string; isTraveler: boolean; viajeroId?: string }> = [];

    if (selectedViajerosIds.length > 0) {
      const { data: travelers, error: errTr } = await agencyDb
        .from("operativa_viajeros_expedientes")
        .select("id, entidad_id")
        .in("id", selectedViajerosIds);
      if (errTr) throw errTr;
      (travelers || []).forEach((t: any) => {
        if (t.entidad_id) entitiesToInsert.push({ entityId: t.entidad_id, isTraveler: true, viajeroId: t.id });
      });
    }

    selectedClientesIds.forEach((cId) => entitiesToInsert.push({ entityId: cId, isTraveler: false }));

    if (entitiesToInsert.length === 0) throw new Error("No se ha seleccionado ningún viajero ni cliente.");

    const N = entitiesToInsert.length;
    let remaining = importe;
    const today = payload.fecha || new Date().toISOString().split("T")[0];
    const results: string[] = [];

    for (let i = 0; i < N; i++) {
      const { entityId, isTraveler, viajeroId } = entitiesToInsert[i];
      const isLast = i === N - 1;
      const itemImporte = isLast ? parseFloat(remaining.toFixed(2)) : parseFloat((importe / N).toFixed(2));
      remaining -= itemImporte;
      if (itemImporte <= 0) continue;

      const { data: entData, error: errEnt } = await agencyDb
        .from("contabilidad_entidades")
        .select("nombre, cuentas_contables")
        .eq("id", entityId)
        .maybeSingle();
      if (errEnt) throw errEnt;

      const subcuentaCliente = entData?.cuentas_contables?.cuenta_cliente
        || entData?.cuentas_contables?.cliente
        || "43000010000";
      const subcuentaAnticipo = "438" + subcuentaCliente.substring(3);

      const concepto = medio_pago === "efectivo"
        ? "Cobro en efectivo - Anticipo plaza viaje"
        : medio_pago === "tarjeta"
          ? `Cobro TPV${tique ? " Nº Tique " + tique : ""} - Anticipo plaza viaje`
          : "Cobro por transferencia - Anticipo plaza viaje";
      // Transferencia solo queda confirmada si ya se ha vinculado a un
      // movimiento bancario real; si no, se deja pendiente de conciliar.
      const estado = medio_pago === "transferencia" && !movimiento_banco_id ? "pendiente" : "confirmado";
      const medioPagoDb = medio_pago === "transferencia" ? "banco" : medio_pago;

      const { data: movimiento, error: errMov } = await agencyDb
        .from("contabilidad_movimientos")
        .insert([{
          entidad_id: entityId,
          usuario_id: "550e8400-e29b-41d4-a716-446655440000",
          tipo: "cobro",
          importe_total: itemImporte,
          moneda: "EUR",
          medio_pago: medioPagoDb,
          fecha: today,
          concepto,
          estado,
          movimiento_banco_id: movimiento_banco_id || null,
          expediente_id,
        }])
        .select("id")
        .single();

      if (errMov || !movimiento) throw new Error(`Error al insertar movimiento contable: ${errMov?.message}`);
      results.push(movimiento.id);

      if (isTraveler) {
        const { error: errImp } = await agencyDb
          .from("contabilidad_movimientos_imputaciones")
          .insert([{
            movimiento_id: movimiento.id,
            expediente_id,
            viajero_id: entityId,
            importe: itemImporte,
          }]);
        if (errImp) throw errImp;
      }

      if (generaApunte) {
        const ctaDebeMaster = medio_pago === "efectivo" ? "570" : medio_pago === "tarjeta" ? "4109" : "572";
        const ctaHaberMaster = "438";

        const { data: cuentasContables, error: errCtas } = await agencyDb
          .from("config_cuentas_contables")
          .select("id, codigo")
          .in("codigo", [ctaDebeMaster, ctaHaberMaster]);

        if (errCtas) throw errCtas;

        let uuidDebe = cuentasContables?.find((c: any) => c.codigo === ctaDebeMaster)?.id;
        let uuidHaber = cuentasContables?.find((c: any) => c.codigo === ctaHaberMaster)?.id;

        if (!uuidDebe || !uuidHaber) {
          const { data: fallbackCuentas } = await agencyDb
            .from("config_cuentas_contables")
            .select("id")
            .limit(2);
          uuidDebe = uuidDebe || fallbackCuentas?.[0]?.id;
          uuidHaber = uuidHaber || fallbackCuentas?.[1]?.id || fallbackCuentas?.[0]?.id;
        }

        if (uuidDebe && uuidHaber) {
          const { error: errAp } = await agencyDb
            .from("contabilidad_apuntes")
            .insert([
              { asiento_id: null, fecha: today, cuenta_id: uuidDebe, entidad_id: entityId, subcuenta: subcuentaBanco, debe: itemImporte, haber: 0, concepto, expediente_id },
              { asiento_id: null, fecha: today, cuenta_id: uuidHaber, entidad_id: entityId, subcuenta: subcuentaAnticipo, debe: 0, haber: itemImporte, concepto, expediente_id },
            ]);
          if (errAp) throw errAp;
        }
      }

      const pagadorElegido = viajeroId ? pagadorPorViajero[viajeroId] : undefined;
      let pagadorEntidadId = pagadorElegido || entityId;
      if (!pagadorElegido) {
        const { data: travelerObj } = await agencyDb
          .from("operativa_viajeros_expedientes")
          .select("pagador_id")
          .eq("expediente_id", expediente_id)
          .eq("entidad_id", entityId)
          .maybeSingle();
        pagadorEntidadId = travelerObj?.pagador_id || entityId;
      }

      const { data: pagadorRecord, error: errPag } = await agencyDb
        .from("operativa_pagadores_expedientes")
        .select("id, importe_abonado, importe_total")
        .eq("expediente_id", expediente_id)
        .eq("entidad_id", pagadorEntidadId)
        .maybeSingle();

      if (errPag) throw errPag;

      if (pagadorRecord) {
        const nuevoAbonado = Number(pagadorRecord.importe_abonado || 0) + itemImporte;
        const nuevoEstado = nuevoAbonado >= Number(pagadorRecord.importe_total || 0)
          ? "completado"
          : nuevoAbonado > 0 ? "parcial" : "pendiente";

        const { error: errUpdPag } = await agencyDb
          .from("operativa_pagadores_expedientes")
          .update({ importe_abonado: nuevoAbonado, estado: nuevoEstado, updated_at: new Date().toISOString() })
          .eq("id", pagadorRecord.id);

        if (errUpdPag) throw errUpdPag;
      }
    }

    revalidatePath(`/expedientes/${expediente_id}`);
    return { success: true, ids: results };
  } catch (error: any) {
    console.error("Failed to register office payment:", error.message);
    return { success: false, error: error.message };
  }
}

export async function getUrlJustificantePago(pagadorExpedienteId: string) {
  try {
    const { getAgencyContext } = await import("@/lib/agencyDb");
    const { getUrlFirmadaJustificantePago } = await import("@/lib/documentos/storage");
    const { schemaName } = await getAgencyContext();
    const agencyDb = await getAgencyDbClient();

    const { data: pagador, error } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("justificante_path")
      .eq("id", pagadorExpedienteId)
      .single();
    if (error) throw error;
    if (!pagador?.justificante_path) return { error: "Este pagador no tiene justificante" };

    const url = await getUrlFirmadaJustificantePago(agencyDb, schemaName, pagador.justificante_path);
    if (!url) return { error: "No se pudo generar el enlace del justificante" };
    return { url };
  } catch (error: any) {
    console.error("Failed to get justificante url:", error.message);
    return { error: error.message || "Error al obtener el justificante" };
  }
}
