"use client";

import * as LucideIcons from "lucide-react";
import { FolderPlus } from "lucide-react";
import styles from "@/app/expedientes/shared.module.css";

interface Kpis {
  totalCost: number;
  obligatorioCost: number;
  opcionalCost: number;
  obligatorioCount: number;
  opcionalCount: number;
  obligatorioPercent: number;
  opcionalPercent: number;
}

interface Props {
  kpis: Kpis;
  serviciosCount: number;
  categoriesToRender: Array<{ id: string; label: string; cost: number; percent: number; icono: string; color: string; bg: string }>;
}

export default function ServiciosKpiGrid({ kpis, serviciosCount, categoriesToRender }: Props) {
  return (
    <div className={styles.viajerosKpiGrid}>
      {/* KPI 1: Coste Total */}
      <div className={styles.viajerosKpiCard}>
        <div className={styles.blankKpiHeader}>
          <span className={styles.blankKpiTitle}>Coste Total Servicios</span>
          <span className={styles.blankKpiBadge}>{kpis.obligatorioPercent}% Obligatorio</span>
        </div>
        <div>
          <div className={styles.blankKpiNumber}>
            {kpis.totalCost.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
          </div>
          <div className={styles.blankKpiSubtext}>
            <strong>{kpis.obligatorioCost.toLocaleString("es-ES", { minimumFractionDigits: 2 })} € obligatorios</strong>,{" "}
            {kpis.opcionalCost.toLocaleString("es-ES", { minimumFractionDigits: 2 })} € opcionales.
            Total de {serviciosCount} servicios contratados.
          </div>
        </div>
      </div>

      {/* KPI 2: Categorías de Gasto (barras) */}
      <div className={styles.viajerosKpiCard}>
        <span className={styles.kpiCardTitle}>Categorías de Gasto</span>
        <div style={{ display: "flex", flex: 1, alignItems: "end", justifyContent: "space-around", minHeight: "135px", padding: "0.5rem 0.5rem 0", gap: "0.5rem" }}>
          {categoriesToRender.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "#64748b", alignSelf: "center", width: "100%", textAlign: "center" }}>Sin gastos registrados</div>
          ) : categoriesToRender.map((cat, idx) => {
            const IconComponent = (LucideIcons as any)[cat.icono] || FolderPlus;
            const tones = ["80%", "60%", "40%", "20%"];
            return (
              <div key={cat.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", flex: 1 }}
                title={`${cat.label}: ${cat.cost.toLocaleString("es-ES", { minimumFractionDigits: 0 })} € (${cat.percent}%)`}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b" }}>{cat.percent}%</span>
                <div style={{ height: "70px", display: "flex", alignItems: "end", width: "100%", justifyContent: "center" }}>
                  <div style={{ width: "80%", maxWidth: "64px", height: `${Math.max(cat.percent, 6)}%`, backgroundColor: `color-mix(in srgb, var(--primary-color, #475569), transparent ${tones[idx % tones.length]})`, borderRadius: "4px 4px 0 0", transition: "height 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                </div>
                <div style={{ width: "100%", height: "2px", backgroundColor: "#cbd5e1" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "color-mix(in srgb, var(--primary-color, #475569), transparent 88%)", color: "var(--primary-color, #475569)", marginTop: "0.25rem" }}>
                  <IconComponent size={13} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI 3: Estructura del Viaje */}
      <div className={styles.viajerosKpiCard}>
        <span className={styles.kpiCardTitle}>Estructura del Viaje</span>
        <div className={styles.progressItemsList}>
          {[
            { label: "Servicios Obligatorios", count: kpis.obligatorioCount, pct: kpis.obligatorioPercent, bg: "linear-gradient(90deg, #10b981 0%, #34d399 100%)" },
            { label: "Servicios Opcionales", count: kpis.opcionalCount, pct: kpis.opcionalPercent, bg: "linear-gradient(90deg, #ec4899 0%, #f472b6 100%)" },
          ].map(({ label, count, pct, bg }) => (
            <div key={label} className={styles.progressItemRow} style={{ marginBottom: "0.25rem" }}>
              <div className={styles.progressItemLabelRow}>
                <span>{label}</span>
                <span className={styles.progressItemVal}>{count} ({pct}%)</span>
              </div>
              <div className={styles.progressBarContainer}>
                <div className={styles.progressBarFill} style={{ width: `${pct}%`, background: bg }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
