"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { google } from "googleapis";
import { getCurrentUserDriveConfig, getCurrentUsuario } from "@/actions/usuarios";

// ── Internal helpers ─────────────────────────────────────────────────────────

function resolveAgente(
  agent: { nombre?: string; apellidos?: string } | null | undefined,
  agente_id: string | null | undefined
): { nombre: string; iniciales: string } {
  if (agent?.nombre) {
    const first = agent.nombre.trim().charAt(0);
    const last = agent.apellidos?.trim().charAt(0) ?? "";
    return {
      nombre: `${agent.nombre} ${agent.apellidos ?? ""}`.trim(),
      iniciales: (first + last).toUpperCase() || "NC",
    };
  }
  if (agente_id) {
    return { nombre: "Agente", iniciales: agente_id.substring(0, 2).toUpperCase() };
  }
  return { nombre: "Agente", iniciales: "NC" };
}

// ── Expediente CRUD ──────────────────────────────────────────────────────────

export async function createExpediente(payload: {
  numero?: string | number | null;
  referencia: string;
  oficina_id?: string | null;
  destino_principal?: string | null;
  entidad_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  tipo_expediente: "grupo" | "vacacional" | "p2p";
  forma_pago: "un_pagador" | "varios_pagadores";
  formas_pago_aceptadas: string[];
  plazos: any[];
  genera_apunte: boolean;
  apuntes_desde?: string | null;
  metadata?: any;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const adminSupabase = await createAdminServerClient();

    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) throw new Error("No hay usuario autenticado.");

    let oficinaIdToInsert = payload.oficina_id;

    if (!oficinaIdToInsert) {
      try {
        const adminServiceSupabase = createAdminServiceClient();
        const { data: usuario } = await adminServiceSupabase
          .from("usuarios")
          .select("id")
          .eq("auth_user_id", user.id)
          .single();

        if (usuario) {
          const { data: config } = await agencyDb
            .from("config_usuarios")
            .select("oficina")
            .eq("usuario_id", usuario.id)
            .single();
          if (config?.oficina) oficinaIdToInsert = config.oficina;
        }
      } catch (dbErr) {
        console.warn("Could not determine user default office:", dbErr);
      }
    }

    if (!oficinaIdToInsert) {
      try {
        const { data: oficinas } = await agencyDb
          .from("config_oficinas")
          .select("id")
          .limit(1);
        if (oficinas && oficinas.length > 0) oficinaIdToInsert = oficinas[0].id;
      } catch (dbErr) {
        console.warn("Could not load config_oficinas fallback:", dbErr);
      }
    }

    if (!oficinaIdToInsert) {
      throw new Error("No hay ninguna oficina configurada en el sistema para asignar a este expediente.");
    }

    let nextNumeroStr = "";
    if (payload.numero === undefined || payload.numero === null || payload.numero.toString().trim() === "") {
      try {
        const { data: lastRecord } = await agencyDb
          .from("operativa_expedientes")
          .select("numero")
          .order("numero", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastRecord?.numero) {
          const lastNum = parseInt(lastRecord.numero);
          nextNumeroStr = !isNaN(lastNum) ? (lastNum + 1).toString().padStart(9, "0") : "001250001";
        } else {
          nextNumeroStr = "001250001";
        }
      } catch (err) {
        console.warn("Could not autogenerate number, using default:", err);
        nextNumeroStr = "001250001";
      }
    } else {
      nextNumeroStr = payload.numero.toString().trim();
    }

    const insertPayload: any = {
      numero: nextNumeroStr,
      referencia: payload.referencia,
      oficina_id: oficinaIdToInsert,
      destino_principal: payload.destino_principal || null,
      entidad_id: payload.entidad_id || null,
      agente_id: user.id,
      fecha_inicio: payload.fecha_inicio || null,
      fecha_fin: payload.fecha_fin || null,
      tipo_expediente: payload.tipo_expediente,
      forma_pago: payload.forma_pago,
      formas_pago_aceptadas: payload.formas_pago_aceptadas,
      plazos: payload.plazos,
      genera_apunte: payload.genera_apunte,
      apuntes_desde: payload.apuntes_desde || null,
      metadata: payload.metadata || null,
      estado: "abierto",
    };

    const { data, error } = await agencyDb
      .from("operativa_expedientes")
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error("Error creating expediente:", error);
      throw error;
    }

    revalidatePath("/expedientes");
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to create expediente:", error.message);
    throw new Error(error.message || "Failed to create expediente");
  }
}

