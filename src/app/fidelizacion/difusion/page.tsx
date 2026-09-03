"use client";

import styles from "./page.module.css";
import { Plus, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { getDifusiones } from "@/actions/difusiones";
import NuevaDifusionModal from "@/components/modals/NuevaDifusionModal";
import DetalleDifusionModal from "@/components/modals/DetalleDifusionModal";

type Difusion = {
  id: string;
  asunto: string;
  origen: "campana" | "etiqueta" | "clientes_agente" | "difusion";
  num_destinatarios: number;
  num_enviados: number;
  num_errores: number;
  estado: "enviando" | "enviado" | "error";
  created_at: string;
  crm_campanas?: { nombre: string } | null;
  crm_etiquetas?: { nombre: string } | null;
};

const ORIGEN_LABELS: Record<Difusion["origen"], string> = {
  campana: "Campaña",
  etiqueta: "Etiqueta",
  clientes_agente: "Mis clientes",
  difusion: "Difusión",
};

const ESTADO_COLORS: Record<Difusion["estado"], { bg: string; color: string }> = {
  enviando: { bg: "#eff6ff", color: "#2563eb" },
  enviado:  { bg: "#dcfce7", color: "#16a34a" },
  error:    { bg: "#fee2e2", color: "#dc2626" },
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function origenNombre(d: Difusion) {
  if (d.origen === "campana") return d.crm_campanas?.nombre ?? "—";
  if (d.origen === "etiqueta") return d.crm_etiquetas?.nombre ?? "—";
  if (d.origen === "difusion") return "Directa";
  return "Mis clientes";
}

export default function DifusionPage() {
  const [difusiones, setDifusiones] = useState<Difusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDifusionId, setSelectedDifusionId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getDifusiones()
      .then((data) => setDifusiones(data as any[]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Difusión</h1>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>Comunicaciones enviadas</span>
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            <Plus size={14} />
            Crear difusión
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>Cargando…</div>
        ) : difusiones.length === 0 ? (
          <div className={styles.emptyState}>
            <Send size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>Todavía no se ha enviado ninguna difusión.</div>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Asunto</th>
                <th className={styles.th}>Origen</th>
                <th className={styles.th}>Destinatarios</th>
                <th className={styles.th}>Enviados</th>
                <th className={styles.th}>Estado</th>
                <th className={styles.th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {difusiones.map((d) => {
                const estadoStyle = ESTADO_COLORS[d.estado];
                return (
                  <tr
                    key={d.id}
                    className={styles.tr}
                    onClick={() => setSelectedDifusionId(d.id)}
                    style={{ cursor: "pointer" }}
                    title="Ver detalle de la difusión"
                  >
                    <td className={styles.td}>
                      <span className={styles.nombre}>{d.asunto}</span>
                    </td>
                    <td className={styles.td}>
                      {ORIGEN_LABELS[d.origen]} · {origenNombre(d)}
                    </td>
                    <td className={styles.tdCenter}>{d.num_destinatarios}</td>
                    <td className={styles.tdCenter}>{d.num_enviados}{d.num_errores > 0 ? ` (${d.num_errores} error${d.num_errores === 1 ? "" : "es"})` : ""}</td>
                    <td className={styles.td}>
                      <span className={styles.badge} style={{ background: estadoStyle.bg, color: estadoStyle.color }}>
                        {d.estado === "enviando" ? "Enviando" : d.estado === "enviado" ? "Enviado" : "Error"}
                      </span>
                    </td>
                    <td className={styles.td}>{formatFecha(d.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <NuevaDifusionModal onClose={() => setShowModal(false)} onCreated={load} />}

      {selectedDifusionId && (
        <DetalleDifusionModal
          difusionId={selectedDifusionId}
          onClose={() => setSelectedDifusionId(null)}
        />
      )}
    </div>
  );
}
