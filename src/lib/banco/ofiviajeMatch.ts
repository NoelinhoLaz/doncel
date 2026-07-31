import nodemailer from "nodemailer";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { parseOfiviajePagosXml, parseOfiviajeCobrosXml, parseOfiviajeFecha, parseOfiviajeFechaCorta, type OfiviajePago, type OfiviajeCobro } from "./ofiviajeParser";
import {
  listarXmlEnCarpeta,
  descargarContenidoXml,
  getDriveTokensUsuarioActual,
  type DriveTokens,
} from "./ofiviajeDrive";
import { getCurrentUserEmailConfig, getUserEmailConfigById } from "@/actions/usuarios";
import { verifyToken } from "@/lib/encryption";

// Alineado con la ventana de búsqueda dinámica (1 mes antes del vencimiento
// más antiguo del XML): la tarjeta puede cargarse en el banco varias semanas
// antes de que OFIviaje registre el vencimiento contable del pago.
const TOLERANCIA_DIAS = 30;
const TOLERANCIA_IMPORTE = 0.01;
// Tolerancia para proponer "revisar importe": proveedor y fecha coinciden pero
// el importe difiere ligeramente (ajustes, comisiones, redondeos del origen).
const TOLERANCIA_IMPORTE_REVISION_PCT = 0.01; // 1%

/**
 * Los movimientos bancarios pueden haberse cargado semanas antes de que
 * OFIviaje registre el vencimiento del pago (ej. cargo en junio, vencimiento
 * en julio). Se calcula dinámicamente 1 mes antes de la fecha de vencimiento
 * más antigua del propio XML, en vez de usar una fecha fija.
 */
function calcularFechaMinimaBusqueda(pagos: OfiviajePago[]): string {
  const fechas = pagos
    .map((p) => parseOfiviajeFecha(p.fechaVencto) || parseOfiviajeFecha(p.fechaDoc))
    .filter((f): f is string => !!f);

  const fechaMasAntigua = fechas.length > 0 ? fechas.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString().slice(0, 10);

  const fecha = new Date(fechaMasAntigua);
  fecha.setMonth(fecha.getMonth() - 1);
  return fecha.toISOString().slice(0, 10);
}

function diasEntre(fechaA: string, fechaB: string): number {
  const a = new Date(fechaA).getTime();
  const b = new Date(fechaB).getTime();
  return Math.abs(a - b) / 86400000;
}

export function fechaCoincide(movimiento: any, pago: OfiviajePago): boolean {
  const fechaXml = parseOfiviajeFecha(pago.fechaVencto);
  if (!fechaXml) return false;
  const fechasMov = [movimiento.fecha_operacion, movimiento.fecha_valor].filter(Boolean);

  return fechasMov.some((fMov) => diasEntre(fechaXml, fMov) <= TOLERANCIA_DIAS);
}

export function coincide(movimiento: any, pago: OfiviajePago): boolean {
  const importeMov = Math.abs(Number(movimiento.importe));
  if (Math.abs(importeMov - pago.importePendiente) > TOLERANCIA_IMPORTE) return false;
  return fechaCoincide(movimiento, pago);
}

/**
 * Importe ligeramente distinto (fuera de TOLERANCIA_IMPORTE pero dentro de un
 * % razonable) con fecha coincidente: candidato a "revisar importe" en vez de
 * conciliar automáticamente.
 */
function coincideImporteAproximado(movimiento: any, pago: OfiviajePago): boolean {
  const importeMov = Math.abs(Number(movimiento.importe));
  const diff = Math.abs(importeMov - pago.importePendiente);
  if (diff <= TOLERANCIA_IMPORTE) return false; // ya es un match exacto, no aproximado
  const maxDiffPermitida = Math.max(pago.importePendiente, importeMov) * TOLERANCIA_IMPORTE_REVISION_PCT;
  if (diff > maxDiffPermitida) return false;
  return fechaCoincide(movimiento, pago);
}

// En el concepto bancario el código de localizador a veces viene precedido
// de "LOC" (ej. "Locvg2133"), pero no siempre: también aparece "pelado" como
// palabra suelta en el texto libre (ej. "RUMANIA 187 - MB2SQW - 15 AGOSTO").
// En OFIviaje el mismo código aparece en el campo Doc. cobro/pago (ej.
// "VG2133", "MB2SQW"). En vez de exigir el prefijo "LOC", se busca si el
// código de Doc. cobro/pago (normalizado, alfanumérico) aparece como token
// completo en cualquier parte del concepto bancario — con longitud mínima de
// 5 para evitar falsos positivos con números cortos (importes, referencias
// genéricas) que coincidan por casualidad.
const REGEX_CODIGO_LOC = /LOC\s?-?\s?([A-Z0-9]{3,})/i;

function extraerCodigoLoc(texto: string): string | null {
  const m = (texto || "").match(REGEX_CODIGO_LOC);
  return m ? m[1].toUpperCase() : null;
}

