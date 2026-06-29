"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";

export interface TpvLinea {
  descripcion: string;
  importe: number;
}

export interface TiqueteManual {
  id: string;
  fecha: string;
  numero_tiquete: string;
  subtotal: number;
  comision: number;
  total: number;
  estado: string;
  created_at: string;
  lineas: TpvLinea[];
}

export async function crearTiqueteManual(
  fecha: string,
  lineas: TpvLinea[],
  comision: number,
  subtotalOverride?: number
): Promise<{ success: boolean; tiquete_id?: string; total?: number; error?: string }> {
  try {
    const db = await getAgencyDbClient();
    const subtotal = subtotalOverride ?? lineas.reduce((sum, l) => sum + l.importe, 0);
    const total = Math.max(0, subtotal - comision);

    // Número único: fecha + timestamp
    const numero_tiquete = `TPV-${fecha.replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;

    const { data, error } = await db
      .from("tpv_tiquetes")
      .insert({
        numero_tiquete,
        fecha,
        subtotal: parseFloat(subtotal.toFixed(2)),
        comision: parseFloat(comision.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        estado: "pendiente",
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message || "Error al crear tiquete");

    if (lineas.length > 0) {
      const rows = lineas.map((l) => ({
        tiquete_id: data.id,
        tipo: l.descripcion,
        importe: parseFloat(l.importe.toFixed(2)),
      }));
      await db.from("tpv_tiquetes_transacciones").insert(rows);
    }

    return { success: true, tiquete_id: data.id, total };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTiquesByFecha(fecha: string): Promise<TiqueteManual[]> {
  try {
    const db = await getAgencyDbClient();
    const { data, error } = await db
      .from("tpv_tiquetes")
      .select("id, fecha, numero_tiquete, subtotal, comision, total, estado, created_at, tpv_tiquetes_transacciones(tipo, importe)")
      .eq("fecha", fecha)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((t: any) => ({
      id: t.id,
      fecha: t.fecha,
      numero_tiquete: t.numero_tiquete,
      subtotal: Number(t.subtotal || 0),
      comision: Number(t.comision || 0),
      total: Number(t.total || 0),
      estado: t.estado || "pendiente",
      created_at: t.created_at,
      lineas: (t.tpv_tiquetes_transacciones || []).map((tx: any) => ({
        descripcion: tx.tipo || "",
        importe: Number(tx.importe || 0),
      })),
    }));
  } catch {
    return [];
  }
}
