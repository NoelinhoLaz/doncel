"use server";

import { cookies } from "next/headers";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/encryption";

const COOKIE_NAME = "portal_session";

export async function validateEmailDni(email: string, dni: string) {
  const emailTrimmed = email.trim().toLowerCase();
  const dniTrimmed = dni.trim().toUpperCase();

  if (!emailTrimmed || !dniTrimmed) {
    return { error: "Debes introducir el email y el DNI/NIF" };
  }

  try {
    const adminService = createAdminServiceClient();

    const agencias = (await adminService
      .from("agencias")
      .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag")
      .limit(5)) as unknown as { data: any[] | null; error: any };

    if (agencias.error) {
      return { error: `Error BD: ${agencias.error.message}` };
    }

    if (!agencias.data || agencias.data.length === 0) {
      return { error: "No hay agencias configuradas en el sistema" };
    }

    const agencia = agencias.data.find(
      (a: any) => a.supabase_service_role_key_enc && a.iv && a.auth_tag,
    );

    if (!agencia) {
      return { error: "No se encontró una agencia con credenciales válidas" };
    }

    const serviceRoleKey = decrypt(
      agencia.supabase_service_role_key_enc,
      agencia.iv,
      agencia.auth_tag,
    );

    const agencyDb = createClient(agencia.supabase_url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: entities, error: entityError } = await agencyDb
      .from("contabilidad_entidades")
      .select("id, nombre, email")
      .eq("email", emailTrimmed)
      .eq("documento", dniTrimmed)
      .limit(1);

    if (entityError) {
      return { error: `Error al verificar: ${entityError.message}` };
    }

    if (!entities || entities.length === 0) {
      return { error: "Datos incorrectos" };
    }

    const entity = entities[0];

    const { encryptedData, iv, authTag } = encrypt(
      JSON.stringify({ entityId: entity.id, entityName: entity.nombre, email: entity.email }),
    );

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, JSON.stringify({ d: encryptedData, iv, t: authTag }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[portal] Error inesperado:", err);
    return { error: `Error interno: ${err.message}` };
  }
}

export async function getPortalSession() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;

    if (!raw) return null;

    const { d, iv, t } = JSON.parse(raw);
    if (!d || !iv || !t) return null;

    const decrypted = decrypt(d, iv, t);
    return JSON.parse(decrypted) as {
      entityId: string;
      entityName: string;
      email: string;
    };
  } catch {
    return null;
  }
}

