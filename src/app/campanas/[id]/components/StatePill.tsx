"use client";

import { useState, useRef } from "react";
import { formatNotasTooltip } from "../utils";

export function StatePill({ color, mono = false, fecha, notas }: { color: string; mono?: boolean; fecha?: string | null; notas?: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const notasTexto = formatNotasTooltip(notas);
  const [tooltip, setTooltip] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const bg = mono ? "color-mix(in srgb, var(--primary-color, #475569) 55%, white)" : color;
  const label = fecha
    ? new Date(fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "✓";

  function handleEnter() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const TOOLTIP_W = 280;
    const above = r.top > window.innerHeight / 2;
    setTooltip({
      top: above ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - TOOLTIP_W - 8)),
      above,
    });
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setTooltip(null)}
        style={{
          display: "inline-flex", alignItems: "center", height: 18, borderRadius: 99,
          background: bg, color: "#fff", fontSize: "0.65rem", fontWeight: 600,
          padding: "0 7px", whiteSpace: "nowrap",
          cursor: "default",
          outline: tooltip ? "2px solid rgba(255,255,255,0.4)" : undefined,
        }}
      >
        {label}
      </span>
      {tooltip && (
        <div style={{
          position: "fixed",
          top: tooltip.above ? undefined : tooltip.top,
          bottom: tooltip.above ? window.innerHeight - tooltip.top : undefined,
          left: tooltip.left,
          zIndex: 99999,
          background: "#1e293b", borderRadius: 8, padding: "0.5rem 0.75rem",
          boxShadow: "0 8px 24px rgba(15,23,42,0.22)", maxWidth: 280,
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: "0.72rem", color: notasTexto ? "#94a3b8" : "#475569", lineHeight: 1.5, whiteSpace: "pre-wrap", fontStyle: notasTexto ? "normal" : "italic" }}>{notasTexto || "Sin datos"}</div>
        </div>
      )}
    </>
  );
}
