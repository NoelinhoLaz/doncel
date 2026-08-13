import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

// Corrige tipo_entidad de "persona" a "empresa" para los centros/colegios importados
// en lote (roles.prospecto=true, vinculados a una oportunidad CRM) que quedaron mal
// clasificados por defecto en la importación masiva.
export async function GET(req: Request) {
  const dryRun = new URL(req.url).searchParams.get("dryRun") !== "false";

  try {
    const db = await getAgencyDbClient();

    const { data: candidatos, error: e1 } = await db
      .from("contabilidad_entidades")
      .select("id, nombre, tipo_entidad")
      .eq("tipo_entidad", "persona")
      .eq("roles->>prospecto", "true");
    if (e1) throw e1;

    const { data: opRows, error: e2 } = await db
      .from("crm_oportunidades")
      .select("entidad_id")
      .not("entidad_id", "is", null);
    if (e2) throw e2;
    const idsConOportunidad = new Set((opRows ?? []).map((r: any) => r.entidad_id));

    const aCorregir = (candidatos ?? []).filter((c: any) => idsConOportunidad.has(c.id));

    if (!dryRun && aCorregir.length > 0) {
      const { error } = await db
        .from("contabilidad_entidades")
        .update({ tipo_entidad: "empresa" })
        .in("id", aCorregir.map((c: any) => c.id));
      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      total: aCorregir.length,
      entidades: aCorregir,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
