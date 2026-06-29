"use client";

import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import styles from "@/app/settings/modals.module.css";
import { updateTipoServicio } from "@/actions/tiposServicios";
import { getFixedFields } from "@/lib/serviceFormSchemas";
import { normalizeSchemaRows, slugifyField, createFieldByType, renderLucideIcon } from "@/lib/utils/settingsUtils";
import { SYSTEM_BLOCKS, DYNAMIC_BLOCKS, DEFAULT_FORM_EXAMPLE } from "@/lib/constants/settings";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingTipoForm: any | null;
  onSuccess: () => void;
}

export default function ModalTipoForm({ isOpen, onClose, editingTipoForm, onSuccess }: Props) {
  const [formSchemaRows, setFormSchemaRows] = useState<any[]>([]);
  const [selectedField, setSelectedField] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [dragType, setDragType] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !editingTipoForm) return;
    const schema = normalizeSchemaRows(editingTipoForm?.contenido || []);
    setFormSchemaRows(schema);
    setSelectedField(schema?.[0]?.columnas?.[0] ? { rowIdx: 0, colIdx: 0 } : null);
  }, [isOpen, editingTipoForm]);

  if (!isOpen) return null;

  function updateSelectedField(patch: any) {
    if (!selectedField) return;
    setFormSchemaRows(prev => prev.map((row, rIdx) => {
      if (rIdx !== selectedField.rowIdx) return row;
      return {
        ...row,
        columnas: row.columnas.map((col: any, cIdx: number) =>
          cIdx !== selectedField.colIdx ? col : { ...col, ...patch }
        ),
      };
    }));
  }

  function updateSelectedProps(patch: any) {
    if (!selectedField) return;
    setFormSchemaRows(prev => prev.map((row, rIdx) => {
      if (rIdx !== selectedField.rowIdx) return row;
      return {
        ...row,
        columnas: row.columnas.map((col: any, cIdx: number) =>
          cIdx !== selectedField.colIdx ? col : { ...col, propiedades: { ...(col.propiedades || {}), ...patch } }
        ),
      };
    }));
  }

  function addFieldToRow(rowIdx: number, block: any) {
    setFormSchemaRows(prev => prev.map((row, i) => {
      if (i !== rowIdx) return row;
      const nextCols = [...row.columnas];
      if (nextCols.length === 1) nextCols[0] = { ...nextCols[0], ancho: 6 };
      if (nextCols.length >= 2) return row;
      nextCols.push({ ...createFieldByType(block, nextCols.length + 1), ancho: 6 });
      return { ...row, columnas: nextCols };
    }));
  }

  function addRowWithField(block: any) {
    setFormSchemaRows(prev => ([
      ...prev,
      { fila_id: `row_${Date.now()}`, columnas: [createFieldByType(block, 1)] },
    ]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTipoForm) return;
    try {
      setSaving(true);
      await updateTipoServicio(editingTipoForm.id, {
        etiqueta: editingTipoForm.etiqueta,
        icono: editingTipoForm.icono,
        contenido: formSchemaRows,
      });
      onClose();
      onSuccess();
    } catch (err: any) {
      alert("Error al guardar el formulario del tipo: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const fixedRows = editingTipoForm ? getFixedFields(editingTipoForm.etiqueta) : [];

  const colsGridTemplate = (count: number) =>
    count === 2 ? "1fr 1fr" : count === 3 ? "1fr 1fr 1fr" : count === 4 ? "1fr 1fr 1fr 1fr" : "1fr";

  const field = selectedField
    ? formSchemaRows[selectedField.rowIdx]?.columnas?.[selectedField.colIdx]
    : null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "1240px", width: "96vw" }}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Formulario personalizado — {editingTipoForm?.etiqueta || "Tipo"}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.builderBody}>

            {/* ── Panel Bloques ───────────────────────────── */}
            <div className={styles.blocksPanel}>
              <div className={styles.blocksPanelTitle}>Bloques del sistema</div>
              <div style={{ display: "grid", gap: 6 }}>
                {SYSTEM_BLOCKS.map(b => (
                  <div
                    key={`${b.tipo}-${b.campo}`}
                    draggable
                    onDragStart={() => setDragType(b)}
                    className={styles.blockDraggable}
                  >
                    {b.label}
                  </div>
                ))}
              </div>
              <div className={styles.blocksPanelSubtitle}>Bloques dinámicos</div>
              <div style={{ display: "grid", gap: 6 }}>
                {DYNAMIC_BLOCKS.map(b => (
                  <div
                    key={b.tipo}
                    draggable
                    onDragStart={() => setDragType(b)}
                    className={styles.blockDraggable}
                  >
                    {b.label}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={styles.loadExampleBtn}
                onClick={() => setFormSchemaRows(normalizeSchemaRows(DEFAULT_FORM_EXAMPLE))}
              >
                Cargar ejemplo
              </button>
            </div>

            {/* ── Lienzo ──────────────────────────────────── */}
            <div className={styles.canvas}>
              <div className={styles.canvasPanelTitle}>Lienzo</div>
              <div className={styles.canvasGrid}>

                {fixedRows.length > 0 && (
                  <div className={styles.fixedSection}>
                    <div className={styles.fixedSectionLabel}>Campos fijos</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {fixedRows.map((row: any) => (
                        <div
                          key={row.fila_id}
                          className={styles.canvasRow}
                          style={{ display: "grid", gridTemplateColumns: colsGridTemplate(row.columnas.length) }}
                        >
                          {row.columnas.map((col: any, cIdx: number) => (
                            <div key={`${row.fila_id}-${cIdx}`} className={`${styles.fieldCard} ${styles.fieldCardLocked}`}>
                              <div className={styles.fieldCardType}>
                                <LucideIcons.Lock size={10} style={{ color: "#94a3b8" }} />
                                {col.tipo}
                              </div>
                              <div className={styles.fieldCardLabel}>{col.label || "Sin etiqueta"}</div>
                              <div className={styles.fieldCardCampo}>{col.campo}</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formSchemaRows.length > 0 && (
                  <div className={styles.customFieldsLabel}>Campos personalizados</div>
                )}

                {formSchemaRows.map((row: any, rIdx: number) => (
                  <div
                    key={row.fila_id}
                    className={styles.canvasRow}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (dragType) addFieldToRow(rIdx, dragType); }}
                    style={{ display: "grid", gridTemplateColumns: colsGridTemplate(row.columnas.length) }}
                  >
                    {row.columnas.map((col: any, cIdx: number) => {
                      const isSelected = selectedField?.rowIdx === rIdx && selectedField?.colIdx === cIdx;
                      return (
                        <div
                          key={`${row.fila_id}-${cIdx}`}
                          onClick={() => setSelectedField({ rowIdx: rIdx, colIdx: cIdx })}
                          className={`${styles.fieldCard} ${isSelected ? styles.fieldCardSelected : ""}`}
                        >
                          <div className={styles.fieldCardType}>{col.tipo}</div>
                          <div className={styles.fieldCardLabel}>{col.label || "Sin etiqueta"}</div>
                          <div className={styles.fieldCardCampo}>{col.campo}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div
                  className={styles.dropZone}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (dragType) addRowWithField(dragType); }}
                >
                  Arrastra aquí para nueva fila
                </div>
              </div>
            </div>

            {/* ── Inspector ───────────────────────────────── */}
            <div className={styles.inspector}>
              <div className={styles.inspectorTitle}>Inspector</div>
              {!field ? (
                <div className={styles.inspectorEmpty}>Selecciona un campo del lienzo.</div>
              ) : (
                <div className={styles.inspectorGrid}>
                  <label className={styles.inspectorLabel}>
                    Etiqueta
                    <input
                      className={styles.inspectorInput}
                      value={field.label || ""}
                      onChange={e => updateSelectedField({
                        label: e.target.value,
                        campo: slugifyField(e.target.value) || field.campo,
                      })}
                    />
                  </label>

                  <label className={styles.inspectorLabel}>
                    Clave API / BD
                    <input
                      className={`${styles.inspectorInput} ${field.origen === "tabla_nativa" ? styles.inspectorInputDisabled : ""}`}
                      value={field.campo || ""}
                      disabled={field.origen === "tabla_nativa"}
                      onChange={e => updateSelectedField({ campo: slugifyField(e.target.value) })}
                    />
                  </label>

                  <label className={styles.inspectorLabel}>
                    Origen
                    <input
                      className={`${styles.inspectorInput} ${styles.inspectorInputDisabled}`}
                      value={field.origen || "jsonb_detalles"}
                      disabled
                    />
                  </label>

                  <label className={styles.inspectorLabel}>
                    Ancho
                    <select
                      className={styles.inspectorInput}
                      value={field.ancho || 12}
                      onChange={e => updateSelectedField({ ancho: Number(e.target.value) })}
                    >
                      <option value={6}>50%</option>
                      <option value={12}>100%</option>
                    </select>
                  </label>

                  <label className={styles.inspectorLabelInline}>
                    <input
                      type="checkbox"
                      checked={Boolean(field?.propiedades?.required)}
                      onChange={e => updateSelectedProps({ required: e.target.checked })}
                    />
                    Es obligatorio
                  </label>

                  {field.tipo === "select" && (
                    <label className={styles.inspectorLabel}>
                      Opciones (una por línea)
                      <textarea
                        className={styles.inspectorTextarea}
                        value={(field?.propiedades?.opciones || []).join("\n")}
                        onChange={e => updateSelectedProps({
                          opciones: e.target.value.split("\n").map((v: string) => v.trim()).filter(Boolean)
                        })}
                      />
                    </label>
                  )}

                  {(field.tipo === "text" || field.tipo === "textarea" || field.tipo === "time") && (
                    <label className={styles.inspectorLabel}>
                      Placeholder
                      <input
                        className={styles.inspectorInput}
                        value={field?.propiedades?.placeholder || ""}
                        onChange={e => updateSelectedProps({ placeholder: e.target.value })}
                      />
                    </label>
                  )}
                </div>
              )}
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
