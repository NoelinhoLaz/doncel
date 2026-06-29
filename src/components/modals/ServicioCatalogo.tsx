"use client";

import * as LucideIcons from "lucide-react";
import { Plus } from "lucide-react";

interface Props {
  opcional: boolean;
  templateSearch: string;
  onSearchChange: (v: string) => void;
  displayTemplates: any[];
  onSelectTemplate: (t: any) => void;
  onCreateFromScratch: () => void;
}

export default function ServicioCatalogo({
  templateSearch,
  onSearchChange,
  displayTemplates,
  onSelectTemplate,
  onCreateFromScratch,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <LucideIcons.Search size={14} style={{ position: "absolute", left: "10px", color: "#94a3b8" }} />
        <input
          type="text"
          placeholder="Buscar servicios o proveedores registrados..."
          value={templateSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            padding: "0.45rem 0.5rem 0.45rem 2rem",
            borderRadius: "0.375rem",
            border: "1px solid #cbd5e1",
            fontSize: "0.8rem",
            outline: "none",
            backgroundColor: "#ffffff",
            color: "#0f172a",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
          {templateSearch.trim() === ""
            ? `Top Servicios (${displayTemplates.length})`
            : `Resultados encontrados (${displayTemplates.length})`}
        </span>
      </div>

      <div style={{ border: "1px solid #cbd5e1", borderRadius: "0.5rem", overflow: "hidden", maxHeight: "250px", overflowY: "auto", backgroundColor: "#f8fafc" }}>
        {displayTemplates.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b", fontStyle: "italic", backgroundColor: "#ffffff" }}>
            No se encontraron servicios que coincidan con la búsqueda.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.5rem" }}>
            {displayTemplates.map((template: any) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelectTemplate(template)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
              >
                {template.isMostUsed && (
                  <div style={{ color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <LucideIcons.Flame size={16} />
                  </div>
                )}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <span style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {template.descripcion}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "0.1rem" }}>
                    <span style={{ color: "#64748b", fontSize: "0.75rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {template.proveedor || "Sin proveedor"}
                    </span>
                    {(() => {
                      const det = typeof template.detalles === 'string' ? (() => { try { return JSON.parse(template.detalles); } catch { return {}; } })() : (template.detalles || {});
                      const rating = det?.rating_google ?? null;
                      if (!rating) return null;
                      const stars = Math.round(rating);
                      return (
                        <span style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                          <span style={{ color: "#f59e0b", fontSize: "0.7rem", letterSpacing: 0.5 }}>{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b" }}>{Number(rating).toFixed(1)}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCreateFromScratch}
        style={{
          marginTop: "0.25rem",
          backgroundColor: "#ffffff",
          border: "1px dashed #cbd5e1",
          borderRadius: "0.375rem",
          padding: "0.6rem",
          fontSize: "0.8rem",
          fontWeight: "600",
          color: "var(--primary-color, #475569)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.25rem",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#94a3b8"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
      >
        <Plus size={14} />
        <span>Crear servicio de cero</span>
      </button>
    </div>
  );
}
