import { createAdminServerClient, createAdminServiceClient } from '@/lib/supabaseServer'
import { getAgencyDbClient } from '@/lib/agencyDb'
import { getAnthropicClient } from '@/lib/anthropic'
import { subirPDF, subirExtraccion } from './storage'
import { parseFechaIA, mapearLineaParaDB, parsearNumero } from './parsers'
import {
  DocumentoError,
  type ExtraccionIA,
  type ResultadoProcesamiento
} from './tipos'

export const SYSTEM_PROMPT_EXTRACCION = `
CRÍTICO: No uses bloques de código markdown. No uses \`\`\`json ni \`\`\`. 
Devuelve el objeto JSON directamente sin ningún envoltorio.

CRÍTICO: Los números e importes decimales usan SIEMPRE punto como separador y exactamente dos decimales (ejemplos correctos: 76.93, 39.96, 116.89). NUNCA omitas ni elimines el punto decimal: escribir 3996 en lugar de 39.96 o 7693 en lugar de 76.93 es un error grave. Conserva con absoluta precisión los decimales del documento original.

CRÍTICO: Para ahorrar tokens y acelerar la latencia de respuesta, OMITE por completo los campos que tengan valor null del JSON de salida (tanto en la cabecera como en cada línea). Si un campo no tiene datos o es nulo en el documento, no lo incluyas en absoluto en el objeto JSON de salida.

Eres un agente especializado en extracción de datos de documentos
financieros de agencias de viajes españolas. Tu única función es
analizar el documento adjunto y devolver un JSON estructurado.
Nunca respondas con texto libre, explicaciones, markdown ni bloques
de código. Devuelve EXCLUSIVAMENTE el objeto JSON válido.

TIPOS DE DOCUMENTO: FACTURA (número oficial, base imponible e IVA
desglosado), PROFORMA (presupuesto previo, puede no tener IVA),
BORDERO_SEGUROS (listado mensual de primas emitido por correduría),
ALBARAN (entrega sin importe fiscal).

TIPOS DE SERVICIO — INSTRUCCIÓN CRÍTICA:
Los tipos de servicio disponibles se inyectan en cada llamada dentro
del mensaje del usuario bajo la sección "TIPOS DE SERVICIO DISPONIBLES".

REGLAS OBLIGATORIAS:
1. SOLO puedes usar los tipos que aparecen en esa sección del mensaje
2. NUNCA inventes un tipo que no esté en la lista
3. SIEMPRE usa el UUID exacto tal como aparece, sin modificarlo
4. Si un concepto no encaja claramente en ningún tipo, usa el UUID
   del tipo "Otros"
5. Si la sección está ausente o vacía devuelve:
   {"error": "TIPOS_NO_DISPONIBLES", "mensaje": "No se han inyectado tipos de servicio"}

REGLAS OBLIGATORIAS DE CLASIFICACIÓN:
- Alojamiento    : hotel, habitación, hab, room, pensión completa, PC,
                   media pensión, MP, BB, RO, resort, hostel
- Vuelos         : billete de avión, ticket aéreo, tasas aéreas, vuelo,
                   ruta con códigos IATA
- Desplazamientos: autocar, autobús, bus, chófer, transfer, traslado,
                   taxi, furgoneta
- Actividades    : rafting, paintball, quads, visita guiada, excursión,
                   tour, circuito
- Entradas       : ticket parque temático, entrada museo, entrada
                   monumento, entrada espectáculo
- Restauración   : restaurante, comida, cena, desayuno aparte,
                   catering, pic nic
- Seguros        : seguro de viaje, seguro anulación, prima,
                   certificado, póliza, bordero
- Tren           : billete tren, AVE, Renfe, Ouigo, Iryo, Eurostar,
                   ruta con estaciones
- Crucero        : crucero, barco, ferry, naviera, camarote
- Otros          : comisiones, cargos administrativos, descuentos,
                   gratuidades, suplementos, property fee, tasas no aéreas

CRÍTICO - REGLA ESPECIAL CHÓFER (OBLIGATORIA):
- Si el emisor del documento es un HOTEL (por ejemplo: "SUPER ESPOT 2000", "HOTEL OR BLANC", etc.), cualquier concepto de "CHÓFER", "HABITACIÓN CHÓFER" o similar representa el alojamiento de los conductores en el hotel. Debes clasificarlo OBLIGATORIAMENTE como ALOJAMIENTO, nunca como Desplazamientos.
- Solo debes clasificar "Chófer" como Desplazamientos si la factura es emitida por una empresa de transportes u autocares (por tratarse de dietas de conducción o servicios de transporte).

REGLAS CRÍTICAS DE EXTRACCIÓN:
1. IMPORTES
   - Si IVA incluido: iva_incluido=true, base = total / (1 + iva/100)
   - Importe negativo: es_descuento=true
   - Si un importe no aparece en el documento: null
   - Nunca inventes importes

2. FECHAS
   - Formato siempre DD/MM/YYYY
   - Si solo aparece día y mes, infiere el año del contexto

3. LÍNEAS
   - Una línea por concepto facturable
   - Vuelos nominativos: una línea por pasajero
   - Tasas aéreas dentro de la línea del billete en el campo "tasas"
   - El total_linea de un vuelo debe ser la suma de la tarifa (base_imponible) más las tasas aéreas (campo "tasas"). Ejemplo: tarifa base 76.93 + tasas 39.96 = total_linea 116.89.
   - Descuentos y gratuidades: líneas independientes con
     es_descuento=true e importe negativo

4. BORDERO DE SEGUROS
   - Cada póliza es una línea independiente
   - Extrae referencia_agencia con máxima fidelidad
   - Si el mismo certificado aparece positivo y negativo:
     dos líneas distintas (alta y anulación)

5. ESTADO DE PAGO Y DETALLE DE PAGOS
   - Sin información de pago: estado_pago="PENDIENTE", importe_pagado=0
   - Si el documento desglosa pagos realizados, anticipos, depósitos o transferencias (con sus fechas, importes y métodos de pago), debes extraerlos estructuradamente en el array "pagos" dentro de la cabecera.
   - El metodo_pago debe ser estrictamente uno de: "TRANSFERENCIA", "DEPOSITO", "TARJETA", "EFECTIVO" o "DOMICILIACION".
   - Las fechas de pago deben ser en formato DD/MM/YYYY.

6. VALIDACIÓN
   - Verifica que suma de total_linea coincide con total_documento
   - Si hay discrepancia, explícala en cabecera.notas

ESTRUCTURA JSON DE SALIDA OBLIGATORIA:
{
  "cabecera": {
    "documento_numero":        string,
    "documento_tipo":          "FACTURA"|"PROFORMA"|"BORDERO_SEGUROS"|"ALBARAN",
    "fecha_emision":           "DD/MM/YYYY"|null,
    "periodo_desde":           "DD/MM/YYYY"|null,
    "periodo_hasta":           "DD/MM/YYYY"|null,
    "proveedor_nombre":        string,
    "proveedor_nif":           string|null,
    "proveedor_direccion":     string|null,
    "receptor_nombre":         string,
    "receptor_nif":            string|null,
    "referencia_agencia":      string|null,
    "localizador":             string|null,
    "viajero":                 string|null,
    "total_base":              number,
    "total_iva":               number,
    "total_documento":         number,
    "iva_incluido":            boolean,
    "comision_agencia":        number|null,
    "comision_porcentaje":     number|null,
    "estado_pago":             "PENDIENTE"|"PARCIAL"|"PAGADO",
    "importe_pagado":          number,
    "importe_pendiente":       number,
    "cuentas_bancarias": [
      { "banco": string, "iban": string, "bic": string|null }
    ],
    "subtotales_por_compania": [
      { "cif": string, "compania": string, "subtotal": number }
    ],
    "pagos": [
      {
        "fecha_movimiento": "DD/MM/YYYY"|null,
        "importe":          number,
        "metodo_pago":      "TRANSFERENCIA"|"DEPOSITO"|"TARJETA"|"EFECTIVO"|"DOMICILIACION"|null,
        "referencia":       string|null,
        "notas":            string|null
      }
    ],
    "notas": string|null
  },
  "lineas": [
    {
      "tipo_servicio_id":       string,
      "tipo_servicio_etiqueta": string,
      "concepto":               string,
      "fecha_inicio":           "DD/MM/YYYY"|null,
      "fecha_fin":              "DD/MM/YYYY"|null,
      "noches":                 number|null,
      "pax":                    number|null,
      "unidades":               number|null,
      "precio_unitario":        number|null,
      "base_imponible":         number,
      "iva_porcentaje":         number,
      "iva_importe":            number,
      "iva_incluido":           boolean,
      "total_linea":            number,
      "es_descuento":           boolean,
      "pasajero":               string|null,
      "tasas":                  number|null,
      "property_fee":           number|null,
      "regimen":                string|null,
      "establecimiento":        string|null,
      "aplicacion_aon":         string|null,
      "certificado":            string|null,
      "compania_seguro":        string|null,
      "modalidad_seguro":       string|null,
      "prima_liquida":          number|null,
      "referencia_agencia":     string|null,
      "notas":                  string|null
    }
  ]
}
`

