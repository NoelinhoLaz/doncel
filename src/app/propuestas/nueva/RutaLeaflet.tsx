"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

interface MediaItem { tipo: string; url: string }

interface UbicacionMapa {
  uid: string;
  nombre?: string;
  direccion?: string;
  descripcion?: string;
  lat?: number;
  lng?: number;
  medias?: MediaItem[];
}

interface SegmentoRuta {
  uid: string;
  modo: "foot-walking" | "driving-car";
  polyline?: [number, number][];
}

interface RutaItem {
  uid: string;
  titulo?: string;
  ubicaciones?: UbicacionMapa[];
  segmentos?: SegmentoRuta[];
}

function createMarkerIcon(n: number) {
  return L.divIcon({
    html: `<div style="
      background-color:rgba(71,85,105,0.9);
      color:#ffffff;
      border:2px solid rgba(255,255,255,0.8);
      border-radius:50%;
      width:26px;height:26px;
      display:flex;align-items:center;justify-content:center;
      font-family:'Montserrat',sans-serif;
      font-weight:700;font-size:10px;
      box-shadow:0 2px 10px rgba(0,0,0,0.12);">${n}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ ubicaciones }: { ubicaciones: UbicacionMapa[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = ubicaciones.filter(u => u.lat != null && u.lng != null);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView([pts[0].lat!, pts[0].lng!], 12);
      return;
    }
    const bounds = L.latLngBounds(pts.map(u => [u.lat!, u.lng!]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, ubicaciones]);
  return null;
}

export default function RutaLeaflet({
  rutas,
  activeRutaIdx,
  height,
}: {
  rutas: RutaItem[];
  activeRutaIdx: number;
  height?: string;
}) {
  const isAll = activeRutaIdx === -1;
  const activeRutas = isAll ? rutas : [rutas[Math.min(activeRutaIdx, rutas.length - 1)]].filter(Boolean);
  const allUbicaciones = activeRutas.flatMap(r => r.ubicaciones ?? []);
  const withCoords = allUbicaciones.filter(u => u.lat != null && u.lng != null);
  const defaultCenter: [number, number] = withCoords.length > 0
    ? [withCoords[0].lat!, withCoords[0].lng!]
    : [40.416775, -3.70379];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={withCoords.length === 1 ? 12 : 5}
      style={{ width: "100%", height: height ?? "100%", minHeight: "inherit", borderRadius: "inherit" }}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <FitBounds ubicaciones={withCoords} />
      {activeRutas.map(ruta => {
        const ubs = (ruta.ubicaciones ?? []).filter(u => u.lat != null && u.lng != null);
        const segs = ruta.segmentos ?? [];
        return (
          <React.Fragment key={ruta.uid}>
            {ubs.map((u, i) => (
              <Marker key={u.uid} position={[u.lat!, u.lng!]} icon={createMarkerIcon(i + 1)}>
                <Popup minWidth={200} maxWidth={260}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <strong style={{ fontSize: "0.82rem", color: "#1e293b" }}>{u.nombre ?? `Destino ${i + 1}`}</strong>
                    {u.descripcion && (
                      <p style={{ margin: 0, fontSize: "0.74rem", color: "#475569", lineHeight: 1.45 }}>{u.descripcion}</p>
                    )}
                    {(u.medias ?? []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: 2 }}>
                        {(u.medias ?? []).map((m, mi) => (
                          <div
                            key={mi}
                            style={{ width: 52, height: 40, borderRadius: "0.3rem", backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center", border: "1px solid #e2e8f0", flexShrink: 0 }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
            {ubs.map((u, i) => {
              if (i >= ubs.length - 1) return null;
              const next = ubs[i + 1];
              const seg = segs[i];
              if (seg?.polyline && seg.polyline.length >= 2) {
                const color = seg.modo === "foot-walking" ? "#22c55e" : "#3b82f6";
                const dashArray = seg.modo === "foot-walking" ? "8 4" : undefined;
                return (
                  <Polyline
                    key={`${ruta.uid}-seg-${i}`}
                    positions={seg.polyline}
                    pathOptions={{ color, weight: 4, dashArray }}
                  />
                );
              }
              return (
                <Polyline
                  key={`${ruta.uid}-seg-${i}-straight`}
                  positions={[[u.lat!, u.lng!], [next.lat!, next.lng!]]}
                  pathOptions={{ color: "#94a3b8", weight: 2, dashArray: "6 4" }}
                />
              );
            })}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
