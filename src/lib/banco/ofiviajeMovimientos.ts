import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { getDriveTokensUsuarioActual, listarXmlEnCarpeta, descargarContenidoXml, type DriveTokens } from "./ofiviajeDrive";
import { parseOfiviajePagosXml, parseOfiviajeCobrosXml, parseOfiviajeFecha, parseOfiviajeFechaCorta, type OfiviajePago } from "./ofiviajeParser";
import { coincide, desambiguarMovimiento, getAliasProveedorPorAgencia, getMapaCuentaContable, nombreCoincide } from "./ofiviajeMatch";

/**
 * Resuelve la oficina a asignar a los registros descargados: la del usuario
 * autenticado (config_usuarios.oficina) o, si no tiene, la primera oficina
 * configurada en la agencia. Mismo patrón que createExpediente en
 * src/actions/expedientes.ts.
 */
async function resolverOficinaIdUsuarioActual(agencyDb: any): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();

  if (user) {
    try {
      const adminServiceSupabase = createAdminServiceClient();
      const { data: usuario } = await adminServiceSupabase
        .from("usuarios")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (usuario) {
        const { data: config } = await agencyDb
          .from("config_usuarios")
          .select("oficina")
          .eq("usuario_id", usuario.id)
          .single();
        if (config?.oficina) return config.oficina;
      }
    } catch {
      // sin config de oficina para este usuario: cae al fallback de abajo
    }
  }

  const { data: oficinas } = await agencyDb.from("config_oficinas").select("id").limit(1);
  if (oficinas && oficinas.length > 0) return oficinas[0].id;

  throw new Error("No hay ninguna oficina configurada en el sistema.");
}

export interface DescargaOfiviajeResultado {
  ficherosLeidos: number;
  pagosInsertados: number;
  cobrosInsertados: number;
  error?: string;
}

/**
 * Lista y descarga todos los XML de la carpeta de Drive configurada (mismo
 * origen que usa el matching bancario de OFIviaje) y vuelca sus registros en
 * ofi_pagos / ofi_cobros. Idempotente: la clave única de cada tabla evita
 * duplicar filas al reprocesar el mismo XML o encontrar el mismo registro en
 * ficheros distintos (ON CONFLICT DO NOTHING).
 *
 * Variante para el cron (multi-agencia, sin sesión de usuario): recibe
 * agencyDb/tokens/oficinaId ya resueltos en vez de leerlos de la sesión actual.
 */
