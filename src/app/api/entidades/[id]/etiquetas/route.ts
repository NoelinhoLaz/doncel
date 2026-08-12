import { NextRequest, NextResponse } from "next/server";
import { getEtiquetasEntidad, asignarEtiqueta, quitarEtiqueta } from "@/actions/etiquetas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getEtiquetasEntidad(id);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.etiqueta_id) {
      return NextResponse.json({ success: false, error: "etiqueta_id es obligatorio" }, { status: 400 });
    }
    await asignarEtiqueta(id, body.etiqueta_id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const etiquetaId = searchParams.get("etiqueta_id");
    if (!etiquetaId) {
      return NextResponse.json({ success: false, error: "etiqueta_id es obligatorio" }, { status: 400 });
    }
    await quitarEtiqueta(id, etiquetaId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
