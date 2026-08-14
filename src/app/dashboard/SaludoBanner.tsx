"use client";

import styles from "./page.module.css";
import { getSaludoDelDia } from "./greetings";
import { useCopiloto } from "@/contexts/CopilotoContext";

export default function SaludoBanner({ nombre }: { nombre: string }) {
  const { open: openCopiloto } = useCopiloto();
  const saludo = getSaludoDelDia(nombre);

  return (
    <div className={styles.saludoBanner}>
      <div className={styles.saludoContent}>
        <p className={styles.saludoGreeting}>
          {saludo.before}
          <span className={styles.saludoNombre}>{saludo.nombre}</span>
          {saludo.after} Si necesitas algo al respecto, solicítamelo.
        </p>
      </div>
      <button className={styles.saludoBtn} onClick={openCopiloto}>
        <img src="/alivia_icon_on.png" alt="Alivia" width={16} height={16} />
        ¡¡Pregúntame!! Estoy para ayudarte
      </button>
    </div>
  );
}
