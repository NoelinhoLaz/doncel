import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { guardarPropuesta } from "@/actions/propuestas";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

interface ChatTurn { role: "user" | "assistant"; content: string; }

async function getAgenciaId(): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) return "";
  const svc = createAdminServiceClient();
  const { data } = await svc.from("usuarios").select("agencia_id").eq("auth_user_id", user.id).single();
  return data?.agencia_id ?? "";
}

function uid(tipo: string) {
  return `${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildSecciones(info: any): { editorContent: any[]; designTokens: any[] } {
  const editorContent: any[] = [];
  const designTokens: any[] = [];

  const defaultEstiloTitulo = { fuente: "Raleway", tamano: "48px", grosor: "700", alineacionH: "center", color: "#ffffff" };
  const defaultEstiloSubtitulo = { fuente: "Montserrat", tamano: "20px", grosor: "300", alineacionH: "center", color: "#f0f0f0" };
  const defaultEstiloTituloDia = { fuente: "Raleway", tamano: "20px", grosor: "600", color: "#1e293b" };
  const defaultEstiloDescDia = { fuente: "Montserrat", tamano: "15px", grosor: "400", color: "#475569" };

  // ── Portada ──────────────────────────────────────────────────────────────────
  const portadaUid = uid("portada");
  editorContent.push({
    uid: portadaUid,
    tipo: "portada",
    label: "Portada",
    titulo: info.titulo ?? "Propuesta de viaje",
    subtitulo: info.subtitulo ?? (info.destino ? `Descubre ${info.destino}` : ""),
    medias: [],
  });
  designTokens.push({
    uid: portadaUid,
    layout: "slide",
    estiloTitulo: defaultEstiloTitulo,
    estiloSubtitulo: defaultEstiloSubtitulo,
    colorFondo: "#0f172a",
  });

  // ── Descripción general ───────────────────────────────────────────────────────
  if (info.descripcion) {
    const descUid = uid("texto-columnas");
    editorContent.push({
      uid: descUid,
      tipo: "texto-columnas",
      label: "Descripción",
      titulo: "El viaje",
      columnas: [{ titulo: "", texto: info.descripcion }],
    });
    designTokens.push({
      uid: descUid,
      layout: "1-col",
      estiloTitulo: { fuente: "Raleway", tamano: "32px", grosor: "700", alineacionH: "center", color: "#1e293b" },
      colorFondo: "#ffffff",
      anchoMax: "900px",
    });
  }

  // ── Itinerario ────────────────────────────────────────────────────────────────
  if (info.dias && info.dias.length > 0) {
    const itinUid = uid("itinerario");
    editorContent.push({
      uid: itinUid,
      tipo: "itinerario",
      label: "Itinerario",
      titulo: "Programa del viaje",
      fechaDesde: info.fechaDesde ?? "",
      fechaHasta: info.fechaHasta ?? "",
      dias: info.dias.map((d: any, i: number) => ({
        dia: i + 1,
        titulo: d.titulo ?? `Día ${i + 1}`,
        desc: d.desc ?? "",
        medias: [],
      })),
    });
    designTokens.push({
      uid: itinUid,
      layout: "acordeon",
      estiloTitulo: { fuente: "Raleway", tamano: "32px", grosor: "700", alineacionH: "center", color: "#1e293b" },
      estiloTituloDia: defaultEstiloTituloDia,
      estiloDescDia: defaultEstiloDescDia,
      colorFondo: "#f8fafc",
      anchoMax: "900px",
    });
  }

  // ── Precio / Incluye ──────────────────────────────────────────────────────────
  if (info.precio || info.incluye || info.noIncluye) {
    const precioUid = uid("texto-columnas");
    const cols = [];
    if (info.incluye) cols.push({ titulo: "✅ Incluye", texto: info.incluye });
    if (info.noIncluye) cols.push({ titulo: "❌ No incluye", texto: info.noIncluye });
    if (info.precio) cols.push({ titulo: "💶 Precio", texto: info.precio });

    editorContent.push({
      uid: precioUid,
      tipo: "texto-columnas",
      label: "Precio",
      titulo: "Precio y condiciones",
      columnas: cols,
    });
    designTokens.push({
      uid: precioUid,
      layout: cols.length === 1 ? "1-col" : cols.length === 2 ? "2-cols" : "3-cols",
      estiloTitulo: { fuente: "Raleway", tamano: "32px", grosor: "700", alineacionH: "center", color: "#1e293b" },
      colorFondo: "#f0fdf4",
      anchoMax: "1100px",
    });
  }

  return { editorContent, designTokens };
}

const SYSTEM_CREAR = `Eres un asistente de ventas para una agencia de viajes especializada en viajes de grupo y excursiones escolares.
Tu objetivo es ayudar a crear propuestas de viaje completas a través de conversación natural.

FLUJO:
1. Cuando el usuario quiera crear una propuesta, recoge la información necesaria mediante preguntas naturales.
2. Cuando tengas suficiente información, genera un JSON estructurado con los datos de la propuesta.
3. Devuelve SIEMPRE JSON puro sin markdown cuando estés listo para crear.

INFORMACIÓN NECESARIA (mínimo obligatorio):
- titulo: nombre del viaje (ej: "Viaje a Japón - IES Lazaro Carreter")
- destino: ciudad/país principal
- dias: array de días con título y descripción

INFORMACIÓN OPCIONAL PERO RECOMENDADA:
- subtitulo: frase de venta atractiva
- descripcion: párrafo general del viaje (atractivo, orientado a ventas)
- fechaDesde / fechaHasta: fechas en formato YYYY-MM-DD
- precio: texto con el precio por persona y condiciones
- incluye: lista de lo que incluye el viaje
- noIncluye: lista de lo que no incluye

CUÁNDO CREAR:
- Cuando el usuario confirme o cuando tengas: titulo + destino + al menos 2 días con descripción.
- Pregunta máximo 2-3 datos por turno para no abrumar.
- Si el usuario da mucha info de golpe, úsala toda sin preguntar lo que ya tiene.

FORMATO DE RESPUESTA cuando estés listo para crear:
{"action":"crear","titulo":"...","subtitulo":"...","destino":"...","descripcion":"...","fechaDesde":"...","fechaHasta":"...","dias":[{"titulo":"Llegada a Tokio","desc":"Vuelo desde Madrid..."},...],"precio":"...","incluye":"...","noIncluye":"..."}

FORMATO DE RESPUESTA para seguir conversando:
{"action":"chat","message":"tu respuesta en texto natural"}

IMPORTANTE: devuelve SOLO JSON puro, sin markdown, sin texto extra.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { history } = await req.json();
    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ success: false, error: "history requerido" }, { status: 400 });
    }

    const agenciaId = await getAgenciaId();
    const anthropic = await getAnthropicClient(agenciaId);

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_CREAR,
      messages: history.slice(-10).map((m: ChatTurn) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const rawText = aiRes.content[0].type === "text" ? aiRes.content[0].text.trim() : "";

    let parsed: any;
    try {
      const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({
        success: true,
        action: "chat",
        summary: rawText,
      });
    }

    if (parsed.action === "crear") {
      const { editorContent, designTokens } = buildSecciones(parsed);
      const result = await guardarPropuesta({ editorContent, designTokens });

      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }

      const nDias = parsed.dias?.length ?? 0;
      return NextResponse.json({
        success: true,
        action: "creada",
        propuestaId: result.id,
        summary: `✅ Propuesta "${parsed.titulo}" creada con ${nDias} día${nDias !== 1 ? "s" : ""} de itinerario. Abriendo el editor…`,
      });
    }

    // action === "chat"
    return NextResponse.json({
      success: true,
      action: "chat",
      summary: parsed.message ?? rawText,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
