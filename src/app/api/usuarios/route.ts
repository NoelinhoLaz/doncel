import { NextResponse } from "next/server";
import { getAgencyUsuarios } from "@/actions/usuarios";

export async function GET() {
  try {
    const data = await getAgencyUsuarios();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
