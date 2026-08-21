import { NextRequest, NextResponse } from "next/server";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { signToken } from "@/lib/encryption";

const AGENCY_CTX_COOKIE = "agency_ctx";
const AGENCY_CTX_MAX_AGE = 8 * 60 * 60; // 8 horas

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "No autorizado (Falta token)" }, { status: 401 });
    }

    const adminServiceSupabase = createAdminServiceClient();
    const { data: { user }, error: authError } = await adminServiceSupabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado (Token inválido)" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const authUserId = searchParams.get("authUserId");

    if (!authUserId) {
      return NextResponse.json({ error: "Missing authUserId" }, { status: 400 });
    }

    if (authUserId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("id, nombre, apellidos, email, rol, agencia_id")
      .eq("auth_user_id", authUserId)
      .single();

    if (usuarioError || !usuario) {
      console.error("Error al obtener perfil por authUserId en API:", usuarioError);
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    const response = NextResponse.json({ usuario });

    if (usuario.agencia_id) {
      const { data: agencia } = await adminServiceSupabase
        .from("agencias")
        .select("schema_name")
        .eq("id", usuario.agencia_id)
        .single();

      const schemaName = (agencia?.schema_name as string | null) || "public";
      const agencyCtxToken = signToken(JSON.stringify({ v: 1, authUserId, agenciaId: usuario.agencia_id, schemaName }));

      response.cookies.set(AGENCY_CTX_COOKIE, agencyCtxToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: AGENCY_CTX_MAX_AGE,
      });
    }

    return response;
  } catch (error: any) {
    console.error("Error in GET /api/perfil:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
