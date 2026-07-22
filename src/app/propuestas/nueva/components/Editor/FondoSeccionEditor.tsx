"use client";

import React, { useState } from "react";
import type { Seccion } from "../../types";
import styles from "../../page.module.css";
import MediaSelector from "./MediaSelector";

export default function FondoSeccionEditor({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [mediaAbierto, setMediaAbierto] = useState(false);
  const tipo: "color" | "imagen" = seccion.imagenFondo?.url ? "imagen" : "color";

  const elegirColor = () => {
    if (seccion.imagenFondo) onUpdate(seccion.uid, { imagenFondo: undefined });
  };

  return (
    <div className={styles.editorSection}>
      <label className={styles.editorFieldLabel}>Fondo de la sección</label>

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button
          type="button"
          onClick={elegirColor}
          style={{ flex: 1, padding: "0.35rem 0.5rem", borderRadius: "0.4rem", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer",
            border: tipo === "color" ? "2px solid #1e293b" : "1.5px solid #e2e8f0",
            background: tipo === "color" ? "#1e293b" : "#ffffff",
            color: tipo === "color" ? "#ffffff" : "#64748b" }}
        >
          Color
        </button>
        <button
          type="button"
          onClick={() => setMediaAbierto(true)}
          style={{ flex: 1, padding: "0.35rem 0.5rem", borderRadius: "0.4rem", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer",
            border: tipo === "imagen" ? "2px solid #1e293b" : "1.5px solid #e2e8f0",
            background: tipo === "imagen" ? "#1e293b" : "#ffffff",
            color: tipo === "imagen" ? "#ffffff" : "#64748b" }}
        >
          Imagen
        </button>
      </div>

      {tipo === "color" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label className={styles.colorPickerBtn} style={{ background: seccion.colorFondo ?? "#ffffff", width: 34, height: 34, borderRadius: "0.5rem" }}>
            <input type="color" value={seccion.colorFondo ?? "#ffffff"} onChange={e => onUpdate(seccion.uid, { colorFondo: e.target.value })} />
          </label>
          <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>{seccion.colorFondo ?? "#ffffff"}</span>
          {seccion.colorFondo && (
            <button onClick={() => onUpdate(seccion.uid, { colorFondo: undefined })} style={{ fontSize: "0.75rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Restablecer</button>
          )}
        </div>
      )}

      {tipo === "imagen" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div
              style={{
                width: 56, height: 40, borderRadius: "0.5rem",
                backgroundImage: `url(${seccion.imagenFondo!.url})`,
                backgroundSize: "cover", backgroundPosition: "center",
                border: "1px solid #cbd5e1", cursor: "pointer", flexShrink: 0,
              }}
              onClick={() => setMediaAbierto(v => !v)}
            />
            <button
              type="button"
              onClick={() => onUpdate(seccion.uid, { imagenFondo: undefined })}
              style={{ fontSize: "0.75rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Quitar imagen
            </button>
          </div>

          <div>
            <label style={{ fontSize: "0.7rem", fontWeight: 500, color: "#64748b" }}>Oscurecer imagen ({Math.round((seccion.imagenFondoOverlay ?? 0.4) * 100)}%)</label>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={seccion.imagenFondoOverlay ?? 0.4}
              onChange={e => onUpdate(seccion.uid, { imagenFondoOverlay: parseFloat(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>
        </>
      )}

      {mediaAbierto && (
        <div style={{ marginTop: 8 }}>
          <MediaSelector
            value={seccion.imagenFondo}
            onChange={m => { if (!m) return; onUpdate(seccion.uid, { imagenFondo: m }); setMediaAbierto(false); }}
          />
        </div>
      )}
    </div>
  );
}
