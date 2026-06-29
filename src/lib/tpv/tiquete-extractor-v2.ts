import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient } from '@/lib/anthropic'

export interface TransaccionOCR {
  hora: string
  numero: string
  importe: number
  confianza: number
}

export interface DatosExtraidosTiquete {
  numero_tiquete: string
  fecha: string // YYYY-MM-DD
  hora_cierre?: string
  transacciones: TransaccionOCR[]
  subtotal: number
  comision: number
  total: number
  validacion: {
    es_valido: boolean
    razon: string
    confianza_global: number
  }
}

/**
 * Genera alternativas de importe intercambiando dígitos ambiguos típicos de OCR (1↔7, 5↔6, 8↔0, 2↔5)
 */
function obtenerAlternativasImporte(importe: number): number[] {
  const str = importe.toFixed(2)
  const alternativas: number[] = []

  const swaps: Record<string, string[]> = {
    '1': ['7'],
    '7': ['1'],
    '5': ['6', '2'],
    '6': ['5'],
    '8': ['0'],
    '0': ['8'],
    '2': ['5']
  }

  // Intercambiar un solo dígito ambiguo a la vez
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (swaps[char]) {
      for (const altChar of swaps[char]) {
        const altStr = str.substring(0, i) + altChar + str.substring(i + 1)
        const val = parseFloat(altStr)
        if (!isNaN(val) && val !== importe && !alternativas.includes(val)) {
          alternativas.push(val)
        }
      }
    }
  }

  return alternativas
}

/**
 * Extrae datos del tiquete TPV con validación fuzzy post-OCR
 */
