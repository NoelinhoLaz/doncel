import nodemailer from "nodemailer";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { parseOfiviajePagosXml, parseOfiviajeFecha, type OfiviajePago } from "./ofiviajeParser";
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

function fechaCoincide(movimiento: any, pago: OfiviajePago): boolean {
  const fechasXml = [parseOfiviajeFecha(pago.fechaVencto), parseOfiviajeFecha(pago.fechaDoc)].filter(
    (f): f is string => !!f
  );
  const fechasMov = [movimiento.fecha_operacion, movimiento.fecha_valor].filter(Boolean);

  for (const fXml of fechasXml) {
    for (const fMov of fechasMov) {
      if (diasEntre(fXml, fMov) <= TOLERANCIA_DIAS) return true;
    }
  }
  return false;
}

function coincide(movimiento: any, pago: OfiviajePago): boolean {
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

// En el concepto bancario el código de localizador viene precedido de "LOC"
// (ej. "Locvg2133"); en OFIviaje el mismo código aparece "pelado" en el campo
// Doc. cobro/pago (ej. "VG2133"). Se extrae de cada lado y se compara el
// código alfanumérico normalizado, ignorando el prefijo "LOC".
const REGEX_CODIGO_LOC = /LOC\s?-?\s?([A-Z0-9]{3,})/i;

function extraerCodigoLoc(texto: string): string | null {
  const m = (texto || "").match(REGEX_CODIGO_LOC);
  return m ? m[1].toUpperCase() : null;
}

function normalizarCodigo(texto: string): string {
  return (texto || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function codigoLocCoincide(movimiento: any, pago: OfiviajePago): boolean {
  const codigoConcepto = extraerCodigoLoc(movimiento.concepto_original || "");
  const codigoPago = normalizarCodigo(pago.documentoCobroPago || "");
  if (!codigoConcepto || !codigoPago) return false;
  return codigoConcepto === codigoPago;
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
 */
function nombreCoincide(movimiento: any, pago: OfiviajePago): boolean {
  const tokensConcepto = new Set(tokenizarNombre(movimiento.concepto_original || ""));
  const tokensProveedor = tokenizarNombre(pago.proveedorNombre);
  if (tokensProveedor.length === 0) return true; // sin nombre de proveedor, no se puede evaluar: no bloquear

  return tokensProveedor.some((t) => tokensConcepto.has(t));
}

export interface OfiviajeMatchPropuesto {
  movimientoId: string;
  movimientoImporte: number;
  movimientoFecha: string;
  movimientoConcepto: string;
  pago: OfiviajePago;
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
    const pagoMatch = pagos.find((p) => !pagosConMatch.has(p) && coincide(mov, p));
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
    if (nombreCoincide(mov, pagoMatch)) {
      matches.push(propuesta);
    } else {
      revisarNombre.push(propuesta);
    }
  }

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
      (p) => !pagosConMatch.has(p) && coincideImporteAproximado(mov, p) && nombreCoincide(mov, p)
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
 * Calcula (sin escribir nada en BD) qué movimientos se conciliarían con los
 * pagos de los ficheros XML nuevos de la carpeta de Drive del usuario actual.
 * El resultado se muestra al usuario para que confirme antes de aplicar cambios.
 */
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
      const result = await calcularMatchesXmlContenido(agencyDb, contenido, fichero);
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
    const persistidas = await leerTareasPendientesPersistidas(agencyDb);

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
  const filas: any[] = [];
  for (const datos of result.revisarNombre) filas.push({ tipo: "revisarNombre", datos });
  for (const datos of result.revisarImporte) filas.push({ tipo: "revisarImporte", datos });
  for (const datos of result.revisarSuma) filas.push({ tipo: "revisarSuma", datos });
  for (const datos of result.revisarDivision) filas.push({ tipo: "revisarDivision", datos });
  for (const datos of result.sinMatch) filas.push({ tipo: "sinMatch", datos });

  if (filas.length === 0) return;

  await agencyDb.from("ofiviaje_tareas_pendientes").insert(
    filas.map((f) => ({
      tipo: f.tipo,
      datos: f.datos,
      drive_file_id: fichero.id,
      drive_file_nombre: fichero.nombre,
    }))
  );
}

/**
 * Lee las tareas pendientes ya persistidas (no resueltas) y las agrupa por
 * tipo, en el mismo shape que devuelve calcularMatchesXmlContenido, para
 * fusionarlas con lo recién calculado sobre ficheros nuevos.
 */
async function leerTareasPendientesPersistidas(agencyDb: any): Promise<{
  revisarNombre: OfiviajeMatchPropuesto[];
  revisarImporte: OfiviajeRevisarImporte[];
  revisarSuma: OfiviajeRevisarSuma[];
  revisarDivision: OfiviajeRevisarDivision[];
  sinMatch: OfiviajePago[];
}> {
  const vacio = { revisarNombre: [], revisarImporte: [], revisarSuma: [], revisarDivision: [], sinMatch: [] };
  const { data } = await agencyDb
    .from("ofiviaje_tareas_pendientes")
    .select("tipo, datos")
    .eq("resuelta", false);

  if (!data || data.length === 0) return vacio;

  const resultado = { revisarNombre: [], revisarImporte: [], revisarSuma: [], revisarDivision: [], sinMatch: [] } as any;
  for (const fila of data) {
    if (resultado[fila.tipo]) resultado[fila.tipo].push(fila.datos);
  }
  return resultado;
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
          conciliado_externo_datos: match.pago,
        })
        .eq("id", match.movimientoId);

      if (!updateError) conciliados++;
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
export async function comprobarOfiviajeParaAgencia(
  agencyDb: any,
  tokens: DriveTokens
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
      const result = await calcularMatchesXmlContenido(agencyDb, contenido, fichero);
      procesados += result.procesados;

      for (const match of result.matches) {
        const { error: updateError } = await agencyDb
          .from("contabilidad_movimientos_banco")
          .update({
            conciliado_externo: true,
            conciliado_externo_origen: "ofiviaje",
            conciliado_externo_en: new Date().toISOString(),
            conciliado_externo_datos: match.pago,
          })
          .eq("id", match.movimientoId);
        if (!updateError) conciliados++;
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
