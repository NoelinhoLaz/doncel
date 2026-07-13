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
          style={{ top: "50%", left: "calc(100% + 4px)", right: "auto", bottom: "auto", transform: "translateY(-50%)", marginTop: 0 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
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
      )}
    </div>
  );
}
