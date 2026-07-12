"use client";

import { useState, useEffect } from "react";
import styles from "@/app/settings/modals.module.css";
import { saveAgencyUsuario } from "@/actions/usuarios";
import { getInitials } from "@/lib/utils/settingsUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingUsuario: any | null;
  oficinas: any[];
  cuentasBancarias: any[];
  onSuccess: () => void;
  currentUser?: any | null;
}

const FORM_DEFAULT = {
  nombre: "",
  apellidos: "",
  email: "",
  telefono: "",
  rol: "Agente",
  oficina: "",
  cuentas_bancarias: [] as string[],
};

export default function ModalUsuario({
  isOpen, onClose, editingUsuario, oficinas, cuentasBancarias, onSuccess, currentUser
}: Props) {
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingUsuario) {
      setForm({
        nombre: editingUsuario.nombre || "",
        apellidos: editingUsuario.apellidos || "",
        email: editingUsuario.email || "",
        telefono: editingUsuario.telefono || "",
        rol: editingUsuario.rol || "Agente",
        oficina: editingUsuario.oficina || "",
        cuentas_bancarias: editingUsuario.cuentas_bancarias || [],
      });
    } else {
      const defaultOficina = currentUser?.rol === "SubAdmin" ? (currentUser.oficina_id || "") : (oficinas[0]?.id || "");
      setForm({
        ...FORM_DEFAULT,
        oficina: defaultOficina,
        rol: "Agente",
      });
    }
  }, [isOpen, editingUsuario, currentUser, oficinas]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre || !form.email) return;
    try {
      setSaving(true);
      const res = await saveAgencyUsuario(editingUsuario ? editingUsuario.id : null, {
        nombre: form.nombre,
        apellidos: form.apellidos,
        email: form.email,
        telefono: form.telefono,
        rol: form.rol,
        oficina: form.oficina || null,
        cuentas_bancarias: form.cuentas_bancarias,
      });
      if (res?.success) {
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar el usuario: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleCuenta(id: string) {
    setForm(prev => ({
      ...prev,
      cuentas_bancarias: prev.cuentas_bancarias.includes(id)
        ? prev.cuentas_bancarias.filter(c => c !== id)
        : [...prev.cuentas_bancarias, id],
    }));
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: "520px" }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editingUsuario ? "Editar Usuario" : "Nuevo Usuario"}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody} style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Nombre *</label>
                <input
                  className={styles.formInput}
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Juan"
                  required
                />
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Apellidos</label>
                <input
                  className={styles.formInput}
                  value={form.apellidos}
                  onChange={e => setForm({ ...form, apellidos: e.target.value })}
                  placeholder="Ej: Pérez"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Email *</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="Ej: juan@agencia.com"
                  required
                  disabled={!!editingUsuario}
                />
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Teléfono</label>
                <input
                  type="tel"
                  className={styles.formInput}
                  value={form.telefono}
                  onChange={e => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Ej: +34 600000000"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Rol *</label>
                <select
                  className={styles.formInput}
                  value={form.rol}
                  onChange={e => setForm({ ...form, rol: e.target.value })}
                  required
                >
                  {currentUser?.rol === "SubAdmin" ? (
                    <option value="Agente">Agente</option>
                  ) : (
                    <>
                      <option value="Agente">Agente</option>
                      <option value="SubAdmin">SubAdmin</option>
                      <option value="Admin">Admin</option>
                    </>
                  )}
                </select>
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Oficina</label>
                <select
                  className={styles.formInput}
                  value={form.oficina}
                  onChange={e => setForm({ ...form, oficina: e.target.value })}
                  disabled={currentUser?.rol === "SubAdmin"}
                >
                  {currentUser?.rol === "SubAdmin" ? (
                    oficinas.filter(of => of.id === currentUser.oficina_id).map(of => (
                      <option key={of.id} value={of.id}>{of.nombre}</option>
                    ))
                  ) : (
                    <>
                      <option value="">Sin Oficina</option>
                      {oficinas.map(of => (
                        <option key={of.id} value={of.id}>{of.nombre}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Cuentas Bancarias Asignadas</label>
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                maxHeight: "140px",
                overflowY: "auto",
                border: "1px solid #cbd5e1",
                borderRadius: "0.5rem",
                padding: "0.5rem",
                backgroundColor: "#ffffff",
              }}>
                {cuentasBancarias.length === 0 ? (
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8", padding: "0.25rem" }}>
                    No hay cuentas bancarias registradas.
                  </span>
                ) : (
                  cuentasBancarias.map(cuenta => (
                    <label
                      key={cuenta.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        padding: "0.25rem",
                        borderRadius: "4px",
                        userSelect: "none",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <input
                        type="checkbox"
                        checked={form.cuentas_bancarias.includes(cuenta.id)}
                        onChange={() => toggleCuenta(cuenta.id)}
                        className={styles.checkbox}
                      />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 500, color: "#1e293b" }}>{cuenta.banco}</span>
                        <span style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "monospace" }}>
                          {cuenta.iban}{cuenta.config_oficinas?.nombre ? ` (${cuenta.config_oficinas.nombre})` : ""}
                        </span>
                      </div>
                    </label>
                  ))
                )}
              </div>
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
