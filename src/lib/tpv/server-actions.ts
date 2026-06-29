"use server"

import { getAgencyDbClient } from '@/lib/agencyDb'
import { DatosExtraidosTiquete } from './tiquete-extractor-v2'

/**
 * Guarda los metadatos generales del tiquete importado
 */
export async function guardarTiqueteImportado(
  tiquete: DatosExtraidosTiquete,
  confianza_ocr: number,
  imagen_url: string,
  usuario_email: string
): Promise<{ success: boolean; tiquete_id?: string; error?: string }> {
  try {
    const agencyDb = await getAgencyDbClient()
    
    // Insertar o actualizar tiquete (UNIQUE onConflict para evitar duplicidad)
    const { data, error } = await agencyDb
      .from('tpv_tiquetes')
      .upsert({
        numero_tiquete: tiquete.numero_tiquete,
        fecha: tiquete.fecha,
        hora_cierre: tiquete.hora_cierre || null,
        subtotal: tiquete.subtotal,
        comision: tiquete.comision,
        total: tiquete.total,
        confianza_ocr: confianza_ocr,
        imagen_url: imagen_url || null,
        importado_por: usuario_email,
        estado: tiquete.validacion.es_valido ? 'pendiente' : 'conflicto',
        updated_at: new Date().toISOString()
      }, { onConflict: 'numero_tiquete, fecha' })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`Error insertando tiquete TPV: ${error?.message}`)
    }

    return { success: true, tiquete_id: data.id }
  } catch (error: any) {
    console.error('[TPV Server Action] guardarTiqueteImportado:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Guarda las transacciones individuales asociadas al tiquete
 */
export async function guardarTransaccionesTiquete(
  tiquete_id: string,
  transacciones: any[]
): Promise<{ success: boolean; transaccion_ids?: string[]; error?: string }> {
  try {
    const agencyDb = await getAgencyDbClient()

    // Limpiar transacciones previas para evitar duplicados en re-importaciones
    await agencyDb
      .from('tpv_tiquetes_transacciones')
      .delete()
      .eq('tiquete_id', tiquete_id)

    const rows = transacciones.map(t => ({
      tiquete_id,
      hora: t.hora || null,
      numero_transaccion: t.numero || null,
      tipo: t.concepto || 'VENTA',
      importe: t.importe,
      confianza: t.confianza || 0.90
    }))

    const { data, error } = await agencyDb
      .from('tpv_tiquetes_transacciones')
      .insert(rows)
      .select('id')

    if (error || !data) {
      throw new Error(`Error insertando transacciones de tiquete: ${error?.message}`)
    }

    return { success: true, transaccion_ids: data.map((r: any) => r.id) }
  } catch (error: any) {
    console.error('[TPV Server Action] guardarTransaccionesTiquete:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Guarda los matches propuestos por el motor de conciliación en la base de datos
 */
export async function guardarMatchesPropuestos(
  tiquete_id: string,
  matches: any[]
): Promise<{ success: boolean; matches_guardados?: number; error?: string }> {
  try {
    const agencyDb = await getAgencyDbClient()

    // Obtener las transacciones del tiquete recién guardadas en BD para mapear sus IDs
    const { data: dbTrans } = await agencyDb
      .from('tpv_tiquetes_transacciones')
      .select('id, hora, importe')
      .eq('tiquete_id', tiquete_id)

    if (!dbTrans || dbTrans.length === 0) {
      throw new Error('No se encontraron transacciones en BD para vincular matches.')
    }

    const proposedRows: any[] = []

    for (const match of matches) {
      const tpvLine = match.transaccion_tpv
      const dbMov = match.movimiento_bd

      // Emparejar por importe y hora para obtener el ID de la transacción del tiquete
      const matchingTrans = dbTrans.find((t: any) => 
        Math.abs(parseFloat(t.importe) - tpvLine.importe) < 0.01 && 
        (!tpvLine.hora || t.hora?.substring(0, 5) === tpvLine.hora)
      )

      if (matchingTrans) {
        proposedRows.push({
          transaccion_tpv_id: matchingTrans.id,
          movimiento_bd_id: dbMov.id,
          score_match: match.score || 90,
          razon: match.razon || 'Propuesta automática',
          estado: 'propuesto'
        })
      }
    }

    if (proposedRows.length > 0) {
      const transIds = proposedRows.map(r => r.transaccion_tpv_id)
      
      // Limpiar propuestas anteriores para evitar conflictos UNIQUE
      await agencyDb
        .from('tpv_movimientos_matched')
        .delete()
        .in('transaccion_tpv_id', transIds)

      const { data, error } = await agencyDb
        .from('tpv_movimientos_matched')
        .upsert(proposedRows, { onConflict: 'transaccion_tpv_id, movimiento_bd_id' })
        .select()

      if (error) {
        throw new Error(`Error guardando matches propuestos: ${error.message}`)
      }

      return { success: true, matches_guardados: data?.length || 0 }
    }

    return { success: true, matches_guardados: 0 }
  } catch (error: any) {
    console.error('[TPV Server Action] guardarMatchesPropuestos:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Confirma una vinculación transacción TPV ↔ movimiento BD
 */
export async function confirmarMatchTPV(
  transaccion_tpv_id: string,
  movimiento_bd_id: string,
  usuario_email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const agencyDb = await getAgencyDbClient()

    // 1. Confirmar el match en la tabla puente
    const { error: errMatch } = await agencyDb
      .from('tpv_movimientos_matched')
      .upsert({
        transaccion_tpv_id,
        movimiento_bd_id,
        estado: 'confirmado',
        confirmado_por: usuario_email,
        confirmado_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'transaccion_tpv_id, movimiento_bd_id' })

    if (errMatch) {
      throw new Error(`Error actualizando estado del match: ${errMatch.message}`)
    }

    // 2. Obtener el id del tiquete a partir de la transacción para asociar
    const { data: trans, error: errTrans } = await agencyDb
      .from('tpv_tiquetes_transacciones')
      .select('tiquete_id')
      .eq('id', transaccion_tpv_id)
      .single()

    if (errTrans || !trans) {
      throw new Error(`No se encontró la transacción de origen: ${errTrans?.message}`)
    }

    const tiqueteId = trans.tiquete_id

    // 3. Vincular el movimiento contable al tiquete actualizando tpv_tiquete_id
    const { error: errMov } = await agencyDb
      .from('contabilidad_movimientos')
      .update({ tpv_tiquete_id: tiqueteId })
      .eq('id', movimiento_bd_id)

    if (errMov) {
      throw new Error(`Error asociando movimiento contable al tiquete: ${errMov.message}`)
    }

    return { success: true }
  } catch (error: any) {
    console.error('[TPV Server Action] confirmarMatchTPV:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Descarta una propuesta de match, desvincula registros y calcula candidatos alternativos
 */
export async function rechazarMatchTPV(
  match_id: string,
  razon?: string
): Promise<{ success: boolean; alternativas?: any[]; error?: string }> {
  try {
    const agencyDb = await getAgencyDbClient()

    // 1. Obtener detalles del match a rechazar
    const { data: matchData, error: errFetch } = await agencyDb
      .from('tpv_movimientos_matched')
      .select(`
        *,
        transaccion_tpv:tpv_tiquetes_transacciones(id, hora, importe, tiquete:tpv_tiquetes(fecha))
      `)
      .eq('id', match_id)
      .single()

    if (errFetch || !matchData) {
      throw new Error(`Match a rechazar no encontrado: ${errFetch?.message}`)
    }

    const transId = matchData.transaccion_tpv_id
    const movId = matchData.movimiento_bd_id
    const trans = matchData.transaccion_tpv as any

    if (!trans) {
      throw new Error('Transacción TPV no asociada al match.')
    }

    // 2. Marcar match como rechazado
    const { error: errUpdate } = await agencyDb
      .from('tpv_movimientos_matched')
      .update({
        estado: 'rechazado',
        razon: razon || 'Rechazado por el usuario',
        updated_at: new Date().toISOString()
      })
      .eq('id', match_id)

    if (errUpdate) {
      throw new Error(`Error rechazando match: ${errUpdate.message}`)
    }

    // 3. Limpiar tpv_tiquete_id en el movimiento contable
    await agencyDb
      .from('contabilidad_movimientos')
      .update({ tpv_tiquete_id: null })
      .eq('id', movId)

    // 4. Buscar movimientos alternativos en la fecha del tiquete
    const fecha = trans.tiquete.fecha
    const importe = parseFloat(trans.importe)

    const { data: registrosBD } = await agencyDb
      .from('contabilidad_movimientos')
      .select(`
        *,
        entidad:contabilidad_entidades!contabilidad_movimientos_entidad_id_fkey(nombre),
        expediente:operativa_expedientes(numero, referencia)
      `)
      .eq('fecha', fecha)
      .eq('medio_pago', 'tarjeta')
      .eq('tipo', 'cobro')
      .neq('id', movId) // Excluir el rechazado

    // Filtrar candidatos confirmados en otras transacciones
    const { data: confirmedMatches } = await agencyDb
      .from('tpv_movimientos_matched')
      .select('movimiento_bd_id')
      .eq('estado', 'confirmado')

    const confirmedIds = new Set(confirmedMatches?.map(m => m.movimiento_bd_id) || [])
    const alternativasRaw = (registrosBD || []).filter((r: any) => !confirmedIds.has(r.id))

    const transaccionSimplificada = {
      hora: trans.hora || '00:00',
      numero: trans.numero_transaccion || 'S/N',
      importe,
      confianza: parseFloat(trans.confianza || 0.9)
    }

    const { calcularScoreMatch } = await import('./matching-tpv-v2') as any

    // Recalcular puntuaciones para alternativas
    const alternativas = alternativasRaw.map((r: any) => {
      const reg = {
        id: r.id,
        importe_total: parseFloat(r.importe_total || 0),
        fecha: r.fecha,
        concepto: r.concepto,
        created_at: r.created_at,
        tipo: r.tipo,
        entidad_nombre: r.entidad?.nombre || '—',
        expediente_numero: r.expediente?.numero || '—'
      }
      const matchRes = calcularScoreMatch(transaccionSimplificada, reg)
      return {
        movimiento_bd: reg,
        score: matchRes.score,
        razon: matchRes.razon
      }
    }).filter(alt => alt.score >= 50)
      .sort((a, b) => b.score - a.score)

    return { success: true, alternativas }
  } catch (error: any) {
    console.error('[TPV Server Action] rechazarMatchTPV:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Crea un movimiento contable manual asociado a la transacción de TPV cuando no existe coincidencia en la base de datos
 */
export async function crearMovimientoBDDesdreTPV(
  transaccion_tpv_id: string,
  concepto?: string
): Promise<{ success: boolean; movimiento_id?: string; error?: string }> {
  try {
    const agencyDb = await getAgencyDbClient()

    // 1. Obtener la transacción de TPV
    const { data: trans, error: errTrans } = await agencyDb
      .from('tpv_tiquetes_transacciones')
      .select(`
        *,
        tiquete:tpv_tiquetes(id, fecha, numero_tiquete)
      `)
      .eq('id', transaccion_tpv_id)
      .single()

    if (errTrans || !trans) {
      throw new Error(`Transacción TPV no encontrada: ${errTrans?.message}`)
    }

    const transData = trans as any
    const importe = parseFloat(transData.importe)
    const fecha = transData.tiquete.fecha
    const nTique = transData.tiquete.numero_tiquete
    const tiqueteId = transData.tiquete.id

    // 2. Resolver una entidad por defecto para vincular
    const { data: defaultEntity } = await agencyDb
      .from('contabilidad_entidades')
      .select('id')
      .limit(1)
      .maybeSingle()

    const entityId = defaultEntity?.id || null
    const finalConcepto = concepto || `Cobro TPV Tarjeta - Línea ${transData.hora || ''} (Tique: ${nTique})`

    // 3. Insertar el cobro en contabilidad_movimientos
    const { data: newMov, error: errMov } = await agencyDb
      .from('contabilidad_movimientos')
      .insert([{
        entidad_id: entityId,
        usuario_id: '550e8400-e29b-41d4-a716-446655440000', // Default System UUID
        tipo: 'cobro',
        importe_total: importe,
        moneda: 'EUR',
        medio_pago: 'tarjeta',
        fecha: fecha,
        concepto: finalConcepto,
        estado: 'confirmado',
        tpv_tiquete_id: tiqueteId
      }])
      .select('id')
      .single()

    if (errMov || !newMov) {
      throw new Error(`Error creando movimiento contable: ${errMov?.message}`)
    }

    // 4. Registrar match confirmado en la tabla puente
    await agencyDb
      .from('tpv_movimientos_matched')
      .upsert({
        transaccion_tpv_id,
        movimiento_bd_id: newMov.id,
        estado: 'confirmado',
        razon: 'Creado y conciliado manualmente desde TPV',
        confirmado_at: new Date().toISOString()
      }, { onConflict: 'transaccion_tpv_id, movimiento_bd_id' })

    return { success: true, movimiento_id: newMov.id }
  } catch (error: any) {
    console.error('[TPV Server Action] crearMovimientoBDDesdreTPV:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Recupera el histórico de tiquetes sincronizados para auditoría
 */
export async function obtenerHistoricoTiquetes(): Promise<{ success: boolean; tiquetes?: any[]; error?: string }> {
  try {
    const agencyDb = await getAgencyDbClient()
    const { data, error } = await agencyDb
      .from('tpv_tiquetes')
      .select('*')
      .order('fecha', { ascending: false })
      .order('importado_at', { ascending: false })

    if (error) {
      throw error
    }

    return { success: true, tiquetes: data || [] }
  } catch (error: any) {
    console.error('[TPV Server Action] obtenerHistoricoTiquetes:', error)
    return { success: false, error: error.message }
  }
}
