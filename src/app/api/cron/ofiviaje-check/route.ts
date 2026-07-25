import { NextRequest, NextResponse } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClientById } from "@/lib/agencyDb";
import { comprobarOfiviajeParaAgencia } from "@/lib/banco/ofiviajeMatch";
import type { DriveTokens } from "@/lib/banco/ofiviajeDrive";

// Recorre todos los usuarios con Google Drive conectado y carpeta seleccionada,
// agrupados por agencia, y comprueba en cada una si hay ficheros XML nuevos de
// OFIviaje que conciliar. Pensado para ejecutarse periódicamente (Vercel Cron).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const adminDb = createAdminServiceClient();

  const { data: usuarios, error } = await adminDb
    .from("usuarios")
    .select("id, agencia_id, drive_access_token, drive_refresh_token, drive_token_expiry, metadata")
    .not("agencia_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resultados: any[] = [];

  for (const usuario of usuarios || []) {
    const driveConfig = usuario.metadata?.drive_config;
    const tokens: DriveTokens = {
      drive_access_token: usuario.drive_access_token || driveConfig?.drive_access_token || null,
      drive_refresh_token: usuario.drive_refresh_token || driveConfig?.drive_refresh_token || null,
      drive_token_expiry: usuario.drive_token_expiry || driveConfig?.drive_token_expiry || null,
      drive_folder: driveConfig?.drive_folder || null,
    };

    if (!tokens.drive_access_token || !tokens.drive_folder?.id) continue;

    try {
      const agencyDb = await getAgencyDbClientById(usuario.agencia_id);
      const result = await comprobarOfiviajeParaAgencia(agencyDb, tokens);
      resultados.push({ agencia_id: usuario.agencia_id, usuario_id: usuario.id, ...result });
    } catch (err: any) {
      resultados.push({ agencia_id: usuario.agencia_id, usuario_id: usuario.id, error: err.message });
    }
  }

  return NextResponse.json({ procesados: resultados.length, resultados });
}
