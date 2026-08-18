"use client";

import React, { useState } from "react";
import type { Seccion } from "../../types";
import styles from "../../page.module.css";
import { Image as ImageIcon } from "lucide-react";
import MediaSelectorModal from "./MediaSelectorModal";

const ALTO_OPCIONES: { id: "minimo" | "medio" | "completo"; label: string }[] = [
  { id: "minimo", label: "S" },
  { id: "medio", label: "M" },
  { id: "completo", label: "L" },
];

const ANCHO_OPCIONES: { id: "900px" | "1200px" | "completo"; label: string }[] = [
  { id: "900px", label: "S" },
  { id: "1200px", label: "M" },
  { id: "completo", label: "L" },
];

function SizeButtons({
  opciones,
  actual,
  onSelect,
}: {
  opciones: { id: string; label: string }[];
  actual: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {opciones.map(opt => (
        <button
          key={opt.id}
          type="button"
          title={opt.id}
          className={`${styles.previewBtn} ${actual === opt.id ? styles.saveBtn : ""}`}
          style={{ width: 28, height: 28, padding: 0, fontSize: "0.72rem", fontWeight: 700, borderRadius: "0.4rem", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, background: actual === opt.id ? "#1e293b" : "#ffffff", color: actual === opt.id ? "#ffffff" : "#475569" }}
          onClick={() => onSelect(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SeccionDisenioRow({
  seccion,
  onUpdate,
  anchoDefault = "completo",
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  anchoDefault?: "900px" | "1200px" | "completo";
}) {
  const [mediaAbierto, setMediaAbierto] = useState(false);
  const alto = seccion.altoSeccion ?? "minimo";
  const ancho = seccion.anchoMax ?? anchoDefault;
  const tieneImagenFondo = !!seccion.imagenFondo?.url;

  return (
    <div className={styles.editorSection}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className={styles.editorFieldLabel}>Alto</label>
          <SizeButtons opciones={ALTO_OPCIONES} actual={alto} onSelect={id => onUpdate(seccion.uid, { altoSeccion: id as Seccion["altoSeccion"] })} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className={styles.editorFieldLabel}>Ancho</label>
          <SizeButtons opciones={ANCHO_OPCIONES} actual={ancho} onSelect={id => onUpdate(seccion.uid, { anchoMax: id })} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className={styles.editorFieldLabel}>Fondo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label
              className={styles.colorPickerBtn}
              style={{ background: seccion.colorFondo ?? "#ffffff", width: 28, height: 28, borderRadius: "0.4rem" }}
              title="Color de fondo"
            >
              <input
                type="color"
                value={seccion.colorFondo ?? "#ffffff"}
                onChange={e => onUpdate(seccion.uid, { colorFondo: e.target.value, imagenFondo: undefined })}
              />
            </label>
            <button
              type="button"
              onClick={() => setMediaAbierto(v => !v)}
              title="Imagen de fondo"
              style={{
                width: 28, height: 28, borderRadius: "0.4rem", padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: tieneImagenFondo ? "2px solid #1e293b" : "1.5px solid #e2e8f0",
                background: tieneImagenFondo ? `url('${seccion.imagenFondo!.url}')` : "#ffffff",
                backgroundSize: "cover", backgroundPosition: "center",
                color: tieneImagenFondo ? "#ffffff" : "#94a3b8",
              }}
            >
              {!tieneImagenFondo && <ImageIcon size={13} />}
            </button>
            {tieneImagenFondo && (
              <button
                type="button"
                onClick={() => onUpdate(seccion.uid, { imagenFondo: undefined })}
                style={{ fontSize: "0.7rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>

      {tieneImagenFondo && (
        <div style={{ marginTop: 8 }}>
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
      )}

      {mediaAbierto && (
        <MediaSelectorModal
          value={seccion.imagenFondo}
          onChange={m => { if (!m) return; onUpdate(seccion.uid, { imagenFondo: m }); setMediaAbierto(false); }}
          onClose={() => setMediaAbierto(false)}
        />
      )}
    </div>
  );
}
