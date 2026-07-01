"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, X, Trophy } from "lucide-react";
import styles from "./page.module.css";

interface Punto {
  lat: number;
  lng: number;
  nombre: string;
  plazas: number;
  tipo: string;
  categorias: string[];
}

const MESES_OPTS = [
  { value: "01", label: "Enero" }, { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" }, { value: "04", label: "Abril" },
  { value: "05", label: "Mayo"  }, { value: "06", label: "Junio"  },
  { value: "07", label: "Julio" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" }, { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre"  }, { value: "12", label: "Diciembre" },
];

const TIPOS_OPTS = [
  { value: "grupo", label: "Grupo" },
  { value: "vacacional", label: "Vacacional" },
  { value: "p2p", label: "P2P" },
];

function getMesAnio() {
  const now = new Date();
  return { mes: String(now.getMonth() + 1).padStart(2, "0"), anio: now.getFullYear() };
}

const CLUSTER_BG     = "rgba(33,37,41,0.92)";
const CLUSTER_BORDER = "#1a5c4e";
const CLUSTER_BORDER_HOVER = "#22c55e";
const CLUSTER_TEXT   = "#ffffff";

// Tamaño dinámico calibrado por el máximo real del dataset
function clusterSize(plazas: number, maxPlazas: number): number {
  if (maxPlazas === 0) return 20;
  const ratio = plazas / maxPlazas;
  if (ratio >= 1)    return 42;
  if (ratio >= 0.66) return 34;
  if (ratio >= 0.33) return 26;
  return 20;
}

// ── Multiselect Dropdown ────────────────────────────────────────────────────
interface DropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}

