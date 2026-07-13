"use client";

import { useMemo } from "react";
import { MapContainer, Marker, TileLayer, Popup, useMap } from "react-leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin as MapPinIcon } from "lucide-react";
import L from "leaflet";
import { resolveLucideIconComponent } from "@/lib/lucideIconResolver";

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

function getMarkerIcon(iconName?: string) {
  const IconComponent = resolveLucideIconComponent(iconName) || MapPinIcon;
  const svg = renderToStaticMarkup(
    <IconComponent size={16} color="#ffffff" strokeWidth={2} />
  );
  const html = `<div style="width:32px;height:32px;background:#475569;border:2px solid rgba(255,255,255,0.85);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
    ${svg}
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
