"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bot, X, RotateCcw, Send, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant";

interface TableResult { type: "table"; title: string; columns: string[]; rows: (string | number | null)[][]; entityType?: string; idColumn?: number; summary: string; }
interface ChartResult { type: "chart"; chartType: "bar" | "pie"; title: string; data: { name: string; value: number }[]; summary: string; }
interface TextResult { type: "text"; summary: string; }
type AIResult = TableResult | ChartResult | TextResult;

interface PhotoItem { id: string; thumb: string; full: string; alt: string; author: string; authorUrl: string; }
interface PhotoResult { type: "photos"; subject: string; photos: PhotoItem[]; summary: string; }
interface PlaceResult { type: "place"; displayName: string; formattedAddress: string; lat: number | null; lng: number | null; googleMapsUri: string | null; photos: { name: string; widthPx: number; heightPx: number }[]; country: string | null; locality: string | null; adminAreaL1: string | null; summary: string; }
type AnyResult = AIResult | PhotoResult | PlaceResult;

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  result?: AnyResult;
  extra?: AIResult;
  isLoading?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Context detection ────────────────────────────────────────────────────────

type CopilotoMode = "cotizacion" | "campana_detalle" | "campana_lista" | "propuestas_lista" | "propuestas_detalle" | "banco" | "global";

interface CopilotoConfig {
  mode: CopilotoMode;
  title: string;
  subtitle: string;
  endpoint: string;
  payload: Record<string, string | undefined>;
  chips: string[];
  placeholder: string;
  welcomeText: string;
}

