"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";
import { getMovimientosBanco as fetchMovimientosBanco, deleteMovimientoBanco as removeMovimientoBanco, getPagosDocumento as fetchPagosDocumento, getDocumentosExpediente as fetchDocumentosExpediente, getMatchesPendientesPorExpediente as fetchMatchesPendientes, regenerarPoolsBanco as regeneratePoolsBanco } from "@/lib/banco/bancoService";
import { processBankMovementMatch, executeMatchRecalculation, executeReembolsoRecalculation } from "@/lib/banco/matchEngine";
import { sanitizeDocumentStates } from "@/lib/banco/dataSanitizer";
import { conciliarPagoProveedor as ejecutarConciliarPagoProveedor, ejecutarConciliacionMovimiento, ejecutarConciliacionTutor } from "@/lib/banco/contabilidadService";

export async function getMovimientosBanco(options?: any) {
  return fetchMovimientosBanco(options);
}

export async function deleteMovimientoBanco(id: string) {
  const result = await removeMovimientoBanco(id);
  revalidatePath("/banco");
  return result;
}

export async function getPagosDocumento(documentoId: string) {
  return fetchPagosDocumento(documentoId);
}

export async function conciliarPagoProveedor(pagoId: string, movimientoBancoId: string) {
  const agencyDb = await getAgencyDbClient();
  const result = await ejecutarConciliarPagoProveedor(agencyDb, pagoId, movimientoBancoId);
  if (result.success) revalidatePath("/banco");
  return result;
}

export async function getDocumentosExpediente(expedienteId: string) {
  return fetchDocumentosExpediente(expedienteId);
}

export async function matchMovimientoBancarioConPagos(movimientoBancoId: string, pagosPendientesPrecalculados?: any[]) {
  const agencyDb = await getAgencyDbClient();
  return processBankMovementMatch(agencyDb, movimientoBancoId, pagosPendientesPrecalculados);
}

export async function conciliarDesdeMovimientoBanco(movimientoBancoId: string, pagoDocumentoIds: string[]) {
  const agencyDb = await getAgencyDbClient();
  const result = await ejecutarConciliacionMovimiento(agencyDb, movimientoBancoId, pagoDocumentoIds);
  if (result.success) {
    revalidatePath("/banco");
    const documentoId = (result.data as any)?.documento_id;
    if (documentoId) revalidatePath(`/expedientes/${documentoId}`);
  }
  return result;
}

export async function recalcularTodosLosMatches(preloadedData?: any) {
  const agencyDb = await getAgencyDbClient();
  const result = await executeMatchRecalculation(agencyDb, preloadedData);
  await sanitizeDocumentStates(agencyDb);
  revalidatePath("/banco");
  return result;
}

export async function getMatchesPendientesPorExpediente(expedienteId: string) {
  return fetchMatchesPendientes(expedienteId);
}

export async function regenerarPoolsBanco() {
  const result = await regeneratePoolsBanco();
  revalidatePath("/banco");
  return result;
}

export async function recalcularMatchesReembolsos() {
  const agencyDb = await getAgencyDbClient();
  const result = await executeReembolsoRecalculation(agencyDb);
  revalidatePath("/banco");
  return result;
}

export async function conciliarIngresoTutor(movimientoId: string, expedienteId: string, entidadId: string | undefined, importeMovimiento: number) {
  try {
    const agencyDb = await getAgencyDbClient();
    let resolvedEntidadId = entidadId;
    if (!resolvedEntidadId) {
      // Intentar resolver la entidad buscando coincidencia de nombre con los metadatos o concepto del banco
      const { data: movBanco } = await agencyDb
        .from("contabilidad_movimientos_banco")
        .select("match_metadatos, concepto_original")
        .eq("id", movimientoId)
        .maybeSingle();

      const meta = movBanco?.match_metadatos as any;
      const pagadorNombreMeta = meta?.pagador_nombre;

      const { data: pagadores } = await agencyDb
        .from("operativa_pagadores_expedientes")
        .select("entidad_id, contabilidad_entidades(nombre)")
        .eq("expediente_id", expedienteId);

      if (pagadores && pagadores.length > 0) {
        let matchPagador = null;
        if (pagadorNombreMeta) {
          const normMetaName = pagadorNombreMeta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          matchPagador = pagadores.find((p: any) => {
            const name = (p.contabilidad_entidades?.nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return name.includes(normMetaName) || normMetaName.includes(name);
          });
        }

        if (!matchPagador && movBanco?.concepto_original) {
          const normConcepto = movBanco.concepto_original.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          matchPagador = pagadores.find((p: any) => {
            const name = (p.contabilidad_entidades?.nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const nameParts = name.split(/\s+/).filter((part: string) => part.length > 2);
            return nameParts.length > 0 && nameParts.every((part: string) => normConcepto.includes(part));
          });
        }

        resolvedEntidadId = matchPagador?.entidad_id || pagadores[0]?.entidad_id;
      }

      if (!resolvedEntidadId) {
        return { success: false, error: "No se encontró el pagador del expediente para conciliar" };
      }
    }
    const result: any = await ejecutarConciliacionTutor(movimientoId, expedienteId, resolvedEntidadId, importeMovimiento);
    if (result && result.success) {
      const nuevoMovimientoId = result.movimientoId;
      if (nuevoMovimientoId) {
        // 1. Asegurar que el expediente_id está guardado en el movimiento contable
        await agencyDb
          .from("contabilidad_movimientos")
          .update({ expediente_id: expedienteId })
          .eq("id", nuevoMovimientoId);

        // 2. Crear imputaciones a los viajeros identificados en el match_metadatos del movimiento
        const { data: movBanco } = await agencyDb
          .from("contabilidad_movimientos_banco")
          .select("match_metadatos")
          .eq("id", movimientoId)
          .maybeSingle();

        const meta = movBanco?.match_metadatos as any;
        let viajerosImputar: string[] = [];

        if (meta?.viajeros && Array.isArray(meta.viajeros) && meta.viajeros.length > 0) {
          viajerosImputar = meta.viajeros.map((v: any) => v.id).filter(Boolean);
        }

        // Fallback: si no hay viajeros específicos en metadatos, imputamos a todos los viajeros confirmados del expediente
        if (viajerosImputar.length === 0) {
          const { data: viajeros } = await agencyDb
            .from("operativa_viajeros_expedientes")
            .select("entidad_id")
            .eq("expediente_id", expedienteId)
            .eq("estado", "confirmado");

          if (viajeros && viajeros.length > 0) {
            viajerosImputar = viajeros.map((row: any) => row.entidad_id).filter(Boolean);
          }
        }

        if (viajerosImputar.length > 0) {
          const importePorViajero = Math.abs(importeMovimiento) / viajerosImputar.length;
          await agencyDb
            .from("contabilidad_movimientos_imputaciones")
            .insert(viajerosImputar.map((vId: string) => ({
              movimiento_id: nuevoMovimientoId,
              expediente_id: expedienteId,
              viajero_id: vId,
              importe: parseFloat(importePorViajero.toFixed(2))
            })));
        }
      }

      revalidatePath("/banco");
      revalidatePath(`/expedientes/${expedienteId}`);
      return { success: true };
    }
    return { success: false, error: result?.message || result?.error || "Error en conciliación" };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
