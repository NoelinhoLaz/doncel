import { getAgencyDbClient } from "@/lib/agencyDb";

const escapeSearch = (value?: string) => value?.trim().replace(/[%_\\]/g, "\\$&");

export interface MovimientosBancoFiltros {
  search?: string;
  matchScoreFilters?: string[];
  tipoMovimiento?: "debe" | "haber";
  fechaDesde?: string;
  fechaHasta?: string;
  importeMin?: number;
  importeMax?: number;
  estados?: string[];
  cuentaIds?: string[];
}

function construirQueryMovimientosBanco(agencyDb: any, filtros: MovimientosBancoFiltros) {
  const search = escapeSearch(filtros.search);
  const matchScoreFilters = filtros.matchScoreFilters ?? [];
  const tipoMovimiento = filtros.tipoMovimiento;
  const fechaDesde = filtros.fechaDesde;
  const fechaHasta = filtros.fechaHasta;
  const importeMin = filtros.importeMin;
  const importeMax = filtros.importeMax;
  const estados = filtros.estados ?? [];
  const cuentaIds = filtros.cuentaIds;

  let query = agencyDb
    .from("contabilidad_movimientos_banco")
    .select("*, config_cuentas_bancarias(banco, iban)", { count: "exact" })
    .eq("deleted", false);

  if (search && search.length >= 3) {
    const term = `%${search}%`;
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const dateEsRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    let dateQuery = "";
    if (dateRegex.test(search)) dateQuery = `,fecha_operacion.eq.${search}`;
    else {
      const match = search.match(dateEsRegex);
      if (match) dateQuery = `,fecha_operacion.eq.${match[3]}-${match[2]}-${match[1]}`;
    }
    query = query.or(`concepto_original.ilike.${term},referencia1.ilike.${term},referencia2.ilike.${term}${dateQuery}`);
  }

  if (tipoMovimiento === "debe") query = query.lt("importe", 0);
  else if (tipoMovimiento === "haber") query = query.gt("importe", 0);
  if (fechaDesde) query = query.gte("fecha_operacion", fechaDesde);
  if (fechaHasta) query = query.lte("fecha_operacion", fechaHasta);
  if (importeMin != null) query = query.gte("importe", importeMin);
  if (importeMax != null) query = query.lte("importe", importeMax);
  // "manual" y "ofiviaje" no son valores de la columna `estado` (que solo
  // distingue pendiente/parcial/conciliado/etc.) sino conciliado +
  // conciliacion_tipo "manual" / conciliado_externo=true — se traducen aquí
  // al filtro real.
  const estadosReales = estados.filter((e) => e !== "manual" && e !== "ofiviaje");
  if (estados.includes("manual") && !estados.includes("conciliado")) estadosReales.push("conciliado");
  if (estadosReales.length) query = query.in("estado", estadosReales);
  if (estados.includes("manual") && !estados.includes("conciliado")) query = query.eq("conciliacion_tipo", "manual");
  if (estados.includes("ofiviaje")) query = query.eq("conciliado_externo", true);
  // "Pendiente" es un estado de matching interno (facturas/proveedores); si el
  // movimiento ya se resolvió externamente vía OFIviaje, no debe seguir
  // apareciendo como pendiente aunque el estado interno no se haya actualizado,
  // sea cual sea la combinación de filtros activa (salvo que se pida
  // explícitamente "ofiviaje", que ya filtra por conciliado_externo=true).
  if (estados.includes("pendiente") && !estados.includes("ofiviaje")) query = query.eq("conciliado_externo", false);
  if (cuentaIds && cuentaIds.length) query = query.in("cuenta_bancaria_id", cuentaIds);

  const scoreConditions: string[] = [];
  if (matchScoreFilters.includes("bajos")) scoreConditions.push("and(match_score.gte.60,match_score.lt.80)");
  if (matchScoreFilters.includes("medios")) scoreConditions.push("and(match_score.gte.80,match_score.lte.90)");
  if (matchScoreFilters.includes("altos")) scoreConditions.push("match_score.gt.90");
  if (scoreConditions.length) query = query.or(scoreConditions.join(","));

  return query;
}

