import { NextRequest, NextResponse } from "next/server";
import { markEmailAbierto } from "@/actions/comunicaciones";
import { markDifusionEmailAbierto } from "@/actions/difusiones";

// GIF transparente 1x1
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (token && /^[0-9a-f-]{36}$/.test(token)) {
    // Fire-and-forget: registra apertura para difusiones y comunicaciones
    markDifusionEmailAbierto(token).catch(() => {});
    markEmailAbierto(token).catch(() => {});
  }

  return new NextResponse(TRACKING_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
