import { NextRequest, NextResponse } from "next/server";
import { syncBridgeTransactionsAllAgencies } from "@/lib/banco/bridgeApi";

// Sincroniza movimientos bancarios vía Bridge para todas las agencias que ya
// tienen un banco conectado. Pensado para ejecutarse diariamente (Vercel Cron).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados = await syncBridgeTransactionsAllAgencies();
  const totalInsertados = resultados.reduce((sum, r) => sum + r.insertados, 0);

  return NextResponse.json({ agencias: resultados.length, totalInsertados, resultados });
}
