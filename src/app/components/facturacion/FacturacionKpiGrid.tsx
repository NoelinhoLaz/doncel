"use client";

import { Icons } from "@/lib/icons";
import { formatEuro } from "@/lib/utils/currency";
import type { FacturaEmitida } from "@/actions/facturacion";
import styles from "@/app/expedientes/[id]/page.module.css";

interface Props {
  facturas: FacturaEmitida[];
}

export default function FacturacionKpiGrid({ facturas }: Props) {
  const totalEmitido = facturas.reduce((s, f) => s + f.importe_total, 0);
  const reavFacturas = facturas.filter((f) => f.regimen_iva === "REAV");
  const generalFacturas = facturas.filter((f) => f.regimen_iva === "GENERAL");
  const totalReav = reavFacturas.reduce((s, f) => s + f.importe_total, 0);
  const totalGeneral = generalFacturas.reduce((s, f) => s + f.importe_total, 0);

  const plural = (n: number) => `${n} factura${n !== 1 ? "s" : ""}`;

  return (
    <div className={styles.viajerosKpiGrid} style={{ marginBottom: "1rem" }}>
      <div className={styles.viajerosKpiCard}>
        <div className={styles.blankKpiHeader}>
          <span className={styles.blankKpiTitle}>Total Facturado</span>
          <Icons.Facturacion size={14} style={{ color: "var(--primary-color, #475569)" }} />
        </div>
        <div className={styles.blankKpiNumber}>{formatEuro(totalEmitido)}</div>
        <div className={styles.blankKpiSubtext}>{plural(facturas.length)} emitida{facturas.length !== 1 ? "s" : ""}</div>
      </div>

      <div className={styles.viajerosKpiCard}>
        <div className={styles.blankKpiHeader}>
          <span className={styles.blankKpiTitle}>Régimen REAV</span>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6366f1", background: "#eef2ff", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>REAV</span>
        </div>
        <div className={styles.blankKpiNumber}>{formatEuro(totalReav)}</div>
        <div className={styles.blankKpiSubtext}>{plural(reavFacturas.length)}</div>
      </div>

      <div className={styles.viajerosKpiCard}>
        <div className={styles.blankKpiHeader}>
          <span className={styles.blankKpiTitle}>Régimen General</span>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>GRAL</span>
        </div>
        <div className={styles.blankKpiNumber}>{formatEuro(totalGeneral)}</div>
        <div className={styles.blankKpiSubtext}>{plural(generalFacturas.length)}</div>
      </div>
    </div>
  );
}
