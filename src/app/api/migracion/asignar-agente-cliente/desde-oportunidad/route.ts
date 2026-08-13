import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

// Trae TODAS las filas de un query builder ya construido, paginando en bloques de
// 1000 (límite por defecto de PostgREST que trunca .select() sin .range()).
async function fetchAll(queryBuilder: any) {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];
  while (true) {
    const { data, error } = await queryBuilder.range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data ?? []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Asigna a cada cliente sin agente (contabilidad_entidades.agente_id NULL) el agente
// de su oportunidad CRM más reciente (crm_oportunidades.agente_id, que ya apunta
// directamente a crm_agentes.id, sin necesidad de resolver contra usuarios).
export async function GET(req: Request) {
  const dryRun = new URL(req.url).searchParams.get("dryRun") !== "false";

  try {
    const db = await getAgencyDbClient();

    const clientesSinAgente = await fetchAll(
      db.from("contabilidad_entidades").select("id, nombre").is("agente_id", null).or("roles->cliente.eq.true,roles->organizacion.eq.true,roles->prospecto.eq.true")
    );
    const clienteIds = new Set(clientesSinAgente.map((c: any) => c.id));
    if (clienteIds.size === 0) {
      return NextResponse.json({ success: true, dryRun, message: "No hay clientes sin agente", updated: [], skipped: [] });
    }

    const oportunidades = await fetchAll(
      db.from("crm_oportunidades").select("id, entidad_id, agente_id, created_at").not("entidad_id", "is", null)
    );

    // entidad_id -> oportunidad más reciente con agente_id no nulo
    const mejorOportunidadPorEntidad = new Map<string, { oportunidad_id: string; agente_id: string; created_at: string }>();
    for (const op of oportunidades) {
      if (!op.entidad_id || !op.agente_id || !clienteIds.has(op.entidad_id)) continue;
      const actual = mejorOportunidadPorEntidad.get(op.entidad_id);
      if (!actual || new Date(op.created_at).getTime() > new Date(actual.created_at).getTime()) {
        mejorOportunidadPorEntidad.set(op.entidad_id, { oportunidad_id: op.id, agente_id: op.agente_id, created_at: op.created_at });
      }
    }

    const updated: { cliente_id: string; nombre: string; agente_id: string; oportunidad_id: string }[] = [];
    const skipped: { cliente_id: string; nombre: string; reason: string }[] = [];

    for (const cliente of clientesSinAgente) {
      const mejor = mejorOportunidadPorEntidad.get(cliente.id);
      if (!mejor) {
        skipped.push({ cliente_id: cliente.id, nombre: cliente.nombre, reason: "sin oportunidad con agente" });
        continue;
      }
      updated.push({ cliente_id: cliente.id, nombre: cliente.nombre, agente_id: mejor.agente_id, oportunidad_id: mejor.oportunidad_id });
    }

    if (!dryRun && updated.length > 0) {
      for (const u of updated) {
        const { error } = await db
          .from("contabilidad_entidades")
          .update({ agente_id: u.agente_id })
          .eq("id", u.cliente_id)
          .is("agente_id", null);
        if (error) throw error;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totals: { updated: updated.length, skipped: skipped.length },
      updated,
      skipped,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
