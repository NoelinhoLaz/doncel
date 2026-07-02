"use client";

import { useState, useRef } from "react";

export function EstadoBubble({ est, idx, offset, mono }: {
  est: { nombre: string; color: string; descripcion: string | null; campana: string | null; estrategia?: string | null; campanaCreatedAt?: string | null };
  idx: number;
  offset: number;
  mono: boolean;
}) {
  const [tooltip, setTooltip] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const SIZE = 22;
  const TOOLTIP_MAX_H = 220;
  const TOOLTIP_W = 380;
  const bg = mono ? "color-mix(in srgb, var(--primary-color, #475569) 60%, white)" : est.color;
  const iniciales = est.nombre.split(/[\s.]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  function handleEnter() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const above = r.top > window.innerHeight / 2;
    const left = Math.min(r.left, window.innerWidth - TOOLTIP_W - 8);
    setTooltip({
      top: above ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, left),
      above,
    });
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setTooltip(null)}
        style={{
          position: "absolute",
          left: offset,
          zIndex: tooltip ? 10 : idx + 1,
          width: SIZE, height: SIZE,
          borderRadius: 99,
          background: bg,
          color: "#fff",
          border: "1.5px solid #fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.6rem", fontWeight: 700,
          cursor: "default", whiteSpace: "nowrap",
        }}
      >
        {iniciales}
      </div>
      {tooltip && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            top: tooltip.above ? undefined : tooltip.top,
            bottom: tooltip.above ? window.innerHeight - tooltip.top : undefined,
            left: tooltip.left,
            zIndex: 99999,
            background: "#1e293b", borderRadius: 8, padding: "0.5rem 0.75rem",
            boxShadow: "0 8px 24px rgba(15,23,42,0.22)", maxWidth: TOOLTIP_W, minWidth: 280,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: (est.descripcion || est.estrategia) ? 6 : 0 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: est.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f1f5f9" }}>{est.nombre}</span>
            {est.campana && <span style={{ fontSize: "0.65rem", color: "#64748b", marginLeft: 2 }}>· {est.campana}</span>}
          </div>
          {est.descripcion && (
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {est.descripcion}
            </div>
          )}
          {est.estrategia && (
            <div style={{ fontSize: "0.71rem", color: "#7dd3a8", lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: est.descripcion ? 4 : 0, fontStyle: "italic" }}>
              {est.estrategia}
            </div>
          )}
          {!est.descripcion && !est.estrategia && (
            <div style={{ fontSize: "0.7rem", color: "#475569", fontStyle: "italic" }}>Sin notas</div>
          )}
        </div>
      )}
    </>
  );
}

export function EstadosBubbles({ estados, mono = false }: { estados: { nombre: string; color: string; descripcion: string | null; campana: string | null; estrategia?: string | null; campanaCreatedAt?: string | null }[]; mono?: boolean }) {
  if (!estados.length) return <span style={{ color: "#e2e8f0", fontSize: "0.7rem" }}>—</span>;
  // Ordenar por fecha de campaña ASC: más antiguo a la izquierda, más reciente a la derecha
  const ordered = [...estados].sort((a, b) => {
    if (!a.campanaCreatedAt && !b.campanaCreatedAt) return 0;
    if (!a.campanaCreatedAt) return 1;
    if (!b.campanaCreatedAt) return -1;
    return a.campanaCreatedAt < b.campanaCreatedAt ? -1 : 1;
  });
  const SIZE = 22;
  const OVERLAP = 8;
  const totalW = ordered.length * SIZE - (ordered.length - 1) * OVERLAP;
  return (
    <div style={{ position: "relative", width: totalW, height: SIZE, display: "inline-flex" }}>
      {ordered.map((est, i) => (
        <EstadoBubble key={i} est={est} idx={i} offset={i * (SIZE - OVERLAP)} mono={mono} />
      ))}
    </div>
  );
}
