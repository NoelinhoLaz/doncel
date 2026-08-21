"use client";

import styles from "./page.module.css";
import { Plus, ClipboardList, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPlantillas } from "@/actions/encuestas";
import ModalNuevaEncuesta from "@/components/modals/ModalNuevaEncuesta";

type Plantilla = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  created_at: string;
  numPreguntas: number;
  numEnvios: number;
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function EncuestasPage() {
  const router = useRouter();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  function load() {
    setLoading(true);
    getPlantillas()
      .then((data) => setPlantillas(data as Plantilla[]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Encuestas</h1>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>Plantillas de encuesta</span>
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            <Plus size={14} />
            Nueva encuesta
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>Cargando…</div>
        ) : plantillas.length === 0 ? (
          <div className={styles.emptyState}>
            <ClipboardList size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>Todavía no has creado ninguna encuesta.</div>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Nombre</th>
                <th className={styles.th}>Preguntas</th>
                <th className={styles.th}>Envíos</th>
                <th className={styles.th}>Estado</th>
                <th className={styles.th}>Creada</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {plantillas.map((p) => (
                <tr key={p.id} className={styles.tr} onClick={() => router.push(`/fidelizacion/encuestas/${p.id}`)}>
                  <td className={styles.td}>
                    <span className={styles.nombre}>{p.nombre}</span>
                  </td>
                  <td className={styles.tdCenter}>{p.numPreguntas}</td>
                  <td className={styles.tdCenter}>{p.numEnvios}</td>
                  <td className={styles.td}>
                    <span
                      className={styles.badge}
                      style={{ background: p.activa ? "#dcfce7" : "#f1f5f9", color: p.activa ? "#16a34a" : "#64748b" }}
                    >
                      {p.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className={styles.td}>{formatFecha(p.created_at)}</td>
                  <td className={styles.tdCenter}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/portal/encuesta/preview/${p.id}`, "_blank");
                      }}
                      title="Previsualizar"
                      style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", padding: 4, display: "inline-flex" }}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <ModalNuevaEncuesta onClose={() => setShowModal(false)} onCreated={load} />}
    </div>
  );
}
