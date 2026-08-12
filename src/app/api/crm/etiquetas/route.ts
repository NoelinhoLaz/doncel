import { NextRequest, NextResponse } from "next/server";
import { getEtiquetas, crearEtiqueta } from "@/actions/etiquetas";

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") as "agente" | "sucursal" | "agencia" | null;
    const data = await getEtiquetas(scope ?? "agencia");
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.nombre?.trim()) {
      return NextResponse.json({ success: false, error: "El nombre es obligatorio" }, { status: 400 });
    }
    const data = await crearEtiqueta({ nombre: body.nombre, color: body.color });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
