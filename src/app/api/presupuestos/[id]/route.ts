import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const agencyDb = await getAgencyDbClient();

    const update: Record<string, any> = {};
    if (body.titulo_viaje !== undefined) update.titulo_viaje = body.titulo_viaje;
    if (body.tipo_presupuesto !== undefined) update.tipo_presupuesto = body.tipo_presupuesto;
    if (body.plazas_estimadas !== undefined) update.plazas_estimadas = body.plazas_estimadas;
    if (body.destino_ids !== undefined) update.destino_ids = body.destino_ids;
    if (body.fecha_salida_estimada !== undefined) update.fecha_salida_estimada = body.fecha_salida_estimada;
    if (body.margen_salida_dias !== undefined) update.margen_salida_dias = body.margen_salida_dias;
    if (body.fecha_regreso_estimada !== undefined) update.fecha_regreso_estimada = body.fecha_regreso_estimada;
    if (body.margen_regreso_dias !== undefined) update.margen_regreso_dias = body.margen_regreso_dias;
    if (body.noches_estimadas !== undefined) update.noches_estimadas = body.noches_estimadas;
    if (body.pvp_estimado !== undefined) update.pvp_estimado = body.pvp_estimado;
    if (body.preferencias !== undefined) update.preferencias = body.preferencias;
    if (body.notas_iniciales !== undefined) update.notas_iniciales = body.notas_iniciales;
    if (body.entidad_id !== undefined) update.entidad_id = body.entidad_id;
    if (body.campana_id !== undefined) update.campana_id = body.campana_id || null;
    if (body.oportunidad_id !== undefined) update.oportunidad_id = body.oportunidad_id || null;

    const { data, error } = await agencyDb
      .from("operativa_presupuestos")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    // Actualizar responsable si viene
    if (body.responsable_contacto_id) {
      const { data: crm, error: crmError } = await agencyDb
        .from("crm_contactos")
        .select("nombre, cargo, email, telefono")
        .eq("id", body.responsable_contacto_id)
        .single();
      if (crm) {
        await agencyDb.from("operativa_presupuesto_contactos").delete().eq("presupuesto_id", id);
        await agencyDb.from("operativa_presupuesto_contactos").insert([{
          presupuesto_id: id,
          crm_contacto_id: body.responsable_contacto_id,
          nombre: crm.nombre,
          apellidos: null,
          cargo: crm.cargo ?? null,
          email: crm.email ?? null,
          telefono: crm.telefono ?? null,
          es_principal: true,
        }]);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
