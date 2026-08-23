"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, X, Search, Loader2 } from "lucide-react";

export function DestinoPopover({ destinos, position, isUpdating, onAdd, onRemove, onClose }: {
  destinos: any[];
  position: { top: number; left: number };
  isUpdating: boolean;
  onAdd: (place: { id: string; nombre: string }) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nominatimDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [query, setQuery] = useState("");
  // Phase 1: maestro_destinos
  const [maestros, setMaestros] = useState<any[]>([]);
  const [loadingMaestros, setLoadingMaestros] = useState(true);
  // Phase 2: Nominatim (solo si no hay resultados en maestro)
  const [showNominatim, setShowNominatim] = useState(false);
  const [nominatimResults, setNominatimResults] = useState<any[]>([]);
  const [searchingNominatim, setSearchingNominatim] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    import("@/actions/destinos").then(({ getDestinos }) =>
      getDestinos().then(setMaestros).catch(console.error).finally(() => setLoadingMaestros(false))
    );
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Búsqueda Nominatim solo cuando estamos en fase 2
  useEffect(() => {
    if (!showNominatim) return;
    if (nominatimDebounceRef.current) clearTimeout(nominatimDebounceRef.current);
    if (query.trim().length < 2) { setNominatimResults([]); return; }
    nominatimDebounceRef.current = setTimeout(async () => {
      setSearchingNominatim(true);
      try {
        const { searchNominatim } = await import("@/actions/nominatim");
        const data = await searchNominatim(query);
        setNominatimResults(data);
      } catch { setNominatimResults([]); }
      finally { setSearchingNominatim(false); }
    }, 300);
    return () => { if (nominatimDebounceRef.current) clearTimeout(nominatimDebounceRef.current); };
  }, [query, showNominatim]);

  const normalizarBusqueda = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filteredMaestros = maestros.filter(d => {
    const q = normalizarBusqueda(query);
    const nombre = normalizarBusqueda(d.nombre_comercial || d.nombre || "");
    return nombre.includes(q);
  });

  const handleSelectMaestro = (d: any) => {
    const nombre = d.nombre_comercial || d.nombre || "";
    onAdd({ id: d.id, nombre });
    setQuery("");
  };

  const handleSelectNominatim = async (item: any) => {
    setSaving(true);
    try {
      const { createDestinoFromNominatim } = await import("@/actions/destinos");
      const destino = await createDestinoFromNominatim(item);
      if (destino) {
        onAdd({ id: destino.id, nombre: destino.nombre_comercial || destino.nombre || item.displayName });
        setQuery("");
        setNominatimResults([]);
        setShowNominatim(false);
      }
    } catch (err) { console.error("Error al crear destino:", err); }
    finally { setSaving(false); }
  };

  const alreadySelectedIds = new Set(destinos.map((d: any) => d.id));

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 99999,
        width: "300px",
        backgroundColor: "#ffffff",
        borderRadius: "0.5rem",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      {/* Destinos ya añadidos */}
      {destinos.length > 0 && (
        <div style={{ padding: "0.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {destinos.map((d: any, idx: number) => (
            <span key={d.id || idx} style={{
              display: "inline-flex", alignItems: "center", gap: "0.3rem",
              padding: "0.2rem 0.5rem", background: "#f1f5f9", color: "#334155",
              borderRadius: "999px", fontSize: "0.72rem", fontWeight: 500
            }}>
              {d.nombre}
              <button onClick={() => onRemove(d.id)} disabled={isUpdating}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0, display: "flex" }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Cabecera con búsqueda y toggle de fase */}
      <div style={{ padding: "0.5rem", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
          {showNominatim ? "Buscar en OpenStreetMap" : "Buscar destino"}
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder={showNominatim ? "Ciudad, país, región..." : "Buscar en mis destinos..."}
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (showNominatim) setNominatimResults([]); }}
              style={{
                width: "100%", padding: "0.4rem 0.5rem 0.4rem 1.75rem",
                borderRadius: "0.375rem", border: "1px solid #cbd5e1",
                fontSize: "0.78rem", outline: "none", color: "#0f172a",
                backgroundColor: "#ffffff", boxSizing: "border-box",
              }}
            />
            {(loadingMaestros || searchingNominatim) && (
              <Loader2 size={14} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", animation: "spin 0.8s linear infinite" }} />
            )}
          </div>
          {showNominatim && (
            <button
              onClick={() => { setShowNominatim(false); setNominatimResults([]); }}
              title="Volver a mis destinos"
              style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: "0.25rem", padding: "0 0.4rem", cursor: "pointer", color: "#64748b", fontSize: "0.7rem" }}
            >
              ← Volver
            </button>
          )}
        </div>
      </div>

      {/* Lista de resultados */}
      <div style={{ maxHeight: "220px", overflowY: "auto", padding: "0.25rem" }}>
        {!showNominatim ? (
          // Fase 1: maestro_destinos
          loadingMaestros ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>Cargando...</div>
          ) : filteredMaestros.length > 0 ? (
            <>
              {filteredMaestros.filter(d => !alreadySelectedIds.has(d.id)).map((d: any) => (
                <div
                  key={d.id}
                  onClick={() => handleSelectMaestro(d)}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.6rem", borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.75rem", color: "#0f172a" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <MapPin size={12} style={{ minWidth: 12, color: "#64748b" }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.nombre_comercial || d.nombre}</div>
                    {d.country && <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{d.country}</div>}
                  </div>
                </div>
              ))}
              {query.trim().length >= 2 && (
                <button
                  onClick={() => setShowNominatim(true)}
                  style={{
                    width: "100%", padding: "0.4rem 0.6rem", borderRadius: "0.375rem",
                    border: "1px dashed #cbd5e1", background: "none", cursor: "pointer",
                    fontSize: "0.72rem", color: "#475569", fontWeight: 600, textAlign: "left",
                    display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem",
                  }}
                >
                  <Search size={12} /> Buscar "{query}" en OpenStreetMap
                </button>
              )}
            </>
          ) : query.trim().length >= 2 ? (
            <div style={{ padding: "0.75rem 0.6rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.5rem" }}>
                No encontrado en tus destinos.
              </div>
              <button
                onClick={() => setShowNominatim(true)}
                style={{
                  width: "100%", padding: "0.4rem 0.6rem", borderRadius: "0.375rem",
                  border: "1px dashed #cbd5e1", background: "none", cursor: "pointer",
                  fontSize: "0.72rem", color: "#475569", fontWeight: 600, textAlign: "left",
                  display: "flex", alignItems: "center", gap: "0.4rem",
                }}
              >
                <Search size={12} /> Buscar "{query}" en OpenStreetMap
              </button>
            </div>
          ) : (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>Escribe para buscar</div>
          )
        ) : (
          // Fase 2: Nominatim
          nominatimResults.length > 0 ? (
            nominatimResults.map((item: any) => (
              <div
                key={`${item.osmType}-${item.osmId}`}
                onClick={() => handleSelectNominatim(item)}
                style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem", padding: "0.4rem 0.6rem", borderRadius: "0.25rem", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <MapPin size={13} style={{ minWidth: 13, color: "#64748b", marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0f172a" }}>
                    {item.city || item.state || item.displayName.split(",")[0].trim()}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{item.displayName}</div>
                  <div style={{ fontSize: "0.6rem", color: "#94a3b8", marginTop: "1px" }}>{item.type} · {item.country || ""}</div>
                </div>
              </div>
            ))
          ) : query.trim().length >= 2 && !searchingNominatim ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>Sin resultados en OpenStreetMap</div>
          ) : query.trim().length < 2 ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>Escribe al menos 2 caracteres</div>
          ) : null
        )}
      </div>

      {saving && (
        <div style={{ padding: "0.5rem", textAlign: "center", fontSize: "0.7rem", color: "#64748b", borderTop: "1px solid #f1f5f9" }}>
          <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite", display: "inline", marginRight: "0.25rem" }} />
          Guardando destino...
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
