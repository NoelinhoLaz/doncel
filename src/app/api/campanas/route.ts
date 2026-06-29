import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado");

    const agencyDb = await getAgencyDbClient();

    let query = agencyDb
      .from("crm_campanas")
      .select("id, nombre, estado, tipo, configuracion_pipeline")
      .order("nombre", { ascending: true });

    if (estado) query = query.eq("estado", estado);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
