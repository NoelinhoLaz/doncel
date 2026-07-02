"use client";

import React from "react";
import { ChevronRight, GripVertical, X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import MediaSelector from "./MediaSelector";

export default function EditorItinerario({
  seccion,
  onUpdate,
  mediaAbierto,
  setMediaAbierto,
  expandedDayIdx,
  setExpandedDayIdx,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  mediaAbierto: boolean | number | "new" | string;
  setMediaAbierto: (v: any) => void;
  expandedDayIdx: number | null;
  setExpandedDayIdx: (v: number | null) => void;
}) {
  const updateDia = (dayNum: number, patch: Partial<any>) => {
    const currentDias = [...(seccion.dias ?? [])];
    const index = currentDias.findIndex(d => d.dia === dayNum);
    if (index >= 0) {
      currentDias[index] = { ...currentDias[index], ...patch };
    } else {
      currentDias.push({ dia: dayNum, ...patch });
    }
    onUpdate(seccion.uid, { dias: currentDias });
  };

  let daysCount = 5;
  if (seccion.fechaDesde && seccion.fechaHasta) {
    const start = new Date(seccion.fechaDesde);
    const end = new Date(seccion.fechaHasta);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      daysCount = diffDays > 0 ? diffDays : 1;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título del itinerario</label>
        <input
          type="text"
          placeholder="Ej. Plan de ruta y actividades..."
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>
      <div style={{ display: "flex", gap: "12px", width: "100%" }}>
        <div className={styles.editorSection} style={{ flex: 1 }}>
          <label className={styles.editorFieldLabel}>Fecha desde</label>
          <input
            type="date"
            value={seccion.fechaDesde ?? ""}
            onChange={e => onUpdate(seccion.uid, { fechaDesde: e.target.value })}
            className={styles.editorInput}
            style={{ width: "100%" }}
          />
        </div>
        <div className={styles.editorSection} style={{ flex: 1 }}>
          <label className={styles.editorFieldLabel}>Fecha hasta</label>
          <input
            type="date"
            value={seccion.fechaHasta ?? ""}
            onChange={e => onUpdate(seccion.uid, { fechaHasta: e.target.value })}
            className={styles.editorInput}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {daysCount > 0 && (() => {
        const fullDaysArray = Array.from({ length: daysCount }).map((_, idx) => {
          const dayNum = idx + 1;
          return (seccion.dias ?? []).find(d => d.dia === dayNum) || { dia: dayNum };
        });
        return (
          <>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>
              Días del itinerario
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {fullDaysArray.map((diaData, idx) => {
                const dayNum = diaData.dia;
                const isOpen = expandedDayIdx === dayNum;
                return (
                  <div
                    key={dayNum}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("text/plain", idx.toString());
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={e => {
                      e.preventDefault();
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      const dragIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                      if (isNaN(dragIdx) || dragIdx === idx) return;
                      const newArray = [...fullDaysArray];
                      const [movedItem] = newArray.splice(dragIdx, 1);
                      newArray.splice(idx, 0, movedItem);
                      const updated = newArray.map((item, i) => ({ ...item, dia: i + 1 }));
                      onUpdate(seccion.uid, { dias: updated });
                    }}
                    style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", background: "#f8fafc" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", background: "#ffffff" }}>
                      <div style={{ cursor: "grab", padding: "10px 0 10px 12px", display: "flex", alignItems: "center", color: "#94a3b8" }}>
                        <GripVertical size={14} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedDayIdx(isOpen ? null : dayNum)}
                        style={{ flex: 1, padding: "10px 12px 10px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                      >
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                          Día {dayNum}: <span style={{ fontWeight: 400, color: "#64748b", marginLeft: "4px" }}>{diaData.titulo || "Sin título"}</span>
                        </span>
                        <ChevronRight size={14} style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "#94a3b8" }} />
                      </button>
                    </div>

                    {isOpen && (
                      <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc" }}>
                        <div>
                          <label className={styles.editorFieldLabel}>Imágenes del día</label>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px", marginBottom: "8px" }}>
                            {(diaData.medias ?? []).map((m, imgIdx) => {
                              const thumbBg = `url(${m.url})`;
                              const isSelecting = mediaAbierto === `day-${dayNum}-${imgIdx}`;
                              return (
                                <div
                                  key={imgIdx}
                                  style={{
                                    position: "relative",
                                    width: "50px",
                                    height: "50px",
                                    borderRadius: "4px",
                                    backgroundImage: thumbBg,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    border: "1px solid #cbd5e1",
                                    cursor: "pointer"
                                  }}
                                  onClick={() => setMediaAbierto(isSelecting ? false : `day-${dayNum}-${imgIdx}`)}
                                >
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      const arr = [...(diaData.medias ?? [])];
                                      arr.splice(imgIdx, 1);
                                      updateDia(dayNum, { medias: arr });
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
                            {(diaData.medias ?? []).length < 5 && (
                              <button
                                type="button"
                                onClick={() => setMediaAbierto(mediaAbierto === `day-${dayNum}-new` ? false : `day-${dayNum}-new`)}
                                style={{ width: "50px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #cbd5e1", borderRadius: "4px", background: "#ffffff", cursor: "pointer" }}
                              >
                                <span style={{ fontSize: "1.2rem", color: "#64748b" }}>+</span>
                              </button>
                            )}
                          </div>

                          {mediaAbierto === `day-${dayNum}-new` && (
                            <div style={{ marginTop: "8px" }}>
                              <MediaSelector
                                value={undefined}
                                onChange={m => {
                                  if (!m) return;
                                  const arr = [...(diaData.medias ?? []), m];
                                  updateDia(dayNum, { medias: arr });
                                  setMediaAbierto(false);
                                }}
                              />
                            </div>
                          )}

                          {typeof mediaAbierto === "string" && mediaAbierto.startsWith(`day-${dayNum}-`) && !mediaAbierto.endsWith("-new") && (() => {
                            const parts = mediaAbierto.split("-");
                            const imgIdx = parseInt(parts[parts.length - 1] ?? "", 10);
                            if (isNaN(imgIdx)) return null;
                            return (
                              <div style={{ marginTop: "8px" }}>
                                <MediaSelector
                                  value={diaData.medias?.[imgIdx]}
                                  onChange={m => {
                                    if (!m) return;
                                    const arr = [...(diaData.medias ?? [])];
                                    arr[imgIdx] = m;
                                    updateDia(dayNum, { medias: arr });
                                    setMediaAbierto(false);
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>

                        <div>
                          <label className={styles.editorFieldLabel}>Título</label>
                          <input
                            type="text"
                            placeholder="Título del día..."
                            value={diaData.titulo ?? ""}
                            onChange={e => updateDia(dayNum, { titulo: e.target.value })}
                            className={styles.editorInput}
                            style={{ width: "100%", background: "#ffffff" }}
                          />
                        </div>

                        <div>
                          <label className={styles.editorFieldLabel}>Descripción</label>
                          <textarea
                            placeholder="Descripción del día..."
                            value={diaData.desc ?? ""}
                            onChange={e => updateDia(dayNum, { desc: e.target.value })}
                            className={styles.editorInput}
                            rows={3}
                            style={{ width: "100%", background: "#ffffff", resize: "vertical" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}
