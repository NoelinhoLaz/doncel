import { NextRequest, NextResponse } from 'next/server'
import { createAdminServerClient, createAdminServiceClient } from '@/lib/supabaseServer'
import { getAgencyDbClient } from '@/lib/agencyDb'
import { extraerDatosTiqueteTPV } from '@/lib/tpv/tiquete-extractor'
import { conciliarTiqueteConBD } from '@/lib/tpv/matching-tpv'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // 1. Obtener la sesión y el usuario autenticado
    const adminSupabase = await createAdminServerClient()
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'SESION_INVALIDA', mensaje: 'No hay usuario autenticado' },
        { status: 401 }
      )
    }

    // 2. Obtener la agencia_id del usuario
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

    // 3. Leer los datos del formulario (la imagen subida)
    const formData = await request.formData()
    const archivo = formData.get('tiquete_imagen') as File | null

    if (!archivo) {
      return NextResponse.json(
        { error: 'IMAGEN_INVALIDA', mensaje: 'No se recibió ninguna imagen de tiquete' },
        { status: 400 }
      )
    }

    // 4. Validar formato de imagen
    const mediaType = archivo.type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'FORMATO_NO_SOPORTADO', mensaje: 'Formato de imagen no soportado. Debe ser JPEG, PNG, GIF o WEBP.' },
        { status: 400 }
      )
    }

    // 5. Convertir imagen a base64
    const buffer = Buffer.from(await archivo.arrayBuffer())
    const base64Image = buffer.toString('base64')

    // 6. Extraer los datos del tiquete usando Claude OCR
    const extraccion = await extraerDatosTiqueteTPV(
      base64Image,
      mediaType as any,
      agenciaId
    )

    if (!extraccion.exito || !extraccion.datos) {
      return NextResponse.json(
        {
          error: 'EXTRACCION_FALLIDA',
          mensaje: extraccion.error || 'No se pudieron extraer los datos del tiquete',
          confianza: extraccion.confianza
        },
        { status: 422 }
      )
    }

    const datos = extraccion.datos

    // 7. Resolver el cliente de base de datos de la agencia para esta llamada
    const agencyDb = await getAgencyDbClient()

    // 8. Conciliar los movimientos extraídos con los registrados en la BD
    const resultado = await conciliarTiqueteConBD(
      datos.numero_tiquete,
      datos.fecha,
      datos.transacciones,
      agencyDb
    )

    // 9. Retornar el resultado
    return NextResponse.json({
      exito: true,
      resultado,
      confianza_extraccion: extraccion.confianza
    }, { status: 200 })

  } catch (error) {
    console.error('[/api/tpv/conciliar-tiquete] Error inesperado:', error)
    return NextResponse.json(
      { error: 'ERROR_INTERNO', mensaje: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
