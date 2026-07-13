"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Landmark, CreditCard, Banknote, Receipt, ChevronDown, ChevronRight, FileText } from "lucide-react";
import styles from "@/app/expedientes/shared.module.css";
import listStyles from "@/app/expedientes/page.module.css";

interface Props {
  serviciosList: any[];
  onConciliar?: (movimientoId: string) => void;
  documentosPorMovimiento?: Record<string, any[]>;
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

export default function PagosRealizadosList({ serviciosList, onConciliar, documentosPorMovimiento = {} }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [docsTooltipId, setDocsTooltipId] = useState<string | null>(null);

  useEffect(() => {
    if (!docsTooltipId) return;
    const close = () => setDocsTooltipId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [docsTooltipId]);

  const pagos = useMemo(() => {
    const grupos = new Map<string, any>();
    for (const s of serviciosList) {
      for (const p of (s.pagos || [])) {
        const grupo = grupos.get(p.id) || {
          id: p.id,
          fecha: p.fecha,
          fecha_registro: p.fecha_registro,
          concepto: p.concepto,
          medio_pago: p.medio_pago,
          proveedor: s.proveedor,
          importe: 0,
          sobrante: Number(p.sobrante || 0),
          sobrante_aplicado: !!p.sobrante_aplicado,
          pendiente_conciliar: !!p.pendiente_conciliar,
          servicios: [] as any[],
        };
        grupo.importe += Number(p.importe || 0);
        grupo.servicios.push({ descripcion: s.descripcion, proveedor: s.proveedor });
        grupos.set(p.id, grupo);
      }
    }
    return Array.from(grupos.values()).sort((a, b) => new Date(b.fecha_registro || 0).getTime() - new Date(a.fecha_registro || 0).getTime());
  }, [serviciosList]);

  // Los pagos pendientes de conciliar todavía no cuentan como dinero confirmado.
  const totalPagado = useMemo(() => pagos.filter((p) => !p.pendiente_conciliar).reduce((sum, p) => sum + p.importe, 0), [pagos]);

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
                <th>Fec. Pago</th>
                <th>Fec. Registro</th>
                <th>Concepto</th>
                <th>Proveedor</th>
                <th style={{ textAlign: "center" }}>Medio</th>
                <th style={{ textAlign: "center" }}>Serv.</th>
                <th style={{ textAlign: "center" }}>Docs.</th>
                <th style={{ textAlign: "right" }}>Importe</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => {
                const MedioIcon = MEDIO_ICON[p.medio_pago] || Receipt;
                const isExpanded = expandedIds.has(p.id);
                return (
                  <Fragment key={p.id}>
                    <tr onClick={() => toggleExpand(p.id)} style={{ cursor: "pointer" }}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                        {p.fecha ? (
                          <span style={{ color: "#64748b" }}>{new Date(p.fecha).toLocaleDateString("es-ES")}</span>
                        ) : (
                          <span
                            title="Pendiente de conciliar — haz clic para vincular el movimiento bancario real"
                            onClick={(e) => { e.stopPropagation(); onConciliar?.(p.id); }}
                            style={{ display: "inline-flex", alignItems: "center", padding: "0.1rem 0.4rem", borderRadius: "0.25rem", backgroundColor: "#eff6ff", color: "#2563eb", fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap", cursor: onConciliar ? "pointer" : "default", textDecoration: onConciliar ? "underline" : "none" }}
                          >
                            Pdt. Conciliar
                          </span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem", color: "#64748b" }}>
                        {p.fecha_registro ? new Date(p.fecha_registro).toLocaleDateString("es-ES") : "—"}
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "#0f172a", fontWeight: 500, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.concepto || "—"}
                        {p.sobrante > 0 && !p.sobrante_aplicado && (
                          <span
                            title="Sobrante disponible como saldo a favor de este proveedor para un próximo pago"
                            style={{ marginLeft: "0.5rem", display: "inline-flex", alignItems: "center", padding: "0.1rem 0.4rem", borderRadius: "0.25rem", backgroundColor: "#eff6ff", color: "#1d4ed8", fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap" }}
                          >
                            +{p.sobrante.toLocaleString("es-ES", { minimumFractionDigits: 2 })} € sin aplicar
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "#475569", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.proveedor || "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span title={MEDIO_LABEL[p.medio_pago] || p.medio_pago} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                          <MedioIcon size={14} />
                        </span>
                      </td>
                      <td style={{ textAlign: "center", fontSize: "0.8rem", color: "#475569" }}>
                        {p.servicios.length}
                      </td>
                      <td style={{ textAlign: "center", fontSize: "0.8rem", color: "#475569", position: "relative" }}>
                        {(documentosPorMovimiento[p.id] || []).length > 0 ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocsTooltipId((prev) => (prev === p.id ? null : p.id));
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}
                          >
                            <FileText size={13} />
                            {documentosPorMovimiento[p.id].length}
                          </span>
                        ) : (
                          "—"
                        )}
                        {docsTooltipId === p.id && (documentosPorMovimiento[p.id] || []).length > 0 && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: "50%",
                              transform: "translateX(-50%)",
                              marginTop: "0.3rem",
                              backgroundColor: "#fff",
                              border: "1px solid #e2e8f0",
                              borderRadius: "0.4rem",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                              padding: "0.4rem",
                              zIndex: 20,
                              minWidth: 200,
                              textAlign: "left",
                            }}
                          >
                            {documentosPorMovimiento[p.id].map((doc: any) => (
                              <div
                                key={doc.id}
                                onClick={() => { if (doc.archivo_url) window.open(doc.archivo_url, "_blank"); }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  padding: "0.35rem 0.5rem",
                                  borderRadius: "0.3rem",
                                  fontSize: "0.76rem",
                                  color: "#334155",
                                  cursor: doc.archivo_url ? "pointer" : "default",
                                  whiteSpace: "nowrap",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <FileText size={12} />
                                <span>{doc.documento_numero || doc.archivo_nombre || doc.documento_tipo || "Documento"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontSize: "0.85rem", fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>
                        {p.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                      </td>
                      <td style={{ textAlign: "center", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0 }}>
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
