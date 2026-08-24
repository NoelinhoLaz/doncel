import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import { getAgencyDbClientByDomain, getDominioActualPublico } from "@/lib/agencyDb";

const COOKIE_NAME = "responsable_session";

function baseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = ((formData.get("email") as string) || "").trim().toLowerCase();
    const codigoAcceso = ((formData.get("codigo_acceso") as string) || "").trim().toUpperCase();

    if (!email || !codigoAcceso) {
      return NextResponse.redirect(
        new URL("/responsable/login?error=Debes+introducir+el+email+y+el+c%C3%B3digo+de+acceso", baseUrl(request)),
        { status: 303 }
      );
    }

    const dominio = (await getDominioActualPublico()) || request.headers.get("host")?.split(":")[0] || "";
    const agency = dominio ? await getAgencyDbClientByDomain(dominio) : null;
    if (!agency) {
      return NextResponse.redirect(
        new URL("/responsable/login?error=Error+de+configuraci%C3%B3n", baseUrl(request)),
        { status: 303 }
      );
    }
    const agencyDb = agency.db;

    const { data: expediente, error } = await agencyDb
      .from("operativa_expedientes")
      .select("id, entidad_id, contabilidad_entidades(id, nombre, email)")
      .eq("codigo_acceso", codigoAcceso)
      .maybeSingle();

    const entidad = (expediente as any)?.contabilidad_entidades;

    if (error || !expediente || !entidad || (entidad.email || "").trim().toLowerCase() !== email) {
      return NextResponse.redirect(
        new URL("/responsable/login?error=Datos+incorrectos", baseUrl(request)),
        { status: 303 }
      );
    }

    const { encryptedData, iv, authTag } = encrypt(
      JSON.stringify({
        expedienteId: expediente.id,
        entidadId: entidad.id,
        email: entidad.email,
        dominio,
      })
    );

    const response = NextResponse.redirect(new URL("/responsable/dashboard", baseUrl(request)), {
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
    console.error("[responsable/login]", err);
    return NextResponse.redirect(
      new URL("/responsable/login?error=Error+interno", baseUrl(request)),
      { status: 303 }
    );
  }
}
