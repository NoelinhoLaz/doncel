import { NextRequest, NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getAgencyDbClient();

    const { data, error } = await db
      .from("contabilidad_entidades")
      .select(
        "id, nombre, email, telefono, otros_tlfs, otros_emails, direccion, lat, lng, agente_id, tipo_entidad, documento, fecha_nacimiento, created_at, tipo_cliente_id, config_tipos_cliente:tipo_cliente_id(id, etiqueta), crm_agentes:agente_id(id, nombre, apellidos, avatar_url)"
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
