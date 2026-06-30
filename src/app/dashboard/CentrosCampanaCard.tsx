import { getCampanas } from "@/actions/crm";
import { getAgencyDbClient } from "@/lib/agencyDb";
import styles from "./page.module.css";
import Link from "next/link";

const ESTADOS_EXCLUIDOS = ["pdt. visitar", "aceptado", "denegado", "imp. cotizar"];

function matchExcluido(nombre: string) {
  const n = nombre.toLowerCase().trim();
  return ESTADOS_EXCLUIDOS.some(e => n.includes(e) || e.includes(n));
}

export default async function CentrosCampanaCard() {
  try {
    const campanas = await getCampanas();
    const hoy = new Date().toISOString().slice(0, 10);

    // Campaña cuya fecha_inicio <= hoy <= fecha_fin
    const activa = campanas.find((c: any) =>
      c.fecha_inicio && c.fecha_fin &&
      c.fecha_inicio <= hoy && c.fecha_fin >= hoy
    ) ?? null;

    if (!activa) {
      return (
        <div className={styles.listCard}>
          <div className={styles.listCardHeader}>
            <span className={styles.listCardTitle}>Centros campaña activa</span>
          </div>
          <div className={styles.listCardBody}>
            <p className={styles.listCardEmpty}>No hay campañas activas.</p>
          </div>
        </div>
      );
    }

    // Estados válidos (excluir los indicados)
    const estadosValidos: any[] = (activa.crm_campanas_estados ?? []).filter(
      (e: any) => !matchExcluido(e.nombre)
    );
    const estadosValidosIds = new Set(estadosValidos.map((e: any) => e.id));

    // Cargar oportunidades completas de la campaña
    const agencyDb = await getAgencyDbClient();
    const { data: ops } = await agencyDb
      .from("crm_oportunidades")
      .select("id, titulo, estado_id, entidad_id, valor_estimado, contabilidad_entidades!entidad_id(nombre)")
      .eq("campana_id", activa.id)
      .in("estado_id", [...estadosValidosIds])
      .order("valor_estimado", { ascending: false })
      .limit(10);

    const estadoMap = Object.fromEntries(
      (activa.crm_campanas_estados ?? []).map((e: any) => [e.id, e])
    );

    return (
      <div className={styles.listCard}>
        <div className={styles.listCardHeader}>
          <span className={styles.listCardTitle}>{activa.nombre}</span>
          <Link href={`/campanas/${activa.id}`} className={styles.listCardLink}>Ver campaña →</Link>
        </div>
        <div className={styles.listCardBody}>
          {!ops || ops.length === 0 ? (
            <p className={styles.listCardEmpty}>No hay oportunidades activas.</p>
          ) : (
            ops.map((o: any) => {
              const estado = estadoMap[o.estado_id];
              const entidad = (o.contabilidad_entidades as any)?.nombre ?? null;
              return (
                <Link key={o.id} href={`/campanas/${activa.id}`} className={styles.listCardRow}>
                  <div className={styles.listCardRowMain}>
                    <span className={styles.listCardRowTitle}>{o.titulo || entidad || "Sin título"}</span>
                    {entidad && o.titulo && <span className={styles.listCardRowSub}>{entidad}</span>}
                  </div>
                  <div className={styles.listCardRowMeta}>
                    {o.valor_estimado > 0 && (
                      <span className={styles.listCardRowAmount}>
                        {Number(o.valor_estimado).toLocaleString("es-ES")} €
                      </span>
                    )}
                    {estado && (
                      <span className={styles.listCardBadge} style={{ background: estado.color + "22", color: estado.color }}>
                        {estado.nombre}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    );
  } catch {
    return (
      <div className={styles.listCard}>
        <div className={styles.listCardHeader}>
          <span className={styles.listCardTitle}>Centros campaña activa</span>
        </div>
        <div className={styles.listCardBody}>
          <p className={styles.listCardEmpty}>Error al cargar datos.</p>
        </div>
      </div>
    );
  }
}
