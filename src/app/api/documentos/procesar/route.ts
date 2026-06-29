import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { procesarDocumento } from '@/lib/documentos/procesador'
import { DocumentoError } from '@/lib/documentos/tipos'

// Tiempo máximo de ejecución para el procesado con IA (en segundos).
// Ver: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md
export const maxDuration = 60


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('pdf') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'PDF_INVALIDO', mensaje: 'No se recibió ningún archivo' },
        { status: 400 }
      )
    }

    const resultado = await procesarDocumento(file)

    return NextResponse.json(resultado, { status: 200 })
  } catch (error) {
    if (error instanceof DocumentoError) {
      return NextResponse.json(
        {
          error:        error.codigo,
          mensaje:      error.message,
          documento_id: error.documento_id ?? null
        },
        { status: error.codigo === 'PDF_INVALIDO' ? 400 : 500 }
      )
    }

    console.error('[/api/documentos/procesar] Error inesperado:', error)
    return NextResponse.json(
      { error: 'ERROR_DESCONOCIDO', mensaje: 'Error inesperado en el servidor' },
      { status: 500 }
    )
  }
}
