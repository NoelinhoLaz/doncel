"use client";

import styles from "./page.module.css";
import { Send, Users, Eye, Trash2, Sparkles } from "lucide-react";
import { useState, useEffect, use } from "react";
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
type Envio = { id: string; entidad_nombre: string; email_destino: string; enviado_at: string | null; completado_at: string | null; valoracion_promedio: number | null; valoracion_resumen: string | null };

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
              {envios.map((e) => (
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
