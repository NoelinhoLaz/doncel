"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";
import {
  PagadorInvoicingStatus, FacturaEmitida, CrearFacturaItem, CierreReavResult,
} from "./facturacion.types";
import { _declararVerifactu } from "./facturacion.verifactu";

export async function getFacturasEmitidasByExpediente(expedienteId: string): Promise<FacturaEmitida[]> {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("facturas_emitidas")
      .select(`*, facturas_emitidas_lineas (*)`)
      .eq("expediente_id", expedienteId)
      .order("fecha_emision", { ascending: false });

    if (error) {
      console.error("Error fetching facturas emitidas:", error);
      return [];
    }

    return (data || []).map((f: any) => ({
      ...f,
      importe_total: Number(f.importe_total),
      lineas: (f.facturas_emitidas_lineas || []).map((l: any) => ({
        ...l,
        importe_neto: Number(l.importe_neto),
        porcentaje_iva: Number(l.porcentaje_iva),
        cuota_iva: Number(l.cuota_iva),
        importe_total_linea: Number(l.importe_total_linea),
      })),
    }));
  } catch (err: any) {
    console.error("Failed to get facturas emitidas:", err.message);
    return [];
  }
}

export async function getPagadoresInvoicingStatus(
  expedienteId: string
): Promise<PagadorInvoicingStatus[]> {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: pagadores, error: err1 } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select(`
        id, expediente_id, entidad_id, importe_abonado,
        contabilidad_entidades!operativa_pagadores_expedientes_entidad_id_fkey(id, nombre, documento)
      `)
      .eq("expediente_id", expedienteId);

    if (err1 || !pagadores) {
      console.error("Error fetching pagadores:", err1);
      return [];
    }

    const { data: exp } = await agencyDb
      .from("operativa_expedientes")
      .select("referencia, regimen_iva_sugerido")
      .eq("id", expedienteId)
      .maybeSingle();

    const regimenDefault: "REAV" | "GENERAL" = exp?.regimen_iva_sugerido || "REAV";
    const expReferencia = exp?.referencia || "Expediente";

    const { data: viajeros } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select(`pagador_id, contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey (nombre)`)
      .eq("expediente_id", expedienteId);

    const result: PagadorInvoicingStatus[] = [];

    for (const pag of pagadores) {
      const entidad = pag.contabilidad_entidades as any;
      const nombre = entidad?.nombre || "Sin nombre";
      const nif = entidad?.documento || "";

      const { data: facturasExistentes } = await agencyDb
        .from("facturas_emitidas")
        .select("importe_total")
        .eq("expediente_id", expedienteId)
        .eq("pagador_id", pag.entidad_id);

      const importeFacturado = (facturasExistentes || []).reduce(
        (sum: number, f: any) => sum + Number(f.importe_total || 0), 0
      );
      const importeAbonado = Number(pag.importe_abonado || 0);
      const importeAFacturar = Math.max(0, importeAbonado - importeFacturado);

      const viajerosPagador = (viajeros || [])
        .filter((v: any) => v.pagador_id === pag.entidad_id)
        .map((v: any) => v.contabilidad_entidades?.nombre)
        .filter(Boolean);
      const viajeroNombre = viajerosPagador.length > 0 ? viajerosPagador.join(", ") : "—";

      if (importeAbonado > 0) {
        result.push({
          id: pag.id, expediente_id: pag.expediente_id, entidad_id: pag.entidad_id,
          importe_abonado: importeAbonado, importe_facturado: importeFacturado,
          importe_a_facturar: importeAFacturar, cliente_nombre: nombre, cliente_nif: nif,
          regimen_iva: regimenDefault, viajero_nombre: viajeroNombre,
          expediente_referencia: expReferencia,
        });
      }
    }

    return result;
  } catch (err: any) {
    console.error("Failed to get pagadores invoicing status:", err.message);
    return [];
  }
}