export async function updateExpediente(id: string, payload: {
  numero?: string | number | null;
  referencia: string;
  slug?: string | null;
  oficina_id?: string | null;
  destino_principal?: string | null;
  entidad_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  tipo_expediente: "grupo" | "vacacional" | "p2p";
  forma_pago: "un_pagador" | "varios_pagadores";
  formas_pago_aceptadas: string[];
  plazos: any[];
  servicios_opcionales?: any[];
  genera_apunte: boolean;
  apuntes_desde?: string | null;
  metadata?: any;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) throw new Error("No hay usuario autenticado.");

    const updatePayload: any = {
      referencia: payload.referencia,
      slug: payload.slug || null,
      destino_principal: payload.destino_principal || null,
      entidad_id: payload.entidad_id || null,
      fecha_inicio: payload.fecha_inicio || null,
      fecha_fin: payload.fecha_fin || null,
      tipo_expediente: payload.tipo_expediente,
      forma_pago: payload.forma_pago,
      formas_pago_aceptadas: payload.formas_pago_aceptadas,
      plazos: payload.plazos,
      servicios_opcionales: payload.servicios_opcionales || null,
      genera_apunte: payload.genera_apunte,
      apuntes_desde: payload.apuntes_desde || null,
      metadata: payload.metadata || null,
    };

    if (payload.numero !== undefined && payload.numero !== null && payload.numero.toString().trim() !== "") {
      updatePayload.numero = payload.numero.toString().trim();
    }

    const { data, error } = await agencyDb
      .from("operativa_expedientes")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating expediente:", error);
      throw error;
    }

    revalidatePath("/expedientes");
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update expediente:", error.message);
    throw new Error(error.message || "Failed to update expediente");
  }
}

export async function updateExpedienteContacto(expedienteId: string, entidadId: string | null) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_expedientes")
      .update({ entidad_id: entidadId })
      .eq("id", expedienteId)
      .select()
      .single();

    if (error) {
      console.error("Error updating expediente contacto:", error);
      throw error;
    }

    revalidatePath("/expedientes");
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to update expediente contacto:", error.message);
    throw new Error(error.message || "Failed to update expediente contacto");
  }
}

export async function updateExpedienteDestino(expedienteId: string, destinoId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_expedientes")
      .update({ destino_principal: destinoId })
      .eq("id", expedienteId);

    if (error) throw error;
  } catch (error: any) {
    console.error("Error updating expediente destino:", error.message);
    throw new Error(error.message || "Failed to update expediente destino");
  }
}

// ── Map data ─────────────────────────────────────────────────────────────────

export interface MapaDestino {
  expedienteId: string;
  numero: string;
  referencia: string;
  destinoNombre: string;
  lat: number;
  lng: number;
  estado: string | null;
}

export async function getExpedientesMapa(): Promise<MapaDestino[]> {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_expedientes")
      .select("id, numero, referencia, estado, maestro_destinos (nombre_comercial, nombre, lat, lng)")
      .eq("estado", "abierto")
      .not("destino_principal", "is", null);

    if (error) {
      console.error("Error fetching map expedientes:", error);
      return [];
    }
    if (!data || data.length === 0) return [];

    return data
      .map((exp: any) => {
        const dest = exp.maestro_destinos;
        const lat = Number(dest?.lat ?? dest?.latitud ?? null);
        const lng = Number(dest?.lng ?? dest?.longitud ?? null);
        if (!dest || Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return {
          expedienteId: exp.id,
          numero: exp.numero?.toString() || "",
          referencia: exp.referencia || "",
          destinoNombre: dest.nombre_comercial || dest.nombre || "Destino desconocido",
          lat,
          lng,
          estado: exp.estado || null,
        };
      })
      .filter((item: MapaDestino | null): item is MapaDestino => item !== null);
  } catch (error: any) {
    console.error("Failed to fetch map expedientes:", error.message);
    return [];
  }
}

// ── Expediente queries ────────────────────────────────────────────────────────

