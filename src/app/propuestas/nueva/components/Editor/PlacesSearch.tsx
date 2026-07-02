"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { searchPlaces, getPlaceDetails } from "@/actions/places";
import type { Seccion, MediaItem } from "../../types";
import { calcularSegmento } from "../../utils/routes-api";
import styles from "../../page.module.css";

export function PlacesSearchField({ ubicacionUid, mapaUid, currentNombre, seccion, onUpdate }: {
  ubicacionUid: string;
  mapaUid: string;
  currentNombre?: string;
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [q, setQ] = useState(currentNombre ?? "");
  const [suggestions, setSuggestions] = useState<import("@/actions/places").PlaceSuggestion[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const res = await searchPlaces(val);
        setSuggestions(res);
      } finally {
        setLoadingSugg(false);
      }
    }, 300);
  };

  const handleSelect = async (s: import("@/actions/places").PlaceSuggestion) => {
    setQ(s.fullText);
    setSuggestions([]);
    const details = await getPlaceDetails(s.placeId);
    if (!details) return;
    const newMedias: MediaItem[] = details.photos.map(p => ({
      tipo: "link" as const,
      url: `/api/places/photo?name=${encodeURIComponent(p.name)}`,
    }));
    const updatedMapas = (seccion.mapas ?? []).map(m => {
      if (m.uid !== mapaUid) return m;
      return {
        ...m,
        ubicaciones: (m.ubicaciones ?? []).map(u => {
          if (u.uid !== ubicacionUid) return u;
          return {
            ...u,
            placeId: details.placeId,
            nombre: details.displayName,
            direccion: details.formattedAddress,
            lat: details.lat ?? undefined,
            lng: details.lng ?? undefined,
            medias: newMedias,
          };
        }),
      };
    });
    onUpdate(seccion.uid, { mapas: updatedMapas });
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={q}
        onChange={e => handleChange(e.target.value)}
        placeholder="Buscar lugar..."
        className={styles.editorInput}
        style={{ width: "100%", background: "#ffffff" }}
      />
      {loadingSugg && <span style={{ fontSize: "0.72rem", color: "#94a3b8", paddingLeft: 4 }}>Buscando...</span>}
      {suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.4rem", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
          {suggestions.map(s => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => handleSelect(s)}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}
            >
              <span style={{ fontWeight: 600 }}>{s.mainText}</span>
              {s.secondaryText && <span style={{ color: "#64748b" }}> · {s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlacesSearchFieldRuta({ ubicacionUid, rutaUid, currentNombre, seccion, onUpdate }: {
  ubicacionUid: string;
  rutaUid: string;
  currentNombre?: string;
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [q, setQ] = useState(currentNombre ?? "");
  const [suggestions, setSuggestions] = useState<import("@/actions/places").PlaceSuggestion[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const res = await searchPlaces(val);
        setSuggestions(res);
      } finally {
        setLoadingSugg(false);
      }
    }, 300);
  };

  const handleSelect = async (s: import("@/actions/places").PlaceSuggestion) => {
    setQ(s.fullText);
    setSuggestions([]);
    const details = await getPlaceDetails(s.placeId);
    if (!details) return;
    const newMedias: MediaItem[] = details.photos.map(p => ({
      tipo: "link" as const,
      url: `/api/places/photo?name=${encodeURIComponent(p.name)}`,
    }));
    const updatedRutas = (seccion.rutas ?? []).map(r => {
      if (r.uid !== rutaUid) return r;
      return {
        ...r,
        ubicaciones: (r.ubicaciones ?? []).map(u => {
          if (u.uid !== ubicacionUid) return u;
          return {
            ...u,
            placeId: details.placeId,
            nombre: details.displayName,
            direccion: details.formattedAddress,
            lat: details.lat ?? undefined,
            lng: details.lng ?? undefined,
            medias: newMedias,
          };
        }),
      };
    });
    const nextSeccion = { ...seccion, rutas: updatedRutas };
    onUpdate(seccion.uid, { rutas: updatedRutas });
    const ruta = updatedRutas.find(r => r.uid === rutaUid);
    if (!ruta) return;
    const ubs = ruta.ubicaciones ?? [];
    const uIdx = ubs.findIndex(u => u.uid === ubicacionUid);
    if (uIdx > 0) {
      const prev = ubs[uIdx - 1];
      const curr = ubs[uIdx];
      const modo = (ruta.segmentos ?? [])[uIdx - 1]?.modo ?? "driving-car";
      await calcularSegmento(seccion.uid, rutaUid, uIdx - 1, modo, prev, { ...curr, lat: details.lat ?? undefined, lng: details.lng ?? undefined }, nextSeccion, onUpdate);
    }
    if (uIdx < ubs.length - 1) {
      const curr = ubs[uIdx];
      const next = ubs[uIdx + 1];
      const modo = (ruta.segmentos ?? [])[uIdx]?.modo ?? "driving-car";
      await calcularSegmento(seccion.uid, rutaUid, uIdx, modo, { ...curr, lat: details.lat ?? undefined, lng: details.lng ?? undefined }, next, nextSeccion, onUpdate);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={q}
        onChange={e => handleChange(e.target.value)}
        placeholder="Buscar lugar..."
        className={styles.editorInput}
        style={{ width: "100%", background: "#ffffff" }}
      />
      {loadingSugg && <span style={{ fontSize: "0.72rem", color: "#94a3b8", paddingLeft: 4 }}>Buscando...</span>}
      {suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.4rem", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
          {suggestions.map(s => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => handleSelect(s)}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}
            >
              <span style={{ fontWeight: 600 }}>{s.mainText}</span>
              {s.secondaryText && <span style={{ color: "#64748b" }}> · {s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
