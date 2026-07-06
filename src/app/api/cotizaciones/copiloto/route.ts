import { NextRequest, NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { runBiChat } from "@/actions/bi-chat";
import type { ChatTurn } from "@/actions/bi-chat";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { searchPlacesText } from "@/actions/places";

async function getAgenciaId(): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) return "";
  const svc = createAdminServiceClient();
  const { data } = await svc.from("usuarios").select("agencia_id").eq("auth_user_id", user.id).single();
  return data?.agencia_id ?? "";
}

async function buildCotizacionContext(cotizacionId: string): Promise<string> {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: cot } = await agencyDb
      .from("operativa_cotizaciones")
      .select("*, contabilidad_entidades!contacto(id, nombre, email, telefono)")
      .eq("id", cotizacionId)
      .single();

    if (!cot) return "";

    const { data: lineas } = await agencyDb
      .from("operativa_cotizacion_lineas")
      .select("*, config_tipos_servicios(etiqueta), maestro_destinos!destino(nombre, nombre_comercial, locality, admin_area_l2), contabilidad_proveedores!proveedor(id, nombre, razon_social)")
      .eq("cotizacion_id", cotizacionId)
      .order("created_at", { ascending: true });

    const contacto = (cot as any).contabilidad_entidades;
    const lines: any[] = lineas || [];

    const lineasStr = lines.map((l: any, i: number) => {
      const tipo = l.config_tipos_servicios?.etiqueta || l.tipo || "servicio";
      const detalles = typeof l.detalles === "string" ? (() => { try { return JSON.parse(l.detalles); } catch { return {}; } })() : (l.detalles || {});
      const md = l.maestro_destinos;
      const destinoNombre = md?.nombre_comercial || md?.locality || md?.admin_area_l2 || md?.nombre || "";
      const proveedor = l.contabilidad_proveedores?.nombre || l.contabilidad_proveedores?.razon_social || "";
      const proveedorId = l.contabilidad_proveedores?.id || "";
      const extras: string[] = [];
      if (detalles?.regimen) extras.push(detalles.regimen);
      if (detalles?.categoria) extras.push(detalles.categoria);
      return `  ${i + 1}. [${tipo}] ${l.descripcion || ""}${destinoNombre ? ` · Destino: ${destinoNombre}` : ""}${proveedor ? ` · Proveedor: ${proveedor}${proveedorId ? ` (id:${proveedorId})` : ""}` : ""}${extras.length ? ` · ${extras.join(", ")}` : ""} · ${l.plazas || 0} plazas · ${l.noches || 0} noches · Neto: ${l.neto || 0}€/u · PVP: ${l.pvp || 0}€/u · Total neto: ${l.total_neto || 0}€ · Total PVP: ${l.total_pvp || 0}€${l.opcional ? " [OPCIONAL]" : ""}${l.checked ? " [✓]" : ""}`;
    }).join("\n");

    const destinos = Array.isArray((cot as any).destinos) ? (cot as any).destinos.map((d: any) => d.nombre || d).join(", ") : "";

    return `
COTIZACIÓN ACTIVA (tu contexto principal):
- ID: ${(cot as any).id}
- Título: ${(cot as any).titulo || "Sin título"}
- Contacto: ${contacto?.nombre || "Sin contacto"}${contacto?.email ? ` (${contacto.email})` : ""}
- Estado: ${(cot as any).estado || "borrador"}
- Destinos del viaje: ${destinos || "no especificados"}
- Fecha salida: ${(cot as any).fecha_salida || "no especificada"} · Regreso: ${(cot as any).fecha_regreso || "no especificada"}
- Plazas: ${(cot as any).plazas || 0} (free: ${(cot as any).free || 0})
- PVP viajero: ${(cot as any).pvp_viajero || 0}€ · Coste/viajero: ${(cot as any).coste_viajero || 0}€
- Total coste: ${(cot as any).total_coste || 0}€ · Total ingresos: ${(cot as any).total_ingresos || 0}€
- Beneficio: ${(cot as any).total_beneficio || 0}€ · Margen: ${(cot as any).margen_beneficio ? ((cot as any).margen_beneficio * 100).toFixed(1) + "%" : "0%"}
- Suplementos: ${(cot as any).suplementos || "ninguno"}

LÍNEAS DE ESTA COTIZACIÓN (${lines.length} servicios):
${lineasStr || "  (sin líneas)"}

TABLAS DE COTIZACIONES DISPONIBLES PARA CONSULTAS HISTÓRICAS:
- operativa_cotizaciones(id, expediente_id, contacto[FK→contabilidad_entidades.id], titulo, pvp_viajero, plazas, free, coste_viajero, total_coste, total_ingresos, total_beneficio, margen_beneficio, estado[borrador|presentada|aceptada|rechazada], suplementos, destinos JSONB, fecha_salida DATE, fecha_regreso DATE)
- operativa_cotizacion_lineas(id, cotizacion_id[FK→operativa_cotizaciones.id], tipo[FK→config_tipos_servicios.id], descripcion, proveedor[FK→contabilidad_proveedores.id], destino[FK→maestro_destinos.id], plazas, noches, neto DECIMAL, pvp DECIMAL, total_neto DECIMAL, total_pvp DECIMAL, checked BOOL, opcional BOOL, detalles JSONB)
- contabilidad_proveedores(id, nombre, razon_social, email, telefono)
- maestro_destinos(id, nombre, nombre_comercial, locality, admin_area_l2, admin_area_l1, country)
- config_tipos_servicios(id, etiqueta, icono)

REGLAS PARA CONSULTAS HISTÓRICAS:
- Para buscar hoteles en una ciudad: JOIN maestro_destinos md ON md.id = ocl.destino WHERE md.locality ILIKE '%ciudad%' OR md.admin_area_l2 ILIKE '%ciudad%'
- Para buscar por proveedor: JOIN contabilidad_proveedores cp ON cp.id = ocl.proveedor
- Para cotizaciones aceptadas: WHERE oc.estado = 'aceptada'
- Para comparar precios históricos: GROUP BY cp.nombre ORDER BY AVG(ocl.neto) — usa neto para coste, pvp para precio venta
- El campo "descripcion" de la línea contiene el nombre del servicio (hotel, vuelo, etc.)
- NUNCA hagas UPDATE/DELETE/INSERT — solo SELECT`;
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { history, cotizacionId } = await req.json();

    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ success: false, error: "history requerido" }, { status: 400 });
    }

    const cotizacionContext = cotizacionId ? await buildCotizacionContext(cotizacionId) : "";

    // Inject the cotización context as a system override in the last user message
    // so runBiChat sees it via the campanaId extension mechanism
    const historyWithContext: ChatTurn[] = cotizacionContext
      ? history.map((m: ChatTurn, i: number) =>
          i === history.length - 1 && m.role === "user"
            ? { ...m, content: m.content }
            : m
        )
      : history;

    // Use runBiChat with a synthetic campanaId trick: pass context via a special prefix
    // We call runBiChat directly but override the system via the cotizacion context injection
    const response = await runBiChatCotizacion(historyWithContext, cotizacionContext);

    return NextResponse.json({ success: true, ...response });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── Tavily web search ────────────────────────────────────────────────────────

