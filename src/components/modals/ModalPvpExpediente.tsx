"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { updateExpedientePvp } from "@/actions/cobros";
import styles from "@/app/expedientes/modals.module.css";
import type { ExpedienteRow } from "@/lib/utils/expedientesUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expediente: ExpedienteRow | null;
  onSuccess: () => void;
}

export default function ModalPvpExpediente({ isOpen, onClose, expediente, onSuccess }: Props) {
  const [pvpViajero, setPvpViajero] = useState("");
  const [pvpTotal, setPvpTotal] = useState("");

  useEffect(() => {
    if (!isOpen || !expediente) return;
    setPvpViajero(expediente.pvpViajero != null ? String(expediente.pvpViajero) : "");
    setPvpTotal(expediente.pvpTotal != null ? String(expediente.pvpTotal) : "");
  }, [isOpen, expediente]);

  if (!isOpen || !expediente) return null;

  async function handleSave() {
    try {
      const viajero = pvpViajero.trim() !== "" ? parseFloat(pvpViajero) : null;
      const total = pvpTotal.trim() !== "" ? parseFloat(pvpTotal) : null;
      if (viajero !== null && isNaN(viajero)) return;
      if (total !== null && isNaN(total)) return;
      await updateExpedientePvp(expediente!.realId, { pvp_viajero: viajero, pvp_total: total });
      onClose();
      onSuccess();
    } catch (err) {
      console.error("Error saving PVP:", err);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.pvpModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>PVP — {expediente.id}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>PVP Viajero</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={pvpViajero}
              onChange={(e) => setPvpViajero(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>PVP Total</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={pvpTotal}
              onChange={(e) => setPvpTotal(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.saveBtn} onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