export async function descargarMovimientosOfiviajeParaAgencia(
  agencyDb: any,
  tokens: DriveTokens,
  oficinaId: string
): Promise<DescargaOfiviajeResultado> {
  const ficheros = await listarXmlEnCarpeta(tokens);

  let pagosInsertados = 0;
  let cobrosInsertados = 0;

  for (const fichero of ficheros) {
    const xml = await descargarContenidoXml(tokens, fichero.id);

    if (fichero.nombre.startsWith("TSRLiquidacionCajas_")) {
      const cobros = parseOfiviajeCobrosXml(xml);
      if (cobros.length === 0) continue;

      const filas = cobros.map((c) => ({
        oficina_id: oficinaId,
        drive_file_id: fichero.id,
        drive_file_nombre: fichero.nombre,
        factura: c.factura || null,
        fecha_movimiento: parseOfiviajeFechaCorta(c.fechaMovimiento),
        nombre_pagador: c.nombrePagador || null,
        concepto_movimiento: c.conceptoMovimiento || null,
        importe_cobro: c.importeCobro,
      }));

      const { data, error } = await agencyDb
        .from("ofi_cobros")
        .upsert(filas, {
          onConflict: "oficina_id,factura,fecha_movimiento,nombre_pagador,importe_cobro",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw error;
      cobrosInsertados += data?.length ?? 0;
    } else {
      const pagos = parseOfiviajePagosXml(xml);
      if (pagos.length === 0) continue;

      const filas = pagos.map((p) => ({
        oficina_id: oficinaId,
        drive_file_id: fichero.id,
        drive_file_nombre: fichero.nombre,
        documento: p.documento,
        fecha_vencto: parseOfiviajeFecha(p.fechaVencto),
        fecha_doc: parseOfiviajeFecha(p.fechaDoc),
        referencia_prov_cte: p.referenciaProvCte || null,
        documento_cobro_pago: p.documentoCobroPago || null,
        tipo_operacion: p.tipoOperacion || null,
        cuenta_tesoreria: p.cuentaTesoreria || null,
        nombre_pasajero: p.nombrePasajero || null,
        apunte: p.apunte || null,
        importe_pendiente: p.importePendiente,
        situacion: p.situacion || null,
        proveedor_nombre: p.proveedorNombre || null,
        proveedor_cuenta_contable: p.proveedorCuentaContable || null,
      }));

      // Deduplicar dentro del propio batch (la misma combinación no debe
      // insertarse dos veces aunque aparezca repetida en el XML) y dejar que
      // la constraint única real
      // (ofi_pagos_oficina_cuenta_doc_fecha_apunte_importe_key) se encargue
      // de ignorar los que ya existan en BD vía upsert. Se usan estos 5
      // campos (cuenta_tesoreria+documento+fecha_doc+apunte+importe_pendiente)
      // porque documento+apunte solos no bastan: informes sucesivos pueden
      // repetir el mismo apunte con datos distintos.
      const filasUnicas = new Map<string, (typeof filas)[number]>();
      for (const f of filas) {
        filasUnicas.set(`${f.cuenta_tesoreria}|${f.documento}|${f.fecha_doc}|${f.apunte}|${f.importe_pendiente}`, f);
      }

      const { data, error } = await agencyDb
        .from("ofi_pagos")
        .upsert([...filasUnicas.values()], {
          onConflict: "oficina_id,cuenta_tesoreria,documento,fecha_doc,apunte,importe_pendiente",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw error;
      pagosInsertados += data?.length ?? 0;
    }
  }

  return { ficherosLeidos: ficheros.length, pagosInsertados, cobrosInsertados };
}

/** Variante para la UI (usuario autenticado): resuelve tokens/oficina de la sesión actual. */
export async function descargarMovimientosOfiviaje(): Promise<DescargaOfiviajeResultado> {
  const tokens = await getDriveTokensUsuarioActual();
  const agencyDb = await getAgencyDbClient();
  const oficinaId = await resolverOficinaIdUsuarioActual(agencyDb);
  return descargarMovimientosOfiviajeParaAgencia(agencyDb, tokens, oficinaId);
}

/**
 * Añade a cada fila `movimiento_banco` (el primero, para no romper el uso
 * existente) y `movimientos_banco` (todos los vinculados, vía
 * movimientos_banco_ids con fallback a la columna singular para filas
 * antiguas) con los datos del/los movimiento(s) bancario(s), para el
 * tooltip del listado — consultando aparte en vez de vía embed de Supabase
 * para no depender del nombre de la FK auto-generada.
 */
async function adjuntarMovimientoBanco<T extends { movimiento_banco_id: string | null; movimientos_banco_ids?: string[] | null }>(
  agencyDb: any,
  filas: T[]
): Promise<(T & { movimiento_banco: any | null; movimientos_banco: any[] })[]> {
  const idsPorFila = filas.map((f) => {
    const ids = new Set<string>(Array.isArray(f.movimientos_banco_ids) ? f.movimientos_banco_ids : []);
    if (f.movimiento_banco_id) ids.add(f.movimiento_banco_id);
    return [...ids];
  });
  const todosLosIds = [...new Set(idsPorFila.flat())];
  if (todosLosIds.length === 0) return filas.map((f) => ({ ...f, movimiento_banco: null, movimientos_banco: [] }));

  const { data: movimientos } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, concepto_original, fecha_operacion, importe")
    .in("id", todosLosIds);

  const porId = new Map((movimientos ?? []).map((m: any) => [m.id, m]));
  return filas.map((f, i) => {
    const movimientosBanco = idsPorFila[i].map((id) => porId.get(id)).filter(Boolean);
    return {
      ...f,
      movimiento_banco: f.movimiento_banco_id ? porId.get(f.movimiento_banco_id) ?? null : movimientosBanco[0] ?? null,
      movimientos_banco: movimientosBanco,
    };
  });
}

export async function getOfiPagos(oficinaId?: string) {
  const agencyDb = await getAgencyDbClient();
  let query = agencyDb.from("ofi_pagos").select("*").order("fecha_vencto", { ascending: false });
  if (oficinaId) query = query.eq("oficina_id", oficinaId);
  const { data, error } = await query;
  if (error) throw error;
  return adjuntarMovimientoBanco(agencyDb, data ?? []);
}

export async function getOfiCobros(oficinaId?: string) {
  const agencyDb = await getAgencyDbClient();
  let query = agencyDb.from("ofi_cobros").select("*").order("fecha_movimiento", { ascending: false });
  if (oficinaId) query = query.eq("oficina_id", oficinaId);
  const { data, error } = await query;
  if (error) throw error;
  return adjuntarMovimientoBanco(agencyDb, data ?? []);
}

const TOLERANCIA_IMPORTE = 0.01;
const TOLERANCIA_DIAS = 30;

function diasEntre(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

export interface VincularOfiResultado {
  pagosVinculados: number;
  cobrosVinculados: number;
}

/**
 * Botón temporal de backfill: para cada fila de ofi_pagos/ofi_cobros que aún
 * no tiene movimiento_banco_id, intenta vincularla con un movimiento de
 * contabilidad_movimientos_banco en dos pasadas:
 *
 * 1. Exacta: los movimientos ya conciliados por OFIviaje (conciliado_externo
 *    = true) guardan el pago/cobro original en conciliado_externo_datos
 *    (documento+apunte para pagos, documento=factura para cobros). Es la
 *    fuente de verdad — la inmensa mayoría de los "muchos movimientos
 *    conciliados con OFI" que ya existen en banco quedan resueltos aquí.
 * 2. Fuzzy (fallback): para lo que quede sin resolver, busca por importe
 *    (±1 céntimo) y fecha (±30 días), solo si hay un único candidato.
 */
export async function vincularMovimientosOfiConBanco(): Promise<VincularOfiResultado> {
  const agencyDb = await getAgencyDbClient();

  const [{ data: pagosSinVincular, error: e1 }, { data: cobrosSinVincular, error: e2 }] = await Promise.all([
    agencyDb.from("ofi_pagos").select("id, documento, apunte, fecha_vencto, fecha_doc, importe_pendiente").is("movimiento_banco_id", null),
    agencyDb.from("ofi_cobros").select("id, factura, fecha_movimiento, importe_cobro").is("movimiento_banco_id", null),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const { data: movimientosConciliados, error: e3 } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, conciliado_externo_datos")
    .eq("conciliado_externo", true)
    .not("conciliado_externo_datos", "is", null);
  if (e3) throw e3;

  // Pagos: clave documento+apunte. Cobros: el pago adaptado (cobroComoPago)
  // guarda factura en el campo "documento" y deja "apunte" vacío.
  const movimientoPorDocumentoApunte = new Map<string, string>();
  const movimientoPorFactura = new Map<string, string>();
  for (const mov of movimientosConciliados ?? []) {
    const datos = mov.conciliado_externo_datos;
    if (!datos?.documento) continue;
    if (datos.apunte) {
      movimientoPorDocumentoApunte.set(`${datos.documento}|${datos.apunte}`, mov.id);
    } else {
      movimientoPorFactura.set(datos.documento, mov.id);
    }
  }

  let pagosVinculados = 0;
  const pagosPendientes: typeof pagosSinVincular = [];
  for (const pago of pagosSinVincular ?? []) {
    const movimientoId = pago.apunte ? movimientoPorDocumentoApunte.get(`${pago.documento}|${pago.apunte}`) : undefined;
    if (movimientoId) {
      const { error } = await agencyDb.from("ofi_pagos").update({ movimiento_banco_id: movimientoId }).eq("id", pago.id);
      if (!error) {
        pagosVinculados++;
        continue;
      }
    }
    pagosPendientes.push(pago);
  }

  let cobrosVinculados = 0;
  const cobrosPendientes: typeof cobrosSinVincular = [];
  for (const cobro of cobrosSinVincular ?? []) {
    const movimientoId = cobro.factura ? movimientoPorFactura.get(cobro.factura) : undefined;
    if (movimientoId) {
      const { error } = await agencyDb.from("ofi_cobros").update({ movimiento_banco_id: movimientoId }).eq("id", cobro.id);
      if (!error) {
        cobrosVinculados++;
        continue;
      }
    }
    cobrosPendientes.push(cobro);
  }

  // Fallback fuzzy solo para lo que la vinculación exacta no resolvió.
  if (pagosPendientes.length > 0 || cobrosPendientes.length > 0) {
    const { data: movimientos, error: e4 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, importe, fecha_operacion, fecha_valor");
    if (e4) throw e4;

    const candidatosPara = (importe: number, fecha: string | null) => {
      if (!fecha) return [];
      return (movimientos ?? []).filter((mov: any) => {
        if (Math.abs(Math.abs(Number(mov.importe)) - Math.abs(importe)) > TOLERANCIA_IMPORTE) return false;
        const fechasMov = [mov.fecha_operacion, mov.fecha_valor].filter(Boolean);
        return fechasMov.some((fMov: string) => diasEntre(fecha, fMov) <= TOLERANCIA_DIAS);
      });
    };

    for (const pago of pagosPendientes) {
      const candidatos = candidatosPara(pago.importe_pendiente, pago.fecha_vencto || pago.fecha_doc);
      if (candidatos.length !== 1) continue;
      const { error } = await agencyDb.from("ofi_pagos").update({ movimiento_banco_id: candidatos[0].id }).eq("id", pago.id);
      if (!error) pagosVinculados++;
    }

    for (const cobro of cobrosPendientes) {
      const candidatos = candidatosPara(cobro.importe_cobro, cobro.fecha_movimiento);
      if (candidatos.length !== 1) continue;
      const { error } = await agencyDb.from("ofi_cobros").update({ movimiento_banco_id: candidatos[0].id }).eq("id", cobro.id);
      if (!error) cobrosVinculados++;
    }
  }

  return { pagosVinculados, cobrosVinculados };
}

export interface CandidatoMovimientoBanco {
  id: string;
  concepto_original: string;
  fecha_operacion: string;
  importe: number;
}

/**
 * Búsqueda manual (botón lupa del listado): candidatos de
 * contabilidad_movimientos_banco para un pago/cobro OFI concreto, con margen
 * más amplio que el backfill automático (±60 días, sin exigir candidato
 * único) porque aquí es la persona quien decide cuál es el correcto.
 */
export async function buscarCandidatosMovimientoBanco(
  tipo: "pago" | "cobro",
  id: string
): Promise<CandidatoMovimientoBanco[]> {
  const agencyDb = await getAgencyDbClient();

  let importe: number;
  let fecha: string | null;

  if (tipo === "pago") {
    const { data: registro, error: e1 } = await agencyDb
      .from("ofi_pagos")
      .select("importe_pendiente, fecha_vencto, fecha_doc")
      .eq("id", id)
      .single();
    if (e1) throw e1;
    importe = registro.importe_pendiente;
    fecha = registro.fecha_vencto || registro.fecha_doc;
  } else {
    const { data: registro, error: e1 } = await agencyDb
      .from("ofi_cobros")
      .select("importe_cobro, fecha_movimiento")
      .eq("id", id)
      .single();
    if (e1) throw e1;
    importe = registro.importe_cobro;
    fecha = registro.fecha_movimiento;
  }
  if (!fecha) return [];

  const margenDias = 60;
  const desde = new Date(fecha);
  desde.setDate(desde.getDate() - margenDias);
  const hasta = new Date(fecha);
  hasta.setDate(hasta.getDate() + margenDias);

  const { data: movimientos, error: e2 } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, concepto_original, fecha_operacion, importe")
    .gte("fecha_operacion", desde.toISOString().slice(0, 10))
    .lte("fecha_operacion", hasta.toISOString().slice(0, 10))
    .order("fecha_operacion", { ascending: false });
  if (e2) throw e2;

  return (movimientos ?? [])
    .filter((mov: any) => Math.abs(Math.abs(Number(mov.importe)) - Math.abs(importe)) <= TOLERANCIA_IMPORTE)
    .map((mov: any) => ({ id: mov.id, concepto_original: mov.concepto_original || "", fecha_operacion: mov.fecha_operacion, importe: Number(mov.importe) }));
}

/** Confirma manualmente el vínculo elegido por el usuario en el modal de búsqueda. */
export async function vincularManualmenteMovimientoBanco(
  tipo: "pago" | "cobro",
  id: string,
  movimientoBancoId: string
): Promise<void> {
  const agencyDb = await getAgencyDbClient();
  const tabla = tipo === "pago" ? "ofi_pagos" : "ofi_cobros";
  const { error } = await agencyDb.from(tabla).update({ movimiento_banco_id: movimientoBancoId }).eq("id", id);
  if (error) throw error;
}

export interface PagoOfiVinculado {
  id: string;
  documento: string;
  proveedorNombre: string;
  nombrePasajero: string;
  referenciaProvCte: string;
  documentoCobroPago: string;
  importePendiente: number;
  fechaVencto: string | null;
  vinculadoPor: string | null;
  vinculadoEn: string | null;
}

/**
 * Todos los pagos OFI vinculados a un movimiento bancario concreto (columna
 * movimiento_banco_id o array movimientos_banco_ids), para el tooltip de
 * /banco: un movimiento puede tener varios pagos OFI de expedientes
 * distintos (ej. uno grande cubierto por varios pagos pequeños), y
 * conciliado_externo_datos solo guarda el primero como referencia. Incluye
 * quién vinculó cada pago (vinculado_por/vinculado_en), resuelto a nombre
 * por el caller (actions/banco.ts) igual que getConciliacionesManuales.
 */
export async function getPagosOfiVinculadosAMovimiento(movimientoBancoId: string): Promise<PagoOfiVinculado[]> {
  const agencyDb = await getAgencyDbClient();
  const { data, error } = await agencyDb
    .from("ofi_pagos")
    .select("id, documento, proveedor_nombre, nombre_pasajero, referencia_prov_cte, documento_cobro_pago, importe_pendiente, fecha_vencto, vinculado_por, vinculado_en")
    .or(`movimiento_banco_id.eq.${movimientoBancoId},movimientos_banco_ids.cs.["${movimientoBancoId}"]`)
    .order("fecha_vencto", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    id: p.id,
    documento: p.documento,
    proveedorNombre: p.proveedor_nombre || "",
    nombrePasajero: p.nombre_pasajero || "",
    referenciaProvCte: p.referencia_prov_cte || "",
    documentoCobroPago: p.documento_cobro_pago || "",
    importePendiente: Number(p.importe_pendiente),
    fechaVencto: p.fecha_vencto,
    vinculadoPor: p.vinculado_por || null,
    vinculadoEn: p.vinculado_en || null,
  }));
}

export interface PagoOfiBusqueda {
  id: string;
  documento: string;
  proveedorNombre: string;
  nombrePasajero: string;
  referenciaProvCte: string;
  importePendiente: number;
  importeVinculado: number;
  fechaVencto: string | null;
  vinculado: boolean;
  completo: boolean;
}

export interface FiltrosBusquedaPagoOfi {
  expediente?: string;
  proveedor?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

const LIMITE_BUSQUEDA_PAGOS_OFI = 100;

/**
 * Pagos OFI filtrados libremente por expediente, proveedor y/o rango de
 * fecha de vencimiento, para el selector del modal de "Conciliar
 * manualmente" en /banco: permite elegir el pago OFI real en vez de dejar
 * el expediente como texto libre sin vínculo (que antes no tocaba ofi_pagos
 * en absoluto). Incluye la suma ya vinculada para permitir repartir un
 * mismo pago entre varios movimientos bancarios (ej. 264,08€ pagados en dos
 * transferencias de 132,04€) sin superar su importe. Exige al menos un
 * filtro para no traer toda la tabla.
 */
export async function buscarPagosOfi(filtros: FiltrosBusquedaPagoOfi): Promise<PagoOfiBusqueda[]> {
  const expediente = filtros.expediente?.trim();
  const proveedor = filtros.proveedor?.trim();
  const fechaDesde = filtros.fechaDesde?.trim();
  const fechaHasta = filtros.fechaHasta?.trim();
  if (!expediente && !proveedor && !fechaDesde && !fechaHasta) return [];

  const agencyDb = await getAgencyDbClient();
  let query = agencyDb
    .from("ofi_pagos")
    .select("id, documento, proveedor_nombre, nombre_pasajero, referencia_prov_cte, importe_pendiente, fecha_vencto, movimiento_banco_id, movimientos_banco_ids")
    .order("fecha_vencto", { ascending: false })
    .limit(LIMITE_BUSQUEDA_PAGOS_OFI);

  if (expediente) query = query.eq("referencia_prov_cte", expediente);
  if (proveedor) query = query.ilike("proveedor_nombre", `%${proveedor}%`);
  if (fechaDesde) query = query.gte("fecha_vencto", fechaDesde);
  if (fechaHasta) query = query.lte("fecha_vencto", fechaHasta);

  const { data, error } = await query;
  if (error) throw error;

  // movimiento_banco_id puede estar relleno sin que movimientos_banco_ids lo
  // incluya (vínculos hechos antes de que existiera el array, o por otras
  // vías como el matching automático o el modal de búsqueda de
  // movimientos-ofiviaje, que solo escriben la columna singular).
  const idsVinculadosPorPago = new Map<string, string[]>();
  for (const p of data ?? []) {
    const ids = new Set<string>(Array.isArray(p.movimientos_banco_ids) ? p.movimientos_banco_ids : []);
    if (p.movimiento_banco_id) ids.add(p.movimiento_banco_id);
    if (ids.size > 0) idsVinculadosPorPago.set(p.id, [...ids]);
  }
  const todosLosIds = [...new Set([...idsVinculadosPorPago.values()].flat())];
  const importePorMovimiento = new Map<string, number>();
  if (todosLosIds.length > 0) {
    const { data: movimientos, error: e2 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, importe")
      .in("id", todosLosIds);
    if (e2) throw e2;
    for (const m of movimientos ?? []) importePorMovimiento.set(m.id, Math.abs(Number(m.importe)));
  }

  return (data ?? []).map((p: any) => {
    const idsVinculados: string[] = idsVinculadosPorPago.get(p.id) ?? [];
    const importeVinculado = idsVinculados.reduce((sum, id) => sum + (importePorMovimiento.get(id) ?? 0), 0);
    const importePendiente = Number(p.importe_pendiente);
    return {
      id: p.id,
      documento: p.documento,
      proveedorNombre: p.proveedor_nombre || "",
      nombrePasajero: p.nombre_pasajero || "",
      referenciaProvCte: p.referencia_prov_cte || "",
      importePendiente,
      importeVinculado,
      fechaVencto: p.fecha_vencto,
      vinculado: !!p.movimiento_banco_id || idsVinculados.length > 0,
      completo: importeVinculado - Math.abs(importePendiente) > -TOLERANCIA_IMPORTE,
    };
  });
}

/**
 * Recalcula el estado de un movimiento bancario a partir de los pagos OFI
 * que tiene vinculados (columna singular movimiento_banco_id de ofi_pagos, o
 * el array movimientos_banco_ids para el caso de reparto). Igual que
 * recalcularEstadoMovimientoBanco (conciliación manual normal): si la suma
 * de los pagos OFI vinculados no cubre el importe del movimiento, queda
 * "parcial" en vez de "conciliado", para poder seguir completándolo con más
 * vínculos.
 */
async function recalcularEstadoMovimientoBancoPorOfi(agencyDb: any, movimientoBancoId: string): Promise<"conciliado" | "parcial"> {
  const { data: banco, error: e1 } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("importe")
    .eq("id", movimientoBancoId)
    .single();
  if (e1) throw e1;

  const { data: pagosVinculados, error: e2 } = await agencyDb
    .from("ofi_pagos")
    .select("importe_pendiente")
    .or(`movimiento_banco_id.eq.${movimientoBancoId},movimientos_banco_ids.cs.["${movimientoBancoId}"]`);
  if (e2) throw e2;

  // Los pagos OFI con importe_pendiente negativo son reembolsos/devoluciones
  // y deben restar de la suma, no sumarse en valor absoluto.
  const totalOfiVinculado = (pagosVinculados ?? []).reduce((sum: number, p: any) => sum + Number(p.importe_pendiente || 0), 0);
  const importeMovimiento = Math.abs(Number(banco?.importe || 0));
  const nuevoEstado: "conciliado" | "parcial" = totalOfiVinculado + TOLERANCIA_IMPORTE >= importeMovimiento ? "conciliado" : "parcial";

  const { error: e3 } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .update({ estado: nuevoEstado, conciliado_at: nuevoEstado === "conciliado" ? new Date().toISOString() : null })
    .eq("id", movimientoBancoId);
  if (e3) throw e3;

  return nuevoEstado;
}

/**
 * Vincula de verdad un pago OFI concreto elegido en el modal de conciliación
 * manual: marca movimiento_banco_id en ofi_pagos y conciliado_externo en el
 * movimiento bancario, igual que hace el matching automático
 * (conciliarDesdeOfiPagos), para que quede recíproco en ambos sentidos.
 *
 * Soporta que un mismo pago OFI se reparta entre varios movimientos
 * bancarios (ej. un pago de 264,08€ pagado en dos transferencias de
 * 132,04€): cada vinculación se añade a movimientos_banco_ids en vez de
 * sobrescribir, siempre que la suma de los importes ya vinculados más el
 * nuevo no supere el importe_pendiente del pago (con tolerancia de 1
 * céntimo). movimiento_banco_id sigue apuntando al primer vínculo, para no
 * romper el código que aún lo lee como relación 1:1.
 *
 * El caso inverso (un movimiento bancario más grande que el pago OFI
 * vinculado, ej. 300€ de movimiento contra 100€ de pago OFI) se resuelve
 * dejando el movimiento en estado "parcial" hasta que la suma de todos los
 * pagos OFI vinculados a él cubra su importe — igual que ya hace la
 * conciliación manual normal (recalcularEstadoMovimientoBanco).
 *
 * Guarda también quién hizo el vínculo (vinculado_por/vinculado_en en
 * ofi_pagos), para poder mostrar en el tooltip del movimiento qué agente
 * conciló cada pago cuando hay varios (ej. un agente vincula 3 pagos de un
 * movimiento y otro agente los 2 restantes).
 */
export async function vincularPagoOfiDesdeConciliacionManual(pagoOfiId: string, movimientoBancoId: string, usuarioId?: string): Promise<void> {
  const agencyDb = await getAgencyDbClient();

  const { data: pago, error: e1 } = await agencyDb.from("ofi_pagos").select("*").eq("id", pagoOfiId).single();
  if (e1) throw e1;

  // movimiento_banco_id puede estar relleno sin que movimientos_banco_ids lo
  // incluya (vínculos hechos antes de que existiera el array, o por el
  // matching automático o el modal de búsqueda de movimientos-ofiviaje).
  const idsExistentesSet = new Set<string>(Array.isArray(pago.movimientos_banco_ids) ? pago.movimientos_banco_ids : []);
  if (pago.movimiento_banco_id) idsExistentesSet.add(pago.movimiento_banco_id);
  const idsExistentes = [...idsExistentesSet];
  if (idsExistentes.includes(movimientoBancoId)) return;

  // Solo se valida que la suma de movimientos bancarios no supere el pago
  // OFI cuando ese pago YA tenía algún vínculo previo (caso de reparto: un
  // pago OFI pagado en varias transferencias más pequeñas). Si es el primer
  // vínculo, un movimiento bancario mayor que el pago OFI es válido (caso
  // inverso: un movimiento grande recibe varios pagos OFI pequeños) — ese
  // caso lo gestiona recalcularEstadoMovimientoBancoPorOfi dejando el
  // movimiento en "parcial" hasta completarse, sin bloquear el vínculo.
  if (idsExistentes.length > 0) {
    const { data: movimientosVinculados, error: e2 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, importe")
      .in("id", [...idsExistentes, movimientoBancoId]);
    if (e2) throw e2;

    const sumaVinculada = (movimientosVinculados ?? []).reduce((sum: number, m: any) => sum + Math.abs(Number(m.importe)), 0);
    const importePago = Math.abs(Number(pago.importe_pendiente));
    if (sumaVinculada - importePago > TOLERANCIA_IMPORTE) {
      throw new Error(
        `La suma de los movimientos vinculados (${sumaVinculada.toFixed(2)}€) supera el importe del pago OFI (${importePago.toFixed(2)}€).`
      );
    }
  }

  const pagoOfiviaje = filaOfiPagoComoOfiviajePago(pago);

  // Obtener datos del usuario para guardar en histórico
  let usuarioNombre = "Usuario desconocido";
  if (usuarioId) {
    try {
      const { createAdminServiceClient } = await import("@/lib/supabaseServer");
      const adminServiceClient = createAdminServiceClient();
      const { data: usuario } = await adminServiceClient
        .from("usuarios")
        .select("nombre, apellidos")
        .eq("id", usuarioId)
        .maybeSingle();
      if (usuario) {
        usuarioNombre = `${usuario.nombre || ""} ${usuario.apellidos || ""}`.trim() || "Usuario desconocido";
      }
    } catch {
      // Si falla, usar el nombre por defecto
    }
  }

  // Construir registro para agregar al histórico
  const registroConciliacion = {
    id: pago.id,
    usuario_id: usuarioId || null,
    usuario_nombre: usuarioNombre,
    cantidad: Math.abs(Number(pago.importe_pendiente || 0)),
    fecha: new Date().toISOString(),
    vobo_dc: false,
    nota: null,
  };

  // Obtener histórico actual y agregar nuevo registro
  const { data: movBancoActual } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("conciliaciones_historico")
    .eq("id", movimientoBancoId)
    .maybeSingle();

  const historicoActual = Array.isArray(movBancoActual?.conciliaciones_historico)
    ? movBancoActual.conciliaciones_historico
    : [];
  const historicoNuevo = [...historicoActual, registroConciliacion];

  const { error: e3 } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .update({
      conciliado_externo: true,
      conciliado_externo_origen: "ofiviaje",
      conciliado_externo_en: new Date().toISOString(),
      conciliado_externo_datos: { ...pagoOfiviaje, _driveFileId: pago.drive_file_id },
      conciliaciones_historico: historicoNuevo,
    })
    .eq("id", movimientoBancoId);
  if (e3) throw e3;

  const nuevosIds = [...idsExistentes, movimientoBancoId];
  const { error: e4 } = await agencyDb
    .from("ofi_pagos")
    .update({
      movimiento_banco_id: pago.movimiento_banco_id || movimientoBancoId,
      movimientos_banco_ids: nuevosIds,
      importe_conciliado: Math.abs(Number(pago.importe_pendiente || 0)),
      vinculado_por: usuarioId || pago.vinculado_por || null,
      vinculado_en: new Date().toISOString(),
    })
    .eq("id", pagoOfiId);
  if (e4) throw e4;

  await recalcularEstadoMovimientoBancoPorOfi(agencyDb, movimientoBancoId);
}

/**
 * Vincula varios pagos OFI a la vez al mismo movimiento bancario (selección
 * múltiple del modal de conciliación manual), reutilizando
 * vincularPagoOfiDesdeConciliacionManual uno a uno para no duplicar la
 * lógica de validación/estado.
 */
export async function vincularPagosOfiDesdeConciliacionManual(pagoOfiIds: string[], movimientoBancoId: string, usuarioId?: string): Promise<void> {
  for (const pagoOfiId of pagoOfiIds) {
    await vincularPagoOfiDesdeConciliacionManual(pagoOfiId, movimientoBancoId, usuarioId);
  }
}

/**
 * Igual que vincularPagoOfiDesdeConciliacionManual pero para ofi_cobros —
 * usada desde el modal de detalle de conciliación (pestaña "Sin
 * desambiguar") para vincular manualmente uno de los movimientos candidatos
 * empatados que el matching automático no pudo elegir por sí solo.
 */
export async function vincularCobroOfiDesdeConciliacionManual(cobroOfiId: string, movimientoBancoId: string, usuarioId?: string): Promise<void> {
  const agencyDb = await getAgencyDbClient();

  const { data: cobro, error: e1 } = await agencyDb.from("ofi_cobros").select("*").eq("id", cobroOfiId).single();
  if (e1) throw e1;

  const idsExistentesSet = new Set<string>(Array.isArray(cobro.movimientos_banco_ids) ? cobro.movimientos_banco_ids : []);
  if (cobro.movimiento_banco_id) idsExistentesSet.add(cobro.movimiento_banco_id);
  const idsExistentes = [...idsExistentesSet];
  if (idsExistentes.includes(movimientoBancoId)) return;

  if (idsExistentes.length > 0) {
    const { data: movimientosVinculados, error: e2 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, importe")
      .in("id", [...idsExistentes, movimientoBancoId]);
    if (e2) throw e2;

    const sumaVinculada = (movimientosVinculados ?? []).reduce((sum: number, m: any) => sum + Math.abs(Number(m.importe)), 0);
    const importeCobro = Math.abs(Number(cobro.importe_cobro));
    if (sumaVinculada - importeCobro > TOLERANCIA_IMPORTE) {
      throw new Error(
        `La suma de los movimientos vinculados (${sumaVinculada.toFixed(2)}€) supera el importe del cobro OFI (${importeCobro.toFixed(2)}€).`
      );
    }
  }

  const cobroOfiviaje = filaOfiCobroComoOfiviajePago(cobro);

  const { error: e3 } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .update({
      conciliado_externo: true,
      conciliado_externo_origen: "ofiviaje",
      conciliado_externo_en: new Date().toISOString(),
      conciliado_externo_datos: { ...cobroOfiviaje, _driveFileId: cobro.drive_file_id },
    })
    .eq("id", movimientoBancoId);
  if (e3) throw e3;

  const nuevosIds = [...idsExistentes, movimientoBancoId];
  const { error: e4 } = await agencyDb
    .from("ofi_cobros")
    .update({
      movimiento_banco_id: cobro.movimiento_banco_id || movimientoBancoId,
      movimientos_banco_ids: nuevosIds,
      importe_conciliado: Math.abs(Number(cobro.importe_cobro || 0)),
      vinculado_por: usuarioId || cobro.vinculado_por || null,
      vinculado_en: new Date().toISOString(),
    })
    .eq("id", cobroOfiId);
  if (e4) throw e4;

  await recalcularEstadoMovimientoBancoPorOfi(agencyDb, movimientoBancoId);
}

// yyyy-mm-dd (formato BD) -> dd/mm/yyyy (formato que esperan coincide()/
// desambiguarCandidato() de ofiviajeMatch.ts, pensadas para OfiviajePago tal
// como sale del XML).
function fechaBdAFormatoXml(fecha: string | null): string {
  if (!fecha) return "";
  const [yyyy, mm, dd] = fecha.split("-");
  return dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : "";
}

function filaOfiPagoComoOfiviajePago(fila: any): OfiviajePago {
  const fechaVencto = fechaBdAFormatoXml(fila.fecha_vencto);
  const fechaDoc = fechaBdAFormatoXml(fila.fecha_doc);
  return {
    documento: fila.documento,
    fechaVencto: fechaVencto || fechaDoc,
    fechaDoc: fechaDoc || fechaVencto,
    referenciaProvCte: fila.referencia_prov_cte || "",
    documentoCobroPago: fila.documento_cobro_pago || "",
    tipoOperacion: fila.tipo_operacion || "",
    cuentaTesoreria: fila.cuenta_tesoreria || "",
    nombrePasajero: fila.nombre_pasajero || "",
    apunte: fila.apunte || "",
    importePendiente: Number(fila.importe_pendiente),
    situacion: fila.situacion || "",
    proveedorNombre: fila.proveedor_nombre || "",
    proveedorCuentaContable: fila.proveedor_cuenta_contable || "",
  };
}

export interface DetalleSincronizado {
  documento: string;
  proveedorNombre: string;
  movimientoBancoId: string;
}

export interface DetalleConciliado {
  documento: string;
  proveedorNombre: string;
  nombrePasajero: string;
  importe: number;
  fechaVencto: string;
  referenciaProvCte: string;
  documentoCobroPago: string;
  movimientoBancoId: string;
  movimientoConcepto: string;
  movimientoFecha: string;
  movimientoImporte: number;
}

export interface CandidatoEmpatado {
  movimientoBancoId: string;
  movimientoConcepto: string;
  movimientoFecha: string;
  movimientoImporte: number;
}

export interface DetalleRevisado {
  id: string;
  tipo: "pago" | "cobro";
  documento: string;
  proveedorNombre: string;
  nombrePasajero: string;
  importe: number;
  fechaVencto: string;
  referenciaProvCte: string;
  documentoCobroPago: string;
  candidatos: CandidatoEmpatado[];
}

export interface ConciliarDesdeOfiResultado {
  pagosConciliados: number;
  pagosRevisados: number;
  idsPagosRevisados: string[];
  pagosSincronizados: number;
  detalleSincronizados: DetalleSincronizado[];
  detalleConciliados: DetalleConciliado[];
  detalleRevisados: DetalleRevisado[];
}

/**
 * Alinea ofi_pagos.movimiento_banco_id con la fuente de verdad real de la
 * conciliación: contabilidad_movimientos_banco.conciliado_externo_datos,
 * guardado en el momento en que el matching (clásico desde XML, o este mismo
 * flujo) concilió cada movimiento. Bidireccional: corrige tanto los que
 * tenían el campo vacío (nunca se sincronizó) como los que apuntaban a un
 * movimiento distinto — típicamente un cruce dejado por el backfill fuzzy
 * antiguo (vincularMovimientosOfiConBanco), que asignaba por importe+fecha
 * sin desambiguar por código/nombre y podía acertar el documento equivocado
 * de un par. "documento" es único por oficina en ofi_pagos, así que basta
 * como clave (no se compara "apunte": puede quedar guardado con o sin ceros
 * a la izquierda según el momento en que se conciliara, ej. "116918" vs
 * "00116918" del mismo apunte contable real).
 */
async function sincronizarVinculosYaConciliados(agencyDb: any): Promise<{ sincronizados: number; detalle: DetalleSincronizado[] }> {
  // Paginado explícitamente: sin .range(), Supabase corta silenciosamente en
  // 1000 filas, y el número de movimientos conciliados por OFIviaje crece
  // con el tiempo.
  const movimientosConciliados: any[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: pagina, error } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, conciliado_externo_datos")
      .eq("conciliado_externo", true)
      .eq("conciliado_externo_origen", "ofiviaje")
      .not("conciliado_externo_datos", "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!pagina || pagina.length === 0) break;
    movimientosConciliados.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  if (movimientosConciliados.length === 0) return { sincronizados: 0, detalle: [] };

  const movimientoIdPorDocumento = new Map<string, string>();
  const proveedorPorDocumento = new Map<string, string>();
  for (const mov of movimientosConciliados) {
    const documento = mov.conciliado_externo_datos?.documento;
    if (documento) {
      movimientoIdPorDocumento.set(documento, mov.id);
      proveedorPorDocumento.set(documento, mov.conciliado_externo_datos?.proveedorNombre || "");
    }
  }
  if (movimientoIdPorDocumento.size === 0) return { sincronizados: 0, detalle: [] };

  const { data: pagosExistentes, error: e2 } = await agencyDb
    .from("ofi_pagos")
    .select("id, documento, movimiento_banco_id")
    .in("documento", Array.from(movimientoIdPorDocumento.keys()));
  if (e2) throw e2;

  let sincronizados = 0;
  const detalle: DetalleSincronizado[] = [];
  for (const pago of pagosExistentes ?? []) {
    const movimientoIdCorrecto = movimientoIdPorDocumento.get(pago.documento);
    if (!movimientoIdCorrecto || pago.movimiento_banco_id === movimientoIdCorrecto) continue;

    const { error: updateError } = await agencyDb
      .from("ofi_pagos")
      .update({ movimiento_banco_id: movimientoIdCorrecto })
      .eq("id", pago.id);
    if (!updateError) {
      sincronizados++;
      detalle.push({
        documento: pago.documento,
        proveedorNombre: proveedorPorDocumento.get(pago.documento) || "",
        movimientoBancoId: movimientoIdCorrecto,
      });
    }
  }

  return { sincronizados, detalle };
}

/**
 * Concilia de verdad (marca conciliado_externo=true en el movimiento
 * bancario) a partir de lo que ya está en ofi_pagos, sin releer los XML de
 * Drive — a diferencia de "Procesar archivos" (historial-procesos), que
 * siempre relee el XML. Útil para comprobar el efecto de cambios en la
 * lógica de matching sin depender de que Drive tenga los mismos ficheros.
 *
 * Antes de buscar matches nuevos, sincroniza también los que ya estaban
 * conciliados por otra vía pero a los que aún les faltaba el vínculo en
 * ofi_pagos (ver sincronizarVinculosYaConciliados).
 *
 * Reutiliza exactamente coincide()/desambiguarCandidato() de
 * ofiviajeMatch.ts, así que el criterio de desambiguación (código LOC con o
 * sin prefijo, nombre de proveedor) es idéntico al que aplica el matching
 * automático desde XML.
 *
 * Variante para el cron (multi-agencia, sin sesión de usuario): recibe
 * agencyDb ya resuelto en vez de leerlo de la sesión actual.
 */
export async function conciliarDesdeOfiPagosParaAgencia(agencyDb: any): Promise<ConciliarDesdeOfiResultado> {
  const { sincronizados: pagosSincronizados, detalle: detalleSincronizados } = await sincronizarVinculosYaConciliados(agencyDb);
  const vacio: ConciliarDesdeOfiResultado = {
    pagosConciliados: 0,
    pagosRevisados: 0,
    idsPagosRevisados: [],
    pagosSincronizados,
    detalleSincronizados,
    detalleConciliados: [],
    detalleRevisados: [],
  };

  const { data: pagosSinVincular, error: e1 } = await agencyDb
    .from("ofi_pagos")
    .select("*")
    .is("movimiento_banco_id", null);
  if (e1) throw e1;
  if (!pagosSinVincular || pagosSinVincular.length === 0) return vacio;

  const pagos: OfiviajePago[] = pagosSinVincular.map(filaOfiPagoComoOfiviajePago);
  const filaPorPago = new Map(pagos.map((p, i) => [p, pagosSinVincular[i]]));

  const fechas = pagos
    .map((p) => parseOfiviajeFecha(p.fechaVencto) || parseOfiviajeFecha(p.fechaDoc))
    .filter((f): f is string => !!f);
  const fechaMasAntigua = fechas.length > 0 ? fechas.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString().slice(0, 10);
  const fecha = new Date(fechaMasAntigua);
  fecha.setMonth(fecha.getMonth() - 1);
  const fechaMinimaBusqueda = fecha.toISOString().slice(0, 10);

  // Acotar el pool de movimientos candidatos solo a las cuentas bancarias que
  // OFIviaje indica para estos pagos (CuentaTesoreria -> cuenta_bancaria_id),
  // igual que hace el matching clásico desde XML: reduce drásticamente el
  // volumen a comparar y evita falsos matches contra movimientos de otra
  // cuenta bancaria que nunca podrían ser el pago correcto.
  const mapaCuentaContable = await getMapaCuentaContable(agencyDb);
  const cuentaBancariaIds = [
    ...new Set(pagos.map((p) => mapaCuentaContable[p.cuentaTesoreria]).filter((id): id is string => !!id)),
  ];
  if (cuentaBancariaIds.length === 0) {
    return vacio;
  }

  // Sin filtro de signo en la query: un pago OFI normal (importePendiente>0)
  // conciliado contra un cargo del banco (importe<0), pero un pago negativo
  // (reembolso/devolución del proveedor) conciliado contra un ingreso del
  // banco (importe>0) — se filtra por signo opuesto abajo, por pago.
  //
  // Paginado explícitamente: sin .range(), Supabase corta silenciosamente en
  // 1000 filas, y aunque acotar por cuenta bancaria reduce mucho el pool,
  // sigue sin haber garantía de quedarse siempre por debajo de ese límite.
  const movimientos: any[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: pagina, error: e2 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, importe, fecha_operacion, fecha_valor, concepto_original, estado, conciliado_externo")
      .in("estado", ["pendiente", "propuesto", "parcial"])
      .eq("conciliado_externo", false)
      .in("cuenta_bancaria_id", cuentaBancariaIds)
      .neq("importe", 0)
      .gte("fecha_operacion", fechaMinimaBusqueda)
      .range(from, from + PAGE_SIZE - 1);
    if (e2) throw e2;
    if (!pagina || pagina.length === 0) break;
    movimientos.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  if (movimientos.length === 0) return vacio;

  const aliasPorProveedor = await getAliasProveedorPorAgencia(agencyDb);

  const movimientosConMatch = new Set<string>();
  const idsPagosRevisados = new Set<string>();
  const detalleRevisadosPorId = new Map<string, DetalleRevisado>();
  const detalleConciliados: DetalleConciliado[] = [];
  let pagosConciliados = 0;

  // Se itera por PAGO OFI (no por movimiento bancario): cuando dos
  // movimientos bancarios distintos coinciden en importe+fecha con el mismo
  // pago (ej. dos transferencias iguales al mismo proveedor con 12 días de
  // diferencia), hay que comparar ambos candidatos a la vez para quedarnos
  // con el que de verdad corresponde (LOC exacto, nombre, o fecha más
  // cercana) — iterando por movimiento el primero procesado se quedaría el
  // pago aunque el otro tuviera mejor señal.
  for (const pago of pagos) {
    const filaOrigen = filaPorPago.get(pago)!;
    const pagoEsIngreso = pago.importePendiente < 0;
    const candidatosPorImporteFecha = movimientos.filter(
      (mov) => !movimientosConMatch.has(mov.id) && (Number(mov.importe) > 0) === pagoEsIngreso && coincide(mov, pago)
    );
    if (candidatosPorImporteFecha.length === 0) continue;

    const movMatch = desambiguarMovimiento(pago, candidatosPorImporteFecha, aliasPorProveedor);
    if (!movMatch) {
      idsPagosRevisados.add(filaOrigen.id);
      detalleRevisadosPorId.set(filaOrigen.id, {
        id: filaOrigen.id,
        tipo: "pago",
        documento: pago.documento,
        proveedorNombre: pago.proveedorNombre,
        nombrePasajero: pago.nombrePasajero,
        importe: pago.importePendiente,
        fechaVencto: pago.fechaVencto,
        referenciaProvCte: pago.referenciaProvCte,
        documentoCobroPago: pago.documentoCobroPago,
        candidatos: candidatosPorImporteFecha.map((c) => ({
          movimientoBancoId: c.id,
          movimientoConcepto: c.concepto_original || "",
          movimientoFecha: c.fecha_operacion,
          movimientoImporte: Number(c.importe),
        })),
      });
      continue;
    }

    movimientosConMatch.add(movMatch.id);

    const { error: updateMovError } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({
        conciliado_externo: true,
        conciliado_externo_origen: "ofiviaje",
        conciliado_externo_en: new Date().toISOString(),
        conciliado_externo_datos: { ...pago, _driveFileId: filaOrigen.drive_file_id },
        estado: "conciliado",
      })
      .eq("id", movMatch.id);
    if (updateMovError) continue;

    await agencyDb.from("ofi_pagos").update({ movimiento_banco_id: movMatch.id }).eq("id", filaOrigen.id);
    idsPagosRevisados.delete(filaOrigen.id);
    detalleRevisadosPorId.delete(filaOrigen.id);
    detalleConciliados.push({
      documento: pago.documento,
      proveedorNombre: pago.proveedorNombre,
      nombrePasajero: pago.nombrePasajero,
      importe: pago.importePendiente,
      fechaVencto: pago.fechaVencto,
      referenciaProvCte: pago.referenciaProvCte,
      documentoCobroPago: pago.documentoCobroPago,
      movimientoBancoId: movMatch.id,
      movimientoConcepto: movMatch.concepto_original || "",
      movimientoFecha: movMatch.fecha_operacion,
      movimientoImporte: Number(movMatch.importe),
    });
    pagosConciliados++;
  }

  return {
    pagosConciliados,
    pagosRevisados: idsPagosRevisados.size,
    idsPagosRevisados: Array.from(idsPagosRevisados),
    pagosSincronizados,
    detalleSincronizados,
    detalleConciliados,
    detalleRevisados: Array.from(detalleRevisadosPorId.values()),
  };
}

/** Variante para la UI (usuario autenticado): resuelve agencyDb de la sesión actual. */
export async function conciliarDesdeOfiPagos(): Promise<ConciliarDesdeOfiResultado> {
  const agencyDb = await getAgencyDbClient();
  return conciliarDesdeOfiPagosParaAgencia(agencyDb);
}

// Adapta una fila de ofi_cobros (BD) al shape OfiviajePago para reutilizar
// coincide()/fechaCoincide()/nombreCoincide()/desambiguarMovimiento(), igual
// que cobroComoPago() hace con OfiviajeCobro recién parseado del XML. Sin
// LOC (documentoCobroPago vacío): la desambiguación cae directo a nombre del
// pagador y, si sigue empatado, a la fecha más cercana.
function filaOfiCobroComoOfiviajePago(fila: any): OfiviajePago {
  const fechaMovimiento = fechaBdAFormatoXml(fila.fecha_movimiento);
  return {
    documento: fila.factura || "",
    fechaVencto: fechaMovimiento,
    fechaDoc: fechaMovimiento,
    referenciaProvCte: fila.factura || "",
    documentoCobroPago: "",
    tipoOperacion: "",
    cuentaTesoreria: "",
    nombrePasajero: fila.nombre_pagador || "",
    apunte: "",
    importePendiente: Number(fila.importe_cobro),
    situacion: "",
    proveedorNombre: fila.nombre_pagador || "",
    proveedorCuentaContable: "",
  };
}

export interface ConciliarDesdeOfiCobrosResultado {
  cobrosConciliados: number;
  cobrosRevisados: number;
  idsCobrosRevisados: string[];
  detalleConciliados: DetalleConciliado[];
  detalleRevisados: DetalleRevisado[];
}

/**
 * Igual que conciliarDesdeOfiPagosParaAgencia pero para ofi_cobros: itera
 * por cobro (no por movimiento bancario) buscando candidatos por importe+
 * fecha entre TODAS las cuentas bancarias activas (los cobros no traen
 * CuentaTesoreria en el XML, a diferencia de los pagos), filtra por nombre
 * del pagador/alias y desambigua con desambiguarMovimiento() — sin código
 * LOC disponible, así que el criterio real es nombre y, si sigue empatado,
 * fecha más cercana. Si no hay un único candidato tras desambiguar, el
 * cobro queda sin conciliar (visible para revisión manual) en vez de
 * arriesgarse a vincular el movimiento equivocado — el mismo problema que
 * tenía el backfill fuzzy antiguo (vincularMovimientosOfiConBanco), que
 * indexaba solo por factura sin desempate y podía cruzar dos cobros de un
 * mismo cliente entre sí.
 */
export async function conciliarDesdeOfiCobrosParaAgencia(agencyDb: any): Promise<ConciliarDesdeOfiCobrosResultado> {
  const vacio: ConciliarDesdeOfiCobrosResultado = {
    cobrosConciliados: 0,
    cobrosRevisados: 0,
    idsCobrosRevisados: [],
    detalleConciliados: [],
    detalleRevisados: [],
  };

  const { data: cobrosSinVincular, error: e1 } = await agencyDb
    .from("ofi_cobros")
    .select("*")
    .is("movimiento_banco_id", null);
  if (e1) throw e1;
  if (!cobrosSinVincular || cobrosSinVincular.length === 0) return vacio;

  const cobros: OfiviajePago[] = cobrosSinVincular.map(filaOfiCobroComoOfiviajePago);
  const filaPorCobro = new Map(cobros.map((c, i) => [c, cobrosSinVincular[i]]));

  const fechas = cobros
    .map((c) => parseOfiviajeFecha(c.fechaVencto) || parseOfiviajeFecha(c.fechaDoc))
    .filter((f): f is string => !!f);
  const fechaMasAntigua = fechas.length > 0 ? fechas.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString().slice(0, 10);
  const fechaMinima = new Date(fechaMasAntigua);
  fechaMinima.setMonth(fechaMinima.getMonth() - 1);
  const fechaMinimaBusqueda = fechaMinima.toISOString().slice(0, 10);

  // Sin CuentaTesoreria en el XML de cobros: se busca en todas las cuentas
  // bancarias activas de la agencia, igual que calcularMatchesCobrosXmlContenido.
  const { data: cuentas, error: e2 } = await agencyDb.from("config_cuentas_bancarias").select("id").eq("activa", true);
  if (e2) throw e2;
  const cuentaBancariaIds = (cuentas ?? []).map((c: any) => c.id);
  if (cuentaBancariaIds.length === 0) return vacio;

  // Un cobro con importe negativo (devolución al cliente) debe conciliar
  // contra un movimiento de salida, no de entrada: sin filtro de signo en
  // la query, se filtra por signo opuesto abajo, por cobro.
  const movimientos: any[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: pagina, error: e3 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, importe, fecha_operacion, fecha_valor, concepto_original, estado, conciliado_externo")
      .in("estado", ["pendiente", "propuesto", "parcial"])
      .eq("conciliado_externo", false)
      .in("cuenta_bancaria_id", cuentaBancariaIds)
      .neq("importe", 0)
      .gte("fecha_operacion", fechaMinimaBusqueda)
      .range(from, from + PAGE_SIZE - 1);
    if (e3) throw e3;
    if (!pagina || pagina.length === 0) break;
    movimientos.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  if (movimientos.length === 0) return vacio;

  const aliasPorProveedor = await getAliasProveedorPorAgencia(agencyDb);

  const movimientosConMatch = new Set<string>();
  const idsCobrosRevisados = new Set<string>();
  const detalleRevisadosPorId = new Map<string, DetalleRevisado>();
  const detalleConciliados: DetalleConciliado[] = [];
  let cobrosConciliados = 0;

  for (const cobro of cobros) {
    const filaOrigen = filaPorCobro.get(cobro)!;
    const cobroEsSalida = cobro.importePendiente < 0;
    const candidatosPorImporteFecha = movimientos.filter(
      (mov) => !movimientosConMatch.has(mov.id) && (Number(mov.importe) < 0) === cobroEsSalida && coincide(mov, cobro)
    );
    if (candidatosPorImporteFecha.length === 0) continue;

    const movMatch = desambiguarMovimiento(cobro, candidatosPorImporteFecha, aliasPorProveedor);
    if (!movMatch) {
      idsCobrosRevisados.add(filaOrigen.id);
      detalleRevisadosPorId.set(filaOrigen.id, {
        id: filaOrigen.id,
        tipo: "cobro",
        documento: cobro.documento,
        proveedorNombre: cobro.proveedorNombre,
        nombrePasajero: "",
        importe: cobro.importePendiente,
        fechaVencto: cobro.fechaVencto,
        referenciaProvCte: cobro.referenciaProvCte,
        documentoCobroPago: cobro.documentoCobroPago,
        candidatos: candidatosPorImporteFecha.map((c) => ({
          movimientoBancoId: c.id,
          movimientoConcepto: c.concepto_original || "",
          movimientoFecha: c.fecha_operacion,
          movimientoImporte: Number(c.importe),
        })),
      });
      continue;
    }

    movimientosConMatch.add(movMatch.id);

    const { error: updateMovError } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({
        conciliado_externo: true,
        conciliado_externo_origen: "ofiviaje",
        conciliado_externo_en: new Date().toISOString(),
        conciliado_externo_datos: { ...cobro, _driveFileId: filaOrigen.drive_file_id },
        estado: "conciliado",
      })
      .eq("id", movMatch.id);
    if (updateMovError) continue;

    await agencyDb.from("ofi_cobros").update({ movimiento_banco_id: movMatch.id }).eq("id", filaOrigen.id);
    idsCobrosRevisados.delete(filaOrigen.id);
    detalleRevisadosPorId.delete(filaOrigen.id);
    detalleConciliados.push({
      documento: cobro.documento,
      proveedorNombre: cobro.proveedorNombre,
      nombrePasajero: "",
      importe: cobro.importePendiente,
      fechaVencto: cobro.fechaVencto,
      referenciaProvCte: cobro.referenciaProvCte,
      documentoCobroPago: cobro.documentoCobroPago,
      movimientoBancoId: movMatch.id,
      movimientoConcepto: movMatch.concepto_original || "",
      movimientoFecha: movMatch.fecha_operacion,
      movimientoImporte: Number(movMatch.importe),
    });
    cobrosConciliados++;
  }

  return {
    cobrosConciliados,
    cobrosRevisados: idsCobrosRevisados.size,
    idsCobrosRevisados: Array.from(idsCobrosRevisados),
    detalleConciliados,
    detalleRevisados: Array.from(detalleRevisadosPorId.values()),
  };
}

/** Variante para la UI (usuario autenticado): resuelve agencyDb de la sesión actual. */
export async function conciliarDesdeOfiCobros(): Promise<ConciliarDesdeOfiCobrosResultado> {
  const agencyDb = await getAgencyDbClient();
  return conciliarDesdeOfiCobrosParaAgencia(agencyDb);
}

export interface CandidatoRevision {
  pagoOfiId: string;
  documento: string;
  proveedorNombre: string;
  importePendiente: number;
  fechaVencto: string | null;
  movimientoBancoId: string;
  movimientoConcepto: string;
  movimientoFecha: string;
  movimientoImporte: number;
  coincidePorImporte: boolean;
  coincidePorNombre: boolean;
}

const TOLERANCIA_IMPORTE_REVISION = 0.01;
const TOLERANCIA_DIAS_REVISION = 30;

function diasEntreFechas(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

/**
 * Pestaña "Revisión": pares (pago OFI, movimiento bancario) que tienen una
 * coincidencia parcial pero no llegaron a conciliarse automáticamente —
 * importe exacto + fecha cercana (aunque el nombre no encaje, ej. el caso
 * Movelia/Air France que motivó exigir nombre incluso con 1 candidato), o
 * nombre de proveedor coincide + fecha cercana (aunque el importe difiera,
 * ej. reembolsos parciales o comisiones). Ninguno de los dos motivos por
 * separado basta para conciliar automático (por eso siguen pendientes), pero
 * sí merece mostrarlos como sugerencia para revisión manual.
 */
export async function getPagosPendientesDeRevision(): Promise<CandidatoRevision[]> {
  const agencyDb = await getAgencyDbClient();

  const { data: pagosSinVincular, error: e1 } = await agencyDb
    .from("ofi_pagos")
    .select("*")
    .is("movimiento_banco_id", null);
  if (e1) throw e1;
  if (!pagosSinVincular || pagosSinVincular.length === 0) return [];

  const mapaCuentaContable = await getMapaCuentaContable(agencyDb);
  const aliasPorProveedor = await getAliasProveedorPorAgencia(agencyDb);

  const cuentaBancariaIds = [
    ...new Set(pagosSinVincular.map((p: any) => mapaCuentaContable[p.cuenta_tesoreria]).filter((id: any): id is string => !!id)),
  ];
  if (cuentaBancariaIds.length === 0) return [];

  const movimientos: any[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: pagina, error: e2 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, importe, fecha_operacion, fecha_valor, concepto_original, estado, conciliado_externo")
      .in("estado", ["pendiente", "propuesto", "parcial"])
      .eq("conciliado_externo", false)
      .neq("importe", 0)
      .in("cuenta_bancaria_id", cuentaBancariaIds)
      .range(from, from + PAGE_SIZE - 1);
    if (e2) throw e2;
    if (!pagina || pagina.length === 0) break;
    movimientos.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  if (movimientos.length === 0) return [];

  const candidatos: CandidatoRevision[] = [];

  for (const filaPago of pagosSinVincular) {
    const pago = filaOfiPagoComoOfiviajePago(filaPago);
    const fechaXml = parseOfiviajeFecha(pago.fechaVencto) || parseOfiviajeFecha(pago.fechaDoc);
    if (!fechaXml) continue;

    for (const mov of movimientos) {
      const importeMov = Math.abs(Number(mov.importe));
      const coincideImporte = Math.abs(importeMov - Math.abs(pago.importePendiente)) <= TOLERANCIA_IMPORTE_REVISION;

      const fechasMov = [mov.fecha_operacion, mov.fecha_valor].filter(Boolean);
      const coincideFecha = fechasMov.some((f) => diasEntreFechas(fechaXml, f) <= TOLERANCIA_DIAS_REVISION);
      if (!coincideFecha) continue;

      const coincideNombre = nombreCoincide(mov, pago, aliasPorProveedor);

      // Al menos una de las dos señales (importe o nombre) además de la
      // fecha, pero no ambas — si coincidieran ambas, coincide()+desambiguarCandidato()
      // ya lo habría conciliado automáticamente en el flujo normal.
      const soloImporte = coincideImporte && !coincideNombre;
      const soloNombre = coincideNombre && !coincideImporte;
      if (!soloImporte && !soloNombre) continue;

      candidatos.push({
        pagoOfiId: filaPago.id,
        documento: pago.documento,
        proveedorNombre: pago.proveedorNombre,
        importePendiente: pago.importePendiente,
        fechaVencto: filaPago.fecha_vencto,
        movimientoBancoId: mov.id,
        movimientoConcepto: mov.concepto_original || "",
        movimientoFecha: mov.fecha_operacion,
        movimientoImporte: Number(mov.importe),
        coincidePorImporte: coincideImporte,
        coincidePorNombre: coincideNombre,
      });
    }
  }

  return candidatos;
}

export interface GrupoAgrupacion {
  proveedorNombre: string;
  fechaVencto: string | null;
  pagoIds: string[];
  documentos: string[];
  sumaImporte: number;
  movimientoBancoId: string;
  movimientoConcepto: string;
  movimientoFecha: string;
  movimientoImporte: number;
}

/**
 * Detecta agrupaciones: varios pagos OFI de un mismo proveedor y misma fecha
 * de vencimiento (ej. recibos de seguros AON, que llegan como N líneas
 * individuales en el XML pero se cobran juntos en un único cargo bancario
 * consolidado). Si la suma de un grupo coincide con el importe de un
 * movimiento bancario sin conciliar, se propone como candidato de grupo —
 * nunca se concilia automáticamente por el riesgo de agrupar mal, solo se
 * ofrece el botón para confirmar manualmente.
 */
export async function getGruposAgrupacionPendientes(): Promise<GrupoAgrupacion[]> {
  const agencyDb = await getAgencyDbClient();

  const { data: pagosSinVincular, error: e1 } = await agencyDb
    .from("ofi_pagos")
    .select("*")
    .is("movimiento_banco_id", null);
  if (e1) throw e1;
  if (!pagosSinVincular || pagosSinVincular.length < 2) return [];

  // Agrupar por proveedor normalizado + fecha_vencto exacta.
  const grupos = new Map<string, any[]>();
  for (const p of pagosSinVincular) {
    if (!p.fecha_vencto || !p.proveedor_nombre) continue;
    const clave = `${p.proveedor_nombre.trim().toUpperCase()}|${p.fecha_vencto}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(p);
  }

  const gruposConVarios = [...grupos.values()].filter((g) => g.length >= 2);
  if (gruposConVarios.length === 0) return [];

  const mapaCuentaContable = await getMapaCuentaContable(agencyDb);

  const cuentaBancariaIds = [
    ...new Set(pagosSinVincular.map((p: any) => mapaCuentaContable[p.cuenta_tesoreria]).filter((id: any): id is string => !!id)),
  ];
  if (cuentaBancariaIds.length === 0) return [];

  const movimientos: any[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: pagina, error: e2 } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, importe, fecha_operacion, fecha_valor, concepto_original")
      .in("estado", ["pendiente", "propuesto", "parcial"])
      .eq("conciliado_externo", false)
      .neq("importe", 0)
      .in("cuenta_bancaria_id", cuentaBancariaIds)
      .range(from, from + PAGE_SIZE - 1);
    if (e2) throw e2;
    if (!pagina || pagina.length === 0) break;
    movimientos.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  if (movimientos.length === 0) return [];

  const resultado: GrupoAgrupacion[] = [];

  for (const grupo of gruposConVarios) {
    const fechaXml = parseOfiviajeFecha(grupo[0].fecha_vencto);
    if (!fechaXml) continue;
    const sumaImporte = grupo.reduce((acc, p) => acc + Number(p.importe_pendiente), 0);

    const candidatos = movimientos.filter((mov) => {
      if (Math.abs(Math.abs(Number(mov.importe)) - Math.abs(sumaImporte)) > TOLERANCIA_IMPORTE_REVISION) return false;
      const fechasMov = [mov.fecha_operacion, mov.fecha_valor].filter(Boolean);
      return fechasMov.some((f) => diasEntreFechas(fechaXml, f) <= TOLERANCIA_DIAS_REVISION);
    });
    // Ambigüedad entre movimientos: no se propone si hay más de un candidato.
    if (candidatos.length !== 1) continue;

    resultado.push({
      proveedorNombre: grupo[0].proveedor_nombre,
      fechaVencto: grupo[0].fecha_vencto,
      pagoIds: grupo.map((p) => p.id),
      documentos: grupo.map((p) => p.documento),
      sumaImporte,
      movimientoBancoId: candidatos[0].id,
      movimientoConcepto: candidatos[0].concepto_original || "",
      movimientoFecha: candidatos[0].fecha_operacion,
      movimientoImporte: Number(candidatos[0].importe),
    });
  }

  return resultado;
}

/**
 * Concilia de golpe un grupo de agrupación: marca conciliado_externo=true en
 * el movimiento bancario (con conciliado_externo_datos apuntando al primer
 * pago del grupo como referencia, ya que un único movimiento no puede
 * apuntar a N documentos a la vez en ese campo) y vincula movimiento_banco_id
 * en los N registros de ofi_pagos del grupo.
 */
export async function conciliarGrupoAgrupacion(pagoIds: string[], movimientoBancoId: string): Promise<void> {
  const agencyDb = await getAgencyDbClient();

  const { data: primerPago, error: e1 } = await agencyDb.from("ofi_pagos").select("*").eq("id", pagoIds[0]).single();
  if (e1) throw e1;

  const pago = filaOfiPagoComoOfiviajePago(primerPago);
  const { error: e2 } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .update({
      conciliado_externo: true,
      conciliado_externo_origen: "ofiviaje",
      conciliado_externo_en: new Date().toISOString(),
      conciliado_externo_datos: { ...pago, _agrupacion: pagoIds.length, _driveFileId: primerPago.drive_file_id },
      estado: "conciliado",
    })
    .eq("id", movimientoBancoId);
  if (e2) throw e2;

  const { error: e3 } = await agencyDb.from("ofi_pagos").update({ movimiento_banco_id: movimientoBancoId }).in("id", pagoIds);
  if (e3) throw e3;
}
