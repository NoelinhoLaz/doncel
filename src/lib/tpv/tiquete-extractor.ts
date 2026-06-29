import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient } from '@/lib/anthropic'

export interface LineaTransaccion {
  hora: string
  numero_tiquete: string
  concepto: string
  importe: number
}

export interface DatosExtraidosTiquete {
  numero_tiquete: string
  fecha: string // YYYY-MM-DD
  hora_apertura?: string
  hora_cierre?: string
  transacciones: LineaTransaccion[]
  total: number
  moneda: string
  tipo_cierre: 'MANUAL' | 'AUTOMATICO'
}

/**
 * Extrae datos del tiquete TPV usando Claude (OCR inteligente)
 */
export async function extraerDatosTiqueteTPV(
  imagenBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  agenciaId: string
): Promise<{
  exito: boolean
  datos?: DatosExtraidosTiquete
  error?: string
  confianza?: number
}> {
  try {
    const anthropic = await getAnthropicClient(agenciaId)

    const systemPrompt = `Eres un experto en lectura de tiquetes de TPV (terminales de punto de venta).
Tu tarea es extraer datos de un tiquete de Getnet/Santander u otro proveedor.

CAMPOS A EXTRAER:
1. Número de tiquete/terminal
2. Fecha (convertir a YYYY-MM-DD)
3. Hora de apertura y cierre (HH:MM)
4. TODAS las transacciones con:
   - Hora exacta
   - Número/ID de transacción o tiquete
   - Concepto/Descripción (ej. VENTA, DEVOLUCION)
   - Importe (número decimal con punto)
5. Total final (número decimal con punto)
6. Moneda (ej. EUR)
7. Tipo de cierre (MANUAL o AUTOMATICO)

IMPORTANTE:
- Los números pueden tener puntos o comas como separadores decimales
- Normalizar siempre a formato decimal (punto)
- Ejemplo: "166,00 EUR" → 166.00
- Ejemplo: "2.175,00 EUR" → 2175.00
- Si hay "VENTA" y "DEVOLUCIÓN", sumarlas o listarlas correctamente
- Extraer TODAS las líneas de transacción

Responde ÚNICAMENTE con un objeto JSON válido, sin usar bloques de código markdown:
{
  "numero_tiquete": "26-0001",
  "fecha": "2026-06-02",
  "hora_apertura": "09:00",
  "hora_cierre": "20:23",
  "transacciones": [
    {
      "hora": "17:49",
      "numero_tiquete": "00082",
      "concepto": "VENTA",
      "importe": 166.00
    },
    {
      "hora": "12:41",
      "numero_tiquete": "00961",
      "concepto": "VENTA",
      "importe": 2175.00
    }
  ],
  "total": 2341.00,
  "moneda": "EUR",
  "tipo_cierre": "MANUAL",
  "confianza": 0.97
}

Si no puedes leer el tiquete claramente:
{
  "error": "No se puede leer el tiquete",
  "confianza": 0.3
}
`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imagenBase64,
              },
            },
            {
              type: 'text',
              text: 'Extrae todos los datos de este tiquete TPV. Sé preciso con los importes.',
            },
          ],
        },
      ],
      system: systemPrompt,
    })

    const textContent = response.content[0]
    if (textContent.type !== 'text') {
      return {
        exito: false,
        error: 'Respuesta inválida de Claude',
      }
    }

    let jsonText = textContent.text
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const resultado = JSON.parse(jsonText)

    if (resultado.error) {
      return {
        exito: false,
        error: resultado.error,
        confianza: resultado.confianza,
      }
    }

    if (!resultado.transacciones || resultado.transacciones.length === 0) {
      return {
        exito: false,
        error: 'No se encontraron transacciones en el tiquete',
      }
    }

    const totalCalculado = resultado.transacciones.reduce(
      (sum: number, t: LineaTransaccion) => sum + t.importe,
      0
    )

    const diferencia = Math.abs(totalCalculado - resultado.total)

    if (diferencia > 0.01) {
      console.warn(
        `[TPV] Discrepancia en total: calculado ${totalCalculado}, reportado ${resultado.total}`
      )
    }

    return {
      exito: true,
      datos: {
        numero_tiquete: resultado.numero_tiquete || 'S/N',
        fecha: resultado.fecha,
        hora_apertura: resultado.hora_apertura,
        hora_cierre: resultado.hora_cierre,
        transacciones: resultado.transacciones,
        total: parseFloat(resultado.total.toFixed(2)),
        moneda: resultado.moneda || 'EUR',
        tipo_cierre: resultado.tipo_cierre || 'MANUAL',
      },
      confianza: resultado.confianza ?? 0.9,
    }
  } catch (error) {
    console.error('[TPV Extractor] Error:', error)
    return {
      exito: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
