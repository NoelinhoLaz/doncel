"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { FacturaGeneral, FacturaREAV, LibroIvaData } from "./facturacion.types";

function getPeriodoFromDate(dateStr: string): "Q1" | "Q2" | "Q3" | "Q4" {
  if (!dateStr) return "Q1";
  let month = 1;
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    month = parseInt(parts[0].length === 4 ? parts[1] : parts[1], 10);
  } else if (dateStr.includes("/")) {
    month = parseInt(dateStr.split("/")[1], 10);
  }
  if (month >= 1 && month <= 3) return "Q1";
  if (month >= 4 && month <= 6) return "Q2";
  if (month >= 7 && month <= 9) return "Q3";
  return "Q4";
}

function formatToSpanishDate(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("/")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return parts[0].length === 4
      ? `${parts[2]}/${parts[1]}/${parts[0]}`
      : `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return dateStr;
}

export async function getLibroIvaData(): Promise<LibroIvaData> {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: emitidas, error: errEmitidas } = await agencyDb
      .from("facturas_emitidas")
      .select(`*, facturas_emitidas_lineas (*)`)
      .order("fecha_emision", { ascending: false });

    if (errEmitidas) console.error("Error fetching facturas emitidas for Libro IVA:", errEmitidas);

    const expedienteIds = [...new Set((emitidas || []).map((f: any) => f.expediente_id).filter(Boolean))];
    let pagosExpediente: Record<string, number> = {};
    let viajerosCount: Record<string, number> = {};

    if (expedienteIds.length > 0) {
      const { data: movimientos } = await agencyDb
        .from("contabilidad_movimientos")
        .select("expediente_id, importe_total")
        .in("expediente_id", expedienteIds)
        .eq("tipo", "pago")
        .eq("estado", "confirmado");
      (movimientos || []).forEach((m: any) => {
        pagosExpediente[m.expediente_id] = (pagosExpediente[m.expediente_id] || 0) + Number(m.importe_total || 0);
      });

      const { data: viajeros } = await agencyDb
        .from("operativa_viajeros_expedientes")
        .select("expediente_id")
        .in("expediente_id", expedienteIds);
      (viajeros || []).forEach((v: any) => {
        viajerosCount[v.expediente_id] = (viajerosCount[v.expediente_id] || 0) + 1;
      });
    }

    const { data: recibidas, error: errRecibidas } = await agencyDb
      .from("facturas_recibidas")
      .select(`*, contabilidad_proveedores (nombre, "CIF"), facturas_recibidas_lineas (*)`)
      .order("fecha_factura", { ascending: false });

    if (errRecibidas) console.error("Error fetching facturas recibidas for Libro IVA:", errRecibidas);

    const ventasGeneral: FacturaGeneral[] = [];
    const ventasReav: FacturaREAV[] = [];
    const comprasGeneral: FacturaGeneral[] = [];
    const comprasReav: FacturaREAV[] = [];

    for (const f of emitidas || []) {
      const dateStr = f.fecha_emision || "";
      const period = getPeriodoFromDate(dateStr);
      const formattedDate = formatToSpanishDate(dateStr);
      const total = Number(f.importe_total || 0);

      if (f.regimen_iva === "GENERAL") {
        const lines = f.facturas_emitidas_lineas || [];
        const base = lines.length > 0
          ? lines.reduce((s: number, l: any) => s + Number(l.importe_neto || 0), 0)
          : Number((total / 1.21).toFixed(2));
        const cuota = lines.length > 0
          ? lines.reduce((s: number, l: any) => s + Number(l.cuota_iva || 0), 0)
          : Number((total - base).toFixed(2));
        const tipoIva = Number(lines[0]?.porcentaje_iva || 21);

        ventasGeneral.push({
          fecha: formattedDate, factura: f.numero_factura || "",
          entidad: f.cliente_nombre || "Sin Nombre", nif: f.cliente_nif || "",
          base: Number(base.toFixed(2)), tipoIva, cuota: Number(cuota.toFixed(2)),
          total, periodo: period,
        });
      } else {
        const totalPagado = pagosExpediente[f.expediente_id] || 0;
        const numViajeros = viajerosCount[f.expediente_id] || 1;
        const coste = Number((totalPagado / numViajeros).toFixed(2));
        const margen = Number((total - coste).toFixed(2));
        const baseIva = margen > 0 ? Number((margen / 1.21).toFixed(2)) : 0;
        const cuota = margen > 0 ? Number((margen - baseIva).toFixed(2)) : 0;

        ventasReav.push({
          fecha: formattedDate, factura: f.numero_factura || "",
          cliente: f.cliente_nombre || "Sin Nombre", importe: total,
          coste, margen, baseIva, cuota, periodo: period,
        });
      }
    }

    for (const r of recibidas || []) {
      const dateStr = r.fecha_factura || "";
      const period = getPeriodoFromDate(dateStr);
      const formattedDate = formatToSpanishDate(dateStr);
      const total = Number(r.importe_total_con_iva || 0);
      const prov = r.contabilidad_proveedores as any;
      const provNombre = prov?.nombre || "Proveedor Desconocido";
      const provCif = prov?.CIF || "";
      const lines = r.facturas_recibidas_lineas || [];
      const isGeneral = lines.some((l: any) => Number(l.porcentaje_iva || 0) > 0);

      if (isGeneral) {
        const base = lines.reduce((s: number, l: any) => s + Number(l.importe_base || 0), 0);
        const cuota = lines.reduce((s: number, l: any) => s + Number(l.importe_iva || 0), 0);
        const tipoIva = Number(lines.find((l: any) => Number(l.porcentaje_iva || 0) > 0)?.porcentaje_iva || 21);

        comprasGeneral.push({
          fecha: formattedDate, factura: r.numero_factura_proveedor || "",
          entidad: provNombre, nif: provCif,
          base: Number(base.toFixed(2)), tipoIva, cuota: Number(cuota.toFixed(2)),
          total, periodo: period,
        });
      } else {
        comprasReav.push({
          fecha: formattedDate, factura: r.numero_factura_proveedor || "",
          cliente: provNombre, importe: total,
          coste: total, margen: 0, baseIva: 0, cuota: 0, periodo: period,
        });
      }
    }

    return { ventasGeneral, ventasReav, comprasGeneral, comprasReav };
  } catch (err: any) {
    console.error("Failed to get Libro IVA data:", err.message);
    return { ventasGeneral: [], ventasReav: [], comprasGeneral: [], comprasReav: [] };
  }
}
