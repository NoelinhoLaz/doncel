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
      const { data: rows, error } = await agencyDb.rpc("buscar_entidades", { q, max_rows: 50 });
      if (error) throw error;
      data = (rows ?? []).map((e: any) => ({
        id: e.id, nombre: e.nombre, email: e.email, telefono: e.telefono,
        tipo_entidad: e.tipo_entidad, roles: e.roles, metadatos: e.metadatos,
      }));
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nombre = (body.nombre ?? "").trim();
    if (!nombre) {
      return NextResponse.json({ success: false, error: "El nombre es obligatorio" }, { status: 400 });
    }

    const agencyDb = await getAgencyDbClient();
    const insert: Record<string, any> = { nombre, roles: body.roles ?? { prospecto: true } };
    if (body.tipo_entidad) insert.tipo_entidad = body.tipo_entidad;
    if (body.tipo_cliente_id) insert.tipo_cliente_id = body.tipo_cliente_id;
    if (body.email) insert.email = String(body.email).trim();
    if (body.telefono) insert.telefono = String(body.telefono).trim();
    if (body.documento) insert.documento = String(body.documento).trim();
    if (body.fecha_nacimiento) insert.fecha_nacimiento = body.fecha_nacimiento;
    if (body.razon_social) insert.razon_social = String(body.razon_social).trim();
    if (body.direccion) insert.direccion = typeof body.direccion === "string" ? { direccion: body.direccion } : body.direccion;
    if (body.lat != null) insert.lat = body.lat;
    if (body.lng != null) insert.lng = body.lng;
    if (body.metadatos) insert.metadatos = body.metadatos;

    const { data, error } = await agencyDb
      .from("contabilidad_entidades")
      .insert([insert])
      .select("id, nombre, email, telefono, documento, tipo_entidad, razon_social, metadatos")
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
