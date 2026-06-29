import {
  conciliarPagoProveedor as conciliarPagoProveedorLegacy,
  generarApuntesPagoProveedor,
  ejecutarConciliacionMovimiento as ejecutarConciliacionMovimientoLegacy,
  ejecutarConciliacionTutor as ejecutarConciliacionTutorLegacy,
} from "@/lib/conciliacion/contabilidadService";

export type ConciliationResult =
  | { success: true; data?: any }
  | { success: false; error: string; code?: string };

function normalizeLegacyResult(legacyResult: any): ConciliationResult {
  try {
    if (!legacyResult) return { success: false, error: "Resultado vacío del servicio legacy" };
    if (typeof legacyResult === "object" && legacyResult.success === true) {
      return { success: true, data: legacyResult };
    }
    // legacy may return { success: false, message } or { message }
    const err = legacyResult.error ?? legacyResult.message ?? JSON.stringify(legacyResult);
    return { success: false, error: String(err) };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Error desconocido al normalizar resultado" };
  }
}

export async function conciliarPagoProveedor(agencyDb: any, pagoId: string, movimientoBancoId: string): Promise<ConciliationResult> {
  try {
    const legacy = await conciliarPagoProveedorLegacy(agencyDb, pagoId, movimientoBancoId);
    return normalizeLegacyResult(legacy);
  } catch (err: any) {
    console.error("[CONCILIATION_FAILURE conciliarPagoProveedor]:", err?.message ?? err);
    return { success: false, error: err?.message ?? "Error interno en la transacción contable" };
  }
}

export async function ejecutarConciliacionMovimiento(agencyDb: any, movimientoBancoId: string, pagoDocumentoIds: string[]): Promise<ConciliationResult> {
  try {
    const legacy = await ejecutarConciliacionMovimientoLegacy(agencyDb, movimientoBancoId, pagoDocumentoIds);
    return normalizeLegacyResult(legacy);
  } catch (err: any) {
    console.error("[CONCILIATION_FAILURE ejecutarConciliacionMovimiento]:", err?.message ?? err);
    return { success: false, error: err?.message ?? "Error interno en ejecutarConciliacionMovimiento" };
  }
}

export async function ejecutarConciliacionTutor(movimientoId: string, expedienteId: string, entidadId: string, importeMovimiento: number): Promise<ConciliationResult> {
  try {
    const legacy = await ejecutarConciliacionTutorLegacy(movimientoId, expedienteId, entidadId, importeMovimiento);
    return normalizeLegacyResult(legacy);
  } catch (err: any) {
    console.error("[CONCILIATION_FAILURE ejecutarConciliacionTutor]:", err?.message ?? err);
    return { success: false, error: err?.message ?? "Error interno en ejecutarConciliacionTutor" };
  }
}

export { generarApuntesPagoProveedor };