export async function crearFacturasMasivas(
  expedienteId: string,
  items: CrearFacturaItem[]
): Promise<{ success: boolean; error?: string; created: number }> {
  if (!items || items.length === 0) {
    return { success: false, error: "No hay ítems para facturar", created: 0 };
  }

  try {
    const agencyDb = await getAgencyDbClient();

    const currentYear = new Date().getFullYear();
    const { data: ultimaFactura } = await agencyDb
      .from("facturas_emitidas")
      .select("numero_factura")
      .ilike("numero_factura", `F${currentYear}-%`)
      .order("numero_factura", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSeq = 1;
    if (ultimaFactura?.numero_factura) {
      const parts = ultimaFactura.numero_factura.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }

    const { data: cuentas } = await agencyDb
      .from("config_cuentas_contables")
      .select("id, codigo")
      .in("codigo", ["700", "430", "477"]);

    const getCuenta = (codigo: string) =>
      cuentas?.find((c: any) => c.codigo === codigo)?.id as string | undefined;

    const cuenta700 = getCuenta("700");
    const cuenta430 = getCuenta("430");
    const cuenta477 = getCuenta("477");

    let created = 0;

    for (const item of items) {
      if (item.importe <= 0) continue;

      const numFactura = `F${currentYear}-${String(nextSeq).padStart(4, "0")}`;
      nextSeq++;

      const fechaHoy = new Date().toISOString().split("T")[0];
      const conceptoApunte = `${numFactura} - ${item.clienteNombre}`;

      if (item.regimenIva === "REAV") {
        const CUENTA_438_ID = "fd9b798d-c13a-47f0-b638-3772d767f885";

        let subcuenta430: string | null = null;
        let subcuenta438: string | null = null;
        if (item.pagadorId) {
          const { data: entData } = await agencyDb
            .from("contabilidad_entidades")
            .select("cuentas_contables")
            .eq("id", item.pagadorId)
            .maybeSingle();
          subcuenta430 =
            entData?.cuentas_contables?.cliente ||
            entData?.cuentas_contables?.cuenta_cliente ||
            null;
          subcuenta438 =
            entData?.cuentas_contables?.anticipo ||
            entData?.cuentas_contables?.cuenta_438 ||
            subcuenta430
              ? "438" + (subcuenta430 ?? "").substring(3)
              : null;
        }

        if (!cuenta430 || !cuenta700) {
          console.error(`Cuentas contables 430/700 no encontradas, omitiendo ${numFactura}`);
          continue;
        }

        const { data: facturaInsertada, error: errFactura } = await agencyDb
          .from("facturas_emitidas")
          .insert([{
            expediente_id: expedienteId, pagador_id: item.pagadorId,
            numero_factura: numFactura, fecha_emision: fechaHoy,
            cliente_nombre: item.clienteNombre, cliente_nif: item.clienteNif,
            regimen_iva: "REAV", importe_total: item.importe,
          }])
          .select("id")
          .single();

        if (errFactura || !facturaInsertada) {
          console.error(`[REAV] Error creando factura ${numFactura}:`, errFactura);
          continue;
        }

        const facturaId = facturaInsertada.id;

        await agencyDb.from("facturas_emitidas_lineas").insert([{
          factura_emitida_id: facturaId, concepto: item.concepto,
          importe_neto: item.importe, porcentaje_iva: 0, cuota_iva: 0,
          importe_total_linea: item.importe,
        }]);

        const { error: errApuntesReav } = await agencyDb
          .from("contabilidad_apuntes")
          .insert([
            {
              asiento_id: null, fecha: fechaHoy, cuenta_id: cuenta430,
              entidad_id: item.pagadorId, subcuenta: subcuenta430,
              debe: item.importe, haber: 0,
              concepto: conceptoApunte, expediente_id: expedienteId,
              factura_emitida_id: facturaId, regimen_iva_apunte: "REAV",
            },
            {
              asiento_id: null, fecha: fechaHoy, cuenta_id: cuenta700,
              entidad_id: item.pagadorId, subcuenta: null,
              debe: 0, haber: item.importe,
              concepto: conceptoApunte, expediente_id: expedienteId,
              factura_emitida_id: facturaId, regimen_iva_apunte: "REAV",
            },
            {
              asiento_id: null, fecha: fechaHoy, cuenta_id: CUENTA_438_ID,
              entidad_id: item.pagadorId, subcuenta: subcuenta438,
              debe: item.importe, haber: 0,
              concepto: `${conceptoApunte} [Compensación 438/430]`,
              expediente_id: expedienteId,
              factura_emitida_id: facturaId, regimen_iva_apunte: "REAV",
            },
            {
              asiento_id: null, fecha: fechaHoy, cuenta_id: cuenta430,
              entidad_id: item.pagadorId, subcuenta: subcuenta430,
              debe: 0, haber: item.importe,
              concepto: `${conceptoApunte} [Compensación 438/430]`,
              expediente_id: expedienteId,
              factura_emitida_id: facturaId, regimen_iva_apunte: "REAV",
            },
          ]);

        if (errApuntesReav) {
          console.error(`[REAV] Error creando apuntes provisionales para ${numFactura}:`, errApuntesReav);
        }

        if (item.declararAeat) {
          await _declararVerifactu(agencyDb, item, numFactura, currentYear, facturaId, item.importe, 0);
        }

        created++;
        continue;
      }

      // ── GENERAL ──────────────────────────────────────────────────────────────
      let subcuentaCliente: string | null = null;
      if (item.pagadorId) {
        const { data: entData } = await agencyDb
          .from("contabilidad_entidades")
          .select("cuentas_contables")
          .eq("id", item.pagadorId)
          .maybeSingle();
        subcuentaCliente =
          entData?.cuentas_contables?.cliente ||
          entData?.cuentas_contables?.cuenta_cliente ||
          null;
      }

      const porcentajeIva = 21;
      const importeNeto = parseFloat((item.importe / 1.21).toFixed(2));
      const cuotaIva = parseFloat((item.importe - importeNeto).toFixed(2));

      const { data: facturaInsertada, error: errFactura } = await agencyDb
        .from("facturas_emitidas")
        .insert([{
          expediente_id: expedienteId, pagador_id: item.pagadorId,
          numero_factura: numFactura, fecha_emision: fechaHoy,
          cliente_nombre: item.clienteNombre, cliente_nif: item.clienteNif,
          regimen_iva: item.regimenIva, importe_total: item.importe,
        }])
        .select("id")
        .single();

      if (errFactura || !facturaInsertada) {
        console.error(`Error creando factura ${numFactura}:`, errFactura);
        continue;
      }

      const facturaId = facturaInsertada.id;

      await agencyDb.from("facturas_emitidas_lineas").insert([{
        factura_emitida_id: facturaId, concepto: item.concepto,
        importe_neto: importeNeto, porcentaje_iva: porcentajeIva,
        cuota_iva: cuotaIva, importe_total_linea: item.importe,
      }]);

      const apuntes: any[] = [];
      if (cuenta430 && cuenta700) {
        apuntes.push(
          {
            asiento_id: null, fecha: fechaHoy, cuenta_id: cuenta430,
            entidad_id: item.pagadorId, subcuenta: subcuentaCliente,
            debe: item.importe, haber: 0,
            concepto: conceptoApunte, expediente_id: expedienteId,
            factura_emitida_id: facturaId, regimen_iva_apunte: "GENERAL",
          },
          {
            asiento_id: null, fecha: fechaHoy, cuenta_id: cuenta700,
            entidad_id: item.pagadorId, subcuenta: null,
            debe: 0, haber: importeNeto,
            concepto: conceptoApunte, expediente_id: expedienteId,
            factura_emitida_id: facturaId, regimen_iva_apunte: "GENERAL",
          }
        );
        if (cuenta477 && cuotaIva > 0) {
          apuntes.push({
            asiento_id: null, fecha: fechaHoy, cuenta_id: cuenta477,
            entidad_id: item.pagadorId, subcuenta: null,
            debe: 0, haber: cuotaIva,
            concepto: `IVA Rep. ${conceptoApunte}`, expediente_id: expedienteId,
            factura_emitida_id: facturaId, regimen_iva_apunte: "GENERAL",
          });
        }
      }

      if (apuntes.length > 0) {
        const { error: errApuntes } = await agencyDb
          .from("contabilidad_apuntes")
          .insert(apuntes);
        if (errApuntes) {
          console.error(`Error creating apuntes for ${numFactura}:`, errApuntes);
        }
      }

      if (item.declararAeat) {
        await _declararVerifactu(agencyDb, item, numFactura, currentYear, facturaId, importeNeto, cuotaIva);
      }

      created++;
    }

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true, created };
  } catch (err: any) {
    console.error("Failed to create facturas masivas:", err.message);
    return { success: false, error: err.message || "Error desconocido", created: 0 };
  }
}

