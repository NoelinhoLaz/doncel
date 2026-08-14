"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentAgentePublic } from "@/actions/crm";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function getClientesEnDestino() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();
  const hoy = todayISO();

  const { data, error } = await db
    .from("operativa_cotizaciones")
    .select("id, titulo, fecha_salida, fecha_regreso, destinos, contabilidad_entidades!contacto(id, nombre)")
    .eq("agente_id", usuarioId)
    .eq("estado", "aceptada")
    .lte("fecha_salida", hoy)
    .gte("fecha_regreso", hoy);

  if (error || !data) return [];

  const destIds = new Set<string>();
  data.forEach((c: any) => (c.destinos || []).forEach((d: any) => d?.id && destIds.add(d.id)));

  const destCoordsMap = new Map<string, { lat: number; lng: number }>();
  if (destIds.size > 0) {
    const { data: coords } = await db
      .from("maestro_destinos")
      .select("id, lat, lng")
      .in("id", Array.from(destIds));
    (coords || []).forEach((item: any) => {
      if (item.lat != null && item.lng != null) {
        destCoordsMap.set(item.id, { lat: Number(item.lat), lng: Number(item.lng) });
      }
    });
  }

  return data.map((c: any) => {
    const primerDestino = (c.destinos || [])[0];
    const coords = primerDestino ? destCoordsMap.get(primerDestino.id) : undefined;
    return {
      id: c.id,
      nombre: c.contabilidad_entidades?.nombre || "Cliente",
      titulo: c.titulo || "Cotización",
      destino: primerDestino?.nombre || null,
      fechaRegreso: c.fecha_regreso,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };
  });
}

export async function getClientesProximosViajes() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();
  const hoy = todayISO();
  const limite = addDaysISO(5);

  const { data, error } = await db
    .from("operativa_cotizaciones")
    .select("id, fecha_salida, destinos, contabilidad_entidades!contacto(id, nombre, email, telefono)")
    .eq("agente_id", usuarioId)
    .eq("estado", "aceptada")
    .gte("fecha_salida", hoy)
    .lte("fecha_salida", limite)
    .order("fecha_salida", { ascending: true });

  if (error || !data) return [];

  return data.map((c: any) => ({
    id: c.id,
    nombre: c.contabilidad_entidades?.nombre || "Cliente",
    destino: (c.destinos || [])[0]?.nombre || null,
    fechaSalida: c.fecha_salida,
    email: c.contabilidad_entidades?.email || null,
    telefono: c.contabilidad_entidades?.telefono || null,
  }));
}

export async function getClientesProximosRegresos() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();
  const hoy = todayISO();
  const desde = addDaysISO(-5);

  const { data, error } = await db
    .from("operativa_cotizaciones")
    .select("id, fecha_regreso, destinos, contabilidad_entidades!contacto(id, nombre, email, telefono)")
    .eq("agente_id", usuarioId)
    .eq("estado", "aceptada")
    .gte("fecha_regreso", desde)
    .lte("fecha_regreso", hoy)
    .order("fecha_regreso", { ascending: false });

  if (error || !data) return [];

  return data.map((c: any) => ({
    id: c.id,
    nombre: c.contabilidad_entidades?.nombre || "Cliente",
    destino: (c.destinos || [])[0]?.nombre || null,
    fechaRegreso: c.fecha_regreso,
    email: c.contabilidad_entidades?.email || null,
    telefono: c.contabilidad_entidades?.telefono || null,
  }));
}

export async function getPresupuestosResumen() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();
  const desde = isoDaysAgo(15);

  const { data: presupuestos, error } = await db
    .from("operativa_presupuestos")
    .select("id")
    .eq("agente_id", usuarioId)
    .gte("created_at", desde);

  if (error || !presupuestos) return { solicitados: 0, confirmados: 0 };

  const solicitados = presupuestos.length;
  if (solicitados === 0) return { solicitados: 0, confirmados: 0 };

  const ids = presupuestos.map((p: any) => p.id);
  const { data: confirmadas } = await db
    .from("operativa_cotizaciones")
    .select("presupuesto_id")
    .in("presupuesto_id", ids)
    .eq("estado", "aceptada");

  const confirmados = new Set((confirmadas || []).map((c: any) => c.presupuesto_id)).size;

  return { solicitados, confirmados };
}

