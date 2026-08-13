import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

// Resuelve manualmente los clientes ambiguos detectados por el backfill,
// asignándoles el agente indicado. Solo actúa sobre los ids pasados, y solo
// si su agente_id sigue siendo NULL (no sobrescribe asignaciones existentes).
const CLIENTE_IDS = [
  "aa0f4ea3-5145-4588-a195-fb9160eb8143", // Lorena Blázquez de la Asunción
  "e81c412b-7eda-4dc4-86ab-cb15223d747a", // ANDREA PIÑERO CABEZA
  "998c2642-2f21-413c-b33a-530a47070aec", // Fadwa Alhashemi
];
const AGENTE_ID = "2b0845db-0ee8-4803-8c62-50ddc1daaa48"; // Sheila Mendieta

export async function GET(req: Request) {
  const dryRun = new URL(req.url).searchParams.get("dryRun") !== "false";

  try {
    const db = await getAgencyDbClient();

    if (!dryRun) {
      const { error } = await db
        .from("contabilidad_entidades")
        .update({ agente_id: AGENTE_ID })
        .in("id", CLIENTE_IDS)
        .is("agente_id", null);
      if (error) throw error;
    }

    const { data, error: eCheck } = await db
      .from("contabilidad_entidades")
      .select("id, nombre, agente_id")
      .in("id", CLIENTE_IDS);
    if (eCheck) throw eCheck;

    return NextResponse.json({ success: true, dryRun, agente_id: AGENTE_ID, clientes: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