export async function getExpedientes() {
  try {
    const agencyDb = await getAgencyDbClient();
    const currentUser = await getCurrentUsuario();

    let queryBuilder = agencyDb
      .from("operativa_expedientes")
      .select("*, config_oficinas(nombre), maestro_destinos(nombre, lat, lng), contabilidad_entidades(nombre), operativa_viajeros_expedientes(id, estado), operativa_pagadores_expedientes(importe_total, importe_abonado)");

    if (currentUser) {
      if (currentUser.rol === "Agente") {
        const scope = currentUser.parametros?.alcance_vista_agentes || "subtenant";
        if (scope === "propio") {
          queryBuilder = queryBuilder.eq("agente_id", currentUser.id);
        } else if (scope === "subtenant" && currentUser.oficina_id) {
          queryBuilder = queryBuilder.eq("oficina_id", currentUser.oficina_id);
        }
      } else if (currentUser.rol === "SubAdmin" && currentUser.oficina_id) {
        queryBuilder = queryBuilder.eq("oficina_id", currentUser.oficina_id);
      }
    }

    const { data, error } = await queryBuilder.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching expedientes:", error);
      throw error;
    }
    if (!data || data.length === 0) return [];

    let adminUsers: any[] = [];
    try {
      const adminServiceSupabase = createAdminServiceClient();
      const { data: users } = await adminServiceSupabase
        .from("usuarios")
        .select("id, auth_user_id, nombre, apellidos");
      adminUsers = users || [];
    } catch (dbErr) {
      console.warn("Could not load admin users for agents:", dbErr);
    }

    return data.map((exp: any) => {
      const agent = adminUsers.find(
        (u: any) => u.id === exp.agente_id || u.auth_user_id === exp.agente_id
      );
      return { ...exp, agente: resolveAgente(agent, exp.agente_id) };
    });
  } catch (error: any) {
    console.error("Failed to get expedientes:", error.message);
    throw new Error(error.message || "Failed to fetch expedientes");
  }
}

export async function getExpedienteById(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_expedientes")
      .select("*, config_oficinas(nombre), maestro_destinos(nombre), contabilidad_entidades(nombre)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching expediente by id:", error);
      throw error;
    }
    if (!data) return null;

    let agent = null;
    try {
      const adminServiceSupabase = createAdminServiceClient();
      const { data: agentData } = await adminServiceSupabase
        .from("usuarios")
        .select("id, auth_user_id, nombre, apellidos")
        .or(`id.eq.${data.agente_id},auth_user_id.eq.${data.agente_id}`)
        .maybeSingle();
      agent = agentData;
    } catch (dbErr) {
      console.warn("Could not load agent details for detail view:", dbErr);
    }

    return { ...data, agente: resolveAgente(agent, data.agente_id) };
  } catch (error: any) {
    console.error("Failed to get expediente by id:", error.message);
    return null;
  }
}

export async function linkExpedienteDriveFolder(expedienteId: string, folder: { id: string; name: string } | null) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    // First, fetch the current expediente to get its existing metadata
    const { data: expediente, error: fetchError } = await agencyDb
      .from("operativa_expedientes")
      .select("metadata")
      .eq("id", expedienteId)
      .single();
      
    if (fetchError) throw fetchError;
    
    const currentMetadata = expediente?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      drive_folder: folder,
    };
    
    const { data, error } = await agencyDb
      .from("operativa_expedientes")
      .update({ metadata: updatedMetadata })
      .eq("id", expedienteId)
      .select()
      .single();
      
    if (error) throw error;
    
    revalidatePath(`/expedientes/${expedienteId}`);
    return { success: true, data };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error linking drive folder:", error);
    return { success: false, error: errorMsg || "Failed to link folder" };
  }
}

export async function createExpedienteDriveFolder(expedienteId: string, folderName: string) {
  try {
    const driveConfigRes = await getCurrentUserDriveConfig();
    if (!driveConfigRes.success || !driveConfigRes.data) {
      throw new Error("Google Drive no conectado");
    }

    const { drive_access_token, drive_refresh_token, drive_token_expiry, drive_folder } = driveConfigRes.data;

    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: drive_access_token,
      refresh_token: drive_refresh_token,
      expiry_date: drive_token_expiry ? new Date(drive_token_expiry).getTime() : undefined,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Determine the parent folder ID: use default drive_folder from user config, otherwise root
    const parentId = drive_folder?.id || "root";

    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id, name",
    });

    const newFolder = {
      id: response.data.id!,
      name: response.data.name!,
    };

    // Save/link this folder in the expediente's metadata
    const agencyDb = await getAgencyDbClient();
    const { data: expediente, error: fetchError } = await agencyDb
      .from("operativa_expedientes")
      .select("metadata")
      .eq("id", expedienteId)
      .single();

    if (fetchError) throw fetchError;

    const currentMetadata = expediente?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      drive_folder: newFolder,
    };

    const { error: updateError } = await agencyDb
      .from("operativa_expedientes")
      .update({ metadata: updatedMetadata })
      .eq("id", expedienteId);

    if (updateError) throw updateError;

    revalidatePath(`/expedientes/${expedienteId}`);

    return { success: true, folder: newFolder };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error creating drive folder:", error);
    return { success: false, error: errorMsg || "Failed to create folder" };
  }
}