export async function cerrarExpedienteReav(expedienteId: string): Promise<CierreReavResult> {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: emitidas, error: errE } = await agencyDb
      .from("facturas_emitidas")
      .select("importe_total")
      .eq("expediente_id", expedienteId)
      .eq("regimen_iva", "REAV");

    if (errE) return { success: false, error: `Error leyendo facturas emitidas: ${errE.message}` };

    const ingresos = (emitidas || []).reduce(
      (sum: number, f: any) => sum + Number(f.importe_total || 0), 0
    );

    const { data: recibidas, error: errR } = await agencyDb
      .from("facturas_recibidas")
      .select("importe_total_con_iva")
      .eq("expediente_id", expedienteId);

    if (errR) return { success: false, error: `Error leyendo facturas recibidas: ${errR.message}` };

    const costes = (recibidas || []).reduce(
      (sum: number, f: any) => sum + Number(f.importe_total_con_iva || 0), 0
    );

    const margen = parseFloat((ingresos - costes).toFixed(2));

    if (margen <= 0) {
      return { success: true, ingresos, costes, margen, baseImponible: 0, cuotaIva: 0 };
    }

    const baseImponible = parseFloat((margen / 1.21).toFixed(2));
    const cuotaIva = parseFloat((margen - baseImponible).toFixed(2));

    const { data: cuentas } = await agencyDb
      .from("config_cuentas_contables")
      .select("id, codigo")
      .in("codigo", ["700", "477"]);

    const getCuenta = (codigo: string) =>
      cuentas?.find((c: any) => c.codigo === codigo)?.id as string | undefined;

    const cuenta700 = getCuenta("700");
    const cuenta477 = getCuenta("477");

    if (!cuenta700 || !cuenta477) {
      return { success: false, error: "Cuentas contables 700/477 no configuradas" };
    }

    const fechaCierre = new Date().toISOString().split("T")[0];
    const concepto = `Regularización REAV — exp. ${expedienteId.slice(0, 8)}`;

    const { data: apunteInsertado, error: errApunte } = await agencyDb
      .from("contabilidad_apuntes")
      .insert([
        {
          asiento_id: null, fecha: fechaCierre, cuenta_id: cuenta700,
          entidad_id: null, subcuenta: null, debe: cuotaIva, haber: 0,
          concepto, expediente_id: expedienteId,
          factura_emitida_id: null, regimen_iva_apunte: "REAV",
        },
        {
          asiento_id: null, fecha: fechaCierre, cuenta_id: cuenta477,
          entidad_id: null, subcuenta: null, debe: 0, haber: cuotaIva,
          concepto, expediente_id: expedienteId,
          factura_emitida_id: null, regimen_iva_apunte: "REAV",
        },
      ])
      .select("id")
      .limit(1)
      .maybeSingle();

    if (errApunte) {
      return { success: false, error: `Error insertando asiento regularización: ${errApunte.message}` };
    }

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true, ingresos, costes, margen, baseImponible, cuotaIva, apunteId: apunteInsertado?.id };
  } catch (err: any) {
    console.error("[REAV] Error en cerrarExpedienteReav:", err.message);
    return { success: false, error: err.message || "Error desconocido" };
  }
}
