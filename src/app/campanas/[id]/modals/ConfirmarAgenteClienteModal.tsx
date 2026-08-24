"use client";

import { X } from "lucide-react";
import styles from "../page.module.css";

// Se muestra cuando se reasigna el agente de una oportunidad y el cliente
// vinculado ya tenía otro agente distinto asignado — pregunta si también se
// quiere actualizar el agente del cliente para que quede consistente.
export function ConfirmarAgenteClienteModal({
  clienteNombre,
  agenteActualNombre,
  agenteNuevoNombre,
  saving,
  onClose,
  onConfirmar,
}: {
  clienteNombre: string;
  agenteActualNombre: string;
  agenteNuevoNombre: string;
  saving: boolean;
  onClose: () => void;
  onConfirmar: (cambiarCliente: boolean) => void;
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ width: 420 }}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Agente del cliente</span>
          <button className={styles.btnClose} onClick={onClose} disabled={saving}><X size={15} /></button>
        </div>
        <div className={styles.modalBody}>
          <p style={{ fontSize: "0.85rem", color: "#334155", margin: 0, lineHeight: 1.5 }}>
            <strong>{clienteNombre}</strong> tiene asignado actualmente a <strong>{agenteActualNombre}</strong> como agente.
            ¿Quieres cambiarlo también a <strong>{agenteNuevoNombre}</strong>?
          </p>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={() => onConfirmar(false)} disabled={saving}>
            {saving ? "Guardando…" : "No, solo la oportunidad"}
          </button>
          <button className={styles.btnPrimary} onClick={() => onConfirmar(true)} disabled={saving}>
            {saving ? "Guardando…" : "Sí, cambiar también"}
          </button>
        </div>
      </div>
    </div>
  );
}
