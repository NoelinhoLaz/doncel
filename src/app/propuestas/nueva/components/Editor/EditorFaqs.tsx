"use client";

import React, { useEffect } from "react";
import { ChevronRight, GripVertical, X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import InlineRichInput from "./InlineRichInput";

export default function EditorFaqs({
  seccion,
  onUpdate,
  expandedFaqIdx,
  setExpandedFaqIdx,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  expandedFaqIdx: string | null;
  setExpandedFaqIdx: (v: string | null) => void;
}) {
  const stripHtml = (s?: string) => (s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const faqs = seccion.faqs ?? [];

  useEffect(() => {
    if (faqs.some(f => !f.uid)) {
      onUpdate(seccion.uid, { faqs: faqs.map((f, i) => f.uid ? f : { ...f, uid: `faq-legacy-${Date.now()}-${i}` }) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion.uid]);

  const updateFaq = (uid: string, patch: Partial<any>) => {
    const next = faqs.map(f => f.uid === uid ? { ...f, ...patch } : f);
    onUpdate(seccion.uid, { faqs: next });
  };

  const addFaq = () => {
    const uid = `faq-${Date.now()}`;
    onUpdate(seccion.uid, { faqs: [...faqs, { uid, pregunta: "", respuesta: "" }] });
    setExpandedFaqIdx(uid);
  };

  const removeFaq = (uid: string) => {
    onUpdate(seccion.uid, { faqs: faqs.filter(f => f.uid !== uid) });
    if (expandedFaqIdx === uid) setExpandedFaqIdx(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <InlineRichInput
          placeholder="Ej. Preguntas frecuentes..."
          value={seccion.titulo ?? ""}
          onChange={html => onUpdate(seccion.uid, { titulo: html })}
        />
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Subtítulo de la sección</label>
        <InlineRichInput
          placeholder="Ej. Resolvemos tus dudas..."
          value={seccion.subtitulo ?? ""}
          onChange={html => onUpdate(seccion.uid, { subtitulo: html })}
        />
      </div>

      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>
        Preguntas
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {faqs.map((faq, idx) => {
          const isOpen = expandedFaqIdx === faq.uid;
          return (
            <div
              key={faq.uid ?? idx}
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
                const newArray = [...faqs];
                const [movedItem] = newArray.splice(dragIdx, 1);
                newArray.splice(idx, 0, movedItem);
                onUpdate(seccion.uid, { faqs: newArray });
              }}
              style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", background: "#f8fafc" }}
            >
              <div style={{ display: "flex", alignItems: "center", background: "#ffffff" }}>
                <div style={{ cursor: "grab", padding: "10px 0 10px 12px", display: "flex", alignItems: "center", color: "#94a3b8" }}>
                  <GripVertical size={14} />
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedFaqIdx(isOpen ? null : faq.uid)}
                  style={{ flex: 1, padding: "10px 12px 10px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                    Pregunta {idx + 1}: <span style={{ fontWeight: 400, color: "#64748b", marginLeft: "4px" }}>{stripHtml(faq.pregunta) || "Sin pregunta"}</span>
                  </span>
                  <ChevronRight size={14} style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "#94a3b8" }} />
                </button>
                <button
                  type="button"
                  onClick={() => removeFaq(faq.uid)}
                  title="Eliminar pregunta"
                  style={{ padding: "10px 12px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}
                >
                  <X size={14} />
                </button>
              </div>

              {isOpen && (
                <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc" }}>
                  <div>
                    <label className={styles.editorFieldLabel}>Pregunta</label>
                    <InlineRichInput
                      placeholder="Ej. ¿Cuál es la política de cancelación?"
                      value={faq.pregunta ?? ""}
                      onChange={html => updateFaq(faq.uid, { pregunta: html })}
                    />
                  </div>

                  <div>
                    <label className={styles.editorFieldLabel}>Respuesta</label>
                    <InlineRichInput
                      placeholder="Contenido de la respuesta..."
                      value={faq.respuesta ?? ""}
                      onChange={html => updateFaq(faq.uid, { respuesta: html })}
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
        onClick={addFaq}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", border: "1px dashed #cbd5e1", borderRadius: "0.5rem", background: "#ffffff", cursor: "pointer", color: "#475569", fontSize: "0.82rem", fontWeight: 600 }}
      >
        + Añadir pregunta
      </button>
    </div>
  );
}
