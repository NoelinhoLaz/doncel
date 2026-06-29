import { NextRequest, NextResponse } from 'next/server'
import { createAdminServerClient, createAdminServiceClient } from '@/lib/supabaseServer'
import { getAgencyDbClient } from '@/lib/agencyDb'
import { extraerDatosTiqueteTPVv2 } from '@/lib/tpv/tiquete-extractor-v2'
import { buscarMatchesTiqueteConBD } from '@/lib/tpv/matching-tpv-v2'
import {
  guardarTiqueteImportado,
  guardarTransaccionesTiquete,
  guardarMatchesPropuestos
} from '@/lib/tpv/server-actions'

export const maxDuration = 60

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

    // 2. Obtener agencia ID
    const adminServiceSupabase = createAdminServiceClient()
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from('usuarios')
      .select('agencia_id')
      .eq('auth_user_id', user.id)
      .single()

    if (usuarioError || !usuario?.agencia_id) {
      return NextResponse.json(
        { error: 'AGENCIA_NO_ENCONTRADA', mensaje: 'No se encontró la agencia del usuario' },
        { status: 400 }
      )
    }

    const agenciaId = usuario.agencia_id

    // 3. Obtener el archivo de imagen subido
    const formData = await request.formData()
    const archivo = formData.get('tiquete_imagen') as File | null
    const usuarioEmail = formData.get('usuario_email') as string || user.email || 'sistema'

    if (!archivo) {
      return NextResponse.json(
        { error: 'IMAGEN_INVALIDA', mensaje: 'No se recibió ninguna imagen de tiquete' },
        { status: 400 }
      )
    }

    const mediaType = archivo.type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'FORMATO_NO_SOPORTADO', mensaje: 'El formato de archivo no es soportado. Debe ser JPEG, PNG, GIF o WEBP.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await archivo.arrayBuffer())
    const base64Image = buffer.toString('base64')

    // 4. Invocar Extractor OCR v2
    const extraccion = await extraerDatosTiqueteTPVv2(
      base64Image,
      mediaType as any,
      agenciaId
    )

    if (!extraccion.exito || !extraccion.datos) {
      return NextResponse.json(
        { error: 'EXTRACCION_FALLIDA', mensaje: extraccion.error || 'La lectura del tiquete falló.' },
        { status: 422 }
      )
    }

    const tiqueteData = extraccion.datos
    const ocrConf = tiqueteData.validacion.confianza_global

    // 5. Guardar Tiquete en Base de Datos de la Agencia
    const resTique = await guardarTiqueteImportado(tiqueteData, ocrConf, '', usuarioEmail)
    if (!resTique.success || !resTique.tiquete_id) {
      return NextResponse.json(
        { error: 'DB_SAVE_ERROR', mensaje: resTique.error || 'Error al guardar metadatos del tiquete' },
        { status: 500 }
      )
    }

    const tiqueteId = resTique.tiquete_id

    // 6. Guardar Líneas de Transacción
    const resTrans = await guardarTransaccionesTiquete(tiqueteId, tiqueteData.transacciones)
    if (!resTrans.success) {
      return NextResponse.json(
        { error: 'DB_SAVE_ERROR', mensaje: resTrans.error || 'Error al guardar transacciones del tiquete' },
        { status: 500 }
      )
    }

    // 7. Ejecutar Motor de matching inteligente v2
    const agencyDb = await getAgencyDbClient()
    const matchesRes = await buscarMatchesTiqueteConBD(tiqueteData, agencyDb)

    // 8. Guardar Propuestas de matches en BD
    const resMatches = await guardarMatchesPropuestos(tiqueteId, matchesRes.matches)
    if (!resMatches.success) {
      console.warn('[TPV API] No se guardaron los matches propuestos en BD:', resMatches.error)
    }

    return NextResponse.json({
      exito: true,
      tiquete_id: tiqueteId,
      tiquete_datos: tiqueteData,
      resultado: matchesRes,
      confianza_extraccion: ocrConf
    }, { status: 200 })

  } catch (error) {
    console.error('[/api/tpv/importar-tiquete] Error:', error)
    return NextResponse.json(
      { error: 'ERROR_INTERNO', mensaje: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
