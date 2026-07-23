"use client";

import React from "react";
import type { Seccion } from "../../types";
import styles from "../../page.module.css";

const OPCIONES: { id: "minimo" | "medio" | "completo"; label: string }[] = [
  { id: "minimo", label: "Mínimo" },
  { id: "medio", label: "Medio" },
  { id: "completo", label: "Completo" },
];

export default function AltoSeccionEditor({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const actual = seccion.altoSeccion ?? "minimo";

  return (
    <div className={styles.editorSection}>
      <label className={styles.editorFieldLabel}>Alto de sección</label>
      <div style={{ display: "flex", gap: 6 }}>
        {OPCIONES.map(opt => (
          <button
            key={opt.id}
            type="button"
            className={`${styles.previewBtn} ${actual === opt.id ? styles.saveBtn : ""}`}
            style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: actual === opt.id ? "#1e293b" : "#ffffff", color: actual === opt.id ? "#ffffff" : "#475569" }}
            onClick={() => onUpdate(seccion.uid, { altoSeccion: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
