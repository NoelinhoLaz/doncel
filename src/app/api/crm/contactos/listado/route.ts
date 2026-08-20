import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function GET() {
  try {
    const db = await getAgencyDbClient();

    // Contactos vigentes por entidad: vía crm_contactos_organizaciones (es_activa=true),
    // NO vía crm_contactos.entidad_id (ese campo queda congelado al crear el contacto y
    // no se actualiza al reasignarlo a otra organización).
    const { data: rels, error: e1 } = await db
      .from("crm_contactos_organizaciones")
      .select("entidad_id, crm_contactos(id, nombre, cargo, email, telefono, es_principal, activo, metadatos)")
      .eq("es_activa", true);
    if (e1) throw e1;

    const entidadIds = [...new Set((rels ?? []).map((r: any) => r.entidad_id).filter(Boolean))];

    let entidades: any[] = [];
    if (entidadIds.length > 0) {
      const { data, error: e2 } = await db
        .from("contabilidad_entidades")
        .select("id, nombre, agente_id")
        .in("id", entidadIds);
      if (e2) throw e2;
      entidades = data ?? [];
    }
    const entidadPorId = new Map(entidades.map((e: any) => [e.id, e]));

    // Oficina/sucursal de cada agente (vía config_usuarios -> config_oficinas)
    const { data: configUsuarios } = await db.from("config_usuarios").select("usuario_id, oficina");
    const { data: oficinas } = await db.from("config_oficinas").select("id, nombre");
    const oficinaNombrePorId = new Map((oficinas ?? []).map((o: any) => [o.id, o.nombre]));
    const oficinaIdPorAgente = new Map((configUsuarios ?? []).map((cu: any) => [cu.usuario_id, cu.oficina]));

    const { data: agentesRows } = await db.from("crm_agentes").select("id, nombre, apellidos, avatar_url");
    const agentePorId = new Map((agentesRows ?? []).map((a: any) => [a.id, a]));

    const seen = new Set<string>();
    const all: any[] = [];
    for (const rel of rels ?? []) {
      const r = rel as any;
      const c = r.crm_contactos;
      if (!c || !c.activo || seen.has(c.id)) continue;
      seen.add(c.id);

      const ent = entidadPorId.get(r.entidad_id);
      const agenteId = ent?.agente_id ?? null;
      const agente = agenteId ? (agentePorId.get(agenteId) ?? null) : null;
      const oficinaId = agenteId ? oficinaIdPorAgente.get(agenteId) : null;
      const sucursal = oficinaId ? (oficinaNombrePorId.get(oficinaId) ?? null) : null;

      all.push({
        id: c.id,
        nombre: c.nombre,
        cargo: c.cargo ?? null,
        email: c.email ?? null,
        telefono: c.telefono ?? null,
        es_principal: !!c.es_principal,
        metadatos: c.metadatos ?? null,
        entidad_id: r.entidad_id,
        entidad_nombre: ent?.nombre ?? null,
        agente_id: agenteId,
        agente,
        sucursal,
      });
    }

    all.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ success: true, data: all });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
