import { Target } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";
import { getPotencialCampanasResumen, getClientesStats } from "@/actions/dashboard";

const EJEMPLO = { objetivoValor: 48000, conseguidoValor: 31200, campanasActivas: 3, oportunidadesAbiertas: 14 };
const EJEMPLO_STATS = { total: 600, conEmail: 350, conWhatsapp: 380 };

function formatEuros(n: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(n);
}

export default async function PotencialCampanasCard() {
  const [real, statsReal] = await Promise.all([getPotencialCampanasResumen(), getClientesStats()]);
  const esEjemplo = real.objetivoValor === 0;
  const { objetivoValor, conseguidoValor, campanasActivas, oportunidadesAbiertas } = esEjemplo ? EJEMPLO : real;
  const stats = statsReal.total === 0 ? EJEMPLO_STATS : statsReal;
  const progreso = objetivoValor > 0 ? Math.min(100, Math.round((conseguidoValor / objetivoValor) * 100)) : 0;

  return (
    <div className={styles.radarCard}>
      <Target size={190} className={styles.radarCardIcon} strokeWidth={1} />
      <div className={styles.radarCardHeader}>
        <span className={styles.radarCardTitle}>Tu potencial en campañas</span>
        {esEjemplo && <span className={styles.exampleTagLight}>Ejemplo</span>}
      </div>
      <div className={styles.radarCardBody}>
        <div className={styles.radarCardStat}>
          <div className={styles.radarCardNumber}>{formatEuros(conseguidoValor)} €</div>
          <p className={styles.radarCardLabel}>conseguidos de {formatEuros(objetivoValor)} € de objetivo</p>
          <div className={styles.radarCardBar}>
            <div className={styles.radarCardBarFill} style={{ width: `${progreso}%` }} />
          </div>
        </div>
        <div className={styles.radarCardMeta}>
          <div>
            <div className={styles.radarCardMetaNumber}>{campanasActivas}</div>
            <p className={styles.radarCardLabel}>{campanasActivas === 1 ? "campaña activa" : "campañas activas"}</p>
          </div>
          <div>
            <div className={styles.radarCardMetaNumber}>{oportunidadesAbiertas}</div>
            <p className={styles.radarCardLabel}>oportunidades abiertas</p>
          </div>
          <div>
            <div className={styles.radarCardMetaNumber}>{stats.total}</div>
            <p className={styles.radarCardLabel}>clientes en tu cartera</p>
          </div>
        </div>
        <Link href="/campanas" className={styles.radarCardCta}>
          Ver campañas
        </Link>
      </div>
    </div>
  );
}
