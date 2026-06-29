import { LineaTransaccion } from './tiquete-extractor'

export interface RegistroBD {
  id: string
  importe_total: number
  fecha: string
  concepto: string
  created_at: string
  tipo: string
  entidad_nombre: string
  expediente_numero: string
}

export interface ResultadoMatching {
  tiquete_id: string
  numero_tiquete: string
  fecha: string
  transacciones_tiquete: LineaTransaccion[]
  registros_bd: RegistroBD[]
  matches: Array<{
    transaccion_tiquete: LineaTransaccion
    registro_bd: RegistroBD
    score: number // 0-100
    razon: string
  }>
  sin_matching: {
    en_tiquete: LineaTransaccion[]
    en_bd: RegistroBD[]
  }
  validacion: {
    total_tiquete: number
    total_bd: number
    diferencia: number
    es_correcto: boolean
    razon: string
  }
}

/**
 * Concilia transacciones del tiquete con registros de BD
 */
export async function conciliarTiqueteConBD(
  numeroTiquete: string,
  fechaTiquete: string,
  transaccionesTiquete: LineaTransaccion[],
  agencyDb: any
): Promise<ResultadoMatching> {
  // 1. Obtener registros de BD para la fecha
  const { data: registrosBD, error } = await agencyDb
    .from('contabilidad_movimientos')
    .select(`
      *,
      entidad:contabilidad_entidades!contabilidad_movimientos_entidad_id_fkey(nombre),
      expediente:operativa_expedientes(numero, referencia)
    `)
    .eq('fecha', fechaTiquete)
    .eq('medio_pago', 'tarjeta')
    .eq('tipo', 'cobro')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Error obteniendo registros BD: ${error.message}`)
  }

  const registros: RegistroBD[] = (registrosBD || []).map((r: any) => ({
    id: r.id,
    importe_total: parseFloat(r.importe_total || 0),
    fecha: r.fecha,
    concepto: r.concepto,
    created_at: r.created_at,
    tipo: r.tipo,
    entidad_nombre: r.entidad?.nombre || "—",
    expediente_numero: r.expediente?.numero || "—"
  }))

  // 2. Calcular matches
  const matches: ResultadoMatching['matches'] = []
  const transaccionesUsadas = new Set<number>()
  const registrosUsados = new Set<string>()

  // Estrategia: primero buscar coincidencias exactas con alta puntuación (>= 80)
  for (let i = 0; i < transaccionesTiquete.length; i++) {
    const transaccion = transaccionesTiquete[i]

    let mejorMatch: { registro: RegistroBD; score: number } | null = null

    for (let j = 0; j < registros.length; j++) {
      const registro = registros[j]
      if (registrosUsados.has(registro.id)) continue

      const score = calcularScoreMatch(transaccion, registro)

      if (score >= 80) {
        if (!mejorMatch || score > mejorMatch.score) {
          mejorMatch = { registro, score }
        }
      }
    }

    if (mejorMatch) {
      matches.push({
        transaccion_tiquete: transaccion,
        registro_bd: mejorMatch.registro,
        score: mejorMatch.score,
        razon: construirRazonMatch(transaccion, mejorMatch.registro, mejorMatch.score),
      })
      transaccionesUsadas.add(i)
      registrosUsados.add(mejorMatch.registro.id)
    }
  }

  // 3. Identificar elementos sin matching
  const sinMatchingTiquete = transaccionesTiquete.filter(
    (_, i) => !transaccionesUsadas.has(i)
  )

  const sinMatchingBD = registros.filter(
    (reg) => !registrosUsados.has(reg.id)
  )

  // 4. Validación final de importes totales
  const totalTiquete = transaccionesTiquete.reduce((sum, t) => sum + t.importe, 0)
  const totalBD = registros.reduce((sum, r) => sum + r.importe_total, 0)

  const diferencia = Math.abs(totalTiquete - totalBD)

  const validacion = {
    total_tiquete: parseFloat(totalTiquete.toFixed(2)),
    total_bd: parseFloat(totalBD.toFixed(2)),
    diferencia: parseFloat(diferencia.toFixed(2)),
    es_correcto: diferencia < 0.01 && sinMatchingTiquete.length === 0 && sinMatchingBD.length === 0,
    razon:
      diferencia < 0.01 && sinMatchingTiquete.length === 0 && sinMatchingBD.length === 0
        ? '✓ Conciliación perfecta'
        : diferencia < 0.01
          ? '⚠ Los totales coinciden, pero hay discrepancias en transacciones individuales'
          : `❌ Diferencia de ${diferencia.toFixed(2)}€`,
  }

  return {
    tiquete_id: `${numeroTiquete}-${fechaTiquete}`,
    numero_tiquete: numeroTiquete,
    fecha: fechaTiquete,
    transacciones_tiquete: transaccionesTiquete,
    registros_bd: registros,
    matches,
    sin_matching: {
      en_tiquete: sinMatchingTiquete,
      en_bd: sinMatchingBD,
    },
    validacion,
  }
}

/**
 * Calcula el score de matching entre una transacción y un registro
 */
function calcularScoreMatch(transaccion: LineaTransaccion, registro: RegistroBD): number {
  let score = 0

  // 1. Comparar Importe (máximo 60 puntos)
  const diferencia = Math.abs(transaccion.importe - registro.importe_total)

  if (diferencia === 0) {
    score += 60
  } else if (diferencia < 0.05) {
    score += 55
  } else if (diferencia < 1.00) {
    score += 40
  } else if (diferencia < 5.00) {
    score += 20
  }

  // 2. Comparar Concepto (máximo 40 puntos)
  const conceptoLower = (registro.concepto || '').toLowerCase()

  if (conceptoLower.includes('tique') || conceptoLower.includes('tpv') || conceptoLower.includes(transaccion.numero_tiquete.toLowerCase())) {
    score += 40
  } else if (conceptoLower.includes('cobro') || conceptoLower.includes('venta') || conceptoLower.includes('tarjeta')) {
    score += 30
  } else {
    score += 15
  }

  return score
}

/**
 * Explica brevemente el motivo del matching
 */
function construirRazonMatch(
  transaccion: LineaTransaccion,
  registro: RegistroBD,
  score: number
): string {
  const razones: string[] = []
  const diferencia = Math.abs(transaccion.importe - registro.importe_total)

  if (diferencia === 0) {
    razones.push('Importe exacto')
  } else {
    razones.push(`Importe próximo (dif: ${diferencia.toFixed(2)}€)`)
  }

  const conceptoLower = (registro.concepto || '').toLowerCase()
  if (conceptoLower.includes('tique') || conceptoLower.includes('tpv')) {
    razones.push('El concepto menciona tique/TPV')
  }

  return `${razones.join(' y ')} (Score: ${score}%)`
}