function MultiDropdown({ label, options, selected, onChange, placeholder = "Todos" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);

  const displayLabel = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} seleccionados`;

  return (
    <div className={styles.controlGroup}>
      <label className={styles.controlLabel}>{label}</label>
      <div ref={ref} style={{ position: "relative" }}>
        <button type="button" onClick={() => setOpen(o => !o)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "0.3rem 0.6rem", borderRadius: 6,
          border: "1px solid #e2e8f0", background: "#fff",
          fontSize: "0.78rem", color: selected.length ? "#0f172a" : "#94a3b8",
          cursor: "pointer", whiteSpace: "nowrap", minWidth: 120,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <span style={{ flex: 1, textAlign: "left" }}>{displayLabel}</span>
          {selected.length > 0 && (
            <X size={11} style={{ color: "#94a3b8", flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); onChange([]); }} />
          )}
          <ChevronDown size={13} style={{ color: "#94a3b8", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "100%",
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 9999, overflow: "hidden",
          }}>
            {options.map(opt => {
              const checked = selected.includes(opt.value);
              return (
                <div key={opt.value} onClick={() => toggle(opt.value)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0.45rem 0.75rem", fontSize: "0.8rem",
                  cursor: "pointer", color: checked ? "#0f766e" : "#334155",
                  background: checked ? "#f0fdf4" : "transparent",
                  fontWeight: checked ? 600 : 400,
                }}
                  onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                  onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    border: `2px solid ${checked ? "#0f766e" : "#cbd5e1"}`,
                    background: checked ? "#0f766e" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {checked && <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>✓</span>}
                  </span>
                  {opt.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonTopList() {
  return (
    <ol className={styles.topList}>
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className={styles.topItem}>
          <span className={styles.topRank} style={{ background: "#e2e8f0", borderRadius: 3, color: "transparent" }}>0</span>
          <div className={styles.topInfo}>
            <span className={styles.skeletonBar} style={{ width: `${55 + (i % 3) * 15}%`, height: 12 }} />
            <span className={styles.skeletonBar} style={{ width: 28, height: 12, flexShrink: 0 }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function HeatmapChart() {
  const mapRef       = useRef<any>(null);
  const clusterRef   = useRef<any>(null);
  const markersRef   = useRef<Map<string, any>>(new Map()); // key → leaflet marker
  const containerRef = useRef<HTMLDivElement>(null);

  const { mes: mesMes, anio: mesAnio } = getMesAnio();

  const [meses,         setMeses]         = useState<string[]>([mesMes]);
  const [anios,         setAnios]         = useState<string[]>([String(mesAnio)]);
  const [tipos,         setTipos]         = useState<string[]>([]);
  const [tiposServicio, setTiposServicio] = useState<string[]>([]);
  const [tsOpts,        setTsOpts]        = useState<string[]>([]);

  const [puntos,      setPuntos]      = useState<Punto[]>([]);
  const [topDestinos, setTopDestinos] = useState<Punto[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [mapReady,    setMapReady]    = useState(false);
  const [hoveredKey,  setHoveredKey]  = useState<string | null>(null);

  const maxPlazas = puntos.length > 0 ? Math.max(...puntos.map(p => p.plazas)) : 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      meses.forEach(m => params.append("mes", m));
      anios.forEach(a => params.append("anio", a));
      tipos.forEach(t => params.append("tipo", t));
      tiposServicio.forEach(ts => params.append("tipo_servicio", ts));

      const res = await fetch(`/api/proveedor/analytics/heatmap?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const data: Punto[] = json.puntos ?? [];
      setPuntos(data);
      setTopDestinos([...data].sort((a, b) => b.plazas - a.plazas).slice(0, 10));
      if (json.tiposServicio?.length) setTsOpts(json.tiposServicio);
    } catch {
      setPuntos([]);
      setTopDestinos([]);
    } finally {
      setLoading(false);
    }
  }, [meses, anios, tipos, tiposServicio]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Init Leaflet
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current || mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      // @ts-ignore
      if (containerRef.current!._leaflet_id) return;
      const map = L.map(containerRef.current!, { center: [41.5, 2.0], zoom: 6, zoomControl: true, attributionControl: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; clusterRef.current = null; } };
  }, []);

  // Rebuild clusters cuando cambian los puntos
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      await import("leaflet.markercluster/dist/MarkerCluster.css");
      await import("leaflet.markercluster/dist/MarkerCluster.Default.css");

      if (clusterRef.current) { mapRef.current.removeLayer(clusterRef.current); clusterRef.current = null; }
      markersRef.current.clear();
      if (puntos.length === 0) return;

      const max = maxPlazas;

      const cluster = (L as any).markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (c: any) => {
          const total = c.getAllChildMarkers().reduce((s: number, m: any) => s + (m.options.plazas ?? 0), 0);
          const size = clusterSize(total, max);
          const pulse = total >= max * 0.9 && max > 0;
          const pulseHtml = pulse
            ? `<span style="position:absolute;inset:-7px;border-radius:50%;border:2px solid ${CLUSTER_BORDER};opacity:0.5;animation:clusterPulse 1.8s ease-out infinite;"></span>`
            : "";
          const fs = size >= 40 ? "1rem" : size >= 30 ? "0.85rem" : "0.72rem";
          return (L as any).divIcon({
            html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
              ${pulseHtml}
              <div style="width:${size}px;height:${size}px;border-radius:50%;background:${CLUSTER_BG};border:2px solid ${CLUSTER_BORDER};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);color:${CLUSTER_TEXT};font-weight:600;font-size:${fs}">
                ${total.toLocaleString("es-ES")}
              </div></div>`,
            className: "", iconSize: [size + 12, size + 12], iconAnchor: [(size + 12) / 2, (size + 12) / 2],
          });
        },
      });

      puntos.forEach(p => {
        const size = clusterSize(p.plazas, max);
        const pulse = p.plazas >= max * 0.9 && max > 0;
        const fs = size >= 40 ? "1rem" : size >= 30 ? "0.85rem" : "0.72rem";
        const markerKey = `${p.lat}_${p.lng}`;

        const makeIcon = (hovered: boolean) => {
          const border = hovered ? CLUSTER_BORDER_HOVER : CLUSTER_BORDER;
          const sizeH  = hovered ? size + 6 : size;
          const pulseHtml = (pulse || hovered)
            ? `<span style="position:absolute;inset:-7px;border-radius:50%;border:2px solid ${border};opacity:${hovered ? 0.8 : 0.5};animation:clusterPulse 1.2s ease-out infinite;"></span>`
            : "";
          return (L as any).divIcon({
            html: `<div style="position:relative;width:${sizeH}px;height:${sizeH}px;display:flex;align-items:center;justify-content:center;">
              ${pulseHtml}
              <div style="width:${sizeH}px;height:${sizeH}px;border-radius:50%;background:${CLUSTER_BG};border:2.5px solid ${border};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,${hovered ? 0.45 : 0.3});color:${CLUSTER_TEXT};font-weight:600;font-size:${fs};transition:all 0.2s;">
                ${p.plazas.toLocaleString("es-ES")}
              </div></div>`,
            className: "", iconSize: [sizeH + 12, sizeH + 12], iconAnchor: [(sizeH + 12) / 2, (sizeH + 12) / 2],
          });
        };

        const marker = L.marker([p.lat, p.lng], { icon: makeIcon(false), plazas: p.plazas } as any)
          .bindPopup(`<div style="font-size:0.85rem;line-height:1.6;min-width:180px;padding:2px 0">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:6px">${p.nombre}</div>
            <div style="display:flex;align-items:center;gap:6px;color:#0f766e;font-weight:600;margin-bottom:6px">
              <span style="font-size:1rem">${p.plazas.toLocaleString("es-ES")}</span>
              <span style="font-size:0.75rem;color:#64748b">plazas cotizadas</span>
            </div>
            ${p.tipo ? `<div style="font-size:0.72rem;color:#64748b;margin-bottom:4px;text-transform:capitalize"><span style="font-weight:600;color:#475569">Grupo:</span> ${p.tipo}</div>` : ""}
            ${p.categorias?.length ? `<div style="font-size:0.72rem;color:#64748b"><span style="font-weight:600;color:#475569">Servicios:</span><div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">${p.categorias.map(c => `<span style="display:inline-block;padding:1px 6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;color:#0f766e;font-size:0.68rem;font-weight:600">${c}</span>`).join("")}</div></div>` : ""}
          </div>`, { closeButton: false });

        // Guardar referencia para el efecto imán
        (marker as any)._makeIcon = makeIcon;
        (marker as any)._markerKey = markerKey;
        markersRef.current.set(markerKey, marker);
        cluster.addLayer(marker);
      });

      mapRef.current.addLayer(cluster);
      clusterRef.current = cluster;
      const bounds = (L as any).latLngBounds(puntos.map(p => [p.lat, p.lng]));
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 7 });
    })();
  }, [puntos, mapReady, maxPlazas]);

  // Efecto imán: cuando hoveredKey cambia, actualiza el icono del marker correspondiente
  useEffect(() => {
    markersRef.current.forEach((marker, key) => {
      const makeIcon = (marker as any)._makeIcon;
      if (makeIcon) marker.setIcon(makeIcon(key === hoveredKey));
    });
  }, [hoveredKey]);

  const flyToDestino = useCallback((p: Punto) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([p.lat, p.lng], 9, { duration: 1.2 });
  }, []);

  const aniosOpts = Array.from({ length: 3 }, (_, i) => ({ value: String(mesAnio + i - 1), label: String(mesAnio + i - 1) }));
  const tsOptsFormatted = tsOpts.map(ts => ({ value: ts, label: ts }));

  return (
    <div className={styles.heatmapSection}>
      <div className={styles.heatmapHeader}>
        <h2 className={styles.tableTitle}>Mapa de demanda turística</h2>
        <p className={styles.heatmapSubtitle}>
          Tendencias agregadas de cotizaciones · Sin datos de agencias ni clientes
        </p>
      </div>

      <div className={styles.heatmapControls}>
        <MultiDropdown label="Mes"            options={MESES_OPTS}      selected={meses}         onChange={setMeses}         placeholder="Todos los meses" />
        <MultiDropdown label="Año"            options={aniosOpts}       selected={anios}         onChange={setAnios}         placeholder="Todos los años"  />
        <MultiDropdown label="Tipo expediente" options={TIPOS_OPTS}     selected={tipos}         onChange={setTipos}         placeholder="Todos"           />
        {tsOptsFormatted.length > 0 && (
          <MultiDropdown label="Servicio"     options={tsOptsFormatted} selected={tiposServicio} onChange={setTiposServicio} placeholder="Todos"           />
        )}
      </div>

      <div className={styles.heatmapBody}>
        <div className={styles.mapContainer}>
          {loading && (
            <div className={styles.mapOverlay}>
              <div className={styles.mapSkeletonPulse} />
              <div className={styles.mapSpinner} />
            </div>
          )}
          <div ref={containerRef} className={styles.mapCanvas} />
        </div>

        <div className={styles.topDestinos}>
          <h3 className={styles.topTitle}>Top destinos</h3>
          <p className={styles.topSubtitle}>Plazas cotizadas agregadas</p>
          {loading ? (
            <SkeletonTopList />
          ) : topDestinos.length === 0 ? (
            <p className={styles.topEmpty}>Sin datos para los filtros seleccionados</p>
          ) : (
            <ol className={styles.topList}>
              {topDestinos.map((d, i) => {
                const key = `${d.lat}_${d.lng}`;
                const isHovered = hoveredKey === key;
                const maxPlz = topDestinos[0]?.plazas ?? 1;
                const pct = Math.round((d.plazas / maxPlz) * 100);
                const medalIcon = i === 0
                  ? <Trophy size={13} style={{ color: "#ca8a04", flexShrink: 0 }} />
                  : null;
                return (
                  <li
                    key={i}
                    className={styles.topItem}
                    onClick={() => flyToDestino(d)}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={{
                      cursor: "pointer",
                      background: isHovered ? "#f0fdf4" : "transparent",
                      borderRadius: 6,
                      padding: "0.25rem 0.3rem",
                      margin: "0 -0.3rem",
                      transition: "background 0.15s",
                    }}
                    title="Ver en el mapa"
                  >
                    <span className={styles.topRank}>
                      {medalIcon ?? <span style={{ fontSize: "0.65rem" }}>{i + 1}</span>}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.topInfo}>
                        <span className={styles.topNombre} style={{ color: isHovered ? "#0f766e" : undefined }}>
                          {d.nombre || "Desconocido"}
                        </span>
                        <span className={styles.topPlazas}>{d.plazas.toLocaleString("es-ES")} plz</span>
                      </div>
                      <div className={styles.topBarTrack}>
                        <div
                          className={styles.topBarFill}
                          style={{
                            width: `${pct}%`,
                            opacity: isHovered ? 1 : 0.7,
                            transition: "width 0.4s ease, opacity 0.2s",
                          }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className={styles.leyenda}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "#64748b" }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: CLUSTER_BG, border: `2px solid ${CLUSTER_BORDER}`, display: "inline-block" }} />
              Tamaño = volumen · Pulso = máxima demanda
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes clusterPulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes skeletonShimmer {
          0%   { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .leaflet-popup-content-wrapper { border-radius: 10px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.18) !important; }
        .leaflet-popup-tip { display: none; }
      `}</style>
    </div>
  );
}
