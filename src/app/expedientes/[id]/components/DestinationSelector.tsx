"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Check, ChevronDown, X, MapPin } from "lucide-react";
import { getDestinos, createDestino, createDestinoFromPlace } from "@/actions/destinos";
import { searchPlaces, getPlaceDetails } from "@/actions/places";
import type { PlaceSuggestion } from "@/actions/places";

interface DestinationSelectorProps {
  value: string;
  onChange: (value: string, name?: string) => void;
  compact?: boolean;
  label?: string;
}

const MIN_SEARCH_CHARS = 3;

export default function DestinationSelector({ value, onChange, compact, label }: DestinationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [destinos, setDestinos] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Google Places search (used from the "add new destino" form)
  const [showPlacesPanel, setShowPlacesPanel] = useState(false);
  const [placesQuery, setPlacesQuery] = useState("");
  const [placesSuggestions, setPlacesSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const placesInputRef = useRef<HTMLInputElement>(null);
  const placesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load destinos if no label provided (needed to resolve the trigger's display name) —
  // avoids one getDestinos() call per empty-destino row on every table refresh.
  useEffect(() => {
    if (label || !value) { setDataLoaded(true); return; }
    async function load() {
      try {
        const destsData = await getDestinos();
        setDestinos(destsData || []);
      } catch (err) {
        console.error("Error loading destinos:", err);
      } finally {
        setDataLoaded(true);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, value]);

  // Focus Places input when panel opens
  useEffect(() => {
    if (showPlacesPanel && placesInputRef.current) {
      setTimeout(() => placesInputRef.current?.focus(), 50);
    }
  }, [showPlacesPanel]);

  // Debounced Places search
  useEffect(() => {
    if (!showPlacesPanel) return;
    if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    if (placesQuery.trim().length < 2) {
      setPlacesSuggestions([]);
      return;
    }
    placesDebounceRef.current = setTimeout(async () => {
      setPlacesLoading(true);
      try {
        const results = await searchPlaces(placesQuery);
        setPlacesSuggestions(results);
      } catch {
        setPlacesSuggestions([]);
      } finally {
        setPlacesLoading(false);
      }
    }, 300);
    return () => {
      if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    };
  }, [placesQuery, showPlacesPanel]);

  const getDestinoName = (id: string) => {
    const found = destinos.find(d => d.id === id);
    return found?.nombre || id;
  };

  const openModal = async () => {
    setSearchTerm("");
    setShowPlacesPanel(false);
    setPlacesQuery("");
    setPlacesSuggestions([]);
    const destsData = await getDestinos();
    setDestinos(destsData || []);
    setDataLoaded(true);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setShowPlacesPanel(false);
    setPlacesQuery("");
    setPlacesSuggestions([]);
  };

  const handleSelect = (destId: string, destName: string) => {
    onChange(destId, destName);
    closeModal();
  };

  const handleSelectPlace = async (suggestion: PlaceSuggestion) => {
    setPlacesLoading(true);
    try {
      const details = await getPlaceDetails(suggestion.placeId);
      if (!details) throw new Error("No se obtuvieron detalles del lugar");
      const newDest = await createDestinoFromPlace(details);
      if (newDest) {
        setDestinos(prev => [...prev, newDest].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        handleSelect(newDest.id, newDest.nombre);
      }
    } catch (err: any) {
      alert("Error al crear destino: " + err.message);
    } finally {
      setPlacesLoading(false);
    }
  };

  const handleSaveWithoutGoogle = async () => {
    const name = placesQuery.trim() || searchTerm.trim();
    if (!name) return;
    setPlacesLoading(true);
    try {
      const newDest = await createDestino(name);
      if (newDest) {
        setDestinos(prev => [...prev, newDest].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        handleSelect(newDest.id, newDest.nombre);
      }
    } catch (err: any) {
      alert("Error al crear destino: " + err.message);
    } finally {
      setPlacesLoading(false);
    }
  };

  const filteredDestinos = searchTerm.trim().length >= MIN_SEARCH_CHARS
    ? destinos.filter((d) => d.nombre.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    : destinos.slice(0, 5);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Trigger */}
      <div
        onClick={openModal}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: compact ? "0.1rem 0.3rem" : "0.5rem 0.75rem",
          borderRadius: compact ? "6px" : "0.375rem",
          border: "1px solid #cbd5e1",
          fontSize: compact ? "0.7rem" : "0.85rem",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          cursor: "pointer",
          outline: "none",
          height: compact ? "25px" : "38px",
          boxSizing: "border-box"
        }}
      >
        <span style={{ color: value ? "#0f172a" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
          {value ? (label || (dataLoaded ? getDestinoName(value) : "")) : "Seleccionar..."}
        </span>
        {value && (
          <X
            size={12}
            style={{ color: "#94a3b8", flexShrink: 0, marginRight: 2 }}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          />
        )}
        <ChevronDown size={14} style={{ color: "#64748b", flexShrink: 0 }} />
      </div>

      {/* Modal */}
      {isOpen && (
        <div
          onClick={closeModal}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "380px",
              maxHeight: "70vh",
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {!showPlacesPanel ? (
              <>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1rem 0.6rem 1rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>Seleccionar destino</h3>
                  <button onClick={closeModal} style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}>
                    <X size={14} />
                  </button>
                </div>

                {/* Search Header */}
                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #f1f5f9", borderTop: "1px solid #f1f5f9", padding: "0.5rem 1rem", gap: "0.5rem" }}>
                  <Search size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Buscar destino..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                    style={{
                      border: "none",
                      outline: "none",
                      width: "100%",
                      fontSize: "0.85rem",
                      color: "#0f172a",
                      backgroundColor: "transparent",
                      padding: "0.25rem 0"
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.15rem", flexShrink: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {searchTerm.trim().length > 0 && searchTerm.trim().length < MIN_SEARCH_CHARS && (
                  <div style={{ padding: "0.5rem 1rem", fontSize: "0.72rem", color: "#94a3b8" }}>
                    Escribe al menos {MIN_SEARCH_CHARS} letras para buscar
                  </div>
                )}

                {/* Destinos List */}
                <div style={{ maxHeight: "280px", overflowY: "auto", padding: "0.25rem 0" }}>
                  {filteredDestinos.length > 0 ? (
                    <>
                      <div style={{ padding: "0.35rem 1rem", fontSize: "0.7rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {searchTerm.trim().length >= MIN_SEARCH_CHARS ? "Resultados de búsqueda" : "5 destinos"}
                      </div>
                      {filteredDestinos.map((dest) => {
                        const isSelected = value === dest.id;
                        return (
                          <div
                            key={dest.id}
                            onClick={() => handleSelect(dest.id, dest.nombre)}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.5rem 1rem",
                              cursor: "pointer",
                              backgroundColor: isSelected ? "#f0fdf4" : "transparent",
                              transition: "background-color 0.15s",
                              borderBottom: "1px solid #f8fafc"
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <span style={{ fontWeight: isSelected ? "600" : "400", fontSize: "0.85rem", color: "#0f172a" }}>{dest.nombre}</span>
                            {isSelected && <Check size={16} style={{ color: "#22c55e" }} />}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div style={{ padding: "1.5rem 1rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>
                        No se encontraron destinos
                      </div>
                      {searchTerm.trim().length >= MIN_SEARCH_CHARS && (
                        <span
                          onClick={() => { setPlacesQuery(searchTerm); setShowPlacesPanel(true); }}
                          style={{ color: "var(--primary-color, #475569)", fontWeight: "600", cursor: "pointer", textDecoration: "underline", fontSize: "0.8rem" }}
                        >
                          Buscar con Google Places
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div style={{ borderTop: "1px solid #f1f5f9", padding: "0.6rem 1rem", backgroundColor: "#f8fafc" }}>
                  <button
                    type="button"
                    onClick={() => { setPlacesQuery(searchTerm); setShowPlacesPanel(true); }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px dashed #cbd5e1",
                      backgroundColor: "#ffffff",
                      color: "var(--primary-color, #475569)",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f1f5f9";
                      e.currentTarget.style.borderColor = "#94a3b8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                      e.currentTarget.style.borderColor = "#cbd5e1";
                    }}
                  >
                    <Plus size={14} />
                    <span>Añadir nuevo destino</span>
                  </button>
                </div>
              </>
            ) : (
              /* Google Places Panel */
              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#0f172a" }}>
                    Nuevo destino
                  </span>
                  <button
                    type="button"
                    onClick={() => { setShowPlacesPanel(false); setPlacesQuery(""); setPlacesSuggestions([]); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Places Search Input */}
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    ref={placesInputRef}
                    type="text"
                    placeholder="Ej: Barcelona, Cancún, Maldivas..."
                    value={placesQuery}
                    onChange={(e) => setPlacesQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem 0.45rem 1.8rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.8rem",
                      outline: "none",
                      backgroundColor: "#ffffff",
                      color: "#0f172a",
                      boxSizing: "border-box"
                    }}
                  />
                  {placesLoading && (
                    <div style={{
                      position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                      width: "12px", height: "12px", border: "2px solid #cbd5e1",
                      borderTopColor: "var(--primary-color, #475569)", borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                  )}
                </div>

                {/* Autocomplete Suggestions */}
                {placesSuggestions.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "180px", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "0.25rem", padding: "0.2rem" }}>
                    {placesSuggestions.map((s) => (
                      <div
                        key={s.placeId}
                        onClick={() => handleSelectPlace(s)}
                        style={{
                          padding: "0.4rem 0.6rem",
                          borderRadius: "0.2rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.4rem",
                          transition: "background-color 0.15s"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <MapPin size={12} style={{ minWidth: "12px", color: "#475569", marginTop: "1px" }} />
                        <div>
                          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}>{s.mainText}</div>
                          {s.secondaryText && (
                            <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{s.secondaryText}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!placesLoading && placesQuery.trim().length >= 2 && placesSuggestions.length === 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", padding: "0.25rem 0" }}>
                    Sin resultados en Google Places
                  </div>
                )}

                {/* Plain text save option */}
                {placesQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveWithoutGoogle}
                    style={{
                      background: "none",
                      border: "1px dashed #cbd5e1",
                      color: "#64748b",
                      fontSize: "0.75rem",
                      borderRadius: "0.25rem",
                      padding: "0.4rem 0.6rem",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      marginTop: "0.2rem"
                    }}
                  >
                    Guardar "{placesQuery}" sin datos de Google
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
