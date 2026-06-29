import { TransaccionOCR } from './tiquete-extractor-v2'

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

export interface ResultadoMatchingTPV {
  tiquete_id: string
  total_tiquete: number
  matches: Array<{
    transaccion_tpv: TransaccionOCR & { id?: string }
    movimiento_bd: RegistroBD
    score: number
    razon: string
  }>
  sin_matching_tpv: TransaccionOCR[]
  sin_matching_bd: RegistroBD[]
  validacion: {
    total_matcheado: number
    diferencia: number
    es_correcto: boolean
    estado: 'correcto' | 'parcial' | 'conflicto'
    razon: string
  }
}

/**
 * Parsea una hora en formato HH:MM a minutos desde medianoche
 */
function parseHoraEnMinutos(horaStr: string): number {
  const parts = horaStr.split(':')
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m
    }
  }
  return 0
}

/**
 * Parsea un timestamp ISO a minutos locales desde medianoche
 */
function parseTimestampEnMinutos(timestampStr: string): number {
  try {
    const d = new Date(timestampStr)
    const h = d.getHours()
    const m = d.getMinutes()
    return h * 60 + m
  } catch {
    return 0
  }
}

/**
 * Calcula la diferencia en horas entre dos horarios (formato circular de 24h)
 */
function obtenerDiferenciaHoras(horaStr: string, timestampStr: string): number {
  const m1 = parseHoraEnMinutos(horaStr)
  const m2 = parseTimestampEnMinutos(timestampStr)
  const diffMin = Math.abs(m1 - m2)
  const circularDiff = Math.min(diffMin, 1440 - diffMin)
  return circularDiff / 60
}

/**
 * Busca combinaciones de 2 o 3 movimientos de BD que sumen exactamente un importe objetivo (Subset Sum)
 */
function buscarCombinacionesSuma(
  importeObjetivo: number,
  candidatos: RegistroBD[],
  maxTamanho = 3
): RegistroBD[] | null {
  // Probar parejas (tamaño 2)
  for (let i = 0; i < candidatos.length; i++) {
    for (let j = i + 1; j < candidatos.length; j++) {
      const suma = candidatos[i].importe_total + candidatos[j].importe_total
      if (Math.abs(suma - importeObjetivo) < 0.01) {
        return [candidatos[i], candidatos[j]]
      }
    }
  }

  // Probar tríos (tamaño 3)
  if (maxTamanho >= 3) {
    for (let i = 0; i < candidatos.length; i++) {
      for (let j = i + 1; j < candidatos.length; j++) {
        for (let k = j + 1; k < candidatos.length; k++) {
          const suma = candidatos[i].importe_total + candidatos[j].importe_total + candidatos[k].importe_total
          if (Math.abs(suma - importeObjetivo) < 0.01) {
            return [candidatos[i], candidatos[j], candidatos[k]]
          }
        }
      }
    }
  }

  return null
}

/**
 * Algoritmo de scoring individual para transacciones
 */
function calcularScoreMatch(transaccion: TransaccionOCR, registro: RegistroBD): { score: number; razon: string } {
  let score = 0
  const razones: string[] = []

  const diferencia = Math.abs(transaccion.importe - registro.importe_total)

  // 1. Scoring por importe (máximo 60 puntos)
  if (diferencia === 0) {
    score += 60
    razones.push('Importe exacto')
  } else if (diferencia < 0.05) {
    score += 55
    razones.push(`Importe casi exacto (dif: ${diferencia.toFixed(2)}€)`)
  } else if (diferencia < 1.00) {
    score += 40
    razones.push(`Importe similar (dif: ${diferencia.toFixed(2)}€)`)
  } else if (diferencia < 5.00) {
    score += 20
    razones.push(`Importe próximo (dif: ${diferencia.toFixed(2)}€)`)
  }

  // 2. Scoring por concepto y tique (máximo 40 puntos)
  const conceptoLower = (registro.concepto || '').toLowerCase()
  const nTiqueLower = (transaccion.numero || '').toLowerCase()

  if (nTiqueLower !== 's/n' && conceptoLower.includes(nTiqueLower)) {
    score += 40
    razones.push('El concepto contiene el número de tique')
  } else if (conceptoLower.includes('tique') || conceptoLower.includes('tpv')) {
    score += 35
    razones.push('Concepto menciona tique/TPV')
  } else if (conceptoLower.includes('cobro') || conceptoLower.includes('venta') || conceptoLower.includes('tarjeta')) {
    score += 25
    razones.push('Concepto genérico de cobro/venta')
  } else {
    score += 10
  }

  // 3. Scoring adicional por hora (máximo 10 puntos)
  const horaDiff = obtenerDiferenciaHoras(transaccion.hora, registro.created_at)
  if (horaDiff <= 0.5) {
    score += 10
    razones.push('Horario coincide estrechamente (±30m)')
  } else if (horaDiff <= 2.0) {
    score += 5
    razones.push('Horario cercano (±2h)')
  }

  // Limitar score a 100
  const finalScore = Math.min(100, score)
  return { score: finalScore, razon: `${razones.join(', ')} (Score: ${finalScore}%)` }
}

/**
 * Busca coincidencias entre las transacciones extraídas del tiquete y los cobros por tarjeta en base de datos
 */
