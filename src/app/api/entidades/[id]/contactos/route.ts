import { NextRequest, NextResponse } from "next/server";
import { getContactosEntidad, vincularContactoEntidad, desvincularContactoEntidad } from "@/actions/crm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getContactosEntidad(id);
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
    if (!body.contacto_id) {
      return NextResponse.json({ success: false, error: "contacto_id es obligatorio" }, { status: 400 });
    }
    await vincularContactoEntidad(body.contacto_id, id);
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
    const contactoId = searchParams.get("contacto_id");
    if (!contactoId) {
      return NextResponse.json({ success: false, error: "contacto_id es obligatorio" }, { status: 400 });
    }
    await desvincularContactoEntidad(contactoId, id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
