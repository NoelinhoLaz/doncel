"use client";

import dynamic from "next/dynamic";
import styles from "./page.module.css";

const MapComponent = dynamic(() => import("../expedientes/MapComponent"), {
  ssr: false,
  loading: () => <div className={styles.mapaLoading}>Cargando mapa...</div>,
});

interface Punto {
  expedienteId: string;
  numero: string;
  referencia: string;
  destinoNombre: string;
  lat: number;
  lng: number;
  estado: string | null;
}

export default function ClientesEnDestinoMapa({ puntos }: { puntos: Punto[] }) {
  return <MapComponent puntos={puntos} />;
}
