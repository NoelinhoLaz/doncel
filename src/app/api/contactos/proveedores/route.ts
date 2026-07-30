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

    const { data: servRows, error: e2 } = await db
      .from("operativa_expedientes_servicios")
      .select("proveedor_id, expediente_id, operativa_expedientes(id, numero, referencia)")
      .not("proveedor_id", "is", null);
    if (e2) throw e2;

    const expedientesPorProveedor = new Map<string, { id: string; numero: string | null; referencia: string }[]>();
    for (const s of servRows ?? []) {
      const exp = (s as any).operativa_expedientes;
      if (!exp) continue;
      const list = expedientesPorProveedor.get((s as any).proveedor_id) ?? [];
      if (!list.some((x) => x.id === exp.id)) list.push({ id: exp.id, numero: exp.numero ?? null, referencia: exp.referencia });
      expedientesPorProveedor.set((s as any).proveedor_id, list);
    }

    const mapped = (data ?? []).map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      tipo: r.tipo ?? null,
      email: null,
      telefono: null,
      ciudad: null,
      pais: null,
      expedientes: expedientesPorProveedor.get(r.id) ?? [],
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
