"use client";

import { Landmark, CalendarDays, Building2, Euro } from "lucide-react";

interface Props {
  pagos: any[];
}

const MEDIO_STYLE: Record<string, { bg: string; color: string }> = {
  banco: { bg: "#eff6ff", color: "#2563eb" },
  tarjeta: { bg: "#fdf2f8", color: "#db2777" },
};

export default function PagosVinculadosRow({ pagos }: Props) {
  return (
    <tr style={{ backgroundColor: "#f8fafc" }}>
      <td colSpan={8} style={{ padding: "0.75rem 1.5rem" }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", backgroundColor: "#fff", overflow: "hidden", boxShadow: "inset 0 2px 4px 0 rgba(0,0,0,0.03)" }}>
          <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", fontWeight: 700, fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Landmark size={14} />
            Movimientos bancarios vinculados
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                {[
                  { icon: <CalendarDays size={11} />, label: "FECHA", align: "left" as const, nowrap: true },
                  { icon: <Building2 size={11} />, label: "CONCEPTO", align: "left" as const },
                  { icon: <Landmark size={11} />, label: "MEDIO", align: "left" as const },
                  { icon: <Euro size={11} />, label: "IMPORTE", align: "right" as const, nowrap: true },
                ].map(({ icon, label, align, nowrap }) => (
                  <th key={label} style={{ width: nowrap ? "1%" : undefined, whiteSpace: nowrap ? "nowrap" : undefined, fontSize: "0.7rem", padding: "0.25rem 0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
                      {icon} {label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagos.map((pago: any) => {
                const medioStyle = MEDIO_STYLE[pago.medio_pago] ?? { bg: "#f0fdf4", color: "#16a34a" };
                return (
                  <tr key={pago.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.75rem", padding: "0.2rem 0.75rem" }}>
                      {pago.fecha ? new Date(pago.fecha).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td style={{ fontSize: "0.75rem", padding: "0.2rem 0.75rem" }}>{pago.concepto || "—"}</td>
                    <td style={{ fontSize: "0.75rem", padding: "0.2rem 0.75rem" }}>
                      <span style={{ display: "inline-flex", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", fontSize: "0.65rem", fontWeight: 600, textTransform: "capitalize", ...medioStyle }}>
                        {pago.medio_pago || "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#dc2626", width: "1%", whiteSpace: "nowrap", fontSize: "0.75rem", padding: "0.2rem 0.75rem" }}>
                      -{pago.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}
