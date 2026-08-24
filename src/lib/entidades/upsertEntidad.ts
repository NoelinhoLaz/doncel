import type { SupabaseClient } from "@supabase/supabase-js";

// Columnas reales de contabilidad_entidades:
//   nombre, documento, documento_caducidad, email, telefono, direccion, roles, metadatos
// fecha_nacimiento, sexo, pasaporte, pasaporte_caducidad, numero_soporte → van en metadatos (JSONB)
export async function upsertEntidad(
  agencyDb: SupabaseClient<any, any, any>,
  datos: {
    nombre: string;
    documento: string;
    documento_caducidad?: string | null;
    email?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    lat?: number | null;
    lng?: number | null;
    metadatos?: Record<string, any>;
    rolNuevo: string;
  }
): Promise<string | null> {
  const doc = datos.documento.trim().toUpperCase();
  const { data: existing } = await agencyDb
    .from("contabilidad_entidades")
    .select("id, roles, metadatos")
    .eq("documento", doc)
    .maybeSingle();

  if (existing) {
    const rolesActualizados = { ...(existing.roles || {}), [datos.rolNuevo]: true };
    const metadatosActualizados = { ...(existing.metadatos || {}), ...(datos.metadatos || {}) };
    await agencyDb
      .from("contabilidad_entidades")
      .update({
        roles: rolesActualizados,
        metadatos: metadatosActualizados,
        ...(datos.documento_caducidad && { documento_caducidad: datos.documento_caducidad }),
        ...(datos.email && { email: datos.email }),
        ...(datos.telefono && { telefono: datos.telefono }),
        ...(datos.direccion && { direccion: { direccion: datos.direccion } }),
        ...(datos.lat != null && { lat: datos.lat }),
        ...(datos.lng != null && { lng: datos.lng }),
      })
      .eq("id", existing.id);
    return existing.id;
  } else {
    const { data: newEnt, error } = await agencyDb
      .from("contabilidad_entidades")
      .insert({
        nombre: datos.nombre.trim(),
        documento: doc,
        documento_caducidad: datos.documento_caducidad || null,
        email: datos.email || null,
        telefono: datos.telefono || null,
        direccion: datos.direccion ? { direccion: datos.direccion } : null,
        lat: datos.lat ?? null,
        lng: datos.lng ?? null,
        roles: { [datos.rolNuevo]: true },
        metadatos: datos.metadatos || {},
      })
      .select("id")
      .single();
    if (error) {
      console.error("[upsertEntidad] Error creando entidad:", error.message);
      return null;
    }
    return newEnt?.id ?? null;
  }
}
