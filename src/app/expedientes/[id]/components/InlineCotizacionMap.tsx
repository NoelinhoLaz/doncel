"use client";

import { useMemo } from "react";
import { MapContainer, Marker, TileLayer, Popup, useMap } from "react-leaflet";
import L from "leaflet";

type MapItem = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tipoIcono?: string;
  tipoEtiqueta?: string;
  descripcion?: string;
  destinoNombre?: string;
};

const ICONS: Record<string, string> = {
  bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/><path d="M6 8h6a2 2 0 0 1 2 2v7H6"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 2 3 2 2 3 2-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
  "map-pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  mappin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};

function getMarkerIcon(iconName?: string) {
  const ic = (iconName || "").toLowerCase();
  const paths = ICONS[ic] || ICONS.bed;
  const html = `<div style="width:32px;height:32px;background:#475569;border:2px solid rgba(255,255,255,0.85);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>
  </div>`;
  return L.divIcon({ html, className: "", iconSize: [32, 32], iconAnchor: [16, 16] });
}

function FitBounds({ items }: { items: MapItem[] }) {
  const map = useMap();
  useMemo(() => {
    if (items.length === 0) return;
    const bounds = L.latLngBounds(items.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [items, map]);
  return null;
}

export default function InlineCotizacionMap({ items }: { items: MapItem[] }) {
  const hasItems = items.length > 0;

  if (!hasItems) {
    return (
      <div style={{
        height: 600, borderRadius: 10, border: "1px solid #e2e8f0",
        background: "#f8fafc", display: "flex", alignItems: "center",
        justifyContent: "center", color: "#64748b", fontSize: "0.85rem",
      }}>
        Sin ubicaciones para mostrar en el mapa.
      </div>
    );
  }

  return (
    <MapContainer
      center={[items[0].lat, items[0].lng]}
      zoom={3}
      scrollWheelZoom
      style={{ height: 600, width: "100%", borderRadius: 10 }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <FitBounds items={items} />
      {items.map((item) => (
        <Marker key={item.id} position={[item.lat, item.lng]} icon={getMarkerIcon(item.tipoIcono)}>
          <Popup>
            <div style={{ minWidth: 160, fontSize: "0.8rem" }}>
              {item.tipoEtiqueta && <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{item.tipoEtiqueta}</div>}
              {item.descripcion && <div style={{ color: "#334155" }}>{item.descripcion}</div>}
              {item.destinoNombre && <div style={{ color: "#64748b", fontSize: "0.72rem", marginTop: 2 }}>{item.destinoNombre}</div>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
