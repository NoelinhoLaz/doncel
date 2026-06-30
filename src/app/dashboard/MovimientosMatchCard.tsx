import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentAgentePublic } from "@/actions/crm";
import styles from "./page.module.css";
import Link from "next/link";

function scoreColor(score: number) {
  if (score > 90) return { bg: "#dcfce7", color: "#15803d" };
  if (score >= 80) return { bg: "#fef9c3", color: "#a16207" };
  return { bg: "#fee2e2", color: "#dc2626" };
}

export default async function MovimientosMatchCard() {
  try {
    const [agencyDb, agente] = await Promise.all([getAgencyDbClient(), getCurrentAgentePublic()]);

    // Expedientes del usuario actual
    const isOwner = ["Owner", "SuperAdmin", "Admin"].includes(agente.rol ?? "");
    let expedientesQuery = agencyDb
      .from("operativa_expedientes")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!isOwner && agente.usuarioId) {
      expedientesQuery = expedientesQuery.eq("agente_id", agente.usuarioId) as typeof expedientesQuery;
    }
    const { data: expedientes } = await expedientesQuery;
    const expIds = new Set((expedientes ?? []).map((e: any) => e.id));

    // Movimientos con match pendiente
    const { data: movimientos } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("id, concepto_original, importe, fecha_operacion, match_score, match_metadatos, estado")
      .eq("deleted", false)
      .eq("estado", "propuesto")
      .gt("match_score", 0)
      .order("match_score", { ascending: false })
      .limit(100);

    // Filtrar solo los que apuntan a expedientes del usuario
    const filtrados = (movimientos ?? [])
      .filter((m: any) => {
        const expId = m.match_metadatos?.expediente_id;
        return expId && expIds.has(expId);
      })
      .slice(0, 8);

    return (
      <div className={styles.listCard}>
        <div className={styles.listCardHeader}>
          <span className={styles.listCardTitle}>Movimientos con match</span>
          <Link href="/banco" className={styles.listCardLink}>Ver todos →</Link>
        </div>
        <div className={styles.listCardBody}>
          {filtrados.length === 0 ? (
            <p className={styles.listCardEmpty}>No hay movimientos pendientes de conciliar.</p>
          ) : (
            filtrados.map((m: any) => {
              const score = Math.round(m.match_score ?? 0);
              const sc = scoreColor(score);
              const importe = Number(m.importe ?? 0);
              return (
                <Link key={m.id} href="/banco" className={styles.listCardRow}>
                  <div className={styles.listCardRowMain}>
                    <span className={styles.listCardRowTitle}>
                      {m.concepto_original?.slice(0, 48) || "Sin concepto"}
                    </span>
                    <span className={styles.listCardRowSub}>
                      {m.fecha_operacion ? new Date(m.fecha_operacion).toLocaleDateString("es-ES") : "—"}
                    </span>
                  </div>
                  <div className={styles.listCardRowMeta}>
                    <span className={styles.listCardRowAmount} style={{ color: importe >= 0 ? "#16a34a" : "#dc2626" }}>
                      {importe >= 0 ? "+" : ""}{importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                    </span>
                    <span className={styles.listCardBadge} style={{ background: sc.bg, color: sc.color }}>
                      {score}%
                    </span>
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
          <span className={styles.listCardTitle}>Movimientos con match</span>
        </div>
        <div className={styles.listCardBody}>
          <p className={styles.listCardEmpty}>Error al cargar movimientos.</p>
        </div>
      </div>
    );
  }
}
