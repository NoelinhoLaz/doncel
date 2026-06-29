import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { searchPlaces, getPlaceDetails } from "@/actions/places";

interface ChatTurn { role: "user" | "assistant"; content: string; }

async function getAgenciaId(): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) return "";
  const svc = createAdminServiceClient();
  const { data } = await svc.from("usuarios").select("agencia_id").eq("auth_user_id", user.id).single();
  return data?.agencia_id ?? "";
}

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

// Detect query type
function detectQueryType(text: string): "photos" | "place" | "web" | "general" {
  const lower = text.toLowerCase();
  const photoKeywords = ["foto", "fotos", "imagen", "imágenes", "imagenes", "photo", "photos", "muéstrame fotos", "pon fotos"];
  const placeKeywords = ["información del hotel", "info del hotel", "datos del hotel", "ficha del", "dónde está", "dirección de", "ubicación de", "teléfono de", "reseñas de", "valoración de", "opinión de"];
  const webKeywords = ["reseña", "valoración", "opinión", "temporada", "cuándo ir", "qué ver", "atracciones", "gastronomía", "mejor época", "clima"];

  if (photoKeywords.some(k => lower.includes(k))) return "photos";
  if (placeKeywords.some(k => lower.includes(k))) return "place";
  if (webKeywords.some(k => lower.includes(k))) return "web";
  return "general";
}