export async function getExpedienteLinksStatus(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    // Check cotizaciones count
    const { count: cotCount, error: cotErr } = await agencyDb
      .from("operativa_cotizaciones")
      .select("id", { count: "exact", head: true })
      .eq("expediente_id", expedienteId);

    // Check propuestas count
    const { count: propCount, error: propErr } = await agencyDb
      .from("operativa_propuestas")
      .select("id", { count: "exact", head: true })
      .eq("expediente_id", expedienteId);

    return {
      hasCotizacion: (cotCount || 0) > 0,
      hasPropuesta: (propCount || 0) > 0
    };
  } catch (err) {
    console.error("Error in getExpedienteLinksStatus:", err);
    return { hasCotizacion: false, hasPropuesta: false };
  }
}

export async function getEntityLinks(params: {
  expedienteId?: string;
  cotizacionId?: string;
  propuestaId?: string;
  presupuestoId?: string;
}) {
  try {
    const agencyDb = await getAgencyDbClient();
    let expedienteId = params.expedienteId;
    let cotizacionId = params.cotizacionId;
    let propuestaId = params.propuestaId;

    let presupuestoId: string | null = params.presupuestoId ?? null;

    // If entry point is a presupuesto, find its linked cotizacion
    if (presupuestoId && !cotizacionId) {
      const { data } = await agencyDb
        .from("operativa_cotizaciones")
        .select("id, expediente_id")
        .eq("presupuesto_id", presupuestoId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.id) cotizacionId = data.id;
      if (data?.expediente_id) expedienteId = data.expediente_id;
    }

    if (cotizacionId && !expedienteId) {
      const { data } = await agencyDb
        .from("operativa_cotizaciones")
        .select("expediente_id, presupuesto_id")
        .eq("id", cotizacionId)
        .maybeSingle();
      if (data?.expediente_id) expedienteId = data.expediente_id;
      if (data?.presupuesto_id) presupuestoId = data.presupuesto_id;
    }

    if (propuestaId && !expedienteId) {
      const { data } = await agencyDb
        .from("operativa_propuestas")
        .select("cotizacion_id")
        .eq("id", propuestaId)
        .maybeSingle();
      if (data?.cotizacion_id) {
        const { data: cot } = await agencyDb
          .from("operativa_cotizaciones")
          .select("expediente_id")
          .eq("id", data.cotizacion_id)
          .maybeSingle();
        if (cot?.expediente_id) expedienteId = cot.expediente_id;
      }
    }

    // Now get the details
    let linkedCotizaciones: any[] = [];
    let linkedPropuestas: any[] = [];
    let expedienteObj: any = null;

    if (expedienteId) {
      const { data: exp } = await agencyDb
        .from("operativa_expedientes")
        .select("*, contabilidad_entidades(nombre)")
        .eq("id", expedienteId)
        .maybeSingle();
      expedienteObj = exp;

      const { data: cots } = await agencyDb
        .from("operativa_cotizaciones")
        .select("id, titulo, presupuesto_id")
        .eq("expediente_id", expedienteId)
        .order("created_at", { ascending: true });
      linkedCotizaciones = cots || [];

      // Get propuestas linked through the cotizaciones of this expediente
      const cotIds = linkedCotizaciones.map((c) => c.id);
      if (cotIds.length > 0) {
        const { data: props, error: propErr } = await agencyDb
          .from("operativa_propuestas")
          .select("id, title")
          .in("cotizacion_id", cotIds);
        if (!propErr) {
          linkedPropuestas = props || [];
        }
      }

      // Resolve presupuesto_id from cotizaciones if not already set
      if (!presupuestoId) {
        const cotWithPresup = linkedCotizaciones.find((c) => c.presupuesto_id);
        if (cotWithPresup) presupuestoId = cotWithPresup.presupuesto_id;
      }
    }

    // If we found a cotizacion via presupuesto but no expediente, still populate linkedCotizaciones
    if (cotizacionId && linkedCotizaciones.length === 0) {
      const { data: cot } = await agencyDb
        .from("operativa_cotizaciones")
        .select("id, titulo, presupuesto_id")
        .eq("id", cotizacionId)
        .maybeSingle();
      if (cot) {
        linkedCotizaciones = [cot];
        if (!presupuestoId && cot.presupuesto_id) presupuestoId = cot.presupuesto_id;

        // Also get propuestas for this cotizacion
        const { data: props } = await agencyDb
          .from("operativa_propuestas")
          .select("id, title")
          .eq("cotizacion_id", cotizacionId);
        if (props) linkedPropuestas = props;
      }
    }

    return {
      success: true,
      expedienteId,
      expediente: expedienteObj,
      cotizaciones: linkedCotizaciones,
      propuestas: linkedPropuestas,
      presupuestoId,
    };
  } catch (err: any) {
    console.error("Error in getEntityLinks:", err);
    return { success: false, error: err.message };
  }
}

