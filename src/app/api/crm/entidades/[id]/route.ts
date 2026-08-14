import { NextRequest, NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = await getAgencyDbClient();

    const update: Record<string, any> = {};
    if (body.nombre !== undefined) update.nombre = body.nombre;
    if (body.telefono !== undefined) update.telefono = body.telefono;
    if (body.otros_tlfs !== undefined) update.otros_tlfs = body.otros_tlfs;
    if (body.email !== undefined) update.email = body.email;
    if (body.otros_emails !== undefined) update.otros_emails = body.otros_emails;
    if (body.lat !== undefined) update.lat = body.lat;
    if (body.lng !== undefined) update.lng = body.lng;
    if (body.direccion !== undefined) update.direccion = typeof body.direccion === "string" ? { direccion: body.direccion } : body.direccion;
    if (body.agente_id !== undefined) update.agente_id = body.agente_id;
    if (body.documento !== undefined) update.documento = body.documento;
    if (body.fecha_nacimiento !== undefined) update.fecha_nacimiento = body.fecha_nacimiento;
    if (body.tipo_cliente_id !== undefined) update.tipo_cliente_id = body.tipo_cliente_id;

    const { data, error } = await db
      .from("contabilidad_entidades")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getAgencyDbClient();

    const checks: { label: string; count: number }[] = [];

    const [presupuestos, expedientes, cotizaciones, propuestas, oportunidades, viajero, pagador] = await Promise.all([
      db.from("operativa_presupuestos").select("id", { count: "exact", head: true }).eq("entidad_id", id),
      db.from("operativa_expedientes").select("id", { count: "exact", head: true }).eq("entidad_id", id),
      db.from("operativa_cotizaciones").select("id", { count: "exact", head: true }).eq("contacto", id),
      db.from("operativa_propuestas").select("id", { count: "exact", head: true }).eq("contacto_id", id),
      db.from("crm_oportunidades").select("id", { count: "exact", head: true }).eq("entidad_id", id),
      db.from("operativa_viajeros_expedientes").select("id", { count: "exact", head: true }).eq("entidad_id", id),
      db.from("operativa_pagadores_expedientes").select("id", { count: "exact", head: true }).eq("entidad_id", id),
    ]);

    if ((presupuestos.count ?? 0) > 0) checks.push({ label: "presupuestos", count: presupuestos.count! });
    if ((expedientes.count ?? 0) > 0) checks.push({ label: "expedientes", count: expedientes.count! });
    if ((cotizaciones.count ?? 0) > 0) checks.push({ label: "cotizaciones", count: cotizaciones.count! });
    if ((propuestas.count ?? 0) > 0) checks.push({ label: "propuestas", count: propuestas.count! });
    if ((oportunidades.count ?? 0) > 0) checks.push({ label: "oportunidades", count: oportunidades.count! });
    if ((viajero.count ?? 0) > 0) checks.push({ label: "expedientes (como viajero)", count: viajero.count! });
    if ((pagador.count ?? 0) > 0) checks.push({ label: "expedientes (como pagador)", count: pagador.count! });

    if (checks.length > 0) {
      return NextResponse.json({
        success: false,
        error: "No se puede eliminar: el cliente tiene elementos vinculados.",
        vinculaciones: checks,
      }, { status: 409 });
    }

    const { error } = await db.from("contabilidad_entidades").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
