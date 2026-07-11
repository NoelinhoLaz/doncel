"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

export async function getPropuestas() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .select(`
        id, title, destination, created_at, contacto_id,
        contabilidad_entidades!contacto_id(id, nombre),
        landings(id, is_active, version_number, design_tokens, editor_content)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((p: any) => ({
      ...p,
      landing: Array.isArray(p.landings)
        ? (p.landings.find((l: any) => l.is_active) ?? p.landings[0] ?? null)
        : null,
      landings: undefined,
    }));
  } catch (e: any) {
    console.error("getPropuestas error:", e?.message, e?.stack?.split('\n')[1]);
    return { error: e?.message ?? "Error desconocido", data: [] };
  }
}

export async function duplicarPropuesta(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data: prop, error: e1 } = await agencyDb
      .from("operativa_propuestas")
      .select("title, cotizacion_id, contacto_id")
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

    const { data: newProp, error: e3 } = await agencyDb
      .from("operativa_propuestas")
      .insert({ title: `${prop.title} (copia)`, cotizacion_id: prop.cotizacion_id || null, contacto_id: prop.contacto_id || null, proposal_data: {} })
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

export async function deletePropuesta(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
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
      .select(`id, title, destination, created_at, contacto_id, cotizacion_id, contabilidad_entidades!contacto_id(id, nombre), landings(id, is_active, design_tokens, editor_content)`)
      .eq("id", id)
      .single();
    if (error) throw error;
    const landing = Array.isArray(data.landings)
      ? (data.landings.find((l: any) => l.is_active) ?? data.landings[0] ?? null)
      : null;

    let agente: any = null;
    if (data.cotizacion_id) {
      const { data: cot } = await agencyDb
        .from("operativa_cotizaciones")
        .select("agente_id")
        .eq("id", data.cotizacion_id)
        .maybeSingle();
      if (cot?.agente_id) {
        const { data: usr } = await agencyDb
          .from("usuarios")
          .select("id, nombre, apellidos, email, telefono, avatar_url")
          .or(`id.eq.${cot.agente_id},auth_user_id.eq.${cot.agente_id}`)
          .maybeSingle();
        if (usr) {
          agente = usr;
        }
      }
    }

    if (!agente) {
      try {
        const { createAdminServerClient } = await import("@/lib/supabaseServer");
        const adminSupabase = await createAdminServerClient();
        const { data: { user } } = await adminSupabase.auth.getUser();
        if (user) {
          const { data: usr } = await agencyDb
            .from("usuarios")
            .select("id, nombre, apellidos, email, telefono, avatar_url")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          if (usr) {
            agente = usr;
          }
        }
      } catch (e) {
        console.error("Error fetching current agent fallback in getPropuesta:", e);
      }
    }

    return { ...data, landing, landings: undefined, agente };
  } catch (e: any) {
    console.error("getPropuesta:", e?.message);
    return null;
  }
}

export async function guardarPropuesta({
  propuestaId,
  editorContent,
  designTokens,
  cotizacionId,
  contactoId,
}: {
  propuestaId?: string;
  editorContent: any[];
  designTokens: any[];
  cotizacionId?: string | null;
  contactoId?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();

    if (propuestaId) {
      const { error } = await agencyDb
        .from("landings")
        .update({ editor_content: editorContent, design_tokens: designTokens })
        .eq("proposal_id", propuestaId)
        .eq("is_active", true);
      if (error) throw error;
      // Sincroniza el título y contacto en operativa_propuestas
      const portada = editorContent.find((s: any) => s.tipo === "portada");
      const updates: any = {};
      if (portada?.titulo) {
        updates.title = portada.titulo;
      }
      if (contactoId !== undefined) {
        updates.contacto_id = contactoId;
      }
      if (Object.keys(updates).length > 0) {
        await agencyDb.from("operativa_propuestas").update(updates).eq("id", propuestaId);
      }
      revalidatePath("/propuestas");
      return { ok: true, id: propuestaId };
    }

    // Título de la portada o fallback
    const portada = editorContent.find((s: any) => s.tipo === "portada");
    const title = portada?.titulo ?? "Nueva propuesta";

    const propInsert: any = { title, proposal_data: {} };
    if (cotizacionId) propInsert.cotizacion_id = cotizacionId;
    if (contactoId) propInsert.contacto_id = contactoId;

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