function normalizarCodigo(texto: string): string {
  return (texto || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function codigoLocCoincide(movimiento: any, pago: OfiviajePago): boolean {
  const concepto = movimiento.concepto_original || "";
  const codigoPago = normalizarCodigo(pago.documentoCobroPago || "");
  if (!codigoPago) return false;

  // 1. Caso con prefijo "LOC" explícito (más específico, se prueba primero).
  const codigoConcepto = extraerCodigoLoc(concepto);
  if (codigoConcepto && codigoConcepto === codigoPago) return true;

  // 2. Fallback: el código de Doc. cobro/pago aparece como palabra suelta en
  // el concepto, sin prefijo "LOC". Solo para códigos de 5+ caracteres para
  // evitar coincidir con números cortos genéricos (importes, últimos dígitos
  // de tarjeta, etc.) que aparecen mucho en los conceptos bancarios.
  if (codigoPago.length >= 5) {
    const tokensConcepto = concepto
      .toUpperCase()
      .split(/[\s,.\-_/;:!?]+/)
      .map((t: string) => t.replace(/[^A-Z0-9]/g, ""));
    if (tokensConcepto.includes(codigoPago)) return true;
  }

  return false;
}

/**
 * Cuando varios pagos/cobros del XML coinciden en importe+fecha para el
 * mismo movimiento bancario (mismo proveedor y hasta mismo expediente, pero
 * documento distinto; o mismo importe/fecha con proveedores distintos), no
 * hay garantía de que el primero del array sea el correcto — el banco no
 * dice a qué documento OFI corresponde un cargo. Se desambigua en cascada:
 * 1. Código de localizador del concepto bancario vs Doc. cobro/pago del XML
 *    (señal más fuerte: es specific al documento, no solo al proveedor).
 * 2. Coincidencia de nombre de proveedor/pagador.
 * Si tras ambos pasos sigue habiendo más de un candidato empatado, no se
 * elige ninguno a ciegas: se devuelve null para que el movimiento quede sin
 * match automático (visible como pendiente/revisar en vez de conciliado con
 * un documento que podría no ser el correcto).
 */
/**
 * Clave de agrupación para "cargos idénticos": importe absoluto (redondeado
 * a céntimos) + fecha exacta. Se usa tanto para el movimiento bancario
 * (fecha_operacion) como para el pago OFI (fechaVencto, con fallback a
 * fechaDoc) — son casos donde fechaCoincide() ya exige coincidencia dentro
 * de tolerancia, pero aquí se agrupa por el día exacto del movimiento para
 * no mezclar cargos de días distintos en el mismo lote de "da igual cuál".
 */
function claveImporteFecha(importe: number, fecha: string | null): string | null {
  if (!fecha) return null;
  return `${Math.round(Math.abs(importe) * 100)}|${fecha}`;
}

/**
 * Empareja por orden de aparición los movimientos y pagos que quedaron sin
 * resolver por coincide()+desambiguarCandidato() pero comparten importe y
 * fecha exactos con más de un candidato de cada lado (cargos idénticos: no
 * hay ninguna señal en el concepto que permita saber cuál-con-cuál). Se
 * concilia hasta el mínimo de cada grupo; el resto queda sin match.
 */
function emparejarGruposEmpatadosPorOrden(
  movimientos: any[],
  pagos: OfiviajePago[],
  pagosConMatch: Set<OfiviajePago>,
  matches: OfiviajeMatchPropuesto[],
  fichero: { id: string; nombre: string; modifiedTime: string }
): void {
  const movimientosSinMatch = movimientos.filter((mov: any) => !matches.some((m) => m.movimientoId === mov.id));
  // Solo pagos con tarjeta (TipoOperacion "J" del XML): son los que generan
  // conceptos bancarios idénticos repetidos (mismo comercio/tarjeta, mismo
  // importe, mismo día). Las transferencias (tipo "N") sí suelen traer texto
  // libre distintivo (nombre del pagador, concepto) y quedan fuera de este
  // emparejamiento "a ciegas" — el volumen de colisión ahí es mucho menor y
  // el riesgo de emparejar mal no compensa.
  const pagosSinMatch = pagos.filter((p) => !pagosConMatch.has(p) && p.tipoOperacion === "J");
  if (movimientosSinMatch.length === 0 || pagosSinMatch.length === 0) return;

  const movimientosPorClave = new Map<string, any[]>();
  for (const mov of movimientosSinMatch) {
    const clave = claveImporteFecha(Number(mov.importe), mov.fecha_operacion);
    if (!clave) continue;
    (movimientosPorClave.get(clave) ?? movimientosPorClave.set(clave, []).get(clave)!).push(mov);
  }

  const pagosPorClave = new Map<string, OfiviajePago[]>();
  for (const pago of pagosSinMatch) {
    const fechaPago = parseOfiviajeFecha(pago.fechaVencto) || parseOfiviajeFecha(pago.fechaDoc);
    const clave = claveImporteFecha(pago.importePendiente, fechaPago);
    if (!clave) continue;
    (pagosPorClave.get(clave) ?? pagosPorClave.set(clave, []).get(clave)!).push(pago);
  }

  for (const [clave, movsGrupo] of movimientosPorClave) {
    const pagosGrupo = pagosPorClave.get(clave);
    // Solo cargos genuinamente indistinguibles: más de un candidato en al
    // menos un lado. Si hay exactamente 1 movimiento y 1 pago, ya lo habría
    // resuelto el bucle principal — llegar aquí con 1:1 sería un caso donde
    // coincide() falló por algún otro motivo, no aplica este emparejamiento.
    if (!pagosGrupo || movsGrupo.length < 2) continue;

    const n = Math.min(movsGrupo.length, pagosGrupo.length);
    for (let i = 0; i < n; i++) {
      const mov = movsGrupo[i];
      const pago = pagosGrupo[i];
      pagosConMatch.add(pago);
      matches.push({
        movimientoId: mov.id,
        movimientoImporte: Number(mov.importe),
        movimientoFecha: mov.fecha_operacion,
        movimientoConcepto: mov.concepto_original || "",
        pago,
        ficheroId: fichero.id,
        ficheroNombre: fichero.nombre,
        ficheroModifiedTime: fichero.modifiedTime,
      });
    }
  }
}

export function desambiguarCandidato(
  movimiento: any,
  candidatos: OfiviajePago[],
  aliasPorProveedor?: Map<string, string[]>
): OfiviajePago | null {
  if (candidatos.length === 1) return candidatos[0];

  const porLoc = candidatos.filter((p) => codigoLocCoincide(movimiento, p));
  if (porLoc.length === 1) return porLoc[0];

  const baseParaNombre = porLoc.length > 1 ? porLoc : candidatos;
  const porNombre = baseParaNombre.filter((p) => nombreCoincide(movimiento, p, aliasPorProveedor));
  if (porNombre.length === 1) return porNombre[0];

  return null;
}

const STOP_WORDS_NOMBRE = new Set([
  "sa", "sl", "sau", "slu", "sociedad", "anonima", "limitada", "compra",
  "internet", "en", "de", "la", "el", "los", "las", "y", "tarj", "tarjeta",
  "comision", "transferencia", "favor", "inmediata", "concepto", "pago", "referencia",
  "viajes", "viaje", "travel", "tours", "tour", "agencia", "agencias",
]);

function tokenizarNombre(texto: string): string[] {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[\s,.\-_/;:!?]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 2 && !STOP_WORDS_NOMBRE.has(t));
}

/**
 * Compara el concepto del movimiento bancario contra el nombre del proveedor
 * de OFIviaje: exige al menos un token compartido (ignorando genéricos tipo
 * SA/SL/tarjeta/comisión). Si no comparten ningún token, es señal de que el
 * proveedor está mal registrado en origen (Nego) — no se debe conciliar
 * automáticamente aunque importe y fecha coincidan.
 *
 * `aliasPorProveedor` recoge alias bancarios confirmados manualmente por el
 * usuario en conciliaciones anteriores (ej. proveedor OFI "Aerolíneas
 * Españolas S.A." con alias bancario "IBERIA"): si el concepto contiene un
 * alias conocido de este proveedor, se da por coincidente sin más. El alias
 * matchea por token exacto o por prefijo (ej. alias "RyanairE-Com" matchea
 * el token "ryanairecoma95qjr"), porque algunos comercios pegan un código de
 * reserva variable justo después del nombre sin separador.
 */
export function nombreCoincide(
  movimiento: any,
  pago: OfiviajePago,
  aliasPorProveedor?: Map<string, string[]>
): boolean {
  const tokensConcepto = new Set(tokenizarNombre(movimiento.concepto_original || ""));
  const tokensProveedor = tokenizarNombre(pago.proveedorNombre);
  if (tokensProveedor.length === 0) return true; // sin nombre de proveedor, no se puede evaluar: no bloquear

  if (tokensProveedor.some((t) => tokensConcepto.has(t))) return true;

  const alias = aliasPorProveedor?.get(pago.proveedorNombre.trim().toUpperCase()) || [];
  return alias.some((a) =>
    tokenizarNombre(a).some((aliasToken) =>
      [...tokensConcepto].some(
        (t) => t === aliasToken || (aliasToken.length >= 4 && t.startsWith(aliasToken))
      )
    )
  );
}

/**
 * Carga los alias proveedor OFI → nombre bancario confirmados por la agencia
 * (tabla ofiviaje_alias_proveedor), agrupados por proveedor.
 */
export async function getAliasProveedorPorAgencia(agencyDb: any): Promise<Map<string, string[]>> {
  const { data } = await agencyDb.from("ofiviaje_alias_proveedor").select("proveedor_ofi, alias_banco");
  const mapa = new Map<string, string[]>();
  for (const fila of data || []) {
    const key = (fila.proveedor_ofi || "").trim().toUpperCase();
    if (!key) continue;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(fila.alias_banco);
  }
  return mapa;
}

/**
 * Registra que el concepto bancario dado corresponde al proveedor OFI
 * indicado (ej. proveedor OFI "Aerolíneas Españolas S.A." con concepto
 * bancario "COMPRA IBERIA..."), para que futuros pagos del mismo proveedor
 * con ese mismo destinatario bancario concilien automáticamente. Se llama al
 * conciliar manualmente una tarea de "Proveedor distinto".
 */
export async function guardarAliasProveedorOfi(proveedorOfi: string, aliasBanco: string): Promise<void> {
  const proveedor = proveedorOfi.trim();
  const alias = aliasBanco.trim();
  if (!proveedor || !alias) return;

  const agencyDb = await getAgencyDbClient();
  await agencyDb.from("ofiviaje_alias_proveedor").upsert(
    { proveedor_ofi: proveedor, alias_banco: alias },
    { onConflict: "proveedor_ofi,alias_banco", ignoreDuplicates: true }
  );
}

/**
 * Registra en ofi_pagos/ofi_cobros a qué movimiento bancario quedó conciliado
 * cada registro OFI, usando su clave única (documento+apunte para pagos,
 * factura+fecha+pagador+importe para cobros). Best-effort: si la fila aún no
 * se descargó a estas tablas (no se ha usado "Descargar movimientos" en
 * /banco/movimientos-ofiviaje), no falla la conciliación en sí.
 */
async function vincularMovimientoBancoConRegistroOfi(agencyDb: any, match: OfiviajeMatchPropuesto): Promise<void> {
  try {
    if (match.cobroOriginal) {
      const c = match.cobroOriginal;
      const fechaMovimiento = parseOfiviajeFechaCorta(c.fechaMovimiento);
      await agencyDb
        .from("ofi_cobros")
        .update({ movimiento_banco_id: match.movimientoId })
        .eq("factura", c.factura)
        .eq("fecha_movimiento", fechaMovimiento)
        .eq("nombre_pagador", c.nombrePagador)
        .eq("importe_cobro", c.importeCobro);
    } else {
      await agencyDb
        .from("ofi_pagos")
        .update({ movimiento_banco_id: match.movimientoId })
        .eq("documento", match.pago.documento)
        .eq("apunte", match.pago.apunte);
    }
  } catch {
    // best-effort: no bloquea la conciliación si la tabla ofi_pagos/ofi_cobros
    // no tiene aún esa fila (fichero no descargado) o si falla el UPDATE.
  }
}

export interface OfiviajeMatchPropuesto {
  movimientoId: string;
  movimientoImporte: number;
  movimientoFecha: string;
  movimientoConcepto: string;
  pago: OfiviajePago;
  /** Presente solo cuando este match viene de un cobro (fichero TSRLiquidacionCajas_*), no de un pago. */
  cobroOriginal?: OfiviajeCobro;
  ficheroId: string;
  ficheroNombre: string;
  ficheroModifiedTime: string;
}

/**
 * Caso "revisar importe": mismo proveedor y fecha, pero el importe difiere
 * ligeramente (fuera de TOLERANCIA_IMPORTE, dentro de TOLERANCIA_IMPORTE_REVISION_PCT).
 * Nunca se concilia automáticamente.
 */
export interface OfiviajeRevisarImporte {
  movimientoId: string;
  movimientoImporte: number;
  movimientoFecha: string;
  movimientoConcepto: string;
  pago: OfiviajePago;
}

/**
 * Caso "suma de movimientos": dos movimientos bancarios cuya suma coincide
 * (dentro de tolerancia) con el importe de un único pago OFIviaje, y cuyo
 * concepto comparte el código de localizador con el pago. Solo se propone
 * para revisión manual, nunca se concilia automáticamente.
 */
export interface OfiviajeRevisarSuma {
  movimientoIds: [string, string];
  movimientoImportes: [number, number];
  movimientoFechas: [string, string];
  movimientoConceptos: [string, string];
  pago: OfiviajePago;
}

/**
 * Caso inverso a "revisar suma": un único movimiento bancario cuyo importe
 * coincide con la suma de 2+ pagos OFIviaje que comparten el mismo
 * documentoCobroPago (el banco cargó de una vez lo que OFI registró como
 * varios vencimientos separados). Solo se propone para revisión manual.
 */
export interface OfiviajeRevisarDivision {
  movimientoId: string;
  movimientoImporte: number;
  movimientoFecha: string;
  movimientoConcepto: string;
  pagos: OfiviajePago[];
}

/**
 * Mapea cuenta_contable (config_cuentas_bancarias) -> cuenta_bancaria_id,
 * para poder resolver a qué cuenta bancaria local corresponde cada
 * CuentaTesoreria del XML de OFIviaje, sin tener que barrer todos los
 * movimientos de la agencia.
 */
async function getMapaCuentaContable(agencyDb: any): Promise<Record<string, string>> {
  const { data, error } = await agencyDb
    .from("config_cuentas_bancarias")
    .select("id, cuenta_contable")
    .not("cuenta_contable", "is", null);

  if (error || !data) return {};

  const mapa: Record<string, string> = {};
  for (const cuenta of data) {
    if (cuenta.cuenta_contable) mapa[cuenta.cuenta_contable] = cuenta.id;
  }
  return mapa;
}

async function calcularMatchesXmlContenido(
  agencyDb: any,
  xmlContent: string,
  fichero: { id: string; nombre: string; modifiedTime: string }
): Promise<{
  procesados: number;
  matches: OfiviajeMatchPropuesto[];
  revisarNombre: OfiviajeMatchPropuesto[];
  revisarImporte: OfiviajeRevisarImporte[];
  revisarSuma: OfiviajeRevisarSuma[];
  revisarDivision: OfiviajeRevisarDivision[];
  sinMatch: OfiviajePago[];
  yaConciliados: number;
}> {
  const vacio = {
    procesados: 0,
    matches: [],
    revisarNombre: [],
    revisarImporte: [],
    revisarSuma: [],
    revisarDivision: [],
    sinMatch: [],
    yaConciliados: 0,
  };
  const pagos = parseOfiviajePagosXml(xmlContent);
  if (pagos.length === 0) return vacio;

  const fechaMinimaBusqueda = calcularFechaMinimaBusqueda(pagos);
  const mapaCuentaContable = await getMapaCuentaContable(agencyDb);
  const aliasPorProveedor = await getAliasProveedorPorAgencia(agencyDb);

  // Solo pagos (XML de OFIviaje en esta carpeta son siempre salidas/pagos, no ingresos):
  // los movimientos candidatos se restringen a importe negativo.
  const cuentaBancariaIds = [
    ...new Set(pagos.map((p) => mapaCuentaContable[p.cuentaTesoreria]).filter((id): id is string => !!id)),
  ];

  if (cuentaBancariaIds.length === 0) {
    return { ...vacio, procesados: pagos.length, sinMatch: pagos };
  }

  const { data: movimientos, error } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, importe, fecha_operacion, fecha_valor, concepto_original, estado, conciliado_externo")
    .in("estado", ["pendiente", "propuesto", "parcial"])
    .eq("conciliado_externo", false)
    .in("cuenta_bancaria_id", cuentaBancariaIds)
    .lt("importe", 0)
    .gte("fecha_operacion", fechaMinimaBusqueda);

  if (error || !movimientos) {
    return { ...vacio, procesados: pagos.length, sinMatch: pagos };
  }

  const matches: OfiviajeMatchPropuesto[] = [];
  const revisarNombre: OfiviajeMatchPropuesto[] = [];
  const revisarImporte: OfiviajeRevisarImporte[] = [];
  const pagosConMatch = new Set<OfiviajePago>();

  for (const mov of movimientos) {
    // Puede haber varios pagos del XML con el mismo importe+fecha
    // compitiendo por el mismo movimiento bancario (mismo proveedor con
    // documentos distintos, incluso mismo expediente, o proveedores
    // distintos con importes coincidentes). Se desambigua por código de
    // localizador y nombre; si sigue habiendo empate no se asigna a ciegas.
    const candidatosPorImporteFecha = pagos.filter((p) => !pagosConMatch.has(p) && coincide(mov, p));
    if (candidatosPorImporteFecha.length === 0) continue;
    const pagoMatch = desambiguarCandidato(mov, candidatosPorImporteFecha, aliasPorProveedor);
    if (!pagoMatch) continue;

    pagosConMatch.add(pagoMatch);
    const propuesta: OfiviajeMatchPropuesto = {
      movimientoId: mov.id,
      movimientoImporte: Number(mov.importe),
      movimientoFecha: mov.fecha_operacion,
      movimientoConcepto: mov.concepto_original || "",
      pago: pagoMatch,
      ficheroId: fichero.id,
      ficheroNombre: fichero.nombre,
      ficheroModifiedTime: fichero.modifiedTime,
    };

    // Importe y fecha coinciden, pero el nombre del proveedor en OFIviaje no se
    // parece al concepto bancario: probable dato mal registrado en origen (Nego).
    // No se propone conciliar automáticamente — se marca para revisión manual.
    if (nombreCoincide(mov, pagoMatch, aliasPorProveedor)) {
      matches.push(propuesta);
    } else {
      revisarNombre.push(propuesta);
    }
  }

  // Grupos de cargos idénticos (mismo proveedor/tarjeta, mismo importe, mismo
  // día) que ninguna señal del concepto permite distinguir entre sí — ej. 4
  // compras de "COMPRA TRAVELFINE..." de 92,76€ el mismo día. Da igual cuál
  // se empareje con cuál: el resultado contable es el mismo. Se concilian
  // por orden de aparición hasta el mínimo entre movimientos y pagos
  // pendientes de ese grupo; si sobra alguno de un lado, queda sin match
  // (no se inventa ni se descarta nada, solo pasa a revisión).
  emparejarGruposEmpatadosPorOrden(movimientos, pagos, pagosConMatch, matches, fichero);

  // Segunda pasada (prioritaria sobre "revisar importe" individual): pares de
  // movimientos sin match cuya suma coincide con un pago OFIviaje pendiente,
  // y cuyo código de localizador (LOC) coincide con el documento de cobro/pago
  // del XML. Solo se propone para revisión manual.
  const revisarSuma: OfiviajeRevisarSuma[] = [];
  const movimientosSinMatch = movimientos.filter(
    (mov: any) =>
      !matches.some((m) => m.movimientoId === mov.id) &&
      !revisarNombre.some((m) => m.movimientoId === mov.id)
  );
  const movimientosUsadosEnSuma = new Set<string>();

  for (const pago of pagos) {
    if (pagosConMatch.has(pago)) continue;
    const codigoPago = normalizarCodigo(pago.documentoCobroPago || "");
    if (!codigoPago) continue;

    const candidatos = movimientosSinMatch.filter(
      (mov: any) => !movimientosUsadosEnSuma.has(mov.id) && extraerCodigoLoc(mov.concepto_original || "") === codigoPago
    );
    if (candidatos.length < 2) continue;

    let encontrado: [any, any] | null = null;
    for (let i = 0; i < candidatos.length && !encontrado; i++) {
      for (let j = i + 1; j < candidatos.length; j++) {
        const suma = Math.abs(Number(candidatos[i].importe)) + Math.abs(Number(candidatos[j].importe));
        const maxDiffPermitida = Math.max(suma, pago.importePendiente) * TOLERANCIA_IMPORTE_REVISION_PCT;
        if (Math.abs(suma - pago.importePendiente) <= Math.max(TOLERANCIA_IMPORTE, maxDiffPermitida)) {
          encontrado = [candidatos[i], candidatos[j]];
          break;
        }
      }
    }
    if (!encontrado) continue;

    pagosConMatch.add(pago);
    movimientosUsadosEnSuma.add(encontrado[0].id);
    movimientosUsadosEnSuma.add(encontrado[1].id);
    revisarSuma.push({
      movimientoIds: [encontrado[0].id, encontrado[1].id],
      movimientoImportes: [Number(encontrado[0].importe), Number(encontrado[1].importe)],
      movimientoFechas: [encontrado[0].fecha_operacion, encontrado[1].fecha_operacion],
      movimientoConceptos: [encontrado[0].concepto_original || "", encontrado[1].concepto_original || ""],
      pago,
    });
  }

  // Cuarta pasada: caso inverso — un único movimiento bancario cuyo importe
  // coincide con la suma de 2+ pagos OFIviaje que comparten el mismo
  // documentoCobroPago (el banco cargó de una vez lo que OFI dividió en
  // varios vencimientos). Solo se propone para revisión manual.
  const revisarDivision: OfiviajeRevisarDivision[] = [];
  const pagosSinMatchTrasSuma = pagos.filter((p) => !pagosConMatch.has(p));
  const gruposPorDocCobroPago = new Map<string, OfiviajePago[]>();
  for (const p of pagosSinMatchTrasSuma) {
    const codigo = normalizarCodigo(p.documentoCobroPago || "");
    if (!codigo) continue;
    if (!gruposPorDocCobroPago.has(codigo)) gruposPorDocCobroPago.set(codigo, []);
    gruposPorDocCobroPago.get(codigo)!.push(p);
  }

  const movimientosSinMatchTrasSuma = movimientos.filter(
    (mov: any) => !movimientosUsadosEnSuma.has(mov.id) && !matches.some((m) => m.movimientoId === mov.id) && !revisarNombre.some((m) => m.movimientoId === mov.id)
  );
  const movimientosUsadosEnDivision = new Set<string>();

  for (const [, grupoPagos] of gruposPorDocCobroPago) {
    if (grupoPagos.length < 2) continue;
    const sumaPagos = grupoPagos.reduce((acc, p) => acc + p.importePendiente, 0);

    const movCandidato = movimientosSinMatchTrasSuma.find((mov: any) => {
      if (movimientosUsadosEnDivision.has(mov.id)) return false;
      const importeMov = Math.abs(Number(mov.importe));
      const diff = Math.abs(importeMov - sumaPagos);
      const maxDiffPermitida = Math.max(importeMov, sumaPagos) * TOLERANCIA_IMPORTE_REVISION_PCT;
      if (diff > Math.max(TOLERANCIA_IMPORTE, maxDiffPermitida)) return false;
      return grupoPagos.some((p) => fechaCoincide(mov, p));
    });
    if (!movCandidato) continue;

    movimientosUsadosEnDivision.add(movCandidato.id);
    for (const p of grupoPagos) pagosConMatch.add(p);
    revisarDivision.push({
      movimientoId: movCandidato.id,
      movimientoImporte: Number(movCandidato.importe),
      movimientoFecha: movCandidato.fecha_operacion,
      movimientoConcepto: movCandidato.concepto_original || "",
      pagos: grupoPagos,
    });
  }

  // Cuarta pasada (menos específica, se ejecuta al final): movimientos sin
  // match exacto ni agrupado, pero con proveedor+fecha coincidentes y una
  // diferencia de importe pequeña (ajustes/redondeos). Se proponen para
  // revisión manual, nunca se concilian automáticamente.
  for (const mov of movimientos) {
    if (
      matches.some((m) => m.movimientoId === mov.id) ||
      revisarNombre.some((m) => m.movimientoId === mov.id) ||
      movimientosUsadosEnSuma.has(mov.id) ||
      movimientosUsadosEnDivision.has(mov.id)
    ) {
      continue;
    }
    const pagoAproximado = pagos.find(
      (p) => !pagosConMatch.has(p) && coincideImporteAproximado(mov, p) && nombreCoincide(mov, p, aliasPorProveedor)
    );
    if (!pagoAproximado) continue;

    pagosConMatch.add(pagoAproximado);
    revisarImporte.push({
      movimientoId: mov.id,
      movimientoImporte: Number(mov.importe),
      movimientoFecha: mov.fecha_operacion,
      movimientoConcepto: mov.concepto_original || "",
      pago: pagoAproximado,
    });
  }

  const pagosSinMatchInicial = pagos.filter((p) => !pagosConMatch.has(p));

  // De los que no encontraron candidato "pendiente", comprobar si en realidad
  // ya están conciliados (por eso quedaron fuera del filtro conciliado_externo=false)
  // para no mostrarlos como "sin movimiento bancario" cuando sí lo tienen.
  let yaConciliados = 0;
  let sinMatch = pagosSinMatchInicial;

  if (pagosSinMatchInicial.length > 0) {
    const { data: movimientosConciliados } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("importe, fecha_operacion, fecha_valor")
      .eq("conciliado_externo", true)
      .in("cuenta_bancaria_id", cuentaBancariaIds)
      .lt("importe", 0)
      .gte("fecha_operacion", fechaMinimaBusqueda);

    if (movimientosConciliados && movimientosConciliados.length > 0) {
      const pagosYaConciliados = new Set<OfiviajePago>();
      for (const mov of movimientosConciliados) {
        const pagoMatch = pagosSinMatchInicial.find((p) => !pagosYaConciliados.has(p) && coincide(mov, p));
        if (pagoMatch) pagosYaConciliados.add(pagoMatch);
      }
      yaConciliados = pagosYaConciliados.size;
      sinMatch = pagosSinMatchInicial.filter((p) => !pagosYaConciliados.has(p));
    }
  }

  return { procesados: pagos.length, matches, revisarNombre, revisarImporte, revisarSuma, revisarDivision, sinMatch, yaConciliados };
}

/**
 * Adapta un cobro (Liquidación de Cajas, grupo Transferencias) al shape de
 * OfiviajePago para poder reutilizar coincide()/fechaCoincide()/nombreCoincide(),
 * que operan sobre proveedorNombre/importePendiente/fechaVencto/fechaDoc.
 */
function cobroComoPago(cobro: OfiviajeCobro): OfiviajePago {
  const fecha = parseOfiviajeFechaCorta(cobro.fechaMovimiento);
  const fechaDDMMYYYY = fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}` : "";
  return {
    documento: cobro.factura,
    fechaVencto: fechaDDMMYYYY,
    fechaDoc: fechaDDMMYYYY,
    referenciaProvCte: cobro.factura,
    documentoCobroPago: "",
    tipoOperacion: "",
    cuentaTesoreria: "",
    nombrePasajero: cobro.nombrePagador,
    apunte: "",
    importePendiente: cobro.importeCobro,
    situacion: "",
    proveedorNombre: cobro.nombrePagador,
    proveedorCuentaContable: "",
  };
}

/**
 * Igual que calcularMatchesXmlContenido pero para cobros de clientes por
 * transferencia (fichero TSRLiquidacionCajas_*, grupo "Transferencias"). Los
 * movimientos bancarios candidatos son de importe positivo (entrada), sin
 * restricción sobre el texto del concepto (aplica igual a "TRANSFERENCIA...",
 * "INGRESO EN EFECTIVO..." o "INGRESO ANONIMO EN CAJERO...": lo único que
 * decide si concilia es que el nombre del pagador coincida con el concepto).
 * No contempla suma/división (mucho menos frecuente en cobros de clientes que
 * en pagos a proveedores): solo match exacto y revisarNombre.
 */
async function calcularMatchesCobrosXmlContenido(
  agencyDb: any,
  xmlContent: string,
  fichero: { id: string; nombre: string; modifiedTime: string }
): Promise<{
  procesados: number;
  matches: OfiviajeMatchPropuesto[];
  revisarNombre: OfiviajeMatchPropuesto[];
  revisarImporte: OfiviajeRevisarImporte[];
  revisarSuma: OfiviajeRevisarSuma[];
  revisarDivision: OfiviajeRevisarDivision[];
  sinMatch: OfiviajePago[];
  yaConciliados: number;
}> {
  const vacio = {
    procesados: 0,
    matches: [],
    revisarNombre: [],
    revisarImporte: [],
    revisarSuma: [],
    revisarDivision: [],
    sinMatch: [],
    yaConciliados: 0,
  };
  const cobros = parseOfiviajeCobrosXml(xmlContent);
  if (cobros.length === 0) return vacio;

  const pagos = cobros.map(cobroComoPago);
  const cobroOriginalPorPago = new Map<OfiviajePago, OfiviajeCobro>(pagos.map((p, i) => [p, cobros[i]]));
  const fechaMinimaBusqueda = calcularFechaMinimaBusqueda(pagos);
  const aliasPorProveedor = await getAliasProveedorPorAgencia(agencyDb);

  // A diferencia de los pagos (donde CuentaTesoreria del XML resuelve la
  // cuenta bancaria exacta), el fichero de cobros no indica cuenta por fila:
  // se busca en todas las cuentas bancarias activas de la agencia.
  const { data: cuentas } = await agencyDb.from("config_cuentas_bancarias").select("id").eq("activa", true);
  const cuentaBancariaIds = (cuentas || []).map((c: any) => c.id);

  if (cuentaBancariaIds.length === 0) {
    return { ...vacio, procesados: pagos.length, sinMatch: pagos };
  }

  // Un cobro con importe negativo en el XML (devolución al cliente) debe
  // conciliar contra un movimiento bancario de salida, no de entrada: se
  // consultan ambos signos y luego coincide() compara valores absolutos.
  const { data: movimientos, error } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, importe, fecha_operacion, fecha_valor, concepto_original, estado, conciliado_externo")
    .in("estado", ["pendiente", "propuesto", "parcial"])
    .eq("conciliado_externo", false)
    .in("cuenta_bancaria_id", cuentaBancariaIds)
    .neq("importe", 0)
    .gte("fecha_operacion", fechaMinimaBusqueda);

  if (error || !movimientos) {
    return { ...vacio, procesados: pagos.length, sinMatch: pagos };
  }

  const matches: OfiviajeMatchPropuesto[] = [];
  const revisarNombre: OfiviajeMatchPropuesto[] = [];
  const pagosConMatch = new Set<OfiviajePago>();

  for (const mov of movimientos) {
    const movEsEntrada = Number(mov.importe) > 0;
    // Mismo criterio de desambiguación que en calcularMatchesXmlContenido.
    const candidatosPorImporteFecha = pagos.filter(
      (p) => !pagosConMatch.has(p) && (p.importePendiente >= 0) === movEsEntrada && coincide(mov, p)
    );
    if (candidatosPorImporteFecha.length === 0) continue;
    const pagoMatch = desambiguarCandidato(mov, candidatosPorImporteFecha, aliasPorProveedor);
    if (!pagoMatch) continue;

    pagosConMatch.add(pagoMatch);
    const propuesta: OfiviajeMatchPropuesto = {
      movimientoId: mov.id,
      movimientoImporte: Number(mov.importe),
      movimientoFecha: mov.fecha_operacion,
      movimientoConcepto: mov.concepto_original || "",
      pago: pagoMatch,
      cobroOriginal: cobroOriginalPorPago.get(pagoMatch),
      ficheroId: fichero.id,
      ficheroNombre: fichero.nombre,
      ficheroModifiedTime: fichero.modifiedTime,
    };

    if (nombreCoincide(mov, pagoMatch, aliasPorProveedor)) {
      matches.push(propuesta);
    } else {
      revisarNombre.push(propuesta);
    }
  }

  const pagosSinMatchInicial = pagos.filter((p) => !pagosConMatch.has(p));

  let yaConciliados = 0;
  let sinMatch = pagosSinMatchInicial;

  if (pagosSinMatchInicial.length > 0) {
    const { data: movimientosConciliados } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("importe, fecha_operacion, fecha_valor")
      .eq("conciliado_externo", true)
      .in("cuenta_bancaria_id", cuentaBancariaIds)
      .neq("importe", 0)
      .gte("fecha_operacion", fechaMinimaBusqueda);

    if (movimientosConciliados && movimientosConciliados.length > 0) {
      const pagosYaConciliados = new Set<OfiviajePago>();
      for (const mov of movimientosConciliados) {
        const movEsEntrada = Number(mov.importe) > 0;
        const pagoMatch = pagosSinMatchInicial.find(
          (p) => !pagosYaConciliados.has(p) && (p.importePendiente >= 0) === movEsEntrada && coincide(mov, p)
        );
        if (pagoMatch) pagosYaConciliados.add(pagoMatch);
      }
      yaConciliados = pagosYaConciliados.size;
      sinMatch = pagosSinMatchInicial.filter((p) => !pagosYaConciliados.has(p));
    }
  }

  return {
    procesados: pagos.length,
    matches,
    revisarNombre,
    revisarImporte: [],
    revisarSuma: [],
    revisarDivision: [],
    sinMatch,
    yaConciliados,
  };
}

export interface OfiviajePreview {
  ficherosNuevos: number;
  procesados: number;
  matches: OfiviajeMatchPropuesto[];
  revisarNombre: OfiviajeMatchPropuesto[];
  revisarImporte: OfiviajeRevisarImporte[];
  revisarSuma: OfiviajeRevisarSuma[];
  revisarDivision: OfiviajeRevisarDivision[];
  sinMatch: OfiviajePago[];
  yaConciliados: number;
  error?: string;
}

/**
 * Despacha al parser/matching correcto según el nombre del fichero: pagos a
 * proveedores (TSRLstVPagos_*) o cobros de clientes por transferencia
 * (TSRLiquidacionCajas_*). Ambos tipos conviven en la misma carpeta de Drive.
 */
function calcularMatchesFicheroXml(
  agencyDb: any,
  xmlContent: string,
  fichero: { id: string; nombre: string; modifiedTime: string }
) {
  if (fichero.nombre.startsWith("TSRLiquidacionCajas_")) {
    return calcularMatchesCobrosXmlContenido(agencyDb, xmlContent, fichero);
  }
  return calcularMatchesXmlContenido(agencyDb, xmlContent, fichero);
}

/**
 * Calcula (sin escribir nada en BD) qué movimientos se conciliarían con los
 * pagos de los ficheros XML nuevos de la carpeta de Drive del usuario actual.
 * El resultado se muestra al usuario para que confirme antes de aplicar cambios.
 */
/**
 * TEMPORAL (solo para pruebas en local): calcula el matching de un XML de
 * cobros (Liquidación de Cajas) pegado/subido a mano, sin tocar Drive ni
 * escribir nada en BD (ni ofiviaje_ficheros_procesados ni conciliaciones).
 * Sirve para verificar el resultado antes de dar por buena la función.
 */
export async function previsualizarCobrosXmlManual(xmlContent: string): Promise<OfiviajePreview> {
  try {
    const agencyDb = await getAgencyDbClient();
    const result = await calcularMatchesCobrosXmlContenido(agencyDb, xmlContent, {
      id: "manual",
      nombre: "manual",
      modifiedTime: new Date().toISOString(),
    });
    return { ficherosNuevos: 1, ...result };
  } catch (error: any) {
    return {
      ficherosNuevos: 0,
      procesados: 0,
      matches: [],
      revisarNombre: [],
      revisarImporte: [],
      revisarSuma: [],
      revisarDivision: [],
      sinMatch: [],
      yaConciliados: 0,
      error: error.message || "Error al procesar el XML de cobros.",
    };
  }
}

export async function previsualizarOfiviajeUsuarioActual(): Promise<OfiviajePreview> {
  try {
    const tokens = await getDriveTokensUsuarioActual();
    const agencyDb = await getAgencyDbClient();

    const ficheros = await listarXmlEnCarpeta(tokens);
    if (ficheros.length === 0) {
      const persistidas = await leerTareasPendientesPersistidas(agencyDb);
      return {
        ficherosNuevos: 0,
        procesados: 0,
        matches: [],
        revisarNombre: persistidas.revisarNombre,
        revisarImporte: persistidas.revisarImporte,
        revisarSuma: persistidas.revisarSuma,
        revisarDivision: persistidas.revisarDivision,
        sinMatch: persistidas.sinMatch,
        yaConciliados: 0,
      };
    }

    const { data: yaProcesados } = await agencyDb
      .from("ofiviaje_ficheros_procesados")
      .select("drive_file_id, drive_modified_time")
      .in(
        "drive_file_id",
        ficheros.map((f) => f.id)
      );

    const procesadosSet = new Set(
      (yaProcesados || []).map((p: any) => `${p.drive_file_id}::${new Date(p.drive_modified_time).toISOString()}`)
    );
    const nuevos = ficheros.filter((f) => !procesadosSet.has(`${f.id}::${new Date(f.modifiedTime).toISOString()}`));

    let procesados = 0;
    let yaConciliados = 0;
    const matches: OfiviajeMatchPropuesto[] = [];
    const revisarNombre: OfiviajeMatchPropuesto[] = [];
    const revisarImporte: OfiviajeRevisarImporte[] = [];
    const revisarSuma: OfiviajeRevisarSuma[] = [];
    const revisarDivision: OfiviajeRevisarDivision[] = [];
    const sinMatch: OfiviajePago[] = [];

    for (const fichero of nuevos) {
      const contenido = await descargarContenidoXml(tokens, fichero.id);
      const result = await calcularMatchesFicheroXml(agencyDb, contenido, fichero);
      procesados += result.procesados;
      matches.push(...result.matches);
      revisarNombre.push(...result.revisarNombre);
      revisarImporte.push(...result.revisarImporte);
      revisarSuma.push(...result.revisarSuma);
      revisarDivision.push(...result.revisarDivision);
      sinMatch.push(...result.sinMatch);
      yaConciliados += result.yaConciliados;

      // Persistir lo que no se resolvió, para que no se pierda cuando el
      // fichero se marque como procesado más abajo.
      await persistirTareasPendientes(agencyDb, fichero, result);
    }

    // Fusionar con tareas de ejecuciones anteriores (cron u otras
    // comprobaciones) que quedaron sin resolver y cuyo fichero ya no es "nuevo".
    // Se excluyen los ficheros recién procesados en este mismo bucle: sus
    // tareas ya están en las listas en memoria de arriba y también se acaban
    // de persistir, así que releerlas aquí las duplicaría.
    const persistidas = await leerTareasPendientesPersistidas(
      agencyDb,
      nuevos.map((f) => f.id)
    );

    return {
      ficherosNuevos: nuevos.length,
      procesados,
      matches,
      revisarNombre: [...revisarNombre, ...persistidas.revisarNombre],
      revisarImporte: [...revisarImporte, ...persistidas.revisarImporte],
      revisarSuma: [...revisarSuma, ...persistidas.revisarSuma],
      revisarDivision: [...revisarDivision, ...persistidas.revisarDivision],
      sinMatch: [...sinMatch, ...persistidas.sinMatch],
      yaConciliados,
    };
  } catch (error: any) {
    return {
      ficherosNuevos: 0,
      procesados: 0,
      matches: [],
      revisarNombre: [],
      revisarImporte: [],
      revisarSuma: [],
      revisarDivision: [],
      sinMatch: [],
      yaConciliados: 0,
      error: error.message || "Error al comprobar OFIviaje.",
    };
  }
}

/**
 * Guarda en `ofiviaje_tareas_pendientes` las tareas propuestas de un fichero
 * (revisarNombre/revisarImporte/revisarSuma/revisarDivision/sinMatch) que no
 * se resolvieron automáticamente, para que sigan siendo visibles aunque el
 * fichero ya se marque como "procesado" y no vuelva a analizarse.
 */
async function persistirTareasPendientes(
  agencyDb: any,
  fichero: { id: string; nombre: string },
  result: {
    revisarNombre: OfiviajeMatchPropuesto[];
    revisarImporte: OfiviajeRevisarImporte[];
    revisarSuma: OfiviajeRevisarSuma[];
    revisarDivision: OfiviajeRevisarDivision[];
    sinMatch: OfiviajePago[];
  }
): Promise<void> {
  const esCobro = fichero.nombre.startsWith("TSRLiquidacionCajas_");
  // La cuenta bancaria solo se puede determinar con certeza para pagos (el
  // XML indica cuentaTesoreria); en cobros no hay forma de saber la cuenta
  // por fila, así que cuenta_bancaria_id queda NULL para ellos.
  const mapaCuentaContable = esCobro ? {} : await getMapaCuentaContable(agencyDb);
  const cuentaDePago = (pago: OfiviajePago | undefined) =>
    esCobro || !pago ? null : mapaCuentaContable[pago.cuentaTesoreria] || null;

  const filas: any[] = [];
  for (const datos of result.revisarNombre) filas.push({ tipo: "revisarNombre", datos, cuentaBancariaId: cuentaDePago(datos.pago) });
  for (const datos of result.revisarImporte) filas.push({ tipo: "revisarImporte", datos, cuentaBancariaId: cuentaDePago(datos.pago) });
  for (const datos of result.revisarSuma) filas.push({ tipo: "revisarSuma", datos, cuentaBancariaId: cuentaDePago(datos.pago) });
  for (const datos of result.revisarDivision) filas.push({ tipo: "revisarDivision", datos, cuentaBancariaId: null });
  for (const datos of result.sinMatch) filas.push({ tipo: "sinMatch", datos, cuentaBancariaId: cuentaDePago(datos) });

  // Reemplaza las tareas previas de este mismo fichero (si se re-analiza en
  // la misma pasada, o si ya se habían persistido en una llamada anterior),
  // en vez de acumular filas duplicadas cada vez que se procesa.
  await agencyDb.from("ofiviaje_tareas_pendientes").delete().eq("drive_file_id", fichero.id);

  if (filas.length === 0) return;

  await agencyDb.from("ofiviaje_tareas_pendientes").insert(
    filas.map((f) => ({
      tipo: f.tipo,
      datos: f.datos,
      drive_file_id: fichero.id,
      drive_file_nombre: fichero.nombre,
      es_cobro: esCobro,
      cuenta_bancaria_id: f.cuentaBancariaId,
    }))
  );
}

/**
 * Lee las tareas pendientes ya persistidas (no resueltas) y las agrupa por
 * tipo, en el mismo shape que devuelve calcularMatchesXmlContenido, para
 * fusionarlas con lo recién calculado sobre ficheros nuevos.
 */
async function leerTareasPendientesPersistidas(
  agencyDb: any,
  excluirDriveFileIds: string[] = []
): Promise<{
  revisarNombre: OfiviajeMatchPropuesto[];
  revisarImporte: OfiviajeRevisarImporte[];
  revisarSuma: OfiviajeRevisarSuma[];
  revisarDivision: OfiviajeRevisarDivision[];
  sinMatch: OfiviajePago[];
}> {
  const vacio = { revisarNombre: [], revisarImporte: [], revisarSuma: [], revisarDivision: [], sinMatch: [] };
  let query = agencyDb
    .from("ofiviaje_tareas_pendientes")
    .select("tipo, datos")
    .eq("resuelta", false);
  if (excluirDriveFileIds.length > 0) {
    query = query.not("drive_file_id", "in", `(${excluirDriveFileIds.join(",")})`);
  }
  const { data } = await query;

  if (!data || data.length === 0) return vacio;

  const resultado = { revisarNombre: [], revisarImporte: [], revisarSuma: [], revisarDivision: [], sinMatch: [] } as any;
  for (const fila of data) {
    if (resultado[fila.tipo]) resultado[fila.tipo].push(fila.datos);
  }
  return resultado;
}

/**
 * Marca como resuelta cualquier tarea persistida en ofiviaje_tareas_pendientes
 * cuyo movimiento bancario (datos.movimientoId, o datos.movimientoIds para el
 * caso "revisarSuma") coincida con el que se acaba de conciliar — sin esto,
 * la tarea sigue apareciendo para siempre en los informes aunque ya esté
 * conciliada, porque leerTareasPendientesPersistidas() solo filtra por
 * resuelta=false.
 */
export async function marcarTareaPendienteResueltaPorMovimiento(agencyDb: any, movimientoBancoId: string): Promise<void> {
  const { data } = await agencyDb
    .from("ofiviaje_tareas_pendientes")
    .select("id, datos")
    .eq("resuelta", false);

  const idsAResolver = (data || [])
    .filter((fila: any) => fila.datos?.movimientoId === movimientoBancoId || fila.datos?.movimientoIds?.includes(movimientoBancoId))
    .map((fila: any) => fila.id);

  if (idsAResolver.length === 0) return;

  await agencyDb
    .from("ofiviaje_tareas_pendientes")
    .update({ resuelta: true, resuelta_en: new Date().toISOString() })
    .in("id", idsAResolver);
}

export interface HistorialProcesoOfiviaje {
  ficheroId: string;
  nombreFichero: string;
  procesadoEn: string;
  ultimoReprocesoEn: string | null;
  procesados: number;
  pagos: number;
  cobros: number;
  conciliados: number;
  revision: number;
  origen: "manual" | "automatico";
}

/**
 * Lista todos los ficheros OFIviaje ya procesados (pagos y cobros), con el
 * total de pagos procesados, movimientos conciliados automáticamente y
 * tareas quedadas para revisión manual (contadas desde
 * ofiviaje_tareas_pendientes por drive_file_id, sin filtrar por resuelta:
 * es un histórico, no el estado actual de pendientes).
 */
export async function getHistorialProcesosOfiviaje(): Promise<HistorialProcesoOfiviaje[]> {
  const agencyDb = await getAgencyDbClient();

  const { data: ficheros } = await agencyDb
    .from("ofiviaje_ficheros_procesados")
    .select("drive_file_id, nombre_fichero, procesado_en, ultimo_reproceso_en, pagos_procesados, movimientos_conciliados, origen")
    .order("procesado_en", { ascending: false });

  if (!ficheros || ficheros.length === 0) return [];

  const { data: tareas } = await agencyDb
    .from("ofiviaje_tareas_pendientes")
    .select("drive_file_id")
    .eq("resuelta", false)
    .in("drive_file_id", ficheros.map((f: any) => f.drive_file_id));

  const revisionPorFichero = new Map<string, number>();
  for (const t of tareas || []) {
    revisionPorFichero.set(t.drive_file_id, (revisionPorFichero.get(t.drive_file_id) || 0) + 1);
  }

  return ficheros.map((f: any) => {
    const esCobro = (f.nombre_fichero || "").startsWith("TSRLiquidacionCajas_");
    const procesados = f.pagos_procesados || 0;
    const conciliados = f.movimientos_conciliados || 0;
    return {
      ficheroId: f.drive_file_id,
      nombreFichero: f.nombre_fichero || "",
      procesadoEn: f.procesado_en,
      ultimoReprocesoEn: f.ultimo_reproceso_en || null,
      procesados,
      pagos: esCobro ? 0 : conciliados,
      cobros: esCobro ? conciliados : 0,
      conciliados,
      revision: revisionPorFichero.get(f.drive_file_id) || 0,
      origen: f.origen === "automatico" ? "automatico" : "manual",
    };
  });
}

export interface DetalleProcesoOfiviajeProcesado {
  movimientoId: string;
  movimientoFecha: string;
  movimientoFechaValor: string | null;
  movimientoConcepto: string;
  movimientoImporte: number;
  ofiImporte: number | null;
  proveedorNombre: string;
  expediente: string;
  documento: string | null;
  documentoCobroPago: string | null;
  nombrePasajero: string | null;
  fechaVencto: string | null;
  fechaDoc: string | null;
  cuentaBancariaId: string | null;
  cuentaBancariaNombre: string | null;
}

export interface DetalleProcesoOfiviajeTarea {
  id: string;
  tipo: string;
  nombre: string;
  expediente: string;
  importe: number | null;
  documento: string | null;
  documentoCobroPago: string | null;
  nombrePasajero: string | null;
  fechaVencto: string | null;
  fechaDoc: string | null;
  movConcepto: string | null;
  movImporte: number | null;
  movFecha: string | null;
  movFechaValor: string | null;
  resuelta: boolean;
  cuentaBancariaId: string | null;
  cuentaBancariaNombre: string | null;
}

export interface DetalleProcesoOfiviaje {
  nombreFichero: string;
  procesados: DetalleProcesoOfiviajeProcesado[];
  tareas: DetalleProcesoOfiviajeTarea[];
}

/**
 * Detalle de un proceso concreto (identificado por drive_file_id) para la
 * página de detalle del historial: movimientos auto-conciliados (leídos por
 * el marcador _driveFileId guardado dentro de conciliado_externo_datos) y
 * las tareas/incidencias persistidas para ese fichero.
 */
export async function getDetalleProcesoOfiviaje(driveFileId: string): Promise<DetalleProcesoOfiviaje> {
  const agencyDb = await getAgencyDbClient();

  const { data: cuentasBancarias } = await agencyDb.from("config_cuentas_bancarias").select("id, banco");
  const nombreCuentaPorId = new Map<string, string>((cuentasBancarias || []).map((c: any) => [c.id, c.banco]));

  const { data: ficheroInfo } = await agencyDb
    .from("ofiviaje_ficheros_procesados")
    .select("nombre_fichero, procesado_en, movimientos_conciliados")
    .eq("drive_file_id", driveFileId)
    .order("procesado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: movimientosMarcados } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, fecha_operacion, fecha_valor, concepto_original, importe, cuenta_bancaria_id, conciliado_externo_datos")
    .eq("conciliado_externo", true)
    .contains("conciliado_externo_datos", { _driveFileId: driveFileId });

  let movimientos = movimientosMarcados || [];

  // Procesos anteriores a introducir el marcador _driveFileId: se aproxima
  // buscando los movimientos conciliados por OFIviaje en la misma fecha
  // (día) en que se registró este proceso, filtrando además por la cuenta
  // bancaria del fichero (resuelta desde las tareas persistidas de ese
  // mismo drive_file_id) para no mezclar procesos de otras cuentas del
  // mismo día.
  if (movimientos.length === 0 && ficheroInfo?.procesado_en) {
    const inicioDia = new Date(ficheroInfo.procesado_en);
    inicioDia.setUTCHours(0, 0, 0, 0);
    const finDia = new Date(inicioDia);
    finDia.setUTCDate(finDia.getUTCDate() + 1);

    const { data: tareaConCuenta } = await agencyDb
      .from("ofiviaje_tareas_pendientes")
      .select("cuenta_bancaria_id")
      .eq("drive_file_id", driveFileId)
      .not("cuenta_bancaria_id", "is", null)
      .limit(1)
      .maybeSingle();

    let query = agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, fecha_operacion, fecha_valor, concepto_original, importe, cuenta_bancaria_id, conciliado_externo_datos, conciliado_externo_en")
      .eq("conciliado_externo", true)
      .eq("conciliado_externo_origen", "ofiviaje")
      .gte("conciliado_externo_en", inicioDia.toISOString())
      .lt("conciliado_externo_en", finDia.toISOString());

    if (tareaConCuenta?.cuenta_bancaria_id) {
      query = query.eq("cuenta_bancaria_id", tareaConCuenta.cuenta_bancaria_id);
    }

    const { data: candidatos } = await query;
    movimientos = candidatos || [];
  }

  const procesados: DetalleProcesoOfiviajeProcesado[] = movimientos.map((m: any) => ({
    movimientoId: m.id,
    movimientoFecha: m.fecha_operacion,
    movimientoFechaValor: m.fecha_valor || null,
    movimientoConcepto: m.concepto_original || "",
    movimientoImporte: Number(m.importe),
    ofiImporte: m.conciliado_externo_datos?.importePendiente != null ? Number(m.conciliado_externo_datos.importePendiente) : null,
    proveedorNombre: m.conciliado_externo_datos?.proveedorNombre || "",
    expediente: m.conciliado_externo_datos?.referenciaProvCte || "",
    documento: m.conciliado_externo_datos?.documento || null,
    documentoCobroPago: m.conciliado_externo_datos?.documentoCobroPago || null,
    nombrePasajero: m.conciliado_externo_datos?.nombrePasajero || null,
    fechaVencto: m.conciliado_externo_datos?.fechaVencto || null,
    fechaDoc: m.conciliado_externo_datos?.fechaDoc || null,
    cuentaBancariaId: m.cuenta_bancaria_id || null,
    cuentaBancariaNombre: m.cuenta_bancaria_id ? nombreCuentaPorId.get(m.cuenta_bancaria_id) || null : null,
  }));

  const { data: tareasData } = await agencyDb
    .from("ofiviaje_tareas_pendientes")
    .select("id, tipo, datos, cuenta_bancaria_id, resuelta")
    .eq("drive_file_id", driveFileId);

  // Para tareas de cobros, la cuenta no viene en cuenta_bancaria_id (el XML de
  // cobros no la indica por fila); se resuelve consultando el movimiento
  // bancario asociado, si la tarea ya tiene un movimientoId candidato.
  const movimientoIdsSinCuenta = (tareasData || [])
    .filter((fila: any) => !fila.cuenta_bancaria_id && fila.datos?.movimientoId)
    .map((fila: any) => fila.datos.movimientoId as string);

  // La fecha valor del movimiento bancario no se persiste en `datos` de la
  // tarea (solo movimientoFecha = fecha_operacion), así que se resuelve para
  // todas las tareas con movimientoId, igual que en la tabla Procesados.
  const movimientoIdsParaFechaValor = [
    ...new Set((tareasData || []).map((fila: any) => fila.datos?.movimientoId as string | undefined).filter((id): id is string => !!id)),
  ];

  const cuentaPorMovimientoId = new Map<string, string>();
  const fechaValorPorMovimientoId = new Map<string, string>();
  if (movimientoIdsSinCuenta.length > 0 || movimientoIdsParaFechaValor.length > 0) {
    const { data: movsParaDatos } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, cuenta_bancaria_id, fecha_valor")
      .in("id", [...new Set([...movimientoIdsSinCuenta, ...movimientoIdsParaFechaValor])]);
    for (const mov of movsParaDatos || []) {
      if (mov.cuenta_bancaria_id) cuentaPorMovimientoId.set(mov.id, mov.cuenta_bancaria_id);
      if (mov.fecha_valor) fechaValorPorMovimientoId.set(mov.id, mov.fecha_valor);
    }
  }

  const tareas: DetalleProcesoOfiviajeTarea[] = (tareasData || []).map((fila: any) => {
    const datos = fila.datos;
    const pago = datos.pago ?? (fila.tipo === "sinMatch" ? datos : undefined);
    const cuentaBancariaId = fila.cuenta_bancaria_id || (datos?.movimientoId ? cuentaPorMovimientoId.get(datos.movimientoId) : null) || null;
    return {
      id: fila.id,
      tipo: fila.tipo,
      nombre: pago?.proveedorNombre || pago?.nombrePagador || "",
      expediente: pago?.referenciaProvCte || "",
      documento: pago?.documento || null,
      documentoCobroPago: pago?.documentoCobroPago || null,
      nombrePasajero: pago?.nombrePasajero || null,
      fechaVencto: pago?.fechaVencto || null,
      fechaDoc: pago?.fechaDoc || null,
      importe: pago?.importePendiente ?? null,
      movConcepto: datos.movimientoConcepto ?? datos.movimientoConceptos?.[0] ?? null,
      movImporte: datos.movimientoImporte ?? datos.movimientoImportes?.[0] ?? null,
      movFecha: datos.movimientoFecha ?? datos.movimientoFechas?.[0] ?? null,
      movFechaValor: datos?.movimientoId ? fechaValorPorMovimientoId.get(datos.movimientoId) || null : null,
      resuelta: !!fila.resuelta,
      cuentaBancariaId,
      cuentaBancariaNombre: cuentaBancariaId ? nombreCuentaPorId.get(cuentaBancariaId) || null : null,
    };
  });

  return { nombreFichero: ficheroInfo?.nombre_fichero || "", procesados, tareas };
}

/**
 * TEMPORAL (herramienta de mantenimiento, uso puntual): re-lee de Drive los
 * ficheros OFIviaje ya procesados que aún no tengan _driveFileId marcado en
 * conciliado_externo_datos, y para cada pago del XML localiza el movimiento
 * bancario ya conciliado que le corresponde exactamente (mismo proveedor +
 * importe + fecha, igual que el matching normal), marcándolo con el
 * drive_file_id real. Sirve para reconstruir el historial de los procesos
 * anteriores a introducir el marcador, sin necesidad de heurísticas por
 * fecha/cuenta que pueden confundir ficheros del mismo día.
 */
export async function reconstruirMarcadoresDriveFileIdRetroactivo(): Promise<{
  ficherosRevisados: number;
  movimientosMarcados: number;
  detalle: { ficheroNombre: string; marcados: number }[];
}> {
  const agencyDb = await getAgencyDbClient();
  const tokens = await getDriveTokensUsuarioActual();

  const { data: ficherosProcesados } = await agencyDb
    .from("ofiviaje_ficheros_procesados")
    .select("drive_file_id, nombre_fichero");

  if (!ficherosProcesados || ficherosProcesados.length === 0) {
    return { ficherosRevisados: 0, movimientosMarcados: 0, detalle: [] };
  }

  const { data: sinMarcar } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, importe, fecha_operacion, fecha_valor, concepto_original, conciliado_externo_datos")
    .eq("conciliado_externo", true)
    .eq("conciliado_externo_origen", "ofiviaje")
    .not("conciliado_externo_datos", "is", null);

  const candidatosSinMarcar = (sinMarcar || []).filter((m: any) => !("_driveFileId" in (m.conciliado_externo_datos || {})));

  if (candidatosSinMarcar.length === 0) {
    return { ficherosRevisados: 0, movimientosMarcados: 0, detalle: [] };
  }

  const disponibles = new Set(candidatosSinMarcar.map((m: any) => m.id));
  let movimientosMarcados = 0;
  const detalle: { ficheroNombre: string; marcados: number }[] = [];

  for (const fichero of ficherosProcesados) {
    if (fichero.nombre_fichero?.startsWith("TSRLiquidacionCajas_")) continue;

    let contenido: string;
    try {
      contenido = await descargarContenidoXml(tokens, fichero.drive_file_id);
    } catch {
      continue;
    }

    const pagos = parseOfiviajePagosXml(contenido);
    if (pagos.length === 0) continue;

    const pagosConMatch = new Set<OfiviajePago>();
    let marcadosDeEsteFichero = 0;

    for (const mov of candidatosSinMarcar) {
      if (!disponibles.has(mov.id)) continue;
      // No basta con que importe+fecha coincidan (coincide()): el
      // conciliado_externo_datos ya guardado en el movimiento debe
      // corresponder realmente a un pago DE ESTE fichero, si no se
      // marcaría con el _driveFileId de un proceso al que no pertenece
      // (mismo importe/fecha, proveedor/expediente distinto).
      const referenciaGuardada = mov.conciliado_externo_datos?.referenciaProvCte;
      const documentoGuardado = mov.conciliado_externo_datos?.documento;
      const pagoMatch = pagos.find(
        (p) =>
          !pagosConMatch.has(p) &&
          coincide(mov, p) &&
          (referenciaGuardada ? p.referenciaProvCte === referenciaGuardada : true) &&
          (documentoGuardado ? p.documento === documentoGuardado : true)
      );
      if (!pagoMatch) continue;

      pagosConMatch.add(pagoMatch);
      disponibles.delete(mov.id);

      await agencyDb
        .from("contabilidad_movimientos_banco")
        .update({
          conciliado_externo_datos: { ...mov.conciliado_externo_datos, _driveFileId: fichero.drive_file_id },
        })
        .eq("id", mov.id);

      marcadosDeEsteFichero++;
      movimientosMarcados++;
    }

    detalle.push({ ficheroNombre: fichero.nombre_fichero || fichero.drive_file_id, marcados: marcadosDeEsteFichero });
  }

  return { ficherosRevisados: ficherosProcesados.length, movimientosMarcados, detalle };
}

export interface UltimoInformeTareaReal {
  id: string;
  movimientoId: string | null;
  nombre: string;
  expediente: string;
  importe: number;
  movConcepto: string | null;
  movImporte: number | null;
  esCobro: boolean;
}

export interface UltimoInformeReal {
  procesados: number;
  pagosConciliados: number;
  cobrosConciliados: number;
  tareasPorTipo: {
    "Cliente/Proveedor distinto": UltimoInformeTareaReal[];
    "Importe distinto": UltimoInformeTareaReal[];
    "Movimiento bancario no encontrado": UltimoInformeTareaReal[];
  };
}

/**
 * Lee, sin tocar Drive, las tareas pendientes ya persistidas para una cuenta
 * bancaria concreta (o para cobros, que no llevan cuenta) y las agrupa por
 * tipo de incidencia para el modal "Último informe". Mismo patrón que el
 * informe automático diario: se basa en datos ya calculados, no en una
 * comprobación en vivo.
 */
export async function getUltimoInformeReal(cuentaBancariaId: string): Promise<UltimoInformeReal> {
  const agencyDb = await getAgencyDbClient();

  // La cuenta se resuelve por pago.cuentaTesoreria (dato ya guardado dentro
  // de cada fila desde siempre), no solo por la columna cuenta_bancaria_id:
  // así funciona también para filas persistidas antes de añadir esa columna.
  const mapaCuentaContable = await getMapaCuentaContable(agencyDb);

  const { data } = await agencyDb
    .from("ofiviaje_tareas_pendientes")
    .select("id, tipo, datos, es_cobro, cuenta_bancaria_id")
    .eq("resuelta", false);

  const tareasPorTipo: UltimoInformeReal["tareasPorTipo"] = {
    "Cliente/Proveedor distinto": [],
    "Importe distinto": [],
    "Movimiento bancario no encontrado": [],
  };

  for (const fila of data || []) {
    const esCobro = !!fila.es_cobro;
    const datos = fila.datos;
    const pago: OfiviajePago | undefined = datos.pago ?? (fila.tipo === "sinMatch" ? datos : undefined);
    if (!pago) continue;

    if (!esCobro) {
      const cuentaDeLaFila = fila.cuenta_bancaria_id || mapaCuentaContable[pago.cuentaTesoreria] || null;
      if (cuentaDeLaFila && cuentaDeLaFila !== cuentaBancariaId) continue;
    }

    const tarea: UltimoInformeTareaReal = {
      id: fila.id,
      movimientoId: datos.movimientoId ?? null,
      nombre: pago.proveedorNombre,
      expediente: pago.documento,
      importe: pago.importePendiente,
      movConcepto: datos.movimientoConcepto ?? null,
      movImporte: datos.movimientoImporte ?? null,
      esCobro,
    };

    if (fila.tipo === "revisarNombre") tareasPorTipo["Cliente/Proveedor distinto"].push(tarea);
    else if (fila.tipo === "revisarImporte") tareasPorTipo["Importe distinto"].push(tarea);
    else if (fila.tipo === "sinMatch") tareasPorTipo["Movimiento bancario no encontrado"].push(tarea);
  }

  const { count: pagosConciliados } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_bancaria_id", cuentaBancariaId)
    .eq("conciliado_externo", true)
    .lt("importe", 0);

  const { count: cobrosConciliados } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_bancaria_id", cuentaBancariaId)
    .eq("conciliado_externo", true)
    .gt("importe", 0);

  // "Procesados" es el total real de filas leídas de los XML en la última
  // ejecución (cron o comprobación manual), no una aproximación por cuenta:
  // se toman los ficheros procesados el mismo día que el más reciente.
  let procesados = 0;
  const { data: ultimoFichero } = await agencyDb
    .from("ofiviaje_ficheros_procesados")
    .select("procesado_en")
    .order("procesado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimoFichero?.procesado_en) {
    const inicioDia = new Date(ultimoFichero.procesado_en);
    inicioDia.setUTCHours(0, 0, 0, 0);
    const { data: ficherosUltimaEjecucion } = await agencyDb
      .from("ofiviaje_ficheros_procesados")
      .select("pagos_procesados")
      .gte("procesado_en", inicioDia.toISOString());
    procesados = (ficherosUltimaEjecucion || []).reduce((acc: number, f: any) => acc + (f.pagos_procesados || 0), 0);
  }

  return {
    procesados,
    pagosConciliados: pagosConciliados || 0,
    cobrosConciliados: cobrosConciliados || 0,
    tareasPorTipo,
  };
}

export interface OfiviajeConfirmResult {
  conciliados: number;
  error?: string;
}

/**
 * Aplica los matches que el usuario confirmó desde la previsualización: marca
 * los movimientos como conciliados externamente y registra los ficheros como
 * procesados (para que el próximo polling no los vuelva a proponer).
 */
export async function confirmarConciliacionOfiviaje(matches: OfiviajeMatchPropuesto[]): Promise<OfiviajeConfirmResult> {
  if (matches.length === 0) return { conciliados: 0 };

  try {
    const agencyDb = await getAgencyDbClient();
    let conciliados = 0;

    for (const match of matches) {
      const { error: updateError } = await agencyDb
        .from("contabilidad_movimientos_banco")
        .update({
          conciliado_externo: true,
          conciliado_externo_origen: "ofiviaje",
          conciliado_externo_en: new Date().toISOString(),
          conciliado_externo_datos: { ...match.pago, _driveFileId: match.ficheroId },
        })
        .eq("id", match.movimientoId);

      if (!updateError) {
        conciliados++;
        await vincularMovimientoBancoConRegistroOfi(agencyDb, match);
      }
    }

    // Registrar cada fichero involucrado como procesado, una sola vez.
    const ficherosUnicos = new Map(
      matches.map((m) => [m.ficheroId, { id: m.ficheroId, nombre: m.ficheroNombre, modifiedTime: m.ficheroModifiedTime }])
    );
    for (const fichero of ficherosUnicos.values()) {
      const pagosDelFichero = matches.filter((m) => m.ficheroId === fichero.id);
      await agencyDb.from("ofiviaje_ficheros_procesados").insert({
        drive_file_id: fichero.id,
        drive_modified_time: fichero.modifiedTime,
        nombre_fichero: fichero.nombre,
        pagos_procesados: pagosDelFichero.length,
        movimientos_conciliados: pagosDelFichero.length,
        origen: "manual",
      });
    }

    return { conciliados };
  } catch (error: any) {
    return { conciliados: 0, error: error.message || "Error al confirmar la conciliación con OFIviaje." };
  }
}

/**
 * Flujo cron (sin confirmación humana): calcula y aplica directamente los
 * matches de los ficheros nuevos para la agencia dada.
 */
/**
 * Igual que comprobarOfiviajeParaAgencia (sin modal de confirmación previo:
 * aplica directamente los matches encontrados), pero para el usuario actual
 * desde la app — lo usa el botón "Procesar archivos" del historial. Se
 * registra con origen "manual" para distinguirlo del cron en el historial.
 */
/**
 * Reprocesa un único fichero OFIviaje ya descargado/parseado: recalcula
 * matches con el contenido XML actual (útil tras crear un alias de
 * proveedor o corregir la lógica de fechas) y aplica los cambios sobre
 * las tareas pendientes de ESE fichero para cualquier tipo de incidencia
 * (revisarNombre, revisarImporte, revisarSuma, revisarDivision) sin
 * borrarlas ni duplicarlas: las que ahora sí concilian se marcan
 * `resuelta` (siguen visibles en el listado con ese estado), el resto se
 * deja intacto. También cubre el caso de tareas "huérfanas" cuyo
 * movimiento ya estaba conciliado (por una pasada anterior o
 * manualmente) sin que la tarea llegara a resolverse.
 */
async function reprocesarFicheroConContenido(
  agencyDb: any,
  fichero: { id: string; nombre: string; modifiedTime: string },
  contenido: string
): Promise<{ procesados: number; conciliados: number }> {
  const { data: tareasPendientes } = await agencyDb
    .from("ofiviaje_tareas_pendientes")
    .select("id, tipo, datos")
    .eq("drive_file_id", fichero.id)
    .eq("resuelta", false);

  if (!tareasPendientes || tareasPendientes.length === 0) {
    return { procesados: 0, conciliados: 0 };
  }

  const result = await calcularMatchesFicheroXml(agencyDb, contenido, fichero);

  const movimientoIdsConciliados = new Set<string>();

  let conciliados = 0;
  for (const match of result.matches) {
    const { error: updateError } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({
        conciliado_externo: true,
        conciliado_externo_origen: "ofiviaje",
        conciliado_externo_en: new Date().toISOString(),
        conciliado_externo_datos: { ...match.pago, _driveFileId: fichero.id },
      })
      .eq("id", match.movimientoId);
    if (!updateError) {
      conciliados++;
      movimientoIdsConciliados.add(match.movimientoId);
      await vincularMovimientoBancoConRegistroOfi(agencyDb, match);
    }
  }

  // movimientoId (revisarNombre/revisarImporte) o movimientoIds[0]
  // (revisarSuma) — la tarea se resuelve si CUALQUIERA de sus
  // movimientos asociados ya está gestionado.
  const movimientoIdsDeLaTarea = (datos: any): string[] => {
    if (Array.isArray(datos?.movimientoIds)) return datos.movimientoIds;
    return datos?.movimientoId ? [datos.movimientoId] : [];
  };

  // Un movimiento puede haberse conciliado en ESTA pasada (recién
  // añadido a movimientoIdsConciliados) o en una pasada anterior (la
  // query de candidatos de calcularMatchesFicheroXml excluye movimientos
  // ya conciliados, así que nunca volvería a aparecer en result.matches)
  // o haber sido gestionado manualmente por otra vía (estado='conciliado'
  // sin pasar por OFIviaje). En cualquiera de esos casos la tarea debe
  // marcarse resuelta igual, para no quedar huérfana para siempre.
  const todosLosMovimientoIds = tareasPendientes.flatMap((fila: any) => movimientoIdsDeLaTarea(fila.datos));
  const movimientoIdsPendientes = todosLosMovimientoIds.filter((id: string) => !movimientoIdsConciliados.has(id));

  if (movimientoIdsPendientes.length > 0) {
    const { data: movsYaConciliados } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id")
      .in("id", movimientoIdsPendientes)
      .or("conciliado_externo.eq.true,estado.eq.conciliado");
    for (const mov of movsYaConciliados || []) {
      movimientoIdsConciliados.add(mov.id);
    }
  }

  const idsAResolver = tareasPendientes
    .filter((fila: any) => movimientoIdsDeLaTarea(fila.datos).some((id) => movimientoIdsConciliados.has(id)))
    .map((fila: any) => fila.id);

  if (idsAResolver.length > 0) {
    await agencyDb
      .from("ofiviaje_tareas_pendientes")
      .update({ resuelta: true, resuelta_en: new Date().toISOString() })
      .in("id", idsAResolver);
  }

  await agencyDb
    .from("ofiviaje_ficheros_procesados")
    .update({ ultimo_reproceso_en: new Date().toISOString(), origen: "manual" })
    .eq("drive_file_id", fichero.id);

  return { procesados: result.procesados, conciliados };
}

/**
 * Reprocesa un fichero OFIviaje ya procesado anteriormente (identificado por
 * drive_file_id), tras crear un alias de proveedor o corregir la lógica de
 * matching: recalcula sus incidencias pendientes (de cualquier tipo) y
 * aplica los cambios. Ver reprocesarFicheroConContenido para el detalle.
 */
export async function reprocesarFicheroOfiviaje(driveFileId: string): Promise<{
  procesados: number;
  conciliados: number;
  error?: string;
}> {
  try {
    const tokens = await getDriveTokensUsuarioActual();
    const agencyDb = await getAgencyDbClient();

    const ficheros = await listarXmlEnCarpeta(tokens);
    const fichero = ficheros.find((f) => f.id === driveFileId);
    if (!fichero) return { procesados: 0, conciliados: 0, error: "No se encontró el fichero en Drive." };

    const contenido = await descargarContenidoXml(tokens, fichero.id);
    const { procesados, conciliados } = await reprocesarFicheroConContenido(agencyDb, fichero, contenido);
    return { procesados, conciliados };
  } catch (error: any) {
    return { procesados: 0, conciliados: 0, error: error.message || "Error al reprocesar el fichero." };
  }
}

export async function forzarProcesoOfiviajeUsuarioActual(): Promise<{
  ficherosNuevos: number;
  procesados: number;
  conciliados: number;
  error?: string;
}> {
  const tokens = await getDriveTokensUsuarioActual();
  const agencyDb = await getAgencyDbClient();
  return comprobarOfiviajeParaAgencia(agencyDb, tokens, "manual");
}

/**
 * Reprocesa TODOS los ficheros OFIviaje ya registrados en
 * ofiviaje_ficheros_procesados (no solo los nuevos, a diferencia de
 * forzarProcesoOfiviajeUsuarioActual), recalculando sus incidencias
 * pendientes con el contenido XML actual y los alias/lógica de matching
 * vigentes. Útil tras crear varios alias de proveedor o corregir la
 * lógica de fechas, para ver de una vez si baja el número de incidencias
 * y sube el de conciliados en todo el histórico.
 */
export async function reprocesarTodosLosFicherosOfiviaje(): Promise<{
  ficherosRevisados: number;
  procesados: number;
  conciliados: number;
  error?: string;
}> {
  try {
    const tokens = await getDriveTokensUsuarioActual();
    const agencyDb = await getAgencyDbClient();

    const { data: ficherosProcesados } = await agencyDb
      .from("ofiviaje_ficheros_procesados")
      .select("drive_file_id, nombre_fichero")
      .order("procesado_en", { ascending: false });

    if (!ficherosProcesados || ficherosProcesados.length === 0) {
      return { ficherosRevisados: 0, procesados: 0, conciliados: 0 };
    }

    const driveFileIdsUnicos = [...new Map(ficherosProcesados.map((f: any) => [f.drive_file_id, f])).values()];

    const ficherosDrive = await listarXmlEnCarpeta(tokens);
    const ficheroDrivePorId = new Map(ficherosDrive.map((f) => [f.id, f]));

    let procesados = 0;
    let conciliados = 0;
    let ficherosRevisados = 0;

    for (const fila of driveFileIdsUnicos) {
      const ficheroDrive = ficheroDrivePorId.get((fila as any).drive_file_id);
      if (!ficheroDrive) continue; // fichero ya no existe en Drive, no se puede reprocesar

      try {
        const contenido = await descargarContenidoXml(tokens, ficheroDrive.id);
        const resultado = await reprocesarFicheroConContenido(agencyDb, ficheroDrive, contenido);
        procesados += resultado.procesados;
        conciliados += resultado.conciliados;
        ficherosRevisados++;
      } catch {
        continue;
      }
    }

    return { ficherosRevisados, procesados, conciliados };
  } catch (error: any) {
    return {
      ficherosRevisados: 0,
      procesados: 0,
      conciliados: 0,
      error: error.message || "Error al reprocesar los ficheros.",
    };
  }
}

export async function comprobarOfiviajeParaAgencia(
  agencyDb: any,
  tokens: DriveTokens,
  origen: "manual" | "automatico" = "automatico"
): Promise<{ ficherosNuevos: number; procesados: number; conciliados: number; error?: string }> {
  try {
    const ficheros = await listarXmlEnCarpeta(tokens);
    if (ficheros.length === 0) return { ficherosNuevos: 0, procesados: 0, conciliados: 0 };

    const { data: yaProcesados } = await agencyDb
      .from("ofiviaje_ficheros_procesados")
      .select("drive_file_id, drive_modified_time")
      .in(
        "drive_file_id",
        ficheros.map((f) => f.id)
      );

    const procesadosSet = new Set(
      (yaProcesados || []).map((p: any) => `${p.drive_file_id}::${new Date(p.drive_modified_time).toISOString()}`)
    );
    const nuevos = ficheros.filter((f) => !procesadosSet.has(`${f.id}::${new Date(f.modifiedTime).toISOString()}`));

    let procesados = 0;
    let conciliados = 0;

    for (const fichero of nuevos) {
      const contenido = await descargarContenidoXml(tokens, fichero.id);
      const result = await calcularMatchesFicheroXml(agencyDb, contenido, fichero);
      procesados += result.procesados;

      for (const match of result.matches) {
        const { error: updateError } = await agencyDb
          .from("contabilidad_movimientos_banco")
          .update({
            conciliado_externo: true,
            conciliado_externo_origen: "ofiviaje",
            conciliado_externo_en: new Date().toISOString(),
            conciliado_externo_datos: { ...match.pago, _driveFileId: fichero.id },
          })
          .eq("id", match.movimientoId);
        if (!updateError) {
          conciliados++;
          await vincularMovimientoBancoConRegistroOfi(agencyDb, match);
        }
      }

      // Persistir lo que no se resolvió automáticamente, para que siga
      // siendo visible en el informe una vez el fichero se marque procesado.
      await persistirTareasPendientes(agencyDb, fichero, result);

      await agencyDb.from("ofiviaje_ficheros_procesados").insert({
        drive_file_id: fichero.id,
        drive_modified_time: fichero.modifiedTime,
        nombre_fichero: fichero.nombre,
        pagos_procesados: result.procesados,
        movimientos_conciliados: result.matches.length,
        origen,
      });
    }

    return { ficherosNuevos: nuevos.length, procesados, conciliados };
  } catch (error: any) {
    return { ficherosNuevos: 0, procesados: 0, conciliados: 0, error: error.message || "Error al comprobar OFIviaje." };
  }
}

function formatearImporte(valor: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.abs(valor));
}

/**
 * Construye el HTML del informe de conciliación OFIviaje a partir de una
 * previsualización ya calculada, con las mismas categorías que se muestran
 * en el modal de la app (conciliar, revisar en OFI, sin movimiento, ya conciliados).
 */
function construirHtmlInformeOfiviaje(preview: OfiviajePreview): string {
  const estiloSeccion = "font-size:12px;font-weight:700;text-transform:uppercase;margin:20px 0 8px;";
  const estiloItem = "padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;";
  const estiloMuted = "color:#94a3b8;font-size:11px;margin-top:4px;";

  const fechaHoy = new Date().toLocaleDateString("es-ES");

  let html = `<div style="font-family:sans-serif;color:#334155;max-width:640px;">`;
  html += `<h2 style="font-size:16px;margin:0 0 8px;">Informe de conciliación OFIviaje</h2>`;
  html += `<p style="font-size:13px;color:#334155;">Buenos días, te detallo el resultado de la conciliación automática de OFIviaje en el día ${fechaHoy}.</p>`;
  html += `<p style="font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 4px;">RESULTADO DE LA CONCILIACIÓN:</p>`;
  html += `<p style="font-size:13px;color:#64748b;">${preview.ficherosNuevos} fichero(s) nuevo(s), ${preview.procesados} pago(s) leído(s). `;
  html += `Se proponen <strong>${preview.matches.length}</strong> movimiento(s) a conciliar`;
  const totalRevisar = (preview.revisarNombre?.length || 0) + (preview.revisarImporte?.length || 0) + (preview.revisarSuma?.length || 0) + (preview.revisarDivision?.length || 0);
  if (totalRevisar > 0) html += ` · <strong>${totalRevisar}</strong> a revisar en OFI`;
  if (preview.sinMatch?.length > 0) html += ` · <strong>${preview.sinMatch.length}</strong> sin movimiento bancario encontrado`;
  if (preview.yaConciliados > 0) html += ` · <strong>${preview.yaConciliados}</strong> ya conciliado(s) previamente`;
  html += `.</p>`;

  if (preview.matches.length > 0) {
    html += `<div style="${estiloSeccion}color:#15803d;">Se van a conciliar</div>`;
    for (const m of preview.matches) {
      html += `<div style="${estiloItem}"><div style="font-weight:600;color:#0f172a;">${m.movimientoConcepto || "Movimiento sin concepto"}</div>`;
      html += `<div style="display:flex;justify-content:space-between;color:#64748b;margin-top:2px;"><span>${m.movimientoFecha} · ${m.pago.proveedorNombre}</span><span style="font-weight:700;">${formatearImporte(m.movimientoImporte)}</span></div>`;
      html += `<div style="${estiloMuted}">Doc: ${m.pago.documento} · Expediente OFI: ${m.pago.referenciaProvCte} · Doc. cobro/pago: ${m.pago.documentoCobroPago} · Pasajero: ${m.pago.nombrePasajero}</div></div>`;
    }
  }

  if (totalRevisar > 0) {
    html += `<div style="${estiloSeccion}color:#dc2626;">Revisar en OFI</div>`;
    html += `<div style="font-size:11px;color:#94a3b8;font-style:italic;margin-bottom:8px;">Los datos contables de OFIviaje deben adaptarse al extracto bancario para garantizar el correcto punteado de las cuentas.</div>`;

    for (const m of preview.revisarNombre || []) {
      html += `<div style="${estiloItem}"><div style="font-weight:600;color:#0f172a;">Proveedor distinto</div>`;
      html += `<div style="display:flex;justify-content:space-between;color:#64748b;margin-top:4px;"><span>Banco: ${m.movimientoConcepto || "Movimiento sin concepto"} · ${m.movimientoFecha}</span><span style="font-weight:700;color:#dc2626;">${formatearImporte(m.movimientoImporte)}</span></div>`;
      html += `<div style="border-top:1px solid #f1f5f9;margin:6px 0;"></div>`;
      html += `<div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:11px;"><span>XML: ${m.pago.proveedorNombre} · ${m.pago.fechaVencto}</span><span>${formatearImporte(m.pago.importePendiente)}</span></div>`;
      html += `<div style="${estiloMuted}">Doc: ${m.pago.documento} · Expediente OFI: ${m.pago.referenciaProvCte} · Doc. cobro/pago: ${m.pago.documentoCobroPago} · Pasajero: ${m.pago.nombrePasajero}</div></div>`;
    }

    for (const m of preview.revisarImporte || []) {
      html += `<div style="${estiloItem}"><div style="font-weight:600;color:#0f172a;">Importe distinto</div>`;
      html += `<div style="display:flex;justify-content:space-between;color:#64748b;margin-top:4px;"><span>Banco: ${m.movimientoConcepto || "Movimiento sin concepto"} · ${m.movimientoFecha}</span><span style="font-weight:700;color:#dc2626;">${formatearImporte(m.movimientoImporte)}</span></div>`;
      html += `<div style="border-top:1px solid #f1f5f9;margin:6px 0;"></div>`;
      html += `<div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:11px;"><span>XML: ${m.pago.proveedorNombre} · ${m.pago.fechaVencto}</span><span>${formatearImporte(m.pago.importePendiente)}</span></div>`;
      html += `<div style="${estiloMuted}">Doc: ${m.pago.documento} · Expediente OFI: ${m.pago.referenciaProvCte} · Doc. cobro/pago: ${m.pago.documentoCobroPago}</div></div>`;
    }

    for (const m of preview.revisarSuma || []) {
      html += `<div style="${estiloItem}"><div style="font-weight:600;color:#0f172a;">Un pago OFI = 2 movimientos bancarios</div>`;
      for (const idx of [0, 1] as const) {
        html += `<div style="display:flex;justify-content:space-between;color:#64748b;margin-top:4px;"><span>Banco: ${m.movimientoConceptos[idx]} · ${m.movimientoFechas[idx]}</span><span style="font-weight:700;color:#dc2626;">${formatearImporte(m.movimientoImportes[idx])}</span></div>`;
      }
      html += `<div style="border-top:1px solid #f1f5f9;margin:6px 0;"></div>`;
      html += `<div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:11px;"><span>XML: ${m.pago.proveedorNombre} · ${m.pago.fechaVencto}</span><span>${formatearImporte(m.pago.importePendiente)}</span></div>`;
      html += `<div style="${estiloMuted}">Doc: ${m.pago.documento} · Expediente OFI: ${m.pago.referenciaProvCte} · Doc. cobro/pago: ${m.pago.documentoCobroPago}</div></div>`;
    }

    for (const m of preview.revisarDivision || []) {
      html += `<div style="${estiloItem}"><div style="font-weight:600;color:#0f172a;">Un movimiento bancario = ${m.pagos.length} pagos OFI</div>`;
      html += `<div style="display:flex;justify-content:space-between;color:#64748b;margin-top:4px;"><span>Banco: ${m.movimientoConcepto || "Movimiento sin concepto"} · ${m.movimientoFecha}</span><span style="font-weight:700;color:#dc2626;">${formatearImporte(m.movimientoImporte)}</span></div>`;
      html += `<div style="border-top:1px solid #f1f5f9;margin:6px 0;"></div>`;
      for (const p of m.pagos) {
        html += `<div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:11px;"><span>XML: ${p.proveedorNombre} · ${p.fechaVencto} · Doc: ${p.documento} · Expediente OFI: ${p.referenciaProvCte}</span><span>${formatearImporte(p.importePendiente)}</span></div>`;
      }
    }
  }

  if (preview.sinMatch?.length > 0) {
    html += `<div style="${estiloSeccion}color:#b45309;">Sin movimiento bancario encontrado</div>`;
    for (const p of preview.sinMatch) {
      html += `<div style="${estiloItem}"><div style="font-weight:600;color:#0f172a;">${p.proveedorNombre}</div>`;
      html += `<div style="display:flex;justify-content:space-between;color:#64748b;margin-top:2px;"><span>${p.fechaVencto} · ${p.nombrePasajero}</span><span style="font-weight:700;color:#b45309;">${formatearImporte(p.importePendiente)}</span></div>`;
      html += `<div style="${estiloMuted}">Doc: ${p.documento} · Doc. cobro/pago: ${p.documentoCobroPago}</div></div>`;
    }
  }

  html += `</div>`;
  return html;
}

