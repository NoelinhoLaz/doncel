import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const campanaId = searchParams.get("campana_id");
    const q = searchParams.get("q")?.trim() ?? "";

    if (!campanaId) {
      return NextResponse.json({ success: false, error: "campana_id requerido" }, { status: 400 });
    }

    const agencyDb = await getAgencyDbClient();

    // Base: todas las oportunidades de la campaña (sin query) o filtradas por título
    const opQuery = agencyDb
      .from("crm_oportunidades")
      .select("id, titulo, valor_estimado, entidad_id, estado_id")
      .eq("campana_id", campanaId)
      .order("created_at", { ascending: false })
      .limit(30);

    const [{ data: opsPorTitulo }, entidadesQResult] = await Promise.all([
      q.length >= 2 ? opQuery.ilike("titulo", `%${q}%`) : opQuery,
      // Buscar entidades por nombre en paralelo si hay query
      q.length >= 2
        ? agencyDb.from("contabilidad_entidades").select("id, nombre, email, telefono").ilike("nombre", `%${q}%`).limit(20)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const entidadMap: Record<string, any> = {};
    let allOps: any[] = [...(opsPorTitulo ?? [])];
    const existingIds = new Set(allOps.map((o: any) => o.id));

    // Si hay entidades que coinciden con el query, buscar sus oportunidades en la campaña
    const entidadesQ: any[] = (entidadesQResult as any).data ?? [];
    if (entidadesQ.length > 0) {
      entidadesQ.forEach((e: any) => { entidadMap[e.id] = e; });
      const entQIds = entidadesQ.map((e: any) => e.id);
      const { data: opsPorEntidad } = await agencyDb
        .from("crm_oportunidades")
        .select("id, titulo, valor_estimado, entidad_id, estado_id")
        .eq("campana_id", campanaId)
        .in("entidad_id", entQIds)
        .limit(20);
      (opsPorEntidad ?? []).forEach((o: any) => {
        if (!existingIds.has(o.id)) { allOps.push(o); existingIds.add(o.id); }
      });
    }

    if (allOps.length === 0) return NextResponse.json({ success: true, data: [] });

    // Cargar entidades que falten
    const missingEntidadIds = [...new Set(allOps.map((o: any) => o.entidad_id).filter((id: any) => id && !entidadMap[id]))];
    if (missingEntidadIds.length > 0) {
      const { data: entidades } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre, email, telefono")
        .in("id", missingEntidadIds);
      (entidades ?? []).forEach((e: any) => { entidadMap[e.id] = e; });
    }

    // Cargar estados
    const estadoIds = [...new Set(allOps.map((o: any) => o.estado_id).filter(Boolean))];
    const estadoMap: Record<string, any> = {};
    if (estadoIds.length > 0) {
      const { data: estados } = await agencyDb
        .from("crm_campanas_estados")
        .select("id, nombre, color")
        .in("id", estadoIds);
      (estados ?? []).forEach((e: any) => { estadoMap[e.id] = e; });
    }

    const mapped = allOps.map((o: any) => ({
      id: o.id,
      titulo: o.titulo,
      valor_estimado: o.valor_estimado,
      entidad_id: o.entidad_id,
      entidad_nombre: entidadMap[o.entidad_id]?.nombre ?? null,
      entidad_email: entidadMap[o.entidad_id]?.email ?? null,
      entidad_telefono: entidadMap[o.entidad_id]?.telefono ?? null,
      estado_nombre: estadoMap[o.estado_id]?.nombre ?? null,
      estado_color: estadoMap[o.estado_id]?.color ?? null,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
