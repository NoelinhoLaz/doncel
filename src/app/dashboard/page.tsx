import styles from "./page.module.css";
import { getCurrentUsuario } from "@/actions/usuarios";
import WelcomeCard from "./WelcomeCard";
import PresupuestosCard from "./PresupuestosCard";
import CotizacionesCard from "./CotizacionesCard";
import MovimientosMatchCard from "./MovimientosMatchCard";
import CentrosCampanaCard from "./CentrosCampanaCard";

export default async function DashboardPage() {
  const usuario = await getCurrentUsuario();
  const nombre = usuario?.nombre ?? "there";

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Dashboard</h1>
      <div className={styles.grid}>
        <PresupuestosCard />
        <CentrosCampanaCard />
        <div className={styles.topCard}><span className={styles.topCardNum}>3</span></div>

        <CotizacionesCard />
        <WelcomeCard nombre={nombre} />
        <MovimientosMatchCard />

        <div className={styles.topCard}><span className={styles.topCardNum}>7</span></div>
        <div className={styles.topCard}><span className={styles.topCardNum}>8</span></div>
        <div className={styles.topCard}><span className={styles.topCardNum}>9</span></div>

        <div className={styles.topCard}><span className={styles.topCardNum}>10</span></div>
        <div className={styles.topCard}><span className={styles.topCardNum}>11</span></div>
        <div className={styles.topCard}><span className={styles.topCardNum}>12</span></div>
      </div>
    </div>
  );
}
