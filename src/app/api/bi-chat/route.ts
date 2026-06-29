import { NextRequest, NextResponse } from "next/server";
import { runBiChat } from "@/actions/bi-chat";

export async function POST(req: NextRequest) {
  try {
    const { history, campanaId } = await req.json();

    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ success: false, error: "history requerido" }, { status: 400 });
    }

    const response = await runBiChat(history, campanaId);
    return NextResponse.json({ success: true, ...response, _debug: (response as any)._sql });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