/**
 * Resuelve el agencia_id del usuario autenticado en la sesión actual.
 * Se usa para obtener la API key de Anthropic correcta para cada agencia.
 */
async function getAgenciaIdFromSession(): Promise<string> {
  const adminSupabase = await createAdminServerClient()
  const { data: { user }, error: userError } = await adminSupabase.auth.getUser()

  if (userError || !user) {
    throw new DocumentoError('AGENT_SESSION_ERROR', 'No hay usuario autenticado')
  }

  const adminServiceSupabase = createAdminServiceClient()
  const { data: usuario, error: usuarioError } = await adminServiceSupabase
    .from('usuarios')
    .select('agencia_id')
    .eq('auth_user_id', user.id)
    .single()

  if (usuarioError || !usuario?.agencia_id) {
    throw new DocumentoError('AGENT_SESSION_ERROR', 'Agencia no encontrada para el usuario')
  }

  return usuario.agencia_id
}

/**
 * Corrige un error común de la IA al extraer importes de documentos en formato español:
 * confundir el separador de miles con el decimal y devolver algo como "2.093.00" (dos puntos)
 * en vez de "2093.00", lo que rompe JSON.parse. Colapsa cualquier número con más de un punto,
 * dejando solo el último como separador decimal (2.093.00 -> 2093.00, 1.234.567.89 -> 1234567.89).
 */
