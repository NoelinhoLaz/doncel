"use client";

import styles from "./page.module.css";
import { Plus, Send, Mail, CheckCircle, Eye, AlertTriangle, TrendingUp, Search, User, Filter, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { getDifusiones, getMetricasDifusiones, eliminarDifusion } from "@/actions/difusiones";
import { getCurrentUsuario } from "@/actions/usuarios";
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
  crm_agentes?: { id: string; nombre: string; apellidos?: string | null; avatar_url?: string | null } | null;
};

type Metricas = {
  totalDifusiones: number;
  totalDestinatarios: number;
  totalEnviados: number;
  totalErrores: number;
  totalAbiertos: number;
  tasaEntrega: number;
  tasaApertura: number;
  enviadosEsteMes: number;
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
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function origenNombre(d: Difusion) {
  if (d.origen === "campana") return d.crm_campanas?.nombre ?? "—";
  if (d.origen === "etiqueta") return d.crm_etiquetas?.nombre ?? "—";
  if (d.origen === "difusion") return "Directa";
  return "Mis clientes";
}

function emisorNombre(agente?: Difusion["crm_agentes"]) {
  if (!agente) return "—";
  return `${agente.nombre} ${agente.apellidos ?? ""}`.trim();
}

export default function DifusionPage() {
  const [difusiones, setDifusiones] = useState<Difusion[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [search, setSearch] = useState("");
  const [agenteFiltro, setAgenteFiltro] = useState<string>("todos");
  const [showModal, setShowModal] = useState(false);
  const [selectedDifusionId, setSelectedDifusionId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      getDifusiones(),
      getMetricasDifusiones().catch(() => null),
    ])
      .then(([data, kpis]) => {
        setDifusiones((data as any[]) ?? []);
        if (kpis) setMetricas(kpis);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    getCurrentUsuario()
      .then((u) => {
        if (u?.rol === "owner" || u?.rol === "superadmin") {
          setIsOwner(true);
        }
      })
      .catch(() => {});
  }, []);

  async function handleDelete(d: Difusion) {
    const ok = window.confirm(`¿Estás seguro de que deseas eliminar la difusión "${d.asunto}"? Esta acción borrará su historial de envíos.`);
    if (!ok) return;
    try {
      const res = await eliminarDifusion(d.id);
      if (res.success) {
        load();
      } else {
        alert(res.error || "Error al eliminar difusión.");
      }
    } catch (err: any) {
      alert(err.message || "Error al eliminar difusión.");
    }
  }

  const agentesDisponibles = useMemo(() => {
    const s = new Set<string>();
    difusiones.forEach((d) => {
      const n = emisorNombre(d.crm_agentes);
      if (n !== "—") s.add(n);
    });
    return Array.from(s).sort();
  }, [difusiones]);

  const filtradas = useMemo(() => {
    return difusiones.filter((d) => {
      const q = search.toLowerCase().trim();
      const emisor = emisorNombre(d.crm_agentes);
      if (agenteFiltro !== "todos" && emisor !== agenteFiltro) return false;
      if (!q) return true;
      return (
        d.asunto.toLowerCase().includes(q) ||
        emisor.toLowerCase().includes(q) ||
        origenNombre(d).toLowerCase().includes(q)
      );
    });
  }, [difusiones, search, agenteFiltro]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Difusión</h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
            Control de envíos masivos, tracking de aperturas y comunicaciones.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          <Plus size={15} />
          Crear difusión
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "0.85rem",
            border: "1px solid #f1f5f9",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Total Difusiones
            </span>
            <span style={{ padding: 6, borderRadius: 8, background: "#f8fafc", color: "#6366f1" }}>
              <Send size={15} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "#0f172a" }}>
            {metricas ? metricas.totalDifusiones : "—"}
          </div>
          <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
            {metricas ? `${metricas.enviadosEsteMes} emails enviados este mes` : "Cargando…"}
          </span>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "0.85rem",
            border: "1px solid #f1f5f9",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Tasa de Entrega
            </span>
            <span style={{ padding: 6, borderRadius: 8, background: "#f0fdf4", color: "#16a34a" }}>
              <CheckCircle size={15} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "#16a34a" }}>
            {metricas ? `${metricas.tasaEntrega}%` : "—"}
          </div>
          <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
            {metricas ? `${metricas.totalEnviados} entregados (${metricas.totalErrores} errores)` : "Cargando…"}
          </span>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "0.85rem",
            border: "1px solid #f1f5f9",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Tasa de Apertura
            </span>
            <span style={{ padding: 6, borderRadius: 8, background: "#eff6ff", color: "#2563eb" }}>
              <Eye size={15} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "#2563eb" }}>
            {metricas ? `${metricas.tasaApertura}%` : "—"}
          </div>
          <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
            {metricas ? `${metricas.totalAbiertos} aperturas registradas` : "Tracking en tiempo real"}
          </span>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "0.85rem",
            border: "1px solid #f1f5f9",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Destinatarios Totales
            </span>
            <span style={{ padding: 6, borderRadius: 8, background: "#fdf4ff", color: "#9333ea" }}>
              <TrendingUp size={15} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "#0f172a" }}>
            {metricas ? metricas.totalDestinatarios : "—"}
          </div>
          <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
            Contactos alcanzados por difusiones
          </span>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader} style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 260 }}>
            <span className={styles.tableTitle}>Historial de difusiones</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0.3rem 0.6rem",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: "#fff",
                fontSize: "0.78rem",
                flex: 1,
                maxWidth: 320,
              }}
            >
              <Search size={13} style={{ color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Buscar por asunto, emisor u origen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: "0.78rem", width: "100%", color: "#1e293b" }}
              />
            </div>
          </div>

          {agentesDisponibles.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={13} style={{ color: "#94a3b8" }} />
              <select
                value={agenteFiltro}
                onChange={(e) => setAgenteFiltro(e.target.value)}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  fontSize: "0.78rem",
                  color: "#334155",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="todos">Todos los emisores</option>
                {agentesDisponibles.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className={styles.emptyState}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div className={styles.emptyState}>
            <Send size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>
              {difusiones.length === 0
                ? "Todavía no se ha enviado ninguna difusión."
                : "No se encontraron difusiones que coincidan con la búsqueda."}
            </div>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Asunto</th>
                <th className={styles.th}>Emisor</th>
                <th className={styles.th}>Origen</th>
                <th className={styles.th}>Destinatarios</th>
                <th className={styles.th}>Enviados</th>
                <th className={styles.th}>Estado</th>
                <th className={styles.th}>Fecha</th>
                {isOwner && <th className={styles.th} style={{ width: 44, textAlign: "center" }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => {
                const estadoStyle = ESTADO_COLORS[d.estado];
                const emisor = emisorNombre(d.crm_agentes);
                return (
                  <tr
                    key={d.id}
                    className={styles.tr}
                    onClick={() => setSelectedDifusionId(d.id)}
                    style={{ cursor: "pointer" }}
                    title="Ver detalle y métricas de apertura"
                  >
                    <td className={styles.td}>
                      <span className={styles.nombre}>{d.asunto}</span>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "#e0e7ff",
                            color: "#4338ca",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {emisor !== "—" ? emisor.charAt(0).toUpperCase() : "?"}
                        </span>
                        <span style={{ fontWeight: 500, color: "#1e293b" }}>{emisor}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      {ORIGEN_LABELS[d.origen]} · {origenNombre(d)}
                    </td>
                    <td className={styles.tdCenter}>{d.num_destinatarios}</td>
                    <td className={styles.tdCenter}>
                      {d.num_enviados}
                      {d.num_errores > 0 ? (
                        <span style={{ color: "#dc2626", marginLeft: 4 }}>
                          ({d.num_errores} error{d.num_errores === 1 ? "" : "es"})
                        </span>
                      ) : null}
                    </td>
                    <td className={styles.td}>
                      <span className={styles.badge} style={{ background: estadoStyle.bg, color: estadoStyle.color }}>
                        {d.estado === "enviando" ? "Enviando" : d.estado === "enviado" ? "Enviado" : "Error"}
                      </span>
                    </td>
                    <td className={styles.td}>{formatFecha(d.created_at)}</td>
                    {isOwner && (
                      <td
                        className={styles.tdCenter}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(d);
                        }}
                      >
                        <button
                          type="button"
                          title="Eliminar difusión"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#94a3b8",
                            cursor: "pointer",
                            padding: "4px 6px",
                            borderRadius: 4,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
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
          isOwner={isOwner}
          onDeleted={load}
          onClose={() => setSelectedDifusionId(null)}
        />
      )}
    </div>
  );
}
