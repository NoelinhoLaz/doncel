import { NextRequest, NextResponse } from 'next/server';
import { cambiarEstadoOportunidad } from '@/actions/crm';
import { getAgencyDbClient } from '@/lib/agencyDb';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.estado_id) {
      return NextResponse.json({ success: false, error: 'estado_id requerido' }, { status: 400 });
    }

    // Si el estado destino es "Visitando", añadir fecha de visita en las notas del log
    let notas: string | undefined = body.notas;
    try {
      const agencyDb = await getAgencyDbClient();
      const { data: estado } = await agencyDb
        .from("crm_campanas_estados")
        .select("nombre")
        .eq("id", body.estado_id)
        .single();
      if (estado?.nombre?.toLowerCase() === "visitando") {
        const hoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
        notas = notas ? `${notas} | Fecha visita: ${hoy}` : `Fecha visita: ${hoy}`;
      }
    } catch { /* best-effort */ }

    const data = await cambiarEstadoOportunidad(id, body.estado_id, notas);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
