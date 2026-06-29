"use client";

import { Icons } from "@/lib/icons";
import { formatDate } from "@/lib/utils/date";
import { calculateAsientoTotals, formatEuroContable } from "@/lib/utils/contabilidad";
import type { Filtros } from "@/hooks/useLibroDiario";
import s from "./diario.module.css";

interface Props {
  asientos: any[];
  onUpdateFiltro: <K extends keyof Filtros>(key: K, value: Filtros[K]) => void;
}

const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export default function VistaAsiento({ asientos, onUpdateFiltro }: Props) {
  const oficiales = asientos.filter(a => a.estado !== "borrador");

  if (oficiales.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", padding: "4rem 2rem", textAlign: "center", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)" }}>
        <Icons.Book size={40} style={{ color: "#94a3b8", marginBottom: "1rem" }} />
        <div style={{ fontWeight: 700, color: "#334155", fontSize: "1rem" }}>No hay asientos oficiales</div>
        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>Todos los asientos están en estado borrador o pendientes de contabilizar.</div>
      </div>
    );
  }

  return (
    <>
      {oficiales.map((asiento) => {
        const totals = calculateAsientoTotals(asiento.contabilidad_apuntes);
        return (
          <div key={asiento.id} className={s.asientoCard}>
            <div className={s.asientoHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span className={s.asientoNumero}>Asiento {asiento.numero}</span>
                <span className={s.asientoFecha}>{formatDate(asiento.fecha)}</span>
                <span style={{ fontSize: "0.82rem", color: "#475569", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "380px" }} title={asiento.concepto}>
                  • {asiento.concepto || "Sin concepto general"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", fontWeight: 700, textTransform: "uppercase", backgroundColor: asiento.estado === "contabilizado" ? "#dcfce7" : "#f1f5f9", color: asiento.estado === "contabilizado" ? "#15803d" : "#475569", border: asiento.estado === "contabilizado" ? "1px solid #bbf7d0" : "1px solid #e2e8f0" }}>
                  {asiento.estado}
                </span>
                <span className={`${s.balanceBadge} ${totals.isBalanced ? s.balanceBadgeOk : s.balanceBadgeKo}`} title={totals.isBalanced ? "El debe y el haber coinciden" : "Diferencia detectada"}>
                  {totals.isBalanced ? <Icons.Shield size={12} /> : <Icons.Close size={12} />}
                  {totals.isBalanced ? "Cuadrado" : "Descuadrado"}
                </span>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className={s.apuntesTable}>
                <thead>
                  <tr>
                    <th>CUENTA CONTABLE</th>
                    <th>CONTACTO / DETALLE</th>
                    <th>CONCEPTO LÍNEA</th>
                    <th style={{ textAlign: "right", width: "130px" }}>DEBE</th>
                    <th style={{ textAlign: "right", width: "130px" }}>HABER</th>
                  </tr>
                </thead>
                <tbody>
                  {asiento.contabilidad_apuntes?.map((ap: any) => {
                    const isCredit = Number(ap.haber || 0) > 0;
                    return (
                      <tr key={ap.id} className={isCredit ? s.creditRow : s.debitRow}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <button onClick={() => onUpdateFiltro("cuentaId", ap.cuenta_id)} className={s.cuentaPill} title="Pulsar para filtrar por esta cuenta">
                              {ap.subcuenta || ap.config_cuentas_contables?.codigo}
                            </button>
                            <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.8rem", marginLeft: isCredit ? "0.75rem" : "0" }}>
                              {ap.config_cuentas_contables?.descripcion}
                            </span>
                          </div>
                        </td>
                        <td>
                          {ap.contabilidad_entidades?.nombre || ap.contabilidad_proveedores?.nombre
                            ? <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{ap.contabilidad_entidades?.nombre || ap.contabilidad_proveedores?.nombre}</span>
                            : <span style={{ color: "#cbd5e1", fontSize: "0.78rem" }}>—</span>}
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "#475569", fontStyle: "italic" }}>
                          {ap.concepto !== asiento.concepto ? ap.concepto : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a", fontSize: "0.83rem" }}>{formatEuroContable(ap.debe)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#64748b", fontSize: "0.83rem" }}>{formatEuroContable(ap.haber)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={s.asientoFooter}>
              {[
                { label: "TOTAL DEBE", val: totals.totalDebe },
                { label: "TOTAL HABER", val: totals.totalHaber },
              ].map(({ label, val }) => (
                <div key={label} className={s.footerTotalCol}>
                  <span className={s.footerTotalLabel}>{label}</span>
                  <span className={s.footerTotalVal}>{fmt.format(val)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