/**
 * Resuelve el transporter SMTP y el remitente a partir de la configuración de
 * correo de un usuario (sesión actual, o explícito vía `usuarioId` para uso
 * server-to-server sin sesión, p.ej. desde el cron).
 */
async function crearTransporterYRemitente(
  usuarioId?: string
): Promise<{ transporter: nodemailer.Transporter; remitente: string } | { error: string }> {
  const configRes = usuarioId ? await getUserEmailConfigById(usuarioId) : await getCurrentUserEmailConfig();
  if (!configRes.success || !configRes.data?.email_address) {
    return { error: "No hay configuración de correo activa. Configura tu cuenta en Ajustes > Correo." };
  }

  const config = configRes.data;
  const isGmail = config.email_provider === "gmail" || config.email_address?.endsWith("@gmail.com") || config.email_address?.endsWith("@googlemail.com");
  const smtpHost = config.email_smtp_host || (isGmail ? "smtp.gmail.com" : "smtp.office365.com");
  const smtpPort = config.email_smtp_port ? Number(config.email_smtp_port) : 587;
  const secure = smtpPort === 465;

  const emailPassword = verifyToken(config.email_password_enc || "");
  if (!emailPassword) {
    return { error: "No se pudo descifrar la contraseña de correo. Vuelve a guardar tu configuración en Ajustes → Correo." };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: { type: "LOGIN", user: config.email_address, pass: emailPassword },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    socketTimeout: 30000,
  });

  return { transporter, remitente: config.email_address };
}

