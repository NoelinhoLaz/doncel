"use client";

import { useState } from "react";
import { Trash2, Plus, Users, Link as LinkIcon, Download } from "lucide-react";
import styles from "@/app/expedientes/shared.module.css";

interface Props {
  serviciosList: any[];
  expedienteId: string;
  onToggleOpcional: (id: string, opcional: boolean) => void;
  onDeleteServicio: (id: string) => void;
  onUpdateImporte: (id: string, neto: number | undefined, pvp: number | undefined) => Promise<void>;
  onAbrirManual: () => void;
  onAbrirImportar: () => void;
}

function ImporteField({
  value,
  locked,
  lockedReason,
  isLinked,
  onSave,
}: {
  value: number;
  locked: boolean;
  lockedReason: string;
  isLinked: boolean;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value.toFixed(2));

  const display = value > 0 ? `${value.toFixed(2)} €` : "0.00 €";

  if (locked) {
    return (
      <div
        title={lockedReason}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          padding: "0.3rem 0.6rem", backgroundColor: "#f1f5f9",
          border: "1px solid #e2e8f0", borderRadius: "0.375rem",
          fontSize: "0.825rem", color: "#94a3b8", cursor: "not-allowed",
          minWidth: "90px"
        }}
      >
        {isLinked && <LinkIcon size={11} style={{ color: "#94a3b8", flexShrink: 0 }} />}
        <span style={{ flex: 1, textAlign: "right", fontWeight: 600 }}>{display}</span>
      </div>
    );
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={() => {
          const parsed = parseFloat(inputVal.replace(",", "."));
          if (!isNaN(parsed)) onSave(parsed);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setInputVal(value.toFixed(2)); setEditing(false); }
        }}
        style={{
          width: "90px", padding: "0.3rem 0.5rem", border: "2px solid #3b82f6",
          borderRadius: "0.375rem", fontSize: "0.825rem", textAlign: "right",
          outline: "none", color: "#0f172a", fontWeight: 600
        }}
      />
    );
  }

  return (
    <div
      onClick={() => { setInputVal(value.toFixed(2)); setEditing(true); }}
      title="Haz clic para editar"
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        padding: "0.3rem 0.6rem", backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0", borderRadius: "0.375rem",
        minWidth: "90px", fontSize: "0.825rem", color: "#475569",
        cursor: "text", transition: "border-color 0.15s"
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#94a3b8"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}
    >
      {isLinked && <LinkIcon size={11} style={{ color: "#2563eb", flexShrink: 0 }} />}
      <span style={{ flex: 1, textAlign: "right", fontWeight: 600 }}>{display}</span>
    </div>
  );
}

export default function TablaServiciosOpcionales({
  serviciosList,
  expedienteId,
  onToggleOpcional,
  onDeleteServicio,
  onUpdateImporte,
  onAbrirManual,
  onAbrirImportar
}: Props) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className={styles.tabContainer} style={{ marginTop: "2rem" }}>
      {/* Header */}
      <div className={styles.listHeaderTop} style={{ borderBottom: "1px solid #e2e8f0" }}>
        <div className={styles.listTitleWrapper}>
          <Users size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Servicios Opcionales ({serviciosList.length})</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <div style={{ position: "relative" }}>
            <button className={styles.addActionButton} title="Añadir servicio opcional" onClick={() => setShowDropdown(!showDropdown)}>
              <Plus size={18} />
            </button>
            {showDropdown && (
              <div style={{ position: "absolute", right: 0, top: "110%", zIndex: 2002, width: "200px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", padding: "0.4rem 0" }}>
                <button onClick={() => { setShowDropdown(false); onAbrirManual(); }} style={{ background: "none", border: "none", width: "100%", padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Plus size={14} /> Añadir manual
                </button>
                <button onClick={() => { setShowDropdown(false); onAbrirImportar(); }} style={{ background: "none", border: "none", width: "100%", padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", borderTop: "1px solid #f1f5f9" }}>
                  <Download size={14} /> Importar de cotización
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {serviciosList.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem", backgroundColor: "#fff", borderRadius: "0.75rem", textAlign: "center", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>No hay servicios marcados como opcionales en este expediente.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>ACTIVO</th>
                <th>SERVICIO / PROVEEDOR</th>
                <th style={{ width: "110px", textAlign: "right" }}>NETO</th>
                <th style={{ width: "110px", textAlign: "right" }}>PVP</th>
                <th style={{ width: "90px", textAlign: "center" }}>VIAJEROS</th>
                <th style={{ width: "50px", textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {serviciosList.map((item) => {
                const isLinked = !!(item.lineas && item.lineas.some((l: any) => l.cotizacion_linea_id));
                const hasViajerosVinculados = (item.viajeros_count || 0) > 0;
                const locked = isLinked && hasViajerosVinculados;
                const lockedReason = "No se puede editar el importe porque hay viajeros vinculados a este servicio";

                return (
                  <tr key={item.id}>
                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                      <input
                        type="checkbox"
                        checked={!!item.opcional}
                        onChange={(e) => onToggleOpcional(item.id, e.target.checked)}
                        style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "var(--primary-color, #475569)" }}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{item.descripcion}</span>
                        <span style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                          {item.proveedor || <span style={{ fontStyle: "italic", color: "#94a3b8" }}>Sin proveedor</span>}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                      <ImporteField
                        value={parseFloat(item.neto) || 0}
                        locked={locked}
                        lockedReason={lockedReason}
                        isLinked={isLinked}
                        onSave={(v) => onUpdateImporte(item.id, v, undefined)}
                      />
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                      <ImporteField
                        value={parseFloat(item.pvp) || 0}
                        locked={locked}
                        lockedReason={lockedReason}
                        isLinked={isLinked}
                        onSave={(v) => onUpdateImporte(item.id, undefined, v)}
                      />
                    </td>
                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", padding: "0.3rem 0.6rem", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.375rem", color: "#64748b", fontSize: "0.825rem", fontWeight: 600, minWidth: "60px" }}>
                        <Users size={12} style={{ color: "#64748b" }} />
                        {item.viajeros_count || 0}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                      <button
                        onClick={() => onDeleteServicio(item.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.4rem", borderRadius: "0.25rem", transition: "color 0.15s, background-color 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.backgroundColor = "#fef2f2"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                        title="Eliminar servicio opcional"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
