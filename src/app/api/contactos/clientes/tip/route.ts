import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClient } from "@/lib/agencyDb";

type TriggerId = "inactivos_2_3" | "inactivos_5_mas" | "sin_email" | "sin_telefono" | "sin_etiqueta" | "sin_localidad" | "concentracion_geografica" | "etiqueta_dominante";

type Trigger = {
  id: TriggerId;
  score: number; // prioridad: mayor = más urgente/valioso
  datos: Record<string, unknown>;
  filtro: { tipo: "localidad" | "etiqueta_ausente" | "email_ausente" | "telefono_ausente" | "localidad_ausente" | "inactivo_2_3" | "inactivo_5_mas" | "etiqueta"; valor?: string };
  accionLabel: string;
};

async function getAgenteYAgencia(): Promise<{ agenteId: string; agenciaId: string } | null> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) return null;
  const svc = createAdminServiceClient();
  const { data } = await svc.from("usuarios").select("id, agencia_id").eq("auth_user_id", user.id).single();
  if (!data) return null;
  return { agenteId: data.id, agenciaId: data.agencia_id };
}

const SYSTEM_PROMPT = `Actúas como un Director Comercial Senior y Experto en Marketing Turístico para agencias de viajes especializadas en grupos escolares/institucionales. Analizas las estadísticas reales de la cartera de clientes de un agente (ya calculadas por reglas de negocio, con sus métricas exactas) y devuelves consejos prácticos, motivadores y orientados a generar ventas inmediatas o reactivar clientes.

Responde EXCLUSIVAMENTE con un array JSON válido, sin texto adicional, con este formato exacto:
[{"id": "<id del trigger>", "titulo": "<máx 6 palabras, sin emoji>", "mensaje": "<máx 40 palabras, empieza citando el dato clave, termina con una acción concreta y sugerida (email, WhatsApp, llamada)>"}]

Reglas:
- Un elemento del array por cada disparador recibido, mismo orden.
- Tono cercano, motivador y estratégico — como un compañero experto que da un consejo rápido y accionable, no un informe frío.
- Prohibido inventar datos, nombres de clientes o cifras que no se te han dado.
- Prohibido markdown, emojis, saludos o texto fuera del JSON.
- Para el disparador "sin_email": si "sinEmailConContacto" > 0, menciona explícitamente ambos datos, por ejemplo "tienes 34 clientes sin email institucional, 23 son grupos/empresas que sí tienen email de un contacto pero no institucional propio". Si "sinEmailConContacto" es 0, no menciones ese desglose.`;

