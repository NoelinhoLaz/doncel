import { formatDate } from "@/lib/utils/date";

// ── Raw DB shape (fields used by the mapper) ───────────────────────────────
export interface RawExpediente {
  id: string;
  numero?: number | string | null;
  created_at?: string | null;
  referencia?: string | null;
  tipo_expediente?: string | null;
  estado?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  destino_principal?: string | null;
  entidad_id?: string | null;
  pvp_viajero?: number | null;
  pvp_total?: number | null;
  metadata?: { plazas_max?: number | string } | null;
  contabilidad_entidades?: { nombre?: string } | null;
  config_oficinas?: { nombre?: string } | null;
  maestro_destinos?: { nombre?: string; lat?: string | number; lng?: string | number } | null;
  agente?: { nombre?: string; iniciales?: string } | null;
  operativa_viajeros_expedientes?: { estado?: string }[] | null;
  operativa_pagadores_expedientes?: { importe_total?: number | string; importe_abonado?: number | string }[] | null;
}

// ── UI model (post-mapping) ─────────────────────────────────────────────────
export interface ExpedienteRow {
  id: string;
  fecha: string;
  cliente: string;
  clienteDesc: string;
  destino: string;
  destinoId: string | null;
  tipo: string;
  estado: string;
  fechaSalida: string;
  fechaRegreso: string;
  plazas: string;
  plazasProg: number;
  cobrado: string;
  total: string;
  progreso: number;
  isDbRecord: boolean;
  realId: string;
  iniciales: string;
  agente: string;
  sucursal: string;
  mapLat: number | null;
  mapLng: number | null;
  pvpViajero: number | null;
  pvpTotal: number | null;
  entidadId: string | null;
  contactoNombre: string | null;
}

export function mapExpedienteToRow(exp: RawExpediente): ExpedienteRow {
  const formattedDate = exp.created_at
    ? new Date(exp.created_at).toLocaleDateString("es-ES")
    : new Date().toLocaleDateString("es-ES");

  const viajerosConfirmados =
    exp.operativa_viajeros_expedientes?.filter((v) => v.estado === "confirmado")?.length ?? 0;
  const plazasMax = exp.metadata?.plazas_max ? Number(exp.metadata.plazas_max) : 0;
  const totalViajeros = exp.operativa_viajeros_expedientes?.length ?? 0;
  const capacidad = plazasMax > 0 ? plazasMax : totalViajeros;
  const plazasText = capacidad > 0 ? `${viajerosConfirmados}/${capacidad}` : `${viajerosConfirmados}`;
  const plazasProg = capacidad > 0 ? Math.min(100, Math.round((viajerosConfirmados / capacidad) * 100)) : 0;

  const pagadores = exp.operativa_pagadores_expedientes ?? [];
  const totalVenta = pagadores.reduce((sum, p) => sum + Number(p.importe_total ?? 0), 0);
  const totalCobrado = pagadores.reduce((sum, p) => sum + Number(p.importe_abonado ?? 0), 0);
  const progresoCobro = totalVenta > 0 ? Math.min(100, Math.round((totalCobrado / totalVenta) * 100)) : 0;

  const fmt = (n: number) =>
    n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";

  return {
    id: exp.numero ? exp.numero.toString() : exp.id.substring(0, 9),
    fecha: formattedDate,
    cliente: exp.contabilidad_entidades?.nombre ?? exp.config_oficinas?.nombre ?? "Cliente General",
    clienteDesc: exp.referencia ?? "",
    destino: exp.maestro_destinos?.nombre ?? "General",
    destinoId: exp.destino_principal ?? null,
    tipo: exp.tipo_expediente === "grupo" ? "GRP" : exp.tipo_expediente === "vacacional" ? "VAC" : "P2P",
    estado: exp.estado ? exp.estado.toUpperCase() : "ABIERTO",
    fechaSalida: exp.fecha_inicio ?? new Date().toISOString().split("T")[0],
    fechaRegreso: exp.fecha_fin ?? new Date().toISOString().split("T")[0],
    plazas: plazasText,
    plazasProg,
    cobrado: fmt(totalCobrado),
    total: fmt(totalVenta),
    progreso: progresoCobro,
    isDbRecord: true,
    realId: exp.id,
    iniciales: exp.agente?.iniciales ?? "NC",
    agente: exp.agente?.nombre ?? "Agente",
    sucursal: exp.config_oficinas?.nombre ?? "Sin sucursal",
    mapLat: Number(exp.maestro_destinos?.lat) || null,
    mapLng: Number(exp.maestro_destinos?.lng) || null,
    pvpViajero: exp.pvp_viajero ?? null,
    pvpTotal: exp.pvp_total ?? null,
    entidadId: exp.entidad_id ?? null,
    contactoNombre: exp.contabilidad_entidades?.nombre ?? null,
  };
}

// ── Chart helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_DAYS  = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface MonthBar {
  month: string;
  val: number;
  count: number;
  days: number;
}

export interface DayBar {
  day: number;
  val: number;
  count: number;
}

export function computeMonthsData(data: ExpedienteRow[]): MonthBar[] {
  const counts = Array<number>(12).fill(0);
  for (const exp of data) {
    if (exp.fechaSalida) {
      const d = new Date(exp.fechaSalida);
      if (!isNaN(d.getTime())) counts[d.getMonth()]++;
    }
  }
  const maxCount = Math.max(...counts, 1);
  return MONTH_NAMES.map((name, i) => ({
    month: name,
    val: Math.round((counts[i] / maxCount) * 100),
    count: counts[i],
    days: MONTH_DAYS[i],
  }));
}

export function computeDaysData(
  selectedMonth: string | null,
  data: ExpedienteRow[],
  monthsData: MonthBar[]
): DayBar[] {
  if (!selectedMonth) return [];
  const monthIndex = MONTH_NAMES.indexOf(selectedMonth);
  if (monthIndex === -1) return [];

  const numDays = monthsData[monthIndex].days;
  const counts = Array<number>(numDays + 1).fill(0);

  for (const exp of data) {
    if (exp.fechaSalida) {
      const d = new Date(exp.fechaSalida);
      if (!isNaN(d.getTime()) && d.getMonth() === monthIndex) {
        const day = d.getDate();
        if (day >= 1 && day <= numDays) counts[day]++;
      }
    }
  }

  const maxCount = Math.max(...counts, 1);
  return Array.from({ length: numDays }, (_, i) => {
    const dayNum = i + 1;
    return { day: dayNum, val: Math.round((counts[dayNum] / maxCount) * 100), count: counts[dayNum] };
  });
}

export { formatDate };
