"use client";
import React, { useEffect, useRef } from "react";
import { Underline } from "lucide-react";

const ESTILOS_SUBRAYADO: { id: "solid" | "dotted" | "wavy"; label: string }[] = [
  { id: "solid", label: "Normal" },
  { id: "dotted", label: "Punteado" },
  { id: "wavy", label: "Ondulado" },
];

export default function TextoColorBoton({
  tipo,
  label,
  color,
  abierto,
  onAbrir,
  onCerrar,
  onChangeColor,
  estiloSubrayado,
  onChangeEstiloSubrayado,
}: {
  tipo: "texto" | "negrita" | "subrayado";
  label: string;
  color: string;
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  onChangeColor: (v: string) => void;
  estiloSubrayado?: "solid" | "dotted" | "wavy";
  onChangeEstiloSubrayado?: (v: "solid" | "dotted" | "wavy") => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [abierto, onCerrar]);

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "2px" }}>
      <button
        type="button"
        onClick={onAbrir}
        title={label}
        style={{
          width: 26, height: 26, borderRadius: "0.375rem", border: "1px solid #cbd5e1",
          background: "#ffffff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {tipo === "texto" && <span style={{ fontSize: "0.85rem", fontWeight: 500, color }}>T</span>}
        {tipo === "negrita" && <span style={{ fontSize: "0.85rem", fontWeight: 800, color }}>T</span>}
        {tipo === "subrayado" && <Underline size={14} color={color} />}
      </button>

      {abierto && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 20,
          background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.5rem",
          boxShadow: "0 8px 20px -6px rgba(15,23,42,0.2)", padding: "0.6rem", width: "160px",
          display: "flex", flexDirection: "column", gap: "0.5rem",
        }}>
          <input
            type="color"
            value={color}
            onChange={e => onChangeColor(e.target.value)}
            style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: "0.3rem", cursor: "pointer", padding: 0 }}
          />
          <span style={{ fontSize: "0.65rem", color: "#94a3b8", fontFamily: "monospace", textAlign: "center" }}>{color}</span>

          {tipo === "subrayado" && onChangeEstiloSubrayado && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" }}>
              {ESTILOS_SUBRAYADO.map(op => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => onChangeEstiloSubrayado(op.id)}
                  style={{
                    padding: "0.3rem 0.4rem", fontSize: "0.7rem", fontWeight: 600, textAlign: "left",
                    borderRadius: "0.3rem", cursor: "pointer",
                    border: estiloSubrayado === op.id ? "1.5px solid #1e293b" : "1px solid transparent",
                    background: estiloSubrayado === op.id ? "#f1f5f9" : "transparent",
                    color: "#334155",
                    textDecoration: "underline",
                    textDecorationStyle: op.id,
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
