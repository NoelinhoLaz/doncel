import type { LineaIA } from './tipos'

/**
 * Convierte una fecha en formato DD/MM/YYYY a YYYY-MM-DD (ISO) para Supabase.
 * Devuelve null si la entrada es nula o tiene un formato inesperado.
 */
export function parseFechaIA(fecha: string | null): string | null {
  if (!fecha) return null
  const partes = fecha.split('/')
  if (partes.length !== 3) return null
  const [dia, mes, año] = partes
  if (!dia || !mes || !año) return null
  return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

export function parsearNumero(valor: any): number | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return valor
  if (typeof valor === 'string') {
    let limpio = valor.trim()
    // Si tiene comas y puntos (ej: "1.234,56"), el punto es miles y la coma es decimal
    if (limpio.includes('.') && limpio.includes(',')) {
      limpio = limpio.replace(/\./g, '').replace(',', '.')
    } 
    // Si tiene coma y no tiene punto (ej: "39,96"), la coma es el decimal
    else if (limpio.includes(',')) {
      limpio = limpio.replace(',', '.')
    }
    // Si tiene punto y no tiene coma (ej: "39.96"), el punto es el decimal y no lo tocamos
    const num = parseFloat(limpio)
    return isNaN(num) ? null : num
  }
  return null
}

/**
 * Transforma una LineaIA al objeto plano listo para insertar en BD.
 * Convierte las fechas de DD/MM/YYYY a YYYY-MM-DD y fija estado_servicio.
 */
export function mapearLineaParaDB(
  linea: LineaIA,
  documento_id: string
): Record<string, unknown> {
  return {
    documento_id,
    expediente_id:           null,
    tipo_servicio_id:        linea.tipo_servicio_id ?? null,
    tipo_servicio_etiqueta:  linea.tipo_servicio_etiqueta ?? null,
    concepto:                linea.concepto ?? null,
    fecha_inicio:            parseFechaIA(linea.fecha_inicio ?? null),
    fecha_fin:               parseFechaIA(linea.fecha_fin ?? null),
    noches:                  linea.noches ?? null,
    pax:                     linea.pax ?? null,
    unidades:                linea.unidades ?? null,
    precio_unitario:         parsearNumero(linea.precio_unitario),
    base_imponible:          parsearNumero(linea.base_imponible),
    iva_porcentaje:          parsearNumero(linea.iva_porcentaje),
    iva_importe:             parsearNumero(linea.iva_importe),
    iva_incluido:            linea.iva_incluido ?? false,
    total_linea:             parsearNumero(linea.total_linea),
    es_descuento:            linea.es_descuento ?? false,
    pasajero:                linea.pasajero ?? null,
    tasas:                   parsearNumero(linea.tasas),
    property_fee:            parsearNumero(linea.property_fee),
    regimen:                 linea.regimen ?? null,
    establecimiento:         linea.establecimiento ?? null,
    aplicacion_aon:          linea.aplicacion_aon ?? null,
    certificado:             linea.certificado ?? null,
    compania_seguro:         linea.compania_seguro ?? null,
    modalidad_seguro:        linea.modalidad_seguro ?? null,
    prima_liquida:           parsearNumero(linea.prima_liquida),
    referencia_agencia:      linea.referencia_agencia ?? null,
    estado_servicio:         'ACTIVO',
    notas:                   linea.notas ?? null,
  }
}