export async function linkCotizacionToPresupuesto(cotizacionId: string, presupuestoId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_cotizaciones")
      .update({ presupuesto_id: presupuestoId })
      .eq("id", cotizacionId);
    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function linkCotizacionToExpediente(cotizacionId: string, expedienteId: string | null) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_cotizaciones")
      .update({ expediente_id: expedienteId })
      .eq("id", cotizacionId);
    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function linkPropuestaToExpediente(propuestaId: string, expedienteId: string | null) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    // Get cotizacion_id of this proposal
    const { data: prop } = await agencyDb
      .from("operativa_propuestas")
      .select("cotizacion_id")
      .eq("id", propuestaId)
      .maybeSingle();
      
    if (prop?.cotizacion_id) {
      // Link that cotizacion to the expediente
      const { error } = await agencyDb
        .from("operativa_cotizaciones")
        .update({ expediente_id: expedienteId })
        .eq("id", prop.cotizacion_id);
      return { success: !error, error: error?.message };
    } else if (expedienteId) {
      // Find if the expediente already has a real cotización and link proposal to it
      const { data: existingCot } = await agencyDb
        .from("operativa_cotizaciones")
        .select("id")
        .eq("expediente_id", expedienteId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
        
      if (existingCot?.id) {
        // Associate proposal with the existing cotización
        const { error } = await agencyDb
          .from("operativa_propuestas")
          .update({ cotizacion_id: existingCot.id })
          .eq("id", propuestaId);
        return { success: !error, error: error?.message };
      } else {
        // No cotización exists on this expediente yet — just store the link via a new one
        const { data: cot, error: cotErr } = await agencyDb
          .from("operativa_cotizaciones")
          .insert({ titulo: "Cotización vinculada", expediente_id: expedienteId })
          .select("id")
          .single();
        if (cotErr) throw cotErr;
        
        const { error } = await agencyDb
          .from("operativa_propuestas")
          .update({ cotizacion_id: cot.id })
          .eq("id", propuestaId);
        return { success: !error, error: error?.message };
      }
    } else {
      return { success: true }; // Unlinking — nothing to do
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function searchExpedientes(q: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    let query = agencyDb
      .from("operativa_expedientes")
      .select("id, referencia, numero, contabilidad_entidades(nombre)");
    
    if (q) {
      query = query.or(`referencia.ilike.%${q}%,numero.ilike.%${q}%`);
    }
    
    const { data, error } = await query.limit(20);
    if (error) throw error;
    
    return {
      success: true,
      data: (data || []).map((e: any) => ({
        id: e.id,
        nombre: e.numero ? `${e.numero} - ${e.referencia} (${e.contabilidad_entidades?.nombre || 'Sin cliente'})` : `${e.referencia} (${e.contabilidad_entidades?.nombre || 'Sin cliente'})`
      }))
    };
  } catch (err: any) {
    console.error("searchExpedientes error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function searchCotizaciones(q: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    let query = agencyDb
      .from("operativa_cotizaciones")
      .select("id, titulo");
      
    if (q) {
      query = query.ilike("titulo", `%${q}%`);
    }
    
    const { data, error } = await query.limit(20);
    if (error) throw error;
    
    return {
      success: true,
      data: (data || []).map((c: any) => ({
        id: c.id,
        nombre: c.titulo || `Cotización #${c.id.substring(0, 8)}`
      }))
    };
  } catch (err: any) {
    console.error("searchCotizaciones error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function searchPropuestas(q: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    let query = agencyDb
      .from("operativa_propuestas")
      .select("id, title");
      
    if (q) {
      query = query.ilike("title", `%${q}%`);
    }
    
    const { data, error } = await query.limit(20);
    if (error) throw error;
    
    return {
      success: true,
      data: (data || []).map((p: any) => ({
        id: p.id,
        nombre: p.title || `Propuesta #${p.id.substring(0, 8)}`
      }))
    };
  } catch (err: any) {
    console.error("searchPropuestas error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function createNewCotizacionLinked(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    const { data: exp } = await agencyDb
      .from("operativa_expedientes")
      .select("agente_id, contacto_id")
      .eq("id", expedienteId)
      .maybeSingle();

    const { data, error } = await agencyDb
      .from("operativa_cotizaciones")
      .insert({
        titulo: "Nueva Cotización",
        expediente_id: expedienteId,
        contacto: exp?.contacto_id || null,
        plazas: 1
      })
      .select("id, titulo")
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error("createNewCotizacionLinked error:", err);
    return { success: false, error: err.message };
  }
}

export async function createNewCotizacionLinkedToPresupuesto(presupuestoId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_cotizaciones")
      .insert({ titulo: "Nueva Cotización", presupuesto_id: presupuestoId, plazas: 1 })
      .select("id, titulo")
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createNewPropuestaLinked(expedienteId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    
    const { data: exp } = await agencyDb
      .from("operativa_expedientes")
      .select("contacto_id")
      .eq("id", expedienteId)
      .maybeSingle();

    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .insert({
        title: "Nueva Propuesta",
        expediente_id: expedienteId,
        contacto_id: exp?.contacto_id || null
      })
      .select("id, title")
      .single();

    if (error) throw error;

    await agencyDb.from("landings").insert({
      proposal_id: data.id,
      is_active: true,
      version_number: 1,
      design_tokens: [],
      editor_content: [
        { uid: `portada-${Date.now()}`, tipo: "portada", titulo: "Nueva Propuesta", subtitulo: "Destacado" }
      ]
    });

    return { success: true, data: { id: data.id, nombre: data.title } };
  } catch (err: any) {
    console.error("createNewPropuestaLinked error:", err);
    return { success: false, error: err.message };
  }
}

export async function createNewExpedienteLinked(linkedId: string, type: "cotizacion" | "propuesta") {
  try {
    const agencyDb = await getAgencyDbClient();
    
    const rand = Math.floor(1000 + Math.random() * 9000);
    const { data: exp, error: expErr } = await agencyDb
      .from("operativa_expedientes")
      .insert({
        referencia: `Expediente Rápido #${rand}`,
        numero: `EXP-${rand}`,
        estado: "abierto"
      })
      .select("id, referencia, numero")
      .single();

    if (expErr || !exp) throw expErr;

    if (type === "cotizacion") {
      await agencyDb
        .from("operativa_cotizaciones")
        .update({ expediente_id: exp.id })
        .eq("id", linkedId);
    } else {
      // Get cotizacion_id of proposal
      const { data: prop } = await agencyDb
        .from("operativa_propuestas")
        .select("cotizacion_id")
        .eq("id", linkedId)
        .maybeSingle();
      
      if (prop?.cotizacion_id) {
        await agencyDb
          .from("operativa_cotizaciones")
          .update({ expediente_id: exp.id })
          .eq("id", prop.cotizacion_id);
      } else {
        const { data: cot } = await agencyDb
          .from("operativa_cotizaciones")
          .insert({ titulo: "Cotización de Propuesta", expediente_id: exp.id })
          .select("id")
          .single();
        if (cot?.id) {
          await agencyDb
            .from("operativa_propuestas")
            .update({ cotizacion_id: cot.id })
            .eq("id", linkedId);
        }
      }
    }

    return { success: true, data: exp };
  } catch (err: any) {
    console.error("createNewExpedienteLinked error:", err);
    return { success: false, error: err.message };
  }
}

