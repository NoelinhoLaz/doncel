"use client";

import React, { useState } from "react";
import { GripVertical, X, FileSpreadsheet, Loader2, Eye, EyeOff } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import InlineRichInput from "./InlineRichInput";
import { getExtrasYPvpDesdeCotizacion } from "@/actions/propuestas";

export default function EditorExtras({
  seccion,
  onUpdate,
  propuestaId,
  cotizacionId,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  propuestaId?: string | null;
  cotizacionId?: string | null;
}) {
  const [sincronizando, setSincronizando] = useState(false);
  const [errorSync, setErrorSync] = useState<string | null>(null);
  const filas = seccion.extrasFilas ?? [];

  const updateFila = (uid: string, patch: Partial<{ texto: string; importe: string; oculta: boolean }>) => {
    const next = filas.map(f => f.uid === uid ? { ...f, ...patch } : f);
    onUpdate(seccion.uid, { extrasFilas: next });
  };

  const addFila = () => {
    const uid = `extra-${Date.now()}`;
    onUpdate(seccion.uid, { extrasFilas: [...filas, { uid, texto: "", importe: "" }] });
  };

  const removeFila = (uid: string) => {
    onUpdate(seccion.uid, { extrasFilas: filas.filter(f => f.uid !== uid) });
  };

  const sincronizarDesdeCotizacion = async () => {
    if (!propuestaId) return;
    setSincronizando(true);
    setErrorSync(null);
    try {
      const res = await getExtrasYPvpDesdeCotizacion(propuestaId);
      if (!res.ok) {
        setErrorSync(res.error ?? "No se pudieron traer los extras de la cotización");
        return;
      }
      const filasVinculadas = (res.extras ?? []).map((e: any) => ({
        uid: `extra-cot-${e.origenLineaId}`,
        texto: e.texto,
        importe: e.importe,
        origenLineaId: e.origenLineaId,
      }));
      // Conserva las filas manuales (sin origen de cotización) y reemplaza las vinculadas.
      const filasManuales = filas.filter(f => !f.origenLineaId);
      onUpdate(seccion.uid, { extrasFilas: [...filasVinculadas, ...filasManuales] });
    } catch (err: any) {
      setErrorSync(err.message ?? "Error al sincronizar con la cotización");
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <InlineRichInput
          placeholder="Ej. Extras opcionales..."
          value={seccion.titulo ?? ""}
          onChange={html => onUpdate(seccion.uid, { titulo: html })}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Filas de extras
        </span>
        {cotizacionId && propuestaId && (
          <button
            type="button"
            onClick={sincronizarDesdeCotizacion}
            disabled={sincronizando}
            title="Traer extras (líneas opcionales) desde la cotización vinculada"
            style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: sincronizando ? "wait" : "pointer", color: "var(--primary-color, #6366f1)", padding: 0, fontSize: "0.72rem", fontWeight: 600 }}
          >
            {sincronizando ? <Loader2 size={13} className={styles.aiSparkleSpin} /> : <FileSpreadsheet size={13} />}
            Desde cotización
          </button>
        )}
      </div>
      {errorSync && (
        <p style={{ fontSize: "0.72rem", color: "#dc2626", margin: 0 }}>{errorSync}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filas.map((f, idx) => {
          const bloqueada = !!f.origenLineaId;
          return (
          <div
            key={f.uid}
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
              const newArray = [...filas];
              const [movedItem] = newArray.splice(dragIdx, 1);
              newArray.splice(idx, 0, movedItem);
              onUpdate(seccion.uid, { extrasFilas: newArray });
            }}
            style={{ display: "flex", flexDirection: "column", gap: "4px", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: bloqueada ? "#f1f5f9" : "#f8fafc", padding: "8px 10px", opacity: f.oculta ? 0.5 : 1 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ cursor: "grab", display: "flex", alignItems: "center", color: "#94a3b8", flexShrink: 0 }}>
                <GripVertical size={14} />
              </div>
              <div style={{ flex: 1 }}>
                {bloqueada ? (
                  <div style={{ fontSize: "0.82rem", color: "#475569", padding: "0.3rem 0" }}>{f.texto}</div>
                ) : (
                  <InlineRichInput
                    placeholder="Descripción del extra..."
                    value={f.texto ?? ""}
                    onChange={html => updateFila(f.uid, { texto: html })}
                  />
                )}
              </div>
              <div style={{ width: "140px", flexShrink: 0 }}>
                {bloqueada ? (
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", padding: "0.3rem 0", textAlign: "right" }}>{f.importe}</div>
                ) : (
                  <InlineRichInput
                    placeholder="Importe"
                    value={f.importe ?? ""}
                    onChange={html => updateFila(f.uid, { importe: html })}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => updateFila(f.uid, { oculta: !f.oculta })}
                title={f.oculta ? "Mostrar fila" : "Ocultar fila"}
                style={{ background: "none", border: "none", cursor: "pointer", color: f.oculta ? "#cbd5e1" : "#94a3b8", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                {f.oculta ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                type="button"
                onClick={() => removeFila(f.uid)}
                title="Eliminar fila"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
            {bloqueada && (
              <span style={{ fontSize: "0.65rem", color: "#94a3b8", paddingLeft: "22px" }}>
                Vinculado a la cotización — se edita desde ahí
              </span>
            )}
          </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addFila}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", border: "1px dashed #cbd5e1", borderRadius: "0.5rem", background: "#ffffff", cursor: "pointer", color: "#475569", fontSize: "0.82rem", fontWeight: 600 }}
      >
        + Añadir fila
      </button>
    </div>
  );
}
