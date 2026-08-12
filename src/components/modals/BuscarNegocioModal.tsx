"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { X, LocateFixed, Search, MapPin, List, Map as MapIcon, ChevronDown, ArrowUpDown } from "lucide-react";

const BuscarNegocioResultadosMapaDynamic = dynamic(
  () => import("./BuscarNegocioResultadosMapa").then(m => m.BuscarNegocioResultadosMapa),
  { ssr: false }
);

export type LugarPlaces = {
  nombre: string;
  direccion: string;
  calle?: string;
  cp?: string;
  ciudad?: string;
  provincia?: string;
  lat: number | null;
  lng: number | null;
  distancia_m?: number | null;
  telefono?: string | null;
  rating?: number | null;
  num_ratings?: number | null;
};

const TIPOS = [
  { value: "school", label: "Colegios" },
  { value: "secondary_school", label: "Institutos" },
  { value: "university", label: "Universidades" },
  { value: "travel_agency", label: "Agencias de viaje" },
  { value: "corporate_office", label: "Empresas" },
  { value: "lodging", label: "Hoteles" },
  { value: "restaurant", label: "Restaurantes" },
];

function formatDistancia(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

const inp: React.CSSProperties = { fontSize: "0.82rem", padding: "0.4rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: 7, outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" };

export function BuscarNegocioModal({ onClose, onSelect }: { onClose: () => void; onSelect: (lugar: LugarPlaces) => void }) {
  const [modo, setModo] = useState<"nombre" | "cerca" | "zona">("nombre");

  // Búsqueda por nombre
  const [nombreQuery, setNombreQuery] = useState("");

  // Cerca de mí / por zona
  const [ubicacion, setUbicacion] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [showTiposPicker, setShowTiposPicker] = useState(false);
  const tiposPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showTiposPicker) return;
    function onDocClick(e: MouseEvent) {
      if (tiposPickerRef.current && !tiposPickerRef.current.contains(e.target as Node)) {
        setShowTiposPicker(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showTiposPicker]);
  const [orden, setOrden] = useState<"relevancia" | "distancia">("relevancia");
  const [radio, setRadio] = useState(5000);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [localizandoAgente, setLocalizandoAgente] = useState(false);
  const [buscandoUbic, setBuscandoUbic] = useState(false);

  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<LugarPlaces[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [vistaMapa, setVistaMapa] = useState(false);

  function toggleTipo(value: string) {
    setTipos(prev => prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]);
  }

  function cambiarModo(m: typeof modo) {
    setModo(m);
    setResultados([]);
    setError(null);
    if (m !== "cerca") setCoords(null);
  }

  async function buscarPorNombre() {
    if (!nombreQuery.trim()) return;
    setBuscando(true);
    setError(null);
    setResultados([]);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(nombreQuery)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResultados(json.results ?? []);
    } catch (e: any) {
      setError(e.message ?? "Error al buscar");
    } finally {
      setBuscando(false);
    }
  }

  function localizarAgente() {
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización");
      return;
    }
    setLocalizandoAgente(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocalizandoAgente(false);
      },
      () => {
        setError("No se pudo obtener tu ubicación. Comprueba los permisos del navegador.");
        setLocalizandoAgente(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function buscarUbicacionZona() {
    if (!ubicacion.trim()) return;
    setBuscandoUbic(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(ubicacion)}`);
      const json = await res.json();
      const first = json.results?.[0];
      if (!first?.lat || !first?.lng) { setError("No se encontró la ubicación"); return; }
      setCoords({ lat: first.lat, lng: first.lng });
    } catch {
      setError("Error buscando ubicación");
    } finally {
      setBuscandoUbic(false);
    }
  }

  async function buscarNearby() {
    if (!coords) { setError("Primero localiza la ubicación"); return; }
    setBuscando(true);
    setError(null);
    setResultados([]);
    try {
      const params = new URLSearchParams({ lat: String(coords.lat), lng: String(coords.lng), radius: String(radio) });
      if (tipos.length > 0) params.set("tipos", tipos.join(","));
      if (orden === "distancia") params.set("orden", "distancia");
      const res = await fetch(`/api/places/nearby?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResultados(json.results ?? []);
    } catch (e: any) {
      setError(e.message ?? "Error buscando negocios");
    } finally {
      setBuscando(false);
    }
  }

  const tabBtn = (activo: boolean): React.CSSProperties => ({
    flex: 1, padding: "0.4rem 0.6rem", fontSize: "0.76rem", fontWeight: 600,
    border: "none", borderRadius: 6, cursor: "pointer",
    background: activo ? "var(--primary-color, #475569)" : "transparent",
    color: activo ? "#fff" : "#64748b",
  });

  const filtrosTipoRadioOrden = (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ position: "relative", flex: 1 }} ref={tiposPickerRef}>
        <button
          type="button"
          onClick={() => setShowTiposPicker(v => !v)}
          style={{ ...inp, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left", color: tipos.length ? "#1e293b" : "#94a3b8" }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tipos.length === 0 ? "Todos los tipos" : TIPOS.filter(t => tipos.includes(t.value)).map(t => t.label).join(", ")}
          </span>
          <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: 4 }} />
        </button>
        {showTiposPicker && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", padding: "0.3rem", maxHeight: 220, overflowY: "auto" }}>
            {TIPOS.map(t => (
              <label key={t.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.35rem 0.5rem", fontSize: "0.78rem", color: "#334155", cursor: "pointer", borderRadius: 5 }}>
                <input type="checkbox" checked={tipos.includes(t.value)} onChange={() => toggleTipo(t.value)} style={{ accentColor: "var(--primary-color, #475569)" }} />
                {t.label}
              </label>
            ))}
          </div>
        )}
      </div>
      <select value={radio} onChange={e => setRadio(Number(e.target.value))} style={{ ...inp, width: 110, flex: "none" }}>
        <option value={1000}>1 km</option>
        <option value={2000}>2 km</option>
        <option value={5000}>5 km</option>
        <option value={10000}>10 km</option>
        <option value={20000}>20 km</option>
        <option value={50000}>50 km</option>
      </select>
      <button
        type="button"
        onClick={() => setOrden(o => o === "distancia" ? "relevancia" : "distancia")}
        title={orden === "distancia" ? "Ordenando por distancia" : "Ordenar por distancia"}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "0.4rem 0.6rem", borderRadius: 7, border: "1px solid #e2e8f0", background: orden === "distancia" ? "var(--primary-color,#475569)" : "#fff", color: orden === "distancia" ? "#fff" : "#64748b", fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
      >
        <ArrowUpDown size={13} />
      </button>
      <button
        onClick={buscarNearby}
        disabled={buscando || !coords}
        style={{ padding: "0.4rem 0.9rem", borderRadius: 7, border: "none", background: "var(--primary-color,#475569)", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", flexShrink: 0, opacity: buscando || !coords ? 0.6 : 1 }}
      >
        {buscando ? "Buscando…" : "Buscar"}
      </button>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, width: "min(680px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(15,23,42,0.22)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "1rem 1.4rem 0.8rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Google Places</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>Buscar negocio</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "0.7rem 1.4rem 0", borderBottom: "1px solid #f1f5f9" }}>
          <button onClick={() => cambiarModo("nombre")} style={tabBtn(modo === "nombre")}><Search size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Por nombre</button>
          <button onClick={() => cambiarModo("cerca")} style={tabBtn(modo === "cerca")}><LocateFixed size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Cerca de mí</button>
          <button onClick={() => cambiarModo("zona")} style={tabBtn(modo === "zona")}><MapPin size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Por ciudad</button>
        </div>

        {/* Filtros */}
        <div style={{ padding: "0.9rem 1.4rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {modo === "nombre" && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                autoFocus
                value={nombreQuery}
                onChange={e => setNombreQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && buscarPorNombre()}
                placeholder="Nombre del negocio…"
                style={{ ...inp, flex: 1 }}
              />
              <button
                onClick={buscarPorNombre}
                disabled={buscando || !nombreQuery.trim()}
                style={{ padding: "0.4rem 0.9rem", borderRadius: 7, border: "none", background: "var(--primary-color,#475569)", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", flexShrink: 0, opacity: buscando || !nombreQuery.trim() ? 0.6 : 1 }}
              >
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </div>
          )}

          {modo === "cerca" && (
            <>
              <button
                onClick={localizarAgente}
                disabled={localizandoAgente}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0.45rem 0.9rem", borderRadius: 7, border: "1px solid #e2e8f0", background: coords ? "#22c55e" : "#fff", color: coords ? "#fff" : "var(--primary-color,#475569)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", opacity: localizandoAgente ? 0.6 : 1 }}
              >
                <LocateFixed size={13} /> {localizandoAgente ? "Localizando…" : coords ? "✓ Ubicación obtenida" : "Usar mi ubicación actual"}
              </button>
              {filtrosTipoRadioOrden}
            </>
          )}

          {modo === "zona" && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={ubicacion}
                  onChange={e => { setUbicacion(e.target.value); setCoords(null); }}
                  onKeyDown={e => e.key === "Enter" && buscarUbicacionZona()}
                  placeholder="Ciudad, barrio o dirección de referencia…"
                  style={{ ...inp, flex: 1 }}
                />
                <button
                  onClick={buscarUbicacionZona}
                  disabled={buscandoUbic || !ubicacion.trim()}
                  style={{ padding: "0.4rem 0.9rem", borderRadius: 7, border: "none", background: coords ? "#22c55e" : "var(--primary-color,#475569)", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", flexShrink: 0, opacity: buscandoUbic ? 0.7 : 1 }}
                >
                  {buscandoUbic ? "…" : coords ? "✓ Localizado" : "Localizar"}
                </button>
              </div>
              {filtrosTipoRadioOrden}
            </>
          )}

          {error && <div style={{ fontSize: "0.75rem", color: "#ef4444" }}>{error}</div>}
        </div>

        {/* Resultados */}
        {resultados.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.4rem 0" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{resultados.length} resultado{resultados.length !== 1 ? "s" : ""}</span>
            <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <button
                onClick={() => setVistaMapa(false)}
                title="Ver lista"
                style={{ display: "flex", alignItems: "center", padding: "0.3rem 0.5rem", border: "none", background: !vistaMapa ? "var(--primary-color,#475569)" : "#fff", color: !vistaMapa ? "#fff" : "#64748b", cursor: "pointer" }}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setVistaMapa(true)}
                title="Ver mapa"
                style={{ display: "flex", alignItems: "center", padding: "0.3rem 0.5rem", border: "none", background: vistaMapa ? "var(--primary-color,#475569)" : "#fff", color: vistaMapa ? "#fff" : "#64748b", cursor: "pointer" }}
              >
                <MapIcon size={14} />
              </button>
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: vistaMapa ? "hidden" : "auto", padding: "0.6rem 1.4rem 1.2rem" }}>
          {resultados.length === 0 && !buscando && (
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", padding: "2rem 0" }}>
              {modo === "nombre" && "Escribe el nombre del negocio para buscar"}
              {modo === "cerca" && (coords ? 'Pulsa "Buscar" para encontrar negocios cerca de ti' : "Pulsa \"Usar mi ubicación actual\" para empezar")}
              {modo === "zona" && (coords ? 'Pulsa "Buscar" para encontrar negocios en la zona' : "Introduce una ubicación de referencia para empezar")}
            </div>
          )}
          {resultados.length > 0 && vistaMapa && (
            <div style={{ height: 420 }}>
              <BuscarNegocioResultadosMapaDynamic resultados={resultados} onSelect={onSelect} />
            </div>
          )}
          {resultados.length > 0 && !vistaMapa && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {resultados.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelect(r)}
                  style={{ all: "unset", display: "flex", flexDirection: "column", gap: 2, padding: "0.55rem 0.75rem", borderRadius: 8, cursor: "pointer", border: "1.5px solid #e2e8f0", background: "#fafafa" }}
                  onMouseEnter={ev => { ev.currentTarget.style.borderColor = "var(--primary-color,#475569)"; ev.currentTarget.style.background = "#f1f5f9"; }}
                  onMouseLeave={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.background = "#fafafa"; }}
                >
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b" }}>{r.nombre}</span>
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{r.direccion}</span>
                  {(r.telefono || r.rating || r.distancia_m != null) && (
                    <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                      {r.distancia_m != null && <span style={{ fontSize: "0.68rem", color: "var(--primary-color,#475569)", fontWeight: 600 }}>{formatDistancia(r.distancia_m)}</span>}
                      {r.telefono && <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{r.telefono}</span>}
                      {r.rating && <span style={{ fontSize: "0.68rem", color: "#f59e0b" }}>★ {r.rating} ({r.num_ratings})</span>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