export async function getCotizacionesEntregadas() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();
  const desde = isoDaysAgo(15);

  const { count } = await db
    .from("operativa_cotizaciones")
    .select("id", { count: "exact", head: true })
    .eq("agente_id", usuarioId)
    .eq("estado", "presentada")
    .gte("created_at", desde);

  return count || 0;
}

export async function getCotizacionesPendientesEntrega() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();

  const { data, error } = await db
    .from("operativa_cotizaciones")
    .select("id, created_at")
    .eq("agente_id", usuarioId)
    .eq("estado", "borrador");

  if (error || !data) return { total: 0, hace1Dia: 0, entre2y3Dias: 0, masDe3Dias: 0 };

  const now = Date.now();
  let hace1Dia = 0;
  let entre2y3Dias = 0;
  let masDe3Dias = 0;

  data.forEach((c: any) => {
    const created = new Date(c.created_at).getTime();
    const diasTranscurridos = Math.floor((now - created) / 86400000);
    if (diasTranscurridos <= 1) hace1Dia += 1;
    else if (diasTranscurridos <= 3) entre2y3Dias += 1;
    else masDe3Dias += 1;
  });

  return { total: data.length, hace1Dia, entre2y3Dias, masDe3Dias };
}

export async function getCotizacionesDesestimadas() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();
  const desde = isoDaysAgo(15);

  const { count } = await db
    .from("operativa_cotizaciones")
    .select("id", { count: "exact", head: true })
    .eq("agente_id", usuarioId)
    .eq("estado", "rechazada")
    .gte("created_at", desde);

  return count || 0;
}

export async function getClientesStats() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();

  const { data, error } = await db
    .from("contabilidad_entidades")
    .select("id, email, telefono, otros_emails, otros_tlfs")
    .or("roles->cliente.eq.true,roles->organizacion.eq.true")
    .eq("agente_id", usuarioId);

  if (error || !data) return { total: 0, conEmail: 0, conWhatsapp: 0 };

  const total = data.length;
  // No existe un campo dedicado para WhatsApp: se usa telefono/otros_tlfs como proxy.
  const conEmail = data.filter((r: any) => r.email || (r.otros_emails && r.otros_emails.length > 0)).length;
  const conWhatsapp = data.filter((r: any) => r.telefono || (r.otros_tlfs && r.otros_tlfs.length > 0)).length;

  return { total, conEmail, conWhatsapp };
}

export async function getSegmentacionPorAnio() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();

  const { data, error } = await db
    .from("operativa_cotizaciones")
    .select("contacto, contacto_persona_id, fecha_salida, created_at")
    .eq("agente_id", usuarioId)
    .eq("estado", "aceptada");

  const buckets = { esteAnio: 0, anioPasado: 0, hace2Anios: 0, hace3o4Anios: 0, hace5MasAnios: 0 };
  if (error || !data) return buckets;

  const currentYear = new Date().getFullYear();
  const ultimoAnioPorCliente = new Map<string, number>();

  data.forEach((c: any) => {
    const clienteKey = c.contacto || c.contacto_persona_id;
    if (!clienteKey) return;
    const fecha = c.fecha_salida || c.created_at;
    if (!fecha) return;
    const year = new Date(fecha).getFullYear();
    if (Number.isNaN(year)) return;
    const prev = ultimoAnioPorCliente.get(clienteKey);
    if (prev === undefined || year > prev) ultimoAnioPorCliente.set(clienteKey, year);
  });

  ultimoAnioPorCliente.forEach((year) => {
    const diff = currentYear - year;
    if (diff <= 0) buckets.esteAnio += 1;
    else if (diff === 1) buckets.anioPasado += 1;
    else if (diff === 2) buckets.hace2Anios += 1;
    else if (diff <= 4) buckets.hace3o4Anios += 1;
    else buckets.hace5MasAnios += 1;
  });

  return buckets;
}

