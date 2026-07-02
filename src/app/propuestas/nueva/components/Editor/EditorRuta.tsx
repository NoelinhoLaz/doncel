"use client";

import React from "react";
import { ChevronRight, Trash2, Footprints, Bus } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, UbicacionMapa, RutaItem, SegmentoRuta } from "../../types";
import { UbicacionEditorRuta } from "./UbicacionEditor";
import { calcularSegmento } from "../../utils/routes-api";

export default function EditorRuta({
  seccion,
  onUpdate,
  rutaAbierta,
  setRutaAbierta,
  ubRutaAbierta,
  setUbRutaAbierta,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  rutaAbierta: string | null;
  setRutaAbierta: (v: string | null) => void;
  ubRutaAbierta: string | null;
  setUbRutaAbierta: (v: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la ruta</label>
        <input
          type="text"
          placeholder="Ej. Ruta por los Alpes..."
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>
      <>
        {(seccion.rutas ?? []).map((rutaItem, rIdx) => {
          const isRutaOpen = rutaAbierta === rutaItem.uid;
          return (
            <div key={rutaItem.uid} className={styles.mapaEditorBloque}>
              <div
                style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                onClick={() => setRutaAbierta(isRutaOpen ? null : rutaItem.uid)}
              >
                <ChevronRight size={14} style={{ color: "#94a3b8", transform: isRutaOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder={`Ruta ${rIdx + 1}`}
                  value={rutaItem.titulo ?? ""}
                  onChange={e => {
                    e.stopPropagation();
                    const updatedRutas = (seccion.rutas ?? []).map(r =>
                      r.uid === rutaItem.uid ? { ...r, titulo: e.target.value } : r
                    );
                    onUpdate(seccion.uid, { rutas: updatedRutas });
                  }}
                  onClick={e => e.stopPropagation()}
                  className={styles.editorInput}
                  style={{ flex: 1, background: "#ffffff" }}
                />
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    const updatedRutas = (seccion.rutas ?? []).filter(r => r.uid !== rutaItem.uid);
                    onUpdate(seccion.uid, { rutas: updatedRutas });
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px", flexShrink: 0 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {isRutaOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingLeft: "1rem" }}>
                  {(rutaItem.ubicaciones ?? []).map((ub, uIdx) => {
                    const isUbOpen = ubRutaAbierta === ub.uid;
                    const seg = (rutaItem.segmentos ?? [])[uIdx - 1];
                    return (
                      <React.Fragment key={ub.uid}>
                        {uIdx > 0 && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0 4px 0" }}>
                            <button
                              type="button"
                              onClick={async () => {
                                const newModo: "foot-walking" | "driving-car" = "foot-walking";
                                const segs = [...(rutaItem.segmentos ?? [])];
                                segs[uIdx - 1] = { ...segs[uIdx - 1], uid: segs[uIdx - 1]?.uid ?? crypto.randomUUID(), modo: newModo, polyline: undefined };
                                const updatedRutas = (seccion.rutas ?? []).map(r => r.uid === rutaItem.uid ? { ...r, segmentos: segs } : r);
                                onUpdate(seccion.uid, { rutas: updatedRutas });
                                const prev = (rutaItem.ubicaciones ?? [])[uIdx - 1];
                                const curr = ub;
                                await calcularSegmento(seccion.uid, rutaItem.uid, uIdx - 1, newModo, prev, curr, { ...seccion, rutas: updatedRutas }, onUpdate);
                              }}
                              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "0.4rem", border: `1px solid ${seg?.modo === "foot-walking" ? "#22c55e" : "#e2e8f0"}`, background: seg?.modo === "foot-walking" ? "#f0fdf4" : "#ffffff", cursor: "pointer", fontSize: "0.72rem", color: seg?.modo === "foot-walking" ? "#15803d" : "#94a3b8" }}
                              title="A pie"
                            >
                              <Footprints size={12} />
                              <span>A pie</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const newModo: "foot-walking" | "driving-car" = "driving-car";
                                const segs = [...(rutaItem.segmentos ?? [])];
                                segs[uIdx - 1] = { ...segs[uIdx - 1], uid: segs[uIdx - 1]?.uid ?? crypto.randomUUID(), modo: newModo, polyline: undefined };
                                const updatedRutas = (seccion.rutas ?? []).map(r => r.uid === rutaItem.uid ? { ...r, segmentos: segs } : r);
                                onUpdate(seccion.uid, { rutas: updatedRutas });
                                const prev = (rutaItem.ubicaciones ?? [])[uIdx - 1];
                                const curr = ub;
                                await calcularSegmento(seccion.uid, rutaItem.uid, uIdx - 1, newModo, prev, curr, { ...seccion, rutas: updatedRutas }, onUpdate);
                              }}
                              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "0.4rem", border: `1px solid ${(!seg?.modo || seg?.modo === "driving-car") ? "#3b82f6" : "#e2e8f0"}`, background: (!seg?.modo || seg?.modo === "driving-car") ? "#eff6ff" : "#ffffff", cursor: "pointer", fontSize: "0.72rem", color: (!seg?.modo || seg?.modo === "driving-car") ? "#1d4ed8" : "#94a3b8" }}
                              title="En bus"
                            >
                              <Bus size={12} />
                              <span>Bus</span>
                            </button>
                            {!seg?.polyline && seg?.modo && (
                              <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Calculando…</span>
                            )}
                          </div>
                        )}
                        <div className={styles.ubicacionCard}>
                          <div
                            style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                            onClick={() => setUbRutaAbierta(isUbOpen ? null : ub.uid)}
                          >
                            <ChevronRight size={12} style={{ color: "#94a3b8", transform: isUbOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 600, color: ub.nombre ? "#1e293b" : "#94a3b8" }}>
                              {ub.nombre ?? `Destino ${uIdx + 1}`}
                            </span>
                            {ub.direccion && !isUbOpen && (
                              <span style={{ fontSize: "0.65rem", color: "#94a3b8", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ub.direccion}</span>
                            )}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                const updatedRutas = (seccion.rutas ?? []).map(r => {
                                  if (r.uid !== rutaItem.uid) return r;
                                  const newUbs = (r.ubicaciones ?? []).filter(u => u.uid !== ub.uid);
                                  const newSegs = (r.segmentos ?? []).filter((_, i) => i !== uIdx && i !== uIdx - 1);
                                  return { ...r, ubicaciones: newUbs, segmentos: newSegs };
                                });
                                onUpdate(seccion.uid, { rutas: updatedRutas });
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "2px", flexShrink: 0 }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                          {isUbOpen && (
                            <UbicacionEditorRuta
                              ub={ub}
                              rutaUid={rutaItem.uid}
                              seccion={seccion}
                              onUpdate={onUpdate}
                            />
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  <button
                    type="button"
                    onClick={async () => {
                      const newUb: UbicacionMapa = { uid: crypto.randomUUID() };
                      const existingUbs = rutaItem.ubicaciones ?? [];
                      const updatedRutas = (seccion.rutas ?? []).map(r => {
                        if (r.uid !== rutaItem.uid) return r;
                        const newSegs: SegmentoRuta[] = [...(r.segmentos ?? [])];
                        if (existingUbs.length > 0) {
                          newSegs[existingUbs.length - 1] = { uid: crypto.randomUUID(), modo: "driving-car" };
                        }
                        return { ...r, ubicaciones: [...existingUbs, newUb], segmentos: newSegs };
                      });
                      onUpdate(seccion.uid, { rutas: updatedRutas });
                      setUbRutaAbierta(newUb.uid);
                    }}
                    className={styles.previewBtn}
                    style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: "0.4rem" }}
                  >
                    + Añadir destino
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const newRuta: RutaItem = { uid: crypto.randomUUID(), ubicaciones: [], segmentos: [] };
            onUpdate(seccion.uid, { rutas: [...(seccion.rutas ?? []), newRuta] });
            setRutaAbierta(newRuta.uid);
          }}
          className={styles.previewBtn}
          style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "0.4rem" }}
        >
          + Añadir ruta
        </button>
      </>
    </div>
  );
}
