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
    if (body.email !== undefined) update.email = body.email;
    if (body.lat !== undefined) update.lat = body.lat;
    if (body.lng !== undefined) update.lng = body.lng;
    if (body.direccion !== undefined) update.direccion = body.direccion;

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
