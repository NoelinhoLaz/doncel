import { tokenizarPool, tokenMatch } from "./utils";

export interface ExpedienteCliente {
  id: string;                 // expediente_id
  pagador_id: string;
  pagador_nombre: string;
  viajero_nombre: string;     // todos los viajeros del pagador concatenados
  importe_total: number;
  importe_abonado: number;
  expediente_numero: string;
  expediente_referencia: string;
  viajeros: Array<{ id: string; nombre: string; palabras_match?: string[] }>;
}

export interface ResultadoCobro {
  score: number;              // 0.0 – 0.99
  certeza: string;
  expediente_id: string;
  pagador_id: string;
  pagador_nombre: string;
  expediente_numero: string;
  expediente_referencia: string;
  importe_total: number;
  importe_abonado: number;
  viajeros: Array<{ id: string; nombre: string; palabras_match?: string[] }>;
  pool1_coincidencias: number;
  pool2_viajero_coincidencias: number;
  razon: string;
  esMatchAutomatico: boolean;
}

export interface MovimientoInput {
  concepto_limpio?: string;
  concepto_original?: string;
  importe: number;
  referencia1?: string;
  referencia2?: string;
  cuenta_bancaria?: string;
  metadatos?: { pool1?: string[]; pool2?: string[] } | null;
}

export function ejecutarMotorCobrosClientes(
  movimiento: MovimientoInput,
  candidatos: ExpedienteCliente[]
): ResultadoCobro | null {
  if (!candidatos?.length) return null;

  const tokensConcepto = tokenizarPool(movimiento.concepto_limpio || movimiento.concepto_original || "");

  // pool2 pre-calculado por el motor N43 — contiene tokens del remitente/concepto
  // ya depurados. Usarlo como fuente adicional para detectar al viajero cuando
  // el nombre contiene palabras geográficas (ej. "Madrid") que podrían filtrarse.
  const metadatosObj = typeof movimiento.metadatos === "string"
    ? (() => { try { return JSON.parse(movimiento.metadatos as any); } catch { return null; } })()
    : (movimiento.metadatos ?? null);
  const pool2Banco: string[] = metadatosObj?.pool2 ?? [];
  const tokensConceptoAmpliado = pool2Banco.length > 0
    ? [...new Set([...tokensConcepto, ...pool2Banco])]
    : tokensConcepto;

  let mejor: ResultadoCobro | null = null;

  for (const expediente of candidatos) {
    // IBAN directo → certeza absoluta
    const cuentaPagador = expediente.pagador_id;
    const cuentaMov = [movimiento.referencia1, movimiento.referencia2].filter(Boolean).join(" ");
    if (expediente.importe_total > 0 && cuentaMov && cuentaPagador && cuentaMov.includes(cuentaPagador)) {
      return buildResult(expediente, 0.99, "iban", tokensConcepto.length, 0, true);
    }

    // Pagadores completados siguen siendo candidatos válidos para resolver
    // movimientos bancarios ya propuestos (ej. el cobro llegó antes de la conciliación)
    const deuda = expediente.importe_total - expediente.importe_abonado;

    // Pool1 → identidad del PAGADOR
    const tokensPagadorBD = tokenizarPool(expediente.pagador_nombre);
    const hitsPagador = tokenMatch(tokensPagadorBD, tokensConcepto);
    const pctPagador = tokensPagadorBD.length > 0 ? hitsPagador / tokensPagadorBD.length : 0;

    if (pctPagador < 0.6) continue;

    // Pool2 → identidad del VIAJERO
    // Primero intenta con nombre completo tokenizado; si da 0, usa pool2 del banco
    // contra palabras_match de cada viajero del expediente (contingencia geográfica)
    const tokensViajeroBD = tokenizarPool(expediente.viajero_nombre);
    let hitsViajero = tokenMatch(tokensViajeroBD, tokensConceptoAmpliado);

    // Contingencia: comparar pool2 del banco directamente contra palabras_match
    // de cada viajero del expediente (cubre apellidos que son nombres de ciudades)
    if (hitsViajero === 0 && pool2Banco.length > 0 && expediente.viajeros?.length > 0) {
      const setPool2 = new Set(pool2Banco);
      for (const viajero of expediente.viajeros) {
        const palabrasMatchViajero: string[] = (viajero as any).palabras_match ?? tokenizarPool(viajero.nombre);
        const coincidencias = palabrasMatchViajero.filter((w) => setPool2.has(w)).length;
        if (coincidencias > hitsViajero) hitsViajero = coincidencias;
      }
    }

    // Matriz de scoring
    let score = 0;
    let certeza = "descartar";

    if (pctPagador === 1.0) {
      if (hitsViajero >= 3)       { score = 0.97; certeza = "familia_completa"; }
      else if (hitsViajero === 2) { score = 0.93; certeza = "pagador_viajero_alto"; }
      else if (hitsViajero === 1) { score = 0.85; certeza = "pagador_viajero_uno"; }
      else                        { score = 0.70; certeza = "pagador_solo"; }
    } else if (pctPagador >= 0.80) {
      if (hitsViajero >= 3)       { score = 0.90; certeza = "pagador_alto_viajero"; }
      else if (hitsViajero === 2) { score = 0.82; certeza = "propuesto_alto"; }
      else if (hitsViajero === 1) { score = 0.74; certeza = "propuesto_medio"; }
      else                        { score = 0.55; certeza = "revision_manual"; }
    } else {
      score = 0.54;
      certeza = "debil";
    }

    const res = buildResult(expediente, score, certeza, hitsPagador, hitsViajero, score >= 0.85);
    if (!mejor || res.score > mejor.score) mejor = res;
  }

  return mejor && mejor.score >= 0.50 ? mejor : null;

  function buildResult(
    e: ExpedienteCliente,
    score: number,
    certeza: string,
    p1: number,
    p2: number,
    esAuto: boolean
  ): ResultadoCobro {
    const razon =
      certeza === "familia_completa" ? "Certeza familia completa: pagador y alumno identificados" :
      certeza === "pagador_viajero_alto" ? "Pagador completo + alumno parcialmente identificado" :
      certeza === "pagador_solo" ? `Pagador identificado (${p1} tokens), alumno no encontrado` :
      certeza === "iban" ? "Match exacto por IBAN conocido" :
      `Coincidencia parcial del pagador (${p1} tokens)`;
    return {
      score, certeza,
      expediente_id: e.id,
      pagador_id: e.pagador_id,
      pagador_nombre: e.pagador_nombre,
      expediente_numero: e.expediente_numero,
      expediente_referencia: e.expediente_referencia,
      importe_total: e.importe_total,
      importe_abonado: e.importe_abonado,
      viajeros: e.viajeros,
      pool1_coincidencias: p1,
      pool2_viajero_coincidencias: p2,
      razon,
      esMatchAutomatico: esAuto,
    };
  }
}

export const motorCobrosClientes = ejecutarMotorCobrosClientes;
