"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, RotateCcw, Send, Loader2, Eye } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant";

interface TableResult { type: "table"; title: string; columns: string[]; rows: (string | number | null)[][]; entityType?: string; idColumn?: number; summary: string; }
interface ChartResult { type: "chart"; chartType: "bar" | "pie"; title: string; data: { name: string; value: number }[]; summary: string; }
interface TextResult { type: "text"; summary: string; }
type AIResult = TableResult | ChartResult | TextResult;

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  result?: AIResult;
  extra?: AIResult;
  isLoading?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cotizacionId?: string;
  cotizacionTitulo?: string;
}

// ─── Chip suggestions ─────────────────────────────────────────────────────────

const CHIPS = [
  "¿Cuál es el margen de esta cotización?",
  "Resumen ejecutivo para el cliente",
  "¿Qué otros hoteles usamos en los mismos destinos?",
  "Compara los precios de proveedores de esta cotización con el histórico",
  "¿Hay líneas sin proveedor?",
  "Detecta posibles problemas",
  "¿Cuál es el coste por viajero?",
  "Resumen del itinerario día a día",
];

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
                      const isCurrency = isNum && /neto|pvp|total|coste|precio|beneficio|importe|€/.test(colName);
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

function Bubble({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <div style={{ maxWidth: "85%", padding: "10px 14px", background: "var(--primary-color, #4f46e5)", color: "#fff", fontSize: "0.85rem", borderRadius: "12px 12px 2px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "12px" }}>
      <div style={{ maxWidth: "92%", padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", color: "#1e293b", fontSize: "0.85rem", borderRadius: "12px 12px 12px 2px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {msg.isLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", padding: "2px 0" }}>
            <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: "0.78rem" }}>Consultando datos…</span>
          </div>
        ) : (
          <>
            <p style={{ lineHeight: 1.55, whiteSpace: "pre-wrap", margin: 0 }}>{msg.text}</p>
            {msg.result && <ResultBlock result={msg.result} />}
            {msg.extra && <ResultBlock result={msg.extra} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CotizacionCopilotoDrawer({ isOpen, onClose, cotizacionId, cotizacionTitulo }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        text: `Hola, soy tu Copilot de cotizaciones${cotizacionTitulo ? ` para "${cotizacionTitulo}"` : ""}. Puedo analizar márgenes, detectar problemas, generar resúmenes y responder cualquier pregunta sobre esta cotización. ¿Qué quieres saber?`,
      }]);
    }
  }, [isOpen]);

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

    try {
      const res = await fetch("/api/cotizaciones/copiloto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, cotizacionId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Error");
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
  }, [messages, isLoading, cotizacionId]);

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 9040 }} />

      <div style={{
        position: "fixed", top: 0, right: 0, height: "100%", width: "680px", maxWidth: "100vw",
        zIndex: 9050, display: "flex", flexDirection: "column",
        background: "#fff", boxShadow: "-4px 0 32px rgba(15,23,42,0.18)",
        animation: "cotCopilotoIn 0.22s ease-out",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--header-bg, #0f172a)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--primary-color, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={16} color="#fff" />
            </div>
            <div>
              <p style={{ color: "#fff", fontSize: "0.83rem", fontWeight: 600, margin: 0, lineHeight: 1.2 }}>Copilot de Cotizaciones</p>
              <p style={{ color: "#64748b", fontSize: "0.62rem", margin: 0, lineHeight: 1.2 }}>
                {cotizacionTitulo ? `"${cotizacionTitulo}"` : "Analiza tu cotización"}
              </p>
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
          {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e2e8f0", background: "#fff", padding: "10px 14px 14px", flexShrink: 0 }}>
          {/* Chips */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
            {CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                disabled={isLoading}
                style={{ flexShrink: 0, padding: "3px 10px", fontSize: "0.68rem", color: "#475569", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "99px", cursor: "pointer", whiteSpace: "nowrap" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary-color, #4f46e5)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--primary-color, #4f46e5)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLButtonElement).style.color = "#475569"; }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "8px 10px" }}
            onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary-color, #818cf8)"}
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
              placeholder="Haz una pregunta sobre esta cotización…"
              rows={1}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: "0.83rem", color: "#1e293b", lineHeight: 1.5, maxHeight: "160px", overflowY: "auto" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              style={{ flexShrink: 0, width: "28px", height: "28px", borderRadius: "8px", background: isLoading || !input.trim() ? "color-mix(in srgb, var(--primary-color, #4f46e5) 40%, white)" : "var(--primary-color, #4f46e5)", border: "none", cursor: isLoading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
            >
              {isLoading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={13} />}
            </button>
          </div>
          <p style={{ fontSize: "0.6rem", color: "#cbd5e1", marginTop: "5px" }}>Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>

      <style>{`
        @keyframes cotCopilotoIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
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
