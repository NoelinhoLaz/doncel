import { NextRequest, NextResponse } from 'next/server'
import { createAdminServerClient } from '@/lib/supabaseServer'
import { confirmarMatchTPV } from '@/lib/tpv/server-actions'

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
    const { transaccion_tpv_id, movimiento_bd_id } = body

    if (!transaccion_tpv_id || !movimiento_bd_id) {
      return NextResponse.json(
        { error: 'PARAMETRO_FALTANTE', mensaje: 'transaccion_tpv_id y movimiento_bd_id son requeridos' },
        { status: 400 }
      )
    }

    const email = user.email || 'sistema'
    const res = await confirmarMatchTPV(transaccion_tpv_id, movimiento_bd_id, email)

    if (!res.success) {
      return NextResponse.json(
        { error: 'CONFIRMACION_FALLIDA', mensaje: res.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[/api/tpv/confirmar-match] Error:', error)
    return NextResponse.json(
      { error: 'ERROR_INTERNO', mensaje: error.message },
      { status: 500 }
    )
  }
}