// Mismo universo de "clientes" que usa /api/contactos/clientes (la tabla del listado):
// entidades con rol cliente/organizacion, UNION entidades que aparecen en crm_oportunidades.
// Debe mantenerse en sync con esa ruta para que las cifras del tip y el filtro de la tabla coincidan.
async function getClientesDelAgente(agencyDb: any, agenteId: string) {
  const campos = "id, email, telefono, otros_tlfs, direccion, agente_id, tipo_cliente_id";

  const { data: conRol, error: e1 } = await agencyDb
    .from("contabilidad_entidades")
    .select(campos)
    .or("roles->cliente.eq.true,roles->organizacion.eq.true");
  if (e1) throw e1;

  const { data: opRows, error: e2 } = await agencyDb
    .from("crm_oportunidades")
    .select("entidad_id")
    .not("entidad_id", "is", null);
  if (e2) throw e2;

  const crmIds = [...new Set((opRows ?? []).map((r: any) => r.entidad_id as string))];
  let conCrm: any[] = [];
  if (crmIds.length > 0) {
    const { data, error: e3 } = await agencyDb
      .from("contabilidad_entidades")
      .select(campos)
      .in("id", crmIds);
    if (e3) throw e3;
    conCrm = data ?? [];
  }

  const seen = new Set<string>();
  const all: any[] = [];
  for (const r of [...(conRol ?? []), ...conCrm]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (r.agente_id === agenteId) all.push(r);
  }

  // Entidades de tipo "Grupo" (organización): aunque no tengan email propio,
  // pueden tener contactos vinculados con email — no deben contar como "sin email".
  const { data: tiposClienteRows } = await agencyDb
    .from("config_tipos_cliente")
    .select("id, etiqueta");
  const tipoClientePorId = new Map((tiposClienteRows ?? []).map((t: any) => [t.id, t.etiqueta]));

  const idsGrupo = all
    .filter((c) => c.tipo_cliente_id && tipoClientePorId.get(c.tipo_cliente_id) === "Grupo")
    .map((c) => c.id);

  const entidadesConContactoEmail = new Set<string>();
  const entidadesConContactoTelefono = new Set<string>();
  if (idsGrupo.length > 0) {
    const { data: contactosOrg } = await agencyDb
      .from("crm_contactos_organizaciones")
      .select("entidad_id, crm_contactos(email, telefono, activo)")
      .in("entidad_id", idsGrupo)
      .eq("es_activa", true);
    for (const row of (contactosOrg ?? []) as any[]) {
      const contacto = row.crm_contactos;
      if (!contacto || contacto.activo === false) continue;
      if (contacto.email) entidadesConContactoEmail.add(row.entidad_id);
      if (contacto.telefono) entidadesConContactoTelefono.add(row.entidad_id);
    }
  }

  for (const c of all) {
    if (entidadesConContactoEmail.has(c.id)) c._tieneEmailPorContacto = true;
    if (entidadesConContactoTelefono.has(c.id)) c._tieneTelefonoPorContacto = true;
    c._tipoClienteEtiqueta = c.tipo_cliente_id ? (tipoClientePorId.get(c.tipo_cliente_id) ?? null) : null;
  }

  return all;
}

