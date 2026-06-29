import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Asegura que un ejercicio fiscal exista en el estado 'abierto'.
 * Si no existe en la base de datos, lo crea automáticamente.
 * Si existe pero está cerrado/bloqueado, lanza un error contable para abortar la transacción.
 */
export async function asegurarEjercicioYValidar(ejercicio: number, agencyDb: SupabaseClient): Promise<void> {
  const { data: ex, error: fetchErr } = await agencyDb
    .from("contabilidad_ejercicios")
    .select("estado")
    .eq("ejercicio", ejercicio)
    .maybeSingle();

  if (fetchErr) {
    console.error(`Error al comprobar ejercicio contable ${ejercicio}:`, fetchErr);
    throw new Error(`Error al validar el ejercicio contable ${ejercicio}: ${fetchErr.message}`);
  }

  if (!ex) {
    // Si no existe, lo creamos automáticamente con estado 'abierto'
    const { error: insertErr } = await agencyDb
      .from("contabilidad_ejercicios")
      .insert([{
        ejercicio,
        nombre: `Ejercicio ${ejercicio}`,
        fecha_inicio: `${ejercicio}-01-01`,
        fecha_fin: `${ejercicio}-12-31`,
        estado: "abierto"
      }]);

    if (insertErr) {
      console.error(`Error al crear automáticamente el ejercicio contable ${ejercicio}:`, insertErr);
      throw new Error(`No se pudo crear automáticamente el ejercicio contable ${ejercicio}: ${insertErr.message}`);
    }
  } else if (ex.estado !== "abierto") {
    // Si existe pero está cerrado o bloqueado, impedimos el registro
    throw new Error(`El ejercicio contable ${ejercicio} está ${ex.estado.toUpperCase()}. No se permite registrar nuevos asientos.`);
  }
}
