"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{ width: 600, maxWidth: "90vw", height: "auto", borderRadius: "0.6rem", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}
      />
    </div>
  );
}

export default function MapaLeaflet({
  ubicaciones,
  height,
}: {
  ubicaciones: UbicacionMapa[];
  height?: string;
}) {
  const [modalImg, setModalImg] = useState<string | null>(null);
  const withCoords = ubicaciones.filter(u => u.lat != null && u.lng != null);
  const defaultCenter: [number, number] = withCoords.length > 0
    ? [withCoords[0].lat!, withCoords[0].lng!]
    : [40.416775, -3.70379];

  return (
    <>
      {modalImg && <ImageModal src={modalImg} onClose={() => setModalImg(null)} />}
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
        {withCoords.map((u, i) => (
          <Marker key={u.uid} position={[u.lat!, u.lng!]} icon={createMarkerIcon(i + 1)}>
            <Popup minWidth={200} maxWidth={260}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <strong style={{ fontSize: "0.82rem", color: "#1e293b" }}>{u.nombre ?? `Ubicación ${i + 1}`}</strong>
                {u.descripcion && (
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#475569", lineHeight: 1.45 }}>{u.descripcion}</p>
                )}
                {(u.medias ?? []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: 2 }}>
                    {(u.medias ?? []).map((m, mi) => (
                      <div
                        key={mi}
                        onClick={() => setModalImg(m.url)}
                        style={{ width: 52, height: 40, borderRadius: "0.3rem", backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer", border: "1px solid #e2e8f0", flexShrink: 0 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}
