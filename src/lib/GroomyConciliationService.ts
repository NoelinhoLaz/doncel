import { getAgencyDbClient } from "@/lib/agencyDb";

interface ParamsConciliacion {
  movimientoBancoId: string; // UUID del extracto original
  entidadId: string;         // UUID del Tutor / Pagador
  expedienteId: string;      // UUID del viaje
  usuarioId: string;         // ID o texto del agente que realiza la acción
  importeImputado?: number;   // Opcional: Importe imputado
}

/**
 * Servicio de Conciliación Bancaria y Asientos de Anticipos para Groomy.
 * 
 * NOTA DE TRANSACCIONALIDAD (ACID - Todo o Nada):
 * - Se ha migrado toda la lógica de escrituras y validaciones a una función SQL nativa en PostgreSQL:
 *   'fn_ejecutar_conciliacion_groomy'.
 * - Esto garantiza que si cualquiera de las escrituras (movimiento, asiento, apuntes, extracto, balance)
 *   falla, PostgreSQL realiza un ROLLBACK total y la base de datos queda intacta (evita inconsistencias parciales).
 */
export async function ejecutarConciliacionGroomy({
  movimientoBancoId,
  entidadId,
  expedienteId,
  usuarioId,
  importeImputado
}: ParamsConciliacion) {
  const supabase = await getAgencyDbClient();

  try {
    const { data, error } = await supabase.rpc("fn_ejecutar_conciliacion_groomy", {
      p_movimiento_banco_id: movimientoBancoId,
      p_entidad_id:          entidadId,
      p_expediente_id:       expedienteId,
      p_usuario_id:          usuarioId,
      p_importe_imputado:    importeImputado ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data || !data.success) {
      throw new Error(data?.message || "Error desconocido al ejecutar la conciliación.");
    }

    return { 
      success: true, 
      movimientoId: data.movimientoId, 
      contabilizado: data.contabilizado,
      asientoId: data.asientoId
    };

  } catch (error: any) {
    console.error("[⚠️ ABORTADO - CONTABILIDAD]:", error.message);
    return { success: false, message: error.message };
  }
}