async function tavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: 5, include_answer: true }),
    });
    const data = await res.json();
    const answer = data.answer ? `Respuesta directa: ${data.answer}\n\n` : "";
    const snippets = (data.results ?? []).slice(0, 4).map((r: any) => `- ${r.title}: ${r.content?.slice(0, 200)}`).join("\n");
    return answer + snippets;
  } catch { return ""; }
}

const PLACES_LIST_KEYWORDS = [
  "listado de", "lista de", "dame restaurantes", "restaurantes en", "hoteles en", "actividades en",
  "bares en", "museos en", "lugares en", "sitios en", "qué restaurantes", "que restaurantes",
  "qué hoteles", "que hoteles", "mejores restaurantes", "mejores hoteles", "mejores lugares",
  "mejores sitios", "ordenados por", "ordenado por", "por valoraciones", "por precio",
  "busca restaurantes", "busca hoteles", "busca lugares", "busca actividades",
  "sitúalos en un mapa", "situalos en un mapa", "ponlos en un mapa", "muéstralos en un mapa",
  "muéstramelos en el mapa", "en el mapa", "ubícalos", "ubicalos",
];

function isPlacesListQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return PLACES_LIST_KEYWORDS.some(k => lower.includes(k));
}

function isWebQueryCotizacion(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("reseña") || lower.includes("valoración") || lower.includes("valoracion") ||
    lower.includes("opinión") || lower.includes("opinion") || lower.includes("opiniones") ||
    lower.includes("clima") || lower.includes("tiempo en") ||
    lower.includes("qué ver") || lower.includes("que ver") ||
    lower.includes("atracciones") || lower.includes("gastronomía") ||
    lower.includes("mejor época") || lower.includes("mejor epoca") ||
    lower.includes("busca en internet") || lower.includes("busca información") ||
    lower.includes("temporada") || lower.includes("cuándo ir") || lower.includes("cuando ir") ||
    lower.includes("qué tal es") || lower.includes("que tal es") ||
    lower.includes("cómo es el hotel") || lower.includes("como es el hotel") ||
    (lower.includes("problemas") && (lower.includes("hotel") || lower.includes("proveedor")))
  );
}

