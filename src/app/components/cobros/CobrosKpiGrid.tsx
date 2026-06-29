"use client";

import { useMemo } from "react";
import { formatEuro } from "@/lib/utils/currency";
import type { Pagador, MovimientoCobro } from "@/lib/types/cobros";
import styles from "@/app/expedientes/[id]/page.module.css";

const metodoLabels: Record<string, string> = {
  tarjeta: "Tarjeta",
  banco: "Transferencia",
  efectivo: "Efectivo",
  online: "Online",
};

interface Props {
  pagadores: Pagador[];
  movimientos: MovimientoCobro[];
}

export default function CobrosKpiGrid({ pagadores, movimientos }: Props) {
  const totalFacturado = pagadores.reduce((s, p) => s + Number(p.importe_total || 0), 0);
  const totalCobrado = pagadores.reduce((s, p) => s + Number(p.importe_abonado || 0), 0);
  const pctCobrado = totalFacturado > 0 ? Math.round((totalCobrado / totalFacturado) * 100) : 0;
  const saldoPendiente = totalFacturado - totalCobrado;
  const totalMovs = movimientos.length;

  const metodosCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mov of movimientos) {
      const key = mov.medio_pago || "otro";
      m[key] = (m[key] || 0) + 1;
    }
    return m;
  }, [movimientos]);

  const estadosCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mov of movimientos) {
      m[mov.estado] = (m[mov.estado] || 0) + 1;
    }
    return m;
  }, [movimientos]);

  return (
    <div className={styles.viajerosKpiGrid}>
      <div className={styles.viajerosKpiCard}>
        <div className={styles.blankKpiHeader}>
          <span className={styles.blankKpiTitle}>Total Recaudado</span>
          <span className={styles.blankKpiBadge}>{pctCobrado}% Cobrado</span>
        </div>
        <div>
          <div className={styles.blankKpiNumber}>{formatEuro(totalCobrado)}</div>
          <div className={styles.blankKpiSubtext}>
            <strong>{formatEuro(totalCobrado)} cobrados</strong> de {formatEuro(totalFacturado)} facturados.
            {saldoPendiente > 0 && <> {formatEuro(saldoPendiente)} saldo pendiente.</>}
          </div>
        </div>
      </div>

      <div className={styles.viajerosKpiCard}>
        <span className={styles.kpiCardTitle}>Ingresos Bancarios</span>
        <div className={styles.progressItemsList}>
          {Object.entries(metodosCount).length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin movimientos</div>
          )}
          {Object.entries(metodosCount).map(([metodo, count]) => {
            const pct = totalMovs > 0 ? Math.round((count / totalMovs) * 100) : 0;
            return (
              <div key={metodo} className={styles.progressItemRow}>
                <div className={styles.progressItemLabelRow}>
                  <span>{metodoLabels[metodo] || metodo}</span>
                  <span className={styles.progressItemVal}>{count} ({pct}%)</span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div className={styles.extrasProgressBarFill} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.viajerosKpiCard}>
        <span className={styles.kpiCardTitle}>Estados de Cobro</span>
        <div className={styles.progressItemsList}>
          {Object.entries(estadosCount).length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin movimientos</div>
          )}
          {Object.entries(estadosCount).map(([estado, count]) => {
            const pct = totalMovs > 0 ? Math.round((count / totalMovs) * 100) : 0;
            const isPaid = estado === "confirmado";
            return (
              <div key={estado} className={styles.progressItemRow} style={{ marginBottom: "0.25rem" }}>
                <div className={styles.progressItemLabelRow}>
                  <span>{estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
                  <span className={styles.progressItemVal}>{count} ({pct}%)</span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div
                    className={styles.progressBarFill}
                    style={{
                      width: `${pct}%`,
                      background: isPaid
                        ? "linear-gradient(90deg, #22c55e 0%, #4ade80 100%)"
                        : "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
