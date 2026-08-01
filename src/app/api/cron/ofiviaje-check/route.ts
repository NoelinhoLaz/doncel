import { NextRequest, NextResponse } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClientById } from "@/lib/agencyDb";
import { descargarMovimientosOfiviajeParaAgencia, conciliarDesdeOfiPagosParaAgencia } from "@/lib/banco/ofiviajeMovimientos";
import type { DriveTokens } from "@/lib/banco/ofiviajeDrive";

// Recorre todos los usuarios con Google Drive conectado y carpeta seleccionada:
// descarga los XML nuevos de OFIviaje a ofi_pagos/ofi_cobros y concilia contra
// contabilidad_movimientos_banco. Pensado para ejecutarse periódicamente (Vercel Cron).
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

      const { data: config } = await agencyDb
        .from("config_usuarios")
        .select("oficina")
        .eq("usuario_id", usuario.id)
        .single();
      let oficinaId = config?.oficina;
      if (!oficinaId) {
        const { data: oficinas } = await agencyDb.from("config_oficinas").select("id").limit(1);
        oficinaId = oficinas?.[0]?.id;
      }
      if (!oficinaId) {
        resultados.push({ agencia_id: usuario.agencia_id, usuario_id: usuario.id, error: "No hay oficina configurada." });
        continue;
      }

      const descarga = await descargarMovimientosOfiviajeParaAgencia(agencyDb, tokens, oficinaId);
      const conciliacion = await conciliarDesdeOfiPagosParaAgencia(agencyDb);

      resultados.push({ agencia_id: usuario.agencia_id, usuario_id: usuario.id, ...descarga, ...conciliacion });
    } catch (err: any) {
      resultados.push({ agencia_id: usuario.agencia_id, usuario_id: usuario.id, error: err.message });
    }
  }

  return NextResponse.json({ procesados: resultados.length, resultados });
}
