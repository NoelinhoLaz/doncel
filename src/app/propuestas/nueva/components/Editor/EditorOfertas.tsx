"use client";

import React, { useState, useEffect, useTransition } from "react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import { getFormatosWeb, crearFormatoWeb } from "@/actions/paginaWeb";

export default function EditorOfertas({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [formatos, setFormatos] = useState<{ id: string; nombre: string; slug: string }[]>([]);
  const [nuevoFormato, setNuevoFormato] = useState("");
  const [, startTransition] = useTransition();

  const cargarFormatos = () => {
    getFormatosWeb().then(setFormatos);
  };

  useEffect(() => { cargarFormatos(); }, []);

  const crearFormato = () => {
    const nombre = nuevoFormato.trim();
    if (!nombre) return;
    startTransition(async () => {
      const res = await crearFormatoWeb({ nombre });
      if (res.ok && res.formato) {
        setFormatos(prev => [...prev, res.formato]);
        onUpdate(seccion.uid, { listadoFormatoId: res.formato.id });
        setNuevoFormato("");
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <input
          type="text"
          placeholder="Ej. Nuestras ofertas"
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Formato a mostrar</label>
        <select
          value={seccion.listadoFormatoId ?? ""}
          onChange={e => onUpdate(seccion.uid, { listadoFormatoId: e.target.value || null })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        >
          <option value="">— Selecciona un formato —</option>
          {formatos.map(f => (
            <option key={f.id} value={f.id}>{f.nombre}</option>
          ))}
        </select>
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "6px 0 0 0" }}>
          Se mostrarán automáticamente todas las páginas publicadas de este formato, ordenadas por fecha.
        </p>
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Crear nuevo formato</label>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            placeholder="Ej. Guías, Blog, Ofertas..."
            value={nuevoFormato}
            onChange={e => setNuevoFormato(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); crearFormato(); } }}
            className={styles.editorInput}
            style={{ flex: 1, background: "#ffffff" }}
          />
          <button
            type="button"
            onClick={crearFormato}
            disabled={!nuevoFormato.trim()}
            style={{ padding: "0 0.85rem", fontSize: "0.8rem", fontWeight: 600, color: "#ffffff", background: "#1e293b", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