export async function extraerDatosTiqueteTPVv2(
  imagenBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  agenciaId: string
): Promise<{
  exito: boolean
  datos?: DatosExtraidosTiquete
  error?: string
}> {
  try {
    const anthropic = await getAnthropicClient(agenciaId)

    const systemPrompt = `Eres un experto en lectura de tiquetes de TPV (terminales de punto de venta).
Tu tarea es extraer datos de un tiquete de Getnet/Santander u otro proveedor.

CAMPOS A EXTRAER:
1. Número de tiquete/terminal
2. Fecha (convertir a YYYY-MM-DD)
3. Hora de cierre/apertura
4. TODAS las transacciones con:
   - Hora exacta
   - Número de transacción/operación
   - Importe (número decimal con punto)
   - Confianza (número decimal de 0 a 1 indicando legibilidad)
5. Subtotal (suma de transacciones reportadas)
6. Comisión (si aplica)
7. Total final (Subtotal menos comisiones, o total neto)

IMPORTANTE:
- Los números pueden tener puntos o comas como separadores decimales.
- Normalizar siempre a formato decimal con punto.
- Si encuentras un número ambiguo o de baja calidad, indica el valor más probable y dale una confianza baja.
- Extraer absolutamente todas las líneas de la lista de transacciones.

Responde ÚNICAMENTE con un JSON válido que siga esta estructura exacta, sin bloques de código markdown:
{
  "numero_tiquete": "26-0001",
  "fecha": "2026-06-02",
  "hora_cierre": "20:23",
  "transacciones": [
    {
      "hora": "17:49",
      "numero": "00082",
      "importe": 166.00,
      "confianza": 0.98
    },
    {
      "hora": "12:41",
      "numero": "00961",
      "importe": 2125.00,
      "confianza": 0.95
    }
  ],
  "subtotal": 2291.00,
  "comision": 0.00,
  "total": 2291.00
}
`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
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
              text: `Extrae datos del tiquete TPV. IMPORTANTE:
1. Lee TODOS los números cuidadosamente
2. Si encuentras número ambiguo (1/7, 5/6, 8/0), indica alternativa
3. Suma manual de transacciones debe = total reportado
4. Si no coincide, calcula diferencia y marca como baja confianza
5. Devuelve array de alternativas si hay duda

Responde SOLO en JSON sin markdown.`,
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
        error: 'La respuesta de Claude no es de tipo texto.',
      }
    }

    let jsonText = textContent.text
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const rawData = JSON.parse(jsonText)

    if (rawData.error) {
      return {
        exito: false,
        error: rawData.error,
      }
    }

    // Estructurar campos extraídos
    const numero_tiquete = rawData.numero_tiquete || 'S/N'
    const fecha = rawData.fecha || new Date().toISOString().split('T')[0]
    const hora_cierre = rawData.hora_cierre
    const transacciones: TransaccionOCR[] = (rawData.transacciones || []).map((t: any) => ({
      hora: t.hora || '00:00',
      numero: t.numero || 'S/N',
      importe: parseFloat(t.importe || 0),
      confianza: parseFloat(t.confianza ?? 0.9),
    }))

    const subtotalReportado = parseFloat(rawData.subtotal || 0)
    const comisionReportada = parseFloat(rawData.comision || 0)
    const totalReportado = parseFloat(rawData.total || 0)

    // Validar rango de importes (Validación de seguridad Fase 7)
    for (const t of transacciones) {
      if (t.importe < 0.1 || t.importe > 50000) {
        console.warn(`[TPV OCR] Importe sospechoso detectado en transacción: ${t.importe}€`)
      }
    }

    if (transacciones.length < 1 || transacciones.length > 150) {
      return {
        exito: false,
        error: `Cantidad de transacciones sospechosa o no legible (${transacciones.length}).`,
      }
    }

    // 1. Calcular suma local
    let sumaCalculada = transacciones.reduce((sum, t) => sum + t.importe, 0)
    let esValido = Math.abs(sumaCalculada - subtotalReportado) < 0.01
    let razonVal = esValido ? 'Suma de transacciones coincide con subtotal reportado.' : 'Discrepancia en suma de transacciones.'
    let confianzaGlobal = transacciones.reduce((sum, t) => sum + t.confianza, 0) / (transacciones.length || 1)

    // 2. Ejecutar Algoritmo Fuzzy de reintentos si no coincide la suma
    if (!esValido) {
      let corregido = false
      // Intentar sustituir el valor de UNA transacción por una alternativa típica de OCR y ver si cuadra
      for (let i = 0; i < transacciones.length; i++) {
        const altImportes = obtenerAlternativasImporte(transacciones[i].importe)
        for (const altVal of altImportes) {
          const nuevaSuma = sumaCalculada - transacciones[i].importe + altVal
          if (Math.abs(nuevaSuma - subtotalReportado) < 0.01) {
            transacciones[i].importe = altVal
            transacciones[i].confianza = 0.50 // Marcar con menor confianza al haber sido corregido
            sumaCalculada = nuevaSuma
            esValido = true
            corregido = true
            razonVal = 'Suma de transacciones coincide con subtotal reportado tras corrección fuzzy.'
            confianzaGlobal = Math.max(0.4, confianzaGlobal - 0.15) // penalizar confianza global levemente
            break
          }
        }
        if (corregido) break
      }
    }

    // 3. Chequear si la discrepancia es mayor al 5%
    const diferenciaAbs = Math.abs(sumaCalculada - subtotalReportado)
    const porcentajeDiferencia = subtotalReportado > 0 ? (diferenciaAbs / subtotalReportado) * 100 : 0
    if (porcentajeDiferencia > 5.0) {
      confianzaGlobal = Math.min(0.4, confianzaGlobal)
      razonVal = `Diferencia crítica en totales (${porcentajeDiferencia.toFixed(1)}%). Confianza global degradada.`
      esValido = false
    }

    return {
      exito: true,
      datos: {
        numero_tiquete,
        fecha,
        hora_cierre,
        transacciones,
        subtotal: parseFloat(sumaCalculada.toFixed(2)),
        comision: comisionReportada,
        total: parseFloat((sumaCalculada - comisionReportada).toFixed(2)),
        validacion: {
          es_valido: esValido,
          razon: razonVal,
          confianza_global: parseFloat(confianzaGlobal.toFixed(2)),
        },
      },
    }
  } catch (error) {
    console.error('[TPV Extractor v2] Error:', error)
    return {
      exito: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
