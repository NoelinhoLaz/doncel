"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";
import { getMovimientosBanco as fetchMovimientosBanco, deleteMovimientoBanco as removeMovimientoBanco, getPagosDocumento as fetchPagosDocumento, getDocumentosExpediente as fetchDocumentosExpediente, getMatchesPendientesPorExpediente as fetchMatchesPendientes, regenerarPoolsBanco as regeneratePoolsBanco, getInformeMensualPendientesOfi as fetchInformeMensualPendientesOfi, getUltimaConciliacionOfiviaje as fetchUltimaConciliacionOfiviaje, enviarInformeMensualPorEmail as sendInformeMensualPorEmail, actualizarIncluirEnInformeAutomatico as updateIncluirEnInformeAutomatico } from "@/lib/banco/bancoService";
import { getCurrentAgentePublic } from "@/actions/crm";
import { processBankMovementMatch, executeMatchRecalculation, executeReembolsoRecalculation } from "@/lib/banco/matchEngine";
import { sanitizeDocumentStates } from "@/lib/banco/dataSanitizer";
import { conciliarPagoProveedor as ejecutarConciliarPagoProveedor, ejecutarConciliacionMovimiento, ejecutarConciliacionTutor, ejecutarConciliacionManual } from "@/lib/banco/contabilidadService";
import { createBridgeConnectSession, syncBridgeTransactions } from "@/lib/banco/bridgeApi";
import { getCurrentAgenciaSlug } from "@/actions/agencias";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { previsualizarOfiviajeUsuarioActual, confirmarConciliacionOfiviaje as confirmarConciliacionOfiviajeLib, enviarInformeOfiviajePorEmail, type OfiviajeMatchPropuesto, type OfiviajePreview } from "@/lib/banco/ofiviajeMatch";

export async function getMovimientosBanco(options?: any) {
  return fetchMovimientosBanco(options);
}

export async function getInformeMensualPendientesOfi() {
  return fetchInformeMensualPendientesOfi();
}

export async function getUltimaConciliacionOfiviaje() {
  return fetchUltimaConciliacionOfiviaje();
}

export async function enviarInformeMensualPorEmail(destinatarioEmail: string, cuentaBancariaId?: string, revisarPreview?: any) {
  return sendInformeMensualPorEmail(destinatarioEmail, cuentaBancariaId, revisarPreview);
}

export async function actualizarIncluirEnInformeAutomatico(cuentaBancariaId: string, incluir: boolean) {
  const { rol } = await getCurrentAgentePublic();
  if (rol !== "Owner") return { success: false, error: "Solo el propietario de la agencia puede modificar esta configuración." };
  return updateIncluirEnInformeAutomatico(cuentaBancariaId, incluir);
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

export async function conciliarManualmente(movimientoBancoId: string, importe: number, expedienteOfi?: string) {
  const agencyDb = await getAgencyDbClient();
  const { usuarioId } = await getCurrentAgentePublic();
  const result = await ejecutarConciliacionManual(agencyDb, movimientoBancoId, importe, expedienteOfi, usuarioId);
  if (result.success) revalidatePath("/banco");
  return result;
}

export interface ConciliacionManualDetalle {
  id: string;
  importe: number;
  fecha: string;
  usuarioNombre: string;
  expedienteOfi: string | null;
}

/**
 * Detalle de cada conciliación manual registrada para un movimiento
 * bancario (para mostrar quién conciló el total, o cada parcial).
 */
export async function getConciliacionesManuales(movimientoBancoId: string): Promise<ConciliacionManualDetalle[]> {
  const agencyDb = await getAgencyDbClient();

  const { data: pagos } = await agencyDb
    .from("contabilidad_movimientos")
    .select("id, importe_total, created_at, usuario_id, concepto")
    .eq("movimiento_banco_id", movimientoBancoId)
    .eq("estado", "confirmado")
    .order("created_at", { ascending: true });

  if (!pagos || pagos.length === 0) return [];

  const usuarioIds = [...new Set(pagos.map((p: any) => p.usuario_id).filter(Boolean))];
  const adminServiceClient = createAdminServiceClient();
  const { data: usuarios } = await adminServiceClient
    .from("usuarios")
    .select("id, nombre, apellidos")
    .in("id", usuarioIds);

  const nombrePorId = new Map((usuarios || []).map((u: any) => [u.id, `${u.nombre || ""} ${u.apellidos || ""}`.trim() || "Usuario desconocido"]));

  return pagos.map((p: any) => ({
    id: p.id,
    importe: Number(p.importe_total || 0),
    fecha: p.created_at,
    usuarioNombre: nombrePorId.get(p.usuario_id) || "Usuario desconocido",
    expedienteOfi: p.concepto?.match(/Expediente OFI: (.+)$/)?.[1] || null,
  }));
}

export async function getImportePendienteConciliar(movimientoBancoId: string): Promise<{ importePendiente: number }> {
  const agencyDb = await getAgencyDbClient();

  const { data: movimiento } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .select("importe")
    .eq("id", movimientoBancoId)
    .maybeSingle();

  const { data: pagos } = await agencyDb
    .from("contabilidad_movimientos")
    .select("importe_total")
    .eq("movimiento_banco_id", movimientoBancoId)
    .eq("estado", "confirmado");

  const yaConciliado = (pagos || []).reduce((sum: number, p: any) => sum + Number(p.importe_total || 0), 0);
  const importeMovimiento = Math.abs(Number(movimiento?.importe || 0));
  const importePendiente = Math.max(0, importeMovimiento - yaConciliado);

  return { importePendiente };
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

export async function connectBridgeBank(): Promise<{ connectUrl?: string; error?: string }> {
  const agenciaSlug = await getCurrentAgenciaSlug();
  if (!agenciaSlug) return { error: "No se pudo identificar la agencia del usuario actual." };

  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user?.email) return { error: "No se pudo identificar el email del usuario actual." };

  return createBridgeConnectSession(agenciaSlug, user.email);
}

export async function syncBridgeBankMovements(): Promise<{ insertados: number; error?: string }> {
  const agenciaSlug = await getCurrentAgenciaSlug();
  if (!agenciaSlug) return { insertados: 0, error: "No se pudo identificar la agencia del usuario actual." };

  const result = await syncBridgeTransactions(agenciaSlug);
  if (result.insertados > 0) revalidatePath("/banco");
  return result;
}

export async function previsualizarConciliacionOfiviaje() {
  return previsualizarOfiviajeUsuarioActual();
}

export async function confirmarConciliacionOfiviaje(matches: OfiviajeMatchPropuesto[]) {
  const result = await confirmarConciliacionOfiviajeLib(matches);
  if (result.conciliados > 0) revalidatePath("/banco");
  return result;
}

export async function enviarInformeOfiviaje(preview: OfiviajePreview, destinatarioEmail: string) {
  return enviarInformeOfiviajePorEmail(preview, destinatarioEmail);
}
