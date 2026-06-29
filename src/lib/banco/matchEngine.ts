import { buscarMatchesParaMovimiento } from "@/lib/documentos/matcher";
import { buscarMatchParaReembolso } from "@/lib/documentos/matcherReembolsos";
import { motorCobrosClientes } from "@/lib/conciliacion/motorCobrosClientes";
import { motorServiciosGastos } from "@/lib/conciliacion/motorServiciosGastos";
import { motorReembolsosClientes } from "@/lib/conciliacion/motorReembolsosClientes";
import { motorReembolsosProveedores } from "@/lib/conciliacion/motorReembolsosProveedores";
import { loadRecalcularMatchesData, type RecalcularMatchesData } from "@/actions/loaders";

const MIN_MATCH_SCORE = 70;
const MIN_REEMBOLSO_MATCH_THRESHOLD = 70;

function normalizeScore(rawScore: number): number {
  if (rawScore == null || Number.isNaN(rawScore)) return 0;
  return rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
}

export async function processBankMovementMatch(
  agencyDb: any,
  movimientoBancoId: string,
  pagosPendientesPrecalculados?: any[]
) {
  const { data: movimiento, error: errorMov } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("*")
    .eq("id", movimientoBancoId)
    .maybeSingle();

  if (errorMov || !movimiento) {
    return { found: false, error: "Movimiento no encontrado" };
  }

  const movImporte = Number(movimiento.importe || 0);
  let match: any = await buscarMatchesParaMovimiento(
    {
      id: movimiento.id,
      importe: movImporte,
      concepto_limpio: movimiento.concepto_limpio || movimiento.concepto_original || "",
      fecha_operacion: movimiento.fecha_operacion,
    },
    pagosPendientesPrecalculados
  );

  if (!match) {
    match = await buscarMatchParaReembolso({
      id: movimiento.id,
      importe: movImporte,
      concepto_limpio: movimiento.concepto_limpio || movimiento.concepto_original || "",
      fecha_operacion: movimiento.fecha_operacion,
    });
  }

  if (!match) {
    await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({
        estado: "pendiente",
        match_score: null,
        match_propuesto_at: null,
        match_metadatos: null,
      })
      .eq("id", movimientoBancoId);
    return { found: false };
  }

  const finalScore = normalizeScore((match as any).match_score ?? (match as any).score ?? 0);
  if (finalScore < MIN_MATCH_SCORE) {
    await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({
        estado: "pendiente",
        match_score: null,
        match_propuesto_at: null,
        match_metadatos: null,
      })
      .eq("id", movimientoBancoId);
    return { found: false };
  }

  const matchMetadatos = match.tipo === "reembolso"
    ? {
        expediente_id: match.expediente_id,
        reembolso_id: match.reembolso_id,
        tipo: "reembolso",
        subtipo: match.subtipo,
        concepto: match.concepto,
        razon: match.razon,
        match_score: finalScore,
        criterios: match.metadatos,
      }
    : {
        origen: match.origen || "documento",
        expediente_id: match.expediente_id,
        expediente_numero: match.expediente_numero,
        pagador_id: match.pagador_id || null,
        pagador_nombre: match.pagador_nombre || null,
        importe_total: match.importe_total ?? null,
        importe_abonado: match.importe_abonado ?? null,
        documento_id: match.documento_id,
        servicio_id: match.servicio_id || null,
        proveedor_nombre: match.proveedor_nombre,
        proveedor_nif: match.proveedor_nif,
        pagos: match.pagos,
        razon: match.razon,
        match_score: finalScore,
        criterios: match.metadatos,
      };

  const { error: errorUpdate } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .update({
      estado: "propuesto",
      match_score: finalScore,
      match_propuesto_at: new Date().toISOString(),
      match_metadatos: matchMetadatos,
    })
    .eq("id", movimientoBancoId);

  if (errorUpdate) {
    return { found: false, error: "Error al guardar propuesta" };
  }

  return {
    found: true,
    match: {
      expediente_id: match.expediente_id,
      documento_id: match.documento_id,
      proveedor_nombre: match.proveedor_nombre,
      match_score: finalScore,
      razon: match.razon,
    },
  };
}

export async function executeMatchRecalculation(
  agencyDb: any,
  preloadedData?: RecalcularMatchesData
) {
  const startTime = Date.now();
  let pendientes: any[] = [];
  let fetchError: any = null;
  {
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data: batch, error: batchError } = await agencyDb
        .from("contabilidad_movimientos_banco")
        .select("id, estado, match_score, match_metadatos, concepto_limpio, concepto_original, fecha_operacion, importe, metadatos, referencia1, referencia2")
        .in("estado", ["pendiente", "propuesto"])
        .eq("deleted", false)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (batchError) { fetchError = batchError; break; }
      if (!batch || batch.length === 0) break;
      pendientes = pendientes.concat(batch);
      if (batch.length < pageSize) break;
      page++;
    }
  }

  if (fetchError) throw fetchError;
  if (!pendientes || pendientes.length === 0) {
    return { success: true, procesados: 0, bajos: 0, medios: 0, altos: 0, tiempoMs: 0 };
  }

