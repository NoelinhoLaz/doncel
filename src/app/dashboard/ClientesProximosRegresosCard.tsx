import { Mail, Phone, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";
import { getClientesProximosRegresos } from "@/actions/dashboard";
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
  { id: "ej-r1", nombre: "Elena Ferrer", destino: "Roma", fechaRegreso: addDaysISO(-1), email: "elena@example.com", telefono: "+34600222111" },
  { id: "ej-r2", nombre: "Grupo Cervantes", destino: "Budapest", fechaRegreso: addDaysISO(-2), email: "cervantes@example.com", telefono: "+34600444333" },
  { id: "ej-r3", nombre: "Miguel Ángel Soto", destino: "Londres", fechaRegreso: addDaysISO(-3), email: "miguelangel@example.com", telefono: "+34600666555" },
  { id: "ej-r4", nombre: "IES Dr. Marañón", destino: "Ámsterdam", fechaRegreso: addDaysISO(-4), email: "iesmaranon@example.com", telefono: "+34600888777" },
  { id: "ej-r5", nombre: "Cristina Navarro", destino: "Lisboa", fechaRegreso: addDaysISO(-5), email: "cristina@example.com", telefono: "+34601000999" },
];

export default async function ClientesProximosRegresosCard() {
  const reales = await getClientesProximosRegresos();
  const esEjemplo = reales.length === 0;
  const clientes = esEjemplo ? EJEMPLO : reales;

  return (
    <div className={styles.listCardCompact}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitleSentence}>
          {clientes.length} {clientes.length === 1 ? "cliente regresó" : "clientes regresaron"} en los últimos 5 días.
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
              {c.fechaRegreso && <span className={styles.listCardRowAmount}>{formatDate(c.fechaRegreso)}</span>}
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
