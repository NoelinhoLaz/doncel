"use client";

import { useEffect, useState } from "react";
import { X, Mail, CheckCircle2, XCircle, Clock, Search, Send, User, Eye, EyeOff } from "lucide-react";
import { getDifusionDetalle } from "@/actions/difusiones";
import styles from "./nuevaDifusion.module.css";

type Props = {
  difusionId: string;
  onClose: () => void;
};

type Detalle = {
  id: string;
  asunto: string;
  cuerpo: string;
  origen: "campana" | "etiqueta" | "clientes_agente" | "difusion";
  num_destinatarios: number;
  num_enviados: number;
  num_errores: number;
  estado: "enviando" | "enviado" | "error";
  created_at: string;
  crm_campanas?: { nombre: string } | null;
  crm_etiquetas?: { nombre: string } | null;
  crm_agentes?: { id: string; nombre: string; apellidos?: string | null; avatar_url?: string | null } | null;
  destinatarios: Array<{
    id: string;
    entidad_id: string | null;
    nombre: string | null;
    email: string;
    estado: "enviado" | "error";
    error_detalle: string | null;
    token?: string;
    abierto_at?: string | null;
    num_aperturas?: number;
    created_at: string;
    contabilidad_entidades?: { id: string; nombre: string } | null;
  }>;
};

const ORIGEN_LABELS: Record<string, string> = {
  campana: "Campaña",
  etiqueta: "Etiqueta",
  clientes_agente: "Mis clientes",
  difusion: "Difusión directa",
};

const ESTADO_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  enviando: { bg: "#eff6ff", color: "#2563eb", label: "Enviando" },
  enviado:  { bg: "#dcfce7", color: "#16a34a", label: "Enviado" },
  error:    { bg: "#fee2e2", color: "#dc2626", label: "Con errores" },
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

