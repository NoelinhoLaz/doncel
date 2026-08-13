import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

// El importador legacy escribió operativa_cotizaciones.destinos (jsonb array de
// {id, nombre}) usando ids/nombres del sistema antiguo, sin relación real con
// maestro_destinos. Esto generó variantes de texto para el mismo lugar
// (MADRID / Madrid / Comunidad de Madrid) sin un id de maestro_destinos válido.
//
// Este script:
// 1. Recorre todas las cotizaciones y extrae los nombres únicos usados en `destinos`.
// 2. Agrupa por nombre normalizado (minúsculas, sin tildes, espacios colapsados).
// 3. Para cada grupo, busca en maestro_destinos una fila cuyo nombre_comercial
//    coincida (ilike) con la variante más frecuente del grupo. Si no existe ninguna
//    fila real, el grupo se deja sin tocar (no se crean destinos nuevos).
// 4. Reescribe destinos de cada cotización con el id/nombre reales de maestro_destinos
//    solo para los grupos con fila existente, deduplicando si dos entradas del array
//    quedan apuntando al mismo id tras el remapeo.
//
// No toca ids que YA apuntan a una fila existente y válida de maestro_destinos,
// ni crea filas nuevas en maestro_destinos para grupos sin coincidencia.
function normalizar(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

export async function GET(req: Request) {
  const dryRun = new URL(req.url).searchParams.get("dryRun") !== "false";

  try {
    const db = await getAgencyDbClient();

    const { data: cotizaciones, error: eCot } = await db
      .from("operativa_cotizaciones")
      .select("id, titulo, destinos")
      .not("destinos", "is", null);
    if (eCot) throw eCot;

    const conDestinos = (cotizaciones ?? []).filter((c: any) => Array.isArray(c.destinos) && c.destinos.length > 0);

    // ids de maestro_destinos ya referenciados, para saber cuáles son válidos
    const idsReferenciados = new Set<string>();
    conDestinos.forEach((c: any) => c.destinos.forEach((d: any) => { if (d?.id) idsReferenciados.add(d.id); }));

    const { data: maestrosExistentes } = await db
      .from("maestro_destinos")
      .select("id, nombre, nombre_comercial")
      .in("id", Array.from(idsReferenciados));
    const idsValidos = new Set((maestrosExistentes ?? []).map((m: any) => m.id));

    // Agrupar por nombre normalizado, contando frecuencia de cada variante de texto,
    // solo entre las entradas cuyo id NO es válido (huérfanas)
    const countByVariant = new Map<string, number>();
    const keyByVariant = new Map<string, string>();
    conDestinos.forEach((c: any) => {
      c.destinos.forEach((d: any) => {
        if (!d?.nombre || idsValidos.has(d.id)) return;
        const key = normalizar(d.nombre);
        countByVariant.set(d.nombre, (countByVariant.get(d.nombre) ?? 0) + 1);
        keyByVariant.set(d.nombre, key);
      });
    });

    const variantsByKey = new Map<string, string[]>();
    countByVariant.forEach((_, variant) => {
      const key = keyByVariant.get(variant)!;
      const arr = variantsByKey.get(key) ?? [];
      arr.push(variant);
      variantsByKey.set(key, arr);
    });

    // Para cada grupo, elegir la variante más frecuente como nombre canónico,
    // y resolver/crear su fila en maestro_destinos
    const resolucion: { grupo: string; nombreCanonico: string; variantes: string[]; maestroId: string; creado: boolean }[] = [];
    const maestroIdPorNombreCanonico = new Map<string, string | null>();

    for (const [key, variants] of variantsByKey) {
      const nombreCanonico = variants.sort((a, b) => (countByVariant.get(b)! - countByVariant.get(a)!) || a.localeCompare(b))[0];

      // Buscar si ya existe un maestro_destinos con ese nombre (case-insensitive)
      const { data: existente } = await db
        .from("maestro_destinos")
        .select("id, nombre_comercial")
        .ilike("nombre_comercial", nombreCanonico)
        .limit(1);

      let maestroId: string | null;
      const creado = false;
      if (existente && existente.length > 0) {
        maestroId = existente[0].id;
      } else {
        // No existe fila real en maestro_destinos: no se crea nada, se deja como está.
        maestroId = null;
      }

      maestroIdPorNombreCanonico.set(key, maestroId);
      resolucion.push({ grupo: key, nombreCanonico, variantes: variants, maestroId: maestroId ?? "(sin fila real, no se toca)", creado });
    }

    // Reescribir el jsonb `destinos` de cada cotización afectada
    let cotizacionesActualizadas = 0;
    const detalle: { cotizacion_id: string; titulo: string; antes: any[]; despues: any[] }[] = [];

    for (const c of conDestinos) {
      let cambiado = false;
      const nuevosDestinos = (c.destinos as any[]).map((d: any) => {
        if (!d?.nombre || idsValidos.has(d.id)) return d; // ya válido, no tocar
        const key = normalizar(d.nombre);
        const maestroId = maestroIdPorNombreCanonico.get(key);
        if (!maestroId) return d; // sin fila real en maestro_destinos, se deja como está
        cambiado = true;
        const nombreCanonico = resolucion.find(r => r.grupo === key)!.nombreCanonico;
        return { id: maestroId, nombre: nombreCanonico };
      }).filter((d: any, i: number, arr: any[]) => arr.findIndex(x => x.id === d.id) === i); // deduplicar

      if (cambiado) {
        cotizacionesActualizadas++;
        detalle.push({ cotizacion_id: c.id, titulo: c.titulo, antes: c.destinos, despues: nuevosDestinos });
        if (!dryRun) {
          const { error } = await db.from("operativa_cotizaciones").update({ destinos: nuevosDestinos }).eq("id", c.id);
          if (error) throw error;
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      resumen: {
        grupos_detectados: resolucion.length,
        cotizaciones_afectadas: cotizacionesActualizadas,
      },
      resolucion,
      detalle,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
