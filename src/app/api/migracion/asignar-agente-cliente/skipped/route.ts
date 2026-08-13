import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServiceClient } from "@/lib/supabaseServer";

// Muestra el detalle de los clientes "skipped" (sin agente, sin poder asignar):
// agrupados por motivo, con el detalle del expediente cuando aplica, para poder
// decidir si hace falta un vínculo adicional o si de verdad no tienen expediente.
export async function GET() {
  try {
    const db = await getAgencyDbClient();

    const { data: clientesSinAgente, error: eClientes } = await db
      .from("contabilidad_entidades")
      .select("id, nombre, email, telefono")
      .is("agente_id", null)
      .or("roles->cliente.eq.true,roles->organizacion.eq.true");
    if (eClientes) throw eClientes;

    const clienteIds = new Set((clientesSinAgente ?? []).map((c: any) => c.id));

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

    const sinExpedientes: any[] = [];
    const sinAgenteResoluble: any[] = [];

    for (const cliente of clientesSinAgente ?? []) {
      const expedienteIds = [...(expedientesPorCliente.get(cliente.id) ?? [])];
      if (expedienteIds.length !== 1) continue; // sin expedientes (0) o ambiguo (>1), no nos interesa aquí

      const exp = expedientePorId.get(expedienteIds[0]);
      const agenteId = exp?.agente_id ? usuarioIdPorRaw.get(exp.agente_id) : null;
      if (agenteId) continue; // ya se resuelve, no es skipped

      if (!exp) continue; // expediente vinculado solo por pagador/viajero, no está en expContacto: no debería pasar, pero por seguridad
      sinAgenteResoluble.push({
        cliente_id: cliente.id,
        nombre: cliente.nombre,
        expediente_id: exp.id,
        numero: exp.numero,
        referencia: exp.referencia,
        agente_id_crudo: exp.agente_id,
      });
    }

    for (const cliente of clientesSinAgente ?? []) {
      const expedienteIds = [...(expedientesPorCliente.get(cliente.id) ?? [])];
      if (expedienteIds.length === 0) {
        sinExpedientes.push({ cliente_id: cliente.id, nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono });
      }
    }

    return NextResponse.json({
      success: true,
      totales: { sin_expedientes: sinExpedientes.length, sin_agente_resoluble: sinAgenteResoluble.length },
      sin_expedientes: sinExpedientes,
      sin_agente_resoluble: sinAgenteResoluble,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
