"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useState } from "react";

function makeIcon(color: string) {
  return L.divIcon({
    html: `<div style="
      background:${color};
      border:2px solid rgba(255,255,255,0.9);
      border-radius:50%;
      width:14px;height:14px;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
    "></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Desplaza puntos con coordenadas idénticas en círculo para que sean visibles
function spreadDuplicates(puntos: Punto[]): (Punto & { lat: number; lng: number })[] {
  const groups = new Map<string, number[]>();
  puntos.forEach((p, i) => {
    const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });

  const result = puntos.map(p => ({ ...p }));
  const RADIUS = 0.0003; // ~30m en grados

  groups.forEach(indices => {
    if (indices.length < 2) return;
    indices.forEach((idx, i) => {
      const angle = (2 * Math.PI * i) / indices.length - Math.PI / 2;
      result[idx] = {
        ...result[idx],
        lat: puntos[idx].lat + RADIUS * Math.cos(angle),
        lng: puntos[idx].lng + RADIUS * Math.sin(angle),
      };
    });
  });

  return result;
}

type Punto = {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  estadoNombre: string;
  estadoColor: string;
  agente?: string;
};

export function MapaOportunidades({ puntos, onEntidadClick }: { puntos: Punto[]; onEntidadClick?: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const spread = useMemo(() => spreadDuplicates(puntos), [puntos]);

  const center = useMemo(() => {
    if (!puntos.length) return [40.4168, -3.7038] as [number, number];
    const lat = puntos.reduce((s, p) => s + p.lat, 0) / puntos.length;
    const lng = puntos.reduce((s, p) => s + p.lng, 0) / puntos.length;
    return [lat, lng] as [number, number];
  }, [puntos]);

  if (!mounted) return <div style={{ height: "100%", background: "#f1f5f9", borderRadius: "0.5rem" }} />;

  return (
    <MapContainer
      center={center}
      zoom={puntos.length === 1 ? 14 : 6}
      style={{ width: "100%", height: "100%", borderRadius: "0.5rem" }}
      zoomControl={true}
      scrollWheelZoom={true}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      {spread.map(p => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={makeIcon(p.estadoColor)}>
          <Popup>
            <div style={{ fontSize: "0.78rem", lineHeight: 1.5, minWidth: 160 }}>
              <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{p.nombre}</div>
              <div style={{ display: "inline-flex", alignItems: "center", height: 16, borderRadius: 99, background: p.estadoColor, color: "#fff", fontSize: "0.6rem", fontWeight: 600, padding: "0 6px", marginBottom: 4 }}>
                {p.estadoNombre}
              </div>
              {p.agente && <div style={{ color: "#64748b", fontSize: "0.72rem" }}>{p.agente}</div>}
              {onEntidadClick && (
                <button
                  onClick={() => onEntidadClick(p.id)}
                  style={{ marginTop: 6, fontSize: "0.72rem", border: "none", background: "var(--primary-color,#475569)", color: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                >
                  Ver detalle
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
