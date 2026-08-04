import { getAgencyDbClient } from "@/lib/agencyDb";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo") || "total";
    const año = searchParams.get("año");

    if (tipo === "total") {
      const { data, error } = await agencyDb.rpc("get_gastos_financieros_total");
      if (error) throw error;
      return NextResponse.json({
        success: true,
        data: data?.[0] || null,
        mensaje: `Total de gastos financieros: ${data?.[0]?.total_gastos_financieros || 0}€ en ${data?.[0]?.cantidad_movimientos || 0} movimientos`,
      });
    }

    if (tipo === "por_mes") {
      const { data, error } = await agencyDb.rpc(
        "get_gastos_financieros_por_mes",
        { p_año: año ? parseInt(año) : null }
      );
      if (error) throw error;
      return NextResponse.json({
        success: true,
        data: data || [],
        mensaje: `Gastos financieros por mes${año ? ` en ${año}` : ""}`,
      });
    }

    if (tipo === "por_oficina") {
      const { data, error } = await agencyDb.rpc(
        "get_gastos_financieros_por_oficina",
        { p_año: año ? parseInt(año) : null }
      );
      if (error) throw error;
      return NextResponse.json({
        success: true,
        data: data || [],
        mensaje: `Gastos financieros por oficina${año ? ` en ${año}` : ""}`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Tipo de consulta no válido" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error en gastos-financieros:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno" },
      { status: 500 }
    );
  }
}