function detectConfig(pathname: string): CopilotoConfig {
  const isCotizacion = pathname.startsWith("/cotizaciones/nueva");
  const campanaDetalleMatch = pathname.match(/^\/campanas\/([^/]+)$/);
  const campanaId = campanaDetalleMatch?.[1];
  const isCampanaLista = pathname === "/campanas" || pathname.startsWith("/oportunidades");
  const isPropuestas = pathname.startsWith("/propuestas");
  const isBanco = pathname.startsWith("/banco");

  const cotizacionId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("id") ?? undefined
    : undefined;

  if (isCotizacion) {
    return {
      mode: "cotizacion",
      title: "Copilot · Cotización",
      subtitle: cotizacionId ? "Cotización activa + histórico" : "Modo cotizaciones",
      endpoint: "/api/cotizaciones/copiloto",
      payload: { cotizacionId },
      chips: [
        "¿Cuál es el margen de esta cotización?",
        "¿Qué opiniones tiene el hotel de esta cotización?",
        "Compara el precio de este hotel con lo que hemos pagado históricamente",
        "¿Hay alternativas más baratas para el mismo destino en nuestras cotizaciones?",
        "Redacta un resumen ejecutivo para enviar al cliente",
        "¿Qué líneas tienen margen negativo o muy bajo?",
        "¿Este proveedor nos ha dado problemas en cotizaciones anteriores?",
        "Detecta posibles problemas y sugiere mejoras",
      ],
      placeholder: "Márgenes, proveedores históricos, optimización del viaje…",
      welcomeText: "Hola, soy tu Copilot de cotizaciones. Analizo esta cotización y consulto el histórico para ayudarte a optimizarla. ¿Qué quieres saber?",
    };
  }

  if (campanaId) {
    return {
      mode: "campana_detalle",
      title: "Copilot · Campaña",
      subtitle: "Auditoría de esta campaña",
      endpoint: "/api/bi-chat",
      payload: { campanaId },
      chips: [
        "Agentes por debajo del 50% de objetivo",
        "Oportunidades estancadas más de 30 días",
        "Denegados sin motivo registrado",
        "¿Qué centros ganamos el año pasado y no están aquí?",
        "Pipeline por agente y valor estimado",
        "Oportunidades con fecha de cierre vencida",
      ],
      placeholder: "Agentes, pipeline, centros, conversión de esta campaña…",
      welcomeText: "Hola, soy tu Copilot de campaña. Tengo acceso completo al pipeline, agentes y centros de esta campaña. ¿Qué quieres analizar?",
    };
  }

  // Extract propuestaId from pathname: /propuestas/nueva?id=xxx or /propuestas/[id]
  const propuestaIdFromPath = pathname.match(/^\/propuestas\/([^/]+)(?:\/|$)/)?.[1];
  const propuestaIdFromQuery = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("id") ?? undefined
    : undefined;
  const propuestaId = (propuestaIdFromPath && propuestaIdFromPath !== "nueva")
    ? propuestaIdFromPath
    : propuestaIdFromQuery;

  // Propuestas lista (/propuestas exacto o /propuestas/nueva) → modo creación
  const isPropuestasList = pathname === "/propuestas" || pathname.startsWith("/propuestas/nueva");
  // Propuestas detalle (/propuestas/[id]) → modo análisis/edición
  const isPropuestasDetalle = isPropuestas && !isPropuestasList;

  if (isPropuestasList) {
    return {
      mode: "propuestas_lista",
      title: "Copilot · Propuestas",
      subtitle: "Crear propuesta con IA",
      endpoint: "/api/propuestas/crear",
      payload: {},
      chips: [
        "Crea una propuesta para un viaje escolar a Roma de 5 días",
        "Propuesta para viaje fin de curso a París con 2º Bachillerato",
        "Viaje cultural a Japón 10 días para grupo adulto",
        "Escapada de aventura a los Picos de Europa 3 días",
      ],
      placeholder: "Describe el viaje y lo creo para ti…",
      welcomeText: "Hola, soy tu Copilot de propuestas. Cuéntame qué viaje quieres crear — destino, duración, tipo de grupo — y generaré la propuesta completa con itinerario y diseño. ¿Empezamos?",
    };
  }

  if (isPropuestasDetalle) {
    return {
      mode: "propuestas_detalle",
      title: "Copilot · Propuestas",
      subtitle: propuestaId ? "Propuesta activa cargada" : "Fotos, lugares y contenido",
      endpoint: "/api/propuestas/copiloto",
      payload: propuestaId ? { propuestaId } : {},
      chips: [
        "Analiza el itinerario de esta propuesta",
        "¿Qué mejorarías de esta propuesta para hacerla más atractiva?",
        "Dame 6 fotos del destino de esta propuesta",
        "Redacta una descripción de venta para esta propuesta",
        "¿Hay algún día con demasiadas actividades o muy vacío?",
        "Dame fotos de la Costa Amalfitana",
        "Ficha completa del Hotel Arts Barcelona",
        "¿Cuál es la mejor época para visitar Roma con grupos?",
      ],
      placeholder: "Analiza el itinerario, busca fotos, fichas de hoteles…",
      welcomeText: "Hola, soy tu Copilot de propuestas. Tengo acceso al contenido de esta propuesta — itinerario, secciones, destino. Puedo analizarla, sugerir mejoras, buscar fotos y fichas de hoteles. ¿Qué necesitas?",
    };
  }

  if (isCampanaLista) {
    return {
      mode: "campana_lista",
      title: "Copilot · Campañas",
      subtitle: "Visión global de todas las campañas",
      endpoint: "/api/bi-chat",
      payload: {},
      chips: [
        "¿Qué campaña tiene mayor % de objetivo conseguido?",
        "Agentes con más oportunidades ganadas en total",
        "Comparativa de conversión entre campañas activas",
        "¿Qué campaña aporta más valor al pipeline?",
        "Centros sin contacto en alguna campaña activa",
        "Evolución mensual de oportunidades ganadas",
      ],
      placeholder: "Comparativas entre campañas, rendimiento global de agentes…",
      welcomeText: "Hola, soy tu Copilot de campañas. Tengo visión de todas las campañas, agentes y su rendimiento. ¿Qué comparativa o análisis necesitas?",
    };
  }

  if (isBanco) {
    return {
      mode: "banco",
      title: "Copilot · Banco",
      subtitle: "Análisis de movimientos y conciliación",
      endpoint: "/api/bi-chat",
      payload: {},
      chips: [
        "¿Cuántos movimientos llevan más de 15 días sin conciliar?",
        "¿Cuánto dinero está pendiente de conciliar por banco?",
        "Top 10 conceptos de gasto más frecuentes este año",
        "Movimientos de más de 5.000€ sin conciliar",
        "¿Hay movimientos duplicados este mes?",
        "Comparativa ingresos vs pagos por mes este año",
        "Matches propuestos con score alto sin confirmar",
        "¿Cuánto hemos cobrado vs pagado este trimestre?",
      ],
      placeholder: "Conciliación, flujo de caja, anomalías, patrones de gasto…",
      welcomeText: "Hola, soy tu Copilot de banco. Tengo acceso completo a los movimientos bancarios — puedo analizar la conciliación pendiente, detectar anomalías, calcular flujo de caja y mucho más. ¿Qué quieres ver?",
    };
  }

  return {
    mode: "global",
    title: "Copilot · Global",
    subtitle: "Analítica general de la agencia",
    endpoint: "/api/bi-chat",
    payload: {},
    chips: [
      "Expedientes confirmados este año",
      "Cotizaciones con mayor margen",
      "Proveedores más usados en hoteles",
      "Campañas activas y sus objetivos",
      "Agentes con más oportunidades ganadas",
      "Cotizaciones aceptadas por destino",
    ],
    placeholder: "Consulta cualquier dato de la agencia…",
    welcomeText: "Hola, soy tu Copilot global. Tengo acceso a toda la base de datos — campañas, cotizaciones, expedientes, proveedores. ¿Qué quieres analizar?",
  };
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBar({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem" }}>
          <span style={{ width: "96px", flexShrink: 0, textAlign: "right", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
          <div style={{ flex: 1, background: "#f1f5f9", borderRadius: "99px", height: "16px", overflow: "hidden" }}>
            <div style={{ width: `${Math.max((d.value / max) * 100, 4)}%`, height: "100%", background: "var(--primary-color, #4f46e5)", borderRadius: "99px", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "5px" }}>
              <span style={{ color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>{d.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Photo grid (Unsplash) ────────────────────────────────────────────────────

function PhotoGrid({ result }: { result: PhotoResult }) {
  return (
    <div style={{ marginTop: "10px" }}>
      <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
        {result.photos.length} foto{result.photos.length !== 1 ? "s" : ""} de {result.subject}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        {result.photos.map((photo) => (
          <a key={photo.id} href={photo.full} target="_blank" rel="noopener noreferrer" style={{ display: "block", borderRadius: "8px", overflow: "hidden", position: "relative", aspectRatio: "4/3" }}>
            <img
              src={photo.thumb}
              alt={photo.alt}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              loading="lazy"
            />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 6px", background: "linear-gradient(transparent, rgba(0,0,0,0.5))", fontSize: "0.55rem", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {photo.author}
            </div>
          </a>
        ))}
      </div>
      <p style={{ fontSize: "0.55rem", color: "#cbd5e1", marginTop: "4px" }}>Fotos de Unsplash</p>
    </div>
  );
}

// ─── Place card (Google Places) ───────────────────────────────────────────────

function PlaceCard({ result, baseUrl }: { result: PlaceResult; baseUrl: string }) {
  const location = [result.locality, result.adminAreaL1, result.country].filter(Boolean).join(", ");
  return (
    <div style={{ marginTop: "10px", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", fontSize: "0.78rem" }}>
      {/* Photos row */}
      {result.photos.length > 0 && (
        <div style={{ display: "flex", height: "110px", overflow: "hidden" }}>
          {result.photos.slice(0, 3).map((ph, i) => (
            <div key={i} style={{ flex: 1, overflow: "hidden" }}>
              <img
                src={`${baseUrl}/api/places/photo?name=${encodeURIComponent(ph.name)}`}
                alt={result.displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
      {/* Info */}
      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontWeight: 700, color: "#1e293b", margin: "0 0 2px", fontSize: "0.82rem" }}>{result.displayName}</p>
        {location && <p style={{ color: "#64748b", margin: "0 0 4px", fontSize: "0.72rem" }}>{location}</p>}
        <p style={{ color: "#475569", margin: "0 0 8px", fontSize: "0.7rem", lineHeight: 1.4 }}>{result.formattedAddress}</p>
        {result.googleMapsUri && (
          <a
            href={result.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.68rem", color: "#4f46e5", fontWeight: 600, textDecoration: "none", padding: "4px 10px", borderRadius: "99px", border: "1px solid #e0e7ff", background: "#eef2ff" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Ver en Google Maps
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Result block ─────────────────────────────────────────────────────────────

function ResultBlock({ result }: { result: AIResult }) {
  if (result.type === "text") return null;

  if (result.type === "chart") {
    return (
      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{result.title}</p>
        <MiniBar data={result.data} />
      </div>
    );
  }

  if (result.rows.length === 0) return null;
  const idCol = result.idColumn ?? -1;
  const visCols = result.columns.filter((_, i) => i !== idCol);

  return (
    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
      <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>{result.title}</p>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", fontSize: "0.75rem" }}>
        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", position: "sticky", top: 0 }}>
                {visCols.map((col, i) => (
                  <th key={i} style={{ padding: "5px 10px", textAlign: "left", fontSize: "0.6rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", whiteSpace: "nowrap" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, ri) => {
                const cells = row.filter((_, ci) => ci !== idCol);
                return (
                  <tr key={ri} style={{ borderTop: "1px solid #f1f5f9" }}>
                    {cells.map((cell, ci) => {
                      const isNum = typeof cell === "number";
                      const colName = (visCols[ci] ?? "").toLowerCase();
                      const isCurrency = isNum && /neto|pvp|total_neto|total_pvp|total_coste|total_ingreso|total_beneficio|coste|precio|beneficio|importe|valor_estimado|valor_total|€/.test(colName);
                      const display = isCurrency
                        ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cell as number)
                        : isNum ? new Intl.NumberFormat("es-ES").format(cell as number) : (cell ?? "—");
                      return (
                        <td key={ci} style={{ padding: "5px 10px", color: "#334155", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: isNum ? "monospace" : undefined }} title={String(cell ?? "")}>
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "4px 10px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", fontSize: "0.6rem", color: "#94a3b8" }}>
          {result.rows.length} registro{result.rows.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ msg, baseUrl }: { msg: Message; baseUrl: string }) {
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <div style={{ maxWidth: "85%", padding: "10px 14px", background: "var(--primary-color, #4f46e5)", color: "#fff", fontSize: "0.85rem", borderRadius: "12px 12px 2px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
          {msg.text}
        </div>
      </div>
    );
  }

  const renderResult = (result: AnyResult) => {
    if (result.type === "photos") return <PhotoGrid result={result as PhotoResult} />;
    if (result.type === "place") return <PlaceCard result={result as PlaceResult} baseUrl={baseUrl} />;
    return <ResultBlock result={result as AIResult} />;
  };

  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "12px" }}>
      <div style={{ maxWidth: "92%", padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", color: "#1e293b", fontSize: "0.85rem", borderRadius: "12px 12px 12px 2px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {msg.isLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", padding: "2px 0" }}>
            <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: "0.78rem" }}>Buscando…</span>
          </div>
        ) : (
          <>
            {msg.text && <p style={{ lineHeight: 1.55, whiteSpace: "pre-wrap", margin: 0 }}>{msg.text}</p>}
            {msg.result && renderResult(msg.result)}
            {msg.extra && <ResultBlock result={msg.extra} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Mode badge ───────────────────────────────────────────────────────────────

const MODE_COLORS: Record<CopilotoMode, string> = {
  cotizacion: "#0ea5e9",
  campana_detalle: "#8b5cf6",
  campana_lista: "#6366f1",
  propuestas_lista: "#f59e0b",
  propuestas_detalle: "#f59e0b",
  banco: "#f97316",
  global: "#10b981",
};

const MODE_LABELS: Record<CopilotoMode, string> = {
  cotizacion: "Cotización",
  campana_detalle: "Campaña",
  campana_lista: "Campañas",
  propuestas_lista: "Crear",
  propuestas_detalle: "Propuesta",
  banco: "Banco",
  global: "Global",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function GlobalCopilotoDrawer({ isOpen, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [prevMode, setPrevMode] = useState<CopilotoMode | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const config = detectConfig(pathname);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Reset session when mode changes (different page context)
  useEffect(() => {
    if (prevMode !== null && prevMode !== config.mode) {
      setMessages([]);
    }
    setPrevMode(config.mode);
  }, [config.mode]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ id: "welcome", role: "assistant", text: config.welcomeText }]);
    }
  }, [isOpen, config.mode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  const clearSession = useCallback(() => {
    setMessages([{ id: "w" + Date.now(), role: "assistant", text: "Sesión reiniciada. ¿En qué puedo ayudarte?" }]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: trimmed };
    const loadingMsg: Message = { id: Date.now() + "-ai", role: "assistant", text: "", isLoading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setIsLoading(true);

    const history = [...messages, userMsg]
      .filter(m => !m.isLoading)
      .slice(-8)
      .map(m => ({ role: m.role, content: m.text }));

    // Re-read IDs at send time in case they weren't available at render
    const cotizacionId = config.mode === "cotizacion" && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("id") ?? undefined
      : undefined;

    const propuestaIdLive = config.mode === "propuestas" && typeof window !== "undefined"
      ? (() => {
          const pathMatch = window.location.pathname.match(/^\/propuestas\/([^/]+)(?:\/|$)/);
          const fromPath = pathMatch?.[1] !== "nueva" ? pathMatch?.[1] : undefined;
          return fromPath ?? new URLSearchParams(window.location.search).get("id") ?? undefined;
        })()
      : undefined;

    const body: Record<string, unknown> = { history, ...config.payload };
    if (cotizacionId) body.cotizacionId = cotizacionId;
    if (propuestaIdLive) body.propuestaId = propuestaIdLive;

    try {
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Error");

      // Propuesta creada — show success message then navigate to editor
      if (json.action === "creada" && json.propuestaId) {
        setMessages(prev => [...prev.slice(0, -1), {
          id: Date.now() + "-done",
          role: "assistant",
          text: json.summary ?? "✅ Propuesta creada. Abriendo el editor…",
        }]);
        setTimeout(() => {
          onClose();
          router.push(`/propuestas/nueva?id=${json.propuestaId}`);
        }, 1500);
        return;
      }

      setMessages(prev => [...prev.slice(0, -1), {
        id: Date.now() + "-done",
        role: "assistant",
        text: json.summary ?? json.result?.summary ?? "Sin respuesta",
        result: json.result,
        extra: json.extra,
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev.slice(0, -1), {
        id: Date.now() + "-err",
        role: "assistant",
        text: `Error: ${err.message}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, config]);

  if (!isOpen) return null;

  const modeColor = MODE_COLORS[config.mode];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 9040 }} />

      <div style={{
        position: "fixed", top: 0, right: 0, height: "100%", width: "680px", maxWidth: "100vw",
        zIndex: 9050, display: "flex", flexDirection: "column",
        background: "#fff", boxShadow: "-4px 0 32px rgba(15,23,42,0.18)",
        animation: "globalCopilotoIn 0.22s ease-out",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--header-bg, #0f172a)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--primary-color, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={16} color="#fff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <p style={{ color: "#fff", fontSize: "0.83rem", fontWeight: 600, margin: 0, lineHeight: 1.2 }}>{config.title}</p>
                <span style={{ fontSize: "0.58rem", fontWeight: 700, padding: "1px 6px", borderRadius: "99px", background: modeColor, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {MODE_LABELS[config.mode]}
                </span>
              </div>
              <p style={{ color: "#64748b", fontSize: "0.62rem", margin: 0, lineHeight: 1.2 }}>{config.subtitle}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button onClick={clearSession} title="Limpiar sesión" style={iconBtnStyle}>
              <RotateCcw size={14} />
            </button>
            <button onClick={onClose} style={iconBtnStyle}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", background: "rgba(248,250,252,0.5)" }}>
          {messages.map(msg => <Bubble key={msg.id} msg={msg} baseUrl={baseUrl} />)}

          {/* Suggestion cards — only shown after welcome, before first user message */}
          {messages.length === 1 && messages[0].role === "assistant" && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
                Ideas de preguntas
              </p>
              {config.chips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(chip)}
                  disabled={isLoading}
                  style={{
                    textAlign: "left", padding: "9px 13px",
                    background: "#fff", border: "1px solid #e2e8f0",
                    borderRadius: "10px", cursor: "pointer",
                    fontSize: "0.8rem", color: "#334155", lineHeight: 1.4,
                    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                    transition: "border-color 0.15s, background 0.15s",
                    display: "flex", alignItems: "center", gap: "8px",
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.borderColor = modeColor;
                    b.style.background = "color-mix(in srgb, " + modeColor + " 5%, white)";
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.borderColor = "#e2e8f0";
                    b.style.background = "#fff";
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: modeColor, flexShrink: 0 }}>→</span>
                  {chip}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e2e8f0", background: "#fff", padding: "10px 14px 14px", flexShrink: 0 }}>
          {/* Chips — compact scroll bar, only visible once conversation started */}
          {messages.length > 1 && (
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
              {config.chips.map(chip => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={isLoading}
                  style={{ flexShrink: 0, padding: "3px 10px", fontSize: "0.68rem", color: "#475569", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "99px", cursor: "pointer", whiteSpace: "nowrap" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = modeColor; (e.currentTarget as HTMLButtonElement).style.color = modeColor; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLButtonElement).style.color = "#475569"; }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "8px 10px" }}
            onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = modeColor}
            onBlurCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0"}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 160) + "px";
              }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              disabled={isLoading}
              placeholder={config.placeholder}
              rows={1}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: "0.83rem", color: "#1e293b", lineHeight: 1.5, maxHeight: "160px", overflowY: "auto" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              style={{ flexShrink: 0, width: "28px", height: "28px", borderRadius: "8px", background: isLoading || !input.trim() ? "#e2e8f0" : modeColor, border: "none", cursor: isLoading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
            >
              {isLoading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={13} />}
            </button>
          </div>
          <p style={{ fontSize: "0.6rem", color: "#cbd5e1", marginTop: "5px" }}>Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>

      <style>{`
        @keyframes globalCopilotoIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: "28px", height: "28px", borderRadius: "8px",
  background: "transparent", border: "none", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#64748b",
};
