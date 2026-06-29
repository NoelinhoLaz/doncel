/**
 * MOTOR 3 — Reembolsos a Clientes [importe < 0]
 *
 * La agencia devuelve dinero a un cliente.
 * Busca en contabilidad_movimientos donde tipo = 'reembolso_cobro'.
 *
 * Reglas estrictas:
 * 1) Importe exacto al céntimo.
 * 2) Se descartan conceptos genéricos como viaje/viajes/estudios.
 * 3) El banco debe contener al menos 1 token del alumno o del tutor.
 */

import { tokenizarPool } from "./utils";

export interface MatchReembolsoCliente {
  expediente_id: string;
  reembolso_id: string;
  concepto: string;
  importe_total: number;
  match_score: number;
  razon: string;
}

export function motorReembolsosClientes(
  movimiento: { id: string; importe: number; concepto_limpio?: string; concepto_original?: string; metadatos?: any },
  reembolsosPendientes: any[]
): MatchReembolsoCliente | null {
  if (movimiento.importe >= 0) return null;
  if (!reembolsosPendientes?.length) return null;

  const importeAbs = Math.abs(movimiento.importe);
  const conceptoMovimiento = movimiento.concepto_limpio || movimiento.concepto_original || "";
  const palabrasMovimiento = tokenizarPool(conceptoMovimiento).filter(
    p => !new Set(["viaje", "viajes", "estudios"]).has(p)
  );
  if (!palabrasMovimiento.length) return null;

  let bestScore = 0;
  let bestMatch: MatchReembolsoCliente | null = null;

  for (const r of reembolsosPendientes) {
    if (!r.expediente_id) continue;
    const importeReembolso = Math.abs(Number(r.importe_total || 0));

    // Regla obligatoria: importe exacto al céntimo.
    if (Math.abs(importeAbs - importeReembolso) > 0.001) continue;

    const getNameTokens = (value: any): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value.flatMap((item) => tokenizarPool(String(item)));
      return tokenizarPool(String(value));
    };

    const nombresPersona = new Set<string>([
      ...getNameTokens(r.alumno_nombre),
      ...getNameTokens(r.tutor_nombre),
      ...getNameTokens(r.cliente_nombre),
      ...getNameTokens(r.viajero_nombre),
      ...getNameTokens(r.nombres_personales),
    ]);

    const hitsNombres = [...nombresPersona].filter((token) => palabrasMovimiento.includes(token)).length;
    if (hitsNombres === 0) continue;

    let score = hitsNombres >= 2 ? 95 : 90;

    const conceptoLower = conceptoMovimiento.toLowerCase();
    if (conceptoLower.includes("reembolso") || conceptoLower.includes("devolucion")) {
      score = Math.min(score + 3, 100);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        expediente_id: r.expediente_id,
        reembolso_id: r.id,
        concepto: r.concepto || "",
        importe_total: importeReembolso,
        match_score: score,
        razon: hitsNombres >= 2
          ? "Reembolso a cliente: importe exacto + doble coincidencia de nombre"
          : "Reembolso a cliente: importe exacto + coincidencia de nombre",
      };
    }
  }

  return bestMatch;
}

export const ejecutarMotorReembolsosClientes = motorReembolsosClientes;
