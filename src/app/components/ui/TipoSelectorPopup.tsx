"use client";

import TipoIcon from "@/app/components/cotizacion/TipoIcon";
import tablaStyles from "@/app/components/cotizacion/tabla.module.css";

export interface TipoOption {
  id: string;
  label: string;
  icono?: string;
}

interface Props {
  tipos: TipoOption[];
  selectedId?: string | null;
  selectedIcono?: string;
  selectedLabel?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (tipoId: string) => void;
  disabled?: boolean;
  /** Si se pasa junto a onSetOpcional, muestra un toggle Todos/Opcional dentro del popup */
  opcional?: boolean;
  onSetOpcional?: (opcional: boolean) => void;
}

export default function TipoSelectorPopup({
  tipos,
  selectedId,
  selectedIcono,
  selectedLabel,
  isOpen,
  onToggle,
  onSelect,
  disabled,
  opcional,
  onSetOpcional,
}: Props) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        title={selectedLabel || "Cambiar tipo"}
        disabled={disabled}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        style={{
          width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
          background: isOpen ? "#eef2ff" : "#f1f5f9",
          border: isOpen ? "1px solid #6366f1" : "1px solid transparent",
          borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <TipoIcon iconName={selectedIcono} size={14} />
      </button>
      {isOpen && (
        <div
          className={tablaStyles.tipoPopup}
          style={{ top: "50%", left: "calc(100% + 4px)", right: "auto", bottom: "auto", transform: "translateY(-50%)", marginTop: 0, flexDirection: "column", alignItems: "stretch", padding: "0.4rem" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {onSetOpcional && (
            <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.4rem" }}>
              <button
                type="button"
                onClick={() => onSetOpcional(false)}
                style={{
                  flex: 1, padding: "0.3rem 0.4rem", fontSize: "0.68rem", fontWeight: 600, borderRadius: 6, cursor: "pointer",
                  border: !opcional ? "1px solid var(--primary-color, #475569)" : "1px solid #e2e8f0",
                  background: !opcional ? "#f1f5f9" : "#fff",
                  color: !opcional ? "#0f172a" : "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => onSetOpcional(true)}
                style={{
                  flex: 1, padding: "0.3rem 0.4rem", fontSize: "0.68rem", fontWeight: 600, borderRadius: 6, cursor: "pointer",
                  border: opcional ? "1px solid #f97316" : "1px solid #e2e8f0",
                  background: opcional ? "#fff7ed" : "#fff",
                  color: opcional ? "#9a3412" : "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                Opcional
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem" }}>
          {tipos.map((t) => {
            const isSelected = selectedId === t.id;
            return (
              <div
                key={t.id}
                title={t.label}
                className={tablaStyles.tipoPopupItem}
                style={{ background: isSelected ? "#eef2ff" : undefined, color: isSelected ? "#6366f1" : "#64748b" }}
                onClick={() => onSelect(t.id)}
              >
                <TipoIcon iconName={t.icono} size={14} />
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
