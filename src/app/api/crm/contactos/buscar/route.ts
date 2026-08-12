import { NextRequest, NextResponse } from "next/server";
import { buscarContactosGlobal } from "@/actions/crm";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 3) return NextResponse.json({ success: true, data: [] });
    const data = await buscarContactosGlobal(q);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
