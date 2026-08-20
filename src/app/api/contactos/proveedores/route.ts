import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export const dynamic = "force-dynamic";

// Supabase/PostgREST corta cada respuesta en 1000 filas por defecto — con más
// proveedores/servicios que eso, hay que paginar explícitamente o se pierden filas
// silenciosamente (ej: un proveedor alfabéticamente "tardío" nunca llega al cliente).
async function fetchAllPaginated<T>(
  queryBuilder: (db: any) => any,
  db: any,
  pageSize = 1000
): Promise<T[]> {
  let all: T[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await queryBuilder(db).range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

export async function GET() {
  try {
    const db = await getAgencyDbClient();
    const data = await fetchAllPaginated(
      (db) => db
        .from("contabilidad_proveedores")
        .select('id, nombre, razon_social, tipo, observaciones, email, telefono, direccion, codigo_postal, localidad, comunidad, pais, "CIF", nombre_contacto, cargo, alias')
        .order("nombre", { ascending: true }),
      db
    );

    const servRows = await fetchAllPaginated(
      (db) => db
        .from("operativa_expedientes_servicios")
        .select("proveedor_id, expediente_id, operativa_expedientes(id, numero, referencia)")
        .not("proveedor_id", "is", null),
      db
    );

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
      razon_social: r.razon_social ?? null,
      tipo: r.tipo ?? null,
      observaciones: r.observaciones ?? null,
      email: r.email ?? null,
      telefono: r.telefono ?? null,
      direccion: r.direccion ?? null,
      codigo_postal: r.codigo_postal ?? null,
      ciudad: r.localidad ?? null,
      localidad: r.localidad ?? null,
      comunidad: r.comunidad ?? null,
      pais: r.pais ?? null,
      CIF: r.CIF ?? null,
      nombre_contacto: r.nombre_contacto ?? null,
      cargo: r.cargo ?? null,
      alias: r.alias ?? [],
      expedientes: expedientesPorProveedor.get(r.id) ?? [],
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