export async function buscarMatchesTiqueteConBD(
  tiquete: { numero_tiquete: string; fecha: string; transacciones: TransaccionOCR[]; total: number },
  agencyDb: any
): Promise<ResultadoMatchingTPV> {
  // 1. Obtener los movimientos de contabilidad_movimientos para ese día
  const { data: registrosBD, error } = await agencyDb
    .from('contabilidad_movimientos')
    .select(`
      *,
      entidad:contabilidad_entidades!contabilidad_movimientos_entidad_id_fkey(nombre),
      expediente:operativa_expedientes(numero, referencia)
    `)
    .eq('fecha', tiquete.fecha)
    .eq('medio_pago', 'tarjeta')
    .eq('tipo', 'cobro')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Error al recuperar movimientos para matching TPV: ${error.message}`)
  }

  const registros: RegistroBD[] = (registrosBD || []).map((r: any) => ({
    id: r.id,
    importe_total: parseFloat(r.importe_total || 0),
    fecha: r.fecha,
    concepto: r.concepto,
    created_at: r.created_at,
    tipo: r.tipo,
    entidad_nombre: r.entidad?.nombre || '—',
    expediente_numero: r.expediente?.numero || '—'
  }))

  const matches: ResultadoMatchingTPV['matches'] = []
  const transaccionesUsadas = new Set<number>()
  const registrosUsados = new Set<string>()

  // --- ESTRATEGIA A, B, C: Coincidencias unitarias exactas, similares o fuzzy ---
  for (let i = 0; i < tiquete.transacciones.length; i++) {
    const transaccion = tiquete.transacciones[i]

    let mejorMatch: { registro: RegistroBD; score: number; razon: string } | null = null

    for (let j = 0; j < registros.length; j++) {
      const registro = registros[j]
      if (registrosUsados.has(registro.id)) continue

      const matchRes = calcularScoreMatch(transaccion, registro)

      // Score mínimo para proponer match unitario: 70
      if (matchRes.score >= 70) {
        if (!mejorMatch || matchRes.score > mejorMatch.score) {
          mejorMatch = { registro, score: matchRes.score, razon: matchRes.razon }
        }
      }
    }

    if (mejorMatch) {
      matches.push({
        transaccion_tpv: transaccion,
        movimiento_bd: mejorMatch.registro,
        score: mejorMatch.score,
        razon: mejorMatch.razon
      })
      transaccionesUsadas.add(i)
      registrosUsados.add(mejorMatch.registro.id)
    }
  }

  // --- ESTRATEGIA D: Búsqueda de sumas múltiples (Subset Sum) para transacciones huérfanas ---
  for (let i = 0; i < tiquete.transacciones.length; i++) {
    if (transaccionesUsadas.has(i)) continue
    const transaccion = tiquete.transacciones[i]

    // Obtener candidatos de BD que aún no han sido emparejados
    const candidatosLibres = registros.filter(r => !registrosUsados.has(r.id))
    
    // Buscar combinación de 2 o 3 movimientos que sumen este importe
    const combinacion = buscarCombinacionesSuma(transaccion.importe, candidatosLibres)

    if (combinacion) {
      // Proponer matches individuales para cada elemento de la combinación con Score 95
      for (const reg of combinacion) {
        matches.push({
          transaccion_tpv: transaccion,
          movimiento_bd: reg,
          score: 95,
          razon: `Suma múltiple (Score: 95%). Movimiento de ${reg.importe_total.toFixed(2)}€ parte de un grupo de ${combinacion.length} movimientos que sumados cuadran los ${transaccion.importe.toFixed(2)}€ de la transacción.`
        })
        registrosUsados.add(reg.id)
      }
      transaccionesUsadas.add(i)
    }
  }

  // 3. Agrupar elementos no emparejados
  const sinMatchingTPV = tiquete.transacciones.filter((_, idx) => !transaccionesUsadas.has(idx))
  const sinMatchingBD = registros.filter(reg => !registrosUsados.has(reg.id))

  // 4. Validación global de totales y estado final
  const totalMatcheado = matches.reduce((sum, m) => sum + m.movimiento_bd.importe_total, 0)
  const diferencia = Math.abs(tiquete.total - totalMatcheado)
  
  let estado: ResultadoMatchingTPV['validacion']['estado'] = 'correcto'
  let razon = '✓ Conciliación perfecta'

  if (diferencia >= 0.01) {
    if (matches.length > 0) {
      estado = 'parcial'
      razon = `⚠ Conciliación parcial. Diferencia de ${diferencia.toFixed(2)}€`
    } else {
      estado = 'conflicto'
      razon = `❌ Conflicto. Ningún movimiento coincide con el total del tiquete (dif: ${diferencia.toFixed(2)}€)`
    }
  } else if (sinMatchingTPV.length > 0 || sinMatchingBD.length > 0) {
    estado = 'parcial'
    razon = '⚠ Totales coinciden pero hay transacciones individuales sin matching'
  }

  return {
    tiquete_id: tiquete.numero_tiquete,
    total_tiquete: tiquete.total,
    matches,
    sin_matching_tpv: sinMatchingTPV,
    sin_matching_bd: sinMatchingBD,
    validacion: {
      total_matcheado: parseFloat(totalMatcheado.toFixed(2)),
      diferencia: parseFloat(diferencia.toFixed(2)),
      es_correcto: estado === 'correcto',
      estado,
      razon
    }
  }
}
