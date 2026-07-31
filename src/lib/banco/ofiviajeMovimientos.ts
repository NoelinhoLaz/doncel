import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { getDriveTokensUsuarioActual, listarXmlEnCarpeta, descargarContenidoXml } from "./ofiviajeDrive";
import { parseOfiviajePagosXml, parseOfiviajeCobrosXml, parseOfiviajeFecha, parseOfiviajeFechaCorta } from "./ofiviajeParser";

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
 */
export async function descargarMovimientosOfiviaje(): Promise<DescargaOfiviajeResultado> {
  const tokens = await getDriveTokensUsuarioActual();
  const agencyDb = await getAgencyDbClient();
  const oficinaId = await resolverOficinaIdUsuarioActual(agencyDb);

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

      const { data, error } = await agencyDb
        .from("ofi_pagos")
        .upsert(filas, {
          onConflict: "oficina_id,documento,apunte",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw error;
      pagosInsertados += data?.length ?? 0;
    }
  }

  return { ficherosLeidos: ficheros.length, pagosInsertados, cobrosInsertados };
}

/**
 * Añade a cada fila `movimiento_banco` con los datos del movimiento bancario
 * vinculado (para el tooltip del listado), consultando aparte en vez de vía
 * embed de Supabase para no depender del nombre de la FK auto-generada.
 */
async function adjuntarMovimientoBanco<T extends { movimiento_banco_id: string | null }>(
  agencyDb: any,
  filas: T[]
): Promise<(T & { movimiento_banco: any | null })[]> {
  const ids = [...new Set(filas.map((f) => f.movimiento_banco_id).filter((id): id is string => !!id))];
  if (ids.length === 0) return filas.map((f) => ({ ...f, movimiento_banco: null }));

  const { data: movimientos } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, concepto_original, fecha_operacion, importe")
    .in("id", ids);

  const porId = new Map((movimientos ?? []).map((m: any) => [m.id, m]));
  return filas.map((f) => ({ ...f, movimiento_banco: f.movimiento_banco_id ? porId.get(f.movimiento_banco_id) ?? null : null }));
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