export async function getMovimientosBanco(options?: MovimientosBancoFiltros & { page?: number; limit?: number }) {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const agencyDb = await getAgencyDbClient();
  const query = construirQueryMovimientosBanco(agencyDb, options ?? {});

  const from = (page - 1) * limit;
  const to = page * limit - 1;
  const { data, error, count } = await query.order("fecha_operacion", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

/**
 * Igual que getMovimientosBanco pero sin paginación (para exportación): trae
 * todos los movimientos que cumplan los filtros, hasta un máximo de
 * seguridad razonable.
 */
export async function getMovimientosBancoSinPaginar(filtros: MovimientosBancoFiltros, limiteMaximo = 50000) {
  const agencyDb = await getAgencyDbClient();
  const query = construirQueryMovimientosBanco(agencyDb, filtros);
  const { data, error, count } = await query
    .order("fecha_operacion", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, limiteMaximo - 1);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

/**
 * Extrae heurísticamente el nombre del destinatario/proveedor del concepto
 * bancario en bruto, para movimientos pendientes que aún no tienen proveedor
 * estructurado (eso solo llega tras conciliar con OFIviaje). Cubre los dos
 * formatos más comunes: transferencias ("... A Favor De <nombre> Concepto: ...")
 * y compras con tarjeta ("Compra <nombre>, <lugar>, Tarjeta ...").
 */
function extraerDestinatarioConcepto(concepto: string): string {
  const texto = concepto || "";

  const favorMatch = texto.match(/A Favor De\s+(.+?)(?:\s+Concepto:|\s*,|$)/i);
  if (favorMatch) return favorMatch[1].trim();

  const compraMatch = texto.match(/^Compra(?:\s+Internet\s+En)?\s+(.+?),/i);
  if (compraMatch) return compraMatch[1].trim();

  return texto.trim() || "Sin identificar";
}

export interface InformeMensualMovimiento {
  id: string;
  fecha: string;
  concepto: string;
  destinatario: string;
  importe: number;
}

export interface InformeMensualCuenta {
  cuentaId: string;
  banco: string;
  totalPendiente: number;
  numMovimientos: number;
  topDestinatarios: Array<{ nombre: string; total: number; numMovimientos: number }>;
  movimientos: InformeMensualMovimiento[];
  incluirEnInformeAutomatico: boolean;
}

/**
 * Informe mensual: por cada cuenta bancaria, total e importe de movimientos
 * del debe (importe negativo) que aún no están conciliados con OFIviaje
 * (conciliado_externo = false) en los últimos 30 días, el TOP 5 de
 * destinatarios con más importe pendiente, y el detalle de movimientos
 * (para listar "pendientes en banco" en el informe).
 */
export async function getInformeMensualPendientesOfi(agencyDbParam?: any): Promise<InformeMensualCuenta[]> {
  const agencyDb = agencyDbParam || (await getAgencyDbClient());

  const { data: cuentas, error: errorCuentas } = await agencyDb
    .from("config_cuentas_bancarias")
    .select("id, banco, incluir_en_informe_automatico")
    .eq("activa", true);

  if (errorCuentas) throw errorCuentas;
  if (!cuentas || cuentas.length === 0) return [];

  const fechaDesde = new Date();
  fechaDesde.setDate(fechaDesde.getDate() - 30);
  const fechaDesdeStr = fechaDesde.toISOString().slice(0, 10);

  const { data: movimientos, error } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, cuenta_bancaria_id, importe, fecha_operacion, concepto_original")
    .eq("deleted", false)
    .eq("conciliado_externo", false)
    .lt("importe", 0)
    .gte("fecha_operacion", fechaDesdeStr)
    .order("fecha_operacion", { ascending: false });

  if (error) throw error;

  const porCuenta = new Map<
    string,
    { total: number; count: number; destinatarios: Map<string, { total: number; count: number }>; movimientos: InformeMensualMovimiento[] }
  >();

  for (const mov of movimientos || []) {
    const cuentaId = mov.cuenta_bancaria_id;
    if (!cuentaId) continue;
    const importe = Math.abs(Number(mov.importe));
    const destinatario = extraerDestinatarioConcepto(mov.concepto_original);

    if (!porCuenta.has(cuentaId)) {
      porCuenta.set(cuentaId, { total: 0, count: 0, destinatarios: new Map(), movimientos: [] });
    }
    const entry = porCuenta.get(cuentaId)!;
    entry.total += importe;
    entry.count += 1;
    entry.movimientos.push({
      id: mov.id,
      fecha: mov.fecha_operacion,
      concepto: mov.concepto_original || "",
      destinatario,
      importe,
    });

    if (!entry.destinatarios.has(destinatario)) entry.destinatarios.set(destinatario, { total: 0, count: 0 });
    const destEntry = entry.destinatarios.get(destinatario)!;
    destEntry.total += importe;
    destEntry.count += 1;
  }

  const resultado: InformeMensualCuenta[] = cuentas.map((cuenta: any) => {
    const entry = porCuenta.get(cuenta.id);
    const topDestinatarios = entry
      ? [...entry.destinatarios.entries()]
          .map(([nombre, d]) => ({ nombre, total: d.total, numMovimientos: d.count }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
      : [];

    return {
      cuentaId: cuenta.id,
      banco: cuenta.banco,
      totalPendiente: entry?.total || 0,
      numMovimientos: entry?.count || 0,
      topDestinatarios,
      movimientos: entry?.movimientos || [],
      incluirEnInformeAutomatico: cuenta.incluir_en_informe_automatico ?? true,
    };
  });

  return resultado.sort((a, b) => b.totalPendiente - a.totalPendiente);
}

export async function actualizarIncluirEnInformeAutomatico(
  cuentaBancariaId: string,
  incluir: boolean
): Promise<{ success: boolean; error?: string }> {
  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb
    .from("config_cuentas_bancarias")
    .update({ incluir_en_informe_automatico: incluir, updated_at: new Date().toISOString() })
    .eq("id", cuentaBancariaId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export interface UltimaConciliacionOfiviaje {
  procesadoEn: string | null;
  ficherosNombres: string[];
  totalPagosProcesados: number;
  totalConciliados: number;
  movimientos: Array<{
    id: string;
    fecha: string;
    concepto: string;
    importe: number;
    cuentaId: string | null;
    banco: string;
    proveedorNombre: string;
  }>;
}

/**
 * Resumen de la última ejecución de "Comprobar OFIviaje" (manual o cron):
 * qué ficheros se procesaron y qué movimientos se conciliaron en esa tanda,
 * usando el `procesado_en` más reciente en ofiviaje_ficheros_procesados como
 * referencia (todos los ficheros procesados ese mismo día se consideran la
 * misma tanda, ya que una ejecución de comprobación es puntual).
 */
export async function getUltimaConciliacionOfiviaje(agencyDbParam?: any): Promise<UltimaConciliacionOfiviaje> {
  const agencyDb = agencyDbParam || (await getAgencyDbClient());
  const vacio: UltimaConciliacionOfiviaje = {
    procesadoEn: null,
    ficherosNombres: [],
    totalPagosProcesados: 0,
    totalConciliados: 0,
    movimientos: [],
  };

  const { data: ultimoFichero } = await agencyDb
    .from("ofiviaje_ficheros_procesados")
    .select("procesado_en")
    .order("procesado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultimoFichero?.procesado_en) return vacio;

  const fechaUltimoParseo = String(ultimoFichero.procesado_en).slice(0, 10);

  const { data: ficherosDelDia } = await agencyDb
    .from("ofiviaje_ficheros_procesados")
    .select("nombre_fichero, pagos_procesados, movimientos_conciliados, procesado_en")
    .gte("procesado_en", `${fechaUltimoParseo}T00:00:00`)
    .lte("procesado_en", `${fechaUltimoParseo}T23:59:59`);

  const ficherosNombres = (ficherosDelDia || []).map((f: any) => f.nombre_fichero).filter(Boolean);
  const totalPagosProcesados = (ficherosDelDia || []).reduce((acc: number, f: any) => acc + (f.pagos_procesados || 0), 0);

  const { data: movimientosConciliados } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, importe, fecha_operacion, concepto_original, cuenta_bancaria_id, conciliado_externo_datos, config_cuentas_bancarias(banco)")
    .eq("deleted", false)
    .eq("conciliado_externo_origen", "ofiviaje")
    .gte("conciliado_externo_en", `${fechaUltimoParseo}T00:00:00`)
    .lte("conciliado_externo_en", `${fechaUltimoParseo}T23:59:59`);

  const movimientos = (movimientosConciliados || []).map((mov: any) => ({
    id: mov.id,
    fecha: mov.fecha_operacion,
    concepto: mov.concepto_original || "",
    importe: Math.abs(Number(mov.importe)),
    cuentaId: mov.cuenta_bancaria_id,
    banco: mov.config_cuentas_bancarias?.banco || "Cuenta sin nombre",
    proveedorNombre: mov.conciliado_externo_datos?.proveedorNombre || "",
  }));

  return {
    procesadoEn: String(ultimoFichero.procesado_en),
    ficherosNombres,
    totalPagosProcesados,
    totalConciliados: movimientos.length,
    movimientos,
  };
}

const formatEURComunicacion = (v: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);
const formatFechaCortaComunicacion = (f: string) => {
  if (!f) return "";
  return new Date(f).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

function filaBancoOfiHtml(
  movimientos: Array<{ fecha: string; concepto: string; importe: number }>,
  pagos: Array<{ proveedorNombre: string; fechaVencto: string; importePendiente: number }>
): string {
  let html = `<div style="color:#64748b;font-size:12px;margin-top:2px;">Banco:</div>`;
  for (const mov of movimientos) {
    html += `<div style="display:flex;justify-content:space-between;color:#64748b;font-size:12px;"><span>${formatFechaCortaComunicacion(mov.fecha)} · ${mov.concepto || "Movimiento sin concepto"}</span><span style="font-weight:700;color:#dc2626;">${formatEURComunicacion(Math.abs(mov.importe))}</span></div>`;
  }
  html += `<div style="border-top:1px solid #f1f5f9;margin:4px 0;"></div>`;
  html += `<div style="color:#94a3b8;font-size:11px;">OfiViaje:</div>`;
  for (const p of pagos) {
    html += `<div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:11px;"><span>${p.proveedorNombre} · ${p.fechaVencto}</span><span>${formatEURComunicacion(p.importePendiente)}</span></div>`;
  }
  return html;
}

/**
 * Construye el HTML del informe de conciliación replicando el diseño del
 * modal "Informe de conciliación" de la app: KPIs (pendientes/conciliados),
 * detalle de pendientes por cuenta con TOP 5 destinatarios, últimos 5
 * conciliados en la última lectura, y "Tareas propuestas para revisión en
 * OFIviaje" con las 4 categorías (proveedor distinto, importe distinto,
 * suma, división).
 */
function construirHtmlInformeAutomatico(params: {
  fechaHoy: string;
  banco?: string;
  pendientes: InformeMensualCuenta[];
  conciliados: UltimaConciliacionOfiviaje["movimientos"];
  revisarPreview?: any;
}): string {
  const { fechaHoy, banco, pendientes, conciliados, revisarPreview } = params;
  const totalPendiente = pendientes.reduce((acc, c) => acc + c.totalPendiente, 0);
  const totalMovPendientes = pendientes.reduce((acc, c) => acc + c.numMovimientos, 0);
  const totalConciliado = conciliados.reduce((acc, m) => acc + m.importe, 0);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://doncel.vercel.app";
  const movimientosUrl = `${baseUrl}/concilia_login`;

  let html = `<div style="font-family:sans-serif;color:#334155;max-width:640px;">`;
  html += `<h2 style="font-size:16px;margin:0 0 8px;">Informe de conciliación${banco ? ` · ${banco}` : ""}</h2>`;
  html += `<p style="font-size:13px;color:#334155;">Buenos días, te detallo el resultado de la conciliación automática de OFIviaje en el día ${fechaHoy}.</p>`;

  // KPIs
  html += `<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:6px 0;margin:12px 0;"><tr>`;
  html += `<td width="50%" style="padding:14px;border-radius:8px;border:2px solid #c4b5fd;background:#f5f3ff;text-align:center;">`;
  html += `<div style="font-size:11px;font-weight:600;color:#64748b;">PENDIENTES EN BANCO</div>`;
  html += `<div style="font-size:22px;font-weight:700;color:#7c3aed;">${totalMovPendientes}</div>`;
  html += `<div style="font-size:12px;color:#64748b;">${formatEURComunicacion(totalPendiente)}</div></td>`;
  html += `<td width="50%" style="padding:14px;border-radius:8px;border:2px solid #93c5fd;background:#eff6ff;text-align:center;">`;
  html += `<div style="font-size:11px;font-weight:600;color:#64748b;">CONCILIADOS ÚLTIMA LECTURA</div>`;
  html += `<div style="font-size:22px;font-weight:700;color:#2563eb;">${conciliados.length}</div>`;
  html += `<div style="font-size:12px;color:#64748b;">${formatEURComunicacion(totalConciliado)}</div></td>`;
  html += `</tr></table>`;

  // Pendientes por cuenta
  if (pendientes.length > 0) {
    for (const cuenta of pendientes) {
      html += `<p style="font-size:13px;color:#0f172a;margin:12px 0 6px;"><strong>${cuenta.banco}</strong> <strong>${formatEURComunicacion(cuenta.totalPendiente)}</strong> (${cuenta.numMovimientos} mov.) pendientes de conciliar.</p>`;
      if (cuenta.topDestinatarios.length > 0) {
        html += `<p style="font-size:12px;color:#334155;margin-bottom:4px;">El TOP 5 de destinatarios pendientes de conciliar es:</p>`;
        for (const d of cuenta.topDestinatarios) {
          html += `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f1f5f9;"><span>${d.nombre}</span><span style="font-weight:600;">${formatEURComunicacion(d.total)} (${d.numMovimientos} mov.)</span></div>`;
        }
      }
    }
  } else {
    html += `<p style="font-size:13px;color:#64748b;">No hay movimientos pendientes de conciliar.</p>`;
  }

  // Últimos 5 conciliados
  html += `<p style="font-size:12px;font-weight:700;text-transform:uppercase;color:#15803d;margin:16px 0 4px;">Conciliados en la última lectura</p>`;
  if (conciliados.length > 0) {
    for (const m of conciliados.slice(0, 5)) {
      html += `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f1f5f9;"><span>${formatFechaCortaComunicacion(m.fecha)} · ${m.proveedorNombre || m.concepto} · ${m.banco}</span><span style="font-weight:600;color:#15803d;">${formatEURComunicacion(m.importe)}</span></div>`;
    }
    if (conciliados.length > 5) {
      html += `<p style="font-size:12px;color:#94a3b8;margin-top:4px;">y ${conciliados.length - 5} más — <a href="${movimientosUrl}" style="color:#2563eb;">ver listado completo en la app</a>.</p>`;
    }
  } else {
    html += `<p style="font-size:13px;color:#64748b;">No se ha conciliado ningún movimiento en la última lectura.</p>`;
  }

  // Tareas propuestas
  if (revisarPreview) {
    const revisarNombre = revisarPreview.revisarNombre || [];
    const revisarImporte = revisarPreview.revisarImporte || [];
    const revisarSuma = revisarPreview.revisarSuma || [];
    const revisarDivision = revisarPreview.revisarDivision || [];
    const totalRevisar = revisarNombre.length + revisarImporte.length + revisarSuma.length + revisarDivision.length;

    if (totalRevisar > 0) {
      html += `<div style="border-top:1px solid #e2e8f0;margin:16px 0 12px;"></div>`;
      html += `<p style="font-size:14px;font-weight:700;color:#0f172a;text-align:center;margin:0 0 4px;">TAREAS PROPUESTAS PARA REVISIÓN EN OFIVIAJE</p>`;
      html += `<p style="font-size:11px;color:#94a3b8;font-style:italic;text-align:center;margin:0 0 12px;">Los datos contables de OFIviaje deben adaptarse al extracto bancario para garantizar el correcto punteado de las cuentas.</p>`;

      for (const m of revisarNombre) {
        html += `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;"><div style="font-weight:600;color:#0f172a;">Proveedor distinto</div>`;
        html += filaBancoOfiHtml([{ fecha: m.movimientoFecha, concepto: m.movimientoConcepto, importe: m.movimientoImporte }], [m.pago]);
        html += `<div style="color:#94a3b8;font-size:11px;margin-top:2px;">Doc: ${m.pago.documento} · Expediente OFI: ${m.pago.referenciaProvCte} · Doc. cobro/pago: ${m.pago.documentoCobroPago} · Pasajero: ${m.pago.nombrePasajero}</div></div>`;
      }
      for (const m of revisarImporte) {
        html += `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;"><div style="font-weight:600;color:#0f172a;">Importe distinto</div>`;
        html += filaBancoOfiHtml([{ fecha: m.movimientoFecha, concepto: m.movimientoConcepto, importe: m.movimientoImporte }], [m.pago]);
        html += `<div style="color:#94a3b8;font-size:11px;margin-top:2px;">Doc: ${m.pago.documento} · Expediente OFI: ${m.pago.referenciaProvCte} · Doc. cobro/pago: ${m.pago.documentoCobroPago}</div></div>`;
      }
      for (const m of revisarSuma) {
        html += `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;"><div style="font-weight:600;color:#0f172a;">Un pago OFI = 2 movimientos bancarios</div>`;
        html += filaBancoOfiHtml(
          [0, 1].map((idx) => ({ fecha: m.movimientoFechas[idx], concepto: m.movimientoConceptos[idx], importe: m.movimientoImportes[idx] })),
          [m.pago]
        );
        html += `<div style="color:#94a3b8;font-size:11px;margin-top:2px;">Doc: ${m.pago.documento} · Expediente OFI: ${m.pago.referenciaProvCte} · Doc. cobro/pago: ${m.pago.documentoCobroPago}</div></div>`;
      }
      for (const m of revisarDivision) {
        html += `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;"><div style="font-weight:600;color:#0f172a;">Un movimiento bancario = ${m.pagos.length} pagos OFI</div>`;
        html += filaBancoOfiHtml([{ fecha: m.movimientoFecha, concepto: m.movimientoConcepto, importe: m.movimientoImporte }], m.pagos);
        for (const p of m.pagos) {
          html += `<div style="color:#94a3b8;font-size:11px;margin-top:2px;">Doc: ${p.documento} · Expediente OFI: ${p.referenciaProvCte}</div>`;
        }
        html += `</div>`;
      }
    }

    const sinMatch = revisarPreview.sinMatch || [];
    if (sinMatch.length > 0) {
      html += `<p style="font-size:12px;font-weight:700;text-transform:uppercase;color:#b45309;margin:16px 0 4px;">Sin movimiento bancario encontrado</p>`;
      for (const p of sinMatch) {
        html += `<div style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;"><div style="font-weight:600;color:#0f172a;">${p.proveedorNombre}</div>`;
        html += `<div style="display:flex;justify-content:space-between;color:#64748b;font-size:12px;"><span>${p.fechaVencto} · ${p.nombrePasajero}</span><span style="font-weight:700;color:#b45309;">${formatEURComunicacion(p.importePendiente)}</span></div></div>`;
      }
    }
  }

  html += `<div style="text-align:center;margin-top:24px;">`;
  html += `<a href="${movimientosUrl}" style="display:inline-block;padding:10px 24px;background:#1D2441;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Ir a la app de conciliación</a>`;
  html += `</div>`;

  html += `</div>`;
  return html;
}

/**
 * Envía el informe diario de conciliación OFIviaje (pendientes + conciliados
 * en la última lectura + tareas propuestas, todas las cuentas) al email del
 * usuario Owner de la agencia. Server-to-server (sin sesión), llamado desde
 * el cron tras `comprobarOfiviajeParaAgencia`.
 */
export async function enviarInformeAutomaticoOfiviajeAlOwner(
  agencyDb: any,
  usuarioOwnerId: string,
  ownerEmail: string
): Promise<{ success: boolean; error?: string }> {
  const [pendientesTodas, ultimaConciliacion] = await Promise.all([
    getInformeMensualPendientesOfi(agencyDb),
    getUltimaConciliacionOfiviaje(agencyDb),
  ]);

  // Solo se incluyen en el email automático diario las cuentas marcadas para
  // ello (campo config_cuentas_bancarias.incluir_en_informe_automatico), y se
  // manda un email independiente por cada una en vez de un único email
  // combinado con los totales de todas.
  const pendientesIncluidos = pendientesTodas.filter((c) => c.incluirEnInformeAutomatico);
  if (pendientesIncluidos.length === 0) return { success: true }; // ninguna cuenta marcada: no se envía nada

  const fechaHoy = new Date().toLocaleDateString("es-ES");
  const { enviarInformeHtmlPorEmail } = await import("./ofiviajeMatch");

  for (const pendiente of pendientesIncluidos) {
    const conciliados = ultimaConciliacion.movimientos.filter((m) => m.cuentaId === pendiente.cuentaId);
    const html = construirHtmlInformeAutomatico({ fechaHoy, banco: pendiente.banco, pendientes: [pendiente], conciliados });
    const resultado = await enviarInformeHtmlPorEmail(
      html,
      [ownerEmail, "noel.lazuen@gmail.com"],
      usuarioOwnerId,
      `Informe de conciliación OFIviaje · ${pendiente.banco} - ${fechaHoy}`
    );
    if (!resultado.success) return resultado;
  }

  return { success: true };
}

/**
 * Envía manualmente por email (con la configuración SMTP del usuario de la
 * sesión actual) exactamente lo que se muestra en pantalla en el modal
 * "Informe de conciliación" (KPIs, pendientes con TOP 5, últimos conciliados
 * y tareas propuestas): si `cuentaBancariaId` es "todos" (o se omite), un
 * único informe con todas las cuentas; si es el id de una cuenta concreta,
 * el informe filtrado solo a esa cuenta. `revisarPreview` es el mismo objeto
 * ya calculado en el cliente (previsualizarConciliacionOfiviaje) para no
 * volver a comprobar OFIviaje solo por enviar el email.
 */
export async function enviarInformeMensualPorEmail(
  destinatarioEmail: string,
  cuentaBancariaId?: string,
  revisarPreview?: any
): Promise<{ success: boolean; error?: string }> {
  const [pendientes, ultimaConciliacion] = await Promise.all([
    getInformeMensualPendientesOfi(),
    getUltimaConciliacionOfiviaje(),
  ]);

  const fechaHoy = new Date().toLocaleDateString("es-ES");
  const { enviarInformeHtmlPorEmail } = await import("./ofiviajeMatch");

  if (!cuentaBancariaId || cuentaBancariaId === "todos") {
    const html = construirHtmlInformeAutomatico({ fechaHoy, pendientes, conciliados: ultimaConciliacion.movimientos, revisarPreview });
    return enviarInformeHtmlPorEmail(html, destinatarioEmail, undefined, `Informe de conciliación OFIviaje - ${fechaHoy}`);
  }

  const pendiente = pendientes.find((p) => p.cuentaId === cuentaBancariaId);
  const conciliados = ultimaConciliacion.movimientos.filter((m) => m.cuentaId === cuentaBancariaId);
  const banco = pendiente?.banco || conciliados[0]?.banco || "";

  const html = construirHtmlInformeAutomatico({
    fechaHoy,
    banco,
    pendientes: pendiente ? [pendiente] : [],
    conciliados,
    revisarPreview,
  });

  return enviarInformeHtmlPorEmail(html, destinatarioEmail, undefined, `Informe de conciliación OFIviaje${banco ? ` · ${banco}` : ""} - ${fechaHoy}`);
}

export async function deleteMovimientoBanco(id: string) {
  const agencyDb = await getAgencyDbClient();
  const { error } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function getPagosDocumento(documentoId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("operativa_documentos_pagos")
    .select("*, contabilidad_movimientos_banco(fecha_operacion, importe, concepto_original)")
    .eq("documento_id", documentoId)
    .order("fecha_movimiento", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getDocumentosExpediente(expedienteId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data: relations, error: relError } = await agencyDb
    .from("operativa_documentos_expedientes")
    .select("documento_id")
    .eq("expediente_id", expedienteId);
  if (relError) throw relError;
  const docIds = (relations || []).map((r: any) => r.documento_id);
  if (!docIds.length) return [];
  const { data: docs, error: docsError } = await agencyDb
    .from("operativa_documentos_proveedor")
    .select("*")
    .in("id", docIds)
    .order("created_at", { ascending: false });
  if (docsError) throw docsError;
  return docs || [];
}

export async function getMatchesPendientesPorExpediente(expedienteId: string) {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("*, config_cuentas_bancarias(banco, iban)")
    .eq("estado", "propuesto")
    .eq("deleted", false)
    .eq("match_metadatos->>expediente_id", expedienteId)
    .order("match_score", { ascending: false });
  if (error) throw error;
  return (data || []).filter((mov: any) => {
    const rawScore = mov.match_score ?? mov.match_metadatos?.score ?? 0;
    const normalized = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
    return normalized >= 70;
  });
}

export async function regenerarPoolsBanco() {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb.rpc("fn_regenerar_pools_banco");
  if (error) throw error;
  return { actualizados: (data as any)?.actualizados ?? 0 };
}
