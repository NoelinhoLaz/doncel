import { NextRequest, NextResponse } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/encryption";

const COOKIE_NAME = "portal_session";

function baseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = (formData.get("email") as string || "").trim().toLowerCase();
    const dni = (formData.get("dni") as string || "").trim().toUpperCase();

    if (!email || !dni) {
      return NextResponse.redirect(
        new URL("/portal/login?error=Debes+introducir+el+email+y+el+DNI%2FNIF", baseUrl(request)),
        { status: 303 }
      );
    }

    const adminService = createAdminServiceClient();
    const agencias = (await adminService
      .from("agencias")
      .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag")
      .limit(5)) as unknown as { data: any[] | null; error: any };

    if (agencias.error || !agencias.data?.length) {
      return NextResponse.redirect(
        new URL("/portal/login?error=Error+de+configuraci%C3%B3n", baseUrl(request)),
        { status: 303 }
      );
    }

    const agencia = agencias.data.find(
      (a: any) => a.supabase_service_role_key_enc && a.iv && a.auth_tag,
    );
    if (!agencia) {
      return NextResponse.redirect(
        new URL("/portal/login?error=Error+de+configuraci%C3%B3n", baseUrl(request)),
        { status: 303 }
      );
    }

    const serviceRoleKey = decrypt(
      agencia.supabase_service_role_key_enc,
      agencia.iv,
      agencia.auth_tag,
    );

    const agencyDb = createClient(agencia.supabase_url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: entities, error: entityError } = await agencyDb
      .from("contabilidad_entidades")
      .select("id, nombre, email")
      .eq("email", email)
      .eq("documento", dni)
      .limit(1);

    if (entityError || !entities || entities.length === 0) {
      return NextResponse.redirect(
        new URL("/portal/login?error=Datos+incorrectos", baseUrl(request)),
        { status: 303 }
      );
    }

    const entity = entities[0];
    const { encryptedData, iv, authTag } = encrypt(
      JSON.stringify({ entityId: entity.id, entityName: entity.nombre, email: entity.email }),
    );

    const response = NextResponse.redirect(new URL("/portal/dashboard", baseUrl(request)), {
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
    console.error("[portal/login]", err);
    return NextResponse.redirect(
      new URL("/portal/login?error=Error+interno", baseUrl(request)),
      { status: 303 }
    );
  }
}
