"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";

export interface BalanceRowLevel2 {
  subcuenta: string;
  nombre_cuenta: string;
  total_debe: number;
  total_haber: number;
  saldo_final: number;
}

export interface ApunteDetalleLevel3 {
  id: string;
  debe: number;
  haber: number;
  concepto: string;
  asiento_id: string;
  asiento_fecha: string;
  asiento_numero: string;
}

/**
 * Recupera los saldos acumulados de Nivel 2 llamando a la función RPC optimizada.
 */
export async function getBalanceSumasSaldos(ejercicio: number): Promise<BalanceRowLevel2[]> {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb.rpc("fn_balance_sumas_saldos", {
      p_ejercicio: ejercicio,
    });

    if (error) {
      console.error("Error executing RPC fn_balance_sumas_saldos:", error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      subcuenta: row.subcuenta,
      nombre_cuenta: row.nombre_cuenta || "Sin nombre",
      total_debe: Number(row.total_debe || 0),
      total_haber: Number(row.total_haber || 0),
      saldo_final: Number(row.saldo_final || 0),
    }));
  } catch (error: any) {
    console.error("Failed to get balance sumas/saldos:", error.message);
    throw new Error(error.message || "Failed to fetch balance sheet");
  }
}

/**
 * Recupera de forma perezosa (Lazy Loading) los apuntes contables reales (Nivel 3)
 * asociados a una subcuenta específica en un ejercicio fiscal determinado.
 */
export async function getApuntesDeSubcuenta(
  subcuenta: string,
  ejercicio: number
): Promise<ApunteDetalleLevel3[]> {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data, error } = await agencyDb
      .from("contabilidad_apuntes")
      .select(`
        id,
        debe,
        haber,
        concepto,
        asiento_id,
        contabilidad_asientos!inner (
          id,
          numero,
          fecha,
          ejercicio
        )
      `)
      .eq("subcuenta", subcuenta)
      .eq("contabilidad_asientos.ejercicio", ejercicio);

    if (error) {
      console.error(`Error fetching detailed entries for subaccount ${subcuenta}:`, error);
      throw error;
    }

    const mapped = (data || []).map((row: any) => {
      const asiento = row.contabilidad_asientos;
      return {
        id: row.id,
        debe: Number(row.debe || 0),
        haber: Number(row.haber || 0),
        concepto: row.concepto || "",
        asiento_id: row.asiento_id,
        asiento_fecha: asiento?.fecha || "",
        asiento_numero: asiento?.numero || "",
      };
    });

    // Sort chronologically by seat date, and then by seat number as fallback
    mapped.sort((a, b) => {
      const dateA = a.asiento_fecha || "";
      const dateB = b.asiento_fecha || "";
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      return a.asiento_numero.localeCompare(b.asiento_numero);
    });

    return mapped;
  } catch (error: any) {
    console.error(`Failed to get entries for subaccount ${subcuenta}:`, error.message);
    throw new Error(error.message || "Failed to fetch subaccount detail");
  }
}
