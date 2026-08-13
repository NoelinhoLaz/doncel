import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

// Resuelve manualmente el último caso "ambiguo": ambos expedientes de este cliente
// tienen en realidad el mismo agente (Belén María Morello), solo que uno de ellos
// no tiene entidad_id como contacto principal, lo que confundía al filtro del script.
const CLIENTE_ID = "29f8929a-8dc7-41de-83db-94fe15d9f54b"; // -M Carmen Dominguez Baena -
const AGENTE_ID = "5a7a17b6-239f-495f-9803-b4145072d10c"; // Belén María Morello

export async function GET(req: Request) {
  const dryRun = new URL(req.url).searchParams.get("dryRun") !== "false";

  try {
    const db = await getAgencyDbClient();

    if (!dryRun) {
      const { error } = await db
        .from("contabilidad_entidades")
        .update({ agente_id: AGENTE_ID })
        .eq("id", CLIENTE_ID)
        .is("agente_id", null);
      if (error) throw error;
    }

    const { data, error: eCheck } = await db
      .from("contabilidad_entidades")
      .select("id, nombre, agente_id")
      .eq("id", CLIENTE_ID)
      .single();
    if (eCheck) throw eCheck;

    return NextResponse.json({ success: true, dryRun, agente_id: AGENTE_ID, cliente: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
