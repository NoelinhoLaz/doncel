import Link from "next/link";
import styles from "./page.module.css";
import { getCotizacionesEntregadas } from "@/actions/dashboard";

export default async function ItinerariosEntregadosCard() {
  const real = await getCotizacionesEntregadas();
  const esEjemplo = real === 0;
  const entregados = esEjemplo ? 12 : real;

  return (
    <div className={styles.statCard}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitleSentence}>Itinerarios entregados</span>
        {esEjemplo && <span className={styles.exampleTag}>Ejemplo</span>}
      </div>
      <div className={styles.statCardBody}>
        <div className={styles.statNumber}>{entregados}</div>
        <p className={styles.statLabel}>
          {entregados === 1 ? "itinerario entregado" : "itinerarios entregados"} en los últimos 15 días
        </p>
        <Link href="/cotizaciones?estado=presentada" className={styles.ctaBtn}>
          Seguimiento
        </Link>
      </div>
    </div>
  );
}
