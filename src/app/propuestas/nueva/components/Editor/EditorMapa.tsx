"use client";

import React from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, UbicacionMapa, MapaItem } from "../../types";
import { UbicacionEditor } from "./UbicacionEditor";

export default function EditorMapa({
  seccion,
  onUpdate,
  mapaAbierto,
  setMapaAbierto,
  ubAbierta,
  setUbAbierta,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  mapaAbierto: string | null;
  setMapaAbierto: (v: string | null) => void;
  ubAbierta: string | null;
  setUbAbierta: (v: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título del mapa</label>
        <input
          type="text"
          placeholder="Ej. Mapa de destinos..."
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>
      <>
        {(seccion.mapas ?? []).map((mapaItem, mIdx) => {
              const isMapaOpen = mapaAbierto === mapaItem.uid;
              return (
                <div key={mapaItem.uid} className={styles.mapaEditorBloque}>
                  {/* Cabecera del mapa — colapsable */}
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                    onClick={() => setMapaAbierto(isMapaOpen ? null : mapaItem.uid)}
                  >
                    <ChevronRight size={14} style={{ color: "#94a3b8", transform: isMapaOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder={`Mapa ${mIdx + 1}`}
                      value={mapaItem.titulo ?? ""}
                      onChange={e => {
                        e.stopPropagation();
                        const updatedMapas = (seccion.mapas ?? []).map(m =>
                          m.uid === mapaItem.uid ? { ...m, titulo: e.target.value } : m
                        );
                        onUpdate(seccion.uid, { mapas: updatedMapas });
                      }}
                      onClick={e => e.stopPropagation()}
                      className={styles.editorInput}
                      style={{ flex: 1, background: "#ffffff" }}
                    />
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        const updatedMapas = (seccion.mapas ?? []).filter(m => m.uid !== mapaItem.uid);
                        onUpdate(seccion.uid, { mapas: updatedMapas });
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px", flexShrink: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Cuerpo colapsable del mapa */}
                  {isMapaOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingLeft: "1rem" }}>
                      {(mapaItem.ubicaciones ?? []).map((ub, uIdx) => {
                        const isUbOpen = ubAbierta === ub.uid;
                        return (
                          <div key={ub.uid} className={styles.ubicacionCard}>
                            {/* Cabecera ubicación — colapsable */}
                            <div
                              style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                              onClick={() => setUbAbierta(isUbOpen ? null : ub.uid)}
                            >
                              <ChevronRight size={12} style={{ color: "#94a3b8", transform: isUbOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 600, color: ub.nombre ? "#1e293b" : "#94a3b8" }}>
                                {ub.nombre ?? `Ubicación ${uIdx + 1}`}
                              </span>
                              {ub.direccion && !isUbOpen && (
                                <span style={{ fontSize: "0.65rem", color: "#94a3b8", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ub.direccion}</span>
                              )}
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  const updatedMapas = (seccion.mapas ?? []).map(m => {
                                    if (m.uid !== mapaItem.uid) return m;
                                    return { ...m, ubicaciones: (m.ubicaciones ?? []).filter(u => u.uid !== ub.uid) };
                                  });
                                  onUpdate(seccion.uid, { mapas: updatedMapas });
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "2px", flexShrink: 0 }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>

                            {/* Cuerpo colapsable de la ubicación */}
                            {isUbOpen && (
                              <UbicacionEditor
                                ub={ub}
                                mapaUid={mapaItem.uid}
                                seccion={seccion}
                                onUpdate={onUpdate}
                              />
                            )}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          const newUb: UbicacionMapa = { uid: crypto.randomUUID() };
                          const updatedMapas = (seccion.mapas ?? []).map(m => {
                            if (m.uid !== mapaItem.uid) return m;
                            return { ...m, ubicaciones: [...(m.ubicaciones ?? []), newUb] };
                          });
                          onUpdate(seccion.uid, { mapas: updatedMapas });
                          setUbAbierta(newUb.uid);
                        }}
                        className={styles.previewBtn}
                        style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: "0.4rem" }}
                      >
                        + Añadir ubicación
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const newMapa: MapaItem = { uid: crypto.randomUUID(), ubicaciones: [] };
                onUpdate(seccion.uid, { mapas: [...(seccion.mapas ?? []), newMapa] });
                setMapaAbierto(newMapa.uid);
              }}
              className={styles.previewBtn}
              style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "0.4rem" }}
            >
              + Añadir mapa
            </button>
      </>
    </div>
  );
}
