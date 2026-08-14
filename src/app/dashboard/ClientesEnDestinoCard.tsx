import styles from "./page.module.css";
import { getClientesEnDestino } from "@/actions/dashboard";
import ClientesEnDestinoMapa from "./ClientesEnDestinoMapa";

const EJEMPLO = [
  { id: "ej-1", nombre: "Familia Ruiz", titulo: "Roma en familia", destino: "Roma", lat: 41.9028, lng: 12.4964 },
  { id: "ej-2", nombre: "Marta Iglesias", titulo: "Escapada a Lisboa", destino: "Lisboa", lat: 38.7223, lng: -9.1393 },
  { id: "ej-3", nombre: "Colegio San Rafael", titulo: "Viaje de estudios", destino: "Asturias", lat: 43.3619, lng: -5.8494 },
  { id: "ej-4", nombre: "Constructora Del Valle", titulo: "Incentivo comercial", destino: "Roma", lat: 41.9, lng: 12.5 },
  { id: "ej-5", nombre: "Ana Belén Ruiz", titulo: "Escapada romántica", destino: "París", lat: 48.8566, lng: 2.3522 },
  { id: "ej-6", nombre: "Grupo Los Olivos", titulo: "Viaje fin de curso", destino: "Salou", lat: 41.0763, lng: 1.1417 },
  { id: "ej-7", nombre: "Despacho Martínez & Asoc.", titulo: "Convención anual", destino: "Londres", lat: 51.5074, lng: -0.1278 },
  { id: "ej-8", nombre: "Pedro Sánchez López", titulo: "Vacaciones familiares", destino: "Ámsterdam", lat: 52.3676, lng: 4.9041 },
  { id: "ej-9", nombre: "IES Vega del Jarama", titulo: "Intercambio escolar", destino: "Budapest", lat: 47.4979, lng: 19.0402 },
  { id: "ej-10", nombre: "Tecnodata Solutions", titulo: "Team building", destino: "Nueva York", lat: 40.7128, lng: -74.006 },
];

export default async function ClientesEnDestinoCard() {
  const reales = await getClientesEnDestino();
  const conCoords = reales.filter((c) => c.lat != null && c.lng != null);
  const esEjemplo = conCoords.length === 0;
  const clientes = esEjemplo ? EJEMPLO : conCoords;

  const puntos = clientes.map((c) => ({
    expedienteId: c.id,
    numero: c.nombre,
    referencia: c.titulo,
    destinoNombre: c.destino || "Destino",
    lat: c.lat as number,
    lng: c.lng as number,
    estado: null,
  }));

  return (
    <div className={styles.listCard}>
      <div className={styles.listCardHeader}>
        <span className={styles.listCardTitleSentence}>
          Tienes {clientes.length} {clientes.length === 1 ? "cliente disfrutando" : "clientes disfrutando"} su viaje ahora mismo. ¿Quieres saludarlos?
        </span>
        {esEjemplo && <span className={styles.exampleTag}>Ejemplo</span>}
      </div>
      <div className={styles.listCardMapa}>
        <ClientesEnDestinoMapa puntos={puntos} />
      </div>
    </div>
  );
}
