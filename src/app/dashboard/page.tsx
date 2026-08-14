import styles from "./page.module.css";
import { getCurrentUsuario } from "@/actions/usuarios";
import SaludoBanner from "./SaludoBanner";
import ClientesNuevosPresupuestosCard from "./ClientesNuevosPresupuestosCard";
import TipRotativoCard from "./TipRotativoCard";
import AccionesRapidasCard from "./AccionesRapidasCard";
import PotencialCampanasCard from "./PotencialCampanasCard";
import ClientesEnDestinoCard from "./ClientesEnDestinoCard";
import ClientesProximosViajesCard from "./ClientesProximosViajesCard";
import ClientesProximosRegresosCard from "./ClientesProximosRegresosCard";
import PresupuestosSolicitadosCard from "./PresupuestosSolicitadosCard";
import ItinerariosEntregadosCard from "./ItinerariosEntregadosCard";
import CotizacionesDesestimadasCard from "./CotizacionesDesestimadasCard";
import PendientesEntregaCard from "./PendientesEntregaCard";

export default async function DashboardPage() {
  const usuario = await getCurrentUsuario();
  const nombre = usuario?.nombre ?? "";

  return (
    <div className={styles.pageOuter}>
      <SaludoBanner nombre={nombre} />

      <div className={styles.page}>
        <div className={styles.main}>
          <PotencialCampanasCard />

          <div className={styles.rowTwo}>
            <ClientesEnDestinoCard />
            <div className={styles.stackedColumn}>
              <ClientesProximosViajesCard />
              <ClientesProximosRegresosCard />
            </div>
          </div>

          <div className={styles.rowThree}>
            <PresupuestosSolicitadosCard />
            <ItinerariosEntregadosCard />
            <CotizacionesDesestimadasCard />
          </div>

          <PendientesEntregaCard />
        </div>

        <aside className={styles.sidebar}>
          <ClientesNuevosPresupuestosCard />
          <TipRotativoCard />
          <AccionesRapidasCard />
        </aside>
      </div>
    </div>
  );
}
