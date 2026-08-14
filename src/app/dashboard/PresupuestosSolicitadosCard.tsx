import Link from "next/link";
import styles from "./page.module.css";
import { getPresupuestosResumen } from "@/actions/dashboard";

export default async function PresupuestosSolicitadosCard() {
  const real = await getPresupuestosResumen();
  const esEjemplo = real.solicitados === 0;
  const { solicitados, confirmados } = esEjemplo ? { solicitados: 25, confirmados: 4 } : real;

  return (
    <div className={styles.statCard}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitleSentence}>Presupuestos</span>
        {esEjemplo && <span className={styles.exampleTag}>Ejemplo</span>}
      </div>
      <div className={styles.statCardBody}>
        <div className={styles.statNumber}>{solicitados}</div>
        <p className={styles.statLabel}>
          {solicitados === 1 ? "solicitud conseguida" : "solicitudes conseguidas"} en los últimos 15 días
        </p>
        {confirmados > 0 && (
          <p className={styles.statHighlight}>
            ¡Tienes {confirmados} {confirmados === 1 ? "confirmado" : "confirmados"}!
          </p>
        )}
        <Link href="/presupuestos" className={styles.ctaBtn}>
          Acceder
        </Link>
      </div>
    </div>
  );
}
