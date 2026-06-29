import { NextResponse } from "next/server";
import { getDestinos } from "@/actions/destinos";

export async function GET() {
  try {
    const data = await getDestinos();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