export async function getPortalExpedientes() {
  try {
    const session = await getPortalSession();
    if (!session) return [];

    const adminService = createAdminServiceClient();

    const agencias = (await adminService
      .from("agencias")
      .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag")
      .limit(5)) as unknown as { data: any[] | null; error: any };

    const agencia = (agencias.data || []).find(
      (a: any) => a.supabase_service_role_key_enc && a.iv && a.auth_tag,
    );
    if (!agencia) return [];

    const serviceRoleKey = decrypt(
      agencia.supabase_service_role_key_enc,
      agencia.iv,
      agencia.auth_tag,
    );

    const agencyDb = createClient(agencia.supabase_url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Buscar expedientes donde la entidad es la principal O es pagadora
    const { data: pagadorLinks } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("expediente_id")
      .eq("entidad_id", session.entityId);

    const expedienteIdsPorPagador: string[] = (pagadorLinks || []).map(
      (p: any) => p.expediente_id,
    );

    const allIds = [session.entityId, ...expedienteIdsPorPagador];

    // Para el OR filter construimos: entidad_id eq X OR id in [pagador expedition ids]
    const filterOr = [
      { column: "entidad_id", value: session.entityId },
    ];

    const { data: expedientes, error } = await agencyDb
      .from("operativa_expedientes")
      .select(`
        id, numero, referencia, destino_principal, fecha_inicio, fecha_fin,
        maestro_destinos(nombre)
      `)
      .or(
        expedienteIdsPorPagador.length > 0
          ? `entidad_id.eq.${session.entityId},id.in.(${expedienteIdsPorPagador.join(",")})`
          : `entidad_id.eq.${session.entityId}`,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[portal] Error fetching expedientes:", error);
      return [];
    }

    // Fetch viajeros filtrados por pagador_id para cada expediente
    const expedienteIds = (expedientes || []).map((e: any) => e.id);
    const { data: allViajeros } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select(`
        expediente_id, pagador_id,
        contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(nombre)
      `)
      .in("expediente_id", expedienteIds);

    // Agrupar viajeros por expediente
    const viajerosPorExp: Record<string, string[]> = {};
    // Check if entity is main contact for these expedientes
    const { data: mainContactExps } = await agencyDb
      .from("operativa_expedientes")
      .select("id")
      .in("id", expedienteIds)
      .eq("entidad_id", session.entityId);
    const mainContactIds = new Set((mainContactExps || []).map((e: any) => e.id));

    (allViajeros || []).forEach((v: any) => {
      const expId = v.expediente_id;
      const isMain = mainContactIds.has(expId);
      if (
        isMain ||
        v.pagador_id === session.entityId ||
        !v.pagador_id
      ) {
        if (!viajerosPorExp[expId]) viajerosPorExp[expId] = [];
        viajerosPorExp[expId].push(v.contabilidad_entidades?.nombre);
      }
    });

    return (expedientes || []).map((exp: any) => {
      const viajerosNombres = viajerosPorExp[exp.id] || [];
      return {
        id: exp.id,
        numero: exp.numero?.toString() || "",
        referencia: exp.referencia || "",
        destino: (exp.maestro_destinos as any)?.nombre || "",
        fechaInicio: exp.fecha_inicio || "",
        fechaFin: exp.fecha_fin || "",
        contratoFirmado: false,
        viajeros: viajerosNombres.filter(Boolean).join(", "),
      };
    });
  } catch (err: any) {
    console.error("[portal] Error inesperado en getPortalExpedientes:", err);
    return [];
  }
}

export async function getPortalPagos() {
  try {
    const session = await getPortalSession();
    if (!session) return { pagos: [], resumen: [], colorPrimario: "#2563eb" };

    const adminService = createAdminServiceClient();

    const agencias = (await adminService
      .from("agencias")
      .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag, color_corporativo")
      .limit(5)) as unknown as { data: any[] | null; error: any };

    const agencia = (agencias.data || []).find(
      (a: any) => a.supabase_service_role_key_enc && a.iv && a.auth_tag,
    );
    if (!agencia) return { pagos: [], resumen: [], colorPrimario: "#2563eb" };

    const serviceRoleKey = decrypt(
      agencia.supabase_service_role_key_enc,
      agencia.iv,
      agencia.auth_tag,
    );

    const agencyDb = createClient(agencia.supabase_url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Expedientes donde la entidad participa
    const { data: pagadorLinks } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("expediente_id")
      .eq("entidad_id", session.entityId);
    const expedienteIdsP: string[] = (pagadorLinks || []).map((p: any) => p.expediente_id);

    const { data: mainExps } = await agencyDb
      .from("operativa_expedientes")
      .select("id")
      .eq("entidad_id", session.entityId);

    const todosIds = [
      ...new Set([
        ...(mainExps || []).map((e: any) => e.id),
        ...expedienteIdsP,
      ]),
    ];

    if (todosIds.length === 0) return { pagos: [], resumen: [] };

    // ── Datos de pagadores (importe_total, importe_abonado) ──────────
    const { data: pagadores } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("expediente_id, importe_total, importe_abonado")
      .eq("entidad_id", session.entityId)
      .in("expediente_id", todosIds);

    const pagadorMap: Record<string, { importe_total: number; importe_abonado: number }> = {};
    (pagadores || []).forEach((p: any) => {
      pagadorMap[p.expediente_id] = {
        importe_total: Number(p.importe_total || 0),
        importe_abonado: Number(p.importe_abonado || 0),
      };
    });

    // ── Datos de viajero (extras) ────────────────────────────────
    // El pagador/tutor logueado no es el viajero; buscamos viajeros
    // donde pagador_id coincida con la sesión
    const { data: viajeroExtras } = await agencyDb
      .from("operativa_viajeros_expedientes")
      .select("expediente_id, importe_extras, extras")
      .eq("pagador_id", session.entityId)
      .in("expediente_id", todosIds);

    const extrasMap: Record<string, number> = {};
    const extrasListMap: Record<string, { descripcion: string; precio: number }[]> = {};
    (viajeroExtras || []).forEach((v: any) => {
      const expId = v.expediente_id;
      extrasMap[expId] = (extrasMap[expId] || 0) + Number(v.importe_extras || 0);
      try {
        const raw = typeof v.extras === "string" ? JSON.parse(v.extras) : v.extras;
        if (Array.isArray(raw)) {
          const items = raw
            .filter((e: any) => Number(e.precio || 0) > 0)
            .map((e: any) => ({
              descripcion: e.descripcion || "",
              precio: Number(e.precio || 0),
            }));
          extrasListMap[expId] = [...(extrasListMap[expId] || []), ...items];
        }
      } catch {
        // ignore parse errors
      }
    });

    // ── Datos de expedientes (pvp_total, entidad) ────────────────
    const { data: exps } = await agencyDb
      .from("operativa_expedientes")
      .select("id, numero, referencia, pvp_total, entidad_id")
      .in("id", todosIds);

    const expMap: Record<string, any> = {};
    (exps || []).forEach((e: any) => {
      expMap[e.id] = e;
    });

    // ── Nombre de la entidad titular del expediente ──────────────
    const entidadIds = [...new Set((exps || []).map((e: any) => e.entidad_id).filter(Boolean))];
    let entidadNombreMap: Record<string, string> = {};
    if (entidadIds.length > 0) {
      const { data: entidades } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre")
        .in("id", entidadIds);
      (entidades || []).forEach((e: any) => {
        entidadNombreMap[e.id] = e.nombre;
      });
    }

    // ── Resumen por expediente ────────────────────────────────────
    const resumen = todosIds.map((id) => {
      const exp = expMap[id] || {};
      const pag = pagadorMap[id] || { importe_total: 0, importe_abonado: 0 };
      const extras = extrasMap[id] || 0;
      const importeViaje = pag.importe_total;
      const totalConExtras = importeViaje + extras;
      const abonado = pag.importe_abonado;
      const restante = Math.max(0, totalConExtras - abonado);

      return {
        id,
        numero: exp.numero?.toString() || "",
        referencia: exp.referencia || "",
        entidadNombre: entidadNombreMap[exp.entidad_id] || "",
        importeViaje,
        extras,
        extrasList: extrasListMap[id] || [],
        totalConExtras,
        abonado,
        restante,
      };
    });

    // ── Movimientos de pago ──────────────────────────────────────
    const { data: movimientosDirect, error: errDirect } = await agencyDb
      .from("contabilidad_movimientos")
      .select(`id, fecha, concepto, importe_total, medio_pago, expediente_id`)
      .in("expediente_id", todosIds)
      .eq("entidad_id", session.entityId);

    if (errDirect) {
      console.error("[portal] Error fetching movimientos direct:", errDirect);
    }

    const { data: imputaciones, error: errImp } = await agencyDb
      .from("contabilidad_movimientos_imputaciones")
      .select("movimiento_id, expediente_id")
      .in("expediente_id", todosIds);

    if (errImp) {
      console.error("[portal] Error fetching imputaciones:", errImp);
    }

    const impExpMap: Record<string, string> = {};
    if (imputaciones) {
      for (const imp of imputaciones) {
        if (!impExpMap[imp.movimiento_id]) {
          impExpMap[imp.movimiento_id] = imp.expediente_id;
        }
      }
    }

    let movimientosIndirect: any[] = [];
    const impMovIds = Object.keys(impExpMap);
    if (impMovIds.length > 0) {
      const directIds = new Set((movimientosDirect || []).map((m: any) => m.id));
      const newIds = impMovIds.filter((id) => !directIds.has(id));
      if (newIds.length > 0) {
        const { data: indirect } = await agencyDb
          .from("contabilidad_movimientos")
          .select("id, fecha, concepto, importe_total, medio_pago")
          .in("id", newIds)
          .eq("entidad_id", session.entityId);
        movimientosIndirect = (indirect || []).map((m: any) => ({
          ...m,
          expediente_id: impExpMap[m.id],
        }));
      }
    }

    const movimientos = [...(movimientosDirect || []), ...movimientosIndirect]
      .sort(
        (a, b) =>
          new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime(),
      );

    const pagos = movimientos.slice(0, 50).map((m: any) => {
      const exp = expMap[m.expediente_id] || {};
      return {
        id: m.id,
        fecha: m.fecha,
        concepto: m.concepto || "—",
        importe: Number(m.importe_total || 0),
        medioPago: m.medio_pago || "",
        numeroExp: exp.numero?.toString() || "",
        referenciaExp: exp.referencia || "",
        expedienteId: m.expediente_id,
      };
    });

    return { pagos, resumen, colorPrimario: agencia.color_corporativo || "#2563eb" };
  } catch (err: any) {
    console.error("[portal] Error inesperado en getPortalPagos:", err);
    return { pagos: [], resumen: [], colorPrimario: "#2563eb" };
  }
}

export async function submitRegistro(payload: {
  domain: string;
  slug: string;
  viajeros: {
    nombre: string;
    apellidos: string;
    dni: string;
    dni_caducidad: string;
    pasaporte: string;
    pasaporte_caducidad: string;
    fecha_nacimiento: string;
    sexo?: "M" | "F" | null;
    numero_soporte?: string | null;
    email: string;
    telefono: string;
    direccion: string;
    alergias: string[];
    extras: { id: string; nombre: string; pvp: number; cantidad: number }[];
    tutor?: { nombre: string; telefono: string; email: string } | null;
  }[];
  pagador: {
    nombre: string;
    apellidos: string;
    dni: string;
    direccion: string;
    email?: string;
    telefono?: string;
  };
  metodoPago: string;
  plazosCalculados: { descripcion: string; fecha: string; importeCalculado: number }[];
}) {
  try {
    const agency = await (await import("@/lib/agencyDb")).getAgencyDbClientByDomain(payload.domain);
    if (!agency) return { error: "Agencia no encontrada" };
    const agencyDb = agency.db;

    const { data: exp, error: expError } = await agencyDb
      .from("operativa_expedientes")
      .select("id, pvp_viajero, pvp_total, forma_pago")
      .eq("slug", payload.slug)
      .single();
    if (expError || !exp) return { error: "Expediente no encontrado" };

    const pvpViajero = parseFloat(
      exp.forma_pago === "varios_pagadores" ? exp.pvp_viajero : exp.pvp_total
    ) || 0;

    // ── Helper: upsert entidad ────────────────────────────────────────────────
    // Columnas reales de contabilidad_entidades:
    //   nombre, documento, documento_caducidad, email, telefono, direccion, roles, metadatos
    // fecha_nacimiento, pasaporte, pasaporte_caducidad → van en metadatos (JSONB)
    async function upsertEntidad(datos: {
      nombre: string;
      documento: string;
      documento_caducidad?: string | null;
      email?: string | null;
      telefono?: string | null;
      direccion?: string | null;
      metadatos?: Record<string, any>;
      rolNuevo: string;
    }): Promise<string | null> {
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
            ...(datos.direccion && { direccion: datos.direccion }),
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
            direccion: datos.direccion || null,
            roles: { [datos.rolNuevo]: true },
            metadatos: datos.metadatos || {},
          })
          .select("id")
          .single();
        if (error) {
          console.error("[submitRegistro] Error creando entidad:", error.message);
          return null;
        }
        return newEnt?.id ?? null;
      }
    }

    // ── 1. Upsert pagador ─────────────────────────────────────────────────────
    const pagadorEntidadId = await upsertEntidad({
      nombre: `${payload.pagador.nombre} ${payload.pagador.apellidos}`,
      documento: payload.pagador.dni,
      email: payload.pagador.email || null,
      telefono: payload.pagador.telefono || null,
      direccion: payload.pagador.direccion || null,
      rolNuevo: "cliente",
    });

    if (!pagadorEntidadId) return { error: "Error al crear el pagador" };

    // ── 2. Procesar cada viajero ──────────────────────────────────────────────
    const viajeroEntidadIds: string[] = [];

    for (const v of payload.viajeros) {
      const docViajero = (v.dni || v.pasaporte).trim().toUpperCase();
      if (!docViajero) continue;

      // fecha_nacimiento, sexo y pasaporte van a metadatos (no son columnas de contabilidad_entidades)
      const metadatosViajero: Record<string, any> = {};
      if (v.fecha_nacimiento) metadatosViajero.fecha_nacimiento = v.fecha_nacimiento;
      if (v.sexo) metadatosViajero.sexo = v.sexo;
      if (v.numero_soporte) metadatosViajero.numero_soporte = v.numero_soporte.trim().toUpperCase();
      if (v.pasaporte) metadatosViajero.pasaporte = v.pasaporte.trim().toUpperCase();
      if (v.pasaporte_caducidad) metadatosViajero.pasaporte_caducidad = v.pasaporte_caducidad;

      const entidadId = await upsertEntidad({
        nombre: `${v.nombre} ${v.apellidos}`,
        documento: docViajero,
        documento_caducidad: v.dni_caducidad || v.pasaporte_caducidad || null,
        email: v.email || null,
        telefono: v.telefono || null,
        direccion: v.direccion || null,
        metadatos: Object.keys(metadatosViajero).length ? metadatosViajero : undefined,
        rolNuevo: "viajero",
      });

      if (!entidadId) continue;
      viajeroEntidadIds.push(entidadId);

      // ── 2a. Resolver tutor (si menor) ──────────────────────────────────────
      // Si el tutor es la misma persona que el pagador (mismo nombre o email),
      // reutilizamos pagadorEntidadId y añadimos rol tutor en lugar de crear entidad duplicada
      let tutorEntidadId: string | null = null;
      if (v.tutor?.nombre) {
        const tutorNombreNorm = v.tutor.nombre.trim().toLowerCase();
        const pagadorNombreNorm = `${payload.pagador.nombre} ${payload.pagador.apellidos}`.trim().toLowerCase();
        const tutorEmailNorm = v.tutor.email?.trim().toLowerCase();
        const pagadorEmailNorm = payload.pagador.email?.trim().toLowerCase();

        const esMismaPersQueElPagador =
          tutorNombreNorm === pagadorNombreNorm ||
          (tutorEmailNorm && pagadorEmailNorm && tutorEmailNorm === pagadorEmailNorm);

        if (esMismaPersQueElPagador && pagadorEntidadId) {
          // El tutor ES el pagador — añadir rol tutor a la entidad ya creada
          const { data: pagEnt } = await agencyDb
            .from("contabilidad_entidades")
            .select("roles")
            .eq("id", pagadorEntidadId)
            .single();
          await agencyDb
            .from("contabilidad_entidades")
            .update({ roles: { ...(pagEnt?.roles || {}), cliente: true, tutor: true } })
            .eq("id", pagadorEntidadId);
          tutorEntidadId = pagadorEntidadId;
        } else {
          // Tutor distinto del pagador — upsert por email (único identificador disponible)
          const tutorDoc = v.tutor.email?.trim().toUpperCase() ||
            v.tutor.nombre.replace(/\s+/g, "").toUpperCase().slice(0, 20);
          tutorEntidadId = await upsertEntidad({
            nombre: v.tutor.nombre,
            documento: tutorDoc,
            email: v.tutor.email || null,
            telefono: v.tutor.telefono || null,
            rolNuevo: "tutor",
          });
        }
      }

      // ── 2b. Extras de este viajero ─────────────────────────────────────────
      const extrasViajero = v.extras ?? [];
      const importeExtrasViajero = extrasViajero.reduce((s, e) => s + e.pvp * e.cantidad, 0);
      const extrasJsonb = extrasViajero.map(e => ({
        id: e.id,
        descripcion: e.nombre,
        precio: e.pvp,
        cantidad: e.cantidad,
      }));

      // ── 2c. Upsert en operativa_viajeros_expedientes ───────────────────────
      const { data: existingVE } = await agencyDb
        .from("operativa_viajeros_expedientes")
        .select("id")
        .eq("expediente_id", exp.id)
        .eq("entidad_id", entidadId)
        .maybeSingle();

      const vePayload = {
        estado: "pendiente" as const,
        extras: extrasJsonb,
        importe_extras: importeExtrasViajero,
        alergias: v.alergias ?? [],
        pagador_id: pagadorEntidadId,
        tutor_id: tutorEntidadId,
        datos_viaje: { metodo_pago: payload.metodoPago },
      };

      let viajeroExpId: string | null = null;

      if (existingVE) {
        await agencyDb
          .from("operativa_viajeros_expedientes")
          .update(vePayload)
          .eq("id", existingVE.id);
        viajeroExpId = existingVE.id;
      } else {
        const { data: insertedVE } = await agencyDb
          .from("operativa_viajeros_expedientes")
          .insert({ expediente_id: exp.id, entidad_id: entidadId, ...vePayload })
          .select("id")
          .single();
        viajeroExpId = insertedVE?.id ?? null;
      }

      // ── 2d. operativa_viajero_servicios (extras normalizados) ──────────────
      if (viajeroExpId && extrasViajero.length > 0) {
        // Borrar los anteriores para este viajero en este expediente y reinsertar
        await agencyDb
          .from("operativa_viajero_servicios")
          .delete()
          .eq("viajero_id", viajeroExpId);

        const serviciosRows = extrasViajero.flatMap(e =>
          Array.from({ length: e.cantidad }, () => ({
            viajero_id: viajeroExpId,
            servicio_id: e.id,
            pagado: false,
          }))
        );
        if (serviciosRows.length > 0) {
          await agencyDb.from("operativa_viajero_servicios").insert(serviciosRows);
        }
      }
    }

    // ── 3. operativa_pagadores_expedientes ────────────────────────────────────
    const importeTotal = payload.viajeros.reduce((s, v) => {
      const extrasV = v.extras ?? [];
      return s + pvpViajero + extrasV.reduce((se, e) => se + e.pvp * e.cantidad, 0);
    }, 0);

    const plazosJsonb = payload.plazosCalculados.map(p => ({
      descripcion: p.descripcion,
      fecha: p.fecha,
      importe: p.importeCalculado,
    }));

    const { data: existingPag } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("id")
      .eq("expediente_id", exp.id)
      .eq("entidad_id", pagadorEntidadId)
      .maybeSingle();

    if (existingPag) {
      await agencyDb
        .from("operativa_pagadores_expedientes")
        .update({
          importe_total: importeTotal,
          plazos: plazosJsonb,
          estado: "pendiente",
        })
        .eq("id", existingPag.id);
    } else {
      await agencyDb
        .from("operativa_pagadores_expedientes")
        .insert({
          expediente_id: exp.id,
          entidad_id: pagadorEntidadId,
          importe_total: importeTotal,
          plazos: plazosJsonb,
          estado: "pendiente",
        });
    }

    return { success: true };
  } catch (err: any) {
    console.error("[portal] Error en submitRegistro:", err);
    return { error: err.message || "Error al guardar el registro" };
  }
}

