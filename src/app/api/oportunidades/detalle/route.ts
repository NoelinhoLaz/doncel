import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

    const agencyDb = await getAgencyDbClient();

    const { data: op, error } = await agencyDb
      .from("crm_oportunidades")
      .select("id, titulo, entidad_id, contacto_id")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!op) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });

    let entidad_nombre: string | null = null;
    if (op.entidad_id) {
      const { data: ent } = await agencyDb
        .from("contabilidad_entidades")
        .select("nombre")
        .eq("id", op.entidad_id)
        .single();
      entidad_nombre = ent?.nombre ?? null;
    }

    return NextResponse.json({ success: true, data: { ...op, entidad_nombre } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
