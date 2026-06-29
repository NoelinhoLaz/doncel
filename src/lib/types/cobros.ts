export interface Pagador {
  id: string;
  expediente_id: string;
  entidad_id: string;
  importe_total: number;
  importe_abonado: number;
  estado: string;
  contabilidad_entidades?: { id: string; nombre: string; documento?: string } | null;
}

export interface ViajeroImputacion {
  viajero_id: string;
  viajero_nombre: string;
  importe: number;
}

export interface MovimientoCobro {
  id: string;
  entidad_id: string;
  usuario_id: string;
  tipo: string;
  importe_total: number;
  moneda: string;
  medio_pago: string;
  tipo_servicio?: string | null;
  fecha: string;
  concepto?: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
  entidad_nombre: string;
  movimiento_banco_id?: string | null;
  viajeros: ViajeroImputacion[];
}
