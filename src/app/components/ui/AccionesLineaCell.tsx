"use client";

import { useState, useEffect } from "react";
import { Link as LinkIcon, MoreVertical } from "lucide-react";

export interface AccionLinea {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  rowId: string;
  isLinked: boolean;
  linkTitleLinked?: string;
  linkTitleUnlinked?: string;
  actions: AccionLinea[];
  saveStatus?: "saving" | "saved" | "error" | null;
  onLinkClick?: () => void;
}

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "2px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "4px",
  transition: "all 0.15s ease",
};

export default function AccionesLineaCell({
  rowId,
  isLinked,
  linkTitleLinked = "Vinculado",
  linkTitleUnlinked = "No vinculado",
  actions,
  saveStatus,
  onLinkClick,
}: Props) {
  const [openActionsRowId, setOpenActionsRowId] = useState<string | null>(null);
  const isOpen = openActionsRowId === rowId;

  useEffect(() => {
    if (!openActionsRowId) return;
    const close = () => setOpenActionsRowId(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [openActionsRowId]);

  return (
    <div style={{ display: "flex", gap: "1px", justifyContent: "flex-end", alignItems: "center" }}>
      {!isLinked && onLinkClick ? (
        <button
          type="button"
          title="Añadir a la cotización"
          onClick={onLinkClick}
          style={{ ...iconBtnStyle, padding: "2px" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <LinkIcon size={13} strokeWidth={2.75} style={{ color: "#cbd5e1" }} />
        </button>
      ) : (
        <span title={isLinked ? linkTitleLinked : linkTitleUnlinked} style={{ display: "inline-flex", alignItems: "center", padding: "2px" }}>
          <LinkIcon size={13} strokeWidth={2.75} style={{ color: isLinked ? "#2563eb" : "#cbd5e1" }} />
        </span>
      )}

      {saveStatus === "saving" && <div title="Guardando..." style={{ width: 12, height: 12, border: "2px solid #cbd5e1", borderTopColor: "var(--primary-color, #475569)", borderRadius: "50%", animation: "acciones-linea-spin 0.8s linear infinite" }} />}
      {saveStatus === "saved" && <span title="Guardado" style={{ color: "#22c55e", fontSize: "14px", lineHeight: 1 }}>✓</span>}
      {saveStatus === "error" && <span title="Error al guardar" style={{ color: "#ef4444", fontSize: "12px", lineHeight: 1 }}>⚠</span>}

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", right: "100%", top: 0, bottom: 0, zIndex: 60,
            display: "flex", alignItems: "center", gap: isOpen ? "6px" : "0px",
            padding: isOpen ? "0.4rem 0.6rem" : "0px",
            maxWidth: isOpen ? "260px" : "0px",
            opacity: isOpen ? 1 : 0,
            overflow: "hidden",
            pointerEvents: isOpen ? "auto" : "none",
            backgroundColor: "#fff",
            borderRadius: "6px",
            transition: "max-width 0.22s ease, opacity 0.18s ease, gap 0.22s ease, padding 0.22s ease",
          }}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { action.onClick(); setOpenActionsRowId(null); }}
              title={action.title}
              style={{ ...iconBtnStyle, color: action.danger ? "#94a3b8" : "#64748b" }}
              onMouseEnter={(e) => {
                if (action.danger) { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.backgroundColor = "#fef2f2"; }
                else { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.color = "#1e293b"; }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = action.danger ? "#94a3b8" : "#64748b";
              }}
            >
              {action.icon}
            </button>
          ))}
        </div>

        <button
          type="button"
          style={iconBtnStyle}
          title="Más acciones"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setOpenActionsRowId(isOpen ? null : rowId)}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <MoreVertical size={13} strokeWidth={2.75} />
        </button>
      </div>

      <style jsx global>{`
        @keyframes acciones-linea-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
