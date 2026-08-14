import { Mail, Phone, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";
import { getClientesProximosViajes } from "@/actions/dashboard";
import { formatDate } from "@/lib/utils/date";

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function soloDigitos(telefono: string) {
  return telefono.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function plazasSimuladas(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (hash % 45) + 1;
}

const EJEMPLO = [
  { id: "ej-1", nombre: "Carlos Muñoz", destino: "París", fechaSalida: addDaysISO(1), email: "carlos@example.com", telefono: "+34600111222" },
  { id: "ej-2", nombre: "Laura Gómez", destino: "Nueva York", fechaSalida: addDaysISO(2), email: "laura@example.com", telefono: "+34600333444" },
  { id: "ej-3", nombre: "Colegio San Rafael", destino: "Asturias", fechaSalida: addDaysISO(3), email: "contacto@sanrafael.es", telefono: "+34600555666" },
  { id: "ej-4", nombre: "Familia Torres", destino: "Roma", fechaSalida: addDaysISO(3), email: "torres@example.com", telefono: "+34600777888" },
  { id: "ej-5", nombre: "Ana Belén Ruiz", destino: "Lisboa", fechaSalida: addDaysISO(4), email: "anabelen@example.com", telefono: "+34600999000" },
];

export default async function ClientesProximosViajesCard() {
  const reales = await getClientesProximosViajes();
  const esEjemplo = reales.length === 0;
  const clientes = esEjemplo ? EJEMPLO : reales;

  return (
    <div className={styles.listCardCompact}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitleSentence}>
          {clientes.length} {clientes.length === 1 ? "cliente sale" : "clientes salen"} en los próximos 5 días.
        </span>
        {esEjemplo && <span className={styles.exampleTag}>Ejemplo</span>}
      </div>
      <div className={styles.listCardBody}>
        {clientes.slice(0, 5).map((c) => (
          <div key={c.id} className={styles.listCardRow3col}>
            <Link href="/contactos/clientes" className={styles.listCardRowTitle} style={{ textDecoration: "none", color: "inherit" }}>
              {c.nombre}
            </Link>
            <span className={styles.listCardRowSub}>{c.destino || "—"}</span>
            <div className={styles.listCardRowPlazas}>
              <Users size={13} color="#94a3b8" />
              <span className={styles.listCardRowAmount}>{plazasSimuladas(c.id)}</span>
            </div>
            <div className={styles.listCardRowMeta}>
              {c.fechaSalida && <span className={styles.listCardRowAmount}>{formatDate(c.fechaSalida)}</span>}
              {c.email && (
                <a href={`mailto:${c.email}`} title={c.email} className={styles.contactIconLink}>
                  <Mail size={13} />
                </a>
              )}
              {c.telefono && (
                <a href={`tel:${c.telefono}`} title={c.telefono} className={styles.contactIconLink}>
                  <Phone size={13} />
                </a>
              )}
              {c.telefono && (
                <a
                  href={`https://wa.me/${soloDigitos(c.telefono)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp"
                  className={styles.contactIconLink}
                >
                  <MessageCircle size={13} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
