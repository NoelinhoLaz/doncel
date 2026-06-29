import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const id = searchParams.get("id")?.trim() ?? "";

    const agencyDb = await getAgencyDbClient();

    // Detalle de una entidad con sus contactos CRM
    if (id) {
      const { data: entidad, error: e1 } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre, email, telefono, documento, direccion, roles, metadatos")
        .eq("id", id)
        .single();
      if (e1) throw e1;

      const { data: contactos } = await agencyDb
        .from("crm_contactos")
        .select("id, nombre, cargo, email, telefono, es_principal")
        .eq("entidad_id", id)
        .eq("activo", true)
        .order("es_principal", { ascending: false });

      return NextResponse.json({ success: true, data: { ...entidad, contactos: contactos ?? [] } });
    }

    let data: any[] = [];

    if (q) {
      const palabras = q.split(/\s+/).filter(Boolean);
      let dbQuery = agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre, email, telefono, roles, metadatos")
        .order("nombre", { ascending: true })
        .limit(50);
      for (const p of palabras) dbQuery = dbQuery.ilike("nombre", `%${p}%`);
      const { data: rows, error } = await dbQuery;
      if (error) throw error;
      data = rows ?? [];
    } else {
      const { data: rows, error } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre, email, telefono, roles, metadatos")
        .or("roles->prospecto.eq.true,roles->cliente.eq.true,roles->organizacion.eq.true")
        .order("nombre", { ascending: true })
        .limit(20);
      if (error) throw error;
      data = rows ?? [];
    }

    const prioridad = (e: any) => {
      const r = e.roles ?? {};
      if (r.prospecto || r.organizacion) return 0;
      if (r.cliente) return 1;
      return 2;
    };
    data.sort((a, b) => prioridad(a) - prioridad(b));

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
