"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { descargarMovimientosOfiviajeParaAgencia } from "@/lib/banco/ofiviajeMovimientos";
import { getDriveTokensUsuarioActual } from "@/lib/banco/ofiviajeDrive";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

/**
 * Acción para reimportar movimientos OFI de Drive.
 * Limpia primero los datos del archivo especificado antes de reimportar.
 */
export async function reimportarMovimientosOfiviaje(
  nombreArchivo: string
): Promise<{ success: boolean; mensaje: string; pagos?: number; cobros?: number }> {
  try {
    // Obtener usuario actual
    const adminSupabase = await createAdminServerClient();
    const { data: { user } } = await adminSupabase.auth.getUser();
    if (!user) {
      throw new Error("No hay usuario autenticado");
    }

    const agencyDb = await getAgencyDbClient();

    // Obtener oficina del usuario
    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario } = await adminServiceSupabase
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    const { data: config } = await agencyDb
      .from("config_usuarios")
      .select("oficina")
      .eq("usuario_id", usuario.id)
      .single();

    const { data: oficinas } = await agencyDb
      .from("config_oficinas")
      .select("id")
      .limit(1);

    const oficinaId = config?.oficina || oficinas?.[0]?.id;
    if (!oficinaId) {
      throw new Error("No se encontró oficina configurada");
    }

    // Limpiar registros del archivo de ofi_pagos y ofi_cobros
    console.log(`Limpiando registros del archivo: ${nombreArchivo}`);

    const { error: cleanPagosError } = await agencyDb
      .from("ofi_pagos")
      .delete()
      .eq("drive_file_nombre", nombreArchivo);

    const { error: cleanCobrosError } = await agencyDb
      .from("ofi_cobros")
      .delete()
      .eq("drive_file_nombre", nombreArchivo);

    if (cleanPagosError || cleanCobrosError) {
      console.error("Error limpiando datos:", cleanPagosError || cleanCobrosError);
    }

    // Obtener tokens de Drive
    const tokens = await getDriveTokensUsuarioActual();

    // Reimportar
    console.log("Reimportando desde Drive...");
    const resultado = await descargarMovimientosOfiviajeParaAgencia(agencyDb, tokens, oficinaId);

    return {
      success: true,
      mensaje: `✓ Reimportación completada: ${resultado.pagosInsertados} pagos, ${resultado.cobrosInsertados} cobros`,
      pagos: resultado.pagosInsertados,
      cobros: resultado.cobrosInsertados,
    };
  } catch (error: any) {
    console.error("Error en reimportarMovimientosOfiviaje:", error);
    return {
      success: false,
      mensaje: `Error: ${error?.message || "Error desconocido"}`,
    };
  }
}

/**
 * Acción para verificar cuántos apuntes faltan en la BD.
 */
export async function verificarApuntesOFI(
  apuntes: string[]
): Promise<{ encontrados: string[]; faltantes: string[] }> {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: existentes } = await agencyDb
      .from("ofi_pagos")
      .select("apunte")
      .in("apunte", apuntes);

    const encontrados = (existentes || []).map((r: any) => r.apunte);
    const faltantes = apuntes.filter((a) => !encontrados.includes(a));

    return { encontrados, faltantes };
  } catch (error: any) {
    return { encontrados: [], faltantes: apuntes };
  }
}
