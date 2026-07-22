"use client";

import React, { useEffect, useState } from "react";
import { ChevronRight, GripVertical, X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, CardItem } from "../../types";
import MediaSelector from "./MediaSelector";
import { getPaginasWeb } from "@/actions/paginaWeb";

export default function EditorCards({
  seccion,
  onUpdate,
  mediaAbierto,
  setMediaAbierto,
  expandedCardIdx,
  setExpandedCardIdx,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  mediaAbierto: boolean | number | "new" | string;
  setMediaAbierto: (v: any) => void;
  expandedCardIdx: string | null;
  setExpandedCardIdx: (v: string | null) => void;
}) {
  const cards = seccion.cards ?? [];
  const [paginas, setPaginas] = useState<{ id: string; titulo: string; slug: string }[]>([]);

  useEffect(() => {
    getPaginasWeb().then(setPaginas).catch(() => setPaginas([]));
  }, []);

  const updateCard = (uid: string, patch: Partial<CardItem>) => {
    const next = cards.map(c => c.uid === uid ? { ...c, ...patch } : c);
    onUpdate(seccion.uid, { cards: next });
  };

  const añadirCard = () => {
    const uid = `card-${Date.now()}`;
    onUpdate(seccion.uid, { cards: [...cards, { uid }] });
    setExpandedCardIdx(uid);
  };

  const borrarCard = (uid: string) => {
    onUpdate(seccion.uid, { cards: cards.filter(c => c.uid !== uid) });
    if (expandedCardIdx === uid) setExpandedCardIdx(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <input
          type="text"
          placeholder="Ej. Por qué elegirnos"
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>

      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>
        Cards
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {cards.map((c, idx) => {
          const isOpen = expandedCardIdx === c.uid;
          return (
            <div
              key={c.uid}
              draggable
              onDragStart={e => { e.dataTransfer.setData("text/plain", idx.toString()); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dragIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (isNaN(dragIdx) || dragIdx === idx) return;
                const next = [...cards];
                const [moved] = next.splice(dragIdx, 1);
                next.splice(idx, 0, moved);
                onUpdate(seccion.uid, { cards: next });
              }}
              style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", background: "#f8fafc" }}
            >
              <div style={{ display: "flex", alignItems: "center", background: "#ffffff" }}>
                <div style={{ cursor: "grab", padding: "10px 0 10px 12px", display: "flex", alignItems: "center", color: "#94a3b8" }}>
                  <GripVertical size={14} />
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedCardIdx(isOpen ? null : c.uid)}
                  style={{ flex: 1, padding: "10px 12px 10px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                    {c.titulo || "Sin título"}
                  </span>
                  <ChevronRight size={14} style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "#94a3b8" }} />
                </button>
                <button
                  type="button"
                  onClick={() => borrarCard(c.uid)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "8px", color: "#ef4444", display: "flex", alignItems: "center" }}
                >
                  <X size={14} />
                </button>
              </div>

              {isOpen && (
                <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc" }}>
                  <div>
                    <label className={styles.editorFieldLabel}>Imagen</label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", marginBottom: "8px" }}>
                      <div
                        style={{
                          position: "relative",
                          width: "88px",
                          height: "64px",
                          borderRadius: "0.5rem",
                          backgroundImage: c.media?.url ? `url(${c.media.url})` : undefined,
                          backgroundColor: "#e2e8f0",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          border: "1px solid #cbd5e1",
                          cursor: "pointer",
                        }}
                        onClick={() => setMediaAbierto(mediaAbierto === `card-${c.uid}-new` ? false : `card-${c.uid}-new`)}
                      >
                        {c.media?.url && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); updateCard(c.uid, { media: undefined }); setMediaAbierto(false); }}
                            style={{ position: "absolute", top: "-4px", right: "-4px", background: "#ef4444", color: "#ffffff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "8px", padding: 0 }}
                          >
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    </div>

                    {mediaAbierto === `card-${c.uid}-new` && (
                      <div style={{ marginTop: "8px" }}>
                        <MediaSelector
                          value={c.media}
                          onChange={m => { if (!m) return; updateCard(c.uid, { media: m }); setMediaAbierto(false); }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Título</label>
                    <input
                      type="text"
                      placeholder="Título de la card..."
                      value={c.titulo ?? ""}
                      onChange={e => updateCard(c.uid, { titulo: e.target.value })}
                      className={styles.editorInput}
                      style={{ width: "100%", background: "#ffffff" }}
                    />
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Subtítulo</label>
                    <textarea
                      placeholder="Breve descripción..."
                      value={c.subtitulo ?? ""}
                      onChange={e => updateCard(c.uid, { subtitulo: e.target.value })}
                      className={styles.editorInput}
                      rows={3}
                      style={{ width: "100%", background: "#ffffff", resize: "vertical" }}
                    />
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Enlace (opcional)</label>
                    <div style={{ display: "flex", gap: 6, marginBottom: "6px" }}>
                      {(["externo", "pagina"] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => updateCard(c.uid, { enlaceTipo: c.enlaceTipo === t ? undefined : t })}
                          style={{
                            flex: 1, padding: "0.35rem 0.5rem", borderRadius: "0.4rem", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer",
                            border: c.enlaceTipo === t ? "2px solid #1e293b" : "1.5px solid #e2e8f0",
                            background: c.enlaceTipo === t ? "#1e293b" : "#ffffff",
                            color: c.enlaceTipo === t ? "#ffffff" : "#64748b",
                          }}
                        >
                          {t === "externo" ? "URL externa" : "Página web"}
                        </button>
                      ))}
                    </div>
                    {c.enlaceTipo === "externo" && (
                      <input
                        type="text"
                        placeholder="https://..."
                        value={c.enlaceHref ?? ""}
                        onChange={e => updateCard(c.uid, { enlaceHref: e.target.value })}
                        className={styles.editorInput}
                        style={{ width: "100%", background: "#ffffff" }}
                      />
                    )}
                    {c.enlaceTipo === "pagina" && (
                      <select
                        value={c.enlacePaginaSlug ?? ""}
                        onChange={e => updateCard(c.uid, { enlacePaginaSlug: e.target.value })}
                        className={styles.editorInput}
                        style={{ width: "100%", background: "#ffffff" }}
                      >
                        <option value="">— Selecciona página —</option>
                        {paginas.map(p => (
                          <option key={p.id} value={p.slug}>{p.titulo}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={añadirCard}
        style={{ width: "100%", padding: "0.5rem", border: "1px dashed #cbd5e1", borderRadius: "0.375rem", background: "#ffffff", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", cursor: "pointer", textAlign: "center" }}
      >
        + Añadir card
      </button>
    </div>
  );
}
