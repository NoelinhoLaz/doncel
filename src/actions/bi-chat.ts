"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AIResult {
  type: "table" | "chart" | "text";
  title?: string;
  columns?: string[];
  rows?: (string | number | null)[][];
  idColumn?: number;
  entityType?: string;
  chartType?: "bar" | "pie";
  data?: { name: string; value: number }[];
  summary: string;
}

export interface BIChatResponse {
  summary: string;
  result?: AIResult;
  extra?: AIResult;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAgenciaId(): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) return "";
  const svc = createAdminServiceClient();
  const { data } = await svc.from("usuarios").select("agencia_id").eq("auth_user_id", user.id).single();
  return data?.agencia_id ?? "";
}

// ─── System prompt (cached by Anthropic after first call, ~400 tokens) ────────

const SYSTEM_PROMPT = `Eres un asistente BI para una agencia de viajes. Acceso a PostgreSQL (Supabase).

TABLAS PRINCIPALES:
- contabilidad_entidades(id, nombre, email, telefono, tipo_entidad[persona|organizacion|empresa], direccion JSONB)
  -- direccion contiene: direccion->>'localidad', direccion->>'provincia', direccion->>'cp', direccion->>'calle'
  -- Para obtener ciudad: COALESCE(ce.direccion->>'ciudad', ce.direccion->>'localidad', ce.direccion->>'municipio', '')
  -- Para filtrar por ciudad: LOWER(TRIM(COALESCE(ce.direccion->>'ciudad', ce.direccion->>'localidad', ce.direccion->>'municipio', ''))) ILIKE '%texto%'
  -- CRÍTICO sintaxis: COALESCE va DENTRO de LOWER(TRIM(...)): LOWER(TRIM(COALESCE(campo1, campo2, ''))) — NUNCA LOWER(TRIM(campo1 COALESCE campo2))
  -- Para cruzar por ciudad: LOWER(TRIM(COALESCE(ce1.direccion->>'ciudad', ce1.direccion->>'localidad', ''))) = LOWER(TRIM(COALESCE(ce2.direccion->>'ciudad', ce2.direccion->>'localidad', '')))
  -- IMPORTANTE: filtrar por comunidad/provincia usar direccion->>'provincia' ILIKE '%Madrid%' — NO filtrar por localidad='Madrid' porque los centros están en municipios de la comunidad, no solo en Madrid ciudad
- contabilidad_entidades_emails(entidad_id, email, es_principal)
- crm_oportunidades(id, titulo, descripcion, campana_id, entidad_id, agente_id, estado_id, valor_estimado, fecha_cierre_est, created_at)
- crm_campanas_estados(id, campana_id, nombre, es_ganado) — estados: "Pdt. Visitar","Visitando","Pdt. Cotizar","Cotizado","Revisión","Aceptado","Denegado","Imp. Cotizar"
- crm_contactos(id, entidad_id, nombre, cargo, email, telefono, activo) — responsables de centros
  -- buscar contactos/responsable de un centro: JOIN contabilidad_entidades ce ON ce.id = cc.entidad_id WHERE ce.nombre ILIKE '%nombre_centro%'
  -- NUNCA buscar contactos por direccion JSONB ni por ciudad — buscar SIEMPRE por ce.nombre ILIKE
- crm_campanas(id, nombre, estado, fecha_inicio, fecha_fin)
- crm_agentes(id, nombre, apellidos)
- crm_campanas_agentes(campana_id, agente_id, objetivo_valor)
- operativa_expedientes(id, referencia, entidad_id, agente_id, oportunidad_id, estado[abierto|confirmado|anulado|cerrado], pvp_total DECIMAL, fecha_inicio DATE, fecha_fin DATE, created_at)
  -- oportunidad_id → crm_oportunidades.id (puente entre operativa y CRM)
  -- pvp_total = importe total del viaje facturado/presupuestado
  -- Para filtrar por año escolar: fecha_inicio BETWEEN 'YYYY-09-01' AND 'YYYY+1-07-31'
- operativa_cotizaciones(id, expediente_id, titulo, estado[borrador|presentada|aceptada|rechazada], plazas, pvp_viajero, fecha_salida DATE, fecha_regreso DATE)
- operativa_cotizacion_lineas(id, cotizacion_id, descripcion, proveedor[FK→contabilidad_proveedores.id], neto, pvp, plazas, noches, total_neto, total_pvp, opcional BOOL, checked BOOL)
  -- contabilidad_proveedores(id, nombre, razon_social, email, telefono)
  -- Para buscar servicios cotizados por nombre de proveedor o descripción de línea:
  --   JOIN operativa_cotizacion_lineas ocl ON ocl.cotizacion_id = oc.id
  --   JOIN contabilidad_proveedores cp ON cp.id = ocl.proveedor
  --   WHERE ocl.descripcion ILIKE '%texto%' OR cp.nombre ILIKE '%texto%' OR cp.razon_social ILIKE '%texto%'
  -- NUNCA buscar servicios cotizados en crm_oportunidades.descripcion — eso son notas comerciales, no líneas de servicio
- facturas_emitidas(id, expediente_id, importe_total, fecha_emision) — facturas reales emitidas
- contabilidad_movimientos_banco(id, cuenta_bancaria_id[FK→config_cuentas_bancarias.id], fecha_operacion DATE, importe DECIMAL — negativo=salida/pago positivo=entrada/cobro, concepto_limpio, concepto_original, estado[pendiente|propuesto|conciliado|descartado|futuro], match_score DECIMAL 0-100, conciliacion_tipo[automatica|manual], conciliado_at TIMESTAMP, origen[bridge|n43], deleted BOOL)
- config_cuentas_bancarias(id, banco VARCHAR, iban VARCHAR, oficina_id FK→config_oficinas.id, descripcion VARCHAR, activa BOOL)
- config_oficinas(id, nombre VARCHAR) — contiene el nombre de la sucursal/ciudad (ej: "Alcalá de Henares", "Madrid")
- para filtrar por ciudad/sucursal: JOIN config_oficinas co ON co.id = cb.oficina_id WHERE co.nombre ILIKE '%alcala%'
- ejemplo JOIN completo: FROM contabilidad_movimientos_banco cmb JOIN config_cuentas_bancarias cb ON cb.id = cmb.cuenta_bancaria_id JOIN config_oficinas co ON co.id = cb.oficina_id

CAMPOS CLAVE (no inventar columnas que no existen):
- crm_oportunidades.descripcion → observaciones, motivo de pérdida, notas del agente sobre la oportunidad
- crm_oportunidades_estados_log(oportunidad_id, estado_anterior_id, estado_nuevo_id, cambiado_por, notas, created_at) → historial completo de cambios de estado con timestamp
- crm_campanas.fecha_fin → fecha de cierre de la campaña
- "centros" = contabilidad_entidades — NO filtrar por tipo_entidad, los colegios pueden estar registrados como cualquier tipo
- "responsables" = crm_contactos vinculados a un centro vía entidad_id
- "sin motivo" = descripcion IS NULL OR descripcion = ''
- "email genérico" = email ILIKE ANY(ARRAY['info@%','secretaria@%','contacto@%','admin@%','colegio@%','centro@%'])
- objetivo global campaña = SUM(objetivo_valor) FROM crm_campanas_agentes WHERE campana_id=X
- buscar agentes SIEMPRE con ILIKE: (ca.nombre ILIKE '%texto%' OR ca.apellidos ILIKE '%texto%')
- buscar centros/entidades por nombre: SIEMPRE ce.nombre ILIKE '%texto%' — si el nombre tiene puntos (ej: "J.A.B.Y") buscar tal cual: ce.nombre ILIKE '%J.A.B.Y%'
- crm_oportunidades.agente_id es tipo TEXT — para JOIN con crm_agentes.id (UUID) usar siempre: JOIN crm_agentes ca ON ca.id = co.agente_id::uuid
- con SELECT DISTINCT, ORDER BY solo puede usar alias del SELECT (nunca columnas crudas de tablas). Usa alias: ORDER BY agente, centro — no ORDER BY ca.nombre, ce.nombre
- los alias de columna con espacios o caracteres especiales SIEMPRE con comillas dobles: AS "Importe 2024/25" — NUNCA comillas simples para alias
- "estados intermedios" = JOIN crm_campanas_estados WHERE es_ganado=false AND es_final=false
- historial de cambios de estado → usar crm_oportunidades_estados_log JOIN crm_campanas_estados
- fecha de cierre campaña → SELECT fecha_fin FROM crm_campanas WHERE id=X
- importe real de un viaje/oportunidad = crm_oportunidades.valor_estimado (pvp_total en operativa_expedientes suele estar NULL en histórico — no usarlo para análisis de facturación pasada)
- cruce histórico por colegio: usar CTEs en este orden exacto:
  1. campana_anterior AS (SELECT id FROM crm_campanas WHERE fecha_inicio < CURRENT_DATE - INTERVAL '10 months' ORDER BY fecha_inicio DESC LIMIT 1)
  2. ganados_anterior AS (SELECT co.entidad_id, co.valor_estimado FROM crm_oportunidades co JOIN crm_campanas_estados cce ON co.estado_id = cce.id WHERE co.campana_id = (SELECT id FROM campana_anterior) AND cce.es_ganado = true AND co.valor_estimado > N)
  3. SELECT final JOIN ganados_anterior con crm_oportunidades de la campaña actual filtrando por estado
  NUNCA hacer doble JOIN directo sobre crm_oportunidades sin CTEs — produce 0 resultados por ambigüedad
- campaña anterior = crm_campanas WHERE fecha_inicio < CURRENT_DATE - INTERVAL '10 months' ORDER BY fecha_inicio DESC LIMIT 1 — NO usar nombre de campaña hardcodeado
- "año pasado" en contexto escolar = fecha_inicio BETWEEN (EXTRACT(YEAR FROM CURRENT_DATE)-1 || '-09-01')::date AND (EXTRACT(YEAR FROM CURRENT_DATE) || '-07-31')::date — calcúlalo dinámicamente, nunca preguntes al usuario qué año es
- NUNCA pidas confirmación de fechas ni de interpretaciones obvias. Asume siempre el año escolar más reciente y ejecuta directamente.
- días estancado en un estado = EXTRACT(DAY FROM NOW() - co.created_at)::INT — usar SIEMPRE co.created_at, NUNCA cruzar con crm_oportunidades_estados_log para calcular días (el log puede estar vacío y produce 0 resultados)
- NO existen columnas: competidor, prioridad, observaciones, año_escolar. No las uses nunca.

REGLAS BANCO (usar cuando la pregunta sea sobre movimientos, conciliación, flujo de caja):
- SIEMPRE filtrar deleted=false: WHERE cmb.deleted = false
- "sin conciliar" / "pendiente" = estado IN ('pendiente','propuesto')
- "ingreso" / "cobro" / "haber" = importe > 0
- "gasto" / "pago" / "debe" = importe < 0
- días sin conciliar = EXTRACT(DAY FROM NOW() - cmb.fecha_operacion)::INT
- flujo neto = SUM(importe) — positivo=superávit, negativo=déficit
- duplicados: mismo importe Y misma fecha_operacion Y mismo concepto_limpio con COUNT > 1
- match_score: bajo 60-79, medio 80-90, alto >90
- para listar movimientos incluir: id, fecha_operacion, concepto_limpio, importe, estado, cb.banco
- buscar por nombre/empresa en movimientos: usar SIEMPRE unaccent(cmb.concepto_original) ILIKE unaccent('%texto%') OR unaccent(cmb.concepto_limpio) ILIKE unaccent('%texto%') — NUNCA igualdad exacta, NUNCA ILIKE sin unaccent (los datos están en mayúsculas sin tildes)
- el campo concepto_original contiene el texto completo del banco (ej: "TRANSFERENCIA A FAVOR DE NEGO SERVICIOS CONCEPTO: ...") — es el más fiable para búsquedas por nombre
- TIPOS DE MOVIMIENTO por codigo_operacion (campo N43): 071=transferencias recibidas de clientes, 135=liquidaciones TPV/tarjetas, 043=ingresos en efectivo/cajero, 001=otros abonos/liquidaciones
- "ingresos bancarios propios" / "liquidaciones" = codigo_operacion IN ('135','001','043')
- "cobros de clientes" / "transferencias recibidas" = codigo_operacion = '071'
- "ingresos físicos" / "efectivo" / "cajero" / "no transferencias" / "sin transferencias" = codigo_operacion IN ('043','001')
- "liquidaciones TPV" / "tarjetas" / "datáfono" = codigo_operacion = '135'
- "solo transferencias" / "transferencias de clientes" = codigo_operacion = '071'
- "ingresos" a secas = importe > 0 (todos los positivos)
- CRÍTICO LISTADOS: en cualquier listado/tabla de movimientos SIEMPRE aplica el filtro de dirección según lo que pida el usuario:
  * "ingresos" / "cobros" / "entradas" → AND cmb.importe > 0  (OBLIGATORIO, sin excepción)
  * "pagos" / "gastos" / "salidas" / "transferencias realizadas" → AND cmb.importe < 0  (OBLIGATORIO)
  * "todos los movimientos" / "todos" / sin especificar → sin filtro de importe
  Ejemplo correcto para "ingresos bancarios cuenta Alcalá": WHERE cmb.deleted=false AND cmb.importe > 0 AND cb.iban ILIKE '%alcala%'
  Ejemplo incorrecto (PROHIBIDO): WHERE cmb.deleted=false AND cb.iban ILIKE '%alcala%'  ← falta el filtro importe
- para métricas (¿cuántos?, ¿cuánto?, total, suma) → usar type:text con COUNT(*) o SUM() sin campo id — NO generar tabla
- cuando el usuario pida "listado", "dame los", "muéstrame" → SIEMPRE type:table con las filas reales, NUNCA type:text
- ejemplo métrica: {"type":"text","summary":"Hay N movimientos sin conciliar.","sql":"SELECT COUNT(*) AS total FROM contabilidad_movimientos_banco WHERE deleted=false AND estado IN ('pendiente','propuesto') AND fecha_operacion < CURRENT_DATE - INTERVAL '15 days'"}
- NUNCA uses años hardcodeados (2024, 2025…). Siempre: EXTRACT(YEAR FROM fecha_operacion) = EXTRACT(YEAR FROM CURRENT_DATE) para "este año", o fecha_operacion >= DATE_TRUNC('year', CURRENT_DATE)

REGLAS:
1. Genera SOLO SQL SELECT (nunca UPDATE/DELETE/INSERT).
2. Responde con JSON exacto (sin markdown, sin texto extra):
   - Para listas: {"type":"table","title":"...","columns":["col1","col2"],"rows":[],"idColumn":0,"entityType":"centro|oportunidad|generic","sql":"...","summary":"..."}
   - Para comparativas: {"type":"chart","chartType":"bar|pie","title":"...","data":[],"sql":"...","summary":"..."}
   - Para métricas únicas: {"type":"text","summary":"La respuesta en lenguaje natural.","sql":"..."}
   - Cuando el usuario pida explícitamente "tabla", "listado", "detalle" O pida "gráfico", "chart", "barras", "distribución" junto a una tabla: incluye "extraSql" con SELECT agente AS name, SUM(valor)::BIGINT AS value ... GROUP BY agente ORDER BY value DESC, y "extraChartType":"bar"/"pie", "extraTitle":"...". Si el usuario solo pide un número o métrica, NO incluyas extraSql.
3. Incluye siempre el campo "id" en las tablas para el botón de navegación (es idColumn:0).
4. En "summary" escribe la respuesta en lenguaje natural en español, concisa. No digas "no se encontraron registros" antes de ejecutar.
   CRÍTICO: en "rows" pon SIEMPRE un array vacío []. NUNCA inventes filas con datos de ejemplo o placeholders. El servidor ejecutará el SQL y llenará los datos reales.
5. Si la pregunta referencia datos que no existen en el schema (competidor, prioridad, etc.) dilo explícitamente en summary indicando qué campo falta.
6. NUNCA inventes nombres de tabla o columna. Usa EXACTAMENTE los del schema.
7. Si recibes un bloque [CONTEXTO WEB RELEVANTE], úsalo para enriquecer tu respuesta. Si el contexto web responde completamente la pregunta sin necesidad de SQL, devuelve {"type":"text","summary":"respuesta en español","sql":""} — SIEMPRE en JSON puro, nunca con texto antes o después.
8. Escribe SQL lo más compacto posible: máximo 6 columnas, sin LEFT JOINs innecesarios, sin columnas de email ni teléfono salvo que se pidan explícitamente. Prioriza que el SQL quepa completo en la respuesta.`;