function formatHoraFechaCorta(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function DetalleDifusionModal({ difusionId, onClose }: Props) {
  const [data, setData] = useState<Detalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"mensaje" | "destinatarios">("mensaje");
  const [filtroDest, setFiltroDest] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "abierto" | "sin_abrir" | "error">("todos");

  useEffect(() => {
    setLoading(true);
    getDifusionDetalle(difusionId)
      .then((res) => setData(res as any))
      .finally(() => setLoading(false));
  }, [difusionId]);

  const totalAbiertos = (data?.destinatarios ?? []).filter((d) => !!d.abierto_at).length;
  const tasaApertura = data?.num_enviados && data.num_enviados > 0
    ? Math.round((totalAbiertos / data.num_enviados) * 100)
    : 0;

  const destinatariosFiltrados = (data?.destinatarios ?? []).filter((d) => {
    if (estadoFilter === "abierto" && !d.abierto_at) return false;
    if (estadoFilter === "sin_abrir" && (!!d.abierto_at || d.estado === "error")) return false;
    if (estadoFilter === "error" && d.estado !== "error") return false;
    if (!filtroDest.trim()) return true;
    const q = filtroDest.toLowerCase().trim();
    const grupo = d.contabilidad_entidades?.nombre?.toLowerCase() ?? "";
    return (
      (d.nombre?.toLowerCase() ?? "").includes(q) ||
      grupo.includes(q) ||
      d.email.toLowerCase().includes(q)
    );
  });

  const estadoBadge = data ? ESTADO_COLORS[data.estado] ?? ESTADO_COLORS.enviado : null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 880, maxHeight: "calc(100vh - 4.5rem)" }}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className={styles.modalTitle}>Detalle de difusión</span>
            {data && (
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Enviado el {formatFecha(data.created_at)}
                {data.crm_agentes?.nombre && ` por ${data.crm_agentes.nombre} ${data.crm_agentes.apellidos ?? ""}`.trimEnd()}
                {" · "}{ORIGEN_LABELS[data.origen] ?? "Difusión"}
              </span>
            )}
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.88rem" }}>
            Cargando datos de la difusión…
          </div>
        ) : !data ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#ef4444", fontSize: "0.88rem" }}>
            No se ha encontrado el registro de la difusión.
          </div>
        ) : (
          <>
            {/* Summary Strip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.85rem 1.5rem",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "0.2rem 0.65rem",
                    borderRadius: 999,
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    background: estadoBadge?.bg,
                    color: estadoBadge?.color,
                  }}
                >
                  {estadoBadge?.label}
                </span>
                <span style={{ fontSize: "0.82rem", color: "#334155", fontWeight: 500 }}>
                  <strong>{data.num_enviados}</strong> de <strong>{data.num_destinatarios}</strong> entregados
                  {data.num_errores > 0 && (
                    <span style={{ color: "#dc2626", marginLeft: 6 }}>
                      ({data.num_errores} con error)
                    </span>
                  )}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#2563eb",
                    background: "#eff6ff",
                    padding: "0.15rem 0.6rem",
                    borderRadius: 6,
                  }}
                >
                  <Eye size={12} /> {totalAbiertos} abiertos ({tasaApertura}%)
                </span>
              </div>

              {/* Tabs selector */}
              <div style={{ display: "flex", gap: 4, background: "#e2e8f0", padding: 3, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("mensaje")}
                  style={{
                    padding: "0.3rem 0.75rem",
                    border: "none",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: activeTab === "mensaje" ? "#ffffff" : "transparent",
                    color: activeTab === "mensaje" ? "#0f172a" : "#64748b",
                    boxShadow: activeTab === "mensaje" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.12s",
                  }}
                >
                  Mensaje
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("destinatarios")}
                  style={{
                    padding: "0.3rem 0.75rem",
                    border: "none",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: activeTab === "destinatarios" ? "#ffffff" : "transparent",
                    color: activeTab === "destinatarios" ? "#0f172a" : "#64748b",
                    boxShadow: activeTab === "destinatarios" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.12s",
                  }}
                >
                  Destinatarios ({data.num_destinatarios})
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody} style={{ minHeight: 340 }}>
              {activeTab === "mensaje" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Asunto */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Asunto
                    </span>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        color: "#0f172a",
                        padding: "0.6rem 0.85rem",
                        background: "#f8fafc",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      {data.asunto}
                    </div>
                  </div>

                  {/* Cuerpo del Mensaje */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Contenido enviado
                    </span>
                    <div
                      style={{
                        padding: "1rem 1.15rem",
                        background: "#ffffff",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        minHeight: 190,
                        maxHeight: 340,
                        overflowY: "auto",
                        fontSize: "0.875rem",
                        lineHeight: 1.65,
                        color: "#334155",
                      }}
                    >
                      {data.cuerpo.includes("<p>") || data.cuerpo.includes("<div>") || data.cuerpo.includes("<br") ? (
                        <div
                          className="momo-rich-inline"
                          dangerouslySetInnerHTML={{ __html: data.cuerpo }}
                        />
                      ) : (
                        <div style={{ whiteSpace: "pre-wrap" }}>{data.cuerpo}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "destinatarios" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {/* Search and filter bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 200,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "0.4rem 0.65rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        background: "#fff",
                      }}
                    >
                      <Search size={14} style={{ color: "#94a3b8" }} />
                      <input
                        type="text"
                        placeholder="Buscar por responsable, grupo o email…"
                        value={filtroDest}
                        onChange={(e) => setFiltroDest(e.target.value)}
                        style={{ border: "none", outline: "none", fontSize: "0.8rem", width: "100%", color: "#1e293b" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setEstadoFilter("todos")}
                        style={{
                          padding: "0.35rem 0.65rem",
                          borderRadius: 6,
                          fontSize: "0.72rem",
                          border: "1px solid #e2e8f0",
                          cursor: "pointer",
                          fontWeight: 500,
                          background: estadoFilter === "todos" ? "#0f172a" : "#fff",
                          color: estadoFilter === "todos" ? "#fff" : "#475569",
                        }}
                      >
                        Todos ({data.destinatarios.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstadoFilter("abierto")}
                        style={{
                          padding: "0.35rem 0.65rem",
                          borderRadius: 6,
                          fontSize: "0.72rem",
                          border: "1px solid #e2e8f0",
                          cursor: "pointer",
                          fontWeight: 500,
                          background: estadoFilter === "abierto" ? "#2563eb" : "#fff",
                          color: estadoFilter === "abierto" ? "#fff" : "#2563eb",
                        }}
                      >
                        Abiertos ({totalAbiertos})
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstadoFilter("sin_abrir")}
                        style={{
                          padding: "0.35rem 0.65rem",
                          borderRadius: 6,
                          fontSize: "0.72rem",
                          border: "1px solid #e2e8f0",
                          cursor: "pointer",
                          fontWeight: 500,
                          background: estadoFilter === "sin_abrir" ? "#16a34a" : "#fff",
                          color: estadoFilter === "sin_abrir" ? "#fff" : "#16a34a",
                        }}
                      >
                        Sin abrir ({Math.max(0, data.num_enviados - totalAbiertos)})
                      </button>
                      {data.num_errores > 0 && (
                        <button
                          type="button"
                          onClick={() => setEstadoFilter("error")}
                          style={{
                            padding: "0.35rem 0.65rem",
                            borderRadius: 6,
                            fontSize: "0.72rem",
                            border: "1px solid #e2e8f0",
                            cursor: "pointer",
                            fontWeight: 500,
                            background: estadoFilter === "error" ? "#dc2626" : "#fff",
                            color: estadoFilter === "error" ? "#fff" : "#dc2626",
                          }}
                        >
                          Errores ({data.num_errores})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Recipients list */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      maxHeight: 330,
                      overflowY: "auto",
                      background: "#fff",
                    }}
                  >
                    {destinatariosFiltrados.length === 0 ? (
                      <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                        No se han encontrado destinatarios.
                      </div>
                    ) : (
                      destinatariosFiltrados.map((d, index) => (
                        <div
                          key={d.id || index}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.6rem 0.85rem",
                            borderBottom: index < destinatariosFiltrados.length - 1 ? "1px solid #f1f5f9" : "none",
                            gap: "0.75rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: d.abierto_at ? "#eff6ff" : (d.estado === "enviado" ? "#dcfce7" : "#fee2e2"),
                                color: d.abierto_at ? "#2563eb" : (d.estado === "enviado" ? "#16a34a" : "#dc2626"),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              {d.nombre ? d.nombre.charAt(0).toUpperCase() : <User size={13} />}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {d.nombre || "Sin nombre"}
                                {d.contabilidad_entidades?.nombre && d.nombre && d.nombre !== d.contabilidad_entidades.nombre && (
                                  <span style={{ color: "#64748b", fontWeight: 500, marginLeft: 5 }}>
                                    ({d.contabilidad_entidades.nombre})
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: "0.74rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {d.email}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {d.abierto_at ? (
                              <span
                                title={`Abierto el ${formatFecha(d.abierto_at)}${d.num_aperturas && d.num_aperturas > 1 ? ` (${d.num_aperturas} veces)` : ""}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  color: "#2563eb",
                                  background: "#eff6ff",
                                  padding: "0.15rem 0.55rem",
                                  borderRadius: 999,
                                }}
                              >
                                <Eye size={11} /> Abierto {formatHoraFechaCorta(d.abierto_at)}
                              </span>
                            ) : d.estado === "enviado" ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  color: "#16a34a",
                                  background: "#dcfce7",
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: 999,
                                }}
                              >
                                <CheckCircle2 size={11} /> Entregado
                              </span>
                            ) : (
                              <span
                                title={d.error_detalle ?? "Error al enviar"}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  color: "#dc2626",
                                  background: "#fee2e2",
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: 999,
                                }}
                              >
                                <XCircle size={11} /> Error
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={styles.modalFooter} style={{ justifyContent: "flex-end" }}>
              <button className={styles.btnSecondary} onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
