export interface PagadorInvoicingStatus {
  id: string;
  expediente_id: string;
  entidad_id: string;
  importe_abonado: number;
  importe_facturado: number;
  importe_a_facturar: number;
  cliente_nombre: string;
  cliente_nif: string;
  regimen_iva: "REAV" | "GENERAL";
  viajero_nombre?: string;
  expediente_referencia?: string;
}

export interface FacturaEmitida {
  id: string;
  expediente_id: string;
  pagador_id: string | null;
  numero_factura: string;
  fecha_emision: string;
  cliente_nombre: string;
  cliente_nif: string;
  regimen_iva: "REAV" | "GENERAL";
  importe_total: number;
  created_at: string;
  lineas?: FacturaEmitidaLinea[];
  verifactu_estado?: string;
  verifactu_qr?: string | null;
  verifactu_fingerprint?: string | null;
  verifactu_mensaje?: string | null;
  verifactu_fecha_declaracion?: string | null;
}

export interface FacturaEmitidaLinea {
  id: string;
  factura_emitida_id: string;
  concepto: string;
  importe_neto: number;
  porcentaje_iva: number;
  cuota_iva: number;
  importe_total_linea: number;
}

export interface CrearFacturaItem {
  pagadorId: string;
  importe: number;
  regimenIva: "REAV" | "GENERAL";
  concepto: string;
  clienteNombre: string;
  clienteNif: string;
  declararAeat?: boolean;
}

export interface CierreReavResult {
  success: boolean;
  error?: string;
  ingresos?: number;
  costes?: number;
  margen?: number;
  baseImponible?: number;
  cuotaIva?: number;
  apunteId?: string;
}

export interface FacturaGeneral {
  fecha: string;
  factura: string;
  entidad: string;
  nif: string;
  base: number;
  tipoIva: number;
  cuota: number;
  total: number;
  periodo: "Q1" | "Q2" | "Q3" | "Q4";
}

export interface FacturaREAV {
  fecha: string;
  factura: string;
  cliente: string;
  importe: number;
  coste: number;
  margen: number;
  baseIva: number;
  cuota: number;
  periodo: "Q1" | "Q2" | "Q3" | "Q4";
}

export interface LibroIvaData {
  ventasGeneral: FacturaGeneral[];
  ventasReav: FacturaREAV[];
  comprasGeneral: FacturaGeneral[];
  comprasReav: FacturaREAV[];
}