function sanearNumerosJSON(texto: string): string {
  return texto.replace(/-?\d{1,3}(?:\.\d{3})+\.\d{1,2}(?=[,\s\]\}])/g, (match) => {
    const ultimoPunto = match.lastIndexOf('.')
    return match.slice(0, ultimoPunto).replace(/\./g, '') + match.slice(ultimoPunto)
  })
}

/**
 * Procesa un archivo PDF de proveedor:
 *  1. Valida el archivo
 *  2. Sube el PDF a Storage
 *  3. Crea el registro en BD (estado inicial, sin procesar)
 *  4. Obtiene los tipos de servicio activos
 *  5. Crea el cliente Anthropic con la API key de la BD Admin
 *  6. Abre una sesión del agente Anthropic
 *  7. Envía el PDF + tipos al agente y recibe la extracción JSON
 *  8. Sube el JSON de extracción a Storage
 *  9. Inserta las líneas en BD
 * 10. Actualiza el registro del documento con todos los metadatos
 * 11. Devuelve el resultado
 */
/**
 * Envía el PDF y los tipos al modelo Claude a través de la API de mensajes directa,
 * y devuelve el texto de la extracción JSON junto con el conteo de tokens.
 */
async function ejecutarMensajeDirecto(
  anthropic: any,
  base64PDF: string,
  tiposTexto: string,
  documentoId: string
): Promise<{ text: string; stop_reason: string | null; tokensInput: number; tokensOutput: number }> {
  let respuesta: any
  try {
    respuesta = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system:     SYSTEM_PROMPT_EXTRACCION,
      messages: [
        {
          role: 'user',
          content: [
            {
              type:   'document',
              source: {
                type:       'base64',
                media_type: 'application/pdf',
                data:       base64PDF
              }
            },
            {
              type: 'text',
              text: `TIPOS DE SERVICIO DISPONIBLES (usa siempre el UUID exacto):\n${tiposTexto}\n\nExtrae los datos de este documento.`
            }
          ]
        }
      ]
    })
  } catch (e: any) {
    throw new DocumentoError('AI_API_ERROR', e.message, documentoId)
  }

  const tokensInput  = respuesta.usage?.input_tokens  ?? 0
  const tokensOutput = respuesta.usage?.output_tokens ?? 0
  const costeUsd     = (tokensInput * 0.000001) + (tokensOutput * 0.000005)

  const textoRaw = respuesta.content[0].text

  if (!textoRaw) {
    throw new DocumentoError(
      'JSON_PARSE_ERROR',
      'La respuesta del modelo está vacía',
      documentoId
    )
  }

  // Limpiar markdown si el modelo lo añade
  const textoLimpio = textoRaw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  return {
    text: textoLimpio,
    stop_reason: respuesta.stop_reason ?? null,
    tokensInput,
    tokensOutput
  }
}

