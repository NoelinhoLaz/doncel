import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServiceClient } from "@/lib/supabaseServer";

// Asigna a cada cliente (contabilidad_entidades) sin agente el agente del expediente
// en el que aparece como contacto principal, pagador/cliente o viajero.
// Solo actúa sobre clientes con agente_id NULL. Si aparece en más de un expediente
// (con distintos agentes), se deja sin tocar y se reporta como ambiguo.
export async function GET(req: Request) {
  const dryRun = new URL(req.url).searchParams.get("dryRun") !== "false";

  try {
    const db = await getAgencyDbClient();

    const { data: clientesSinAgente, error: eClientes } = await db
      .from("contabilidad_entidades")
      .select("id, nombre")
      .is("agente_id", null)
      .or("roles->cliente.eq.true,roles->organizacion.eq.true");
    if (eClientes) throw eClientes;

    const clienteIds = new Set((clientesSinAgente ?? []).map((c: any) => c.id));
    if (clienteIds.size === 0) {
      return NextResponse.json({ success: true, dryRun, message: "No hay clientes sin agente", updated: [], ambiguous: [], skipped: [] });
    }

    // Expedientes: contacto principal
    const { data: expContacto, error: e1 } = await db
      .from("operativa_expedientes")
      .select("id, agente_id, entidad_id, created_at")
      .not("entidad_id", "is", null);
    if (e1) throw e1;

    // Expedientes: pagador/cliente
    const { data: expPagador, error: e2 } = await db
      .from("operativa_pagadores_expedientes")
      .select("entidad_id, expediente_id");
    if (e2) throw e2;

    // Expedientes: viajero y tutor
    const { data: expViajero, error: e3 } = await db
      .from("operativa_viajeros_expedientes")
      .select("entidad_id, tutor_id, expediente_id");
    if (e3) throw e3;

    const expedientePorId = new Map((expContacto ?? []).map((e: any) => [e.id, e]));

    // entidad_id (cliente) -> Set de expediente_id en los que aparece
    const expedientesPorCliente = new Map<string, Set<string>>();
    const addLink = (entidadId: string | null, expedienteId: string) => {
      if (!entidadId || !clienteIds.has(entidadId)) return;
      const set = expedientesPorCliente.get(entidadId) ?? new Set<string>();
      set.add(expedienteId);
      expedientesPorCliente.set(entidadId, set);
    };
    for (const e of expContacto ?? []) addLink(e.entidad_id, e.id);
    for (const p of expPagador ?? []) addLink((p as any).entidad_id, (p as any).expediente_id);
    for (const v of expViajero ?? []) {
      addLink((v as any).entidad_id, (v as any).expediente_id);
      addLink((v as any).tutor_id, (v as any).expediente_id);
    }

    // Resolver agente_id de expediente (usuarios.id o auth_user_id) -> usuarios.id (= crm_agentes.id)
    const rawAgenteIds = [...new Set((expContacto ?? []).map((e: any) => e.agente_id).filter(Boolean))];
    const adminService = createAdminServiceClient();
    const usuarioIdPorRaw = new Map<string, string>();
    if (rawAgenteIds.length > 0) {
      const { data: usuarios } = await adminService
        .from("usuarios")
        .select("id, auth_user_id")
        .or(rawAgenteIds.map((id) => `id.eq.${id},auth_user_id.eq.${id}`).join(","));
      for (const raw of rawAgenteIds) {
        const match = (usuarios ?? []).find((u: any) => u.id === raw || u.auth_user_id === raw);
        if (match) usuarioIdPorRaw.set(raw, match.id);
      }
    }

    const updated: { cliente_id: string; nombre: string; agente_id: string; expediente_id: string }[] = [];
    const ambiguous: { cliente_id: string; nombre: string; expedientes: string[] }[] = [];
    const skipped: { cliente_id: string; nombre: string; reason: string }[] = [];

    for (const cliente of clientesSinAgente ?? []) {
      const expedienteIds = [...(expedientesPorCliente.get(cliente.id) ?? [])];
      if (expedienteIds.length === 0) {
        skipped.push({ cliente_id: cliente.id, nombre: cliente.nombre, reason: "sin expedientes" });
        continue;
      }
      if (expedienteIds.length > 1) {
        ambiguous.push({ cliente_id: cliente.id, nombre: cliente.nombre, expedientes: expedienteIds });
        continue;
      }
      const exp = expedientePorId.get(expedienteIds[0]);
      const rawAgenteId = exp?.agente_id;
      const agenteId = rawAgenteId ? usuarioIdPorRaw.get(rawAgenteId) : null;
      if (!agenteId) {
        skipped.push({ cliente_id: cliente.id, nombre: cliente.nombre, reason: "expediente sin agente resoluble" });
        continue;
      }
      updated.push({ cliente_id: cliente.id, nombre: cliente.nombre, agente_id: agenteId, expediente_id: expedienteIds[0] });
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
