"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function WelcomeCard({ nombre }: { nombre: string }) {
  const [query, setQuery] = useState("");

  return (
    <div className={styles.welcomeCard}>
      <div className={styles.welcomeContent}>
        <p className={styles.welcomeGreeting}>Hola, {nombre} 👋</p>
        <p className={styles.welcomeSub}>¿Con qué quieres empezar hoy?</p>
        <div className={styles.welcomeInputWrapper}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe algo…"
            className={styles.welcomeInput}
          />
          <button className={styles.welcomeBtn} disabled={!query.trim()}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}
