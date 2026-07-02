import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET() {
  try {
    const db = await getAgencyDbClient();

    // Entidades con rol cliente/organizacion
    const { data: conRol, error: e1 } = await db
      .from("contabilidad_entidades")
      .select("id, nombre, email, telefono, direccion")
      .or("roles->cliente.eq.true,roles->organizacion.eq.true");

    if (e1) throw e1;

    // Entidades que aparecen como entidad_id en oportunidades CRM (centros, colegios, etc.)
    const { data: opRows, error: e2 } = await db
      .from("crm_oportunidades")
      .select("entidad_id")
      .not("entidad_id", "is", null);

    if (e2) throw e2;

    const crmIds = [...new Set((opRows ?? []).map((r: any) => r.entidad_id as string))];

    let conCrm: any[] = [];
    if (crmIds.length > 0) {
      const { data, error: e3 } = await db
        .from("contabilidad_entidades")
        .select("id, nombre, email, telefono, direccion")
        .in("id", crmIds);
      if (e3) throw e3;
      conCrm = data ?? [];
    }

    // Merge, deduplicar por id
    const seen = new Set<string>();
    const all: any[] = [];
    for (const r of [...(conRol ?? []), ...conCrm]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const dir = r.direccion ?? {};
      all.push({
        id: r.id,
        nombre: r.nombre,
        email: r.email ?? null,
        telefono: r.telefono ?? null,
        ciudad: dir.ciudad ?? dir.localidad ?? dir.municipio ?? null,
        pais: dir.pais ?? null,
      });
    }

    all.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ success: true, data: all });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
