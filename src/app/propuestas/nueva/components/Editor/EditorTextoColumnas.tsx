"use client";

import React from "react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";

export default function EditorTextoColumnas({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const colCount = seccion.layout === "2-cols" ? 2 : seccion.layout === "4-cols" ? 4 : 3;
  const cols = Array.from({ length: colCount }).map((_, idx) => {
    return (seccion.columnas ?? [])[idx] || { titulo: `Columna ${idx + 1}`, texto: "" };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <input
          type="text"
          placeholder="Ej. Qué ofrecemos..."
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>
      {cols.map((col, idx) => (
        <div key={idx} className={styles.editorSection} style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
          <label className={styles.editorFieldLabel} style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
            <span>Columna {idx + 1}</span>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
            <input
              type="text"
              placeholder="Título de la columna"
              value={col.titulo ?? ""}
              onChange={e => {
                const nextCols = [...(seccion.columnas ?? [])];
                while (nextCols.length <= idx) nextCols.push({ titulo: "", texto: "" });
                nextCols[idx] = { ...nextCols[idx], titulo: e.target.value };
                onUpdate(seccion.uid, { columnas: nextCols });
              }}
              className={styles.editorInput}
              style={{ width: "100%", background: "#ffffff" }}
            />
            <textarea
              placeholder="Contenido (puedes usar .- para viñetas y ** para negrita)"
              value={col.texto ?? ""}
              onChange={e => {
                const nextCols = [...(seccion.columnas ?? [])];
                while (nextCols.length <= idx) nextCols.push({ titulo: "", texto: "" });
                nextCols[idx] = { ...nextCols[idx], texto: e.target.value };
                onUpdate(seccion.uid, { columnas: nextCols });
              }}
              className={styles.editorInput}
              style={{ width: "100%", minHeight: "80px", fontFamily: "inherit", resize: "vertical" }}
              rows={3}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
