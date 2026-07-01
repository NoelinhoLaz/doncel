import { NextRequest, NextResponse } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";

// Llamado internamente desde server actions de tenant cuando se crea/actualiza una cotización
// No expone datos de agencia o cliente
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-ingest-secret");
    if (secret !== process.env.ANALYTICS_INGEST_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { lat, lng, destino_nombre, mes_viaje, total_plazas, tipo_grupo, localidad, provincia } = body;

    if (!lat || !lng || !mes_viaje) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    const admin = createAdminServiceClient();
    const { error } = await (admin as any).from("metricas_cotizaciones").insert({
      lat: Number(lat),
      lng: Number(lng),
      destino_nombre: localidad ?? destino_nombre ?? null,
      mes_viaje,
      total_plazas: total_plazas ?? 1,
      tipo_grupo: tipo_grupo ?? null,
      localidad: localidad ?? null,
      provincia: provincia ?? null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
