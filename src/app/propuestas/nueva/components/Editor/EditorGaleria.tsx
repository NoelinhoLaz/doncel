"use client";

import React from "react";
import { GripVertical, X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import MediaSelector from "./MediaSelector";

export default function EditorGaleria({
  seccion,
  onUpdate,
  mediaAbierto,
  setMediaAbierto,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  mediaAbierto: boolean | number | "new" | string;
  setMediaAbierto: (v: any) => void;
}) {
  const galeria = seccion.galeria ?? [];

  const añadirFoto = () => {
    const uid = `foto-${Date.now()}`;
    onUpdate(seccion.uid, { galeria: [...galeria, { uid }] });
    setMediaAbierto(`foto-${uid}-new`);
  };

  const borrarFoto = (uid: string) => {
    onUpdate(seccion.uid, { galeria: galeria.filter(g => g.uid !== uid) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <input
          type="text"
          placeholder="Ej. Galería de fotos"
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>

      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>
        Fotografías
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
        {galeria.map((g, idx) => (
          <div
            key={g.uid}
            draggable
            onDragStart={e => { e.dataTransfer.setData("text/plain", idx.toString()); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const dragIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
              if (isNaN(dragIdx) || dragIdx === idx) return;
              const next = [...galeria];
              const [moved] = next.splice(dragIdx, 1);
              next.splice(idx, 0, moved);
              onUpdate(seccion.uid, { galeria: next });
            }}
            style={{ position: "relative" }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: "0.5rem",
                backgroundImage: g.media?.url ? `url(${g.media.url})` : undefined,
                backgroundColor: "#e2e8f0",
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
              }}
              onClick={() => setMediaAbierto(mediaAbierto === `foto-${g.uid}-new` ? false : `foto-${g.uid}-new`)}
            />
            <div style={{ position: "absolute", top: "4px", left: "4px", background: "rgba(0,0,0,0.4)", borderRadius: "0.3rem", padding: "2px", display: "flex", alignItems: "center", color: "#ffffff", cursor: "grab" }}>
              <GripVertical size={12} />
            </div>
            <button
              type="button"
              onClick={() => borrarFoto(g.uid)}
              style={{ position: "absolute", top: "4px", right: "4px", background: "#ef4444", color: "#ffffff", border: "none", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
            >
              <X size={11} />
            </button>

            {mediaAbierto === `foto-${g.uid}-new` && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 10, width: "260px" }}>
                <MediaSelector
                  value={g.media}
                  onChange={m => {
                    if (!m) return;
                    const next = galeria.map(item => item.uid === g.uid ? { ...item, media: m } : item);
                    onUpdate(seccion.uid, { galeria: next });
                    setMediaAbierto(false);
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={añadirFoto}
        style={{ width: "100%", padding: "0.5rem", border: "1px dashed #cbd5e1", borderRadius: "0.375rem", background: "#ffffff", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", cursor: "pointer", textAlign: "center" }}
      >
        + Añadir fotografía
      </button>
    </div>
  );
}
