"use client";

import { useState, useEffect } from "react";
import styles from "@/app/settings/modals.module.css";
import { createTipoCliente, updateTipoCliente } from "@/actions/tiposCliente";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingTipo: any | null;
  onSuccess: () => void;
}

const FORM_DEFAULT = { etiqueta: "", orden: 0 };

export default function ModalTipoCliente({ isOpen, onClose, editingTipo, onSuccess }: Props) {
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTipo) {
      setForm({ etiqueta: editingTipo.etiqueta || "", orden: editingTipo.orden ?? 0 });
    } else {
      setForm(FORM_DEFAULT);
    }
  }, [isOpen, editingTipo]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.etiqueta.trim()) return;
    try {
      setSaving(true);
      const payload = { etiqueta: form.etiqueta.trim(), orden: form.orden };
      if (editingTipo) {
        await updateTipoCliente(editingTipo.id, payload);
      } else {
        await createTipoCliente(payload);
      }
      onClose();
      onSuccess();
    } catch (err: any) {
      alert("Error al guardar el tipo de cliente: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: "420px" }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editingTipo ? "Editar Tipo de Cliente" : "Nuevo Tipo de Cliente"}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Etiqueta *</label>
              <input
                type="text"
                required
                placeholder="Ej: Persona, Empresa, Grupo..."
                value={form.etiqueta}
                onChange={e => setForm({ ...form, etiqueta: e.target.value })}
                className={styles.formInput}
              />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Orden</label>
              <input
                type="number"
                value={form.orden}
                onChange={e => setForm({ ...form, orden: Number(e.target.value) || 0 })}
                className={styles.formInput}
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
