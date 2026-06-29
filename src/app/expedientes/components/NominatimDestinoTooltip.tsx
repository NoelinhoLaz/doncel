"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { searchNominatim } from "@/actions/nominatim";
import { createDestinoFromNominatim } from "@/actions/destinos";
import { updateExpedienteDestino } from "@/actions/expedientes";
import type { NominatimResult } from "@/actions/nominatim";

interface Props {
  expedienteId: string;
  currentDestinoName: string;
  currentDestinoId: string | null;
  position: { top: number; left: number };
  onClose: () => void;
  onUpdated: () => void;
}

export default function NominatimDestinoTooltip({
  expedienteId,
  currentDestinoName,
  currentDestinoId,
  position,
  onClose,
  onUpdated,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchNominatim(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = useCallback(async (item: NominatimResult) => {
    setSaving(true);
    try {
      const destino = await createDestinoFromNominatim(item);
      if (destino) {
        await updateExpedienteDestino(expedienteId, destino.id);
        onUpdated();
        onClose();
      }
    } catch (err: any) {
      console.error("Error al asignar destino:", err);
    } finally {
      setSaving(false);
    }
  }, [expedienteId, onClose, onUpdated]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 99999,
        width: "300px",
        backgroundColor: "#ffffff",
        borderRadius: "0.5rem",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <div style={{ padding: "0.5rem", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
          Destino actual: <span style={{ color: "#475569" }}>{currentDestinoName}</span>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar ciudad, país, región..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem 0.5rem 0.4rem 1.75rem",
              borderRadius: "0.375rem",
              border: "1px solid #cbd5e1",
              fontSize: "0.78rem",
              outline: "none",
              color: "#0f172a",
              backgroundColor: "#ffffff",
              boxSizing: "border-box",
            }}
          />
          {loading && (
            <Loader2 size={14} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", animation: "spin 0.8s linear infinite" }} />
          )}
        </div>
      </div>

      <div style={{ maxHeight: "220px", overflowY: "auto", padding: "0.25rem" }}>
        {results.length > 0 ? (
          results.map((item) => (
            <div
              key={`${item.osmType}-${item.osmId}`}
              onClick={() => handleSelect(item)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.4rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <MapPin size={13} style={{ minWidth: 13, color: "#64748b", marginTop: 2 }} />
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0f172a" }}>
                  {item.city || item.state || item.displayName.split(",")[0].trim()}
                </div>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                  {item.displayName}
                </div>
                <div style={{ fontSize: "0.6rem", color: "#94a3b8", marginTop: "1px" }}>
                  {item.type} &middot; {item.country || ""}
                </div>
              </div>
            </div>
          ))
        ) : query.trim().length >= 2 && !loading ? (
          <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>
            Sin resultados
          </div>
        ) : query.trim().length < 2 ? (
          <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>
            Escribe al menos 2 caracteres
          </div>
        ) : null}
      </div>

      {saving && (
        <div style={{ padding: "0.5rem", textAlign: "center", fontSize: "0.7rem", color: "#64748b", borderTop: "1px solid #f1f5f9" }}>
          <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite", display: "inline", marginRight: "0.25rem" }} />
          Asignando destino...
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
