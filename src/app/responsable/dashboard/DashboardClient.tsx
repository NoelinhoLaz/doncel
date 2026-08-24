"use client";

import { useState } from "react";
import styles from "./page.module.css";
import ViajeroForm from "./ViajeroForm";
import type { ResponsableViajero } from "@/actions/responsable";

type Expediente = {
  id: string;
  numero: string;
  referencia: string;
  destino: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
};

interface Props {
  expediente: Expediente;
  initialViajeros: ResponsableViajero[];
}

export default function DashboardClient({ expediente, initialViajeros }: Props) {
  const [viajeros, setViajeros] = useState(initialViajeros);
  const [editando, setEditando] = useState<ResponsableViajero | null | "nuevo">(null);

  function upsertLocal(v: ResponsableViajero) {
    setViajeros((prev) => {
      const idx = prev.findIndex((p) => p.id === v.id);
      if (idx === -1) return [...prev, v];
      const next = [...prev];
      next[idx] = v;
      return next;
    });
  }

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>{expediente.referencia || expediente.numero}</h1>
          <p className={styles.headerSubtitle}>
            {expediente.destino && `${expediente.destino} · `}
            {expediente.fechaInicio} {expediente.fechaFin && `— ${expediente.fechaFin}`}
          </p>
        </div>
        <a href="/api/responsable/logout" className={styles.logoutLink}>
          Cerrar sesión
        </a>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Viajeros ({viajeros.length})</span>
          <button className={styles.addButton} onClick={() => setEditando("nuevo")}>
            + Añadir viajero
          </button>
        </div>

        {viajeros.length === 0 && <p className={styles.empty}>Todavía no hay viajeros en este expediente.</p>}

        {viajeros.map((v) => (
          <div key={v.id} className={styles.viajeroRow}>
            <div className={styles.viajeroInfo}>
              <span className={styles.viajeroNombre}>
                {v.nombre} {v.apellidos}
              </span>
              <span className={styles.viajeroMeta}>
                {v.documento || "Sin documento"}
                {v.email && ` · ${v.email}`}
              </span>
            </div>
            <div className={styles.rowActions}>
              {v.estado && <span className={styles.badge}>{v.estado}</span>}
              <button className={styles.iconButton} onClick={() => setEditando(v)}>
                Editar
              </button>
            </div>
          </div>
        ))}
      </section>

      {editando && (
        <ViajeroForm
          viajero={editando === "nuevo" ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={(v) => {
            upsertLocal(v);
            setEditando(null);
          }}
        />
      )}
    </main>
  );
}
