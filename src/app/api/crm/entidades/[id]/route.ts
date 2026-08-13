import { NextRequest, NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = await getAgencyDbClient();

    const update: Record<string, any> = {};
    if (body.nombre !== undefined) update.nombre = body.nombre;
    if (body.telefono !== undefined) update.telefono = body.telefono;
    if (body.otros_tlfs !== undefined) update.otros_tlfs = body.otros_tlfs;
    if (body.email !== undefined) update.email = body.email;
    if (body.otros_emails !== undefined) update.otros_emails = body.otros_emails;
    if (body.lat !== undefined) update.lat = body.lat;
    if (body.lng !== undefined) update.lng = body.lng;
    if (body.direccion !== undefined) update.direccion = typeof body.direccion === "string" ? { direccion: body.direccion } : body.direccion;
    if (body.agente_id !== undefined) update.agente_id = body.agente_id;
    if (body.documento !== undefined) update.documento = body.documento;
    if (body.fecha_nacimiento !== undefined) update.fecha_nacimiento = body.fecha_nacimiento;
    if (body.tipo_cliente_id !== undefined) update.tipo_cliente_id = body.tipo_cliente_id;

    const { data, error } = await db
      .from("contabilidad_entidades")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
