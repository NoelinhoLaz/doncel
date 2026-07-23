"use client";

import React from "react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";

export default function EditorFormulario({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const campos = seccion.formularioCampos ?? [
    { uid: "nombre", key: "nombre", label: "Nombre", lineas: 1, activo: true },
    { uid: "email", key: "email", label: "Email", lineas: 1, activo: true },
    { uid: "observaciones", key: "observaciones", label: "Observaciones", lineas: 10, activo: true },
  ];

  const updateCampo = (uid: string, key: string, label: string, lineas: number, activo: boolean) => {
    const updated = campos.map(c => (c.uid === uid ? { uid, key, label, lineas, activo } : c));
    onUpdate(seccion.uid, { formularioCampos: updated });
  };

  return (
    <>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título</label>
        <input
          type="text"
          className={styles.editorInput}
          style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #e2e8f0" }}
          value={seccion.formularioTitulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { formularioTitulo: e.target.value })}
          placeholder="¿Tienes alguna duda o quieres confirmar?"
        />
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Subtítulo</label>
        <input
          type="text"
          className={styles.editorInput}
          style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #e2e8f0" }}
          value={seccion.formularioSubtitulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { formularioSubtitulo: e.target.value })}
          placeholder="Rellena el formulario y te responderemos de inmediato."
        />
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Email de envío (Agente)</label>
        <input
          type="email"
          className={styles.editorInput}
          style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #e2e8f0" }}
          value={seccion.formularioEmail ?? ""}
          onChange={e => onUpdate(seccion.uid, { formularioEmail: e.target.value })}
          placeholder="email@agente.com"
        />
        <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" }}>
          Las respuestas del formulario se enviarán a esta dirección.
        </p>
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Texto del botón de enviar</label>
        <input
          type="text"
          className={styles.editorInput}
          style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #e2e8f0" }}
          value={seccion.formularioBoton ?? "Enviar"}
          onChange={e => onUpdate(seccion.uid, { formularioBoton: e.target.value })}
          placeholder="Enviar"
        />
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel} style={{ marginBottom: "0.75rem", display: "block" }}>Campos del Formulario</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {campos.map((campo) => (
            <div
              key={campo.uid}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                background: "#f8fafc",
                border: "1px solid #e2e8f0"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={campo.activo}
                  onChange={e => updateCampo(campo.uid, campo.key, campo.label, campo.lineas, e.target.checked)}
                  style={{ width: "15px", height: "15px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                  Habilitar Campo ({campo.key})
                </span>
              </div>

              {campo.activo && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "8px" }}>
                  <div>
                    <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Etiqueta</label>
                    <input
                      type="text"
                      style={{ width: "100%", padding: "0.35rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", fontSize: "0.75rem" }}
                      value={campo.label}
                      onChange={e => updateCampo(campo.uid, campo.key, e.target.value, campo.lineas, campo.activo)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Líneas</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      style={{ width: "100%", padding: "0.35rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", fontSize: "0.75rem" }}
                      value={campo.lineas}
                      onChange={e => updateCampo(campo.uid, campo.key, campo.label, Math.max(1, parseInt(e.target.value) || 1), campo.activo)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
