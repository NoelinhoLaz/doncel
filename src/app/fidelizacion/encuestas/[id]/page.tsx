"use client";

import styles from "./page.module.css";
import { Send, Users, Eye, Trash2, Sparkles } from "lucide-react";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { getPlantilla, getEnviosDePlantilla, getRespuestasDeEnvio, toggleActivaPlantilla, eliminarEnvio, generarResumenValoracion } from "@/actions/encuestas";
import ModalEnviarEncuesta from "@/components/modals/ModalEnviarEncuesta";
import ValoracionBadge from "@/components/ValoracionBadge";
import { NIVELES_SATISFACCION } from "@/components/EscalaSatisfaccion";

const TIPO_LABELS: Record<string, string> = {
  rating: "Nivel de satisfacción",
  texto_libre: "Texto libre",
  opcion_unica: "Opción única",
  opcion_multiple: "Opción múltiple",
  si_no: "Sí / No",
  nps: "NPS",
};

type Pregunta = { id: string; orden: number; texto: string; tipo: string; opciones: string[] | null; obligatoria: boolean };
type Plantilla = { id: string; nombre: string; descripcion: string | null; activa: boolean; preguntas: Pregunta[] };
type Envio = {
  id: string;
  entidad_nombre: string;
  email_destino: string;
  enviado_at: string | null;
  completado_at: string | null;
  valoracion_promedio: number | null;
  valoracion_resumen: string | null;
  expediente_id: string | null;
  expediente_nombre: string | null;
};

function formatFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatValor(tipo: string, r: any): string {
  if (!r) return "—";
  if (tipo === "rating") return r.valor_numero ? NIVELES_SATISFACCION[r.valor_numero - 1] ?? `${r.valor_numero} / 6` : "—";
  if (tipo === "nps") return r.valor_numero !== null ? `${r.valor_numero} / 10` : "—";
  if (tipo === "opcion_unica" || tipo === "opcion_multiple") return (r.valor_opciones || []).join(", ") || "—";
  return r.valor_texto || "—";
}

