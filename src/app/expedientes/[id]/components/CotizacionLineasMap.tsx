"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

type Point = {
  id: string;
  destinoId: string;
  label: string;
  subtitle?: string;
  lat: number;
  lng: number;
};

const PRIMARY = "#475569";

function createClusterIcon(count: number, size = 34) {
  const fontSize = size > 26 ? 12 : 10;
  return L.divIcon({
    html: `<div style="
      background-color: ${PRIMARY};
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
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const singleIcon = createClusterIcon(1, 26);

function ClusterLayer({ puntos, onDestClick }: { puntos: Point[]; onDestClick: (id: string) => void }) {
  const map = useMap();
  const [clusters, setClusters] = useState<Array<{
    id: string;
    lat: number;
    lng: number;
    count: number;
    puntos: Point[];
  }>>([]);

  const buildClusters = () => {
    if (!map || puntos.length === 0) {
      setClusters([]);
      return;
    }
    const distanceThreshold = 50;
    const newClusters: typeof clusters = [];

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
          id: `${punto.id}`,
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
  }, [map, puntos]);

  useMapEvents({ zoomend: buildClusters, moveend: buildClusters });

  return (
    <>
      {clusters.map((cluster) => (
        <Marker
          key={cluster.id}
          position={[cluster.lat, cluster.lng]}
          icon={cluster.count > 1 ? createClusterIcon(cluster.count) : singleIcon}
          eventHandlers={cluster.count === 1 ? {
            click: () => onDestClick(cluster.puntos[0].destinoId),
          } : {
            click: () => map.setView([cluster.lat, cluster.lng], map.getZoom() + 2, { animate: true }),
          }}
        >
          <Popup>
            {cluster.count > 1 ? (
              <div style={{ minWidth: 200 }}>
                <p style={{ marginBottom: 8, fontWeight: 700 }}>{cluster.count} líneas agrupadas</p>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {cluster.puntos.map((p) => (
                    <li
                      key={p.id}
                      style={{ marginBottom: 4, cursor: "pointer", color: PRIMARY, textDecoration: "underline" }}
                      onClick={() => onDestClick(p.destinoId)}
                    >
                      {p.label}{p.subtitle ? ` · ${p.subtitle}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div style={{ minWidth: 160 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{cluster.puntos[0].label}</p>
                {cluster.puntos[0].subtitle ? <p style={{ margin: 0 }}>{cluster.puntos[0].subtitle}</p> : null}
              </div>
            )}
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function MapSearchControl() {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Array<{ label: string; lat: number; lng: number; tipo: string }>>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
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
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = (item: { label: string; lat: number; lng: number; tipo: string }) => {
    let zoom = 14;
    if (item.tipo === 'administrative' || item.tipo === 'country' || item.tipo === 'state') zoom = 8;
    else if (item.tipo === 'hotel' || item.tipo === 'house' || item.tipo === 'point' || item.tipo === 'yes') zoom = 18;
    map.flyTo([item.lat, item.lng], zoom, { animate: true, duration: 1.5 });
    setQuery(item.label);
  };

  return (
    <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, width: 240 }}>
      <input
        type="text"
        placeholder="Buscar destino en el mapa..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        style={{
          width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1",
          borderRadius: 6, fontSize: "0.78rem", outline: "none", color: "#0f172a", fontFamily: '"Montserrat", sans-serif',
          background: "#ffffff", boxSizing: "border-box", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      />
      {focused && results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
          background: "#ffffff", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          border: "1px solid #e2e8f0", maxHeight: 200, overflow: "auto",
        }}>
          {results.map((r, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(r)}
              style={{
                padding: "0.4rem 0.5rem", fontSize: "0.76rem", cursor: "pointer", fontFamily: '"Montserrat", sans-serif',
                borderBottom: "1px solid #f1f5f9", color: "#0f172a", lineHeight: 1.3,
              }}
            >
              {r.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CotizacionLineasMap({ points, onDestinationClick, height = 280 }: { points: Point[]; onDestinationClick: (id: string) => void; height?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const bounds = useMemo(() => {
    if (points.length === 0) return null;
    return L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
  }, [points]);

  if (!mounted) return <div style={{ height, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }} />;

  if (points.length === 0) {
    return (
      <div style={{
        height,
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        fontSize: "0.85rem",
      }}>
        Sin ubicaciones para mostrar en el mapa.
      </div>
    );
  }

  return (
    <MapContainer
      center={[points[0].lat, points[0].lng]}
      zoom={3}
      bounds={bounds || undefined}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: 10 }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <ClusterLayer puntos={points} onDestClick={onDestinationClick} />
      <MapSearchControl />
    </MapContainer>
  );
}
