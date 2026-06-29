import { getAgencyDbClient } from "@/lib/agencyDb";
import { calcularScoreImporte, calcularScoreConcepto } from "./matcher";

export interface MatchResultReembolso {
  expediente_id: string;
  reembolso_id: string;
  tipo: "reembolso";
  subtipo: "reembolso_cobro" | "reembolso_pago";
  concepto: string;
  importe_total: number;
  match_score: number;
  razon: string;
  metadatos: {
    criterio_importe: { tipo: string; diferencia: number; score: number };
    criterio_concepto: {
      palabras_clave_movimiento: string[];
      palabras_clave_concepto: string[];
      coincidencias: string[];
      score: number;
    };
    confianza_general: number;
  };
}

export async function buscarMatchParaReembolso(
  movimiento: {
    id: string;
    importe: number;
    concepto_limpio: string;
    fecha_operacion: Date | string;
  },
  reembolsosPendientesPrecalculados?: any[]
): Promise<MatchResultReembolso | null> {
  if (!movimiento.concepto_limpio?.trim()) return null;

  const importeAbs = Math.abs(movimiento.importe);

  let reembolsos = reembolsosPendientesPrecalculados;
  if (!reembolsos) {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_movimientos")
      .select("id, concepto, importe_total, expediente_id, tipo")
      .in("tipo", ["reembolso_cobro", "reembolso_pago"])
      .is("movimiento_banco_id", null);
    if (error || !data) return null;
    reembolsos = data;
  }

  if (!reembolsos || reembolsos.length === 0) return null;

  const candidatos = reembolsos.filter((r: any) => r.expediente_id && r.importe_total);

  let bestScore = 0;
  let bestMatch: MatchResultReembolso | null = null;

  for (const r of candidatos) {
    const scoreImporte = calcularScoreImporte(importeAbs, [
      { id: r.id, importe: Math.abs(Number(r.importe_total)) },
    ]);
    if (scoreImporte.score === 0) continue;

    const scoreConcepto = calcularScoreConcepto(
      movimiento.concepto_limpio,
      r.concepto || "",
      "",
      ""
    );

    const scoreTotal = Math.round(scoreImporte.score * 0.6 + scoreConcepto.score * 0.4);
    if (scoreTotal < 70) continue;

    if (scoreTotal > bestScore) {
      bestScore = scoreTotal;
      bestMatch = {
        expediente_id: r.expediente_id,
        reembolso_id: r.id,
        tipo: "reembolso",
        subtipo: r.tipo,
        concepto: r.concepto || "",
        importe_total: Number(r.importe_total),
        match_score: scoreTotal,
        razon:
          scoreImporte.tipo === "exacto"
            ? `Coincidencia exacta de importe con reembolso — ${r.concepto || r.id}`
            : `Coincidencia similar de importe con reembolso (dif: ${scoreImporte.diferencia.toFixed(2)}€)`,
        metadatos: {
          criterio_importe: {
            tipo: scoreImporte.tipo,
            diferencia: scoreImporte.diferencia,
            score: scoreImporte.score,
          },
          criterio_concepto: {
            palabras_clave_movimiento: scoreConcepto.palabrasClaveMovimiento,
            palabras_clave_concepto: scoreConcepto.palabrasClaveDocumento,
            coincidencias: scoreConcepto.coincidencias,
            score: scoreConcepto.score,
          },
          confianza_general: scoreTotal,
        },
      };
    }
  }

  return bestMatch;
}
