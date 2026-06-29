export type DocumentoTipo =
  | 'FACTURA'
  | 'PROFORMA'
  | 'BORDERO_SEGUROS'
  | 'ALBARAN'

export type EstadoPago =
  | 'PENDIENTE'
  | 'PARCIAL'
  | 'PAGADO'

export type EstadoServicio =
  | 'ACTIVO'
  | 'ANULADO'
  | 'PENDIENTE_BORDERO'
  | 'CONCILIADO'

export interface PagoIA {
  fecha_movimiento?: string | null  // DD/MM/YYYY
  importe?:          number
  metodo_pago?:      'TRANSFERENCIA' | 'DEPOSITO' | 'TARJETA' | 'EFECTIVO' | 'DOMICILIACION' | null
  referencia?:       string | null
  notas?:            string | null
}

export interface CabeceraIA {
  documento_numero?:        string | null
  documento_tipo?:          DocumentoTipo
  fecha_emision?:           string | null  // DD/MM/YYYY
  periodo_desde?:           string | null
  periodo_hasta?:           string | null
  proveedor_nombre?:        string
  proveedor_nif?:           string | null
  proveedor_direccion?:     string | null
  receptor_nombre?:         string
  receptor_nif?:            string | null
  referencia_agencia?:      string | null
  localizador?:             string | null
  viajero?:                 string | null
  total_base?:              number
  total_iva?:               number
  total_documento?:         number
  iva_incluido?:            boolean
  comision_agencia?:        number | null
  comision_porcentaje?:     number | null
  estado_pago?:             EstadoPago
  importe_pagado?:          number
  importe_pendiente?:       number
  cuentas_bancarias?:       Array<{ banco: string; iban: string; bic?: string | null }>
  subtotales_por_compania?: Array<{ cif: string; compania: string; subtotal: number }>
  pagos?:                   PagoIA[]
  notas?:                   string | null
}

export interface LineaIA {
  tipo_servicio_id?:        string
  tipo_servicio_etiqueta?:  string
  concepto?:                string
  fecha_inicio?:            string | null
  fecha_fin?:               string | null
  noches?:                  number | null
  pax?:                     number | null
  unidades?:                number | null
  precio_unitario?:         number | null
  base_imponible?:          number
  iva_porcentaje?:          number
  iva_importe?:             number
  iva_incluido?:            boolean
  total_linea?:             number
  es_descuento?:            boolean
  pasajero?:                string | null
  tasas?:                   number | null
  property_fee?:            number | null
  regimen?:                 string | null
  establecimiento?:         string | null
  aplicacion_aon?:          string | null
  certificado?:             string | null
  compania_seguro?:         string | null
  modalidad_seguro?:        string | null
  prima_liquida?:           number | null
  referencia_agencia?:      string | null
  notas?:                   string | null
}

export interface ExtraccionIA {
  cabecera: CabeceraIA
  lineas:   LineaIA[]
  error?:   string
  mensaje?: string
}

export interface ResultadoProcesamiento {
  documento_id: string
  cabecera:     CabeceraIA
  lineas:       LineaIA[]
  tokens: {
    input:     number
    output:    number
    coste_usd: number
  }
}

export type CodigoError =
  | 'PDF_INVALIDO'
  | 'STORAGE_ERROR'
  | 'DB_INSERT_ERROR'
  | 'AGENT_SESSION_ERROR'
  | 'AI_API_ERROR'
  | 'JSON_PARSE_ERROR'
  | 'TIPOS_NO_DISPONIBLES'

export class DocumentoError extends Error {
  constructor(
    public codigo: CodigoError,
    mensaje: string,
    public documento_id?: string
  ) {
    super(mensaje)
    this.name = 'DocumentoError'
  }
}
