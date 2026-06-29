"use client";

import { Icons } from "@/lib/icons";
import type { Plazo } from "@/hooks/useNuevoExpediente";
import { formatDate } from "@/lib/utils/date";
import { formatEuro } from "@/lib/utils/currency";
import s from "@/components/modals/nuevoExpediente.module.css";

interface Props {
  plazos: Plazo[];
  fechaPlazo: string;
  onFechaChange: (v: string) => void;
  importePlazo: string;
  onImporteChange: (v: string) => void;
  editingPlazoId: string | null;
  onSavePlazo: (e: React.FormEvent) => void;
  onEditPlazo: (p: Plazo) => void;
  onDeletePlazo: (id: string) => void;
  disabled?: boolean;
}

export default function PlazosField({ plazos, fechaPlazo, onFechaChange, importePlazo, onImporteChange, editingPlazoId, onSavePlazo, onEditPlazo, onDeletePlazo, disabled }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem" }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", textTransform: "uppercase" }}>Configuración de Plazos</span>

      {/* Add/edit form */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: "120px" }}>
          <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>Fecha Plazo</span>
          <input type="date" value={fechaPlazo} onChange={(e) => onFechaChange(e.target.value)} className={s.inp} style={{ padding: "0.45rem 0.6rem", fontSize: "0.8rem" }} disabled={disabled} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: "100px" }}>
          <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>Importe (€)</span>
          <input type="number" placeholder="0.00" value={importePlazo} onChange={(e) => onImporteChange(e.target.value)} className={s.inp} style={{ padding: "0.45rem 0.6rem", fontSize: "0.8rem" }} disabled={disabled} />
        </div>
        <button type="button" onClick={onSavePlazo} disabled={disabled} style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", height: "36px", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Icons.Add size={14} />
          <span>{editingPlazoId ? "Actualizar Plazo" : "Añadir Plazo"}</span>
        </button>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #f1f5f9", borderRadius: "0.5rem", overflow: "hidden", marginTop: "0.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
              {["FECHA", "IMPORTE", "ACCIONES"].map((h, i) => (
                <th key={h} style={{ padding: "0.5rem 1rem", color: "#64748b", fontWeight: 600, textAlign: i === 2 ? "right" : "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plazos.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontStyle: "italic" }}>No hay plazos configurados.</td></tr>
            ) : plazos.map((plazo) => (
              <tr key={plazo.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "0.5rem 1rem", color: "#334155", fontWeight: 500 }}>{formatDate(plazo.fecha)}</td>
                <td style={{ padding: "0.5rem 1rem", color: "#0f172a", fontWeight: 600 }}>{formatEuro(plazo.importe)}</td>
                <td style={{ padding: "0.5rem 1rem", textAlign: "right" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    <button type="button" onClick={() => onEditPlazo(plazo)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: "0.25rem", borderRadius: "4px" }} title="Editar">
                      <Icons.Search size={14} />
                    </button>
                    <button type="button" onClick={() => onDeletePlazo(plazo.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "0.25rem", borderRadius: "4px" }} title="Borrar">
                      <Icons.Logout size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