// Extract subject from query (place/hotel name or destination)
function extractSubject(text: string): string {
  const patterns = [
    /fotos?\s+de\s+(.+?)(?:\s*[,.]|$)/i,
    /imágenes?\s+de\s+(.+?)(?:\s*[,.]|$)/i,
    /imagenes?\s+de\s+(.+?)(?:\s*[,.]|$)/i,
    /información\s+(?:del?|de\s+(?:el|la|los|las))?\s+(.+?)(?:\s*[,.]|$)/i,
    /info\s+(?:del?|de\s+(?:el|la|los|las))?\s+(.+?)(?:\s*[,.]|$)/i,
    /hotel\s+(.+?)(?:\s*[,.]|$)/i,
    /ficha\s+(?:del?|de\s+(?:el|la|los|las))?\s+(.+?)(?:\s*[,.]|$)/i,
    /reseñas?\s+(?:del?|de\s+(?:el|la|los|las))?\s+(.+?)(?:\s*[,.]|$)/i,
    /valoraci[oó]n\s+(?:del?|de\s+(?:el|la|los|las))?\s+(.+?)(?:\s*[,.]|$)/i,
    /sobre\s+(.+?)(?:\s*[,.]|$)/i,
    /busca\s+(.+?)(?:\s*[,.]|$)/i,
    /dame\s+\d*\s*(?:fotos?|imágenes?|imagenes?)?\s+(?:de\s+)?(.+?)(?:\s*[,.]|$)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return text.slice(0, 80);
}

// Extract number from query (e.g. "4 fotos")
function extractCount(text: string): number {
  const m = text.match(/(\d+)\s+(?:fotos?|imágenes?|imagenes?)/i);
  return m ? Math.min(parseInt(m[1]), 12) : 4;
}

// ─── Build propuesta context from DB ─────────────────────────────────────────

async function buildPropuestaContext(propuestaId: string): Promise<string> {
  try {
    const { getAgencyDbClient } = await import("@/lib/agencyDb");
    const db = await getAgencyDbClient();

    const { data } = await db
      .from("operativa_propuestas")
      .select("id, title, destination, landings(editor_content)")
      .eq("id", propuestaId)
      .single();

    if (!data) return "";

    const landing = Array.isArray(data.landings)
      ? (data.landings.find((l: any) => l.editor_content) ?? data.landings[0])
      : data.landings;

    const secciones: any[] = landing?.editor_content ?? [];
    if (!secciones.length) return `PROPUESTA ACTIVA: "${(data as any).title}" (sin secciones aún)`;

    const lines: string[] = [];
    lines.push(`PROPUESTA ACTIVA: "${(data as any).title}"`);
    if ((data as any).destination) lines.push(`Destino: ${(data as any).destination}`);
    lines.push(`Secciones (${secciones.length}):`);

    for (const sec of secciones) {
      if (sec.oculta) continue;
      const tipo = sec.tipo ?? "sección";

      if (tipo === "portada") {
        lines.push(`  [Portada] ${sec.titulo ?? ""}${sec.subtitulo ? " · " + sec.subtitulo : ""}`);

      } else if (tipo === "itinerario") {
        const dias: any[] = sec.dias ?? [];
        lines.push(`  [Itinerario] "${sec.titulo ?? ""}" — ${dias.length} días:`);
        for (const d of dias) {
          lines.push(`    Día ${d.dia}: ${d.titulo ?? "(sin título)"}${d.desc ? " — " + String(d.desc).slice(0, 120) : ""}`);
        }
        if (sec.fechaDesde || sec.fechaHasta) {
          lines.push(`    Fechas: ${sec.fechaDesde ?? "?"} → ${sec.fechaHasta ?? "?"}`);
        }

      } else if (tipo === "precio") {
        lines.push(`  [Precio] ${sec.titulo ?? ""}${sec.subtitulo ? " · " + sec.subtitulo : ""}`);

      } else if (tipo === "texto-imagenes" || tipo === "texto-columnas") {
        lines.push(`  [${sec.label ?? tipo}] ${sec.titulo ?? ""}${sec.subtitulo ? " · " + String(sec.subtitulo).slice(0, 100) : ""}`);
        if (sec.columnas?.length) {
          for (const col of sec.columnas) {
            if (col.titulo || col.texto) {
              lines.push(`    · ${col.titulo ?? ""}${col.texto ? ": " + String(col.texto).slice(0, 80) : ""}`);
            }
          }
        }

      } else if (tipo === "mapa") {
        const ubs = (sec.mapas ?? []).flatMap((m: any) => m.ubicaciones ?? []);
        lines.push(`  [Mapa] ${sec.titulo ?? ""} — ${ubs.length} ubicaciones: ${ubs.map((u: any) => u.nombre ?? u.direccion ?? "").filter(Boolean).slice(0, 5).join(", ")}`);

      } else if (tipo === "ruta") {
        const ubs = (sec.rutas ?? []).flatMap((r: any) => r.ubicaciones ?? []);
        lines.push(`  [Ruta] ${sec.titulo ?? ""} — ${ubs.length} puntos`);

      } else {
        if (sec.titulo) lines.push(`  [${tipo}] ${sec.titulo}`);
      }
    }

    return lines.join("\n");
  } catch (e: any) {
    console.error("[propuestas/copiloto] buildPropuestaContext:", e?.message);
    return "";
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { history, propuestaId } = await req.json();
    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ success: false, error: "history requerido" }, { status: 400 });
    }

    const propuestaContext = propuestaId ? await buildPropuestaContext(propuestaId) : "";

    const lastMsg: string = history.filter((m: ChatTurn) => m.role === "user").at(-1)?.content ?? "";
    const qtype = detectQueryType(lastMsg);
    const subject = extractSubject(lastMsg);
    const count = extractCount(lastMsg);

    // ── Photos via Unsplash ──────────────────────────────────────────────────
    if (qtype === "photos") {
      const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
      let photos: any[] = [];
      if (unsplashAccessKey) {
        const unsplashRes = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(subject)}&per_page=${count}&orientation=landscape`,
          { headers: { Authorization: `Client-ID ${unsplashAccessKey}` }, next: { revalidate: 60 } }
        );
        if (unsplashRes.ok) {
          const unsplashData = await unsplashRes.json();
          photos = (unsplashData.results ?? []).slice(0, count).map((p: any) => ({
            id: p.id,
            thumb: p.urls.small,
            full: p.urls.regular,
            alt: p.alt_description ?? p.description ?? subject,
            author: p.user.name,
            authorUrl: p.user.links.html,
          }));
        }
      }

      if (photos.length === 0) {
        return NextResponse.json({
          success: true,
          summary: `No encontré fotos de "${subject}" en Unsplash.`,
          result: { type: "text", summary: `No encontré fotos de "${subject}".` },
        });
      }

      return NextResponse.json({
        success: true,
        summary: `${photos.length} foto${photos.length !== 1 ? "s" : ""} de ${subject}`,
        result: {
          type: "photos",
          subject,
          photos,
          summary: `${photos.length} fotos de ${subject}`,
        },
      });
    }

    // ── Place details via Google Places ──────────────────────────────────────
    if (qtype === "place") {
      const suggestions = await searchPlaces(subject);
      if (!suggestions.length) {
        return NextResponse.json({
          success: true,
          summary: `No encontré "${subject}" en Google Places.`,
          result: { type: "text", summary: `No encontré "${subject}" en Google Places.` },
        });
      }

      const placeId = suggestions[0].placeId;
      const details = await getPlaceDetails(placeId);

      if (!details) {
        return NextResponse.json({
          success: true,
          summary: `No pude obtener detalles de "${subject}".`,
          result: { type: "text", summary: `No pude obtener detalles de "${subject}".` },
        });
      }

      return NextResponse.json({
        success: true,
        summary: `${details.displayName} · ${details.formattedAddress}`,
        result: {
          type: "place",
          displayName: details.displayName,
          formattedAddress: details.formattedAddress,
          lat: details.lat,
          lng: details.lng,
          googleMapsUri: details.googleMapsUri,
          photos: details.photos,
          country: details.country,
          locality: details.locality,
          adminAreaL1: details.adminAreaL1,
          summary: `${details.displayName} · ${details.formattedAddress}`,
        },
      });
    }

    // ── Web search via Tavily ─────────────────────────────────────────────────
    if (qtype === "web") {
      const webContext = await tavilySearch(lastMsg);
      if (webContext) {
        const agenciaId = await getAgenciaId();
        const anthropic = await getAnthropicClient(agenciaId);
        const aiRes = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: `Eres un asistente para propuestas de viajes de grupo. Responde en español usando el contexto web. Sé conciso y orientado a ventas.${propuestaContext ? `\n\n${propuestaContext}` : ""}`,
          messages: [{ role: "user", content: `Contexto web:\n${webContext}\n\nPregunta: ${lastMsg}` }],
        });
        const answer = aiRes.content[0].type === "text" ? aiRes.content[0].text : webContext;
        return NextResponse.json({
          success: true,
          summary: answer,
          result: { type: "text", summary: answer },
        });
      }
    }

    // ── General / conversational with optional Tavily enrichment ─────────────
    const webContext = await tavilySearch(subject.length > 4 ? lastMsg : "");
    const agenciaId = await getAgenciaId();
    const anthropic = await getAnthropicClient(agenciaId);

    const systemPrompt = `Eres el Copilot de propuestas para una agencia de viajes especializada en viajes de grupo y excursiones escolares.
Tu rol es ayudar a crear propuestas atractivas, analizar itinerarios, sugerir destinos, actividades, hoteles y servicios, y redactar descripciones de venta.
Responde siempre en español, de forma concisa y orientada a la venta.
Cuando el usuario pregunte "analiza", "qué te parece", "revisa", "mejora" el itinerario u otro contenido — úsalo como contexto principal para tu respuesta.
${propuestaContext ? `\n${propuestaContext}\n` : ""}${webContext ? `\n[CONTEXTO WEB]:\n${webContext}` : ""}`;

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: history.slice(-8).map((m: ChatTurn) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const answer = aiRes.content[0].type === "text" ? aiRes.content[0].text : "Sin respuesta";
    return NextResponse.json({
      success: true,
      summary: answer,
      result: { type: "text", summary: answer },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
