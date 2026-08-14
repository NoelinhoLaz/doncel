import styles from "./page.module.css";

const EJEMPLO = {
  anioActual: new Date().getFullYear(),
  anioAnterior: new Date().getFullYear() - 1,
  clientesActual: 84,
  clientesAnterior: 61,
  presupuestosActual: 47,
  presupuestosAnterior: 35,
};

export default function ClientesNuevosPresupuestosCard() {
  const esEjemplo = true;
  const data = EJEMPLO;

  const max = Math.max(
    data.clientesActual,
    data.clientesAnterior,
    data.presupuestosActual,
    data.presupuestosAnterior,
    1
  );

  const grupos = [
    { anio: data.anioAnterior, clientes: data.clientesAnterior, presupuestos: data.presupuestosAnterior },
    { anio: data.anioActual, clientes: data.clientesActual, presupuestos: data.presupuestosActual },
  ];

  return (
    <div className={styles.pautasCard}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitleSentence}>Clientes nuevos / Presupuestos aceptados</span>
        {esEjemplo && <span className={styles.exampleTag}>Ejemplo</span>}
      </div>
      <div className={styles.pautasBody}>
        <div className={styles.chartLegend}>
          <span className={styles.chartLegendItem}>
            <span className={styles.chartLegendDotActual} /> Clientes nuevos
          </span>
          <span className={styles.chartLegendItem}>
            <span className={styles.chartLegendDotAnterior} /> Presupuestos aceptados
          </span>
        </div>
        <div className={styles.chartBarsYears}>
          {grupos.map((g, i) => (
            <div key={g.anio} className={`${styles.chartYearGroup} ${i === 0 ? styles.chartYearGroupPast : ""}`}>
              <div className={styles.chartBarPairYears}>
                <div className={styles.chartYearBarWrapper} title={`Clientes nuevos ${g.anio}: ${g.clientes}`}>
                  <span className={styles.chartYearBarValue}>{g.clientes}</span>
                  <div className={styles.chartBarActualYear} style={{ height: `${(g.clientes / max) * 100}%` }} />
                </div>
                <div className={styles.chartYearBarWrapper} title={`Presupuestos aceptados ${g.anio}: ${g.presupuestos}`}>
                  <span className={styles.chartYearBarValue}>{g.presupuestos}</span>
                  <div className={styles.chartBarAnteriorYear} style={{ height: `${(g.presupuestos / max) * 100}%` }} />
                </div>
              </div>
              <span className={styles.chartYearLabel}>{g.anio}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
