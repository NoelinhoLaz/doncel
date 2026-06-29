"use client";

import { useState, useRef, useEffect } from "react";
import { searchPlaces, getPlaceDetails } from "@/actions/places";
import type { PlaceDetails } from "@/actions/places";
import { MapPin, Loader2 } from "lucide-react";

interface Props {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  onPlaceSelected: (place: PlaceDetails) => void;
}

export default function PlacesAutocompleteField({ value, placeholder, onChange, onPlaceSelected }: Props) {
  const [suggestions, setSuggestions] = useState<{ placeId: string; mainText: string; secondaryText: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = async () => {
    const query = (document.getElementById("places-input") as HTMLInputElement)?.value || value;
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const results = await searchPlaces(query);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (suggestion: { placeId: string; mainText: string }) => {
    setIsOpen(false);
    setLoading(true);
    try {
      const details = await getPlaceDetails(suggestion.placeId);
      if (details) {
        onChange(suggestion.mainText);
        onPlaceSelected(details);
      }
    } catch (err: any) {
      console.error("Error al obtener datos del lugar:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            id="places-input"
            type="text"
            defaultValue={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%", height: 34,
              border: "1px solid #cbd5e1", borderRadius: 6,
              padding: "0.4rem", fontSize: "0.8rem",
              color: "inherit", background: "#fff",
              boxSizing: "border-box", outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, flexShrink: 0,
            border: "1px solid #cbd5e1", borderRadius: 6,
            background: "#fff", color: "#64748b", cursor: "pointer",
          }}
        >
          {loading ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <img src="/google-maps-2020-icon.svg" alt="Google" style={{ width: 16, height: 16 }} />}
        </button>
      </div>
      {isOpen && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          border: "1px solid #e2e8f0", zIndex: 99999, overflow: "hidden",
        }}>
          {suggestions.map((s) => (
            <div
              key={s.placeId}
              onClick={() => handleSelect(s)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "0.55rem 0.65rem", cursor: "pointer",
                transition: "background 0.1s", borderBottom: "1px solid #f8fafc",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <MapPin size={13} style={{ minWidth: 13, color: "#64748b", marginTop: 2 }} />
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}>{s.mainText}</div>
                {s.secondaryText && (
                  <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{s.secondaryText}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