export async function clearPortalSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getPortalFacturas() {
  try {
    const session = await getPortalSession();
    if (!session) return [];

    const adminService = createAdminServiceClient();

    const agencias = (await adminService
      .from("agencias")
      .select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag")
      .limit(5)) as unknown as { data: any[] | null; error: any };

    const agencia = (agencias.data || []).find(
      (a: any) => a.supabase_service_role_key_enc && a.iv && a.auth_tag,
    );
    if (!agencia) return [];

    const serviceRoleKey = decrypt(
      agencia.supabase_service_role_key_enc,
      agencia.iv,
      agencia.auth_tag,
    );

    const agencyDb = createClient(agencia.supabase_url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: pagadorLinks } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select("expediente_id")
      .eq("entidad_id", session.entityId);
    const expedienteIdsP: string[] = (pagadorLinks || []).map((p: any) => p.expediente_id);

    const { data: mainExps } = await agencyDb
      .from("operativa_expedientes")
      .select("id")
      .eq("entidad_id", session.entityId);

    const todosIds = [
      ...new Set([
        ...(mainExps || []).map((e: any) => e.id),
        ...expedienteIdsP,
      ]),
    ];

    if (todosIds.length === 0) return [];

    const { data: facturas, error } = await agencyDb
      .from("facturas_emitidas")
      .select("id, numero_factura, fecha_emision, importe_total, verifactu_estado, expediente_id")
      .eq("pagador_id", session.entityId)
      .in("expediente_id", todosIds)
      .order("fecha_emision", { ascending: false });

    if (error) {
      console.error("[portal] Error fetching facturas:", error);
      return [];
    }

    const expIds = [...new Set((facturas || []).map((f: any) => f.expediente_id))];
    let expMap: Record<string, any> = {};
    if (expIds.length > 0) {
      const { data: exps } = await agencyDb
        .from("operativa_expedientes")
        .select("id, referencia")
        .in("id", expIds);
      (exps || []).forEach((e: any) => { expMap[e.id] = e; });
    }

    return (facturas || []).map((f: any) => ({
      id: f.id,
      numeroFactura: f.numero_factura || "",
      fechaEmision: f.fecha_emision || "",
      importeTotal: Number(f.importe_total || 0),
      estado: f.verifactu_estado || "NO_ENVIADO",
      referenciaExp: expMap[f.expediente_id]?.referencia || "",
    }));
  } catch (err: any) {
    console.error("[portal] Error inesperado en getPortalFacturas:", err);
    return [];
  }
}
