import { getAgencyDbClient } from "@/lib/agencyDb";
import { parseFechaIA, parsearNumero } from "./parsers";

export interface MatchResult {
  origen: "documento" | "servicio";
  pagos: Array<{
    id: string;
    documento_id: string | null;
    importe: number;
    metodo_pago: string;
    referencia?: string;
  }>;
  documento_id: string | null;
  servicio_id: string | null;
  expediente_id: string;
  expediente_numero?: string;
  proveedor_nombre: string;
  proveedor_nif: string;
  importe_total: number;
  match_score: number; // 0-100
  razon: string; // Descripción del porqué del matching
  metadatos: {
    criterio_importe: {
      tipo: "exacto" | "similar" | "suma" | "ninguno";
      diferencia: number;
      score: number;
    };
    criterio_concepto: {
      palabras_clave_movimiento: string[];
      palabras_clave_documento: string[];
      coincidencias: string[];
      score: number;
    };
    confianza_general: number;
  };
}

/**
 * Busca posibles matches para un movimiento bancario
 * Retorna el mejor match (o null si no hay candidatos)
 */
export async function buscarMatchesParaMovimiento(
  movimiento: {
    id: string;
    importe: number;
    concepto_limpio: string;
    fecha_operacion: Date | string;
  },
  pagosPendientesPrecalculados?: any[],
  serviciosPrecalculados?: any[]
): Promise<MatchResult | null> {
  // 1. VALIDACIONES PREVIAS
  if (!movimiento.concepto_limpio?.trim()) {
    return null;
  }

  const importeAbsoluto = Math.abs(movimiento.importe);

  // 2. OBTENER PAGOS PENDIENTES DE LA BD
  let pagosPendientes = pagosPendientesPrecalculados;
  if (!pagosPendientes) {
    const agencyDb = await getAgencyDbClient();
    const { data: dataPagos, error: errorPagos } = await agencyDb
      .from("operativa_documentos_pagos")
      .select(`
        id,
        documento_id,
        importe,
        metodo_pago,
        referencia,
        fecha_movimiento,
        operativa_documentos_proveedor(
          documento_numero,
          total_documento,
          extraccion_json,
          contabilidad_proveedores(
            nombre,
            razon_social,
            CIF
          ),
          operativa_documentos_expedientes(
            es_principal,
            operativa_expedientes(
              id,
              numero,
              referencia
            )
          )
        )
      `)
      .is("movimiento_banco_id", null); // No conciliado aún

    if (errorPagos) {
      return null;
    }
    pagosPendientes = dataPagos || [];
  }

  // 3. AGRUPAR PAGOS POR DOCUMENTO
  const pagosPorDocumento = new Map<
    string,
    {
      documentoId: string;
      proveedorNombre: string;
      proveedorNif: string;
      expedienteId: string;
      expedienteNumero: string;
      expedienteDescripcion: string;
      documentoNumero: string;
      totalDocumento: number;
      pagos: Array<{
        id: string;
        importe: number;
        metodoPago: string;
        referencia?: string;
      }>;
    }
  >();

  pagosPendientes.forEach((pago: any) => {
    const key = pago.documento_id;
    const rel = pago.operativa_documentos_proveedor;
    if (!rel) return;

    // Resolver la relación N:M intermedia de expedientes
    const docExps = rel.operativa_documentos_expedientes || [];
    const docExpPrincipal = Array.isArray(docExps)
      ? docExps.find((de: any) => de.es_principal) || docExps[0]
      : docExps;

    const expediente = docExpPrincipal?.operativa_expedientes || null;
    if (!expediente) return; // Si no está vinculado a expediente, no podemos conciliarlo de esta forma

    const provRel = rel.contabilidad_proveedores;
    const extJson = rel.extraccion_json;
    const providerName = provRel?.nombre || provRel?.razon_social || extJson?.cabecera?.proveedor_nombre || "Proveedor";
    const providerNif = provRel?.CIF || extJson?.cabecera?.proveedor_nif || "";

    if (!pagosPorDocumento.has(key)) {
      pagosPorDocumento.set(key, {
        documentoId: key,
        proveedorNombre: providerName,
        proveedorNif: providerNif,
        expedienteId: expediente.id,
        expedienteNumero: expediente.numero || "",
        expedienteDescripcion: `${expediente.numero || ""} ${expediente.referencia || ""}`.trim(),
        documentoNumero: rel.documento_numero || "",
        totalDocumento: Number(rel.total_documento || 0),
        pagos: [],
      });
    }

    pagosPorDocumento.get(key)!.pagos.push({
      id: pago.id,
      importe: Number(pago.importe || 0),
      metodoPago: pago.metodo_pago || "TRANSFERENCIA",
      referencia: pago.referencia || "",
    });
  });

  // 4. AÑADIR SERVICIOS DEL EXPEDIENTE COMO CANDIDATOS
  {
    const tolerancia = 5;
    const importeMin = Math.max(0, importeAbsoluto - tolerancia);
    const importeMax = importeAbsoluto + tolerancia;
    const serviciosData = serviciosPrecalculados !== undefined
      ? serviciosPrecalculados
      : await (async () => {
          const db = await getAgencyDbClient();
          const { data: vData } = await db
            .from("v_servicios_match")
            .select("id, expediente_id, proveedor, descripcion, importe_efectivo, exp_numero, exp_referencia");
          if (vData) return vData;
          const { data: raw } = await db
            .from("operativa_expedientes_servicios")
            .select("id, expediente_id, proveedor, descripcion, total, pvp, neto");
          const rawMap = (raw || []).map((sv: any) => {
            const importe = Number(sv.total) || Number(sv.pvp) || Number(sv.neto) || 0;
            return { ...sv, importe_efectivo: importe };
          });
          const expIds = [...new Set(rawMap.map((sv: any) => sv.expediente_id).filter(Boolean))] as string[];
          if (expIds.length > 0) {
            const { data: exps } = await db
              .from("operativa_expedientes")
              .select("id, numero, referencia")
              .in("id", expIds);
            const expMap = Object.fromEntries((exps || []).map((e: any) => [e.id, e]));
            return rawMap.map((sv: any) => ({
              ...sv,
              exp_numero: expMap[sv.expediente_id]?.numero || "",
              exp_referencia: expMap[sv.expediente_id]?.referencia || "",
            }));
          }
          return rawMap.map((sv: any) => ({ ...sv, exp_numero: "", exp_referencia: "" }));
        })();

    (serviciosData || []).forEach((sv: any) => {
      const importeServicio = Number(sv.importe_efectivo || 0);
      if (importeServicio <= 0) return;
      if (importeServicio < importeMin || importeServicio > importeMax) return;
      const key = `servicio_${sv.id}`;
      sv.expedienteNumero = sv.exp_numero || "";
      sv.expedienteDescripcion = `${sv.exp_numero || ""} ${sv.exp_referencia || ""}`.trim();
      pagosPorDocumento.set(key, {
        documentoId: key,
        proveedorNombre: sv.proveedor || "Proveedor",
        proveedorNif: "",
        expedienteId: sv.expediente_id,
        expedienteNumero: sv.expedienteNumero,
        expedienteDescripcion: sv.expedienteDescripcion,
        documentoNumero: sv.descripcion || "",
        totalDocumento: importeServicio,
        pagos: [{ id: sv.id, importe: importeServicio, metodoPago: "TRANSFERENCIA" }],
      });
    });

    // Agrupar servicios del mismo proveedor+expediente y sumar importes
    const grupos = new Map<string, {
      proveedor: string; expedienteId: string; servicios: any[];
      importeTotal: number; descripciones: string[];
      expNumero: string; expReferencia: string;
    }>();
    (serviciosData || []).forEach((sv: any) => {
      const imp = Number(sv.importe_efectivo || 0);
      if (imp <= 0) return;
      if (!sv.proveedor || sv.proveedor === "null") return;
      const key = `${sv.expediente_id}|${sv.proveedor}`;
      if (!grupos.has(key)) grupos.set(key, {
        proveedor: sv.proveedor, expedienteId: sv.expediente_id, servicios: [],
        importeTotal: 0, descripciones: [],
        expNumero: sv.exp_numero || "", expReferencia: sv.exp_referencia || "",
      });
      const g = grupos.get(key)!;
      g.servicios.push(sv);
      g.importeTotal += imp;
      if (sv.descripcion) g.descripciones.push(sv.descripcion);
    });
    for (const [, g] of grupos) {
      if (g.servicios.length < 2) continue;
      if (g.importeTotal < importeMin || g.importeTotal > importeMax) continue;
      const grupoKey = `grupo_servicio_${g.expedienteId}_${g.proveedor}`;
      if (pagosPorDocumento.has(grupoKey)) continue;
      pagosPorDocumento.set(grupoKey, {
        documentoId: grupoKey,
        proveedorNombre: g.proveedor,
        proveedorNif: "",
        expedienteId: g.expedienteId,
        expedienteNumero: g.expNumero,
        expedienteDescripcion: `${g.expNumero} ${g.expReferencia}`.trim(),
        documentoNumero: g.descripciones.join(" | "),
        totalDocumento: g.importeTotal,
        pagos: g.servicios.map((sv: any) => ({
          id: sv.id,
          importe: Number(sv.importe_efectivo || 0),
          metodoPago: "TRANSFERENCIA",
        })),
      });
    }
  }

  // 5. CALCULAR SCORES PARA CADA CANDIDATO
  const candidatos: Array<MatchResult & { ranking: number }> = [];

  for (const [_, docData] of pagosPorDocumento) {
    // 4A. Score por IMPORTE
    const scoreImporte = calcularScoreImporte(
      importeAbsoluto,
      docData.pagos
    );

    // Si el score de importe es 0 (no hay coincidencia), skip este documento
    if (scoreImporte.score === 0) continue;

    // 4B. Score por CONCEPTO
    const scoreConcepto = calcularScoreConcepto(
      movimiento.concepto_limpio,
      docData.proveedorNombre,
      docData.expedienteDescripcion,
      docData.documentoNumero
    );

    // 4C. Score combinado
    const scoreTotal = combinarScores(scoreImporte.score, scoreConcepto.score);

    // Solo incluir si score >= 75 (confianza mínima)
    if (scoreTotal < 75) continue;

    const esServicio = docData.documentoId.startsWith("servicio_");
    const esGrupoServicio = docData.documentoId.startsWith("grupo_servicio_");
    const servicioId = esServicio ? docData.documentoId.replace("servicio_", "") : null;

    candidatos.push({
      origen: (esServicio || esGrupoServicio) ? "servicio" : "documento",
      pagos: scoreImporte.pagosSeleccionados.map((p) => {
        const found = docData.pagos.find((dp) => dp.id === p.id)!;
        return {
          id: found.id,
          documento_id: (esServicio || esGrupoServicio) ? null : docData.documentoId,
          importe: found.importe,
          metodo_pago: found.metodoPago,
          referencia: found.referencia,
        };
      }),
      documento_id: (esServicio || esGrupoServicio) ? null : docData.documentoId,
      servicio_id: servicioId,
      expediente_id: docData.expedienteId,
      expediente_numero: docData.expedienteNumero,
      proveedor_nombre: docData.proveedorNombre,
      proveedor_nif: docData.proveedorNif,
      importe_total: scoreImporte.pagosSeleccionados.reduce(
        (sum, p) => sum + p.importe,
        0
      ),
      match_score: scoreTotal,
      razon: esGrupoServicio
        ? (scoreImporte.tipo === "exacto" || scoreImporte.tipo === "suma"
            ? `Sumatorio de ${docData.pagos.length} servicios de ${docData.proveedorNombre} (coincidencia exacta)`
            : `Sumatorio de ${docData.pagos.length} servicios de ${docData.proveedorNombre} (coincidencia similar, dif: ${scoreImporte.diferencia.toFixed(2)}€)`)
        : esServicio
          ? (scoreImporte.tipo === "exacto"
              ? `Servicio: ${docData.proveedorNombre} (coincidencia exacta)`
              : `Servicio: ${docData.proveedorNombre} (coincidencia similar, dif: ${scoreImporte.diferencia.toFixed(2)}€)`)
          : (scoreImporte.tipo === "exacto"
            ? `Coincidencia exacta de importe (${scoreImporte.pagosSeleccionados.length} pago)`
            : scoreImporte.tipo === "suma"
              ? `Suma exacta de ${scoreImporte.pagosSeleccionados.length} plazos de pago`
              : `Coincidencia similar de importe (diferencia: ${scoreImporte.diferencia.toFixed(2)}€)`),
      metadatos: {
        criterio_importe: {
          tipo: scoreImporte.tipo,
          diferencia: scoreImporte.diferencia,
          score: scoreImporte.score,
        },
        criterio_concepto: {
          palabras_clave_movimiento: scoreConcepto.palabrasClaveMovimiento,
          palabras_clave_documento: scoreConcepto.palabrasClaveDocumento,
          coincidencias: scoreConcepto.coincidencias,
          score: scoreConcepto.score,
        },
        confianza_general: scoreTotal,
      },
      ranking: scoreTotal,
    });
  }

  // 5. SELECCIONAR EL MEJOR MATCH
  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => b.ranking - a.ranking);
  const mejorMatch = candidatos[0];

  // Retornar sin el campo ranking
  const { ranking, ...result } = mejorMatch;
  return result;
}

