"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentAgentePublic } from "@/actions/crm";
import { getCurrentUsuario } from "@/actions/usuarios";

export type TipoPresupuesto = "vacacional" | "P2P" | "grupo";
export type EstadoPresupuesto = "borrador" | "pendiente_cotizar" | "cotizando" | "cotizado" | "descartado";

export interface ContactoInput {
  nombre: string;
  apellidos?: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  es_principal?: boolean;
}

export interface NuevaEntidadInput {
  nombre: string;
  tipo: "particular" | "organizacion";
  emails_organizacion?: string[];
  contactos?: ContactoInput[];
}

export interface CreatePresupuestoInput {
  // Paso 1 — prospecto
  entidad_id?: string | null;
  responsable_contacto_id?: string | null;
  nueva_entidad?: NuevaEntidadInput | null;

  // Paso 2 — viaje
  titulo_viaje: string;
  tipo_presupuesto: TipoPresupuesto;
  plazas_estimadas: number;
  destino_ids?: string[];
  fecha_salida_estimada?: string | null;
  margen_salida_dias?: number | null;
  fecha_regreso_estimada?: string | null;
  margen_regreso_dias?: number | null;
  noches_estimadas?: number | null;
  pvp_estimado?: number | null;

  // Vinculación CRM
  oportunidad_id?: string | null;
  campana_id?: string | null;

  // Paso 3 — preferencias (JSONB)
  preferencias?: Record<string, any>;
  notas_iniciales?: string | null;
}

export async function createPresupuesto(input: CreatePresupuestoInput) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { usuarioId } = await getCurrentAgentePublic();

    let entidadId = input.entidad_id || null;

    // Si viene nueva entidad, la creamos primero
    if (!entidadId && input.nueva_entidad) {
      const ne = input.nueva_entidad;
      const emails = ne.emails_organizacion?.filter(Boolean) ?? [];

      const { data: entData, error: entError } = await agencyDb
        .from("contabilidad_entidades")
        .insert([{
          nombre: ne.nombre.trim(),
          roles: ne.tipo === "organizacion" ? { cliente: true, organizacion: true } : { cliente: true },
        }])
        .select("id")
        .single();

      if (entError) throw entError;
      entidadId = entData.id;

      // Emails adicionales de la organización
      if (emails.length > 0) {
        await agencyDb.from("contabilidad_entidades_emails").insert(
          emails.map((email, i) => ({
            entidad_id: entidadId,
            email: email.trim(),
            tipo: "general",
            es_principal: i === 0,
          }))
        );
      }
    }

    // Insertar presupuesto
    const { data: presupuesto, error: presError } = await agencyDb
      .from("operativa_presupuestos")
      .insert([{
        titulo_viaje: input.titulo_viaje.trim(),
        tipo_presupuesto: input.tipo_presupuesto,
        plazas_estimadas: input.plazas_estimadas,
        destino_ids: input.destino_ids ?? [],
        fecha_salida_estimada: input.fecha_salida_estimada || null,
        margen_salida_dias: input.margen_salida_dias ?? null,
        fecha_regreso_estimada: input.fecha_regreso_estimada || null,
        margen_regreso_dias: input.margen_regreso_dias ?? null,
        noches_estimadas: input.noches_estimadas ?? null,
        pvp_estimado: input.pvp_estimado || null,
        entidad_id: entidadId,
        agente_id: usuarioId,
        estado: "pendiente_cotizar",
        preferencias: input.preferencias ?? {},
        notas_iniciales: input.notas_iniciales?.trim() || null,
        oportunidad_id: input.oportunidad_id || null,
        campana_id: input.campana_id || null,
      }])
      .select("*")
      .single();

    if (presError) throw presError;

    // Insertar responsable desde CRM si se seleccionó uno
    if (input.responsable_contacto_id) {
      const { data: crm } = await agencyDb
        .from("crm_contactos")
        .select("nombre, cargo, email, telefono")
        .eq("id", input.responsable_contacto_id)
        .single();
      if (crm) {
        await agencyDb.from("operativa_presupuesto_contactos").insert([{
          presupuesto_id: presupuesto.id,
          crm_contacto_id: input.responsable_contacto_id,
          nombre: crm.nombre,
          apellidos: null,
          cargo: crm.cargo ?? null,
          email: crm.email ?? null,
          telefono: crm.telefono ?? null,
          es_principal: true,
        }]);
      }
    }

    // Insertar contactos de nueva entidad si los hay (también en crm_contactos para que
    // queden disponibles como responsables reutilizables al editar el presupuesto)
    const contactos = input.nueva_entidad?.contactos?.filter(c => c.nombre?.trim()) ?? [];
    if (contactos.length > 0) {
      const { data: crmContactos, error: crmError } = await agencyDb
        .from("crm_contactos")
        .insert(
          contactos.map((c, i) => ({
            entidad_id: entidadId,
            nombre: [c.nombre.trim(), c.apellidos?.trim()].filter(Boolean).join(" "),
            cargo: c.cargo?.trim() || null,
            email: c.email?.trim() || null,
            telefono: c.telefono?.trim() || null,
            es_principal: !input.responsable_contacto_id && i === 0,
          }))
        )
        .select("id");

      if (crmError) throw crmError;

      await agencyDb.from("operativa_presupuesto_contactos").insert(
        contactos.map((c, i) => ({
          presupuesto_id: presupuesto.id,
          crm_contacto_id: crmContactos?.[i]?.id ?? null,
          nombre: c.nombre.trim(),
          apellidos: c.apellidos?.trim() || null,
          cargo: c.cargo?.trim() || null,
          email: c.email?.trim() || null,
          telefono: c.telefono?.trim() || null,
          es_principal: !input.responsable_contacto_id && i === 0,
        }))
      );
    }

    // Trigger de pipeline: mover la oportunidad al estado configurado para "presupuesto_creado"
    if (input.oportunidad_id) {
      try {
        // Leer la campaña de la oportunidad y su configuracion_pipeline
        const { data: oport } = await agencyDb
          .from("crm_oportunidades")
          .select("campana_id")
          .eq("id", input.oportunidad_id)
          .single();

        const campanaId = oport?.campana_id ?? input.campana_id;

        if (campanaId) {
          const { data: campana } = await agencyDb
            .from("crm_campanas")
            .select("configuracion_pipeline")
            .eq("id", campanaId)
            .single();

          const estadoDestinoId = campana?.configuracion_pipeline?.disparadores?.presupuesto_creado;

          if (estadoDestinoId) {
            await agencyDb
              .from("crm_oportunidades")
              .update({ estado_id: estadoDestinoId })
              .eq("id", input.oportunidad_id);
          }
        }
      } catch (pipelineError: any) {
        // El trigger es best-effort: no bloquea si falla
        console.warn("Pipeline trigger skipped:", pipelineError.message);
      }
    }

    return { success: true, data: presupuesto };
  } catch (error: any) {
    console.error("Failed to create presupuesto:", error.message);
    return { success: false, error: error.message };
  }
}

