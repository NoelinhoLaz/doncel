"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient } from "@/lib/supabaseServer";

export interface CierreCaja {
  id: string;
  fecha: string;
  efectivo_teorico: number;
  tpv_teorico: number;
  efectivo_fisico: number;
  tpv_fisico: number;
  diferencia_efectivo: number;
  diferencia_tpv: number;
  agente_nombre: string | null;
  estado: string;
  created_at: string;
}

export async function guardarCierreCaja(data: {
  fecha: string;
  efectivoTeorico: number;
  tpvTeorico: number;
  efectivoFisico: number;
  arqueoDetalle: Record<string, number>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getAgencyDbClient();

    // Obtener TPV físico sumando los tiquetes del día
    const { data: tiquetes } = await db
      .from("tpv_tiquetes")
      .select("total")
      .eq("fecha", data.fecha);
    const tpvFisico = (tiquetes || []).reduce((s: number, t: any) => s + Number(t.total || 0), 0);

    // Obtener nombre del agente
    let agenteNombre: string | null = null;
    try {
      const admin = await createAdminServerClient();
      const { data: { user } } = await admin.auth.getUser();
      agenteNombre = user?.user_metadata?.nombre
        || user?.user_metadata?.full_name
        || user?.email
        || null;
    } catch { /* continúa sin agente */ }

    const diferenciaEfectivo = parseFloat((data.efectivoFisico - data.efectivoTeorico).toFixed(2));
    const diferenciaTpv = parseFloat((tpvFisico - data.tpvTeorico).toFixed(2));

    const { error } = await db
      .from("contabilidad_cierres_caja")
      .upsert({
        fecha: data.fecha,
        efectivo_teorico: parseFloat(data.efectivoTeorico.toFixed(2)),
        tpv_teorico: parseFloat(data.tpvTeorico.toFixed(2)),
        efectivo_fisico: parseFloat(data.efectivoFisico.toFixed(2)),
        tpv_fisico: parseFloat(tpvFisico.toFixed(2)),
        diferencia_efectivo: diferenciaEfectivo,
        diferencia_tpv: diferenciaTpv,
        agente_nombre: agenteNombre,
        arqueo_detalle: data.arqueoDetalle,
        estado: "cerrado",
        updated_at: new Date().toISOString(),
      }, { onConflict: "fecha" });

    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCierresCaja(limit = 10): Promise<CierreCaja[]> {
  try {
    const db = await getAgencyDbClient();
    const { data, error } = await db
      .from("contabilidad_cierres_caja")
      .select("id, fecha, efectivo_teorico, tpv_teorico, efectivo_fisico, tpv_fisico, diferencia_efectivo, diferencia_tpv, agente_nombre, estado, created_at")
      .order("fecha", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      fecha: r.fecha,
      efectivo_teorico: Number(r.efectivo_teorico || 0),
      tpv_teorico: Number(r.tpv_teorico || 0),
      efectivo_fisico: Number(r.efectivo_fisico || 0),
      tpv_fisico: Number(r.tpv_fisico || 0),
      diferencia_efectivo: Number(r.diferencia_efectivo || 0),
      diferencia_tpv: Number(r.diferencia_tpv || 0),
      agente_nombre: r.agente_nombre || null,
      estado: r.estado || "cerrado",
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}
