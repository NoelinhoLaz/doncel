"use client";

import { Plus, Trash2, MessageCircle, FileText } from "lucide-react";
import s from "./ajustes.module.css";
import tabStyles from "@/app/expedientes/[id]/page.module.css";

interface Props {
  comunicacionesList: any[];
  setComunicacionesList: (v: any[]) => void;
}

function updateItem(list: any[], index: number, patch: Record<string, any>) {
  return list.map((it, i) => (i === index ? { ...it, ...patch } : it));
}

export default function ComunicacionesSection({ comunicacionesList, setComunicacionesList }: Props) {
  return (
    <div style={{ padding: "0 1.5rem 1.5rem 1.5rem", borderTop: "1px solid #e2e8f0", marginTop: "1.5rem", paddingTop: "1.5rem" }}>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", margin: "0 0 1.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <MessageCircle size={16} style={{ color: "var(--primary-color, #475569)" }} />
        Comunicaciones automáticas
      </h3>

      <div className={s.columnCard}>
        <div className={tabStyles.listHeaderTop} style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div className={tabStyles.listTitleWrapper}>
            <MessageCircle size={16} className={tabStyles.titleIcon} />
            <h3 className={tabStyles.listTitle} style={{ fontSize: "0.9rem", fontWeight: 600 }}>Configuración</h3>
          </div>
          <button className={tabStyles.addActionButton} title="Añadir comunicación"
            onClick={() => setComunicacionesList([...comunicacionesList, { id: crypto.randomUUID(), descripcion: "", activa: true, plantilla: "" }])}
          ><Plus size={18} /></button>
        </div>

        <div style={{ padding: "1.25rem" }}>
          {comunicacionesList.length === 0 ? (
            <div className={s.emptyState} style={{ minHeight: "100px" }}>
              <div className={s.emptyStateIcon}><MessageCircle size={18} /></div>
              <h4 className={s.emptyStateTitle}>Sin comunicaciones</h4>
              <p className={s.emptyStateText}>Pulsa el "+" para añadir una comunicación automática.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0 0 0.25rem 0", borderBottom: "1px solid #f1f5f9", marginBottom: "0.25rem", fontSize: "0.68rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                <span style={{ flex: 1 }}>Acción</span>
                <span style={{ width: "160px", textAlign: "center" }}>Plantilla</span>
                <span style={{ width: "36px", textAlign: "center" }}>Activa</span>
                <span style={{ width: "28px" }} />
              </div>
              {comunicacionesList.map((item, i) => (
                <div key={item.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    placeholder="Ej: Enviar WhatsApp al confirmar"
                    value={item.descripcion}
                    onChange={e => setComunicacionesList(updateItem(comunicacionesList, i, { descripcion: e.target.value }))}
                    className={s.inp}
                    style={{ flex: 1 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", width: "160px", flexShrink: 0 }}>
                    <FileText size={14} style={{ color: "#64748b", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.78rem", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.plantilla || "—"}
                    </span>
                  </div>
                  <label className={s.toggleWrap}>
                    <input type="checkbox" checked={item.activa} onChange={e => setComunicacionesList(updateItem(comunicacionesList, i, { activa: e.target.checked }))} className={s.toggleInput} />
                    <span className={`${s.toggleTrack} ${item.activa ? s.toggleTrackOn : ""}`}>
                      <span className={`${s.toggleKnob} ${item.activa ? s.toggleKnobOn : ""}`} />
                    </span>
                  </label>
                  <button onClick={() => setComunicacionesList(comunicacionesList.filter((_, j) => j !== i))} className={s.deleteBtn}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
