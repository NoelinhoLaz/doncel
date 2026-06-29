"use client";

import { useState } from "react";
import styles from "@/app/settings/modals.module.css";
import { createOficina } from "@/actions/oficinas";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalOficina({ isOpen, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "" });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre) return;
    try {
      setSaving(true);
      await createOficina({ nombre: form.nombre, telefono: form.telefono, email: form.email });
      setForm({ nombre: "", telefono: "", email: "" });
      onClose();
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Error al crear la oficina");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Nueva Oficina</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Nombre de la Oficina *</label>
              <input
                className={styles.formInput}
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Sede Central"
                required
              />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Teléfono</label>
              <input
                className={styles.formInput}
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                placeholder="+34 900..."
              />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Email</label>
              <input
                type="email"
                className={styles.formInput}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="contacto@oficina.com"
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
