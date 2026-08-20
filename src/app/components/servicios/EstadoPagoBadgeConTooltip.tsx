"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Landmark, CreditCard, Banknote } from "lucide-react";

const MEDIO_PAGO_LABEL: Record<string, string> = {
  banco: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

const MEDIO_PAGO_ICON: Record<string, any> = {
  banco: Landmark,
  tarjeta: CreditCard,
  efectivo: Banknote,
};

function formatearFecha(fecha: string | null | undefined): string | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return fecha;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

interface Props {
  label: string;
  color: string;
  bg: string;
  clicable?: boolean;
  onClick?: () => void;
  pagos?: any[];
  mostrarTooltipPagos?: boolean;
}

export default function EstadoPagoBadgeConTooltip({ label, color, bg, clicable, onClick, pagos, mostrarTooltipPagos }: Props) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const showTooltip = hover && mostrarTooltipPagos && pagos && pagos.length > 0;

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        onClick={clicable ? (e) => { e.stopPropagation(); onClick?.(); } : undefined}
        onMouseEnter={(e) => {
          setHover(true);
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
        }}
        onMouseLeave={() => setHover(false)}
        title={clicable ? "Haz clic para vincular el movimiento bancario real" : undefined}
        style={{ display: "inline-flex", alignItems: "center", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", backgroundColor: bg, color, fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap", cursor: clicable ? "pointer" : "default", textDecoration: clicable ? "underline" : "none" }}
      >
        {label}
      </span>

      {showTooltip && pos && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            zIndex: 9500,
            minWidth: "220px",
            maxWidth: "300px",
            background: "#1e293b",
            color: "#f1f5f9",
            borderRadius: "0.5rem",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.25)",
            padding: "0.6rem 0.75rem",
            fontSize: "0.72rem",
            pointerEvents: "none",
          }}
        >
          {pagos.map((p, i) => {
            const Icono = MEDIO_PAGO_ICON[p.medio_pago] || Landmark;
            const medioLabel = MEDIO_PAGO_LABEL[p.medio_pago] || p.medio_pago || "—";
            const esTransferencia = p.medio_pago === "banco";
            const fecha = formatearFecha(esTransferencia ? p.fecha : (p.fecha_registro || p.fecha));
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.15rem", padding: i > 0 ? "0.45rem 0 0" : 0, marginTop: i > 0 ? "0.45rem" : 0, borderTop: i > 0 ? "1px solid rgba(255,255,255,0.12)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 600 }}>
                    <Icono size={12} />
                    {medioLabel}
                  </span>
                  <span style={{ fontWeight: 700 }}>{Number(p.importe).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                </div>
                {fecha && <div style={{ color: "#cbd5e1" }}>{fecha}</div>}
                {p.concepto && <div style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.concepto}</div>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </span>
  );
}
