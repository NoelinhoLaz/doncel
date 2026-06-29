"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { MapPin } from "lucide-react";

const markerIcon = typeof window !== "undefined"
  ? L.divIcon({
      html: `<div style="
        background:rgba(71,85,105,0.9);
        border:2px solid rgba(255,255,255,0.9);
        border-radius:50%;
        width:22px;height:22px;
        box-shadow:0 2px 8px rgba(0,0,0,0.2);
      "></div>`,
      className: "",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })
  : (null as any);

const W = 260;
const H = 160;

export function EntidadMapa({ lat, lng, nombre }: { lat: number; lng: number; nombre: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const placeholder = (
    <div style={{
      width: W, height: H, flexShrink: 0,
      borderRadius: "0.5rem", border: "1px solid #e2e8f0",
      background: "#f1f5f9",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 4, color: "#94a3b8",
    }}>
      <MapPin size={18} />
      <span style={{ fontSize: "0.65rem" }}>Cargando mapa…</span>
    </div>
  );

  if (!mounted) return placeholder;

  return (
    <a
      href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Ver ${nombre} en OpenStreetMap`}
      style={{ flexShrink: 0, borderRadius: "0.5rem", overflow: "hidden", display: "block", border: "1px solid #e2e8f0", width: W, height: H }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <Marker position={[lat, lng]} icon={markerIcon} />
      </MapContainer>
    </a>
  );
}

export function EntidadMapaPlaceholder() {
  return (
    <div style={{
      width: W, height: H, flexShrink: 0,
      borderRadius: "0.5rem", border: "1px dashed #e2e8f0",
      background: "#f8fafc",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 6, color: "#cbd5e1",
    }}>
      <MapPin size={20} />
      <span style={{ fontSize: "0.65rem", color: "#94a3b8", textAlign: "center", lineHeight: 1.4 }}>
        Sin ubicación<br />registrada
      </span>
    </div>
  );
}
