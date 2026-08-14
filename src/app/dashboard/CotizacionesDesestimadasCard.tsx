import Link from "next/link";
import styles from "./page.module.css";
import { getCotizacionesDesestimadas } from "@/actions/dashboard";

export default async function CotizacionesDesestimadasCard() {
  const real = await getCotizacionesDesestimadas();
  const esEjemplo = real === 0;
  const desestimadas = esEjemplo ? 2 : real;

  return (
    <div className={styles.statCard}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitleSentence}>Viajes desestimados</span>
        {esEjemplo && <span className={styles.exampleTag}>Ejemplo</span>}
      </div>
      <div className={styles.statCardBody}>
        <div className={styles.statNumber}>{desestimadas}</div>
        <p className={styles.statLabel}>
          {desestimadas === 1 ? "cliente ha desestimado" : "clientes han desestimado"} el viaje. Puede que lo retomen más adelante.
        </p>
        <Link href="/cotizaciones?estado=rechazada" className={styles.ctaBtnGhost}>
          Ver detalle
        </Link>
      </div>
    </div>
  );
}
