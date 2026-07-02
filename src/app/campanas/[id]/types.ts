"use client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Estado = {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  es_final: boolean;
  es_ganado: boolean;
};

export type Oportunidad = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado_id: string;
  valor_estimado: number;
  fecha_cierre_est: string | null;
  prioridad: number | null;
  agente_id: string | null;
  crm_agentes: { id: string; nombre: string; apellidos: string; avatar_url?: string | null } | null;
  contabilidad_entidades: { id: string; nombre: string; tipo_entidad: string; email?: string | null; telefono?: string | null; otros_tlfs?: string[] | null; otros_emails?: string[] | null; lat?: number | null; lng?: number | null; direccion: { direccion?: string; calle?: string; cp?: string; ciudad?: string; provincia?: string } | null; crm_contactos?: { id: string; nombre: string; cargo: string | null; telefono: string | null; email: string | null; metadatos?: { estrategia?: string; horarios?: string; poder_decision?: string; movil?: string; antiguedad?: string; desde?: string; anios_experiencia?: string } | null }[] } | null;
  crm_campanas_estados: { id: string; nombre: string; color: string; es_ganado: boolean; es_final: boolean } | null;
  crm_contactos: { nombre: string; cargo: string | null } | null;
  estados_campanas_anteriores?: { nombre: string; color: string; descripcion: string | null; campana: string | null; estrategia: string | null; campanaCreatedAt?: string | null }[];
  ultima_nota_log?: string | null;
  fecha_ultimo_cambio_estado?: string | null;
  mig_notas?: { observaciones?: string; por_que_no_viajaron?: string; viajaran_con_doncel?: string; fecha_cierre?: string } | null;
  expediente_id?: string | null;
};

export type AgenteObjetivo = {
  agente_id: string;
  rol: string;
  objetivo_num: number | null;
  objetivo_valor: number | null;
  crm_agentes: { id: string; nombre: string; apellidos: string; avatar_url: string | null } | null;
};

export type Campana = {
  id: string;
  nombre: string;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  crm_campanas_estados: Estado[];
  crm_campanas_agentes: AgenteObjetivo[];
};

export type AgenteSelector = { id: string; nombre: string; apellidos: string };
export type EntidadSelector = { id: string; nombre: string; tipo_entidad: string };
export type ContactoSelector = { id: string; nombre: string; cargo: string | null };

export type EntidadDetalle = {
  entidad: Oportunidad["contabilidad_entidades"];
};

export type CampanaHistorialRow = {
  id: string;
  titulo: string;
  valor_estimado: number;
  prioridad: number | null;
  crm_campanas: { id: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null } | null;
  crm_campanas_estados: { nombre: string; color: string; es_ganado: boolean; es_final: boolean } | null;
  crm_agentes: { nombre: string; apellidos: string } | null;
};
