"use client";
import type { SegmentoRuta, UbicacionMapa, Seccion } from "../types";

export async function calcularSegmento(
  seccionUid: string,
  rutaUid: string,
  segIdx: number,
  modo: "foot-walking" | "driving-car",
  ub1: UbicacionMapa,
  ub2: UbicacionMapa,
  seccion: Seccion,
  onUpdate: (uid: string, patch: Partial<Seccion>) => void
) {
  if (ub1.lat == null || ub1.lng == null || ub2.lat == null || ub2.lng == null) return;
  try {
    const res = await fetch("/api/ors/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: modo, coordinates: [[ub1.lng, ub1.lat], [ub2.lng, ub2.lat]] }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const updatedRutas = (seccion.rutas ?? []).map(r => {
      if (r.uid !== rutaUid) return r;
      const segs = [...(r.segmentos ?? [])];
      segs[segIdx] = { ...segs[segIdx], uid: segs[segIdx]?.uid ?? crypto.randomUUID(), modo, polyline: data.polyline };
      return { ...r, segmentos: segs };
    });
    onUpdate(seccionUid, { rutas: updatedRutas });
  } catch {}
}
