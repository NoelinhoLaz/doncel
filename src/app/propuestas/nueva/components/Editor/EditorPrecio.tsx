"use client";

import React from "react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import HighlightTextarea from "./HighlightTextarea";

export default function EditorPrecio({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  return (
    <>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>PVP (Precio Venta Público)</label>
        <HighlightTextarea
          value={seccion.pvp ?? ""}
          onChange={e => onUpdate(seccion.uid, { pvp: e.target.value })}
          placeholder="Ej: 1.600 € / persona o 3.200 € total"
          rows={2}
        />
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Condiciones de Reserva</label>
        <HighlightTextarea
          value={seccion.condiciones ?? ""}
          onChange={e => onUpdate(seccion.uid, { condiciones: e.target.value })}
          placeholder="Ej: - Pago del 30% al confirmar la reserva..."
          rows={4}
        />
      </div>
    </>
  );
}
