import { NextResponse } from "next/server";
import { getTiposCliente } from "@/actions/tiposCliente";

export async function GET() {
  try {
    const data = await getTiposCliente();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