/**
 * Calcula score de coincidencia de importe
 * - Exacto: 100
 * - Similar (±5€): 90
 * - Suma de múltiples: 95
 * - Ninguno: 0
 */
export function calcularScoreImporte(
  importeMovimiento: number,
  pagosDisponibles: Array<{ id: string; importe: number }>
): {
  score: number;
  tipo: "exacto" | "similar" | "suma" | "ninguno";
  diferencia: number;
  pagosSeleccionados: typeof pagosDisponibles;
} {
  // 1. COINCIDENCIA EXACTA CON UN ÚNICO PAGO
  for (const pago of pagosDisponibles) {
    if (Math.abs(importeMovimiento - pago.importe) < 0.01) {
      return {
        score: 100,
        tipo: "exacto",
        diferencia: 0,
        pagosSeleccionados: [pago],
      };
    }
  }

  // 2. COINCIDENCIA SIMILAR (±5€) CON UN ÚNICO PAGO
  for (const pago of pagosDisponibles) {
    const diff = Math.abs(importeMovimiento - pago.importe);
    if (diff > 0.01 && diff <= 5) {
      return {
        score: 90,
        tipo: "similar",
        diferencia: diff,
        pagosSeleccionados: [pago],
      };
    }
  }

  // 3. SUMA DE MÚLTIPLES PAGOS
  // Buscar todas las combinaciones que sumen exactamente el importe del movimiento
  const sumasExactas = buscarCombinacionesPagos(
    pagosDisponibles,
    importeMovimiento,
    0.01
  );

  if (sumasExactas.length > 0) {
    // Preferir la combinación con menos pagos
    const mejorCombinacion = sumasExactas.sort(
      (a, b) => a.length - b.length
    )[0];
    return {
      score: 95,
      tipo: "suma",
      diferencia: 0,
      pagosSeleccionados: mejorCombinacion,
    };
  }

  // 4. SUMA SIMILAR (±5€)
  const sumasSimilares = buscarCombinacionesPagos(
    pagosDisponibles,
    importeMovimiento,
    5
  );

  if (sumasSimilares.length > 0) {
    const mejorCombinacion = sumasSimilares.sort(
      (a, b) => a.length - b.length
    )[0];
    const sumaTotal = mejorCombinacion.reduce((s, p) => s + p.importe, 0);
    const diferencia = Math.abs(importeMovimiento - sumaTotal);
    return {
      score: 85,
      tipo: "suma",
      diferencia,
      pagosSeleccionados: mejorCombinacion,
    };
  }

  // 5. SIN COINCIDENCIA
  return {
    score: 0,
    tipo: "ninguno",
    diferencia: 0,
    pagosSeleccionados: [],
  };
}

