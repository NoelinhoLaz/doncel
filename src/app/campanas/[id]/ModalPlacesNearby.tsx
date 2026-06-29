"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Estado = { id: string; nombre: string; color: string; orden: number; es_final: boolean; es_ganado: boolean };

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function ModalPlacesNearby({ campanaId, estados, onClose, onCreated }: {
  campanaId: string;
  estados: Estado[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [ubicacion, setUbicacion] = useState("");
  const [tipo, setTipo] = useState("");
  const [radio, setRadio] = useState(5000);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [estadoId, setEstadoId] = useState(estados[0]?.id ?? "");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [buscandoUbic, setBuscandoUbic] = useState(false);

  const TIPOS = [
    { value: "", label: "Todos" },
    { value: "school", label: "Colegios" },
    { value: "secondary_school", label: "Institutos" },
    { value: "university", label: "Universidades" },
    { value: "travel_agency", label: "Agencias de viaje" },
    { value: "corporate_office", label: "Empresas" },
    { value: "lodging", label: "Hoteles" },
    { value: "restaurant", label: "Restaurantes" },
  ];

  async function buscarUbicacion() {
    if (!ubicacion.trim()) return;
    setBuscandoUbic(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(ubicacion)}`);
      const json = await res.json();
      const first = json.results?.[0];
      if (!first?.lat || !first?.lng) { setError("No se encontró la ubicación"); return; }
      setCoords({ lat: first.lat, lng: first.lng });
    } catch { setError("Error buscando ubicación"); }
    finally { setBuscandoUbic(false); }
  }

  async function buscarNegocios() {
    if (!coords) { setError("Primero localiza la ubicación"); return; }
    setBuscando(true);
    setError(null);
    setResultados([]);
    setSeleccionados(new Set());
    try {
      const params = new URLSearchParams({ lat: String(coords.lat), lng: String(coords.lng), radius: String(radio) });
      if (tipo) params.set("tipo", tipo);
      const res = await fetch(`/api/places/nearby?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResultados(json.results ?? []);
    } catch (e: any) { setError(e.message ?? "Error buscando negocios"); }
    finally { setBuscando(false); }
  }

  function toggleSeleccion(i: number) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleTodos() {
    if (seleccionados.size === resultados.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(resultados.map((_, i) => i)));
  }

  async function crearOportunidades() {
    if (!seleccionados.size || !estadoId) return;
    setCreando(true);
    const items = [...seleccionados].map(i => resultados[i]);
    await Promise.all(items.map(r =>
      apiFetch("/api/crm/oportunidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campana_id: campanaId,
          estado_id: estadoId,
          titulo: r.nombre,
          valor_estimado: 0,
          nombre_centro: r.nombre,
          direccion: r.direccion,
          lat: r.lat,
          lng: r.lng,
        }),
      })
    ));
    setCreando(false);
    onCreated();
    onClose();
  }

  const inp: React.CSSProperties = { fontSize: "0.82rem", padding: "0.4rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: 7, outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, width: "min(680px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(15,23,42,0.22)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "1rem 1.4rem 0.8rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Google Places</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>Buscar negocios por zona</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
        </div>

        {/* Filtros */}
        <div style={{ padding: "0.9rem 1.4rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <input
                value={ubicacion}
                onChange={e => { setUbicacion(e.target.value); setCoords(null); }}
                onKeyDown={e => e.key === "Enter" && buscarUbicacion()}
                placeholder="Ciudad, barrio o dirección de referencia…"
                style={inp}
              />
            </div>
            <button
              onClick={buscarUbicacion}
              disabled={buscandoUbic || !ubicacion.trim()}
              style={{ padding: "0.4rem 0.9rem", borderRadius: 7, border: "none", background: coords ? "#22c55e" : "var(--primary-color,#475569)", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", flexShrink: 0, opacity: buscandoUbic ? 0.7 : 1 }}
            >
              {buscandoUbic ? "…" : coords ? "✓ Localizado" : "Localizar"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...inp, flex: 1 }}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={radio} onChange={e => setRadio(Number(e.target.value))} style={{ ...inp, width: 130, flex: "none" }}>
              <option value={1000}>1 km</option>
              <option value={2000}>2 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={20000}>20 km</option>
              <option value={50000}>50 km</option>
            </select>
            <button
              onClick={buscarNegocios}
              disabled={buscando || !coords}
              style={{ padding: "0.4rem 0.9rem", borderRadius: 7, border: "none", background: "var(--primary-color,#475569)", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", flexShrink: 0, opacity: buscando || !coords ? 0.6 : 1 }}
            >
              {buscando ? "Buscando…" : "Buscar"}
            </button>
          </div>
          {error && <div style={{ fontSize: "0.75rem", color: "#ef4444" }}>{error}</div>}
        </div>

        {/* Resultados */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.6rem 1.4rem" }}>
          {resultados.length === 0 && !buscando && (
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", padding: "2rem 0" }}>
              {coords ? 'Pulsa "Buscar" para encontrar negocios en la zona' : "Introduce una ubicación de referencia para empezar"}
            </div>
          )}
          {resultados.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0", marginBottom: "0.3rem" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{resultados.length} resultados encontrados</span>
                <button onClick={toggleTodos} style={{ fontSize: "0.72rem", background: "none", border: "none", cursor: "pointer", color: "var(--primary-color,#475569)", fontWeight: 600 }}>
                  {seleccionados.size === resultados.length ? "Deseleccionar todos" : "Seleccionar todos"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {resultados.map((r, i) => {
                  const sel = seleccionados.has(i);
                  return (
                    <div
                      key={i}
                      onClick={() => toggleSeleccion(i)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10, padding: "0.55rem 0.75rem",
                        borderRadius: 8, cursor: "pointer",
                        border: sel ? "1.5px solid var(--primary-color,#475569)" : "1.5px solid #e2e8f0",
                        background: sel ? "#f1f5f9" : "#fafafa",
                        transition: "border-color 0.1s, background 0.1s",
                      }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${sel ? "var(--primary-color,#475569)" : "#cbd5e1"}`, background: sel ? "var(--primary-color,#475569)" : "#fff", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {sel && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nombre}</div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.direccion}</div>
                        {(r.telefono || r.rating) && (
                          <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                            {r.telefono && <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{r.telefono}</span>}
                            {r.rating && <span style={{ fontSize: "0.68rem", color: "#f59e0b" }}>★ {r.rating} ({r.num_ratings})</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {resultados.length > 0 && (
          <div style={{ padding: "0.8rem 1.4rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
            <select value={estadoId} onChange={e => setEstadoId(e.target.value)} style={{ ...inp, flex: 1, maxWidth: 200 }}>
              {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <span style={{ fontSize: "0.75rem", color: "#64748b", flex: 1 }}>
              {seleccionados.size > 0 ? `${seleccionados.size} seleccionado${seleccionados.size > 1 ? "s" : ""}` : "Ninguno seleccionado"}
            </span>
            <button
              onClick={crearOportunidades}
              disabled={creando || seleccionados.size === 0 || !estadoId}
              style={{ padding: "0.45rem 1.1rem", border: "none", borderRadius: 7, background: "var(--primary-color,#475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", opacity: creando || seleccionados.size === 0 ? 0.6 : 1 }}
            >
              {creando ? "Creando…" : `Añadir ${seleccionados.size > 0 ? seleccionados.size : ""} oportunidad${seleccionados.size !== 1 ? "es" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
