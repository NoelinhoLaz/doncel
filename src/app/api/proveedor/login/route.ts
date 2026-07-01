import { NextRequest, NextResponse } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { encrypt } from "@/lib/encryption";

const COOKIE_NAME = "proveedor_session";

function baseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = ((formData.get("email") as string) || "").trim().toLowerCase();
    const cifNif = ((formData.get("cif_nif") as string) || "").trim().toUpperCase();

    if (!email || !cifNif) {
      return NextResponse.redirect(
        new URL(`/proveedor/login?error=${encodeURIComponent("Introduce el email y el CIF/NIF")}`, baseUrl(request)),
        { status: 303 },
      );
    }

    const adminService = createAdminServiceClient();
    const { data: usuario, error } = await (adminService
      .from("usuarios")
      .select("id, nombre, email, cif_nif, rol")
      .eq("email", email)
      .eq("cif_nif", cifNif)
      .eq("rol", "Proveedor")
      .maybeSingle() as any);

    console.log("[proveedor/login] usuario:", usuario, error);

    if (error || !usuario) {
      return NextResponse.redirect(
        new URL(`/proveedor/login?error=${encodeURIComponent("Datos incorrectos o usuario no autorizado")}`, baseUrl(request)),
        { status: 303 },
      );
    }

    const { encryptedData, iv, authTag } = encrypt(
      JSON.stringify({
        userId: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        cifNif: usuario.cif_nif,
      }),
    );

    const response = NextResponse.redirect(new URL("/proveedor/dashboard", baseUrl(request)), {
      status: 303,
    });

    response.cookies.set(COOKIE_NAME, JSON.stringify({ d: encryptedData, iv, t: authTag }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err: any) {
    console.error("[proveedor/login]", err);
    return NextResponse.redirect(
      new URL(`/proveedor/login?error=${encodeURIComponent("Error interno")}`, baseUrl(request)),
      { status: 303 },
    );
  }
}
