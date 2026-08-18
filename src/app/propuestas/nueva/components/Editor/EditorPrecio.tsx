"use client";

import React, { useState } from "react";
import { FileSpreadsheet, Loader2, Unlink } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import InlineRichInput from "./InlineRichInput";
import { getExtrasYPvpDesdeCotizacion } from "@/actions/propuestas";

export default function EditorPrecio({
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
  const vinculado = !!seccion.pvpVinculado;

  const vincularConCotizacion = async () => {
    if (!propuestaId) return;
    setSincronizando(true);
    setErrorSync(null);
    try {
      const res = await getExtrasYPvpDesdeCotizacion(propuestaId);
      if (!res.ok) {
        setErrorSync(res.error ?? "No se pudo traer el PVP de la cotización");
        return;
      }
      onUpdate(seccion.uid, { pvp: res.pvp, pvpVinculado: true });
    } catch (err: any) {
      setErrorSync(err.message ?? "Error al sincronizar con la cotización");
    } finally {
      setSincronizando(false);
    }
  };

  const desvincular = () => {
    onUpdate(seccion.uid, { pvpVinculado: false });
  };

  return (
    <>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título</label>
        <InlineRichInput
          value={seccion.titulo ?? ""}
          onChange={html => onUpdate(seccion.uid, { titulo: html })}
          placeholder="Ej: Precio y condiciones"
        />
      </div>

      <div className={styles.editorSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
          <label className={styles.editorFieldLabel} style={{ margin: 0 }}>PVP (Precio Venta Público)</label>
          {cotizacionId && propuestaId && (
            vinculado ? (
              <button
                type="button"
                onClick={desvincular}
                title="Desvincular del PVP de la cotización"
                style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, fontSize: "0.72rem", fontWeight: 600 }}
              >
                <Unlink size={13} />
                Vinculado
              </button>
            ) : (
              <button
                type="button"
                onClick={vincularConCotizacion}
                disabled={sincronizando}
                title="Vincular el PVP al total de la cotización vinculada"
                style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: sincronizando ? "wait" : "pointer", color: "var(--primary-color, #6366f1)", padding: 0, fontSize: "0.72rem", fontWeight: 600 }}
              >
                {sincronizando ? <Loader2 size={13} className={styles.aiSparkleSpin} /> : <FileSpreadsheet size={13} />}
                Desde cotización
              </button>
            )
          )}
        </div>
        {errorSync && (
          <p style={{ fontSize: "0.72rem", color: "#dc2626", margin: "0 0 4px" }}>{errorSync}</p>
        )}
        {vinculado ? (
          <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "#475569", padding: "0.55rem 0.7rem", background: "#f1f5f9", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
            {seccion.pvp || "—"}
          </div>
        ) : (
          <InlineRichInput
            value={seccion.pvp ?? ""}
            onChange={html => onUpdate(seccion.uid, { pvp: html })}
            placeholder="Ej: 1.600 € / persona o 3.200 € total"
          />
        )}
        {vinculado && (
          <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Vinculado a la cotización — se edita desde ahí</span>
        )}
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Condiciones de Reserva</label>
        <InlineRichInput
          value={seccion.condiciones ?? ""}
          onChange={html => onUpdate(seccion.uid, { condiciones: html })}
          placeholder="Ej: Pago del 30% al confirmar la reserva..."
        />
      </div>
    </>
  );
}
