"use client";

import React, { useEffect } from "react";
import { ChevronRight, GripVertical, X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import MediaSelectorModal from "./MediaSelectorModal";
import InlineRichInput from "./InlineRichInput";

export default function EditorTextoColumnas({
  seccion,
  onUpdate,
  mediaAbierto,
  setMediaAbierto,
  expandedColIdx,
  setExpandedColIdx,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  mediaAbierto: boolean | number | "new" | string;
  setMediaAbierto: (v: any) => void;
  expandedColIdx: string | null;
  setExpandedColIdx: (v: string | null) => void;
}) {
  const stripHtml = (s?: string) => (s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const youtubeId = (url: string): string | null => {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };
  const mediaThumbUrl = (m: { tipo: string; url: string }) => {
    if (m.tipo === "video") {
      const yid = youtubeId(m.url);
      return yid ? `https://img.youtube.com/vi/${yid}/mqdefault.jpg` : null;
    }
    return m.url;
  };

  const columnas = seccion.columnas ?? [];

  useEffect(() => {
    if (columnas.some(c => !c.uid)) {
      onUpdate(seccion.uid, { columnas: columnas.map((c, i) => c.uid ? c : { ...c, uid: `col-legacy-${Date.now()}-${i}` }) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion.uid]);

  const updateColumna = (uid: string, patch: Partial<any>) => {
    const next = columnas.map(c => c.uid === uid ? { ...c, ...patch } : c);
    onUpdate(seccion.uid, { columnas: next });
  };

  const addColumna = () => {
    const uid = `col-${Date.now()}`;
    onUpdate(seccion.uid, { columnas: [...columnas, { uid, titulo: "", texto: "" }] });
    setExpandedColIdx(uid);
  };

  const removeColumna = (uid: string) => {
    onUpdate(seccion.uid, { columnas: columnas.filter(c => c.uid !== uid) });
    if (expandedColIdx === uid) setExpandedColIdx(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <InlineRichInput
          placeholder="Ej. Qué ofrecemos..."
          value={seccion.titulo ?? ""}
          onChange={html => onUpdate(seccion.uid, { titulo: html })}
        />
      </div>

      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>
        Columnas
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {columnas.map((col, idx) => {
          const isOpen = expandedColIdx === col.uid;
          return (
            <div
              key={col.uid ?? idx}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData("text/plain", idx.toString());
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dragIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (isNaN(dragIdx) || dragIdx === idx) return;
                const newArray = [...columnas];
                const [movedItem] = newArray.splice(dragIdx, 1);
                newArray.splice(idx, 0, movedItem);
                onUpdate(seccion.uid, { columnas: newArray });
              }}
              style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", background: "#f8fafc" }}
            >
              <div style={{ display: "flex", alignItems: "center", background: "#ffffff" }}>
                <div style={{ cursor: "grab", padding: "10px 0 10px 12px", display: "flex", alignItems: "center", color: "#94a3b8" }}>
                  <GripVertical size={14} />
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedColIdx(isOpen ? null : col.uid)}
                  style={{ flex: 1, padding: "10px 12px 10px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                    Columna {idx + 1}: <span style={{ fontWeight: 400, color: "#64748b", marginLeft: "4px" }}>{stripHtml(col.titulo) || "Sin título"}</span>
                  </span>
                  <ChevronRight size={14} style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "#94a3b8" }} />
                </button>
                <button
                  type="button"
                  onClick={() => removeColumna(col.uid)}
                  title="Eliminar columna"
                  style={{ padding: "10px 12px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}
                >
                  <X size={14} />
                </button>
              </div>

              {isOpen && (
                <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc" }}>
                  <div>
                    <label className={styles.editorFieldLabel}>Imágenes</label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px", marginBottom: "8px" }}>
                      {(col.medias ?? []).map((m, imgIdx) => {
                        const thumbUrl = mediaThumbUrl(m);
                        const isSelecting = mediaAbierto === `col-${col.uid}-${imgIdx}`;
                        return (
                          <div
                            key={imgIdx}
                            style={{
                              position: "relative",
                              width: "50px",
                              height: "50px",
                              borderRadius: "4px",
                              backgroundImage: thumbUrl ? `url('${thumbUrl}')` : undefined,
                              backgroundColor: thumbUrl ? undefined : "#e2e8f0",
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              border: "1px solid #cbd5e1",
                              cursor: "pointer"
                            }}
                            onClick={() => setMediaAbierto(isSelecting ? false : `col-${col.uid}-${imgIdx}`)}
                          >
                            {m.tipo === "video" && (
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                                <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(15, 23, 42, 0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid #ffffff", marginLeft: "2px" }} />
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                const arr = [...(col.medias ?? [])];
                                arr.splice(imgIdx, 1);
                                updateColumna(col.uid, { medias: arr });
                                setMediaAbierto(false);
                              }}
                              style={{
                                position: "absolute",
                                top: "-4px",
                                right: "-4px",
                                background: "#ef4444",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "50%",
                                width: "14px",
                                height: "14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontSize: "8px",
                                padding: 0
                              }}
                            >
                              <X size={8} />
                            </button>
                          </div>
                        );
                      })}
                      {(col.medias ?? []).length < 5 && (
                        <button
                          type="button"
                          onClick={() => setMediaAbierto(mediaAbierto === `col-${col.uid}-new` ? false : `col-${col.uid}-new`)}
                          style={{ width: "50px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #cbd5e1", borderRadius: "4px", background: "#ffffff", cursor: "pointer" }}
                        >
                          <span style={{ fontSize: "1.2rem", color: "#64748b" }}>+</span>
                        </button>
                      )}
                    </div>

                    {mediaAbierto === `col-${col.uid}-new` && (
                      <MediaSelectorModal
                        value={undefined}
                        onChange={m => {
                          if (!m) return;
                          const arr = [...(col.medias ?? []), m];
                          updateColumna(col.uid, { medias: arr });
                          setMediaAbierto(false);
                        }}
                        onClose={() => setMediaAbierto(false)}
                      />
                    )}

                    {typeof mediaAbierto === "string" && mediaAbierto.startsWith(`col-${col.uid}-`) && !mediaAbierto.endsWith("-new") && (() => {
                      const parts = mediaAbierto.split("-");
                      const imgIdx = parseInt(parts[parts.length - 1] ?? "", 10);
                      if (isNaN(imgIdx)) return null;
                      return (
                        <MediaSelectorModal
                          value={col.medias?.[imgIdx]}
                          onChange={m => {
                            if (!m) return;
                            const arr = [...(col.medias ?? [])];
                            arr[imgIdx] = m;
                            updateColumna(col.uid, { medias: arr });
                            setMediaAbierto(false);
                          }}
                          onClose={() => setMediaAbierto(false)}
                        />
                      );
                    })()}
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Título</label>
                    <InlineRichInput
                      placeholder="Título de la columna..."
                      value={col.titulo ?? ""}
                      onChange={html => updateColumna(col.uid, { titulo: html })}
                    />
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Texto</label>
                    <InlineRichInput
                      placeholder="Contenido de la columna..."
                      value={col.texto ?? ""}
                      onChange={html => updateColumna(col.uid, { texto: html })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addColumna}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", border: "1px dashed #cbd5e1", borderRadius: "0.5rem", background: "#ffffff", cursor: "pointer", color: "#475569", fontSize: "0.82rem", fontWeight: 600 }}
      >
        + Añadir columna
      </button>
    </div>
  );
}
