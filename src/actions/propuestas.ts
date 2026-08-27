"use server";

import { getAgencyDbClient, getAgencyDbClientByDomain } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { slugify, slugUnicoEnTabla } from "@/lib/utils/slug";

const ROLES_ADMIN = ["Admin", "SuperAdmin", "Owner"];

// Verifica que el usuario autenticado puede eliminar/editar la propuesta indicada:
// es su agente_id, la propuesta no tiene agente_id (legado), o tiene rol admin.
// Lanza si no autenticado o si otro agente intenta actuar sobre ella.
async function assertPuedeEditarPropuesta(agencyDb: any, propuestaId: string) {
  const adminSupabase = await createAdminServerClient();
  const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
  if (userError || !user) throw new Error("No autenticado");

  const { data: prop } = await agencyDb
    .from("operativa_propuestas")
    .select("agente_id")
    .eq("id", propuestaId)
    .single();

  if (!prop?.agente_id || prop.agente_id === user.id) return;

  const adminServiceSupabase = createAdminServiceClient();
  const { data: usuario } = await adminServiceSupabase
    .from("usuarios")
    .select("rol")
    .eq("auth_user_id", user.id)
    .single();

  if (usuario?.rol && ROLES_ADMIN.includes(usuario.rol)) return;

  throw new Error("No tienes permiso para eliminar esta propuesta");
}

