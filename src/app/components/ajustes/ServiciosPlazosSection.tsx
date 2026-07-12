import { useState } from "react";
import * as LucideIcons from "lucide-react";
import { Plus, Trash2 } from "lucide-react";
import SafeDateInput from "./SafeDateInput";
import s from "./ajustes.module.css";
import tabStyles from "@/app/expedientes/[id]/page.module.css";

interface Props {
  plazosList: any[];
  setPlazosList: (v: any[]) => void;
  cancelacionesList: any[];
  setCancelacionesList: (v: any[]) => void;
  plazosValid: boolean;
  plazosSum: number;
  targetAmount: number;
  formaPago: string;
}

function updateItem<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((it, i) => i === index ? { ...it, ...patch } : it);
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className={s.emptyState}>
      <div className={s.emptyStateIcon}>{icon}</div>
      <h4 className={s.emptyStateTitle}>{title}</h4>
      <p className={s.emptyStateText}>{text}</p>
    </div>
  );
}

export default function ServiciosPlazosSection({ plazosList, setPlazosList, cancelacionesList, setCancelacionesList, plazosValid, plazosSum, targetAmount, formaPago }: Props) {
  return (
    <div style={{ padding: "0 1.5rem 1.5rem 1.5rem", borderTop: "1px solid #e2e8f0", marginTop: "1.5rem", paddingTop: "1.5rem" }}>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", margin: "0 0 1.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <LucideIcons.Percent size={16} style={{ color: "var(--primary-color, #475569)" }} />
        Plazos de cobro y Plazos de cancelación
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem" }}>

        {/* Columna 1: Plazos de cobro */}
        <div className={s.columnCard}>
          <div className={tabStyles.listHeaderTop} style={{ borderBottom: "1px solid #e2e8f0" }}>
            <div className={tabStyles.listTitleWrapper}>
              <LucideIcons.CalendarRange size={16} className={tabStyles.titleIcon} />
              <h3 className={tabStyles.listTitle} style={{ fontSize: "0.9rem", fontWeight: 600 }}>Plazos de cobro</h3>
            </div>
            <button className={tabStyles.addActionButton} title="Añadir plazo"
              onClick={() => setPlazosList([...plazosList, { id: crypto.randomUUID(), descripcion: "", fecha: "", importe: "" }])}
            ><Plus size={18} /></button>
          </div>
          <div style={{ padding: "1.25rem" }}>
            {!plazosValid && (
              <div className={s.warningBanner}>
                <LucideIcons.AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>Suma de plazos ({plazosSum.toFixed(2)}€) no coincide con {formaPago === "un_pagador" ? "Importe total" : "PVP viajero"} ({targetAmount.toFixed(2)}€).</span>
              </div>
            )}
            {plazosList.length === 0 ? (
              <EmptyState icon={<LucideIcons.ListTodo size={18} />} title="No hay plazos" text={"Pulsa el \"+\" para añadir un plazo de pago."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {plazosList.map((item, i) => (
                  <div key={item.id} style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                    <input placeholder="Descripción" value={item.descripcion} onChange={e => setPlazosList(updateItem(plazosList, i, { descripcion: e.target.value }))} className={s.inpSm} style={{ flex: 1.5 }} />
                    <SafeDateInput value={item.fecha} onChange={val => setPlazosList(updateItem(plazosList, i, { fecha: val }))} className={s.inpSm} style={{ flex: 1, minWidth: "80px" }} />
                    <input type="number" placeholder="Importe" value={item.importe} onChange={e => setPlazosList(updateItem(plazosList, i, { importe: e.target.value }))} className={s.inpSm} style={{ flex: 0.8, minWidth: "70px" }} />
                    <button onClick={() => setPlazosList(plazosList.filter((_, j) => j !== i))} className={s.deleteBtn}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna 2: Plazos de cancelación */}
        <div className={s.columnCard}>
          <div className={tabStyles.listHeaderTop} style={{ borderBottom: "1px solid #e2e8f0" }}>
            <div className={tabStyles.listTitleWrapper}>
              <LucideIcons.ShieldAlert size={16} className={tabStyles.titleIcon} />
              <h3 className={tabStyles.listTitle} style={{ fontSize: "0.9rem", fontWeight: 600 }}>Plazos de cancelación</h3>
            </div>
            <button className={tabStyles.addActionButton} title="Añadir regla de cancelación"
              onClick={() => setCancelacionesList([...cancelacionesList, { id: crypto.randomUUID(), descripcion: `Tramo ${cancelacionesList.length + 1}`, fecha_desde: "", fecha_hasta: "", tipo_valor: "importe", valor: "" }])}
            ><Plus size={18} /></button>
          </div>
          <div style={{ padding: "1.25rem" }}>
            {cancelacionesList.length === 0 ? (
              <EmptyState icon={<LucideIcons.FileText size={18} />} title="No hay políticas de cancelación" text={"Pulsa el \"+\" para añadir un plazo o gasto de cancelación."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {cancelacionesList.map((item, i) => (
                  <div key={item.id} style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.15rem", flex: 0.8, minWidth: "80px" }}>
                      <span style={{ fontSize: "0.6rem", color: "#64748b" }}>Del:</span>
                      <SafeDateInput value={item.fecha_desde} onChange={val => setCancelacionesList(updateItem(cancelacionesList, i, { fecha_desde: val }))} className={s.inpSm} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.15rem", flex: 0.8, minWidth: "80px" }}>
                      <span style={{ fontSize: "0.6rem", color: "#64748b" }}>Al:</span>
                      <SafeDateInput value={item.fecha_hasta} onChange={val => setCancelacionesList(updateItem(cancelacionesList, i, { fecha_hasta: val }))} className={s.inpSm} />
                    </div>
                    <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "visible", position: "relative" }}>
                      <input
                        type="number"
                        placeholder={item.tipo_valor === "porcentaje" ? "%" : "€"}
                        value={item.valor}
                        onChange={e => setCancelacionesList(updateItem(cancelacionesList, i, { valor: e.target.value }))}
                        style={{ border: "none", borderRadius: 0, width: "55px", minWidth: "55px", outline: "none", fontSize: "0.72rem", padding: "0.25rem 0.3rem", color: "#0f172a", background: "#fff" }}
                      />
                      <span
                        onClick={() => setCancelacionesList(updateItem(cancelacionesList, i, { tipo_valor: item.tipo_valor === "importe" ? "porcentaje" : "importe" }))}
                        title={item.tipo_valor === "importe" ? "Cambiar a porcentaje" : "Cambiar a importe"}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", minWidth: "36px", height: "100%", cursor: "pointer", background: "#f8fafc", borderLeft: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: 600, color: "#475569", userSelect: "none" }}
                      >
                        {item.tipo_valor === "importe" ? "€" : "%"}
                      </span>
                    </div>
                    <button onClick={() => setCancelacionesList(cancelacionesList.filter((_, j) => j !== i))} className={s.deleteBtn}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