export async function getPresupuestos(filters?: { oportunidad_id?: string }) {
  try {
    const agencyDb = await getAgencyDbClient();
    const currentUser = await getCurrentUsuario();

    let q = agencyDb
      .from("operativa_presupuestos")
      .select("*");

    if (currentUser) {
      if (currentUser.rol === "Agente") {
        const scope = currentUser.parametros?.alcance_vista_agentes || "subtenant";
        if (scope === "propio") {
          q = q.eq("agente_id", currentUser.id);
        } else if (scope === "subtenant" && currentUser.oficina_id) {
          const { data: agentesOficina } = await agencyDb
            .from("usuarios")
            .select("id")
            .eq("oficina_id", currentUser.oficina_id);
          q = q.in("agente_id", (agentesOficina ?? []).map((u: any) => u.id));
        }
      } else if (currentUser.rol === "SubAdmin" && currentUser.oficina_id) {
        const { data: agentesOficina } = await agencyDb
          .from("usuarios")
          .select("id")
          .eq("oficina_id", currentUser.oficina_id);
        q = q.in("agente_id", (agentesOficina ?? []).map((u: any) => u.id));
      }
    }

    if (filters?.oportunidad_id) q = (q as any).eq("oportunidad_id", filters.oportunidad_id);

    const { data: presupuestos, error } = await q.order("created_at", { ascending: false });

    if (error) throw error;
    if (!presupuestos?.length) return [];

    // Enriquecer con nombre de entidad
    const entidadIds = [...new Set(presupuestos.map((p: any) => p.entidad_id).filter(Boolean))];
    let entidadesMap: Record<string, string> = {};
    if (entidadIds.length) {
      const { data: ents } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre")
        .in("id", entidadIds);
      entidadesMap = Object.fromEntries((ents ?? []).map((e: any) => [e.id, e.nombre]));
    }

    // Enriquecer con contacto principal
    const presupuestoIds = presupuestos.map((p: any) => p.id);
    const { data: contactos } = await agencyDb
      .from("operativa_presupuesto_contactos")
      .select("presupuesto_id, id, crm_contacto_id, nombre, apellidos, cargo, email, telefono, es_principal")
      .in("presupuesto_id", presupuestoIds);

    const contactosMap: Record<string, any> = {};
    for (const c of contactos ?? []) {
      if (!contactosMap[c.presupuesto_id] || c.es_principal) {
        contactosMap[c.presupuesto_id] = c;
      }
    }

    // Enriquecer con conteo de cotizaciones
    const { data: cotizaciones } = await agencyDb
      .from("operativa_cotizaciones")
      .select("id, presupuesto_id")
      .in("presupuesto_id", presupuestoIds);

    const cotizacionesCountMap: Record<string, number> = {};
    for (const c of cotizaciones ?? []) {
      if (c.presupuesto_id) {
        cotizacionesCountMap[c.presupuesto_id] = (cotizacionesCountMap[c.presupuesto_id] || 0) + 1;
      }
    }

    return presupuestos.map((p: any) => ({
      ...p,
      cliente_nombre: entidadesMap[p.entidad_id] ?? null,
      contacto_principal: contactosMap[p.id] ?? null,
      cotizaciones_count: cotizacionesCountMap[p.id] || 0,
    }));
  } catch (error: any) {
    console.error("Failed to get presupuestos:", error.message);
    return [];
  }
}

export async function updateEstadoPresupuesto(presupuestoId: string, estado: EstadoPresupuesto) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_presupuestos")
      .update({ estado })
      .eq("id", presupuestoId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update estado presupuesto:", error.message);
    return { success: false, error: error.message };
  }
}

export async function getPresupuestoDetalle(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data: p, error } = await agencyDb
      .from("operativa_presupuestos")
      .select(`
        *,
        contabilidad_entidades!entidad_id(id, nombre, email, telefono),
        operativa_presupuesto_contactos(*)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    return { success: true, data: p };
  } catch (error: any) {
    console.error("Failed to get presupuesto detalle:", error.message);
    return { success: false, error: error.message };
  }
}
