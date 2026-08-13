import { NextResponse } from "next/server";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

// Identidad del agente logueado, incluyendo el auth_user_id (usado como
// operativa_cotizaciones.agente_id) y el rol, para checks de permisos en cliente.
export async function GET() {
  try {
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error } = await adminSupabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario } = await adminServiceSupabase
      .from("usuarios")
      .select("id, nombre, apellidos, rol")
      .eq("auth_user_id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        authUserId: user.id,
        usuarioId: usuario?.id ?? null,
        nombre: usuario?.nombre ?? null,
        apellidos: usuario?.apellidos ?? null,
        rol: usuario?.rol ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
