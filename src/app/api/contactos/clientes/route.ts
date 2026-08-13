import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET() {
  try {
    const db = await getAgencyDbClient();

    // Entidades con rol cliente/organizacion
    const { data: conRol, error: e1 } = await db
      .from("contabilidad_entidades")
      .select("id, nombre, email, telefono, direccion, agente_id, tipo_entidad, otros_tlfs, otros_emails, lat, lng, documento, fecha_nacimiento, created_at")
      .or("roles->cliente.eq.true,roles->organizacion.eq.true");

    if (e1) throw e1;

    // Entidades que aparecen como entidad_id en oportunidades CRM (centros, colegios, etc.)
    const { data: opRows, error: e2 } = await db
      .from("crm_oportunidades")
      .select("entidad_id")
      .not("entidad_id", "is", null);

    if (e2) throw e2;

    const crmIds = [...new Set((opRows ?? []).map((r: any) => r.entidad_id as string))];

    let conCrm: any[] = [];
    if (crmIds.length > 0) {
      const { data, error: e3 } = await db
        .from("contabilidad_entidades")
        .select("id, nombre, email, telefono, direccion, agente_id, tipo_entidad, otros_tlfs, otros_emails, lat, lng, documento, fecha_nacimiento, created_at")
        .in("id", crmIds);
      if (e3) throw e3;
      conCrm = data ?? [];
    }

    // Oficina/sucursal de cada agente (vía config_usuarios -> config_oficinas)
    const { data: configUsuarios } = await db
      .from("config_usuarios")
      .select("usuario_id, oficina");
    const { data: oficinas } = await db
      .from("config_oficinas")
      .select("id, nombre");
    const oficinaNombrePorId = new Map((oficinas ?? []).map((o: any) => [o.id, o.nombre]));
    const oficinaIdPorAgente = new Map((configUsuarios ?? []).map((cu: any) => [cu.usuario_id, cu.oficina]));

    // Datos de agentes (para mostrar el agente asignado al cliente)
    const { data: agentesRows } = await db
      .from("crm_agentes")
      .select("id, nombre, apellidos, avatar_url");
    const agentePorId = new Map((agentesRows ?? []).map((a: any) => {
      const oficinaId = oficinaIdPorAgente.get(a.id);
      const agenteSucursal = oficinaId ? (oficinaNombrePorId.get(oficinaId) ?? null) : null;
      return [a.id, { ...a, sucursal: agenteSucursal }];
    }));

    // Todos los expedientes (para resolver numero/referencia por id)
    const { data: todosExpedientes, error: e4 } = await db
      .from("operativa_expedientes")
      .select("id, numero, referencia, entidad_id");
    if (e4) throw e4;
    const expedientePorId = new Map((todosExpedientes ?? []).map((e: any) => [e.id, { id: e.id, numero: e.numero ?? null, referencia: e.referencia }]));

    const expedientesPorEntidad = new Map<string, { id: string; numero: string | null; referencia: string }[]>();
    const addExpediente = (entidadId: string, exp: { id: string; numero: string | null; referencia: string }) => {
      const list = expedientesPorEntidad.get(entidadId) ?? [];
      if (!list.some((e) => e.id === exp.id)) list.push(exp);
      expedientesPorEntidad.set(entidadId, list);
    };

    // Vinculados como contacto principal del expediente
    for (const exp of todosExpedientes ?? []) {
      if (exp.entidad_id) addExpediente(exp.entidad_id, { id: exp.id, numero: exp.numero ?? null, referencia: exp.referencia });
    }

    // Vinculados como viajero o tutor
    const { data: viajerosRows, error: e5 } = await db
      .from("operativa_viajeros_expedientes")
      .select("entidad_id, tutor_id, expediente_id");
    if (e5) throw e5;
    for (const row of viajerosRows ?? []) {
      const exp = expedientePorId.get((row as any).expediente_id);
      if (!exp) continue;
      const r = row as any;
      if (r.entidad_id) addExpediente(r.entidad_id, exp);
      if (r.tutor_id) addExpediente(r.tutor_id, exp);
    }

    // Vinculados como pagador/cliente del expediente
    const { data: pagadoresRows, error: e6 } = await db
      .from("operativa_pagadores_expedientes")
      .select("entidad_id, expediente_id");
    if (e6) throw e6;
    for (const row of pagadoresRows ?? []) {
      const exp = expedientePorId.get((row as any).expediente_id);
      if (!exp) continue;
      if ((row as any).entidad_id) addExpediente((row as any).entidad_id, exp);
    }

    // Merge, deduplicar por id
    const seen = new Set<string>();
    const all: any[] = [];
    for (const r of [...(conRol ?? []), ...conCrm]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const dir = r.direccion ?? {};
      const oficinaId = r.agente_id ? oficinaIdPorAgente.get(r.agente_id) : null;
      const sucursal = oficinaId ? (oficinaNombrePorId.get(oficinaId) ?? null) : null;
      all.push({
        id: r.id,
        nombre: r.nombre,
        email: r.email ?? null,
        telefono: r.telefono ?? null,
        ciudad: dir.ciudad ?? dir.localidad ?? dir.municipio ?? null,
        pais: dir.pais ?? null,
        sucursal,
        expedientes: expedientesPorEntidad.get(r.id) ?? [],
        tipo_entidad: r.tipo_entidad ?? null,
        direccion: r.direccion ?? null,
        otros_tlfs: r.otros_tlfs ?? null,
        otros_emails: r.otros_emails ?? null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        agente_id: r.agente_id ?? null,
        agente: r.agente_id ? (agentePorId.get(r.agente_id) ?? null) : null,
        documento: r.documento ?? null,
        fecha_nacimiento: r.fecha_nacimiento ?? null,
        created_at: r.created_at ?? null,
      });
    }

    all.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ success: true, data: all });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
