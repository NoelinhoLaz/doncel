/**
 * MOTOR 4 — Reembolsos de Proveedores [importe > 0]
 *
 * Abonos de aerolíneas, mayoristas u otros proveedores que entran en positivo.
 * Busca en contabilidad_movimientos donde tipo = 'reembolso_pago'.
 *
 * Regla de importe: EXACTO (diferencia = 0). No se admiten aproximaciones.
 * Si el importe no es exacto, este motor no propone nada.
 */

import { norm, tokenizarPool } from "./utils";

export interface MatchReembolsoProveedor {
  expediente_id: string;
  reembolso_id: string;
  concepto: string;
  importe_total: number;
  match_score: number;
  razon: string;
}

export function motorReembolsosProveedores(
  movimiento: { id: string; importe: number; concepto_limpio: string; metadatos?: any },
  reembolsosPendientes: any[]  // contabilidad_movimientos tipo=reembolso_pago, movimiento_banco_id IS NULL
): MatchReembolsoProveedor | null {
  if (movimiento.importe <= 0) return null;
  if (!reembolsosPendientes?.length) return null;

  const importeBanco = Math.abs(movimiento.importe);

  const meta = typeof movimiento.metadatos === "string"
    ? (() => { try { return JSON.parse(movimiento.metadatos); } catch { return {}; } })()
    : (movimiento.metadatos || {});
  const pool2: string[] = Array.isArray(meta.pool2) ? tokenizarPool(meta.pool2) : [];

  let bestScore = 0;
  let bestMatch: MatchReembolsoProveedor | null = null;

  for (const r of reembolsosPendientes) {
    if (!r.expediente_id) continue;
    const importeReembolso = Math.abs(Number(r.importe_total || 0));

    // REGLA ESTRICTA: importe exacto
    if (Math.abs(importeBanco - importeReembolso) > 0.01) continue;

    // Base: importe exacto → 80
    let score = 80;

    // Bonus por concepto
    if (r.concepto && pool2.length > 0) {
      const palabrasReembolso = tokenizarPool(r.concepto);
      const hits = palabrasReembolso.filter(p =>
        pool2.some(t => t === p || (t.length > 3 && p.length > 3 && (t.includes(p) || p.includes(t))))
      ).length;
      if (hits >= 3) score = 97;
      else if (hits >= 2) score = 92;
      else if (hits >= 1) score = 87;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        expediente_id: r.expediente_id,
        reembolso_id: r.id,
        concepto: r.concepto || "",
        importe_total: importeReembolso,
        match_score: score,
        razon: score >= 90
          ? "Abono de proveedor: importe exacto + concepto coincidente"
          : "Abono de proveedor: importe exacto",
      };
    }
  }

  return bestMatch;
}

export const ejecutarMotorReembolsosProveedores = motorReembolsosProveedores;