// ─── Tavily web search ────────────────────────────────────────────────────────

async function tavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      }),
    });
    const data = await res.json();
    const answer = data.answer ? `Respuesta directa: ${data.answer}\n\n` : "";
    const snippets = (data.results ?? [])
      .slice(0, 4)
      .map((r: any) => `- ${r.title}: ${r.content?.slice(0, 200)}`)
      .join("\n");
    return answer + snippets;
  } catch (e) {
    console.error("[tavily] error:", e);
    return "";
  }
}

function isWebQuery(text: string): boolean {
  const lower = text.toLowerCase();
  if (isGeoProspectingQuery(text)) return false;

  // Explicit DB/internal keywords → NOT a web query
  const isInternalQuery = (
    lower.includes("campaña") || lower.includes("oportunidad") ||
    lower.includes("agente") || lower.includes("colegio") ||
    lower.includes("expediente") || lower.includes("cotizacion") ||
    lower.includes("cotización") || lower.includes("banco") ||
    lower.includes("movimiento") || lower.includes("concilia") ||
    lower.includes("factura") || lower.includes("presupuesto") ||
    lower.includes("cuántos tenemos") || lower.includes("cuántas tenemos") ||
    lower.includes("base de datos") || lower.includes("en la bd") ||
    lower.includes("ranking") || lower.includes("análisis de") ||
    lower.includes("analisis de") || lower.includes("mis datos") ||
    lower.includes("nuestros datos") || lower.includes("nuestra agencia")
  );
  if (isInternalQuery) return false;

  // Everything else that isn't clearly a SQL/DB question → web
  return true;
}

