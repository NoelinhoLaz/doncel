import { NextRequest, NextResponse } from "next/server";
import { getRatingLinea } from "@/actions/valoraciones";

export async function GET(request: NextRequest) {
  const lineaId = request.nextUrl.searchParams.get("linea_id");
  if (!lineaId) return NextResponse.json({ error: "linea_id required" }, { status: 400 });

  const data = await getRatingLinea(lineaId);
  return NextResponse.json(data ?? { avg: null, count: 0 });
}
