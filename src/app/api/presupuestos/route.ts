import { NextResponse } from "next/server";
import { createPresupuesto, getPresupuestos } from "@/actions/presupuestos";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const oportunidadId = searchParams.get("oportunidad_id");
    const data = await getPresupuestos(oportunidadId ? { oportunidad_id: oportunidadId } : undefined);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.titulo_viaje?.trim()) {
      return NextResponse.json({ success: false, error: "El título es obligatorio" }, { status: 400 });
    }
    if (!body.tipo_presupuesto) {
      return NextResponse.json({ success: false, error: "El tipo de presupuesto es obligatorio" }, { status: 400 });
    }
    if (!body.plazas_estimadas || Number(body.plazas_estimadas) < 1) {
      return NextResponse.json({ success: false, error: "Las plazas deben ser al menos 1" }, { status: 400 });
    }

    const result = await createPresupuesto({
      entidad_id: body.entidad_id || null,
      responsable_contacto_id: body.responsable_contacto_id || null,
      nueva_entidad: body.nueva_entidad || null,
      oportunidad_id: body.oportunidad_id || null,
      campana_id: body.campana_id || null,
      titulo_viaje: body.titulo_viaje,
      tipo_presupuesto: body.tipo_presupuesto,
      plazas_estimadas: Number(body.plazas_estimadas),
      destino_ids: body.destino_ids ?? [],
      fecha_salida_estimada: body.fecha_salida_estimada || null,
      margen_salida_dias: body.margen_salida_dias ? Number(body.margen_salida_dias) : null,
      fecha_regreso_estimada: body.fecha_regreso_estimada || null,
      margen_regreso_dias: body.margen_regreso_dias ? Number(body.margen_regreso_dias) : null,
      noches_estimadas: body.noches_estimadas ? Number(body.noches_estimadas) : null,
      pvp_estimado: body.pvp_estimado ? Number(body.pvp_estimado) : null,
      preferencias: body.preferencias ?? {},
      notas_iniciales: body.notas_iniciales || null,
    });

    return NextResponse.json(result, { status: result.success ? 201 : 500 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
