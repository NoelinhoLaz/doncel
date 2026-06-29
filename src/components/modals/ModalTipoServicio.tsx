"use client";

import { useState, useEffect } from "react";
import styles from "@/app/settings/modals.module.css";
import { createTipoServicio, updateTipoServicio } from "@/actions/tiposServicios";
import { renderLucideIcon } from "@/lib/utils/settingsUtils";
import { TRAVEL_ICONS } from "@/lib/constants/settings";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingTipo: any | null;
  onSuccess: () => void;
}

const FORM_DEFAULT = { etiqueta: "", icono: "Plane", contenido: "{}" };

export default function ModalTipoServicio({ isOpen, onClose, editingTipo, onSuccess }: Props) {
  const [form, setForm] = useState(FORM_DEFAULT);
  const [iconSearch, setIconSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIconSearch("");
    if (editingTipo) {
      setForm({
        etiqueta: editingTipo.etiqueta || "",
        icono: editingTipo.icono || "Plane",
        contenido: JSON.stringify(editingTipo.contenido || {}, null, 2),
      });
    } else {
      setForm(FORM_DEFAULT);
    }
  }, [isOpen, editingTipo]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.etiqueta || !form.icono) return;
    let parsedContenido = {};
    if (form.contenido.trim()) {
      try {
        parsedContenido = JSON.parse(form.contenido);
      } catch {
        alert("El contenido JSON no es válido.");
        return;
      }
    }
    try {
      setSaving(true);
      const payload = { etiqueta: form.etiqueta, icono: form.icono, contenido: parsedContenido };
      if (editingTipo) {
        await updateTipoServicio(editingTipo.id, payload);
      } else {
        await createTipoServicio(payload);
      }
      onClose();
      onSuccess();
    } catch (err: any) {
      alert("Error al guardar el tipo de servicio: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredIcons = TRAVEL_ICONS.filter(name =>
    name.toLowerCase().includes(iconSearch.toLowerCase())
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: "500px" }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editingTipo ? "Editar Tipo de Servicio" : "Nuevo Tipo de Servicio"}
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
                placeholder="Ej: Aéreo, Excursiones..."
                value={form.etiqueta}
                onChange={e => setForm({ ...form, etiqueta: e.target.value })}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Seleccionar Icono de Lucide *</label>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "42px",
                  height: "42px",
                  borderRadius: "0.375rem",
                  backgroundColor: "#f1f5f9",
                  color: "var(--primary-color)",
                  border: "1px solid #cbd5e1",
                  flexShrink: 0,
                }}>
                  {renderLucideIcon(form.icono, 20)}
                </div>
                <input
                  type="text"
                  placeholder="Buscar icono (ej: Car, Plane...)"
                  value={iconSearch}
                  onChange={e => setIconSearch(e.target.value)}
                  className={styles.formInput}
                  style={{ flexGrow: 1 }}
                />
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "0.5rem",
                maxHeight: "150px",
                overflowY: "auto",
                border: "1px solid #cbd5e1",
                borderRadius: "0.375rem",
                padding: "0.5rem",
                backgroundColor: "#f8fafc",
              }}>
                {filteredIcons.map(name => {
                  const isSelected = form.icono === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm({ ...form, icono: name })}
                      title={name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        aspectRatio: "1/1",
                        padding: "0.4rem",
                        borderRadius: "0.25rem",
                        border: isSelected ? "2px solid var(--primary-color)" : "1px solid #e2e8f0",
                        backgroundColor: isSelected ? "#f0fdf4" : "#ffffff",
                        color: isSelected ? "var(--primary-color)" : "#64748b",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "var(--primary-color)";
                          e.currentTarget.style.color = "var(--primary-color)";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#e2e8f0";
                          e.currentTarget.style.color = "#64748b";
                        }
                      }}
                    >
                      {renderLucideIcon(name, 16)}
                    </button>
                  );
                })}
                {filteredIcons.length === 0 && (
                  <div style={{ gridColumn: "span 7", padding: "1rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>
                    No se encontraron iconos para "{iconSearch}"
                  </div>
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
