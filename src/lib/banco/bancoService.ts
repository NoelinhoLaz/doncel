import { getAgencyDbClient } from "@/lib/agencyDb";

const escapeSearch = (value?: string) => value?.trim().replace(/[%_\\]/g, "\\$&");

export async function getMovimientosBanco(options?: {
  page?: number;
  limit?: number;
  search?: string;
  matchScoreFilters?: string[];
  tipoMovimiento?: "debe" | "haber";
  fechaDesde?: string;
  fechaHasta?: string;
  importeMin?: number;
  importeMax?: number;
  estados?: string[];
  cuentaIds?: string[];
}) {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const search = escapeSearch(options?.search);
  const matchScoreFilters = options?.matchScoreFilters ?? [];
  const tipoMovimiento = options?.tipoMovimiento;
  const fechaDesde = options?.fechaDesde;
  const fechaHasta = options?.fechaHasta;
  const importeMin = options?.importeMin;
  const importeMax = options?.importeMax;
  const estados = options?.estados ?? [];
  const cuentaIds = options?.cuentaIds;

  const agencyDb = await getAgencyDbClient();
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
  if (estados.length) query = query.in("estado", estados);
  if (cuentaIds && cuentaIds.length) query = query.in("cuenta_bancaria_id", cuentaIds);

  const scoreConditions: string[] = [];
  if (matchScoreFilters.includes("bajos")) scoreConditions.push("and(match_score.gte.60,match_score.lt.80)");
  if (matchScoreFilters.includes("medios")) scoreConditions.push("and(match_score.gte.80,match_score.lte.90)");
  if (matchScoreFilters.includes("altos")) scoreConditions.push("match_score.gt.90");
  if (scoreConditions.length) query = query.or(scoreConditions.join(","));

  const from = (page - 1) * limit;
  const to = page * limit - 1;
  const { data, error, count } = await query.order("fecha_operacion", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
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
