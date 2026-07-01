import { NextRequest, NextResponse } from "next/server";
import { clearProveedorSession } from "@/actions/proveedor";

function baseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  await clearProveedorSession();
  return NextResponse.redirect(new URL("/proveedor/login", baseUrl(request)), {
    status: 303,
  });
}
