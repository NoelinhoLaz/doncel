"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, Loader2 } from 'lucide-react';
import type { MapaDestino } from '@/actions/expedientes';

interface ClusterItem {
  id: string;
  lat: number;
  lng: number;
  count: number;
  puntos: MapaDestino[];
}

const createClusterIcon = (count: number, size = 34) => {
  if (typeof window === 'undefined') return null as any;
  const fontSize = size > 26 ? 12 : 10;
  return L.divIcon({
    html: `<div style="
      background-color: rgba(71, 85, 105, 0.9);
      color: #ffffff;
      border: 2px solid rgba(255,255,255,0.8);
      border-radius: 50%;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: ${fontSize}px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.12);
    ">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createMarkerIcon = () => createClusterIcon(1, 26);

function ClusterLayer({ puntos, onFilterDestino }: { puntos: MapaDestino[]; onFilterDestino?: (name: string) => void }) {
  const map = useMap();
  const [clusters, setClusters] = useState<ClusterItem[]>([]);

  const buildClusters = () => {
    if (!map || puntos.length === 0) {
      setClusters([]);
      return;
    }

    const distanceThreshold = 50; // px
    const newClusters: ClusterItem[] = [];

    puntos.forEach((punto) => {
      const latlng = L.latLng(punto.lat, punto.lng);
      const point = map.latLngToLayerPoint(latlng);
      let added = false;

      for (const cluster of newClusters) {
        const clusterPoint = map.latLngToLayerPoint([cluster.lat, cluster.lng]);
        if (clusterPoint.distanceTo(point) <= distanceThreshold) {
          cluster.puntos.push(punto);
          cluster.count += 1;
          cluster.lat = (cluster.lat * (cluster.count - 1) + punto.lat) / cluster.count;
          cluster.lng = (cluster.lng * (cluster.count - 1) + punto.lng) / cluster.count;
          added = true;
          break;
        }
      }

      if (!added) {
        newClusters.push({
          id: `${punto.expedienteId}-${punto.lat}-${punto.lng}`,
          lat: punto.lat,
          lng: punto.lng,
          count: 1,
          puntos: [punto],
        });
      }
    });

    setClusters(newClusters);
  };

  useEffect(() => {
    buildClusters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, puntos]);

  useMapEvents({ zoomend: buildClusters, moveend: buildClusters });

  return (
    <>
      {clusters.map((cluster) => (
        <Marker
          key={cluster.id}
          position={[cluster.lat, cluster.lng]}
          icon={cluster.count > 1 ? createClusterIcon(cluster.count) : createMarkerIcon()}
          eventHandlers={cluster.count === 1 ? {
            click: () => onFilterDestino?.(cluster.puntos[0].destinoNombre),
          } : undefined}
        >
          <Popup>
            {cluster.count > 1 ? (
              <div style={{ minWidth: 200 }}>
                <p style={{ marginBottom: 8, fontWeight: 700 }}>{cluster.count} expedientes agrupados</p>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {cluster.puntos.slice(0, 5).map((p, idx) => (
                    <li
                      key={`${p.expedienteId}-${idx}`}
                      onClick={() => onFilterDestino?.(p.destinoNombre)}
                      style={{ marginBottom: 4, cursor: "pointer", padding: "2px 0" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "#475569"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "inherit"}
                    >
                      <strong>{p.numero || 'Exp.'}</strong> · {p.destinoNombre}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div style={{ minWidth: 160 }}>
                <p
                  style={{ marginBottom: 4, fontWeight: 700, cursor: "pointer" }}
                  onClick={() => onFilterDestino?.(cluster.puntos[0].destinoNombre)}
                >
                  {cluster.puntos[0].destinoNombre}
                </p>
                <p style={{ margin: 0 }}>{cluster.puntos[0].referencia || 'Sin referencia'}</p>
              </div>
            )}
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function FitBoundsUpdater({ puntos }: { puntos: MapaDestino[] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    map.invalidateSize();
    const bounds = L.latLngBounds(puntos.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
  }, [puntos, map]);
  return null;
}

export default function MapComponent({ puntos, onFilterDestino }: { puntos: MapaDestino[]; onFilterDestino?: (name: string) => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const bounds = useMemo(() => {
    if (puntos.length === 0) return null;
    return L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number]));
  }, [puntos]);

  if (!mounted || typeof window === 'undefined') {
    return (
      <div style={{ 
        height: '100%', 
        width: '100%', 
        borderRadius: '1rem', 
        backgroundColor: '#edf0f5', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: '#64748b',
        fontSize: '0.85rem' 
      }}>
        Cargando mapa...
      </div>
    );
  }

  return (
    <MapContainer
      key={`leaflet-map-${puntos.length}`}
      center={[20, 10]}
      zoom={2}
      style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
      bounds={bounds || undefined}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <MapSearchControl />
      <ClusterLayer puntos={puntos} onFilterDestino={onFilterDestino} />
      <FitBoundsUpdater puntos={puntos} />
    </MapContainer>
  );
}

function MapSearchControl() {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ label: string; lat: number; lng: number; tipo: string }>>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'GroomySaas_TravelApp_Contact/dev@noellazueng.com' }
        });
        const data = await res.json();
        setResults((data || []).map((lugar: any) => ({
          label: lugar.display_name,
          lat: parseFloat(lugar.lat),
          lng: parseFloat(lugar.lon),
          tipo: lugar.type || '',
        })));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (item: { label: string; lat: number; lng: number; tipo: string }) => {
    let zoom = 14;
    if (item.tipo === 'administrative' || item.tipo === 'country' || item.tipo === 'state') zoom = 8;
    else if (item.tipo === 'hotel' || item.tipo === 'house' || item.tipo === 'point' || item.tipo === 'yes') zoom = 18;
    map.flyTo([item.lat, item.lng], zoom, { animate: true, duration: 1.5 });
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={containerRef} style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, width: 260 }}>
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
        <input
          type="text"
          placeholder="Buscar destino en el mapa..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%", padding: "0.4rem 0.5rem 0.4rem 1.75rem", border: "1px solid #cbd5e1",
            borderRadius: 6, fontSize: "0.78rem", outline: "none", color: "#0f172a", fontFamily: '"Montserrat", sans-serif',
            background: "#ffffff", boxSizing: "border-box", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        />
        {loading && (
          <Loader2 size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", animation: "spin 0.8s linear infinite" }} />
        )}
      </div>
      {results.length > 0 && (
        <div style={{
          marginTop: 4, background: "#fff", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          border: "1px solid #e2e8f0", overflow: "hidden", maxHeight: 220, overflowY: "auto",
        }}>
          {results.map((item, i) => (
            <div
              key={i}
              onClick={() => handleSelect(item)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "0.5rem 0.65rem", cursor: "pointer",
                borderBottom: i < results.length - 1 ? "1px solid #f8fafc" : "none",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <MapPin size={13} style={{ minWidth: 13, color: "#64748b", marginTop: 2 }} />
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#0f172a" }}>{item.label.split(",")[0].trim()}</div>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
