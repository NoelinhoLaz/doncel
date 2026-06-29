"use client";

import { useState } from "react";
import styles from "@/app/settings/modals.module.css";
import { guardarApiKey } from "@/actions/apikeys";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalApiKey({ isOpen, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ nombre: "", key: "" });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre || !form.key) return;
    setSaving(true);
    const res = await guardarApiKey(form.nombre, form.key);
    if (res.success) {
      setForm({ nombre: "", key: "" });
      onClose();
      onSuccess();
    } else {
      alert("Error al guardar la API Key: " + res.error);
    }
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Nueva API Key</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Nombre de la Key *</label>
              <input
                className={styles.formInput}
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Anthropic Claude 3"
                required
              />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>API Key *</label>
              <input
                type="password"
                className={styles.formInput}
                value={form.key}
                onChange={e => setForm({ ...form, key: e.target.value })}
                placeholder="Pega la API Key aquí..."
                required
              />
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.saveButton} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
