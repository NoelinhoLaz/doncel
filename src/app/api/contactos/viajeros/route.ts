import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET() {
  try {
    const db = await getAgencyDbClient();

    // Viajeros are entidades referenced in operativa_viajeros_expedientes
    const { data, error } = await db
      .from("operativa_viajeros_expedientes")
      .select("entidad_id, expediente_id, operativa_expedientes(id, numero, referencia), contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(id, nombre, email, telefono, documento, metadatos)")
      .not("entidad_id", "is", null);

    if (error) throw error;

    // Deduplicate by entidad_id, acumulando expedientes de cada viajero
    const seen = new Map<string, any>();
    for (const row of data ?? []) {
      const e = (row as any).contabilidad_entidades;
      const exp = (row as any).operativa_expedientes;
      if (!e) continue;
      if (!seen.has(e.id)) {
        const parts = e.nombre?.trim().split(/\s+/) ?? [];
        seen.set(e.id, {
          id: e.id,
          nombre: parts[0] ?? e.nombre,
          apellidos: parts.slice(1).join(" ") || null,
          email: e.email ?? null,
          telefono: e.telefono ?? null,
          pasaporte: e.documento ?? null,
          nacionalidad: e.metadatos?.nacionalidad ?? e.metadatos?.pais ?? null,
          expedientes: [] as { id: string; numero: string | null; referencia: string }[],
        });
      }
      if (exp) seen.get(e.id).expedientes.push({ id: exp.id, numero: exp.numero ?? null, referencia: exp.referencia });
    }
    const mapped = Array.from(seen.values());
    mapped.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ success: true, data: mapped });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
