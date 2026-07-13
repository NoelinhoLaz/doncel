"use client";

import { Fragment, useMemo, useState } from "react";
import { Landmark, CreditCard, Banknote, Receipt, ChevronDown, ChevronRight } from "lucide-react";
import styles from "@/app/expedientes/shared.module.css";
import listStyles from "@/app/expedientes/page.module.css";

interface Props {
  serviciosList: any[];
}

const MEDIO_ICON: Record<string, any> = {
  banco: Landmark,
  tarjeta: CreditCard,
  efectivo: Banknote,
};

const MEDIO_LABEL: Record<string, string> = {
  banco: "Banco",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

export default function PagosRealizadosList({ serviciosList }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const pagos = useMemo(() => {
    const grupos = new Map<string, any>();
    for (const s of serviciosList) {
      for (const p of (s.pagos || [])) {
        const grupo = grupos.get(p.id) || {
          id: p.id,
          fecha: p.fecha,
          concepto: p.concepto,
          medio_pago: p.medio_pago,
          importe: 0,
          servicios: [] as any[],
        };
        grupo.importe += Number(p.importe || 0);
        grupo.servicios.push({ descripcion: s.descripcion, proveedor: s.proveedor });
        grupos.set(p.id, grupo);
      }
    }
    return Array.from(grupos.values()).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [serviciosList]);

  const totalPagado = useMemo(() => pagos.reduce((sum, p) => sum + p.importe, 0), [pagos]);

  const toggleExpand = (id: string) => setExpandedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className={styles.tabContainer} style={{ marginTop: "1.5rem" }}>
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Receipt size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Pagos realizados ({pagos.length})</h2>
        </div>
        <div style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 600 }}>
          Total: {totalPagado.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
        </div>
      </div>

      {pagos.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
          No hay pagos registrados todavía.
        </div>
      ) : (
        <div className={listStyles.tableContainer} style={{ overflow: "visible", boxShadow: "none", border: "none", background: "transparent", padding: 0 }}>
          <table className={listStyles.table} style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 28 }} />
                <th>Fecha</th>
                <th>Concepto</th>
                <th style={{ textAlign: "center" }}>Medio</th>
                <th style={{ textAlign: "center" }}>Servicios</th>
                <th style={{ textAlign: "right" }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => {
                const MedioIcon = MEDIO_ICON[p.medio_pago] || Receipt;
                const isExpanded = expandedIds.has(p.id);
                return (
                  <Fragment key={p.id}>
                    <tr onClick={() => toggleExpand(p.id)} style={{ cursor: "pointer" }}>
                      <td style={{ textAlign: "center", color: "#94a3b8" }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem", color: "#64748b" }}>
                        {p.fecha ? new Date(p.fecha).toLocaleDateString("es-ES") : "—"}
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "#0f172a", fontWeight: 500, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.concepto || "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span title={MEDIO_LABEL[p.medio_pago] || p.medio_pago} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                          <MedioIcon size={14} />
                        </span>
                      </td>
                      <td style={{ textAlign: "center", fontSize: "0.8rem", color: "#475569" }}>
                        {p.servicios.length}
                      </td>
                      <td style={{ textAlign: "right", fontSize: "0.85rem", fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>
                        {p.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div style={{ padding: "0.5rem 1rem 0.75rem 2.5rem", backgroundColor: "#f8fafc" }}>
                            {p.servicios.map((sv: any, i: number) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", fontSize: "0.78rem", color: "#334155" }}>
                                <span style={{ fontWeight: 500 }}>{sv.descripcion}</span>
                                {sv.proveedor && <span style={{ color: "#94a3b8" }}>· {sv.proveedor}</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
