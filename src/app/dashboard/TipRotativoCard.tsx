"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import styles from "./page.module.css";

const TIPS = [
  { destacado: "Relaciónate", resto: ": dedica cada día un momento a saludar a un cliente sin pedir nada a cambio." },
  { destacado: "Ofrece", resto: ": cuando surja la ocasión, propón algo a medida antes de que te lo pidan." },
  { destacado: "Ilusiona", resto: ": cuenta el viaje como una experiencia, no como un itinerario." },
  { destacado: "Haz seguimiento cercano", resto: ": un mensaje a tiempo vale más que diez después." },
];

export default function TipRotativoCard() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % TIPS.length);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div key={index} className={styles.tipCard}>
      <Lightbulb size={28} className={styles.tipIcon} />
      <p className={styles.tipText}>
        <span className={styles.tipDestacado}>{TIPS[index].destacado}</span>
        {TIPS[index].resto}
      </p>
    </div>
  );
}
