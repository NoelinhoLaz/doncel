"use client";

import React from "react";
import { ChevronRight, GripVertical, X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, PersonaEquipo } from "../../types";
import MediaSelector from "./MediaSelector";

export default function EditorEquipo({
  seccion,
  onUpdate,
  mediaAbierto,
  setMediaAbierto,
  expandedPersonaIdx,
  setExpandedPersonaIdx,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  mediaAbierto: boolean | number | "new" | string;
  setMediaAbierto: (v: any) => void;
  expandedPersonaIdx: string | null;
  setExpandedPersonaIdx: (v: string | null) => void;
}) {
  const personas = seccion.personas ?? [];

  const updatePersona = (uid: string, patch: Partial<PersonaEquipo>) => {
    const next = personas.map(p => p.uid === uid ? { ...p, ...patch } : p);
    onUpdate(seccion.uid, { personas: next });
  };

  const añadirPersona = () => {
    const uid = `persona-${Date.now()}`;
    onUpdate(seccion.uid, { personas: [...personas, { uid }] });
    setExpandedPersonaIdx(uid);
  };

  const borrarPersona = (uid: string) => {
    onUpdate(seccion.uid, { personas: personas.filter(p => p.uid !== uid) });
    if (expandedPersonaIdx === uid) setExpandedPersonaIdx(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <input
          type="text"
          placeholder="Ej. Nuestro equipo"
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>

      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>
        Miembros del equipo
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {personas.map((p, idx) => {
          const isOpen = expandedPersonaIdx === p.uid;
          return (
            <div
              key={p.uid}
              draggable
              onDragStart={e => { e.dataTransfer.setData("text/plain", idx.toString()); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dragIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (isNaN(dragIdx) || dragIdx === idx) return;
                const next = [...personas];
                const [moved] = next.splice(dragIdx, 1);
                next.splice(idx, 0, moved);
                onUpdate(seccion.uid, { personas: next });
              }}
              style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", background: "#f8fafc" }}
            >
              <div style={{ display: "flex", alignItems: "center", background: "#ffffff" }}>
                <div style={{ cursor: "grab", padding: "10px 0 10px 12px", display: "flex", alignItems: "center", color: "#94a3b8" }}>
                  <GripVertical size={14} />
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedPersonaIdx(isOpen ? null : p.uid)}
                  style={{ flex: 1, padding: "10px 12px 10px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                    {p.nombre || "Sin nombre"}
                  </span>
                  <ChevronRight size={14} style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "#94a3b8" }} />
                </button>
                <button
                  type="button"
                  onClick={() => borrarPersona(p.uid)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "8px", color: "#ef4444", display: "flex", alignItems: "center" }}
                >
                  <X size={14} />
                </button>
              </div>

              {isOpen && (
                <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc" }}>
                  <div>
                    <label className={styles.editorFieldLabel}>Foto</label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", marginBottom: "8px" }}>
                      <div
                        style={{
                          position: "relative",
                          width: "56px",
                          height: "56px",
                          borderRadius: "50%",
                          backgroundImage: p.media?.url ? `url(${p.media.url})` : undefined,
                          backgroundColor: "#e2e8f0",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          border: "1px solid #cbd5e1",
                          cursor: "pointer",
                        }}
                        onClick={() => setMediaAbierto(mediaAbierto === `persona-${p.uid}-new` ? false : `persona-${p.uid}-new`)}
                      >
                        {p.media?.url && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); updatePersona(p.uid, { media: undefined }); setMediaAbierto(false); }}
                            style={{ position: "absolute", top: "-4px", right: "-4px", background: "#ef4444", color: "#ffffff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "8px", padding: 0 }}
                          >
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    </div>

                    {mediaAbierto === `persona-${p.uid}-new` && (
                      <div style={{ marginTop: "8px" }}>
                        <MediaSelector
                          value={p.media}
                          onChange={m => { if (!m) return; updatePersona(p.uid, { media: m }); setMediaAbierto(false); }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Nombre</label>
                    <input
                      type="text"
                      placeholder="Nombre del agente..."
                      value={p.nombre ?? ""}
                      onChange={e => updatePersona(p.uid, { nombre: e.target.value })}
                      className={styles.editorInput}
                      style={{ width: "100%", background: "#ffffff" }}
                    />
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Cargo</label>
                    <input
                      type="text"
                      placeholder="Ej. Agente de viajes"
                      value={p.cargo ?? ""}
                      onChange={e => updatePersona(p.uid, { cargo: e.target.value })}
                      className={styles.editorInput}
                      style={{ width: "100%", background: "#ffffff" }}
                    />
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Descripción</label>
                    <textarea
                      placeholder="Breve descripción o perfil..."
                      value={p.texto ?? ""}
                      onChange={e => updatePersona(p.uid, { texto: e.target.value })}
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

      <button
        type="button"
        onClick={añadirPersona}
        style={{ width: "100%", padding: "0.5rem", border: "1px dashed #cbd5e1", borderRadius: "0.375rem", background: "#ffffff", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", cursor: "pointer", textAlign: "center" }}
      >
        + Añadir persona
      </button>
    </div>
  );
}
