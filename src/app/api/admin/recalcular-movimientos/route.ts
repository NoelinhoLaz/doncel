import { getAgencyDbClient } from "@/lib/agencyDb";
import { recalcularEstadoMovimientoBanco } from "@/lib/conciliacion/contabilidadService";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const agencyDb = await getAgencyDbClient();

    const movimientosIds = [
      "574c5974-8b27-4728-a4df-b4b188af8476",
      "852d3aa4-5e7d-4bec-a086-48f396b3bc24",
      "c8067065-065b-4cfd-8321-7472c8381972",
      "3601bc14-84f7-4826-a963-6c32409cb749",
      "fa08f68a-b8da-4767-bf7d-95936886f295",
      "b2da9348-cac3-4eb3-9963-5ba46f9c9e98",
      "40ea2795-bb3d-487a-9629-95b3808d2b0f",
      "de660dc6-89fa-4cc3-bca5-39d7ab94c8b8",
      "4b5a3518-641c-4e94-b211-f181f72622a2",
      "c17ea336-1859-4dcd-a54a-bddbbc87f67b",
    ];

    const resultados = [];
    for (const id of movimientosIds) {
      const nuevoEstado = await recalcularEstadoMovimientoBanco(agencyDb, id, "manual");
      resultados.push({ id, nuevoEstado });
    }

    return NextResponse.json({ success: true, resultados });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
