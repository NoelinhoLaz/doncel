"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import { getTiposServicios } from "@/actions/tiposServicios";

interface ServiceTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export default function ServiceTypeSelector({ value, onChange, compact }: ServiceTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tipos, setTipos] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTiposServicios().then(setTipos).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = tipos.find(t => t.id === value);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: compact ? "0.2rem 0.4rem" : "0.5rem 0.75rem",
          borderRadius: compact ? "6px" : "0.375rem",
          border: "1px solid #cbd5e1",
          fontSize: compact ? "0.75rem" : "0.85rem",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          cursor: "pointer",
          outline: "none",
          height: compact ? "30px" : "38px",
          boxSizing: "border-box",
        }}
      >
        <span style={{ color: value && selected ? "#0f172a" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {selected?.etiqueta || "Seleccionar..."}
        </span>
        <ChevronDown size={14} style={{ color: "#64748b", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "160px",
            backgroundColor: "#ffffff",
            borderRadius: "0.5rem",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0",
            zIndex: 99999,
            overflow: "hidden",
          }}
        >
          {tipos.length === 0 ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Sin tipos</div>
          ) : (
            tipos.map((t) => {
              const isSelected = value === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => { onChange(t.id); setIsOpen(false); }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.45rem 0.75rem",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    backgroundColor: isSelected ? "#f0fdf4" : "transparent",
                    color: "#0f172a",
                    transition: "background-color 0.15s",
                    borderBottom: "1px solid #f8fafc",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <span style={{ fontWeight: isSelected ? 600 : 400 }}>{t.etiqueta}</span>
                  {isSelected && <Check size={14} style={{ color: "#22c55e" }} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