export default function EncuestaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnviar, setShowEnviar] = useState(false);
  const [detalleEnvio, setDetalleEnvio] = useState<any>(null);
  const [analizando, setAnalizando] = useState(false);

  const [filtroExpedientes, setFiltroExpedientes] = useState<string[]>([]);
  const [expedienteDropdownOpen, setExpedienteDropdownOpen] = useState(false);
  const [expedienteQuery, setExpedienteQuery] = useState("");
  const expedienteDropdownRef = useRef<HTMLDivElement | null>(null);
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroValoracionDesde, setFiltroValoracionDesde] = useState("");
  const [filtroValoracionHasta, setFiltroValoracionHasta] = useState("");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (expedienteDropdownRef.current && !expedienteDropdownRef.current.contains(e.target as Node)) {
        setExpedienteDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function load() {
    setLoading(true);
    Promise.all([getPlantilla(id), getEnviosDePlantilla(id)])
      .then(([p, e]) => {
        setPlantilla(p as Plantilla);
        setEnvios(e as Envio[]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  const handleToggleActiva = async () => {
    if (!plantilla) return;
    await toggleActivaPlantilla(plantilla.id, !plantilla.activa);
    load();
  };

  const handleVerRespuestas = async (envioId: string) => {
    const data = await getRespuestasDeEnvio(envioId);
    setDetalleEnvio(data);
  };

  const handleEliminarEnvio = async (envioId: string) => {
    if (!confirm("¿Eliminar este envío y sus respuestas? Esta acción no se puede deshacer.")) return;
    await eliminarEnvio(envioId);
    load();
  };

  const handleAnalizar = async (envioId: string) => {
    setAnalizando(true);
    const res = await generarResumenValoracion(envioId);
    if (res.success) {
      setDetalleEnvio((prev: any) => (prev ? { ...prev, envio: { ...prev.envio, valoracion_resumen: res.resumen } } : prev));
      load();
    }
    setAnalizando(false);
  };

  const expedientesOptions = Array.from(
    new Map(envios.filter((e) => e.expediente_id).map((e) => [e.expediente_id as string, e.expediente_nombre || "—"])).entries()
  );

  const expedientesFiltrados = expedientesOptions.filter(([, nombre]) =>
    nombre.toLowerCase().includes(expedienteQuery.toLowerCase())
  );

  const enviosFiltrados = envios.filter((e) => {
    if (filtroExpedientes.length > 0 && (!e.expediente_id || !filtroExpedientes.includes(e.expediente_id))) return false;
    if (filtroFechaDesde && (!e.enviado_at || e.enviado_at.slice(0, 10) < filtroFechaDesde)) return false;
    if (filtroFechaHasta && (!e.enviado_at || e.enviado_at.slice(0, 10) > filtroFechaHasta)) return false;
    if (filtroValoracionDesde && (e.valoracion_promedio === null || e.valoracion_promedio * 100 < Number(filtroValoracionDesde))) return false;
    if (filtroValoracionHasta && (e.valoracion_promedio === null || e.valoracion_promedio * 100 > Number(filtroValoracionHasta))) return false;
    return true;
  });

  if (loading) return <div className={styles.container}><div className={styles.emptyState}>Cargando…</div></div>;
  if (!plantilla) return <div className={styles.container}><div className={styles.emptyState}>Encuesta no encontrada.</div></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.back} onClick={() => router.push("/fidelizacion/encuestas")}>← Encuestas</button>
          <h1 className={styles.title}>{plantilla.nombre}</h1>
          {plantilla.descripcion && <span className={styles.descripcion}>{plantilla.descripcion}</span>}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.btn}
            onClick={() => window.open(`/portal/encuesta/preview/${plantilla.id}`, "_blank")}
            title="Ver como la ve el cliente"
          >
            <Eye size={14} />
            Previsualizar
          </button>
          <button className={styles.btn} onClick={handleToggleActiva}>
            {plantilla.activa ? "Desactivar" : "Activar"}
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowEnviar(true)} disabled={!plantilla.activa}>
            <Send size={14} />
            Enviar encuesta
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Preguntas</div>
        {plantilla.preguntas.map((p) => (
          <div key={p.id} className={styles.preguntaRow}>
            <span className={styles.preguntaTexto}>{p.texto}{p.obligatoria ? " *" : ""}</span>
            <span className={styles.preguntaTipo}>{TIPO_LABELS[p.tipo] ?? p.tipo}</span>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Envíos</div>
        {envios.length === 0 ? (
          <div className={styles.emptyState}>
            <Users size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>Todavía no se ha enviado esta encuesta a nadie.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", padding: "0.9rem 1.25rem", borderBottom: "1px solid #f1f5f9", alignItems: "flex-end" }}>
              <div ref={expedienteDropdownRef} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", position: "relative" }}>
                <label style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Expediente</label>
                <button
                  type="button"
                  onClick={() => setExpedienteDropdownOpen((v) => !v)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: "0.72rem",
                    background: "#fff",
                    color: filtroExpedientes.length > 0 ? "#0f172a" : "#94a3b8",
                    cursor: "pointer",
                    minWidth: 160,
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {filtroExpedientes.length === 0
                    ? "Todos"
                    : filtroExpedientes.length === 1
                    ? expedientesOptions.find(([id]) => id === filtroExpedientes[0])?.[1] || "1 seleccionado"
                    : `${filtroExpedientes.length} seleccionados`}
                </button>
                {expedienteDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
                      width: 240,
                      zIndex: 20,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      placeholder="Buscar expediente…"
                      value={expedienteQuery}
                      onChange={(e) => setExpedienteQuery(e.target.value)}
                      style={{ margin: 8, padding: "0.35rem 0.5rem", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: "0.75rem" }}
                    />
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {expedientesFiltrados.length === 0 ? (
                        <div style={{ padding: "0.5rem 0.7rem", fontSize: "0.75rem", color: "#94a3b8" }}>Sin resultados</div>
                      ) : (
                        expedientesFiltrados.map(([id, nombre]) => (
                          <label
                            key={id}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.35rem 0.7rem", fontSize: "0.78rem", color: "#1e293b", cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={filtroExpedientes.includes(id)}
                              onChange={() =>
                                setFiltroExpedientes((prev) =>
                                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                                )
                              }
                            />
                            {nombre}
                          </label>
                        ))
                      )}
                    </div>
                    {filtroExpedientes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFiltroExpedientes([])}
                        style={{ border: "none", borderTop: "1px solid #f1f5f9", background: "transparent", color: "var(--primary-color,#475569)", fontSize: "0.72rem", padding: "0.4rem", cursor: "pointer" }}
                      >
                        Deseleccionar todos
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Desde</label>
                <input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} style={{ padding: "0.4rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: "0.72rem" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Hasta</label>
                <input type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} style={{ padding: "0.4rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: "0.72rem" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Desde</label>
                <div style={{ position: "relative" }}>
                  <input type="number" min={0} max={100} value={filtroValoracionDesde} onChange={(e) => setFiltroValoracionDesde(e.target.value)} style={{ width: 70, padding: "0.4rem 1.3rem 0.4rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: "0.72rem" }} />
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: "0.68rem", color: "#94a3b8", pointerEvents: "none" }}>%</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Hasta</label>
                <div style={{ position: "relative" }}>
                  <input type="number" min={0} max={100} value={filtroValoracionHasta} onChange={(e) => setFiltroValoracionHasta(e.target.value)} style={{ width: 70, padding: "0.4rem 1.3rem 0.4rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: "0.72rem" }} />
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: "0.68rem", color: "#94a3b8", pointerEvents: "none" }}>%</span>
                </div>
              </div>
              {(filtroExpedientes.length > 0 || filtroFechaDesde || filtroFechaHasta || filtroValoracionDesde || filtroValoracionHasta) && (
                <button
                  onClick={() => {
                    setFiltroExpedientes([]);
                    setFiltroFechaDesde("");
                    setFiltroFechaHasta("");
                    setFiltroValoracionDesde("");
                    setFiltroValoracionHasta("");
                  }}
                  style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "0.4rem 0.7rem", fontSize: "0.72rem", cursor: "pointer" }}
                >
                  Limpiar
                </button>
              )}
            </div>
            {enviosFiltrados.length === 0 ? (
              <div className={styles.emptyState}>No hay envíos que coincidan con los filtros.</div>
            ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Cliente</th>
                <th className={styles.th}>Email</th>
                <th className={styles.th}>Enviado</th>
                <th className={styles.th}>Estado</th>
                <th className={styles.th}>Valoración</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {enviosFiltrados.map((e) => (
                <tr key={e.id} className={styles.tr} onClick={() => handleVerRespuestas(e.id)}>
                  <td className={styles.td}>{e.entidad_nombre}</td>
                  <td className={styles.td}>{e.email_destino}</td>
                  <td className={styles.td}>{formatFecha(e.enviado_at)}</td>
                  <td className={styles.td}>
                    <span
                      className={styles.badge}
                      style={{ background: e.completado_at ? "#dcfce7" : "#fef9c3", color: e.completado_at ? "#16a34a" : "#a16207" }}
                    >
                      {e.completado_at ? "Respondida" : "Pendiente"}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <ValoracionBadge valor={e.valoracion_promedio} />
                  </td>
                  <td className={styles.tdCenter}>
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleEliminarEnvio(e.id);
                      }}
                      title="Eliminar envío"
                      style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", padding: 4, display: "inline-flex" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            )}
          </>
        )}
      </div>

      {showEnviar && (
        <ModalEnviarEncuesta plantillaId={plantilla.id} onClose={() => setShowEnviar(false)} onSent={load} />
      )}

      {detalleEnvio && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setDetalleEnvio(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(560px,100%)", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 40px rgba(0,0,0,0.16)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1rem", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Respuestas de {detalleEnvio.envio.email_destino}</h3>
              <button onClick={() => setDetalleEnvio(null)} style={{ border: "none", background: "transparent", color: "#64748b", fontSize: "1.3rem", cursor: "pointer" }}>×</button>
            </div>
            {detalleEnvio.envio.completado_at ? (
              <>
                <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                  {detalleEnvio.envio.valoracion_resumen ? (
                    <div style={{ fontSize: "0.85rem", color: "#334155", fontStyle: "italic" }}>
                      <Sparkles size={13} style={{ marginRight: 6, verticalAlign: "-2px", color: "var(--primary-color,#475569)" }} />
                      {detalleEnvio.envio.valoracion_resumen}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAnalizar(detalleEnvio.envio.id)}
                      disabled={analizando}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "0.4rem 0.7rem", fontSize: "0.78rem", cursor: analizando ? "default" : "pointer" }}
                    >
                      <Sparkles size={13} />
                      {analizando ? "Analizando..." : "Analizar con Copiloto"}
                    </button>
                  )}
                </div>
                {detalleEnvio.items.map((it: any) => (
                  <div key={it.id} className={styles.respuestaBlock}>
                    <div className={styles.respuestaPregunta}>{it.texto}</div>
                    <div className={styles.respuestaValor}>{formatValor(it.tipo, it.respuesta)}</div>
                  </div>
                ))}
              </>
            ) : (
              <div className={styles.emptyState}>Este envío todavía no ha sido respondido.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
