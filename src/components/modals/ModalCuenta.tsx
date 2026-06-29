"use client";

import { useState, useEffect } from "react";
import styles from "@/app/settings/modals.module.css";
import { createCuentaBancaria, updateCuentaBancaria } from "@/actions/cuentasBancarias";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingCuenta: any | null;
  oficinas: any[];
  onSuccess: () => void;
}

const FORM_DEFAULT = {
  oficina_id: "",
  banco: "",
  iban: "",
  swift: "",
  descripcion: "",
  cuenta_contable: "",
  activa: true,
};

export default function ModalCuenta({ isOpen, onClose, editingCuenta, oficinas, onSuccess }: Props) {
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingCuenta) {
      setForm({
        oficina_id: editingCuenta.oficina_id || "",
        banco: editingCuenta.banco || "",
        iban: editingCuenta.iban || "",
        swift: editingCuenta.swift || "",
        descripcion: editingCuenta.descripcion || "",
        cuenta_contable: editingCuenta.cuenta_contable || "",
        activa: editingCuenta.activa !== false,
      });
    } else {
      setForm({ ...FORM_DEFAULT, oficina_id: oficinas[0]?.id || "" });
    }
  }, [isOpen, editingCuenta]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.oficina_id || !form.banco) return;
    try {
      setSaving(true);
      const payload = {
        oficina_id: form.oficina_id,
        banco: form.banco,
        iban: form.iban || null,
        swift: form.swift || undefined,
        descripcion: form.descripcion || undefined,
        cuenta_contable: form.cuenta_contable || null,
        activa: form.activa,
      };
      if (editingCuenta) {
        await updateCuentaBancaria(editingCuenta.id, payload);
      } else {
        await createCuentaBancaria(payload);
      }
      onClose();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar la cuenta bancaria: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editingCuenta ? "Editar Cuenta Tesorería" : "Nueva Cuenta Tesorería"}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Oficina *</label>
              <select
                className={styles.formInput}
                value={form.oficina_id}
                onChange={e => setForm({ ...form, oficina_id: e.target.value })}
                required
              >
                <option value="" disabled>Selecciona una oficina</option>
                {oficinas.map(of => (
                  <option key={of.id} value={of.id}>{of.nombre}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Banco *</label>
              <input
                className={styles.formInput}
                value={form.banco}
                onChange={e => setForm({ ...form, banco: e.target.value })}
                placeholder="Ej: Banco Santander"
                required
              />
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Número de Cuenta (IBAN)</label>
              <input
                className={styles.formInput}
                value={form.iban}
                onChange={e => setForm({ ...form, iban: e.target.value })}
                placeholder="Ej: ES210049..."
              />
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Código SWIFT / BIC</label>
              <input
                className={styles.formInput}
                value={form.swift}
                onChange={e => setForm({ ...form, swift: e.target.value })}
                placeholder="Ej: BSANESSMXXX"
              />
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Descripción</label>
              <input
                className={styles.formInput}
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Ej: Cuenta operativa diaria"
              />
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Cuenta Contable</label>
              <input
                className={styles.formInput}
                value={form.cuenta_contable}
                onChange={e => setForm({ ...form, cuenta_contable: e.target.value })}
                placeholder="Ej: 57200001"
              />
            </div>

            <div className={styles.formGroupFull} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                id="cuenta_activa"
                checked={form.activa}
                onChange={e => setForm({ ...form, activa: e.target.checked })}
                className={styles.checkbox}
              />
              <label htmlFor="cuenta_activa" className={styles.formLabel} style={{ cursor: "pointer", margin: 0 }}>
                Cuenta Activa
              </label>
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
