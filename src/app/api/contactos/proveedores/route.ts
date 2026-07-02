import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET() {
  try {
    const db = await getAgencyDbClient();
    const { data, error } = await db
      .from("contabilidad_proveedores")
      .select("id, nombre, tipo, observaciones")
      .order("nombre", { ascending: true });

    if (error) throw error;

    const mapped = (data ?? []).map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      tipo: r.tipo ?? null,
      email: null,
      telefono: null,
      ciudad: null,
      pais: null,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
