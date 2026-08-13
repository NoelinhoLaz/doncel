import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServiceClient } from "@/lib/supabaseServer";

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

// v2: corrige dos bugs de route.ts —
// 1) el mapa de expedientes se construía SOLO a partir de operativa_expedientes con
//    entidad_id no nulo, así que cualquier expediente sin contacto principal pero
//    con agente_id válido quedaba invisible para clientes vinculados solo como
//    pagador/viajero/tutor.
// 2) las consultas .select() sin .range() se truncaban al límite por defecto de
//    PostgREST (1000 filas), perdiendo silenciosamente filas de tablas grandes
//    como operativa_pagadores_expedientes/operativa_viajeros_expedientes.
export async function GET(req: Request) {
  const dryRun = new URL(req.url).searchParams.get("dryRun") !== "false";

  try {
    const db = await getAgencyDbClient();

    const clientesSinAgente = await fetchAll(
      db.from("contabilidad_entidades").select("id, nombre").is("agente_id", null).or("roles->cliente.eq.true,roles->organizacion.eq.true,roles->prospecto.eq.true")
    );

    const clienteIds = new Set(clientesSinAgente.map((c: any) => c.id));
    if (clienteIds.size === 0) {
      return NextResponse.json({ success: true, dryRun, message: "No hay clientes sin agente", updated: [], ambiguous: [], skipped: [] });
    }

    // TODOS los expedientes (con o sin entidad_id), para no perder los que tienen agente_id pero no contacto principal
    const todosExpedientes = await fetchAll(db.from("operativa_expedientes").select("id, agente_id, entidad_id"));
    const expPagador = await fetchAll(db.from("operativa_pagadores_expedientes").select("entidad_id, expediente_id"));
    const expViajero = await fetchAll(db.from("operativa_viajeros_expedientes").select("entidad_id, tutor_id, expediente_id"));

    const expedientePorId = new Map(todosExpedientes.map((e: any) => [e.id, e]));

    const expedientesPorCliente = new Map<string, Set<string>>();
    const addLink = (entidadId: string | null, expedienteId: string) => {
      if (!entidadId || !clienteIds.has(entidadId)) return;
      const set = expedientesPorCliente.get(entidadId) ?? new Set<string>();
      set.add(expedienteId);
      expedientesPorCliente.set(entidadId, set);
    };
    for (const e of todosExpedientes) {
      if (e.entidad_id) addLink(e.entidad_id, e.id);
    }
    for (const p of expPagador) addLink((p as any).entidad_id, (p as any).expediente_id);
    for (const v of expViajero) {
      addLink((v as any).entidad_id, (v as any).expediente_id);
      addLink((v as any).tutor_id, (v as any).expediente_id);
    }

    const rawAgenteIds = [...new Set(todosExpedientes.map((e: any) => e.agente_id).filter(Boolean))];
    const adminService = createAdminServiceClient();
    const usuarioIdPorRaw = new Map<string, string>();
    if (rawAgenteIds.length > 0) {
      const [porId, porAuthId] = await Promise.all([
        adminService.from("usuarios").select("id, auth_user_id").in("id", rawAgenteIds),
        adminService.from("usuarios").select("id, auth_user_id").in("auth_user_id", rawAgenteIds),
      ]);
      const usuarios = [...(porId.data ?? []), ...(porAuthId.data ?? [])];
      for (const raw of rawAgenteIds) {
        const match = usuarios.find((u: any) => u.id === raw || u.auth_user_id === raw);
        if (match) usuarioIdPorRaw.set(raw, match.id);
      }
    }

    const updated: { cliente_id: string; nombre: string; agente_id: string; expediente_id: string }[] = [];
    const ambiguous: { cliente_id: string; nombre: string; expedientes: string[] }[] = [];
    const skipped: { cliente_id: string; nombre: string; reason: string }[] = [];

    for (const cliente of clientesSinAgente) {
      const expedienteIds = [...(expedientesPorCliente.get(cliente.id) ?? [])];
      if (expedienteIds.length === 0) {
        skipped.push({ cliente_id: cliente.id, nombre: cliente.nombre, reason: "sin expedientes" });
        continue;
      }

      // Resolver el agente de cada expediente vinculado, y quedarnos con los distintos agentes reales
      const agentesResueltos = new Set<string>();
      let ultimoAgenteId: string | null = null;
      let ultimoExpedienteId: string | null = null;
      for (const expId of expedienteIds) {
        const exp = expedientePorId.get(expId);
        const agenteId = exp?.agente_id ? usuarioIdPorRaw.get(exp.agente_id) ?? null : null;
        if (agenteId) {
          agentesResueltos.add(agenteId);
          ultimoAgenteId = agenteId;
          ultimoExpedienteId = expId;
        }
      }

      if (agentesResueltos.size === 0) {
        skipped.push({ cliente_id: cliente.id, nombre: cliente.nombre, reason: "expediente sin agente resoluble" });
        continue;
      }
      if (agentesResueltos.size > 1) {
        ambiguous.push({ cliente_id: cliente.id, nombre: cliente.nombre, expedientes: expedienteIds });
        continue;
      }
      updated.push({ cliente_id: cliente.id, nombre: cliente.nombre, agente_id: ultimoAgenteId as string, expediente_id: ultimoExpedienteId as string });
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
      totals: { updated: updated.length, ambiguous: ambiguous.length, skipped: skipped.length },
      updated,
      ambiguous,
      skipped,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