async function calcularTriggers(agencyDb: any, agenteId: string): Promise<Trigger[]> {
  const clientes = await getClientesDelAgente(agencyDb, agenteId);

  const total = clientes?.length ?? 0;
  if (total === 0) return [];

  const ids = (clientes ?? []).map((c: any) => c.id);
  const triggers: Trigger[] = [];

  // ── Sin email institucional propio ──────────────────────────────────────
  // Se desglosa: grupos que sí tienen email vía contacto (falta el institucional)
  // vs. clientes que no tienen ningún email en absoluto.
  const sinEmailTodos = (clientes ?? []).filter((c: any) => !c.email);
  const sinEmail = sinEmailTodos.length;
  const sinEmailConContacto = sinEmailTodos.filter((c: any) => c._tieneEmailPorContacto).length;
  const sinEmailSinContacto = sinEmail - sinEmailConContacto;
  if (sinEmail > 0) {
    const pct = Math.round((sinEmail / total) * 100);
    triggers.push({
      id: "sin_email",
      score: pct >= 40 ? 85 : pct >= 20 ? 55 : 28,
      datos: { sinEmail, sinEmailConContacto, sinEmailSinContacto, total, pct },
      filtro: { tipo: "email_ausente" },
      accionLabel: `Filtrar ${sinEmail} clientes`,
    });
  }

  // ── Sin teléfono ─────────────────────────────────────────────────────────
  // Grupos con contacto vinculado con teléfono no cuentan como "sin teléfono".
  const sinTelefono = (clientes ?? []).filter((c: any) => !c.telefono && !(c.otros_tlfs?.length > 0) && !c._tieneTelefonoPorContacto).length;
  if (sinTelefono > 0) {
    const pct = Math.round((sinTelefono / total) * 100);
    triggers.push({
      id: "sin_telefono",
      score: pct >= 40 ? 80 : pct >= 20 ? 50 : 24,
      datos: { sinTelefono, total, pct },
      filtro: { tipo: "telefono_ausente" },
      accionLabel: `Filtrar ${sinTelefono} clientes`,
    });
  }

  // ── Sin localidad (solo Personas: el propio cliente es el contacto) ─────
  const sinLocalidad = (clientes ?? []).filter((c: any) => {
    if (c._tipoClienteEtiqueta !== "Persona") return false;
    const loc = c.direccion?.ciudad || c.direccion?.localidad;
    return !loc;
  }).length;
  if (sinLocalidad > 0) {
    const pct = Math.round((sinLocalidad / total) * 100);
    triggers.push({
      id: "sin_localidad",
      score: pct >= 40 ? 50 : pct >= 20 ? 32 : 16,
      datos: { sinLocalidad, total, pct },
      filtro: { tipo: "localidad_ausente" },
      accionLabel: `Filtrar ${sinLocalidad} clientes`,
    });
  }

  // ── Sin etiqueta / etiqueta dominante ────────────────────────────────────
  const { data: etiquetadosRows } = await agencyDb
    .from("crm_entidades_etiquetas")
    .select("entidad_id, crm_etiquetas(id, nombre)")
    .in("entidad_id", ids);
  const entidadesConEtiqueta = new Set((etiquetadosRows ?? []).map((r: any) => r.entidad_id));
  const sinEtiqueta = total - entidadesConEtiqueta.size;
  if (sinEtiqueta > 0) {
    const pct = Math.round((sinEtiqueta / total) * 100);
    triggers.push({
      id: "sin_etiqueta",
      score: pct >= 60 ? 65 : pct >= 30 ? 42 : 18,
      datos: { sinEtiqueta, total, pct },
      filtro: { tipo: "etiqueta_ausente" },
      accionLabel: `Filtrar ${sinEtiqueta} clientes`,
    });
  }

  const etiquetaCount = new Map<string, { nombre: string; count: number }>();
  for (const r of (etiquetadosRows ?? []) as any[]) {
    const et = r.crm_etiquetas;
    if (!et) continue;
    const actual = etiquetaCount.get(et.id) ?? { nombre: et.nombre, count: 0 };
    actual.count++;
    etiquetaCount.set(et.id, actual);
  }
  const etiquetaTop = [...etiquetaCount.values()].sort((a, b) => b.count - a.count)[0];
  if (etiquetaTop && etiquetaTop.count >= 5) {
    const pct = Math.round((etiquetaTop.count / total) * 100);
    triggers.push({
      id: "etiqueta_dominante",
      score: pct >= 40 ? 58 : pct >= 20 ? 36 : 20,
      datos: { etiqueta: etiquetaTop.nombre, count: etiquetaTop.count, total, pct },
      filtro: { tipo: "etiqueta", valor: etiquetaTop.nombre },
      accionLabel: `Filtrar ${etiquetaTop.count} de "${etiquetaTop.nombre}"`,
    });
  }

  // ── Concentración geográfica ─────────────────────────────────────────────
  const localidadCount = new Map<string, number>();
  for (const c of clientes ?? []) {
    const loc = (c as any).direccion?.ciudad || (c as any).direccion?.localidad;
    if (loc) localidadCount.set(loc, (localidadCount.get(loc) ?? 0) + 1);
  }
  const localidadTop = [...localidadCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (localidadTop && localidadTop[1] >= 5) {
    const [localidad, count] = localidadTop;
    triggers.push({
      id: "concentracion_geografica",
      score: count >= 30 ? 60 : count >= 15 ? 38 : 22,
      datos: { localidad, count, total },
      filtro: { tipo: "localidad", valor: localidad },
      accionLabel: `Filtrar ${count} en ${localidad}`,
    });
  }

  // ── Inactivos, por franja de antigüedad del último expediente ───────────
  const hoy = new Date();
  const hace2 = new Date(hoy); hace2.setFullYear(hoy.getFullYear() - 2);
  const hace5 = new Date(hoy); hace5.setFullYear(hoy.getFullYear() - 5);

  const { data: expedientes } = await agencyDb
    .from("operativa_expedientes")
    .select("entidad_id, fecha_inicio")
    .in("entidad_id", ids)
    .not("fecha_inicio", "is", null);

  const ultimaFechaPorEntidad = new Map<string, Date>();
  for (const e of expedientes ?? []) {
    const fecha = new Date((e as any).fecha_inicio);
    const actual = ultimaFechaPorEntidad.get((e as any).entidad_id);
    if (!actual || fecha > actual) ultimaFechaPorEntidad.set((e as any).entidad_id, fecha);
  }

  let inactivos2a3 = 0;
  let inactivos5mas = 0;
  for (const id of ids) {
    const ultima = ultimaFechaPorEntidad.get(id);
    if (!ultima) continue; // sin expediente nunca: no forma parte de "inactivo reciente", es otro caso
    if (ultima < hace5) inactivos5mas++;
    else if (ultima < hace2) inactivos2a3++;
  }

  if (inactivos2a3 >= 5) {
    const pct = Math.round((inactivos2a3 / total) * 100);
    triggers.push({
      id: "inactivos_2_3",
      score: pct >= 40 ? 92 : pct >= 20 ? 70 : 45,
      datos: { inactivos: inactivos2a3, total, pct },
      filtro: { tipo: "inactivo_2_3" },
      accionLabel: `Filtrar ${inactivos2a3} inactivos`,
    });
  }

  if (inactivos5mas >= 5) {
    const pct = Math.round((inactivos5mas / total) * 100);
    triggers.push({
      id: "inactivos_5_mas",
      score: pct >= 20 ? 68 : pct >= 10 ? 48 : 30,
      datos: { inactivos: inactivos5mas, total, pct },
      filtro: { tipo: "inactivo_5_mas" },
      accionLabel: `Filtrar ${inactivos5mas} inactivos`,
    });
  }

  return triggers.sort((a, b) => b.score - a.score).slice(0, 3);
}

export async function GET() {
  try {
    const ctx = await getAgenteYAgencia();
    if (!ctx) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const agencyDb = await getAgencyDbClient();
    const hoy = new Date().toISOString().split("T")[0];

    const { data: cacheRow } = await agencyDb
      .from("agent_ai_tips")
      .select("tips")
      .eq("agente_id", ctx.agenteId)
      .eq("fecha", hoy)
      .maybeSingle();

    if (cacheRow?.tips) {
      return NextResponse.json({ success: true, tips: cacheRow.tips, agenteId: ctx.agenteId });
    }

    const triggers = await calcularTriggers(agencyDb, ctx.agenteId);
    if (triggers.length === 0) {
      const tips = [{ id: "sin_datos", titulo: "Todo en orden", mensaje: "Tu cartera está sana: sigue fidelizando y aprovecha para proponer viajes complementarios a tus clientes más fieles.", filtro: null, accionLabel: null }];
      await agencyDb.from("agent_ai_tips").upsert({ agente_id: ctx.agenteId, fecha: hoy, tips }, { onConflict: "agente_id,fecha" });
      return NextResponse.json({ success: true, tips, agenteId: ctx.agenteId });
    }

    const anthropic = await getAnthropicClient(ctx.agenciaId);
    const userMsg = JSON.stringify(triggers.map((t) => ({ id: t.id, datos: t.datos })));

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    });

    const raw = aiRes.content[0].type === "text" ? aiRes.content[0].text.trim() : "[]";
    let redactados: { id: string; titulo: string; mensaje: string }[] = [];
    try {
      redactados = JSON.parse(raw.replace(/^```json\n?|\n?```$/g, ""));
    } catch {
      redactados = [];
    }

    const tips = triggers.map((t, i) => ({
      id: t.id,
      titulo: redactados[i]?.titulo ?? "Recomendación",
      mensaje: redactados[i]?.mensaje ?? "",
      filtro: t.filtro,
      accionLabel: t.accionLabel,
    }));

    await agencyDb.from("agent_ai_tips").upsert({ agente_id: ctx.agenteId, fecha: hoy, tips }, { onConflict: "agente_id,fecha" });

    return NextResponse.json({ success: true, tips, agenteId: ctx.agenteId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
