"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { LugarPlaces } from "./BuscarNegocioModal";

function makeIcon() {
  return L.divIcon({
    html: `<div style="
      background:var(--primary-color, #475569);
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

export function BuscarNegocioResultadosMapa({ resultados, onSelect }: { resultados: LugarPlaces[]; onSelect: (lugar: LugarPlaces) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const puntos = useMemo(() => resultados.filter(r => r.lat != null && r.lng != null), [resultados]);

  const center = useMemo(() => {
    if (!puntos.length) return [40.4168, -3.7038] as [number, number];
    const lat = puntos.reduce((s, p) => s + (p.lat as number), 0) / puntos.length;
    const lng = puntos.reduce((s, p) => s + (p.lng as number), 0) / puntos.length;
    return [lat, lng] as [number, number];
  }, [puntos]);

  if (!mounted) return <div style={{ height: "100%", background: "#f1f5f9", borderRadius: "0.5rem" }} />;

  return (
    <MapContainer
      center={center}
      zoom={puntos.length === 1 ? 15 : 13}
      style={{ width: "100%", height: "100%", borderRadius: "0.5rem" }}
      zoomControl={true}
      scrollWheelZoom={true}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      {puntos.map((p, i) => (
        <Marker key={i} position={[p.lat as number, p.lng as number]} icon={makeIcon()}>
          <Popup>
            <div style={{ fontSize: "0.78rem", lineHeight: 1.5, minWidth: 160 }}>
              <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{p.nombre}</div>
              <div style={{ color: "#64748b", fontSize: "0.72rem", marginBottom: 6 }}>{p.direccion}</div>
              <button
                onClick={() => onSelect(p)}
                style={{ fontSize: "0.72rem", border: "none", background: "var(--primary-color,#475569)", color: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
              >
                Seleccionar
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