export async function procesarDocumento(
  file: File
): Promise<ResultadoProcesamiento> {
  const t0 = Date.now()
  // PASO 1 — Validar
  if (file.type !== 'application/pdf') {
    throw new DocumentoError('PDF_INVALIDO', 'El archivo debe ser PDF')
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new DocumentoError('PDF_INVALIDO', 'El archivo supera 50 MB')
  }

  const agencyDb  = await getAgencyDbClient()
  const buffer    = Buffer.from(await file.arrayBuffer())
  const base64PDF = buffer.toString('base64')
  const sizeKb    = Math.round(file.size / 1024)
  const uuid      = crypto.randomUUID()

  // PASO 2 — Storage
  const { archivo_url, archivo_path } = await subirPDF(
    buffer,
    uuid,
    file.name
  ).catch((e) => {
    throw new DocumentoError('STORAGE_ERROR', e.message)
  })

  // PASO 3 — INSERT inicial (sin datos de IA todavía)
  const { error: insertError } = await agencyDb
    .from('operativa_documentos_proveedor')
    .insert({
      id:              uuid,
      archivo_nombre:  file.name,
      archivo_url,
      archivo_path,
      archivo_size_kb: sizeKb,
      procesado_ia:    false
    })

  if (insertError) {
    throw new DocumentoError('DB_INSERT_ERROR', insertError.message)
  }

  const t1 = Date.now()

  try {
    // PASO 4 — Tipos de servicio dinámicos
    const { data: tipos } = await agencyDb
      .from('config_tipos_servicios')
      .select('id, etiqueta')
      .eq('activo', true)
      .order('idx', { ascending: true })

    if (!tipos || tipos.length === 0) {
      throw new DocumentoError(
        'TIPOS_NO_DISPONIBLES',
        'No hay tipos de servicio activos',
        uuid
      )
    }

    const tiposTexto = tipos
      .map((t: { etiqueta: string; id: string }) =>
        `${t.etiqueta.padEnd(25)} → "${t.id}"`
      )
      .join('\n')

    // PASO 5 — Obtener cliente Anthropic con la API key de la BD Admin
    const agenciaId = await getAgenciaIdFromSession()
    const anthropic = await getAnthropicClient(agenciaId, 'Anthropic Claude')

    // PASO 6 & 7 — Ejecutar el mensaje directo para obtener la extracción
    const { text: textoRespuesta, stop_reason, tokensInput, tokensOutput } = await ejecutarMensajeDirecto(
      anthropic,
      base64PDF,
      tiposTexto,
      uuid
    )

    const t2 = Date.now()

    const costeUsd = tokensInput * 0.000001 + tokensOutput * 0.000005

    // Parsear JSON de la respuesta del agente
    let extraccion: ExtraccionIA
    try {
      extraccion = JSON.parse(sanearNumerosJSON(textoRespuesta))
    } catch {
      console.error('RESPUESTA RAW:', textoRespuesta.slice(-500))
      console.error('FINISH REASON:', stop_reason)
      throw new DocumentoError(
        'JSON_PARSE_ERROR',
        'La IA no devolvió JSON válido',
        uuid
      )
    }

    if (extraccion.error) {
      throw new DocumentoError(
        'AI_API_ERROR',
        extraccion.mensaje ?? extraccion.error,
        uuid
      )
    }

    // PASO 8 — Subir JSON de extracción a Storage
    const extraccion_url = await subirExtraccion(extraccion, uuid, 1)

    // PASO 9 — INSERT líneas
    const lineasDB = extraccion.lineas.map((l) => mapearLineaParaDB(l, uuid))

    const { error: lineasError } = await agencyDb
      .from('operativa_documentos_lineas')
      .insert(lineasDB)

    if (lineasError) {
      throw new DocumentoError('DB_INSERT_ERROR', lineasError.message, uuid)
    }

    // PASO 10 — UPDATE documento con todos los metadatos extraídos
    await agencyDb
      .from('operativa_documentos_proveedor')
      .update({
        documento_numero:         extraccion.cabecera.documento_numero ?? null,
        documento_tipo:           extraccion.cabecera.documento_tipo ?? null,
        fecha_emision:            parseFechaIA(extraccion.cabecera.fecha_emision ?? null),
        periodo_desde:            parseFechaIA(extraccion.cabecera.periodo_desde ?? null),
        periodo_hasta:            parseFechaIA(extraccion.cabecera.periodo_hasta ?? null),
        total_base:               parsearNumero(extraccion.cabecera.total_base),
        total_iva:                parsearNumero(extraccion.cabecera.total_iva),
        total_documento:          parsearNumero(extraccion.cabecera.total_documento),
        estado_pago:              'PENDIENTE',
        importe_pagado:           0.00,
        extraccion_json:          extraccion,
        extraccion_url,
        extraccion_version:       1,
        extraccion_modelo:        'claude-haiku-4-5-20251001',
        extraccion_tokens_input:  tokensInput,
        extraccion_tokens_output: tokensOutput,
        extraccion_coste_usd:     costeUsd,
        procesado_ia:             true,
        procesado_at:             new Date().toISOString()
      })
      .eq('id', uuid)

    // PASO 10.5 — INSERT pagos/plazos si existen
    if (extraccion.cabecera.pagos && extraccion.cabecera.pagos.length > 0) {
      const pagosDB = extraccion.cabecera.pagos
        .filter((p) => p.importe !== undefined && p.importe !== null)
        .map((p) => {
          let metodo = (p.metodo_pago || 'TRANSFERENCIA').toUpperCase();
          if (!['TRANSFERENCIA', 'DEPOSITO', 'TARJETA', 'EFECTIVO', 'DOMICILIACION'].includes(metodo)) {
            if (metodo.includes('DEP')) metodo = 'DEPOSITO';
            else if (metodo.includes('TRANS') || metodo.includes('BANK')) metodo = 'TRANSFERENCIA';
            else if (metodo.includes('TARJ') || metodo.includes('CARD')) metodo = 'TARJETA';
            else if (metodo.includes('EFEC') || metodo.includes('CASH')) metodo = 'EFECTIVO';
            else metodo = 'TRANSFERENCIA';
          }
          return {
            documento_id:     uuid,
            fecha_movimiento: parseFechaIA(p.fecha_movimiento ?? null) || parseFechaIA(extraccion.cabecera.fecha_emision ?? null) || new Date().toISOString().split('T')[0],
            importe:          parsearNumero(p.importe),
            metodo_pago:      metodo,
            referencia:       p.referencia || null,
            notas:            p.notas || null
          };
        });

      if (pagosDB.length > 0) {
        const { error: pagosError } = await agencyDb
          .from('operativa_documentos_pagos')
          .insert(pagosDB);

        if (pagosError) {
          console.error('Error al guardar plazos de pago en BD:', pagosError);
        } else {
          }
      }
    }

    // PASO 11 — Devolver resultado
    return {
      documento_id: uuid,
      cabecera:     extraccion.cabecera,
      lineas:       extraccion.lineas,
      tokens: {
        input:     tokensInput,
        output:    tokensOutput,
        coste_usd: costeUsd
      }
    }
  } catch (error) {
    // Si ya existe el registro en BD, lo marcamos como fallido con el error
    if (error instanceof DocumentoError && error.documento_id) {
      await agencyDb
        .from('operativa_documentos_proveedor')
        .update({
          procesado_ia:    false,
          extraccion_json: {
            error:     error.codigo,
            mensaje:   error.message,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', error.documento_id)
    }
    throw error
  }
}

/**
 * Reprocesa un documento ya existente en BD:
 *  - Descarga el PDF original desde Storage
 *  - Elimina las líneas anteriores
 *  - Re-ejecuta la extracción con los tipos de servicio actuales
 *  - Incrementa extraccion_version en 1
 */
export async function reprocesarDocumento(
  documento_id: string
): Promise<ResultadoProcesamiento> {
  const agencyDb = await getAgencyDbClient()

  // 1. Obtener documento
  const { data: doc, error: docError } = await agencyDb
    .from('operativa_documentos_proveedor')
    .select('archivo_path, archivo_nombre, extraccion_version')
    .eq('id', documento_id)
    .single()

  if (docError || !doc) {
    throw new DocumentoError(
      'DB_INSERT_ERROR',
      `Documento ${documento_id} no encontrado`,
      documento_id
    )
  }

  // 2. Descargar PDF desde Storage
  const { data: fileData, error: downloadError } = await agencyDb.storage
    .from('documentos-proveedor')
    .download(doc.archivo_path)

  if (downloadError || !fileData) {
    throw new DocumentoError(
      'STORAGE_ERROR',
      `No se pudo descargar el PDF: ${downloadError?.message}`,
      documento_id
    )
  }

  // 3. Tipos de servicio dinámicos
  const { data: tipos } = await agencyDb
    .from('config_tipos_servicios')
    .select('id, etiqueta')
    .eq('activo', true)
    .order('idx', { ascending: true })

  if (!tipos || tipos.length === 0) {
    throw new DocumentoError(
      'TIPOS_NO_DISPONIBLES',
      'No hay tipos de servicio activos',
      documento_id
    )
  }

  const tiposTexto = tipos
    .map((t: { etiqueta: string; id: string }) =>
      `${t.etiqueta.padEnd(25)} → "${t.id}"`
    )
    .join('\n')

  const buffer    = Buffer.from(await fileData.arrayBuffer())
  const base64PDF = buffer.toString('base64')

  // 4. Obtener cliente Anthropic con la API key de la BD Admin
  const agenciaId = await getAgenciaIdFromSession()
  const anthropic = await getAnthropicClient(agenciaId, 'Anthropic Claude')

  // 5 & 6 — Ejecutar el mensaje directo para obtener la extracción
  const { text: textoRespuesta, stop_reason, tokensInput, tokensOutput } = await ejecutarMensajeDirecto(
    anthropic,
    base64PDF,
    tiposTexto,
    documento_id
  )

  const costeUsd = tokensInput * 0.000001 + tokensOutput * 0.000005

  let extraccion: ExtraccionIA
  try {
    extraccion = JSON.parse(sanearNumerosJSON(textoRespuesta))
  } catch {
    console.error('RESPUESTA RAW:', textoRespuesta.slice(-500))
    console.error('FINISH REASON:', stop_reason)
    throw new DocumentoError(
      'JSON_PARSE_ERROR',
      'La IA no devolvió JSON válido',
      documento_id
    )
  }

  if (extraccion.error) {
    throw new DocumentoError(
      'AI_API_ERROR',
      extraccion.mensaje ?? extraccion.error,
      documento_id
    )
  }

  const nuevaVersion   = (doc.extraccion_version ?? 1) + 1
  const extraccion_url = await subirExtraccion(extraccion, documento_id, nuevaVersion)

  // 7. Borrar líneas anteriores
  const { error: deleteError } = await agencyDb
    .from('operativa_documentos_lineas')
    .delete()
    .eq('documento_id', documento_id)

  if (deleteError) {
    throw new DocumentoError('DB_INSERT_ERROR', deleteError.message, documento_id)
  }

  // 8. Insertar nuevas líneas
  const lineasDB = extraccion.lineas.map((l) =>
    mapearLineaParaDB(l, documento_id)
  )

  const { error: lineasError } = await agencyDb
    .from('operativa_documentos_lineas')
    .insert(lineasDB)

  if (lineasError) {
    throw new DocumentoError('DB_INSERT_ERROR', lineasError.message, documento_id)
  }

  // 8.5. Borrar pagos anteriores
  const { error: deletePagosError } = await agencyDb
    .from('operativa_documentos_pagos')
    .delete()
    .eq('documento_id', documento_id);

  if (deletePagosError) {
    console.error('Error al borrar plazos de pago anteriores:', deletePagosError);
  }

  // 8.6. Insertar nuevos pagos/plazos si existen
  if (extraccion.cabecera.pagos && extraccion.cabecera.pagos.length > 0) {
    const pagosDB = extraccion.cabecera.pagos
      .filter((p) => p.importe !== undefined && p.importe !== null)
      .map((p) => {
        let metodo = (p.metodo_pago || 'TRANSFERENCIA').toUpperCase();
        if (!['TRANSFERENCIA', 'DEPOSITO', 'TARJETA', 'EFECTIVO', 'DOMICILIACION'].includes(metodo)) {
          if (metodo.includes('DEP')) metodo = 'DEPOSITO';
          else if (metodo.includes('TRANS') || metodo.includes('BANK')) metodo = 'TRANSFERENCIA';
          else if (metodo.includes('TARJ') || metodo.includes('CARD')) metodo = 'TARJETA';
          else if (metodo.includes('EFEC') || metodo.includes('CASH')) metodo = 'EFECTIVO';
          else metodo = 'TRANSFERENCIA';
        }
        return {
          documento_id:     documento_id,
          fecha_movimiento: parseFechaIA(p.fecha_movimiento ?? null) || parseFechaIA(extraccion.cabecera.fecha_emision ?? null) || new Date().toISOString().split('T')[0],
          importe:          parsearNumero(p.importe),
          metodo_pago:      metodo,
          referencia:       p.referencia || null,
          notas:            p.notas || null
        };
      });

    if (pagosDB.length > 0) {
      const { error: pagosError } = await agencyDb
        .from('operativa_documentos_pagos')
        .insert(pagosDB);

      if (pagosError) {
        console.error('Error al guardar plazos de pago en BD:', pagosError);
      }
    }
  }

  // 9. Actualizar documento con los nuevos metadatos
  await agencyDb
    .from('operativa_documentos_proveedor')
    .update({
      documento_numero:         extraccion.cabecera.documento_numero ?? null,
      documento_tipo:           extraccion.cabecera.documento_tipo ?? null,
      fecha_emision:            parseFechaIA(extraccion.cabecera.fecha_emision ?? null),
      periodo_desde:            parseFechaIA(extraccion.cabecera.periodo_desde ?? null),
      periodo_hasta:            parseFechaIA(extraccion.cabecera.periodo_hasta ?? null),
      total_base:               parsearNumero(extraccion.cabecera.total_base),
      total_iva:                parsearNumero(extraccion.cabecera.total_iva),
      total_documento:          parsearNumero(extraccion.cabecera.total_documento),
      estado_pago:              'PENDIENTE',
      importe_pagado:           0.00,
      extraccion_json:          extraccion,
      extraccion_url,
      extraccion_version:       nuevaVersion,
      extraccion_modelo:        'claude-haiku-4-5-20251001',
      extraccion_tokens_input:  tokensInput,
      extraccion_tokens_output: tokensOutput,
      extraccion_coste_usd:     costeUsd,
      procesado_ia:             true,
      procesado_at:             new Date().toISOString()
    })
    .eq('id', documento_id)

  return {
    documento_id,
    cabecera: extraccion.cabecera,
    lineas:   extraccion.lineas,
    tokens: {
      input:     tokensInput,
      output:    tokensOutput,
      coste_usd: costeUsd
    }
  }
}
