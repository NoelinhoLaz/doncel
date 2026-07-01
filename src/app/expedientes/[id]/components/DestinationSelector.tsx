"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Check, ChevronDown, Loader2, X, MapPin } from "lucide-react";
import { getDestinos, createDestino, createDestinoFromPlace } from "@/actions/destinos";
import { searchPlaces, getPlaceDetails } from "@/actions/places";
import type { PlaceSuggestion } from "@/actions/places";

interface DestinationSelectorProps {
  value: string;
  onChange: (value: string, name?: string) => void;
  compact?: boolean;
  label?: string;
}

export default function DestinationSelector({ value, onChange, compact, label }: DestinationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [destinos, setDestinos] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Google Places search
  const [showPlacesPanel, setShowPlacesPanel] = useState(false);
  const [placesQuery, setPlacesQuery] = useState("");
  const [placesSuggestions, setPlacesSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const placesInputRef = useRef<HTMLInputElement>(null);
  const placesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load destinos if no label provided (modal) or when opening dropdown
  useEffect(() => {
    if (label) { setDataLoaded(true); return; }
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
  }, [label]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowPlacesPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleSelect = (destId: string, destName: string) => {
    onChange(destId, destName);
    setIsOpen(false);
    setSearchTerm("");
    setShowPlacesPanel(false);
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
      setShowPlacesPanel(false);
      setPlacesQuery("");
      setPlacesSuggestions([]);
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
      setShowPlacesPanel(false);
      setPlacesQuery("");
      setPlacesSuggestions([]);
    }
  };

  const filteredDestinos = destinos.filter((d) =>
    d.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger Button/Input */}
      <div
        onClick={async () => {
          if (!isOpen) {
            // Recargar siempre al abrir para incluir destinos recién creados en otras líneas
            const destsData = await getDestinos();
            setDestinos(destsData || []);
            setDataLoaded(true);
            setSearchTerm("");
            setShowPlacesPanel(false);
          }
          setIsOpen(!isOpen);
        }}
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
        <ChevronDown size={14} style={{ color: "#64748b", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
      </div>

      {/* Dropdown Card */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "280px", // ancho un poco mayor para caber bien la busqueda de lugares
            backgroundColor: "#ffffff",
            borderRadius: "0.5rem",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0",
            zIndex: 99999,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.15s ease-out"
          }}
        >
          {!showPlacesPanel ? (
            <>
              {/* Search Header */}
              <div style={{ display: "flex", padding: "0.4rem 0.5rem", gap: "0.4rem", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={14} style={{ position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Buscar destino..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "0.35rem 0.4rem 0.35rem 1.5rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.75rem",
                      outline: "none",
                      backgroundColor: "#ffffff",
                      color: "#0f172a"
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlacesQuery(searchTerm);
                    setShowPlacesPanel(true);
                  }}
                  style={{
                    backgroundColor: "var(--primary-color, #475569)",
                    color: "#ffffff",
                    border: "none",
                    padding: "0 0.5rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.7rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.2rem",
                    whiteSpace: "nowrap"
                  }}
                >
                  <Plus size={10} />
                  <span>Google</span>
                </button>
              </div>

              {/* Destinos List */}
              <div style={{ maxHeight: "200px", overflowY: "auto", padding: "0.25rem" }}>
                {filteredDestinos.length > 0 ? (
                  filteredDestinos.map((dest) => {
                    const isSelected = value === dest.id;
                    return (
                      <div
                        key={dest.id}
                        onClick={() => handleSelect(dest.id, dest.nombre)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.4rem 0.6rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          color: isSelected ? "#ffffff" : "#334155",
                          backgroundColor: isSelected ? "var(--primary-color, #475569)" : "transparent",
                          transition: "all 0.15s"
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = "#f1f5f9";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? "600" : "400" }}>{dest.nombre}</span>
                        {isSelected && <Check size={12} style={{ color: "#ffffff" }} />}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>
                    No encontrado.{" "}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlacesQuery(searchTerm);
                        setShowPlacesPanel(true);
                      }}
                      style={{ color: "var(--primary-color, #475569)", fontWeight: "600", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Buscar con Google Places
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Google Places Panel */
            <div style={{ padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.25rem" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Google Places
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlacesPanel(false);
                    setPlacesQuery("");
                    setPlacesSuggestions([]);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Places Search Input */}
              <div style={{ position: "relative" }}>
                <Search size={12} style={{ position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  ref={placesInputRef}
                  type="text"
                  placeholder="Ej: Barcelona, Cancún, Maldivas..."
                  value={placesQuery}
                  onChange={(e) => {
                    e.stopPropagation();
                    setPlacesQuery(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    padding: "0.35rem 0.4rem 0.35rem 1.5rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.75rem",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#0f172a"
                  }}
                />
                {placesLoading && (
                  <div style={{
                    position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)",
                    width: "10px", height: "10px", border: "2px solid #cbd5e1",
                    borderTopColor: "var(--primary-color, #475569)", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite"
                  }} />
                )}
              </div>

              {/* Autocomplete Suggestions */}
              {placesSuggestions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "140px", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "0.25rem", padding: "0.2rem" }}>
                  {placesSuggestions.map((s) => (
                    <div
                      key={s.placeId}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPlace(s);
                      }}
                      style={{
                        padding: "0.35rem 0.5rem",
                        borderRadius: "0.2rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.4rem",
                        transition: "background-color 0.15s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#e2e8f0";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <MapPin size={12} style={{ minWidth: "12px", color: "#475569", marginTop: "1px" }} />
                      <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0f172a" }}>{s.mainText}</div>
                        {s.secondaryText && (
                          <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{s.secondaryText}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!placesLoading && placesQuery.trim().length >= 2 && placesSuggestions.length === 0 && (
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", textAlign: "center", padding: "0.25rem 0" }}>
                  Sin resultados en Google Places
                </div>
              )}

              {/* Plain text save option */}
              {placesQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveWithoutGoogle();
                  }}
                  style={{
                    background: "none",
                    border: "1px dashed #cbd5e1",
                    color: "#64748b",
                    fontSize: "0.7rem",
                    borderRadius: "0.25rem",
                    padding: "0.25rem 0.5rem",
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
      )}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
