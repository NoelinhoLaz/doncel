"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { CrearFacturaItem } from "./facturacion.types";

export async function enviarFacturaAVerifactu(factura: {
  serie: string;
  numero: string;
  fecha_expedicion: string;
  tipo_factura: "F1" | "F2";
  descripcion: string;
  nif?: string;
  nombre?: string;
  importe_total: number;
  importe_neto: number;
  porcentaje_iva: number;
  cuota_iva: number;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const apiKey = process.env.VERIFACTI_API_KEY || "mock_verifacti_api_key_for_testing";

    const lineaPayload: any = {
      base_imponible: String(factura.importe_neto),
    };

    if (factura.porcentaje_iva > 0) {
      lineaPayload.tipo_impositivo = String(factura.porcentaje_iva);
      lineaPayload.cuota_repercutida = String(factura.cuota_iva);
    } else {
      lineaPayload.tipo_impositivo = "0";
      lineaPayload.cuota_repercutida = "0";
    }

    const payload: any = {
      serie: factura.serie,
      numero: factura.numero,
      fecha_expedicion: factura.fecha_expedicion,
      tipo_factura: factura.tipo_factura,
      descripcion: factura.descripcion,
      lineas: [lineaPayload],
      importe_total: String(factura.importe_total),
      validar_destinatario: false,
    };

    if (factura.nif) payload.nif = factura.nif;
    if (factura.nombre) payload.nombre = factura.nombre;

    if (apiKey === "mock_verifacti_api_key_for_testing") {
      return {
        success: true,
        data: {
          success: true,
          mensaje: "Factura certificada correctamente en Veri*Factu (SIMULACIÓN)",
          qr_code: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          fingerprint: `sim_fp_${Math.random().toString(36).substring(7)}`,
          timestamp: new Date().toISOString(),
        }
      };
    }

    const response = await fetch("https://api.verifacti.com/verifactu/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Veri*Factu] Error en la API de Verifacti:", response.status, errText);
      return { success: false, error: `Error ${response.status}: ${errText}` };
    }

    const resJson = await response.json();

    const normalizedData = {
      qr_code: resJson.qr ? `data:image/png;base64,${resJson.qr}` : null,
      fingerprint: resJson.huella || null,
      mensaje: resJson.uuid ? `uuid:${resJson.uuid}|estado:${resJson.estado || 'Pendiente'}|url:${resJson.url || ''}` : null,
      uuid: resJson.uuid || null,
      estado: resJson.estado || null,
      url_verificacion: resJson.url || null,
      ...resJson,
    };

    return { success: true, data: normalizedData };
  } catch (err: any) {
    console.error("[Veri*Factu] Excepción durante la transmisión:", err.message);
    return { success: false, error: err.message || "Error de conexión" };
  }
}

export async function getVerifactuDeclaracion(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const apiKey = process.env.VERIFACTI_API_KEY || "mock_verifacti_api_key_for_testing";

    if (apiKey === "mock_verifacti_api_key_for_testing") {
      return {
        success: true,
        data: {
          sif_nombre: "MOMO Invoicing System",
          sif_version: "2026.1.0",
          sif_id: "SIF_MOMO_2026",
          declaracion_responsable_url: "https://www.verifacti.com/declaraciones/sif_momo_2026.pdf",
          cumple_normativa: true,
          entorno: "sandbox",
        }
      };
    }

    const response = await fetch("https://api.verifacti.com/verifactu/declaracion", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Error ${response.status}: ${errText}` };
    }

    const resJson = await response.json();
    return { success: true, data: resJson };
  } catch (err: any) {
    return { success: false, error: err.message || "Error de conexión" };
  }
}

// Helper interno usado por facturacion.crud.ts
export async function _declararVerifactu(
  agencyDb: Awaited<ReturnType<typeof getAgencyDbClient>>,
  item: CrearFacturaItem,
  numFactura: string,
  currentYear: number,
  facturaId: string,
  importeNeto: number,
  cuotaIva: number
) {
  const parts = numFactura.split("-");
  const seqNum = parts[parts.length - 1];
  const formattedDate = new Date()
    .toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");

  const porcentajeIva = cuotaIva > 0 ? 21 : 0;

  const verifactuRes = await enviarFacturaAVerifactu({
    serie: `F${currentYear}`,
    numero: seqNum,
    fecha_expedicion: formattedDate,
    tipo_factura: item.clienteNif ? "F1" : "F2",
    descripcion: item.concepto,
    nif: item.clienteNif,
    nombre: item.clienteNombre,
    importe_total: item.importe,
    importe_neto: importeNeto,
    porcentaje_iva: porcentajeIva,
    cuota_iva: cuotaIva,
  });

  const nuevoEstado = verifactuRes.success && verifactuRes.data?.qr_code
    ? "ENVIADO"
    : verifactuRes.success
      ? "PENDIENTE_AEAT"
      : "ERROR";

  const mensajeGuardado = verifactuRes.success
    ? verifactuRes.data?.mensaje || `uuid:${verifactuRes.data?.uuid}|estado:${verifactuRes.data?.estado}`
    : verifactuRes.error || "Error desconocido";

  const { error: errUpdate } = await agencyDb
    .from("facturas_emitidas")
    .update({
      verifactu_estado: nuevoEstado,
      verifactu_qr: verifactuRes.data?.qr_code || null,
      verifactu_fingerprint: verifactuRes.data?.fingerprint || null,
      verifactu_mensaje: mensajeGuardado,
      verifactu_fecha_declaracion: new Date().toISOString(),
    })
    .eq("id", facturaId);

  if (errUpdate) {
    console.error(`[Veri*Factu] Error al guardar datos en factura ${numFactura}:`, errUpdate);
  }
  if (!verifactuRes.success) {
    console.warn(`[Veri*Factu] No se pudo declarar la factura ${numFactura}:`, verifactuRes.error);
  }
}
