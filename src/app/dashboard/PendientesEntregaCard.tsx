import Link from "next/link";
import styles from "./page.module.css";
import { getCotizacionesPendientesEntrega } from "@/actions/dashboard";

export default async function PendientesEntregaCard() {
  const real = await getCotizacionesPendientesEntrega();
  const esEjemplo = real.total === 0;
  const { total, hace1Dia, entre2y3Dias, masDe3Dias } = esEjemplo
    ? { total: 7, hace1Dia: 4, entre2y3Dias: 2, masDe3Dias: 1 }
    : real;

  return (
    <div className={styles.mutedCard}>
      <div className={styles.mutedCardHeader}>
        <div className={styles.listCardRowMeta}>
          <span className={styles.mutedCardTitle}>Pendiente de tu atención</span>
          {esEjemplo && <span className={styles.exampleTag}>Ejemplo</span>}
        </div>
        <Link href="/cotizaciones?estado=borrador" className={styles.ctaBtnGhost}>
          Ver todos
        </Link>
      </div>
      <p className={styles.mutedCardIntro}>
        Tienes {total} {total === 1 ? "itinerario" : "itinerarios"} por entregar.
      </p>
      <div className={styles.mutedCardBuckets}>
        {hace1Dia > 0 && (
          <span className={styles.mutedCardBucket}>{hace1Dia} hace 1 día</span>
        )}
        {entre2y3Dias > 0 && (
          <span className={styles.mutedCardBucket}>{entre2y3Dias} entre 2-3 días</span>
        )}
        {masDe3Dias > 0 && (
          <span className={styles.mutedCardBucketWarn}>{masDe3Dias} hace más de 3 días</span>
        )}
      </div>
    </div>
  );
}