// Thin wrapper that injects cotización context into the bi-chat system prompt
async function runBiChatCotizacion(history: ChatTurn[], cotizacionContext: string) {
  const { getAgencyDbClient } = await import("@/lib/agencyDb");
  const { getAnthropicClient } = await import("@/lib/anthropic");

  const agenciaId = await getAgenciaId();
  const db = await getAgencyDbClient();
  const anthropic = await getAnthropicClient(agenciaId);

  // Import the system prompt logic from bi-chat by reconstructing what we need
  const todayStr = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const COTIZACION_SYSTEM = `Fecha actual: ${todayStr}.\n\nEres el Copilot de cotizaciones para una agencia de viajes. Tienes acceso a PostgreSQL (Supabase) para consultas históricas.

Tu misión principal es ayudar a optimizar la cotización activa (ver COTIZACIÓN ACTIVA más abajo). Cuando el usuario pregunta algo que requiere datos históricos (otros proveedores, precios pasados, hoteles en la misma ciudad en otras cotizaciones), genera SQL para obtenerlos.

TABLAS GENERALES DISPONIBLES:
- contabilidad_entidades(id, nombre, email, telefono, tipo_entidad, direccion JSONB)
- contabilidad_proveedores(id, nombre, razon_social, email, telefono)
- operativa_expedientes(id, referencia, entidad_id, agente_id, estado[abierto|confirmado|anulado|cerrado], fecha_inicio DATE, fecha_fin DATE)
- operativa_cotizaciones(id, expediente_id, contacto, titulo, pvp_viajero, plazas, free, coste_viajero, total_coste, total_ingresos, total_beneficio, margen_beneficio, estado[borrador|presentada|aceptada|rechazada], destinos JSONB, fecha_salida DATE, fecha_regreso DATE)
- operativa_cotizacion_lineas(id, cotizacion_id, tipo, descripcion, proveedor[FK→contabilidad_proveedores.id], destino[FK→maestro_destinos.id], plazas, noches, neto DECIMAL, pvp DECIMAL, total_neto DECIMAL, total_pvp DECIMAL, checked BOOL, opcional BOOL, detalles JSONB)
- maestro_destinos(id, nombre, nombre_comercial, locality, admin_area_l2, admin_area_l1, country)
- config_tipos_servicios(id, etiqueta, icono)

REGLAS SQL:
1. Genera SOLO SQL SELECT (nunca UPDATE/DELETE/INSERT).
2. Responde con JSON exacto (sin markdown):
   - Listas: {"type":"table","title":"...","columns":[],"rows":[],"idColumn":0,"entityType":"generic","sql":"...","summary":"..."}
   - Métricas: {"type":"text","summary":"respuesta en español","sql":"..."}
   - Gráficos: {"type":"chart","chartType":"bar|pie","title":"...","data":[],"sql":"...","summary":"..."}
3. Para preguntas sobre la cotización activa que NO necesiten SQL (márgenes, análisis de las líneas ya cargadas): {"type":"text","summary":"respuesta directa","sql":""}
4. rows siempre [] — el servidor ejecuta el SQL y rellena los datos reales.
5. Para hoteles en una ciudad: JOIN maestro_destinos md ON md.id = ocl.destino WHERE md.locality ILIKE '%ciudad%' OR md.admin_area_l2 ILIKE '%ciudad%'
6. Para comparar precios de proveedor: JOIN contabilidad_proveedores cp ON cp.id = ocl.proveedor GROUP BY cp.nombre, cp.id ORDER BY AVG(ocl.neto)
7. Responde siempre en español. Sé directo y concreto.
8. NUNCA inventes columnas o tablas que no están en el schema.

${cotizacionContext}`;

  const lastMsg = history.filter(m => m.role === "user").at(-1)?.content ?? "";

  // ── Places list branch: multi-place search via Google Places ────────────
  const MAP_FOLLOWUP = ["en el mapa", "sitúalo", "situalos", "sitúalos", "ponlos en", "ubícalos", "ubicalos", "muéstralos", "muéstramelos"];
  const isMapFollowup = MAP_FOLLOWUP.some(k => lastMsg.toLowerCase().includes(k));
  let placesQuery = isPlacesListQuery(lastMsg) ? lastMsg : null;
  if (!placesQuery && isMapFollowup) {
    // Try to find the previous user message that was a places query
    const prevUserMsgs = history.filter(m => m.role === "user").slice(0, -1).reverse();
    for (const m of prevUserMsgs) {
      if (isPlacesListQuery(m.content)) { placesQuery = m.content; break; }
    }
  }
  if (placesQuery) {
    const places = await searchPlacesText(placesQuery, 8);
    if (places.length > 0) {
      const first = places.find(p => p.lat != null && p.lng != null);
      const centerLat = first?.lat ?? null;
      const centerLng = first?.lng ?? null;
      const summary = `${places.length} lugar${places.length !== 1 ? "es" : ""} encontrado${places.length !== 1 ? "s" : ""}.`;
      return {
        summary,
        result: { type: "places_list", subject: placesQuery, places, centerLat, centerLng, summary },
        source: "web",
      };
    }
  }

  // ── Web search branch: answer directly from Tavily, no SQL needed ─────────
  if (isWebQueryCotizacion(lastMsg)) {
    const webContext = await tavilySearch(lastMsg);
    if (webContext) {
      const webResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: "Eres un asistente de cotizaciones de viajes. Responde en español usando el contexto web. Sé conciso y útil para una agencia de viajes.",
        messages: [{ role: "user", content: `Contexto web:\n${webContext}\n\nPregunta: ${lastMsg}` }],
      });
      const answer = webResponse.content[0].type === "text" ? webResponse.content[0].text : "";
      return { summary: answer, result: { type: "text", summary: answer } };
    }
  }

  // Call Claude to generate SQL or answer directly
  const sqlResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: COTIZACION_SYSTEM,
    messages: history.slice(-8).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  });

  const rawText = sqlResponse.content[0].type === "text" ? sqlResponse.content[0].text.trim() : "";

  let parsed: any;
  try {
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { summary: rawText, result: { type: "text", summary: rawText } };
  }

  const sql: string = parsed.sql ?? "";

  if (!sql || parsed.type === "text") {
    return { summary: parsed.summary ?? rawText, result: { type: "text", summary: parsed.summary ?? rawText } };
  }

  // Execute SQL
  let safeSQL = sql.trim().replace(/;+$/, "");
  if (!/^\s*(SELECT|WITH)\s/i.test(safeSQL)) {
    return { summary: "Solo se permiten consultas de lectura.", result: { type: "text", summary: "Solo se permiten consultas de lectura." } };
  }

  // Fix DISTINCT + ORDER BY conflict — only for outermost SELECT, not inside CTEs
  const isOuterDistinct = /^\s*SELECT\s+DISTINCT/i.test(safeSQL);
  if (isOuterDistinct && /\bORDER\s+BY\b/i.test(safeSQL)) {
    const orderMatch = safeSQL.match(/\bORDER\s+BY\b([\s\S]+)$/i);
    const withoutOrder = safeSQL.replace(/\bORDER\s+BY\b[\s\S]+$/i, "").trim();
    const orderClause = (orderMatch?.[1]?.trim() ?? "1").replace(/\b\w+\./g, "");
    safeSQL = `SELECT * FROM (${withoutOrder}) _dw ORDER BY ${orderClause}`;
  }

  let queryData: any[] = [];
  try {
    const { data, error } = await db.rpc("exec_bi_query", { query_sql: safeSQL }).maybeSingle();
    if (error) throw error;
    if (Array.isArray(data)) {
      queryData = data;
    } else if (data && typeof data === "object" && "rows" in data && Array.isArray((data as { rows: unknown }).rows)) {
      queryData = (data as { rows: any[] }).rows;
    }
    else if (data && typeof data === "object") {
      const keys = Object.keys(data);
      const first = (data as Record<string, unknown>)[keys[0]];
      queryData = Array.isArray(first) ? first : [];
    }
  } catch (dbErr: any) {
    return { summary: `Error al ejecutar la consulta: ${dbErr.message}`, result: { type: "text", summary: parsed.summary } };
  }

  if (parsed.type === "chart") {
    const data = queryData.map((row: any) => {
      const keys = Object.keys(row);
      return { name: String(row[keys[0]] ?? ""), value: Number(row[keys[1]] ?? 0) };
    });
    return { summary: parsed.summary, result: { type: "chart", chartType: parsed.chartType ?? "bar", title: parsed.title ?? "", data, summary: parsed.summary } };
  }

  // table
  const cols: string[] = queryData.length > 0 ? Object.keys(queryData[0]) : (parsed.columns ?? []);
  const rows = queryData.map((row: any) => cols.map((col) => row[col] ?? null));
  const idColIndex = cols.findIndex((c) => c.toLowerCase() === "id");
  const factualSummary = rows.length > 0
    ? parsed.summary
    : parsed.summary || `0 resultados encontrados.`;

  return {
    summary: factualSummary,
    result: { type: "table", title: parsed.title ?? "Resultados", columns: cols, rows, idColumn: idColIndex >= 0 ? idColIndex : undefined, entityType: parsed.entityType ?? "generic", summary: factualSummary },
  };
}
