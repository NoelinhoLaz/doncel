/**
 * MOTOR 2 — Servicios y Gastos [importe < 0]
 *
 * Identifica pagos de la agencia a proveedores (vuelos, hoteles, recargas).
 * Completamente aislado del flujo de expedientes de clientes.
 *
 * Scoring: importe (60%) + concepto contra nombre proveedor/expediente (40%)
 * Umbral mínimo: 75
 */

import { norm } from "./utils";

export interface MatchServicio {
  expediente_id: string;
  expediente_numero: string;
  documento_id: string;
  proveedor_nombre: string;
  proveedor_nif: string;
  pagos: Array<{ id: string; documento_id: string; importe: number; metodo_pago: string; referencia?: string }>;
  importe_total: number;
  match_score: number;
  razon: string;
}

export function motorServiciosGastos(
  movimiento: { id: string; importe: number; concepto_limpio: string; fecha_operacion: any },
  pagosPendientes: any[]
): MatchServicio | null {
  if (movimiento.importe >= 0) return null;
  if (!pagosPendientes?.length) return null;

  const importeAbs = Math.abs(movimiento.importe);
  const conceptoNorm = norm(movimiento.concepto_limpio || "");
  const palabrasMovimiento = extraerPalabras(conceptoNorm);

  // Agrupar pagos por documento
  const porDocumento = new Map<string, {
    documentoId: string;
    proveedorNombre: string;
    proveedorNif: string;
    expedienteId: string;
    expedienteNumero: string;
    documentoNumero: string;
    pagos: Array<{ id: string; importe: number; metodoPago: string; referencia?: string }>;
  }>();

  for (const pago of pagosPendientes) {
    const rel = pago.operativa_documentos_proveedor;
    if (!rel) continue;
    const docExps = rel.operativa_documentos_expedientes || [];
    const docExpPrincipal = Array.isArray(docExps)
      ? docExps.find((de: any) => de.es_principal) || docExps[0]
      : docExps;
    const expediente = docExpPrincipal?.operativa_expedientes;
    if (!expediente) continue;

    const provRel = rel.contabilidad_proveedores;
    const extJson = rel.extraccion_json;
    const provNombre = provRel?.nombre || provRel?.razon_social || extJson?.cabecera?.proveedor_nombre || "";
    const provNif = provRel?.CIF || extJson?.cabecera?.proveedor_nif || "";

    if (!porDocumento.has(pago.documento_id)) {
      porDocumento.set(pago.documento_id, {
        documentoId: pago.documento_id,
        proveedorNombre: provNombre,
        proveedorNif: provNif,
        expedienteId: expediente.id,
        expedienteNumero: expediente.numero || "",
        documentoNumero: rel.documento_numero || "",
        pagos: [],
      });
    }
    porDocumento.get(pago.documento_id)!.pagos.push({
      id: pago.id,
      importe: Number(pago.importe || 0),
      metodoPago: pago.metodo_pago || "TRANSFERENCIA",
      referencia: pago.referencia || "",
    });
  }

  let bestScore = 0;
  let bestMatch: MatchServicio | null = null;

  for (const [, doc] of porDocumento) {
    // Score por importe
    const { score: sImporte, pagosSeleccionados } = scoreImporte(importeAbs, doc.pagos);
    if (sImporte === 0) continue;

    // Score por concepto
    const palabrasDocumento = [
      ...extraerPalabras(norm(doc.proveedorNombre)),
      ...extraerPalabras(norm(`${doc.expedienteNumero}`)),
      ...doc.documentoNumero.replace(/\D/g, "").split("").filter(Boolean),
    ];
    const coincidencias = palabrasMovimiento.filter(p =>
      palabrasDocumento.some(pd => similitud(p, pd) > 0.8)
    );
    let sConcepto = 0;
    if (coincidencias.length >= 3) sConcepto = 100;
    else if (coincidencias.length === 2) sConcepto = 90;
    else if (coincidencias.length === 1) sConcepto = 50;

    const scoreTotal = Math.round(sImporte * 0.6 + sConcepto * 0.4);
    if (scoreTotal < 75) continue;

    if (scoreTotal > bestScore) {
      bestScore = scoreTotal;
      bestMatch = {
        expediente_id: doc.expedienteId,
        expediente_numero: doc.expedienteNumero,
        documento_id: doc.documentoId,
        proveedor_nombre: doc.proveedorNombre,
        proveedor_nif: doc.proveedorNif,
        pagos: pagosSeleccionados.map(p => ({
          id: p.id,
          documento_id: doc.documentoId,
          importe: p.importe,
          metodo_pago: p.metodoPago,
          referencia: p.referencia,
        })),
        importe_total: pagosSeleccionados.reduce((s, p) => s + p.importe, 0),
        match_score: scoreTotal,
        razon: sImporte === 100
          ? `Coincidencia exacta de importe con factura de ${doc.proveedorNombre}`
          : `Coincidencia de importe (${pagosSeleccionados.length} pago/s) con ${doc.proveedorNombre}`,
      };
    }
  }

  return bestMatch;
}

export const ejecutarMotorServiciosGastos = motorServiciosGastos;

function scoreImporte<T extends { id: string; importe: number }>(
  importeAbs: number,
  pagos: Array<T>
): { score: number; pagosSeleccionados: Array<T> } {
  for (const p of pagos) {
    if (Math.abs(importeAbs - p.importe) < 0.01) return { score: 100, pagosSeleccionados: [p] };
  }
  for (const p of pagos) {
    if (Math.abs(importeAbs - p.importe) <= 5) return { score: 90, pagosSeleccionados: [p] };
  }
  // Suma de múltiples pagos
  const combo = encontrarCombinacion(pagos, importeAbs, 0.01);
  if (combo) return { score: 95, pagosSeleccionados: combo };
  return { score: 0, pagosSeleccionados: [] };
}

function encontrarCombinacion<T extends { id: string; importe: number }>(
  pagos: Array<T>,
  objetivo: number,
  tol: number
): Array<T> | null {
  if (pagos.length > 10) return null; // evitar explosión combinatoria
  for (let i = 0; i < pagos.length; i++) {
    for (let j = i + 1; j < pagos.length; j++) {
      if (Math.abs(pagos[i].importe + pagos[j].importe - objetivo) <= tol) {
        return [pagos[i], pagos[j]];
      }
    }
  }
  return null;
}

function extraerPalabras(concepto: string): string[] {
  const stop = new Set(["el","la","de","del","a","y","o","en","por","para","con","sin","los","las",
    "un","una","ese","eso","transferencia","concepto","favor","pago","abono","ingreso"]);
  return concepto
    .replace(/[.,;:()\-/_]/g, " ")
    .split(/\s+/)
    .filter(p => p.length > 2 && !stop.has(p))
    .slice(0, 15);
}

function similitud(s1: string, s2: string): number {
  const longer = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length < s2.length ? s1 : s2;
  if (longer.length === 0) return 1;
  const dist = levenshtein(longer, shorter);
  return (longer.length - dist) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const m: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i-1] === a[j-1]
        ? m[i-1][j-1]
        : Math.min(m[i-1][j-1] + 1, m[i][j-1] + 1, m[i-1][j] + 1);
    }
  }
  return m[b.length][a.length];
}
