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
  obligatorioPagadoCount: number;
  obligatorioParcialCount: number;
  opcionalPagadoCount: number;
  opcionalParcialCount: number;
}

interface Props {
  kpis: Kpis;
  serviciosCount: number;
  categoriesToRender: Array<{ id: string; label: string; cost: number; percent: number; icono: string; color: string; bg: string }>;
}

export default function ServiciosKpiGrid({ kpis, serviciosCount, categoriesToRender }: Props) {
  return (
    <div className={styles.viajerosKpiGrid} style={{ marginBottom: "0.5rem" }}>
      {/* KPI 1: Coste Total */}
      <div className={styles.viajerosKpiCard} style={{ minHeight: "auto", padding: "0.6rem 0.85rem" }}>
        <div className={styles.blankKpiHeader} style={{ marginBottom: "0.15rem" }}>
          <span className={styles.blankKpiTitle}>Coste Total Servicios</span>
          <span className={styles.blankKpiBadge}>{kpis.obligatorioPercent}% Obligatorio</span>
        </div>
        <div>
          <div className={styles.blankKpiNumber} style={{ fontSize: "1.3rem" }}>
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
      <div className={styles.viajerosKpiCard} style={{ minHeight: "auto", padding: "0.6rem 0.85rem" }}>
        <span className={styles.kpiCardTitle}>Categorías de Gasto</span>
        <div style={{ display: "flex", flex: 1, alignItems: "end", justifyContent: "space-around", minHeight: "80px", padding: "0.35rem 0.5rem 0", gap: "0.5rem" }}>
          {categoriesToRender.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "#64748b", alignSelf: "center", width: "100%", textAlign: "center" }}>Sin gastos registrados</div>
          ) : categoriesToRender.map((cat, idx) => {
            const IconComponent = (LucideIcons as any)[cat.icono] || FolderPlus;
            const tones = ["80%", "60%", "40%", "20%"];
            return (
              <div key={cat.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem", flex: 1 }}
                title={`${cat.label}: ${cat.cost.toLocaleString("es-ES", { minimumFractionDigits: 0 })} € (${cat.percent}%)`}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b" }}>{cat.percent}%</span>
                <div style={{ height: "38px", display: "flex", alignItems: "end", width: "100%", justifyContent: "center" }}>
                  <div style={{ width: "80%", maxWidth: "64px", height: `${Math.max(cat.percent, 6)}%`, backgroundColor: `color-mix(in srgb, var(--primary-color, #475569), transparent ${tones[idx % tones.length]})`, borderRadius: "4px 4px 0 0", transition: "height 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                </div>
                <div style={{ width: "100%", height: "2px", backgroundColor: "#cbd5e1" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "color-mix(in srgb, var(--primary-color, #475569), transparent 88%)", color: "var(--primary-color, #475569)", marginTop: "0.2rem" }}>
                  <IconComponent size={12} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI 3: Estructura del Viaje */}
      <div className={styles.viajerosKpiCard} style={{ minHeight: "auto", padding: "0.6rem 0.85rem" }}>
        <span className={styles.kpiCardTitle}>Estructura del Viaje</span>
        <div className={styles.progressItemsList}>
          {[
            { label: "Servicios Obligatorios", count: kpis.obligatorioCount, pct: kpis.obligatorioPercent, bg: "linear-gradient(90deg, #10b981 0%, #34d399 100%)", pagado: kpis.obligatorioPagadoCount, parcial: kpis.obligatorioParcialCount },
            { label: "Servicios Opcionales", count: kpis.opcionalCount, pct: kpis.opcionalPercent, bg: "linear-gradient(90deg, #ec4899 0%, #f472b6 100%)", pagado: kpis.opcionalPagadoCount, parcial: kpis.opcionalParcialCount },
          ].map(({ label, count, pct, bg, pagado, parcial }) => (
            <div key={label} className={styles.progressItemRow} style={{ marginBottom: "0.5rem" }}>
              <div className={styles.progressItemLabelRow}>
                <span>{label}</span>
                <span className={styles.progressItemVal}>{count} ({pct}%)</span>
              </div>
              <div className={styles.progressBarContainer} style={{ height: "14px" }}>
                <div className={styles.progressBarFill} style={{ width: `${pct}%`, background: bg, height: "100%" }} />
              </div>
              <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.25rem", fontSize: "0.68rem", color: "#64748b" }}>
                <span><strong style={{ color: "#16a34a" }}>{pagado}</strong> abonados</span>
                <span><strong style={{ color: "#d97706" }}>{parcial}</strong> parciales</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
