"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";
import { procesarDocumento } from "@/lib/documentos/procesador";

/** Lista de pagos (contabilidad_movimientos, tipo='pago') de un expediente, para elegir a
 *  cuáles se asigna un documento nuevo (manual o automático). Se muestran los datos mínimos
 *  necesarios para identificar cada pago en el selector del modal. */
export async function getPagosDelExpedienteParaAsignar(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_movimientos")
      .select("id, concepto, importe_total, fecha, fecha_registro, estado, proveedor_id")
      .eq("tipo", "pago")
      .eq("expediente_id", expedienteId)
      .in("estado", ["confirmado", "pendiente_conciliar"])
      .order("fecha_registro", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to get pagos del expediente:", error.message);
    return [];
  }
}

/** Crea un documento (factura/proforma) manualmente, sin IA: cabecera + líneas indicadas por
 *  el usuario, y lo vincula a los pagos elegidos vía la tabla puente
 *  contabilidad_movimientos_documentos (relación N:M). */
export async function crearDocumentoManual(payload: {
  expediente_id: string;
  proveedor_id?: string | null;
  proveedor_nombre?: string | null;
  documento_tipo: "FACTURA" | "PROFORMA" | "BORDERO_SEGUROS" | "ALBARAN";
  documento_numero?: string | null;
  fecha_emision?: string | null;
  total_documento: number;
  movimiento_ids: string[];
  lineas: Array<{ concepto: string; total_linea: number }>;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const {
      expediente_id, proveedor_id, proveedor_nombre, documento_tipo,
      documento_numero, fecha_emision, total_documento, movimiento_ids, lineas,
    } = payload;

    if (!movimiento_ids || movimiento_ids.length === 0) {
      throw new Error("Debes asignar el documento a al menos un pago.");
    }

    // Documento manual: sin archivo real, se guarda como referencia contable pura
    // (archivo_nombre/url/path son NOT NULL en el esquema, se rellenan con placeholders).
    const { data: documento, error: docError } = await agencyDb
      .from("operativa_documentos_proveedor")
      .insert([{
        proveedor_id: proveedor_id || null,
        documento_tipo,
        documento_numero: documento_numero || null,
        fecha_emision: fecha_emision || null,
        total_documento,
        archivo_nombre: `Manual - ${documento_numero || documento_tipo}`,
        archivo_url: "",
        archivo_path: "",
        procesado_ia: false,
      }])
      .select("id")
      .single();
    if (docError) throw docError;

    if (lineas.length > 0) {
      const { error: lineasError } = await agencyDb
        .from("operativa_documentos_lineas")
        .insert(lineas.map((l) => ({
          documento_id: documento.id,
          expediente_id,
          concepto: l.concepto,
          total_linea: l.total_linea,
        })));
      if (lineasError) throw lineasError;
    }

    const { error: bridgeError } = await agencyDb
      .from("contabilidad_movimientos_documentos")
      .insert(movimiento_ids.map((movimiento_id) => ({ movimiento_id, documento_id: documento.id })));
    if (bridgeError) throw bridgeError;

    revalidatePath(`/expedientes/${expediente_id}`);
    return { success: true, data: { documento_id: documento.id } };
  } catch (error: any) {
    console.error("Failed to crear documento manual:", error.message);
    return { success: false, error: error.message || "Error al crear el documento" };
  }
}

/** Busca en el catálogo de proveedores (contabilidad_proveedores) uno que coincida con el
 *  NIF/CIF extraído por la IA (match exacto, más fiable) o, si no hay NIF o no hay coincidencia,
 *  por nombre/razón social (aproximado, ILIKE) — para avisar si el proveedor ya existe en el
 *  sistema o si habría que darlo de alta. */
export async function buscarProveedorPorNombre(nombre: string | null | undefined, nif?: string | null) {
  try {
    const agencyDb = await getAgencyDbClient();

    if (nif && nif.trim()) {
      const cifNormalizado = nif.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const { data: porCif } = await agencyDb
        .from("contabilidad_proveedores")
        .select("id, nombre, razon_social, CIF")
        .not("CIF", "is", null);
      const encontrado = (porCif || []).find(
        (p: any) => p.CIF && p.CIF.toUpperCase().replace(/[^A-Z0-9]/g, "") === cifNormalizado
      );
      if (encontrado) return encontrado;
    }

    if (!nombre || !nombre.trim()) return null;
    const { data } = await agencyDb
      .from("contabilidad_proveedores")
      .select("id, nombre, razon_social, CIF")
      .or(`nombre.ilike.%${nombre.trim()}%,razon_social.ilike.%${nombre.trim()}%`)
      .limit(1);
    return data && data.length > 0 ? data[0] : null;
  } catch (error: any) {
    console.error("Failed to buscar proveedor por nombre:", error.message);
    return null;
  }
}

/** Procesa un PDF con IA (reutiliza el pipeline existente de procesarDocumento) sin vincularlo
 *  todavía a ningún pago — la selección de a qué pagos corresponde se hace después de ver el
 *  resultado de la extracción, con vincularDocumentoAPagos. */
export async function procesarDocumentoPago(file: File) {
  try {
    const resultado = await procesarDocumento(file);
    return { success: true, data: resultado };
  } catch (error: any) {
    console.error("Failed to procesar documento de pago:", error.message);
    return { success: false, error: error.message || "Error al procesar el documento" };
  }
}

/** Vincula un documento ya existente (creado manualmente o procesado con IA) a los pagos
 *  elegidos por el usuario, vía la tabla puente contabilidad_movimientos_documentos. */
export async function vincularDocumentoAPagos(documentoId: string, movimientoIds: string[], expedienteId: string) {
  try {
    if (!movimientoIds || movimientoIds.length === 0) {
      throw new Error("Debes asignar el documento a al menos un pago.");
    }
    const agencyDb = await getAgencyDbClient();
    const { error: bridgeError } = await agencyDb
      .from("contabilidad_movimientos_documentos")
      .insert(movimientoIds.map((movimiento_id) => ({ movimiento_id, documento_id: documentoId })));
    if (bridgeError) throw bridgeError;

    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to vincular documento a pagos:", error.message);
    return { success: false, error: error.message || "Error al vincular el documento" };
  }
}

/** Documentos vinculados a los movimientos (pagos) de un expediente, para mostrar el icono
 *  de "documento adjunto" en el listado de pagos. */
export async function getDocumentosPorMovimiento(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data: movimientos } = await agencyDb
      .from("contabilidad_movimientos")
      .select("id")
      .eq("tipo", "pago")
      .eq("expediente_id", expedienteId);
    const movimientoIds = (movimientos || []).map((m: any) => m.id);
    if (movimientoIds.length === 0) return {};

    const { data, error } = await agencyDb
      .from("contabilidad_movimientos_documentos")
      .select("movimiento_id, operativa_documentos_proveedor(id, archivo_nombre, archivo_url, documento_numero, documento_tipo)")
      .in("movimiento_id", movimientoIds);
    if (error) throw error;

    const map: Record<string, any[]> = {};
    for (const row of (data || [])) {
      const doc = (row as any).operativa_documentos_proveedor;
      if (!doc) continue;
      const list = map[row.movimiento_id] || [];
      list.push(doc);
      map[row.movimiento_id] = list;
    }
    return map;
  } catch (error: any) {
    console.error("Failed to get documentos por movimiento:", error.message);
    return {};
  }
}
