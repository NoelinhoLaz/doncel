import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

// operativa_cotizaciones.destinos (jsonb) quedó con muchas referencias huérfanas
// tras el importador legacy (ids que no existen en maestro_destinos). En vez de
// intentar remapearlas automáticamente, este script vacía `destinos` en las
// cotizaciones que tengan al menos un destino huérfano, para que el destino se
// vuelva a introducir manualmente desde la UI (que sí usa maestro_destinos real).
export async function GET(req: Request) {
  const dryRun = new URL(req.url).searchParams.get("dryRun") !== "false";

  try {
    const db = await getAgencyDbClient();

    const { data: cotizaciones, error: eCot } = await db
      .from("operativa_cotizaciones")
      .select("id, titulo, destinos")
      .not("destinos", "is", null);
    if (eCot) throw eCot;

    const conDestinos = (cotizaciones ?? []).filter((c: any) => Array.isArray(c.destinos) && c.destinos.length > 0);

    const idsReferenciados = new Set<string>();
    conDestinos.forEach((c: any) => c.destinos.forEach((d: any) => { if (d?.id) idsReferenciados.add(d.id); }));

    const { data: maestrosExistentes } = await db
      .from("maestro_destinos")
      .select("id")
      .in("id", Array.from(idsReferenciados));
    const idsValidos = new Set((maestrosExistentes ?? []).map((m: any) => m.id));

    const afectadas = conDestinos.filter((c: any) => c.destinos.some((d: any) => !idsValidos.has(d?.id)));

    if (!dryRun) {
      for (const c of afectadas) {
        const { error } = await db.from("operativa_cotizaciones").update({ destinos: [] }).eq("id", c.id);
        if (error) throw error;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      resumen: { cotizaciones_afectadas: afectadas.length },
      detalle: afectadas.map((c: any) => ({ cotizacion_id: c.id, titulo: c.titulo, destinos_actuales: c.destinos })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
