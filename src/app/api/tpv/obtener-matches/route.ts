import { NextRequest, NextResponse } from 'next/server'
import { createAdminServerClient } from '@/lib/supabaseServer'
import { getAgencyDbClient } from '@/lib/agencyDb'

export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticación
    const adminSupabase = await createAdminServerClient()
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'SESION_INVALIDA', mensaje: 'No hay usuario autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const tiqueteId = body.tiquete_id

    if (!tiqueteId) {
      return NextResponse.json(
        { error: 'PARAMETRO_FALTANTE', mensaje: 'tiquete_id es requerido' },
        { status: 400 }
      )
    }

    const agencyDb = await getAgencyDbClient()

    // Query matched rows
    const { data: matches, error } = await agencyDb
      .from('tpv_movimientos_matched')
      .select(`
        id,
        score_match,
        razon,
        estado,
        transaccion_tpv:tpv_tiquetes_transacciones!inner(id, hora, importe, numero_transaccion, tipo, tiquete_id),
        movimiento_bd:contabilidad_movimientos!inner(
          id,
          importe_total,
          concepto,
          created_at,
          tipo,
          entidad:contabilidad_entidades!contabilidad_movimientos_entidad_id_fkey(nombre),
          expediente:operativa_expedientes(numero)
        )
      `)
      .eq('transaccion_tpv.tiquete_id', tiqueteId)

    if (error) {
      throw new Error(`Error recuperando matches: ${error.message}`)
    }

    // Format output
    const formatted = (matches || []).map((m: any) => ({
      id: m.id,
      score: m.score_match,
      razon: m.razon,
      estado: m.estado,
      transaccion_tpv: {
        id: m.transaccion_tpv.id,
        hora: m.transaccion_tpv.hora,
        importe: parseFloat(m.transaccion_tpv.importe || 0),
        numero: m.transaccion_tpv.numero_transaccion || 'S/N',
        concepto: m.transaccion_tpv.tipo
      },
      movimiento_bd: {
        id: m.movimiento_bd.id,
        importe_total: parseFloat(m.movimiento_bd.importe_total || 0),
        concepto: m.movimiento_bd.concepto,
        created_at: m.movimiento_bd.created_at,
        entidad_nombre: m.movimiento_bd.entidad?.nombre || '—',
        expediente_numero: m.movimiento_bd.expediente?.numero || '—'
      }
    }))

    return NextResponse.json({ exito: true, matches: formatted }, { status: 200 })
  } catch (error: any) {
    console.error('[/api/tpv/obtener-matches] Error:', error)
    return NextResponse.json(
      { error: 'ERROR_INTERNO', mensaje: error.message },
      { status: 500 }
    )
  }
}
