import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET() {
  try {
    const db = await getAgencyDbClient();

    // Viajeros are entidades referenced in operativa_viajeros_expedientes
    const { data, error } = await db
      .from("operativa_viajeros_expedientes")
      .select("entidad_id, contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(id, nombre, email, telefono, documento, metadatos)")
      .not("entidad_id", "is", null);

    if (error) throw error;

    // Deduplicate by entidad_id
    const seen = new Set<string>();
    const mapped: any[] = [];
    for (const row of data ?? []) {
      const e = (row as any).contabilidad_entidades;
      if (!e || seen.has(e.id)) continue;
      seen.add(e.id);
      const parts = e.nombre?.trim().split(/\s+/) ?? [];
      mapped.push({
        id: e.id,
        nombre: parts[0] ?? e.nombre,
        apellidos: parts.slice(1).join(" ") || null,
        email: e.email ?? null,
        telefono: e.telefono ?? null,
        pasaporte: e.documento ?? null,
        nacionalidad: e.metadatos?.nacionalidad ?? e.metadatos?.pais ?? null,
      });
    }
    mapped.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ success: true, data: mapped });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