export async function getPropuestas() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .select(`
        id, title, destination, destinos, fecha_salida, fecha_regreso, created_at, contacto_id, cotizacion_id, agente_id,
        contabilidad_entidades!contacto_id(id, nombre),
        landings(id, is_active, version_number, design_tokens, editor_content)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const cotizacionIds = Array.from(new Set((data ?? []).filter((p: any) => !p.agente_id).map((p: any) => p.cotizacion_id).filter(Boolean)));
    const agenteIdByCotizacion = new Map<string, string>();
    if (cotizacionIds.length > 0) {
      const { data: cots } = await agencyDb
        .from("operativa_cotizaciones")
        .select("id, agente_id")
        .in("id", cotizacionIds);
      (cots ?? []).forEach((c: any) => {
        if (c.agente_id) agenteIdByCotizacion.set(c.id, c.agente_id);
      });
    }

    let adminUsers: any[] = [];
    try {
      const adminServiceSupabase = createAdminServiceClient();
      const { data: users } = await adminServiceSupabase
        .from("usuarios")
        .select("id, auth_user_id, nombre, apellidos, avatar_url");
      adminUsers = users || [];
    } catch (dbErr) {
      console.warn("Could not load users for agent avatars:", dbErr);
    }

    return (data ?? []).map((p: any) => {
      const agenteId = p.agente_id || agenteIdByCotizacion.get(p.cotizacion_id);
      const user = adminUsers.find((u: any) => u.id === agenteId || u.auth_user_id === agenteId);
      const agente = user
        ? {
            id: user.id,
            auth_user_id: user.auth_user_id,
            nombre: `${user.nombre ?? ""} ${user.apellidos ?? ""}`.trim(),
            iniciales: ((user.nombre?.charAt(0) ?? "") + (user.apellidos?.charAt(0) ?? "")).toUpperCase() || "NC",
            avatar_url: user.avatar_url ?? null,
          }
        : null;

      return {
        ...p,
        landing: Array.isArray(p.landings)
          ? (p.landings.find((l: any) => l.is_active) ?? p.landings[0] ?? null)
          : null,
        landings: undefined,
        agente,
      };
    });
  } catch (e: any) {
    console.error("getPropuestas error:", e?.message, e?.stack?.split('\n')[1]);
    return { error: e?.message ?? "Error desconocido", data: [] };
  }
}

export async function duplicarPropuesta(id: string, vincularCotizacion: boolean = true) {
  try {
    const agencyDb = await getAgencyDbClient();
    let user = null;
    try {
      const adminSupabase = await createAdminServerClient();
      const { data: { user: u } } = await adminSupabase.auth.getUser();
      user = u;
    } catch {}

    const { data: prop, error: e1 } = await agencyDb
      .from("operativa_propuestas")
      .select("title, cotizacion_id, contacto_id, agente_id")
      .eq("id", id)
      .single();
    if (e1 || !prop) throw e1;

    const { data: landing, error: e2 } = await agencyDb
      .from("landings")
      .select("editor_content, design_tokens")
      .eq("proposal_id", id)
      .eq("is_active", true)
      .single();
    if (e2 || !landing) throw e2;

    let newCotizacionId: string | null = null;
    if (vincularCotizacion && prop.cotizacion_id) {
      const { duplicateCotizacion } = await import("@/actions/cotizaciones");
      const result = await duplicateCotizacion(prop.cotizacion_id, false);
      if (result.success && result.data) {
        newCotizacionId = result.data.id;
      } else {
        throw new Error(
          `No se pudo duplicar la cotización vinculada: ${result.error || "error desconocido"}`
        );
      }
    }

    const agenteId = user?.id || prop.agente_id || null;

    const { data: newProp, error: e3 } = await agencyDb
      .from("operativa_propuestas")
      .insert({
        title: `${prop.title} (copia)`,
        cotizacion_id: vincularCotizacion ? (newCotizacionId ?? prop.cotizacion_id ?? null) : null,
        contacto_id: prop.contacto_id || null,
        agente_id: agenteId,
        proposal_data: {},
      })
      .select("id")
      .single();
    if (e3 || !newProp) throw e3;

    const { error: e4 } = await agencyDb
      .from("landings")
      .insert({ proposal_id: newProp.id, editor_content: landing.editor_content, design_tokens: landing.design_tokens, is_active: true, version_number: 1 });
    if (e4) throw e4;

    revalidatePath("/propuestas");
    return { ok: true, id: newProp.id };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

/**
 * Crea una propuesta nueva pre-cargada con el contacto, fechas y destino de una
 * cotización, y la vincula a ella. Uso: botón "Crear nueva propuesta" desde una
 * cotización sin expediente (donde createNewPropuestaLinked no aplica).
 */
export async function linkCotizacionToPropuesta(cotizacionId: string, propuestaId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_propuestas")
      .update({ cotizacion_id: cotizacionId })
      .eq("id", propuestaId);
    revalidatePath("/propuestas");
    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Desvincula una propuesta de su cotización (cotizacion_id = NULL). La propuesta
 * y la cotización siguen existiendo independientemente; solo se rompe el vínculo.
 */
export async function unlinkCotizacionFromPropuesta(propuestaId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_propuestas")
      .update({ cotizacion_id: null, quote_id: null })
      .eq("id", propuestaId);
    revalidatePath("/propuestas");
    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Actualiza metadatos de cabecera de una propuesta (título, contacto, destino y fechas),
 * análogo a updateCotizacionMeta en src/actions/cotizaciones.ts.
 */
export async function updatePropuestaMeta(propuestaId: string, payload: {
  title?: string;
  destination?: string | null;
  contacto_id?: string | null;
  fecha_salida?: string | null;
  fecha_regreso?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_propuestas")
      .update(payload)
      .eq("id", propuestaId);
    if (error) throw error;
    revalidatePath("/propuestas");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Actualiza el slug público de una propuesta. Normaliza el texto recibido con
 * slugify y garantiza unicidad en operativa_propuestas (excluyendo la propia fila),
 * añadiendo un sufijo numérico si hace falta. Si se pasa vacío/null, libera el slug.
 */
export async function updatePropuestaSlug(propuestaId: string, slugDeseado: string | null) {
  try {
    const agencyDb = await getAgencyDbClient();

    if (!slugDeseado || !slugDeseado.trim()) {
      const { error } = await agencyDb.from("operativa_propuestas").update({ slug: null }).eq("id", propuestaId);
      if (error) throw error;
      revalidatePath("/propuestas");
      return { success: true, slug: null };
    }

    const base = slugify(slugDeseado);
    const slugFinal = await slugUnicoEnTabla(agencyDb, "operativa_propuestas", base, propuestaId);

    const { error } = await agencyDb.from("operativa_propuestas").update({ slug: slugFinal }).eq("id", propuestaId);
    if (error) throw error;
    revalidatePath("/propuestas");
    return { success: true, slug: slugFinal };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Añade un destino a una propuesta. Mismo patrón que addDestinoCotizacion en cotizaciones.ts. */
export async function addDestinoPropuesta(propuestaId: string, destino: { id: string; nombre: string }) {
  try {
    const agencyDb = await getAgencyDbClient();
    await assertPuedeEditarPropuesta(agencyDb, propuestaId);
    const { data: current, error: fetchError } = await agencyDb
      .from("operativa_propuestas")
      .select("destinos")
      .eq("id", propuestaId)
      .single();
    if (fetchError) throw fetchError;

    const existing: any[] = current?.destinos || [];
    if (existing.some((d: any) => d.id === destino.id)) return { success: true, destinos: existing };

    const updated = [...existing, destino];
    const { error } = await agencyDb
      .from("operativa_propuestas")
      .update({ destinos: updated })
      .eq("id", propuestaId);
    if (error) throw error;

    revalidatePath("/propuestas");
    return { success: true, destinos: updated };
  } catch (error: any) {
    console.error("Failed to add destino to propuesta:", error.message);
    throw new Error(error.message);
  }
}

/** Elimina un destino de una propuesta. Mismo patrón que removeDestinoCotizacion en cotizaciones.ts. */
export async function removeDestinoPropuesta(propuestaId: string, destinoId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    await assertPuedeEditarPropuesta(agencyDb, propuestaId);
    const { data: current, error: fetchError } = await agencyDb
      .from("operativa_propuestas")
      .select("destinos")
      .eq("id", propuestaId)
      .single();
    if (fetchError) throw fetchError;

    const updated = (current?.destinos || []).filter((d: any) => d.id !== destinoId);
    const { error } = await agencyDb
      .from("operativa_propuestas")
      .update({ destinos: updated })
      .eq("id", propuestaId);
    if (error) throw error;

    revalidatePath("/propuestas");
    return { success: true, destinos: updated };
  } catch (error: any) {
    console.error("Failed to remove destino from propuesta:", error.message);
    throw new Error(error.message);
  }
}

function diffDias(desde: string, hasta: string): number {
  const start = new Date(desde);
  const end = new Date(hasta);
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

function ajustarSeccionesItinerario(secciones: any[], fechaSalida: string, fechaRegreso: string): any[] {
  const diasNuevos = diffDias(fechaSalida, fechaRegreso);
  return secciones.map(s => {
    if (s.tipo !== "itinerario" || !s.fechaDesde || !s.fechaHasta) return s;
    const diasExistentes = (s.dias ?? []).filter((d: any) => d.dia <= diasNuevos);
    const diasFaltantes = Array.from({ length: Math.max(0, diasNuevos - diasExistentes.length) }, (_, i) => ({
      dia: diasExistentes.length + i + 1,
    }));
    return {
      ...s,
      fechaDesde: fechaSalida,
      fechaHasta: fechaRegreso,
      dias: [...diasExistentes, ...diasFaltantes],
    };
  });
}

/**
 * Comprueba si vincular `propuestaId` a `cotizacionId` produciría un
 * desajuste entre la duración del itinerario de la propuesta y las fechas
 * (fecha_salida/fecha_regreso) de la cotización. No modifica nada.
 */
export async function checkAjusteFechasCotizacion(propuestaId: string, cotizacionId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: cot, error: cotErr } = await agencyDb
      .from("operativa_cotizaciones")
      .select("fecha_salida, fecha_regreso")
      .eq("id", cotizacionId)
      .single();
    if (cotErr) throw cotErr;
    if (!cot?.fecha_salida || !cot?.fecha_regreso) {
      return { requiereAjuste: false };
    }

    const { data: landing, error: landingErr } = await agencyDb
      .from("landings")
      .select("editor_content")
      .eq("proposal_id", propuestaId)
      .eq("is_active", true)
      .maybeSingle();
    if (landingErr) throw landingErr;

    const secciones: any[] = landing?.editor_content ?? [];
    const itinerario = secciones.find(s => s.tipo === "itinerario" && s.fechaDesde && s.fechaHasta);
    if (!itinerario) return { requiereAjuste: false };

    const diasItinerario = diffDias(itinerario.fechaDesde, itinerario.fechaHasta);
    const diasCotizacion = diffDias(cot.fecha_salida, cot.fecha_regreso);

    if (diasItinerario === diasCotizacion) return { requiereAjuste: false };

    return {
      requiereAjuste: true,
      diasItinerario,
      diasCotizacion,
      fechaSalidaCotizacion: cot.fecha_salida,
      fechaRegresoCotizacion: cot.fecha_regreso,
    };
  } catch (err: any) {
    console.error("checkAjusteFechasCotizacion error:", err.message);
    return { requiereAjuste: false };
  }
}

/**
 * Comprueba si las propuestas vinculadas a `cotizacionId` tienen un
 * itinerario cuya duración no coincide con fecha_salida/fecha_regreso de
 * la cotización (uso: tras editar las fechas de una cotización). No
 * modifica nada. Devuelve como máximo el mayor desajuste encontrado, más
 * la lista de ids de propuesta afectadas.
 */
export async function checkAjusteFechasPropuestasVinculadas(cotizacionId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: cot, error: cotErr } = await agencyDb
      .from("operativa_cotizaciones")
      .select("fecha_salida, fecha_regreso")
      .eq("id", cotizacionId)
      .single();
    if (cotErr) throw cotErr;
    if (!cot?.fecha_salida || !cot?.fecha_regreso) return { requiereAjuste: false };

    const diasCotizacion = diffDias(cot.fecha_salida, cot.fecha_regreso);

    const { data: propuestas, error: propErr } = await agencyDb
      .from("operativa_propuestas")
      .select("id")
      .eq("cotizacion_id", cotizacionId);
    if (propErr) throw propErr;
    if (!propuestas || propuestas.length === 0) return { requiereAjuste: false };

    const propuestaIds: string[] = [];
    let diasItinerario = 0;

    for (const prop of propuestas) {
      const { data: landing } = await agencyDb
        .from("landings")
        .select("editor_content")
        .eq("proposal_id", prop.id)
        .eq("is_active", true)
        .maybeSingle();

      const secciones: any[] = landing?.editor_content ?? [];
      const itinerario = secciones.find(s => s.tipo === "itinerario" && s.fechaDesde && s.fechaHasta);
      if (!itinerario) continue;

      const dias = diffDias(itinerario.fechaDesde, itinerario.fechaHasta);
      if (dias !== diasCotizacion) {
        propuestaIds.push(prop.id);
        diasItinerario = dias;
      }
    }

    if (propuestaIds.length === 0) return { requiereAjuste: false };

    return {
      requiereAjuste: true,
      propuestaIds,
      diasItinerario,
      diasCotizacion,
    };
  } catch (err: any) {
    console.error("checkAjusteFechasPropuestasVinculadas error:", err.message);
    return { requiereAjuste: false };
  }
}

/**
 * Ajusta el itinerario de cada propuesta indicada a las fechas actuales de
 * `cotizacionId` (recorta días sobrantes o añade días vacíos según la
 * nueva duración). Uso: tras confirmar el aviso de ajuste al editar fechas
 * de una cotización con propuestas vinculadas.
 */
export async function ajustarItinerariosDeCotizacion(cotizacionId: string, propuestaIds: string[]) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: cot, error: cotErr } = await agencyDb
      .from("operativa_cotizaciones")
      .select("fecha_salida, fecha_regreso")
      .eq("id", cotizacionId)
      .single();
    if (cotErr) throw cotErr;
    if (!cot?.fecha_salida || !cot?.fecha_regreso) return { success: false, error: "Cotización sin fechas" };

    for (const propuestaId of propuestaIds) {
      const { data: landing } = await agencyDb
        .from("landings")
        .select("id, editor_content")
        .eq("proposal_id", propuestaId)
        .eq("is_active", true)
        .maybeSingle();
      if (!landing) continue;

      const secciones: any[] = landing.editor_content ?? [];
      const nuevasSecciones = ajustarSeccionesItinerario(secciones, cot.fecha_salida, cot.fecha_regreso);

      await agencyDb
        .from("landings")
        .update({ editor_content: nuevasSecciones })
        .eq("id", landing.id);
    }

    revalidatePath("/propuestas");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Vincula una propuesta a una cotización. Si `ajustarItinerario` es true,
 * recalcula fechaDesde/fechaHasta de la sección itinerario a las fechas de
 * la cotización, recortando días sobrantes o añadiendo días vacíos según
 * la nueva duración.
 */
export async function linkCotizacionToPropuestaConAjuste(
  cotizacionId: string,
  propuestaId: string,
  ajustarItinerario: boolean
) {
  try {
    const agencyDb = await getAgencyDbClient();

    if (ajustarItinerario) {
      const { data: cot, error: cotErr } = await agencyDb
        .from("operativa_cotizaciones")
        .select("fecha_salida, fecha_regreso")
        .eq("id", cotizacionId)
        .single();
      if (cotErr) throw cotErr;

      if (cot?.fecha_salida && cot?.fecha_regreso) {
        const { data: landing, error: landingErr } = await agencyDb
          .from("landings")
          .select("id, editor_content")
          .eq("proposal_id", propuestaId)
          .eq("is_active", true)
          .maybeSingle();
        if (landingErr) throw landingErr;

        if (landing) {
          const secciones: any[] = landing.editor_content ?? [];
          const nuevasSecciones = ajustarSeccionesItinerario(secciones, cot.fecha_salida, cot.fecha_regreso);

          await agencyDb
            .from("landings")
            .update({ editor_content: nuevasSecciones })
            .eq("id", landing.id);
        }
      }
    }

    const { error } = await agencyDb
      .from("operativa_propuestas")
      .update({ cotizacion_id: cotizacionId })
      .eq("id", propuestaId);

    revalidatePath("/propuestas");
    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Trae de la cotización vinculada a la propuesta:
 * - las líneas marcadas como opcionales (para la sección "Extras": descripción + pvp)
 * - el pvp por viajero de la cotización (para la sección "Precio")
 * Usado por los botones "Vincular desde cotización" en el editor de propuestas.
 */
export async function getExtrasYPvpDesdeCotizacion(propuestaId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: prop, error: propErr } = await agencyDb
      .from("operativa_propuestas")
      .select("cotizacion_id")
      .eq("id", propuestaId)
      .single();
    if (propErr) throw propErr;
    if (!prop?.cotizacion_id) return { ok: false, error: "Esta propuesta no tiene una cotización vinculada" };

    const { data: cotizacion, error: cotError } = await agencyDb
      .from("operativa_cotizaciones")
      .select("pvp_viajero")
      .eq("id", prop.cotizacion_id)
      .single();
    if (cotError) throw cotError;

    const { data: lineas, error: lineasErr } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("id, descripcion, pvp, opcional")
      .eq("cotizacion_id", prop.cotizacion_id)
      .order("created_at", { ascending: true });
    if (lineasErr) throw lineasErr;

    const extras = (lineas ?? [])
      .filter((l: any) => l.opcional)
      .map((l: any) => ({
        origenLineaId: l.id as string,
        texto: l.descripcion as string ?? "",
        importe: Number(l.pvp || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 }) + " €",
      }));

    const pvpTotal = Number(cotizacion?.pvp_viajero || 0);

    return {
      ok: true,
      extras,
      pvp: pvpTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 }) + " €",
    };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function crearPropuestaDesdeCotizacion(cotizacionId: string) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: cot, error: cotError } = await agencyDb
      .from("operativa_cotizaciones")
      .select("titulo, contacto, fecha_salida, fecha_regreso, destinos, agente_id")
      .eq("id", cotizacionId)
      .single();
    if (cotError || !cot) throw cotError ?? new Error("Cotización no encontrada");

    const destinosTexto = Array.isArray(cot.destinos) && cot.destinos.length > 0
      ? cot.destinos.map((d: any) => d?.nombre).filter(Boolean).join(", ")
      : null;

    let currentUserId: string | null = null;
    try {
      const adminSupabase = await createAdminServerClient();
      const { data: { user } } = await adminSupabase.auth.getUser();
      currentUserId = user?.id ?? null;
    } catch {}

    const { data: newProp, error: propError } = await agencyDb
      .from("operativa_propuestas")
      .insert({
        title: cot.titulo || "Nueva propuesta",
        destination: destinosTexto,
        fecha_salida: cot.fecha_salida || null,
        fecha_regreso: cot.fecha_regreso || null,
        cotizacion_id: cotizacionId,
        contacto_id: cot.contacto || null,
        agente_id: currentUserId ?? cot.agente_id ?? null,
        proposal_data: {},
      })
      .select("id, title")
      .single();
    if (propError || !newProp) throw propError;

    const uidPortada = `portada-${Date.now()}`;
    const editorContent: any[] = [
      { uid: uidPortada, tipo: "portada", label: "portada", titulo: cot.titulo || "Nueva propuesta" },
    ];
    const designTokens: any[] = [
      { uid: "global", estilosGlobales: {} },
      {
        uid: uidPortada,
        layout: "slide",
        estiloTitulo: { fuente: "Raleway", grosor: "400", tamano: "40px", color: "#ffffff", grosorDestacado: "700" },
        estiloSubtitulo: { fuente: "Montserrat", grosor: "300", color: "#ffffff", grosorDestacado: "700" },
      },
    ];

    if (cot.fecha_salida && cot.fecha_regreso) {
      const uidItinerario = `itinerario-${Date.now()}`;
      editorContent.push({
        uid: uidItinerario, tipo: "itinerario", label: "itinerario", titulo: "Itinerario",
        fechaDesde: cot.fecha_salida, fechaHasta: cot.fecha_regreso,
      });
      designTokens.push({
        uid: uidItinerario,
        estiloTitulo: { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" },
        estiloTituloDia: { fuente: "Raleway", grosor: "700", tamano: "18px", color: "#1e293b" },
        estiloDescDia: { fuente: "Montserrat", grosor: "400", tamano: "13px", color: "#64748b" },
      });
    }

    const { error: landingError } = await agencyDb.from("landings").insert({
      proposal_id: newProp.id,
      is_active: true,
      version_number: 1,
      editor_content: editorContent,
      design_tokens: designTokens,
    });
    if (landingError) throw landingError;

    revalidatePath("/propuestas");
    return { success: true, data: { id: newProp.id, title: newProp.title } };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Error desconocido" };
  }
}

export async function tienePropuestaCotizacionVinculada(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .select("cotizacion_id")
      .eq("id", id)
      .single();
    if (error) throw error;
    return { ok: true, tieneCotizacion: !!data?.cotizacion_id };
  } catch (e: any) {
    return { ok: false, tieneCotizacion: false, error: e?.message };
  }
}

export async function deletePropuesta(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    await assertPuedeEditarPropuesta(agencyDb, id);
    const { error } = await agencyDb
      .from("operativa_propuestas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/propuestas");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

export async function getPropuesta(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .select(`id, title, destination, destinos, slug, fecha_salida, fecha_regreso, created_at, contacto_id, cotizacion_id, agente_id, contabilidad_entidades!contacto_id(id, nombre), landings(id, is_active, design_tokens, editor_content)`)
      .eq("id", id)
      .single();
    if (error) throw error;
    const landing = Array.isArray(data.landings)
      ? (data.landings.find((l: any) => l.is_active) ?? data.landings[0] ?? null)
      : null;

    let agenteId: string | null = data.agente_id ?? null;
    if (!agenteId && data.cotizacion_id) {
      const { data: cot } = await agencyDb
        .from("operativa_cotizaciones")
        .select("agente_id")
        .eq("id", data.cotizacion_id)
        .maybeSingle();
      agenteId = cot?.agente_id ?? null;
    }

    let agente: any = null;
    if (agenteId) {
      const adminServiceSupabase = createAdminServiceClient();
      const { data: usr } = await adminServiceSupabase
        .from("usuarios")
        .select("id, nombre, apellidos, email, telefono, avatar_url")
        .or(`id.eq.${agenteId},auth_user_id.eq.${agenteId}`)
        .maybeSingle();
      if (usr) {
        agente = usr;
      }
    }

    return { ...data, landing, landings: undefined, agente };
  } catch (e: any) {
    console.error("getPropuesta:", e?.message);
    return null;
  }
}

/**
 * Variante pública (sin sesión de usuario) para servir una propuesta a visitantes anónimos
 * a través del enlace compartible. Resuelve la agencia por dominio en vez de por usuario autenticado.
 */
export async function getPropuestaPublica(id: string, dominio: string) {
  try {
    const dominioEfectivo = process.env.NEXT_PUBLIC_AGENCY_DOMAIN_OVERRIDE || dominio;
    const resolved = await getAgencyDbClientByDomain(dominioEfectivo);
    if (!resolved) return null;
    const { db: agencyDb } = resolved;

    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .select(`id, title, destination, destinos, slug, fecha_salida, fecha_regreso, created_at, contacto_id, cotizacion_id, agente_id, contabilidad_entidades!contacto_id(id, nombre), landings(id, is_active, design_tokens, editor_content)`)
      .eq("id", id)
      .single();
    if (error) throw error;
    const landing = Array.isArray(data.landings)
      ? (data.landings.find((l: any) => l.is_active) ?? data.landings[0] ?? null)
      : null;

    let agenteId: string | null = data.agente_id ?? null;
    if (!agenteId && data.cotizacion_id) {
      const { data: cot } = await agencyDb
        .from("operativa_cotizaciones")
        .select("agente_id")
        .eq("id", data.cotizacion_id)
        .maybeSingle();
      agenteId = cot?.agente_id ?? null;
    }

    let agente: any = null;
    if (agenteId) {
      const adminServiceSupabase = createAdminServiceClient();
      const { data: usr } = await adminServiceSupabase
        .from("usuarios")
        .select("id, nombre, apellidos, email, telefono, avatar_url")
        .or(`id.eq.${agenteId},auth_user_id.eq.${agenteId}`)
        .maybeSingle();
      if (usr) {
        agente = usr;
      }
    }

    return { ...data, landing, landings: undefined, agente };
  } catch (e: any) {
    console.error("getPropuestaPublica:", e?.message);
    return null;
  }
}

/**
 * Resuelve el id de una propuesta a partir de su slug público, dentro de la agencia
 * del dominio dado. Usado por la ruta pública /propuestas/p/[slug].
 */
export async function getPropuestaIdPorSlug(slug: string, dominio: string): Promise<string | null> {
  try {
    const dominioEfectivo = process.env.NEXT_PUBLIC_AGENCY_DOMAIN_OVERRIDE || dominio;
    const resolved = await getAgencyDbClientByDomain(dominioEfectivo);
    if (!resolved) return null;
    const { db: agencyDb } = resolved;

    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  } catch (e: any) {
    console.error("getPropuestaIdPorSlug:", e?.message);
    return null;
  }
}

/**
 * Crea una propuesta nueva a partir de las secciones extraídas por IA de un PDF importado
 * (ver src/lib/propuestas/importarPdf.ts). Aplica los mismos estilos por defecto que el
 * botón "+ Añadir sección" del editor para que el resultado sea editable de inmediato.
 */
export async function crearPropuestaDesdeSeccionesImportadas(
  seccionesImportadas: {
    tipo: string;
    titulo?: string;
    subtitulo?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    dias?: { dia: number; titulo?: string; desc?: string; paginaPdf?: number; media?: { tipo: "upload"; url: string } }[];
    cards?: { titulo: string }[];
    pvp?: string;
    condiciones?: string;
    otrasConsideraciones?: string;
    columnas?: { titulo?: string; texto?: string }[];
  }[],
  contactoId?: string | null
) {
  try {
    let idx = 0;
    const editorContent: any[] = [];
    const designTokens: any[] = [{ uid: "global", estilosGlobales: {} }];

    for (const s of seccionesImportadas) {
      const uid = `${s.tipo}-${Date.now()}-${idx++}`;
      const contenido: any = { uid, tipo: s.tipo, label: s.tipo, titulo: s.titulo };
      const diseno: any = { uid };

      if (s.tipo === "portada") {
        contenido.subtitulo = s.subtitulo;
        diseno.layout = "slide";
        diseno.estiloTitulo = { fuente: "Raleway", grosor: "400", tamano: "40px", color: "#ffffff", grosorDestacado: "700" };
        diseno.estiloSubtitulo = { fuente: "Montserrat", grosor: "300", color: "#ffffff", grosorDestacado: "700" };
      } else if (s.tipo === "itinerario") {
        contenido.fechaDesde = s.fechaDesde;
        contenido.fechaHasta = s.fechaHasta;
        contenido.dias = s.dias;
        diseno.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
        diseno.estiloTituloDia = { fuente: "Raleway", grosor: "700", tamano: "18px", color: "#1e293b" };
        diseno.estiloDescDia = { fuente: "Montserrat", grosor: "400", tamano: "13px", color: "#64748b" };
      } else if (s.tipo === "cards") {
        contenido.cards = (s.cards ?? []).map((c, i) => ({ uid: `card-${uid}-${i}`, titulo: c.titulo }));
        diseno.anchoMax = "1200px";
        diseno.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
      } else if (s.tipo === "precio") {
        contenido.pvp = s.pvp;
        contenido.condiciones = s.condiciones;
        contenido.otrasConsideraciones = s.otrasConsideraciones;
        diseno.layout = "destacado-grande";
        diseno.estiloPvp = { fuente: "Raleway", grosor: "800", tamano: "48px", color: "#1e293b" };
        diseno.estiloCondiciones = { fuente: "Montserrat", grosor: "400", tamano: "14px", color: "#475569" };
      } else if (s.tipo === "texto-columnas") {
        contenido.columnas = (s.columnas ?? []).map((c, i) => ({ uid: `col-${uid}-${i}`, titulo: c.titulo, texto: c.texto }));
        diseno.layout = (s.columnas?.length ?? 0) <= 1 ? "2-cols" : "3-cols";
        diseno.anchoMax = "1200px";
        diseno.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
      }

      editorContent.push(contenido);
      designTokens.push(diseno);
    }

    return await guardarPropuesta({ editorContent, designTokens, contactoId: contactoId ?? undefined });
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Error desconocido" };
  }
}

export async function guardarPropuesta({
  propuestaId,
  editorContent,
  designTokens,
  cotizacionId,
  contactoId,
  title: titleOverride,
  destination,
  fechaSalida,
  fechaRegreso,
}: {
  propuestaId?: string;
  editorContent: any[];
  designTokens: any[];
  cotizacionId?: string | null;
  contactoId?: string | null;
  title?: string;
  destination?: string | null;
  fechaSalida?: string | null;
  fechaRegreso?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    let currentUserId: string | null = null;
    try {
      const adminSupabase = await createAdminServerClient();
      const { data: { user } } = await adminSupabase.auth.getUser();
      currentUserId = user?.id ?? null;
    } catch {}

    if (propuestaId) {
      const { error } = await agencyDb
        .from("landings")
        .update({ editor_content: editorContent, design_tokens: designTokens })
        .eq("proposal_id", propuestaId)
        .eq("is_active", true);
      if (error) throw error;
      // Sincroniza título/contacto/destino/fechas en operativa_propuestas. El título del
      // header (titleOverride) manda sobre el de la sección portada si ambos vienen.
      const portada = editorContent.find((s: any) => s.tipo === "portada");
      const updates: any = {};
      if (titleOverride !== undefined) {
        updates.title = titleOverride;
      } else if (portada?.titulo) {
        updates.title = portada.titulo;
      }
      if (contactoId !== undefined) {
        updates.contacto_id = contactoId;
      }
      if (destination !== undefined) updates.destination = destination;
      if (fechaSalida !== undefined) updates.fecha_salida = fechaSalida;
      if (fechaRegreso !== undefined) updates.fecha_regreso = fechaRegreso;
      if (Object.keys(updates).length > 0) {
        await agencyDb.from("operativa_propuestas").update(updates).eq("id", propuestaId);
      }
      revalidatePath("/propuestas");
      return { ok: true, id: propuestaId };
    }

    // Título del header si se indicó; si no, el de la portada o fallback
    const portada = editorContent.find((s: any) => s.tipo === "portada");
    const title = titleOverride || portada?.titulo || "Nueva propuesta";

    const propInsert: any = { title, proposal_data: {}, agente_id: currentUserId };
    if (cotizacionId) propInsert.cotizacion_id = cotizacionId;
    if (contactoId) propInsert.contacto_id = contactoId;
    if (destination) propInsert.destination = destination;
    if (fechaSalida) propInsert.fecha_salida = fechaSalida;
    if (fechaRegreso) propInsert.fecha_regreso = fechaRegreso;

    const { data: prop, error: propErr } = await agencyDb
      .from("operativa_propuestas")
      .insert(propInsert)
      .select("id")
      .single();
    if (propErr || !prop) throw propErr;

    // Si viene vinculada a una cotización, buscar el presupuesto_id y marcarlo como cotizado
    if (cotizacionId) {
      const { data: cot } = await agencyDb
        .from("operativa_cotizaciones")
        .select("presupuesto_id")
        .eq("id", cotizacionId)
        .single();
      if (cot?.presupuesto_id) {
        agencyDb
          .from("operativa_presupuestos")
          .update({ estado: "cotizado" })
          .eq("id", cot.presupuesto_id)
          .then(() => {});
      }
    }

    const { error: landingErr } = await agencyDb.from("landings").insert({
      proposal_id: prop.id,
      is_active: true,
      editor_content: editorContent,
      design_tokens: designTokens,
    });
    if (landingErr) throw landingErr;

    revalidatePath("/propuestas");
    return { ok: true, id: prop.id };
  } catch (e: any) {
    console.error("guardarPropuesta:", e?.message);
    return { ok: false, error: e?.message };
  }
}

export async function getDatosRealesPropuesta({
  propuestaId,
  cotizacionId,
  contactoId,
}: {
  propuestaId?: string | null;
  cotizacionId?: string | null;
  contactoId?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    let targetCotId = cotizacionId;
    let fallbackDestination = "";
    let targetContactoId = contactoId;

    // 1. If we have a propuestaId, look up its cotizacion_id, destination, and contacto_id
    if (propuestaId) {
      const { data: prop } = await agencyDb
        .from("operativa_propuestas")
        .select("cotizacion_id, destination, contacto_id")
        .eq("id", propuestaId)
        .maybeSingle();
      if (prop) {
        if (prop.cotizacion_id && !targetCotId) targetCotId = prop.cotizacion_id;
        if (prop.contacto_id && !targetContactoId) targetContactoId = prop.contacto_id;
        fallbackDestination = prop.destination || "";
      }
    }

    // 2. If no targetCotId, search for the most recent cotizacion to use as example
    if (!targetCotId) {
      let { data: recentCot } = await agencyDb
        .from("operativa_cotizaciones")
        .select("id")
        .not("contacto", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!recentCot) {
        const { data } = await agencyDb
          .from("operativa_cotizaciones")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        recentCot = data;
      }
      if (recentCot) {
        targetCotId = recentCot.id;
      }
    }

    // 3. Fetch the cotización details
    let cotizacion: any = null;
    let cliente: any = null;
    let agente: any = null;
    let destinoName = fallbackDestination || "";

    if (targetCotId) {
      const { data: cot } = await agencyDb
        .from("operativa_cotizaciones")
        .select(`
          *,
          contabilidad_entidades!contacto(id, nombre),
          operativa_expedientes!expediente_id(
            id,
            destino_principal,
            maestro_destinos!destino_principal(nombre)
          )
        `)
        .eq("id", targetCotId)
        .maybeSingle();
      
      if (cot) {
        cotizacion = cot;
        if (cot.contabilidad_entidades) {
          cliente = cot.contabilidad_entidades;
        }
        // Extract destination
        if (cot.operativa_expedientes?.maestro_destinos?.nombre) {
          destinoName = cot.operativa_expedientes.maestro_destinos.nombre;
        } else if (Array.isArray(cot.destinos) && cot.destinos.length > 0) {
          const firstDest = cot.destinos[0];
          destinoName = typeof firstDest === "string" ? firstDest : firstDest?.nombre || "";
        }
        
        // Fetch agent name
        if (cot.agente_id) {
          const { data: ag } = await agencyDb
            .from("crm_agentes")
            .select("nombre, apellidos")
            .or(`id.eq.${cot.agente_id},auth_uid.eq.${cot.agente_id}`)
            .maybeSingle();
          if (ag) {
            agente = ag;
          }
        }
      }
    }

    if (targetContactoId) {
      const { data: ent } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre")
        .eq("id", targetContactoId)
        .maybeSingle();
      if (ent) {
        cliente = ent;
      }
    }

    // If still no agent name, try fetching current logged-in user to populate agent name
    if (!agente) {
      try {
        const { createAdminServerClient } = await import("@/lib/supabaseServer");
        const adminSupabase = await createAdminServerClient();
        const { data: { user } } = await adminSupabase.auth.getUser();
        if (user) {
          const { data: ag } = await agencyDb
            .from("crm_agentes")
            .select("nombre, apellidos")
            .eq("auth_uid", user.id)
            .maybeSingle();
          if (ag) {
            agente = ag;
          }
        }
      } catch (e) {
        console.error("Error fetching current agent:", e);
      }
    }

    // 4. Construct values
    const parts = (cliente?.nombre || "").trim().split(/\s+/);
    const nombreCliente = parts[0] || "María";
    const apellidosCliente = parts.slice(1).join(" ") || "García López";
    
    let nombreResponsable = "Carlos Martínez";
    let personaContacto: string | null = null;

    if (cliente?.id) {
      const { data: contacts } = await agencyDb
        .from("crm_contactos")
        .select("nombre")
        .eq("entidad_id", cliente.id)
        .eq("activo", true)
        .order("es_principal", { ascending: false })
        .limit(1);
      if (contacts && contacts.length > 0) {
        personaContacto = contacts[0].nombre;
      }
    }

    if (personaContacto) {
      nombreResponsable = personaContacto;
    } else if (agente) {
      nombreResponsable = `${agente.nombre} ${agente.apellidos || ""}`.trim();
    }

    let fechaSalida = "15 de agosto de 2025";
    let fechaVuelta = "25 de agosto de 2025";
    let numNoches = "10";

    if (cotizacion?.fecha_salida) {
      fechaSalida = formatFecha(cotizacion.fecha_salida);
    }
    if (cotizacion?.fecha_regreso) {
      fechaVuelta = formatFecha(cotizacion.fecha_regreso);
    }
    if (cotizacion?.fecha_salida && cotizacion?.fecha_regreso) {
      const s = new Date(cotizacion.fecha_salida);
      const r = new Date(cotizacion.fecha_regreso);
      const diffTime = Math.abs(r.getTime() - s.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      numNoches = String(diffDays);
    }

    const numViajeros = cotizacion?.plazas ? String(cotizacion.plazas) : "2";

    const totalEuros = cotizacion?.total_ingresos || (cotizacion?.pvp_viajero * (cotizacion?.plazas || 1)) || 3200;
    const precioPersonaEuros = cotizacion?.pvp_viajero || (cotizacion?.total_ingresos ? (cotizacion.total_ingresos / (cotizacion.plazas || 1)) : 1600);

    const formatMoneda = (val: number) => {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val).replace(/\u00a0/g, ' ');
    };

    return {
      ok: true,
      data: {
        "[Nombre_Cliente]": nombreCliente,
        "[Apellidos_Cliente]": apellidosCliente,
        "[Nombre_Responsable]": nombreResponsable,
        "[Fecha_Salida]": fechaSalida,
        "[Fecha_Vuelta]": fechaVuelta,
        "[Destino]": destinoName || "París",
        "[Num_Viajeros]": numViajeros,
        "[Num_Noches]": numNoches,
        "[Precio_Total]": formatMoneda(totalEuros),
        "[Precio_Por_Persona]": formatMoneda(precioPersonaEuros),
      }
    };
  } catch (e: any) {
    console.error("getDatosRealesPropuesta error:", e);
    return { ok: false, error: e?.message };
  }
}

function formatFecha(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