// ─── Nominatim geo search ─────────────────────────────────────────────────────

interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

async function searchSchoolsNearLocation(location: string, originalQuery: string = ""): Promise<{
  found: { nombre: string; direccion: string; lat: number; lon: number }[];
  locationName: string;
} | null> {
  try {
    // Step 1: geocode the location
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&countrycodes=es&accept-language=es`;
    console.log("[nominatim] geocode URL:", geoUrl);
    const geoRes = await fetch(geoUrl, { headers: { "User-Agent": "momo-crm/1.0 hola@kanso.consulting", "Accept-Language": "es" } });
    const geoData: NominatimPlace[] = await geoRes.json();
    console.log("[nominatim] geocode result:", JSON.stringify(geoData).slice(0, 200));
    if (!geoData.length) return null;

    const { lat, lon, display_name } = geoData[0];
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);

    // Step 2: search amenity=school in ~3km radius using overpass-style nominatim search
    // Use viewbox ~0.05 degrees (~5km) around the point
    const delta = 0.045;
    const viewbox = `${lonN - delta},${latN + delta},${lonN + delta},${latN - delta}`;
    const schoolUrl = `https://nominatim.openstreetmap.org/search?amenity=school&format=json&limit=50&countrycodes=es&viewbox=${viewbox}&bounded=1`;
    await new Promise(r => setTimeout(r, 1100)); // respect 1 req/s rate limit
    const schoolRes = await fetch(schoolUrl, { headers: { "User-Agent": "momo-crm/1.0 hola@kanso.consulting" } });
    const schools: NominatimPlace[] = await schoolRes.json();

    const queryLower = originalQuery.toLowerCase();
    const excludeInfantil = queryLower.includes("no infantil") || queryLower.includes("sin infantil") || queryLower.includes("no sean de educacion infantil") || queryLower.includes("no sean infantil") || queryLower.includes("secundaria") || queryLower.includes("bachiller") || queryLower.includes("eso");
    const EXCLUDE_KEYWORDS = [
      "calle ", "paseo ", "avenida ", "plaza ", "adultos", "orientación", "robótica",
      "academia", "universidad", "formación profesional", "hostelería", "turismo", "especial",
      ...(excludeInfantil ? ["infantil", "primaria"] : []),
    ];
    const found = schools
      .map(s => ({
        nombre: s.display_name.split(",")[0].trim(),
        direccion: s.display_name,
        lat: parseFloat(s.lat),
        lon: parseFloat(s.lon),
      }))
      .filter(s => {
        const n = s.nombre.toLowerCase();
        // exclude non-school results and pure infantil centers
        if (EXCLUDE_KEYWORDS.some(k => n.startsWith(k))) return false;
        // keep if it has secondary/bachiller/concertado indicators or is a generic colegio/instituto
        return true;
      });

    return { found, locationName: display_name.split(",").slice(0, 2).join(",") };
  } catch (e) {
    console.error("[bi-chat] Nominatim error:", e);
    return null;
  }
}

function isGeoProspectingQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const hasLocation = lower.includes("cerca") || lower.includes("zona") || lower.includes("alrededor") || lower.includes("próximo") || lower.includes("proximo") || lower.includes("busca");
  const hasSchool = lower.includes("colegio") || lower.includes("centro") || lower.includes("instituto") || lower.includes("escuela") || lower.includes("ies") || lower.includes("ceip");
  const hasProspect = lower.includes("no tenemos") || lower.includes("no tengamos") || lower.includes("no están") || lower.includes("no estan") || lower.includes("no estén") || lower.includes("prospecto") || lower.includes("nuevos") || lower.includes("añadir") || lower.includes("base de datos") || lower.includes("bd");
  return hasLocation && hasSchool && hasProspect;
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function runBiChat(
  history: ChatTurn[],
  campanaId?: string
): Promise<BIChatResponse> {
  const db = await getAgencyDbClient();
  const agenciaId = await getAgenciaId();
  const anthropic = await getAnthropicClient(agenciaId);

  // ─── Geo prospecting branch ───────────────────────────────────────────────
  const lastUserText = history.filter(m => m.role === "user").at(-1)?.content ?? "";
  if (isGeoProspectingQuery(lastUserText)) {
    // Extract location from the query using a simple heuristic: text after "cerca de" / "en"
    const locMatch = lastUserText.match(/(?:cerca de|en la zona de|alrededor de|zona de|en)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s+que|\s+sin|\s+no|\s*[,?.]|$)/i);
    const location = (locMatch?.[1]?.trim() ?? lastUserText.slice(0, 60)) + ", España";

    const geo = await searchSchoolsNearLocation(location, lastUserText);
    if (!geo) {
      return { summary: `No pude geocodificar la ubicación "${location}". Intenta con una dirección más concreta.`, result: { type: "text", summary: "" } };
    }

    if (geo.found.length === 0) {
      return { summary: `No encontré centros educativos cerca de ${geo.locationName} en OpenStreetMap.`, result: { type: "text", summary: "" } };
    }

    // Cross-reference with BD via RPC to find which names already exist
    const safeNames = geo.found.map(s => s.nombre.replace(/'/g, "''"));
    const checkSQL = `SELECT nombre FROM contabilidad_entidades WHERE ${safeNames.map(n => `nombre ILIKE '%${n}%'`).join(" OR ")}`;
    const { data: matchData } = await db.rpc("exec_bi_query", { query_sql: checkSQL }).maybeSingle();
    const matchRows = (matchData && typeof matchData === "object" && "rows" in matchData && Array.isArray((matchData as { rows: unknown }).rows))
      ? ((matchData as { rows: { nombre: string }[] }).rows)
      : [];
    const existingNombres = new Set(matchRows.map((r) => r.nombre.toLowerCase()));

    const nuevos = geo.found.filter(s => {
      const n = s.nombre.toLowerCase();
      return !Array.from(existingNombres).some(e => e.includes(n) || n.includes(e.split(" ").slice(0, 3).join(" ")));
    });

    const cols = ["nombre", "direccion"];
    const rows = nuevos.map(s => {
      const parts = s.direccion.split(",").map(p => p.trim()).slice(1);
      // Nominatim sometimes puts the number before the street — reorder if first part is a number
      const isNum = (p: string) => /^\d+$/.test(p);
      let streetParts = parts.slice(0, 3);
      if (streetParts.length >= 2 && isNum(streetParts[0])) {
        streetParts = [streetParts[1], streetParts[0], ...streetParts.slice(2)];
      }
      const dir = streetParts.join(", ");
      return [s.nombre, dir] as (string | number | null)[];
    });

    return {
      summary: `Encontré ${geo.found.length} centros educativos cerca de ${geo.locationName}. De ellos, ${nuevos.length} no están en tu base de datos como oportunidades o prospectos.`,
      result: {
        type: "table",
        title: `Centros nuevos cerca de ${geo.locationName}`,
        columns: cols,
        rows,
        entityType: "generic",
        summary: `${nuevos.length} centros sin registrar`,
      },
    };
  }

  // ─── Web search branch ────────────────────────────────────────────────────
  // Detect if query needs web context AND also references DB data (hybrid query)
  const isHybrid = isWebQuery(lastUserText) && (
    lastUserText.toLowerCase().includes("colegio") ||
    lastUserText.toLowerCase().includes("centro") ||
    lastUserText.toLowerCase().includes("oportunidad") ||
    lastUserText.toLowerCase().includes("agente") ||
    lastUserText.toLowerCase().includes("campaña") ||
    lastUserText.toLowerCase().includes("base de datos") ||
    lastUserText.toLowerCase().includes("tenemos")
  );
  console.log("[bi-chat] isWebQuery:", isWebQuery(lastUserText), "isHybrid:", isHybrid, "text:", lastUserText.slice(0, 80));
  let webContextInjection = "";
  if (isWebQuery(lastUserText)) {
    const webContext = await tavilySearch(lastUserText);
    console.log("[bi-chat] webContext length:", webContext.length, webContext.slice(0, 200));
    if (isHybrid && webContext) {
      webContextInjection = `\n\n[CONTEXTO WEB RELEVANTE]:\n${webContext}\n\nUsa esta información para construir el SQL que responda la pregunta cruzando con los datos de la BD.`;
    } else if (!isHybrid) {
      // Pure web / general question — answer directly without SQL
      const todayForWeb = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      const contextBlock = webContext ? `Contexto web:\n${webContext}\n\n` : "";
      const webResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `Eres un asistente de una agencia de viajes. Fecha actual: ${todayForWeb}. Responde en español, de forma concisa y útil para un agente de viajes.`,
        messages: [{ role: "user", content: `${contextBlock}Pregunta: ${lastUserText}` }],
      });
      const answer = webResponse.content[0].type === "text" ? webResponse.content[0].text : "";
      return { summary: answer, result: { type: "text", summary: answer } };
    }
  }

  // Optionally inject campaign context into the last user message
  const todayStr = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  let systemWithContext = SYSTEM_PROMPT + `\n\nFECHA ACTUAL: Hoy es ${todayStr}. Usa esta fecha como referencia para cualquier pregunta sobre "hoy", "este mes", "este año", etc.`;
  if (campanaId) {
    const [{ data: campana }, { count: logCount }] = await Promise.all([
      db
        .from("crm_campanas")
        .select(`
          id, nombre, fecha_inicio, fecha_fin,
          crm_campanas_estados(id, nombre, es_ganado, es_final),
          crm_campanas_agentes(objetivo_valor, crm_agentes!crm_campanas_agentes_agente_id_fkey(id, nombre, apellidos))
        `)
        .eq("id", campanaId)
        .single(),
      db
        .from("crm_oportunidades_estados_log")
        .select("id", { count: "exact", head: true })
        .limit(1),
    ]);

    if (campana) {
      const agentesRaw = (campana.crm_campanas_agentes as any[]) ?? [];
      const objetivoTotal = agentesRaw.reduce((s: number, a: any) => s + (Number(a.objetivo_valor) || 0), 0);
      const estados = (campana.crm_campanas_estados as any[])
        ?.map((e: any) => `"${e.nombre}"${e.es_ganado ? "(ganado)" : e.es_final ? "(final)" : ""}`)
        .join(", ") ?? "";
      const agentes = agentesRaw
        .map((a: any) => {
          const ag = a.crm_agentes;
          return ag ? `${ag.nombre}${ag.apellidos ? " " + ag.apellidos : ""} (id:${ag.id})` : null;
        })
        .filter(Boolean)
        .join(", ");

      const fechaFin = (campana as any).fecha_fin ?? null;
      const fechaInicio = (campana as any).fecha_inicio ?? null;
      const hayLogEstados = (logCount ?? 0) > 0;

      systemWithContext += `\n\nCAMPAÑA ACTIVA: "${campana.nombre}" (id: ${campana.id})
Fecha inicio: ${fechaInicio ?? "no definida"}
Fecha fin/cierre: ${fechaFin ?? "no definida"}
Estados disponibles: ${estados}
Agentes en esta campaña: ${agentes || "ninguno"}
Objetivo global: ${objetivoTotal.toLocaleString("es-ES")}€
Tabla crm_oportunidades_estados_log: ${hayLogEstados ? "TIENE DATOS — úsala para consultas de historial de cambios de estado" : "vacía o sin datos aún"}
Cuando el usuario diga "la campaña" o "esta campaña" usa campana_id = '${campana.id}'.
Para filtrar por agente usa su id directamente (más fiable que buscar por nombre).`;
    }
  }

  // ─── Banco direction filter injection ────────────────────────────────────────
  // Inject an explicit importe filter reminder into any banco listado query
  // so Claude always applies the correct WHERE clause.
  let bancoFollowupHint = "";
  const isBancoListado = /\b(listado|detalle|movimientos|dame los?|muéstrame|listarlos?|ver todos?|ingresos|cobros|pagos|gastos)\b/i.test(lastUserText);
  if (isBancoListado) {
    // Check current message AND previous messages for direction keywords
    const allUserText = history.filter(m => m.role === "user").map(m => m.content).join(" ").toLowerCase();
    if (/\b(ingresos?|cobros?|haber|entradas?)\b/.test(allUserText)) {
      bancoFollowupHint = "\n\n[FILTRO OBLIGATORIO: esta consulta es sobre INGRESOS — el SQL DEBE incluir AND cmb.importe > 0 en el WHERE. Sin esta condición la respuesta es incorrecta.]";
    } else if (/\b(pagos?|gastos?|debe|salidas?|transferencias realizadas?)\b/.test(allUserText)) {
      bancoFollowupHint = "\n\n[FILTRO OBLIGATORIO: esta consulta es sobre PAGOS/GASTOS — el SQL DEBE incluir AND cmb.importe < 0 en el WHERE. Sin esta condición la respuesta es incorrecta.]";
    }
  }

  // Step 1: Claude generates SQL (~300 tokens in, ~150 out)
  const claudeMessages = history.map((t, i) => ({
    role: t.role as "user" | "assistant",
    // Inject web context and banco follow-up hint into the last user message
    content: (i === history.length - 1 && t.role === "user" && (webContextInjection || bancoFollowupHint))
      ? t.content + (webContextInjection ?? "") + bancoFollowupHint
      : t.content,
  }));

  const sqlResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: systemWithContext,
    messages: claudeMessages,
  });

  const rawText = sqlResponse.content[0].type === "text" ? sqlResponse.content[0].text.trim() : "";
  console.log("[bi-chat] Claude raw response:", rawText.slice(0, 800));

  // Helper: detect if a string looks like raw JSON (should never be shown to user)
  function looksLikeJson(s: string) {
    const t = s.trim();
    return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
  }

  // Parse the JSON response from Claude
  // Claude sometimes adds prose before/after the JSON — extract the JSON object robustly
  let parsed: any;
  try {
    // 1. Strip ```json fences
    let cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    // 2. If there's text before the first '{', extract just the JSON object
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart > 0 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[bi-chat] JSON parse failed. Raw response:", rawText.slice(0, 300));
    // Return the prose text (stripping any embedded JSON block)
    const withoutJson = rawText.replace(/\{[\s\S]*\}/g, "").trim();
    const safeText = withoutJson || "No he podido procesar la consulta. Intenta reformularla.";
    return { summary: safeText, result: { type: "text", summary: safeText } };
  }

  const sql: string = parsed.sql ?? "";

  // Sanitize summary: never expose raw JSON to the user
  function safeSummary(s: string | undefined): string {
    if (!s) return "Procesando...";
    return looksLikeJson(s) ? "Analizando datos, por favor espera..." : s;
  }

  // Step 2: Execute SQL if present — always run SQL even for type:text (metrics/counts)
  if (!sql) {
    const summary = safeSummary(parsed.summary ?? rawText);
    return {
      summary,
      result: { type: "text", summary },
    };
  }

  // Safety: only allow SELECT — strip trailing semicolon (breaks EXECUTE format inside RPC)
  // Fix DISTINCT + ORDER BY conflict by wrapping in subquery
  let safeSQL = sql.trim().replace(/;+$/, "");
  // Fix malformed LOWER(TRIM(field COALESCE ...)) — LLM sometimes drops the opening COALESCE(
  // Pattern: LOWER(TRIM(expr COALESCE ...)) → LOWER(TRIM(COALESCE(expr, ...)))
  safeSQL = safeSQL.replace(/LOWER\s*\(\s*TRIM\s*\(\s*([^,)]+?)\s+COALESCE\s+([^)]+)\)\s*\)/gi, (_, first, rest) => {
    return `LOWER(TRIM(COALESCE(${first}, ${rest})))`;
  });
  // Only wrap SELECT DISTINCT when it's the outermost SELECT (not inside a CTE).
  // CTEs start with WITH — wrapping them breaks the syntax.
  const isOuterDistinct = /^\s*SELECT\s+DISTINCT/i.test(safeSQL);
  if (isOuterDistinct && /\bORDER\s+BY\b/i.test(safeSQL)) {
    const orderMatch = safeSQL.match(/\bORDER\s+BY\b([\s\S]+)$/i);
    const withoutOrder = safeSQL.replace(/\bORDER\s+BY\b[\s\S]+$/i, "").trim();
    const orderClause = (orderMatch?.[1]?.trim() ?? "1").replace(/\b\w+\./g, "");
    safeSQL = `SELECT * FROM (${withoutOrder}) _distinct_wrapper ORDER BY ${orderClause}`;
  }
  console.log("[bi-chat] safeSQL:", safeSQL.slice(0, 600));
  if (!/^\s*(SELECT|WITH)\s/i.test(safeSQL)) {
    return { summary: "Solo se permiten consultas de lectura.", result: { type: "text", summary: "Solo se permiten consultas de lectura." } };
  }

  let queryData: any[] = [];
  try {
    const { data, error } = await db.rpc("exec_bi_query", { query_sql: safeSQL }).maybeSingle();
    if (error) throw error;
    console.log("[bi-chat] RPC raw data:", JSON.stringify(data)?.slice(0, 500));
    // exec_bi_query returns { rows: [...] } as jsonb
    // Supabase may return it as-is or nested depending on the client version
    if (Array.isArray(data)) {
      queryData = data;
    } else if (data && typeof data === "object" && "rows" in data && Array.isArray((data as { rows: unknown }).rows)) {
      queryData = (data as { rows: any[] }).rows;
    } else if (data && typeof data === "object") {
      // Sometimes Supabase wraps the jsonb response differently
      const keys = Object.keys(data);
      const firstVal = (data as Record<string, unknown>)[keys[0]];
      queryData = Array.isArray(firstVal) ? firstVal : [];
    }
  } catch (dbErr: any) {
    // RPC not installed yet — return the SQL so the user knows what to run
    const msg = dbErr.message ?? "";
    const isRpcMissing = msg.includes("exec_bi_query") || msg.includes("function") || msg.includes("does not exist") || msg.includes("404") || msg.includes("PGRST");
    if (isRpcMissing) {
      return {
        summary: `⚠️ La función exec_bi_query no está instalada en Supabase todavía. Ejecuta el archivo src/lib/bi_rpc_migration.sql en el SQL Editor de tu proyecto Supabase para activar las consultas en vivo.\n\nSQL generado:\n${safeSQL}`,
        result: { type: "text", summary: parsed.summary },
      };
    }
    return {
      summary: `Error al ejecutar la consulta: ${msg}\n\nSQL:\n${safeSQL}`,
      result: { type: "text", summary: parsed.summary },
    };
  }

  // Helper: execute an extra SQL query and return chart/table result
  async function execExtra(extraSql: string): Promise<AIResult | undefined> {
    try {
      const safeExtra = extraSql.trim().replace(/;+$/, "");
      if (!/^\s*(SELECT|WITH)\s/i.test(safeExtra)) return undefined;
      const { data: eData, error: eErr } = await db.rpc("exec_bi_query", { query_sql: safeExtra }).maybeSingle();
      console.log("[bi-chat] extraSql result:", JSON.stringify(eData)?.slice(0, 300), "error:", eErr?.message);
      if (eErr) return undefined;
      let extraRows: any[] = [];
      if (Array.isArray(eData)) {
        extraRows = eData;
      } else if (eData && typeof eData === "object" && "rows" in eData && Array.isArray((eData as { rows: unknown }).rows)) {
        extraRows = (eData as { rows: any[] }).rows;
      }
      const chartData = extraRows.map((row: any) => {
        const keys = Object.keys(row);
        return { name: String(row[keys[0]] ?? ""), value: Number(row[keys[1]] ?? 0) };
      });
      return {
        type: "chart",
        chartType: (parsed.extraChartType ?? "bar") as "bar" | "pie",
        title: parsed.extraTitle ?? "",
        data: chartData,
        summary: "",
      };
    } catch { return undefined; }
  }

  // Step 3: Build result from query data + Claude's structure
  if (parsed.type === "table") {
    const cols: string[] = queryData.length > 0
      ? Object.keys(queryData[0])
      : (parsed.columns ?? []);
    const rows = queryData.map((row: any) => cols.map((col) => row[col] ?? null));
    const idColIndex = cols.findIndex((c) => c.toLowerCase() === "id");
    console.log("[bi-chat] extraSql present:", !!parsed.extraSql, parsed.extraSql?.slice(0, 100));
    const extra = parsed.extraSql ? await execExtra(parsed.extraSql) : undefined;
    console.log("[bi-chat] extra result:", JSON.stringify(extra)?.slice(0, 200));

    // Override summary with factual count — prevents Claude from saying "no results" when there are rows
    const isJsonLike = (s: string) => s.trimStart().startsWith("{") || s.trimStart().startsWith("[");
    const factualSummary = rows.length > 0
      ? (isJsonLike(parsed.summary ?? "") ? `Se encontraron ${rows.length} resultado${rows.length !== 1 ? "s" : ""}.` : parsed.summary.replace(/no\s+(se\s+)?(encontraron|hay|existen|tienen)\s+\w+/gi, `se encontraron ${rows.length} registros`))
      : `No se encontraron resultados para esta consulta.`;

    return {
      summary: factualSummary,
      result: {
        type: "table",
        title: parsed.title ?? "Resultados",
        columns: cols,
        rows,
        idColumn: idColIndex >= 0 ? idColIndex : undefined,
        entityType: parsed.entityType ?? "generic",
        summary: factualSummary,
      },
      ...(extra ? { extra } : {}),
    };
  }

  if (parsed.type === "chart") {
    const data = queryData.map((row: any) => {
      const keys = Object.keys(row);
      return {
        name: String(row[keys[0]] ?? ""),
        value: Number(row[keys[1]] ?? 0),
      };
    });
    return {
      summary: parsed.summary,
      result: {
        type: "chart",
        chartType: parsed.chartType ?? "bar",
        title: parsed.title ?? "",
        data,
        summary: parsed.summary,
      },
    };
  }

  // type:text with SQL executed — build summary from real query result
  let metricSummary = parsed.summary ?? "";
  if (queryData.length > 0) {
    const row = queryData[0];
    const keys = Object.keys(row);
    if (keys.length === 1) {
      const rawVal = row[keys[0]];
      const val = typeof rawVal === "string" ? parseFloat(rawVal) : rawVal;
      const isEuro = /importe|total|suma|saldo|gasto|ingreso|cobro|pago|neto|valor/i.test(keys[0]);
      const formatted = (typeof val === "number" && !isNaN(val))
        ? isEuro
          ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(val)
          : new Intl.NumberFormat("es-ES").format(val)
        : String(rawVal ?? "0");
      // Always replace any currency/number pattern Claude put in the summary with the real value
      metricSummary = metricSummary
        .replace(/\bN\b/g, formatted)
        .replace(/-?\d[\d.,]*\s*€/g, formatted)
        .replace(/0[.,]00\s*€/g, formatted)
        .replace(/\b\d+\b(?=\s*(movimientos|registros|resultados|operaciones|facturas|expedientes|cotizaciones))/i, formatted);
      // If Claude hallucinated "no hay" but we have a real non-null value, override entirely
      if (/no\s+(se\s+)?(encontraron|hay|existen|tienen)/i.test(metricSummary) && val !== null && val !== 0) {
        const label = keys[0].replace(/_/g, " ");
        metricSummary = `${label.charAt(0).toUpperCase() + label.slice(1)}: **${formatted}**`;
      }
    } else {
      // Multiple columns — format as key: value pairs
      metricSummary = keys.map(k => {
        const v = row[k];
        const num = typeof v === "string" ? parseFloat(v) : v;
        const isEuro = /importe|total|suma|saldo|gasto|ingreso|cobro|pago|neto|valor/i.test(k);
        const fv = (typeof num === "number" && !isNaN(num))
          ? isEuro
            ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(num)
            : new Intl.NumberFormat("es-ES").format(num)
          : String(v ?? 0);
        return `${k.replace(/_/g, " ")}: ${fv}`;
      }).join(" · ");
    }
  }
  return { summary: metricSummary, result: { type: "text", summary: metricSummary } };
}