const data = preloadedData || await loadRecalcularMatchesData(agencyDb);
  const { pagosPendientes, pagadoresConViajeros, reembolsosCobro, reembolsosPago, serviciosPendientes } = data;

  let count = 0;
  let bajos = 0;
  let medios = 0;
  let altos = 0;

  for (const mov of pendientes) {
    const movImporte = Number(mov.importe || 0);
    const metadatos = typeof mov.metadatos === "string"
      ? (() => { try { return JSON.parse(mov.metadatos); } catch { return null; } })()
      : (mov.metadatos ?? null);
    const movData = {
      id: mov.id,
      importe: movImporte,
      concepto_limpio: mov.concepto_limpio || mov.concepto_original || "",
      fecha_operacion: mov.fecha_operacion,
      metadatos,
      referencia1: mov.referencia1,
      referencia2: mov.referencia2,
    };

    let match: any = null;
    const conceptoLower = movData.concepto_limpio.toLowerCase();

    if (movImporte < 0) {
      if (conceptoLower.includes("aviacion") || conceptoLower.includes("avial") || conceptoLower.includes("recarga") || conceptoLower.includes("doncel")) {
        match = motorServiciosGastos(movData, pagosPendientes);
      } else {
        match = motorReembolsosClientes(movData, reembolsosCobro) || motorServiciosGastos(movData, pagosPendientes);
      }
    } else if (movImporte > 0) {
      if (conceptoLower.includes("abono") || conceptoLower.includes("reembolso") || conceptoLower.includes("refund")) {
        match = motorReembolsosProveedores(movData, reembolsosPago);
      }
      if (!match) {
        match = motorCobrosClientes(movData, pagadoresConViajeros);
      }
    }

    if (!match && movImporte < 0) {
      match = await buscarMatchesParaMovimiento({
        id: mov.id,
        importe: movImporte,
        concepto_limpio: movData.concepto_limpio,
        fecha_operacion: mov.fecha_operacion,
      }, pagosPendientes, serviciosPendientes);
    }

    if (!match) {
      // Sin match: resetear siempre a pendiente para que no queden propuestas huérfanas
      await agencyDb
        .from("contabilidad_movimientos_banco")
        .update({ estado: "pendiente", match_score: null, match_propuesto_at: null, match_metadatos: null })
        .eq("id", mov.id);
      continue;
    }

    const scorePct = normalizeScore((match as any).match_score ?? (match as any).score ?? 0);
    if (scorePct < MIN_MATCH_SCORE) {
      await agencyDb
        .from("contabilidad_movimientos_banco")
        .update({ estado: "pendiente", match_score: null, match_propuesto_at: null, match_metadatos: null })
        .eq("id", mov.id);
      continue;
    }

    const { error: errorUpdate } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({
        estado: "propuesto",
        match_score: scorePct,
        match_propuesto_at: new Date().toISOString(),
        match_metadatos: { ...match, match_score: scorePct, criterios: match.metadatos },
      })
      .eq("id", mov.id);

    if (!errorUpdate) {
      count++;
      if (scorePct >= 90) altos++;
      else if (scorePct >= 80) medios++;
      else bajos++;
    }
  }

  return { success: true, procesados: count, bajos, medios, altos, tiempoMs: Date.now() - startTime };
}

export async function executeReembolsoRecalculation(agencyDb: any) {
  const { data: reembolsos, error: errR } = await agencyDb
    .from("contabilidad_movimientos")
    .select("id, concepto, importe_total, expediente_id, tipo")
    .in("tipo", ["reembolso_cobro", "reembolso_pago"])
    .is("movimiento_banco_id", null);

  if (errR || !reembolsos?.length) return { procesados: 0 };

  const { data: bancoPendientes, error: errB } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("id, concepto_limpio, concepto_original, fecha_operacion, importe, estado, match_metadatos")
    .in("estado", ["pendiente", "propuesto"])
    .eq("deleted", false);

  if (errB || !bancoPendientes?.length) return { procesados: 0 };

  let procesados = 0;

  for (const reembolso of reembolsos) {
    const reembolsoImporte = Math.abs(Number(reembolso.importe_total));
    const candidatos = bancoPendientes.filter((m: any) => Math.abs(Math.abs(Number(m.importe)) - reembolsoImporte) === 0);
    if (!candidatos.length) continue;

    let bestScore = MIN_REEMBOLSO_MATCH_THRESHOLD - 1;
    let bestBancoId: string | null = null;
    let bestMatchData: any = null;

    for (const bancoMov of candidatos) {
      const existingMeta = bancoMov.match_metadatos as any;
      if (existingMeta?.reembolso_id === reembolso.id) continue;

      const match = await buscarMatchParaReembolso({
        id: bancoMov.id,
        importe: Number(bancoMov.importe),
        concepto_limpio: bancoMov.concepto_limpio || bancoMov.concepto_original || "",
        fecha_operacion: bancoMov.fecha_operacion,
      }, [{ ...reembolso }]);

      const score = normalizeScore((match as any)?.match_score ?? (match as any)?.score ?? 0);
      if (match && score > bestScore) {
        bestScore = score;
        bestBancoId = bancoMov.id;
        bestMatchData = match;
      }
    }

    if (!bestBancoId || !bestMatchData) continue;

    const { error } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .update({
        estado: "propuesto",
        match_score: bestScore,
        match_propuesto_at: new Date().toISOString(),
        match_metadatos: {
          expediente_id: reembolso.expediente_id,
          reembolso_id: reembolso.id,
          tipo: "reembolso",
          subtipo: reembolso.tipo,
          concepto: reembolso.concepto,
          razon: bestMatchData.razon,
          criterios: bestMatchData.metadatos,
        },
      })
      .eq("id", bestBancoId);

    if (!error) procesados++;
  }

  return { procesados };
}
