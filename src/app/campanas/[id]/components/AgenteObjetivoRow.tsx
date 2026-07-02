"use client";

import { AgenteObjetivo, Oportunidad } from "../types";
import styles from "../page.module.css";
import { initials } from "../utils";

export function AgenteObjetivoRow({ agente, oportunidades }: { agente: AgenteObjetivo; oportunidades: Oportunidad[] }) {
  const misOps = oportunidades.filter(o => o.agente_id === agente.agente_id);
  const valorActual = misOps.reduce((s, o) => s + o.valor_estimado, 0);
  const pct = agente.objetivo_valor ? Math.min(Math.round((valorActual / agente.objetivo_valor) * 100), 100) : null;
  const ag = agente.crm_agentes;
  if (!ag) return null;

  return (
    <div className={styles.agenteRow}>
      <div className={styles.agenteAvatarLg}>{initials(ag.nombre, ag.apellidos)}</div>
      <div className={styles.agenteInfo}>
        <span className={styles.agenteNombre}>{ag.nombre} {ag.apellidos}</span>
        <div className={styles.agenteProgress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${pct ?? 0}%` }} />
          </div>
          <span className={styles.progressLabel}>
            {valorActual.toLocaleString("es-ES")} €
            {agente.objetivo_valor ? ` / ${agente.objetivo_valor.toLocaleString("es-ES")} €` : ""}
            {pct !== null ? ` · ${pct}%` : ""}
          </span>
        </div>
      </div>
      <span className={styles.agenteCount}>{misOps.length} oport.</span>
    </div>
  );
}
