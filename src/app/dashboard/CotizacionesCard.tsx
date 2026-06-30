import { getCotizaciones } from "@/actions/cotizaciones";
import styles from "./page.module.css";
import Link from "next/link";

const ESTADO_MAP: Record<string, { bg: string; color: string; label: string }> = {
  borrador:   { bg: "#f1f5f9", color: "#64748b", label: "Borrador" },
  enviada:    { bg: "#dbeafe", color: "#2563eb", label: "Enviada" },
  aceptada:   { bg: "#dcfce7", color: "#16a34a", label: "Aceptada" },
  rechazada:  { bg: "#fee2e2", color: "#dc2626", label: "Rechazada" },
};

export default async function CotizacionesCard() {
  const cotizaciones = (await getCotizaciones()) ?? [];
  const recientes = cotizaciones.slice(0, 8);

  return (
    <div className={styles.listCard}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitle}>Cotizaciones</span>
        <Link href="/cotizaciones" className={styles.listCardLink}>Ver todas →</Link>
      </div>
      <div className={styles.listCardBody}>
        {recientes.length === 0 ? (
          <p className={styles.listCardEmpty}>No hay cotizaciones todavía.</p>
        ) : (
          recientes.map((c: any) => {
            const estado = ESTADO_MAP[c.estado] ?? ESTADO_MAP.borrador;
            const entidad = c.contabilidad_entidades?.nombre ?? null;
            const totalPvp = (c.operativa_cotizacion_lineas ?? []).reduce(
              (s: number, l: any) => s + (l.total_pvp ?? 0), 0
            );
            return (
              <Link key={c.id} href="/cotizaciones" className={styles.listCardRow}>
                <div className={styles.listCardRowMain}>
                  <span className={styles.listCardRowTitle}>{c.nombre || c.titulo || "Sin título"}</span>
                  {entidad && <span className={styles.listCardRowSub}>{entidad}</span>}
                </div>
                <div className={styles.listCardRowMeta}>
                  {totalPvp > 0 && (
                    <span className={styles.listCardRowAmount}>
                      {totalPvp.toLocaleString("es-ES", { minimumFractionDigits: 0 })} €
                    </span>
                  )}
                  <span className={styles.listCardBadge} style={{ background: estado.bg, color: estado.color }}>
                    {estado.label}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
