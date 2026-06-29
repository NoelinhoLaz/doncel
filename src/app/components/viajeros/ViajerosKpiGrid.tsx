"use client";

import styles from "@/app/expedientes/[id]/page.module.css";

interface Props {
  viajeros: any[];
  loading: boolean;
}

export default function ViajerosKpiGrid({ viajeros, loading }: Props) {
  const total = viajeros.length;
  const confirmados = viajeros.filter((v) => v.status === "CONFIRMADO").length;
  const femenino = viajeros.filter((v) => v.gender === "F").length;
  const masculino = viajeros.filter((v) => v.gender === "M").length;
  const noConsta = viajeros.filter((v) => v.gender !== "F" && v.gender !== "M").length;
  const pctF = total > 0 ? Math.round((femenino / total) * 100) : 0;
  const pctM = total > 0 ? Math.round((masculino / total) * 100) : 0;
  const pctNC = total > 0 ? Math.round((noConsta / total) * 100) : 0;

  const extrasCount = (() => {
    const counts: Record<string, { count: number; descripcion: string }> = {};
    viajeros.forEach((v) =>
      (v.extras || []).forEach((e: any) => {
        const key = e.descripcion || "extra";
        if (!counts[key]) counts[key] = { count: 0, descripcion: e.descripcion || "Extra" };
        counts[key].count++;
      })
    );
    return Object.values(counts).sort((a, b) => b.count - a.count);
  })();
  const maxExtrasCount = extrasCount.reduce((m, i) => Math.max(m, i.count), 0) || 1;

  return (
    <div className={styles.viajerosKpiGrid}>
      {/* KPI 1: Ocupación */}
      <div className={styles.viajerosKpiCard}>
        <div className={styles.blankKpiHeader}>
          <span className={styles.blankKpiTitle}>Viajeros del Expediente</span>
          <span className={styles.blankKpiBadge}>
            {loading ? "..." : `${total} viajero${total === 1 ? "" : "s"}`}
          </span>
        </div>
        <div>
          <div className={styles.blankKpiNumber}>{loading ? "..." : `${confirmados} / ${total}`}</div>
          <div className={styles.blankKpiSubtext}>
            {loading ? "Cargando..." : <><strong>{confirmados} confirmados</strong> de {total} viajero{total === 1 ? "" : "s"}.</>}
          </div>
        </div>
      </div>

      {/* KPI 2: Extras */}
      <div className={styles.viajerosKpiCard}>
        <div className={styles.blankKpiHeader}>
          <span className={styles.blankKpiTitle}>Extras del Expediente</span>
          <span className={styles.blankKpiBadge}>
            {loading ? "Cargando..." : `${extrasCount.length} extra${extrasCount.length === 1 ? "" : "s"}`}
          </span>
        </div>
        {loading ? (
          <div style={{ padding: "1rem", color: "#64748b" }}>Cargando...</div>
        ) : extrasCount.length === 0 ? (
          <div style={{ padding: "1rem", color: "#64748b", background: "#f8fafc", borderRadius: "0.75rem" }}>
            Ningún viajero tiene extras asignados.
          </div>
        ) : (
          <div className={styles.progressItemsList}>
            {extrasCount.slice(0, 6).map((item, i) => (
              <div className={styles.progressItemRow} key={i}>
                <div className={styles.progressItemLabelRow}>
                  <span>{item.descripcion}</span>
                  <span className={styles.progressItemVal}>{item.count} viajero{item.count === 1 ? "" : "s"}</span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div className={styles.extrasProgressBarFill} style={{ width: `${Math.round((item.count / maxExtrasCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPI 3: Género */}
      <div className={styles.viajerosKpiCard}>
        <span className={styles.kpiCardTitle}>Distribución por Sexo</span>
        {loading ? (
          <div style={{ padding: "1rem", color: "#64748b" }}>Cargando...</div>
        ) : total === 0 ? (
          <div style={{ padding: "1rem", color: "#64748b" }}>Sin datos</div>
        ) : (
          <div className={styles.progressItemsList}>
            {[
              { label: "Femenino (F)", n: femenino, pct: pctF, bg: "linear-gradient(90deg, #ec4899 0%, #f472b6 100%)" },
              { label: "Masculino (M)", n: masculino, pct: pctM, bg: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)" },
              ...(noConsta > 0 ? [{ label: "No consta", n: noConsta, pct: pctNC, bg: "linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)" }] : []),
            ].map(({ label, n, pct, bg }) => (
              <div className={styles.progressItemRow} key={label} style={{ marginBottom: "0.25rem" }}>
                <div className={styles.progressItemLabelRow}>
                  <span>{label}</span>
                  <span className={styles.progressItemVal}>{n} ({pct}%)</span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div className={styles.progressBarFill} style={{ width: `${pct}%`, background: bg }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
