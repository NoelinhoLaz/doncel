"use client";

import React from "react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import InlineRichInput from "./InlineRichInput";

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
        <InlineRichInput
          value={seccion.pvp ?? ""}
          onChange={html => onUpdate(seccion.uid, { pvp: html })}
          placeholder="Ej: 1.600 € / persona o 3.200 € total"
        />
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