/**
 * Encuentra todas las combinaciones de pagos que sumen
 * una cantidad dentro de tolerancia
 */
function buscarCombinacionesPagos(
  pagos: Array<{ id: string; importe: number }>,
  objetivo: number,
  tolerancia: number
): Array<Array<{ id: string; importe: number }>> {
  const resultados: Array<Array<{ id: string; importe: number }>> = [];

  // Búsqueda recursiva (backtracking) limitada a 5 pagos máximo
  function buscar(
    indice: number,
    suma: number,
    combinacionActual: Array<{ id: string; importe: number }>
  ) {
    if (combinacionActual.length > 5) return; // Máximo 5 pagos por suma

    if (Math.abs(suma - objetivo) <= tolerancia) {
      resultados.push([...combinacionActual]);
      return;
    }

    if (suma > objetivo + tolerancia) return; // Poda: hemos superado el objetivo

    for (let i = indice; i < pagos.length; i++) {
      combinacionActual.push(pagos[i]);
      buscar(i + 1, suma + pagos[i].importe, combinacionActual);
      combinacionActual.pop();
    }
  }

  buscar(0, 0, []);
  return resultados;
}

/**
 * Calcula score de coincidencia de concepto
 * Usa análisis de palabras clave y proximidad textual
 */
export function calcularScoreConcepto(
  conceptoMovimiento: string,
  proveedor: string,
  expediente: string,
  documentoNumero: string
): {
  score: number;
  palabrasClaveMovimiento: string[];
  palabrasClaveDocumento: string[];
  coincidencias: string[];
} {
  // 1. EXTRAER PALABRAS CLAVE
  const palabrasMovimiento = extraerPalabrasClaveDelConcepto(conceptoMovimiento);
  const palabrasDocumento = construirPalabrasClaveDelDocumento(
    proveedor,
    expediente,
    documentoNumero
  );

  // 2. CALCULAR COINCIDENCIAS (incluye substring y bigramas unidos)
  const coincidencias = palabrasMovimiento.filter((p) =>
    palabrasDocumento.some((pd) => {
      if (similaridadTexto(p, pd) > 0.8) return true;
      if (p.length > 2 && pd.includes(p)) return true;
      if (pd.length > 2 && p.includes(pd)) return true;
      return false;
    })
  );

  // 3. CALCULAR SCORE
  let score = 0;

  if (coincidencias.length >= 3) {
    score = 100; // Muy alta confianza
  } else if (coincidencias.length === 2) {
    score = 90;
  } else if (coincidencias.length === 1) {
    // Revisar si la coincidencia es crítica
    const palabrasCriticas = ["hotel", "deposito", "anticipo", "transferencia", "blanc", "espot", "vega", "jarama"];
    if (palabrasCriticas.some(pc => similaridadTexto(coincidencias[0], pc) > 0.8)) {
      score = 80;
    } else {
      score = 50;
    }
  } else {
    score = 0;
  }

  return {
    score,
    palabrasClaveMovimiento: palabrasMovimiento,
    palabrasClaveDocumento: palabrasDocumento,
    coincidencias,
  };
}