/**
 * Envía por email el informe de conciliación OFIviaje ya calculado en la
 * previsualización, a uno o varios destinatarios. Usa la configuración SMTP
 * del usuario actual (sesión) por defecto, o la de un usuario concreto vía
 * `usuarioId` cuando se invoca server-to-server (cron, sin sesión).
 */
export async function enviarInformeOfiviajePorEmail(
  preview: OfiviajePreview,
  destinatarios: string | string[],
  usuarioId?: string
): Promise<{ success: boolean; error?: string }> {
  const destinatariosValidos = (Array.isArray(destinatarios) ? destinatarios : [destinatarios])
    .map((d) => d.trim())
    .filter((d) => d.includes("@"));

  if (destinatariosValidos.length === 0) {
    return { success: false, error: "Introduce al menos un email válido." };
  }

  const resolved = await crearTransporterYRemitente(usuarioId);
  if ("error" in resolved) return { success: false, error: resolved.error };

  try {
    await resolved.transporter.sendMail({
      from: `"${resolved.remitente}" <${resolved.remitente}>`,
      to: destinatariosValidos.join(", "),
      subject: `Informe de conciliación OFIviaje - ${new Date().toLocaleDateString("es-ES")}`,
      html: construirHtmlInformeOfiviaje(preview),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al enviar el email." };
  }
}

/**
 * Envía un HTML de informe ya construido (sin depender de OfiviajePreview) a
 * uno o varios destinatarios. Usa la configuración SMTP de un usuario
 * concreto vía `usuarioId` (comunicaciones automáticas, cron sin sesión), o
 * la del usuario de la sesión actual cuando se omite (envío manual desde la UI).
 */
export async function enviarInformeHtmlPorEmail(
  html: string,
  destinatarios: string | string[],
  usuarioId: string | undefined,
  subject: string
): Promise<{ success: boolean; error?: string }> {
  const destinatariosValidos = (Array.isArray(destinatarios) ? destinatarios : [destinatarios])
    .map((d) => d.trim())
    .filter((d) => d.includes("@"));

  if (destinatariosValidos.length === 0) {
    return { success: false, error: "No hay destinatarios válidos." };
  }

  const resolved = await crearTransporterYRemitente(usuarioId);
  if ("error" in resolved) return { success: false, error: resolved.error };

  try {
    await resolved.transporter.sendMail({
      from: `"${resolved.remitente}" <${resolved.remitente}>`,
      to: destinatariosValidos.join(", "),
      subject,
      html,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al enviar el email." };
  }
}

/**
 * TEMPORAL (herramienta de mantenimiento puntual, solo lectura): busca en
 * todos los ficheros de pagos ya existentes en Drive el proveedorNombre
 * correspondiente a una lista de documentos (números de pago OFI), sin
 * escribir nada en BD ni en Drive. Sirve para reconstruir alias
 * proveedor↔banco que no se crearon en su momento.
 */
export async function buscarProveedorPorDocumento(documentos: string[]): Promise<Record<string, string>> {
  const tokens = await getDriveTokensUsuarioActual();
  const ficheros = await listarXmlEnCarpeta(tokens);
  const buscados = new Set(documentos);
  const resultado: Record<string, string> = {};

  for (const fichero of ficheros) {
    if (fichero.nombre.startsWith("TSRLiquidacionCajas_")) continue;
    if (buscados.size === 0) break;

    let contenido: string;
    try {
      contenido = await descargarContenidoXml(tokens, fichero.id);
    } catch {
      continue;
    }

    const pagos = parseOfiviajePagosXml(contenido);
    for (const pago of pagos) {
      if (buscados.has(pago.documento)) {
        resultado[pago.documento] = pago.proveedorNombre;
        buscados.delete(pago.documento);
      }
    }
  }

  return resultado;
}

/**
 * Al conciliar manualmente con un Expediente OFI indicado, busca ese
 * documento en los ficheros de pagos de Drive y, si el proveedor real no
 * comparte ningún token con el concepto bancario del movimiento, guarda el
 * alias automáticamente — igual que ya ocurre al conciliar una tarea
 * "Cliente/Proveedor distinto" desde el listado, pero para cualquier
 * conciliación manual con expediente. No falla la conciliación si algo va
 * mal aquí (best-effort).
 */
export async function intentarGuardarAliasSiNoCoincide(
  agencyDb: any,
  movimientoBancoId: string,
  expedienteOfi: string
): Promise<void> {
  const { data: movimiento } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("concepto_original")
    .eq("id", movimientoBancoId)
    .maybeSingle();

  const conceptoOriginal = movimiento?.concepto_original || "";
  if (!conceptoOriginal) return;

  const proveedores = await buscarProveedorPorDocumento([expedienteOfi]);
  const proveedorNombre = proveedores[expedienteOfi];
  if (!proveedorNombre) return;

  const tokensConcepto = new Set(tokenizarNombre(conceptoOriginal));
  const tokensProveedor = tokenizarNombre(proveedorNombre);
  const coincide = tokensProveedor.some((t) => tokensConcepto.has(t));
  if (coincide) return;

  await guardarAliasProveedorOfi(proveedorNombre, conceptoOriginal);
}

/**
 * TEMPORAL (herramienta de mantenimiento puntual, solo lectura): lista todos
 * los proveedores únicos que aparecen en los ficheros de pagos de Drive
 * junto con un importe/fecha de alguno de sus vencimientos, para poder
 * identificar a ojo cuál corresponde a un concepto bancario dado (cuando no
 * se conoce el documento OFI exacto). No escribe nada en BD ni en Drive.
 */
export async function listarProveedoresUnicosOfi(): Promise<{ proveedorNombre: string; ejemploDocumento: string; ejemploImporte: number }[]> {
  const tokens = await getDriveTokensUsuarioActual();
  const ficheros = await listarXmlEnCarpeta(tokens);
  const vistos = new Map<string, { documento: string; importe: number }>();

  for (const fichero of ficheros) {
    if (fichero.nombre.startsWith("TSRLiquidacionCajas_")) continue;

    let contenido: string;
    try {
      contenido = await descargarContenidoXml(tokens, fichero.id);
    } catch {
      continue;
    }

    const pagos = parseOfiviajePagosXml(contenido);
    for (const pago of pagos) {
      if (!vistos.has(pago.proveedorNombre)) {
        vistos.set(pago.proveedorNombre, { documento: pago.documento, importe: pago.importePendiente });
      }
    }
  }

  return Array.from(vistos.entries()).map(([proveedorNombre, datos]) => ({
    proveedorNombre,
    ejemploDocumento: datos.documento,
    ejemploImporte: datos.importe,
  }));
}

/**
 * TEMPORAL (herramienta de mantenimiento puntual, solo lectura): busca en
 * todos los ficheros de pagos de Drive los vencimientos cuyo importe
 * (en valor absoluto, con tolerancia de 1 céntimo) coincida con alguno de
 * los indicados, para identificar el proveedor real cuando no se conoce el
 * documento OFI. No escribe nada en BD ni en Drive.
 */
export async function buscarProveedorPorImporte(
  importes: number[]
): Promise<{ importeBuscado: number; documento: string; proveedorNombre: string; fechaVencto: string }[]> {
  const tokens = await getDriveTokensUsuarioActual();
  const ficheros = await listarXmlEnCarpeta(tokens);
  const objetivos = importes.map((i) => Math.abs(i));
  const encontrados: { importeBuscado: number; documento: string; proveedorNombre: string; fechaVencto: string }[] = [];

  for (const fichero of ficheros) {
    if (fichero.nombre.startsWith("TSRLiquidacionCajas_")) continue;

    let contenido: string;
    try {
      contenido = await descargarContenidoXml(tokens, fichero.id);
    } catch {
      continue;
    }

    const pagos = parseOfiviajePagosXml(contenido);
    for (const pago of pagos) {
      for (const objetivo of objetivos) {
        if (Math.abs(pago.importePendiente - objetivo) <= 0.01) {
          encontrados.push({
            importeBuscado: objetivo,
            documento: pago.documento,
            proveedorNombre: pago.proveedorNombre,
            fechaVencto: pago.fechaVencto,
          });
        }
      }
    }
  }

  return encontrados;
}
