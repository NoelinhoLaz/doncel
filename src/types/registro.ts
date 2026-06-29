export interface ViajeroForm {
  nombre: string;
  apellidos: string;
  dni: string;
  dni_caducidad: string;
  pasaporte: string;
  pasaporte_caducidad: string;
  fecha_nacimiento: string;
  email: string;
  telefono: string;
  direccion: string;
  sexo?: "M" | "F" | null;
  numero_soporte?: string;
  alergias?: string[];
  extras?: ExtraSeleccionado[];
  tutor?: { nombre: string; telefono: string; email: string } | null;
}

export interface PagadorForm {
  nombre: string;
  apellidos: string;
  dni: string;
  direccion: string;
  email?: string;
  telefono?: string;
}

export interface ExtraSeleccionado {
  id: string;
  nombre: string;
  pvp: number;
  cantidad: number;
}

export interface PlazoInfo {
  descripcion: string;
  fecha: string;
  importe: number; // importe base por viajero
}

export interface ViajeInfo {
  slug: string;
  nombre: string;
  destino: string;
  fecha_salida: string;
  fecha_vuelta: string;
  pvp_por_viajero: number;
  imagen_url?: string;
  extras: ExtraDisponible[];
  metodo_pago: MetodoPago[];
  varios_pagadores: boolean;
  plazos: PlazoInfo[];
  iban_transferencia?: string | null;
}

export interface ExtraDisponible {
  id: string;
  nombre: string;
  descripcion?: string;
  pvp: number;
  seleccionados?: number;
  totalViajeros?: number;
}

export interface MetodoPago {
  id: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
}

export type PasoRegistro =
  | "viajeros"
  | "pagador"
  | "extras"
  | "resumen";