/**
 * Extrae palabras clave del concepto del movimiento
 * Excluye palabras de parada comunes
 */
function extraerPalabrasClaveDelConcepto(concepto: string): string[] {
  const palabrasParada = new Set([
    "el", "la", "de", "del", "a", "y", "o", "en", "por", "para", "con",
    "sin", "los", "las", "un", "una", "unos", "unas", "ese", "eso",
    "transferencia", "concepto", "favor", "pago", "abono", "ingreso"
  ]);

  return concepto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[.,;:()\-/_]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2 && !palabrasParada.has(p))
    .slice(0, 15);
}

/**
 * Construye palabras clave del documento combinando
 * proveedor, expediente y número
 */
function construirPalabrasClaveDelDocumento(
  proveedor: string,
  expediente: string,
  documentoNumero: string
): string[] {
  const tokensDescripcion = (documentoNumero || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[\s\-_]+/)
    .filter((p) => p.length > 2);

  const provLimpio = (proveedor || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\bs[la]\.?\b|\bltd\.?\b|\bgmbh\b/gi, "")
    .trim();

  const tokensProveedor = provLimpio.split(/[\s\-_]+/).filter((p) => p.length > 2);
  const provUnido = tokensProveedor.join("");

  const todas = [
    ...tokensProveedor,
    provUnido,
    ...expediente.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[\s\-_]+/).filter((p) => p.length > 2),
    ...tokensDescripcion,
    documentoNumero?.replace(/\D/g, ""),
  ].filter(Boolean);

  return Array.from(new Set(todas)).slice(0, 25);
}

/**
 * Calcula similitud textual simple (Levenshtein)
 * Valores 0-1, donde 1 es coincidencia exacta
 */
function similaridadTexto(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;
  if (shorter.length === 0) return 0.0;

  const editDistance = calcularDistanciaLevenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Distancia de Levenshtein (mínimo número de ediciones)
 */
function calcularDistanciaLevenshtein(s1: string, s2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Combina scores: (importe * 0.6) + (concepto * 0.4)
 */
function combinarScores(scoreImporte: number, scoreConcepto: number): number {
  return Math.round(scoreImporte * 0.7 + scoreConcepto * 0.3);
}
