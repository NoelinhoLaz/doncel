"use client";

import { useState, useRef } from "react";
import { User } from "lucide-react";

export function ResponsablesTooltip({ contactos }: { contactos: { id: string; nombre: string; cargo: string | null; telefono: string | null; email: string | null; metadatos?: { estrategia?: string; horarios?: string; poder_decision?: string; movil?: string } | null }[] }) {
  const [tooltip, setTooltip] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const TOOLTIP_H = contactos.length * 72;
  const TOOLTIP_W = 300;

  function handleEnter() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const above = r.top > window.innerHeight / 2;
    setTooltip({
      top: above ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - TOOLTIP_W - 8)),
      above,
    });
  }

  if (!contactos.length) return <span style={{ color: "#e2e8f0", fontSize: "0.7rem" }}>—</span>;

  const sinContacto = contactos.some(c => !c.nombre || !c.telefono && !c.metadatos?.movil || !c.email);

  return (
    <div ref={ref} style={{ display: "inline-flex" }} onMouseEnter={handleEnter} onMouseLeave={() => setTooltip(null)}>
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.75rem", fontWeight: 600, color: "#475569", cursor: "default" }}>
        <span style={{ position: "relative", display: "inline-flex", paddingTop: sinContacto ? 4 : 0 }}>
          <User size={12} style={{ opacity: 0.5 }} />
          {sinContacto && (
            <span style={{
              position: "absolute", top: -3, right: -4,
              width: 7, height: 7, borderRadius: "50%",
              background: "#eab308", border: "1.5px solid #fff",
            }} />
          )}
        </span>
        {contactos.length}
      </span>
      {tooltip && (
        <div style={{
          position: "fixed",
          top: tooltip.above ? undefined : tooltip.top,
          bottom: tooltip.above ? window.innerHeight - tooltip.top : undefined,
          left: tooltip.left,
          zIndex: 99999,
          background: "#1e293b", borderRadius: 8, padding: "0.5rem 0",
          boxShadow: "0 8px 24px rgba(15,23,42,0.22)", width: "max-content", maxWidth: TOOLTIP_W,
          pointerEvents: "none",
        }}>
          {contactos.map((c, i) => {
            const sinNombre = !c.nombre;
            const sinTlf = !c.telefono && !c.metadatos?.movil;
            const sinEmail = !c.email;
            return (
              <div key={c.id} style={{
                padding: "0.35rem 0.75rem",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.07)" : undefined,
              }}>
                {sinNombre
                  ? <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#eab308", lineHeight: 1.3 }}>⚠ Nombre no registrado</div>
                  : <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#f1f5f9", lineHeight: 1.3 }}>{c.nombre}</div>
                }
                {c.cargo && <div style={{ fontSize: "0.68rem", color: "#94a3b8", lineHeight: 1.3 }}>{c.cargo}</div>}
                {sinTlf
                  ? <div style={{ fontSize: "0.68rem", color: "#eab308", lineHeight: 1.3 }}>⚠ Teléfono no registrado</div>
                  : <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.3 }}>{c.telefono || c.metadatos?.movil}</div>
                }
                {sinEmail
                  ? <div style={{ fontSize: "0.68rem", color: "#eab308", lineHeight: 1.3 }}>⚠ Email no registrado</div>
                  : <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.3 }}>{c.email}</div>
                }
                {c.metadatos?.estrategia && (
                  <div style={{ fontSize: "0.67rem", color: "#7dd3a8", lineHeight: 1.4, marginTop: 2, fontStyle: "italic", maxWidth: 260, whiteSpace: "pre-wrap" }}>
                    {c.metadatos.estrategia}
                  </div>
                )}
                {c.metadatos?.horarios && (
                  <div style={{ fontSize: "0.66rem", color: "#94a3b8", lineHeight: 1.3, marginTop: 1 }}>⏰ {c.metadatos.horarios}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
