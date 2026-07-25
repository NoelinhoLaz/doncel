import { getAgencyDbClient } from "@/lib/agencyDb";
import { parseOfiviajePagosXml, parseOfiviajeFecha, type OfiviajePago } from "./ofiviajeParser";
import {
  listarXmlEnCarpeta,
  descargarContenidoXml,
  getDriveTokensUsuarioActual,
  type DriveTokens,
} from "./ofiviajeDrive";

const TOLERANCIA_DIAS = 3;
const TOLERANCIA_IMPORTE = 0.01;

function diasEntre(fechaA: string, fechaB: string): number {
  const a = new Date(fechaA).getTime();
  const b = new Date(fechaB).getTime();
  return Math.abs(a - b) / 86400000;
}

function coincide(movimiento: any, pago: OfiviajePago): boolean {
  const importeMov = Math.abs(Number(movimiento.importe));
  if (Math.abs(importeMov - pago.importePendiente) > TOLERANCIA_IMPORTE) return false;

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
): Promise<{ procesados: number; matches: OfiviajeMatchPropuesto[] }> {
  const pagos = parseOfiviajePagosXml(xmlContent);
  if (pagos.length === 0) return { procesados: 0, matches: [] };

  const mapaCuentaContable = await getMapaCuentaContable(agencyDb);

  // Solo pagos (XML de OFIviaje en esta carpeta son siempre salidas/pagos, no ingresos):
  // los movimientos candidatos se restringen a importe negativo.
  const cuentaBancariaIds = [
    ...new Set(pagos.map((p) => mapaCuentaContable[p.cuentaTesoreria]).filter((id): id is string => !!id)),
  ];

  if (cuentaBancariaIds.length === 0) return { procesados: pagos.length, matches: [] };

  const { data: movimientos, error } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, importe, fecha_operacion, fecha_valor, concepto_original, estado, conciliado_externo")
    .in("estado", ["pendiente", "propuesto", "parcial"])
    .eq("conciliado_externo", false)
    .in("cuenta_bancaria_id", cuentaBancariaIds)
    .lt("importe", 0);

  if (error || !movimientos) return { procesados: pagos.length, matches: [] };

  const matches: OfiviajeMatchPropuesto[] = [];
  for (const mov of movimientos) {
    const pagoMatch = pagos.find((p) => coincide(mov, p));
    if (!pagoMatch) continue;

    matches.push({
      movimientoId: mov.id,
      movimientoImporte: Number(mov.importe),
      movimientoFecha: mov.fecha_operacion,
      movimientoConcepto: mov.concepto_original || "",
      pago: pagoMatch,
      ficheroId: fichero.id,
      ficheroNombre: fichero.nombre,
      ficheroModifiedTime: fichero.modifiedTime,
    });
  }

  return { procesados: pagos.length, matches };
}

export interface OfiviajePreview {
  ficherosNuevos: number;
  procesados: number;
  matches: OfiviajeMatchPropuesto[];
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
      return { ficherosNuevos: 0, procesados: 0, matches: [] };
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
    const matches: OfiviajeMatchPropuesto[] = [];

    for (const fichero of nuevos) {
      const contenido = await descargarContenidoXml(tokens, fichero.id);
      const result = await calcularMatchesXmlContenido(agencyDb, contenido, fichero);
      procesados += result.procesados;
      matches.push(...result.matches);
    }

    return { ficherosNuevos: nuevos.length, procesados, matches };
  } catch (error: any) {
    return { ficherosNuevos: 0, procesados: 0, matches: [], error: error.message || "Error al comprobar OFIviaje." };
  }
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
