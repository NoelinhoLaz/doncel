"use client";

import { useState, useEffect, useMemo } from "react";
import { Send, ClipboardList, Trash2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { getEnviosDeExpediente, getRespuestasDeEnvio, eliminarEnvio, generarResumenValoracion } from "@/actions/encuestas";
import ModalEnviarEncuesta from "@/components/modals/ModalEnviarEncuesta";
import ValoracionBadge from "@/components/ValoracionBadge";

interface Envio {
  id: string;
  plantilla_id: string;
  plantilla_nombre: string;
  entidad_id: string;
  email_destino: string;
  enviado_at: string | null;
  completado_at: string | null;
  valoracion_promedio: number | null;
  valoracion_resumen: string | null;
}

interface GrupoPlantilla {
  plantillaId: string;
  plantillaNombre: string;
  envios: Envio[];
}

interface Props {
  expedienteId: string;
  entidad?: { id: string; nombre: string; email: string | null } | null;
}

function formatFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatValor(tipo: string, r: any): string {
  if (!r) return "—";
  if (tipo === "rating") {
    const NIVELES = ["Nada satisfecho", "Poco satisfecho", "Neutral", "Satisfecho", "Muy satisfecho", "Totalmente satisfecho"];
    return r.valor_numero ? NIVELES[r.valor_numero - 1] ?? `${r.valor_numero} / 6` : "—";
  }
  if (tipo === "nps") return r.valor_numero !== null ? `${r.valor_numero} / 10` : "—";
  if (tipo === "opcion_unica" || tipo === "opcion_multiple") return (r.valor_opciones || []).join(", ") || "—";
  return r.valor_texto || "—";
}

export default function EncuestasTab({ expedienteId, entidad }: Props) {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnviar, setShowEnviar] = useState(false);
  const [detalleEnvio, setDetalleEnvio] = useState<any>(null);
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);

  function load() {
    setLoading(true);
    getEnviosDeExpediente(expedienteId)
      .then((data) => setEnvios(data as Envio[]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [expedienteId]);

  const grupos = useMemo<GrupoPlantilla[]>(() => {
    const byPlantilla = new Map<string, GrupoPlantilla>();
    for (const e of envios) {
      if (!byPlantilla.has(e.plantilla_id)) {
        byPlantilla.set(e.plantilla_id, { plantillaId: e.plantilla_id, plantillaNombre: e.plantilla_nombre, envios: [] });
      }
      byPlantilla.get(e.plantilla_id)!.envios.push(e);
    }
    return [...byPlantilla.values()];
  }, [envios]);

  const grupoActual = grupos.find((g) => g.plantillaId === grupoAbierto) || null;

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#1e293b" }}>Encuestas</h2>
        <button
          onClick={() => setShowEnviar(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, border: "none",
            background: "var(--primary-color,#475569)", color: "#fff", borderRadius: 8,
            padding: "0.5rem 0.9rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          <Send size={14} />
          Enviar encuesta
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 4px 12px rgba(15,23,42,0.05)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>Cargando…</div>
        ) : envios.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
            <ClipboardList size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>Todavía no se ha enviado ninguna encuesta desde este expediente.</div>
          </div>
        ) : grupoActual ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.75rem 1rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button
                onClick={() => setGrupoAbierto(null)}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "#475569", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, padding: 0 }}
              >
                <ChevronLeft size={15} />
                Encuestas
              </button>
              <span style={{ color: "#cbd5e1" }}>/</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>{grupoActual.plantillaNombre}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  {["Email", "Enviada", "Estado", "Valoración", ""].map((h) => (
                    <th
                      key={h}
                      style={{ padding: "0.75rem 1rem", background: "#f8fafc", color: "#64748b", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e2e8f0", textAlign: "left", whiteSpace: "nowrap" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grupoActual.envios.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => handleVerRespuestas(e.id)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                  >
                    <td style={{ padding: "0.7rem 1rem", color: "#475569" }}>{e.email_destino}</td>
                    <td style={{ padding: "0.7rem 1rem", color: "#475569" }}>{formatFecha(e.enviado_at)}</td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", padding: "0.15rem 0.55rem",
                          borderRadius: 999, fontSize: "0.7rem", fontWeight: 600,
                          background: e.completado_at ? "#dcfce7" : "#fef9c3",
                          color: e.completado_at ? "#16a34a" : "#a16207",
                        }}
                      >
                        {e.completado_at ? "Respondida" : "Pendiente"}
                      </span>
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <ValoracionBadge valor={e.valoracion_promedio} />
                    </td>
                    <td style={{ padding: "0.7rem 1rem", textAlign: "center" }}>
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
          </>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                {["Encuesta", "Envíos", "Respondidas", "Valoración", ""].map((h) => (
                  <th
                    key={h}
                    style={{ padding: "0.75rem 1rem", background: "#f8fafc", color: "#64748b", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e2e8f0", textAlign: "left", whiteSpace: "nowrap" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const respondidas = g.envios.filter((e) => e.completado_at).length;
                const valoraciones = g.envios
                  .map((e) => e.valoracion_promedio)
                  .filter((v): v is number => v !== null && v !== undefined);
                const valoracionMedia = valoraciones.length
                  ? Math.round((valoraciones.reduce((a, b) => a + b, 0) / valoraciones.length) * 100) / 100
                  : null;
                return (
                  <tr
                    key={g.plantillaId}
                    onClick={() => setGrupoAbierto(g.plantillaId)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                  >
                    <td style={{ padding: "0.7rem 1rem", color: "#1e293b", fontWeight: 600 }}>{g.plantillaNombre}</td>
                    <td style={{ padding: "0.7rem 1rem", color: "#475569" }}>{g.envios.length}</td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", padding: "0.15rem 0.55rem",
                          borderRadius: 999, fontSize: "0.7rem", fontWeight: 600,
                          background: respondidas === g.envios.length ? "#dcfce7" : "#fef9c3",
                          color: respondidas === g.envios.length ? "#16a34a" : "#a16207",
                        }}
                      >
                        {respondidas} / {g.envios.length}
                      </span>
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <ValoracionBadge valor={valoracionMedia} />
                    </td>
                    <td style={{ padding: "0.7rem 1rem", textAlign: "center", color: "#94a3b8" }}>
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showEnviar && (
        <ModalEnviarEncuesta
          expedienteId={expedienteId}
          entidadPreseleccionada={entidad ? { id: entidad.id, nombre: entidad.nombre, email: entidad.email } : undefined}
          onClose={() => setShowEnviar(false)}
          onSent={load}
        />
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
                  <div key={it.id} style={{ padding: "0.7rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>{it.texto}</div>
                    <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>{formatValor(it.tipo, it.respuesta)}</div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                Este envío todavía no ha sido respondido.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
