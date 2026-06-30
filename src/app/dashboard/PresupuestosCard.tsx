import { getPresupuestos } from "@/actions/presupuestos";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import styles from "./page.module.css";
import Link from "next/link";

const TIPO_COLORS: Record<string, { bg: string; color: string }> = {
  vacacional: { bg: "#fef3c7", color: "#b45309" },
  P2P:        { bg: "#e0e7ff", color: "#4338ca" },
  grupo:      { bg: "#d1fae5", color: "#065f46" },
};

const TIPO_LABELS: Record<string, string> = {
  vacacional: "Vacacional",
  P2P: "P2P",
  grupo: "Grupo",
};

const ESTADO_MAP: Record<string, { bg: string; color: string; label: string }> = {
  borrador:          { bg: "#f1f5f9", color: "#64748b",  label: "Borrador" },
  pendiente_cotizar: { bg: "#dbeafe", color: "#2563eb",  label: "Pdte. cotizar" },
  cotizado:          { bg: "#dcfce7", color: "#16a34a",  label: "Cotizado" },
  descartado:        { bg: "#fee2e2", color: "#dc2626",  label: "Descartado" },
};

function iniciales(nombre?: string, apellidos?: string) {
  const n = (nombre ?? "").trim().charAt(0).toUpperCase();
  const a = (apellidos ?? "").trim().charAt(0).toUpperCase();
  return `${n}${a}` || "?";
}

export default async function PresupuestosCard() {
  const presupuestos = (await getPresupuestos()) ?? [];
  const recientes = presupuestos.slice(0, 8);

  // Resolver nombres de agentes
  const agenteIds = [...new Set(recientes.map((p: any) => p.agente_id).filter(Boolean))];
  let agentesMap: Record<string, { nombre: string; apellidos: string }> = {};
  if (agenteIds.length) {
    try {
      const adminDb = createAdminServiceClient();
      const { data: usuarios } = await adminDb
        .from("usuarios")
        .select("id, auth_user_id, nombre, apellidos")
        .in("id", agenteIds);
      for (const u of usuarios ?? []) {
        agentesMap[u.id] = u;
        if (u.auth_user_id) agentesMap[u.auth_user_id] = u;
      }
    } catch {}
  }

  return (
    <div className={styles.listCard}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitle}>Solicitudes de presupuesto</span>
        <Link href="/presupuestos" className={styles.listCardLink}>Ver todas →</Link>
      </div>
      <div className={styles.listCardBody}>
        {recientes.length === 0 ? (
          <p className={styles.listCardEmpty}>No hay solicitudes todavía.</p>
        ) : (
          recientes.map((p: any) => {
            const tipo = TIPO_COLORS[p.tipo_presupuesto] ?? { bg: "#f1f5f9", color: "#64748b" };
            const estado = ESTADO_MAP[p.estado] ?? ESTADO_MAP.borrador;
            const agente = agentesMap[p.agente_id];
            return (
              <Link key={p.id} href="/presupuestos" className={styles.listCardRow}>
                <div className={styles.listCardRowMain}>
                  <span className={styles.listCardRowTitle}>{p.titulo_viaje || "Sin título"}</span>
                  {p.entidad_nombre && <span className={styles.listCardRowSub}>{p.entidad_nombre}</span>}
                </div>
                <div className={styles.listCardRowMeta}>
                  {agente && (
                    <span className={styles.listCardAvatar} title={`${agente.nombre} ${agente.apellidos}`}>
                      {iniciales(agente.nombre, agente.apellidos)}
                    </span>
                  )}
                  <span className={styles.listCardBadge} style={{ background: tipo.bg, color: tipo.color }}>
                    {TIPO_LABELS[p.tipo_presupuesto] ?? p.tipo_presupuesto}
                  </span>
                  <span className={styles.listCardBadge} style={{ background: estado.bg, color: estado.color }}>
                    {estado.label}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
