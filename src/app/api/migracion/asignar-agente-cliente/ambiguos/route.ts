import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServiceClient } from "@/lib/supabaseServer";

// Muestra el detalle de los clientes ambiguos (sin agente, presentes en más de un
// expediente con distinto agente): nombre del cliente, y por cada expediente su
// número/referencia y el agente candidato, para decidir manualmente cuál asignar.
export async function GET() {
  try {
    const db = await getAgencyDbClient();

    const { data: clientesSinAgente, error: eClientes } = await db
      .from("contabilidad_entidades")
      .select("id, nombre")
      .is("agente_id", null)
      .or("roles->cliente.eq.true,roles->organizacion.eq.true");
    if (eClientes) throw eClientes;

    const clienteIds = new Set((clientesSinAgente ?? []).map((c: any) => c.id));
    const clientePorId = new Map((clientesSinAgente ?? []).map((c: any) => [c.id, c]));

    const { data: expContacto, error: e1 } = await db
      .from("operativa_expedientes")
      .select("id, numero, referencia, agente_id, entidad_id")
      .not("entidad_id", "is", null);
    if (e1) throw e1;

    const { data: expPagador, error: e2 } = await db
      .from("operativa_pagadores_expedientes")
      .select("entidad_id, expediente_id");
    if (e2) throw e2;

    const { data: expViajero, error: e3 } = await db
      .from("operativa_viajeros_expedientes")
      .select("entidad_id, tutor_id, expediente_id");
    if (e3) throw e3;

    const expedientePorId = new Map((expContacto ?? []).map((e: any) => [e.id, e]));

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

    // Resolver agente_id de expediente (usuarios.id o auth_user_id) -> usuarios.id
    const rawAgenteIds = [...new Set((expContacto ?? []).map((e: any) => e.agente_id).filter(Boolean))];
    const adminService = createAdminServiceClient();
    const usuarioIdPorRaw = new Map<string, string>();
    const usuarioInfoPorId = new Map<string, { nombre: string; apellidos: string | null }>();
    if (rawAgenteIds.length > 0) {
      const { data: usuarios } = await adminService
        .from("usuarios")
        .select("id, auth_user_id, nombre, apellidos")
        .or(rawAgenteIds.map((id) => `id.eq.${id},auth_user_id.eq.${id}`).join(","));
      for (const raw of rawAgenteIds) {
        const match = (usuarios ?? []).find((u: any) => u.id === raw || u.auth_user_id === raw);
        if (match) {
          usuarioIdPorRaw.set(raw, match.id);
          usuarioInfoPorId.set(match.id, { nombre: match.nombre, apellidos: match.apellidos ?? null });
        }
      }
    }

    const ambiguous: any[] = [];
    for (const cliente of clientesSinAgente ?? []) {
      const expedienteIds = [...(expedientesPorCliente.get(cliente.id) ?? [])];
      if (expedienteIds.length <= 1) continue;

      const detalles = expedienteIds.map((expId) => {
        const exp = expedientePorId.get(expId);
        const agenteId = exp?.agente_id ? usuarioIdPorRaw.get(exp.agente_id) ?? null : null;
        const agenteInfo = agenteId ? usuarioInfoPorId.get(agenteId) : null;
        return {
          expediente_id: expId,
          numero: exp?.numero ?? null,
          referencia: exp?.referencia ?? null,
          agente_id: agenteId,
          agente_nombre: agenteInfo ? `${agenteInfo.nombre} ${agenteInfo.apellidos ?? ""}`.trim() : null,
        };
      });

      // Si tras resolver agentes reales todos coinciden, ya no es ambiguo
      const agentesUnicos = new Set(detalles.map((d) => d.agente_id).filter(Boolean));
      if (agentesUnicos.size <= 1) continue;

      ambiguous.push({
        cliente_id: cliente.id,
        nombre: clientePorId.get(cliente.id)?.nombre,
        expedientes: detalles,
      });
    }

    return NextResponse.json({ success: true, total: ambiguous.length, ambiguous });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