export async function getItinerariosCreadosCount() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();

  const { count } = await db
    .from("operativa_cotizaciones")
    .select("id", { count: "exact", head: true })
    .eq("agente_id", usuarioId);

  return count || 0;
}

export async function getPotencialCampanasResumen() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();

  const { data: asignaciones, error } = await db
    .from("crm_campanas_agentes")
    .select("campana_id, objetivo_valor, objetivo_num, crm_campanas!campana_id(id, nombre, estado)")
    .eq("agente_id", usuarioId);

  if (error || !asignaciones || asignaciones.length === 0) {
    return { objetivoValor: 0, conseguidoValor: 0, campanasActivas: 0, oportunidadesAbiertas: 0 };
  }

  const activas = asignaciones.filter((a: any) => a.crm_campanas?.estado === "activa");
  const campanaIds = activas.map((a: any) => a.campana_id);
  const objetivoValor = activas.reduce((sum: number, a: any) => sum + Number(a.objetivo_valor || 0), 0);

  if (campanaIds.length === 0) {
    return { objetivoValor: 0, conseguidoValor: 0, campanasActivas: 0, oportunidadesAbiertas: 0 };
  }

  const { data: oportunidades } = await db
    .from("crm_oportunidades")
    .select("valor_estimado, estado_id, crm_campanas_estados!estado_id(es_ganado)")
    .in("campana_id", campanaIds)
    .eq("agente_id", usuarioId);

  let conseguidoValor = 0;
  let oportunidadesAbiertas = 0;
  (oportunidades || []).forEach((o: any) => {
    if (o.crm_campanas_estados?.es_ganado) {
      conseguidoValor += Number(o.valor_estimado || 0);
    } else {
      oportunidadesAbiertas += 1;
    }
  });

  return {
    objetivoValor,
    conseguidoValor,
    campanasActivas: campanaIds.length,
    oportunidadesAbiertas,
  };
}

export async function getClientesNuevosVsPresupuestosAceptados() {
  const { usuarioId } = await getCurrentAgentePublic();
  const db = await getAgencyDbClient();

  const now = new Date();
  const anioActual = now.getFullYear();
  const anioAnterior = anioActual - 1;
  const desde = `${anioAnterior}-01-01`;

  const [{ data: clientes }, { data: cotizaciones }] = await Promise.all([
    db
      .from("contabilidad_entidades")
      .select("created_at")
      .eq("agente_id", usuarioId)
      .or("roles->cliente.eq.true,roles->organizacion.eq.true")
      .gte("created_at", desde),
    db
      .from("operativa_cotizaciones")
      .select("created_at")
      .eq("agente_id", usuarioId)
      .eq("estado", "aceptada")
      .gte("created_at", desde),
  ]);

  let clientesActual = 0;
  let clientesAnterior = 0;
  (clientes || []).forEach((c: any) => {
    const year = new Date(c.created_at).getFullYear();
    if (year === anioActual) clientesActual += 1;
    else if (year === anioAnterior) clientesAnterior += 1;
  });

  let presupuestosActual = 0;
  let presupuestosAnterior = 0;
  (cotizaciones || []).forEach((c: any) => {
    const year = new Date(c.created_at).getFullYear();
    if (year === anioActual) presupuestosActual += 1;
    else if (year === anioAnterior) presupuestosAnterior += 1;
  });

  return {
    anioActual,
    anioAnterior,
    clientesActual,
    clientesAnterior,
    presupuestosActual,
    presupuestosAnterior,
  };
}
