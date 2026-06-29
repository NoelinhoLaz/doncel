"use client";

import { MapPin } from "lucide-react";
import { Icons } from "@/lib/icons";
import type { PlaceSuggestion } from "@/actions/places";
import s from "@/components/modals/nuevoExpediente.module.css";

interface Props {
  destinos: any[];
  destinoPrincipal: string;
  onDestinoChange: (id: string) => void;
  searchDestino: string;
  onSearchChange: (v: string) => void;
  isDropdownOpen: boolean;
  onDropdownChange: (v: boolean) => void;
  showPlacesPanel: boolean;
  placesQuery: string;
  onPlacesQueryChange: (v: string) => void;
  placesSuggestions: PlaceSuggestion[];
  placesLoading: boolean;
  placesInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenPlaces: () => void;
  onClosePlaces: () => void;
  onSelectPlace: (s: PlaceSuggestion) => void;
  onSaveWithoutGoogle: () => void;
  disabled?: boolean;
}

const triggerStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1",
  fontSize: "0.85rem", backgroundColor: "#ffffff", display: "flex",
  justifyContent: "space-between", alignItems: "center", minHeight: "38px", cursor: "pointer",
};

export default function DestinoConPlacesField({ destinos, destinoPrincipal, onDestinoChange, searchDestino, onSearchChange, isDropdownOpen, onDropdownChange, showPlacesPanel, placesQuery, onPlacesQueryChange, placesSuggestions, placesLoading, placesInputRef, onOpenPlaces, onClosePlaces, onSelectPlace, onSaveWithoutGoogle, disabled }: Props) {
  const filteredDestinos = destinos.filter(d => d.nombre.toLowerCase().includes(searchDestino.toLowerCase()));

  return (
    <div className={s.fieldWrap}>
      <label className={s.fieldLabel}>Destino Principal *</label>

      <div onClick={() => !disabled && onDropdownChange(!isDropdownOpen)} style={{ ...triggerStyle, cursor: disabled ? "not-allowed" : "pointer" }}>
        <span style={{ color: destinoPrincipal ? "#0f172a" : "#94a3b8" }}>
          {destinos.find(d => d.id === destinoPrincipal)?.nombre || "Seleccionar destino"}
        </span>
        <Icons.ChevronDown size={14} style={{ color: "#64748b", transform: isDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </div>

      {isDropdownOpen && <div onClick={() => onDropdownChange(false)} style={{ position: "fixed", inset: 0, zIndex: 2050 }} />}

      {isDropdownOpen && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem", marginTop: "4px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 2100, display: "flex", flexDirection: "column", maxHeight: "260px" }}>
          {/* Search + Add */}
          <div style={{ display: "flex", padding: "0.5rem", gap: "0.5rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Icons.Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input type="text" placeholder="Buscar destino..." value={searchDestino} onChange={(e) => onSearchChange(e.target.value)} onClick={(e) => e.stopPropagation()} className={s.inp} style={{ paddingLeft: "1.75rem" }} />
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenPlaces(); }} style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap" }}>
              <Icons.Add size={12} /><span>Nuevo</span>
            </button>
          </div>

          {/* Google Places sub-panel */}
          {showPlacesPanel && (
            <div style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>🔍 Buscar con Google Places</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onClosePlaces(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px" }}><Icons.Close size={12} /></button>
              </div>
              <div style={{ position: "relative" }}>
                <Icons.Search size={13} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                <input
                  ref={placesInputRef}
                  type="text"
                  placeholder="Ej: Barcelona, Cancún, Maldivas..."
                  value={placesQuery}
                  onChange={(e) => { e.stopPropagation(); onPlacesQueryChange(e.target.value); }}
                  onClick={(e) => e.stopPropagation()}
                  className={s.inp}
                  style={{ paddingLeft: "1.75rem" }}
                />
                {placesLoading && <div className={s.spinnerSm} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }} />}
              </div>
              {placesSuggestions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "140px", overflowY: "auto" }}>
                  {placesSuggestions.map((suggestion) => (
                    <div key={suggestion.placeId} onClick={(e) => { e.stopPropagation(); onSelectPlace(suggestion); }} style={{ padding: "0.45rem 0.6rem", borderRadius: "0.25rem", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#e2e8f0"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <MapPin size={16} style={{ minWidth: "16px", color: "#0f172a", marginTop: "2px" }} />
                      <div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}>{suggestion.mainText}</div>
                        {suggestion.secondaryText && <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{suggestion.secondaryText}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!placesLoading && placesQuery.trim().length >= 2 && placesSuggestions.length === 0 && (
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", padding: "0.5rem 0" }}>Sin resultados en Google Places</div>
              )}
              {placesQuery.trim().length > 0 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onSaveWithoutGoogle(); }} style={{ background: "none", border: "1px dashed #cbd5e1", color: "#64748b", fontSize: "0.72rem", borderRadius: "0.375rem", padding: "0.3rem 0.6rem", cursor: "pointer", textAlign: "left", width: "100%" }}>
                  Guardar "{placesQuery}" sin datos de Google
                </button>
              )}
            </div>
          )}

          {/* Options list */}
          <div style={{ overflowY: "auto", padding: "0.25rem" }}>
            {filteredDestinos.length === 0 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                {searchDestino.trim() ? (
                  <>No se encontró "{searchDestino}"<br />
                    <span onClick={(e) => { e.stopPropagation(); onOpenPlaces(); }} style={{ color: "var(--primary-color, #475569)", fontWeight: 600, cursor: "pointer", textDecoration: "underline", marginTop: "4px", display: "inline-block" }}>
                      Crear "{searchDestino}" con Google Places
                    </span>
                  </>
                ) : "No hay destinos configurados"}
              </div>
            ) : filteredDestinos.map((dest) => (
              <div key={dest.id}
                onClick={() => { onDestinoChange(dest.id); onDropdownChange(false); onSearchChange(""); }}
                style={{ padding: "0.5rem 0.75rem", borderRadius: "0.25rem", fontSize: "0.8rem", cursor: "pointer", backgroundColor: destinoPrincipal === dest.id ? "var(--primary-color, #475569)" : "transparent", color: destinoPrincipal === dest.id ? "#fff" : "#334155", transition: "background-color 0.2s" }}
                onMouseEnter={(e) => { if (destinoPrincipal !== dest.id) e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                onMouseLeave={(e) => { if (destinoPrincipal !== dest.id) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {dest.nombre}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
