"use client";

import { useState, useEffect } from "react";
import { Send, ClipboardList } from "lucide-react";
import { getEnviosDeExpediente, getRespuestasDeEnvio } from "@/actions/encuestas";
import ModalEnviarEncuesta from "@/components/modals/ModalEnviarEncuesta";

interface Envio {
  id: string;
  plantilla_id: string;
  plantilla_nombre: string;
  entidad_id: string;
  email_destino: string;
  enviado_at: string | null;
  completado_at: string | null;
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

  function load() {
    setLoading(true);
    getEnviosDeExpediente(expedienteId)
      .then((data) => setEnvios(data as Envio[]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [expedienteId]);

  const handleVerRespuestas = async (envioId: string) => {
    const data = await getRespuestasDeEnvio(envioId);
    setDetalleEnvio(data);
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
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                {["Encuesta", "Email", "Enviada", "Estado"].map((h) => (
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
              {envios.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => handleVerRespuestas(e.id)}
                  style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                >
                  <td style={{ padding: "0.7rem 1rem", color: "#1e293b", fontWeight: 600 }}>{e.plantilla_nombre}</td>
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
                </tr>
              ))}
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
              detalleEnvio.items.map((it: any) => (
                <div key={it.id} style={{ padding: "0.7rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>{it.texto}</div>
                  <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>{formatValor(it.tipo, it.respuesta)}</div>
                </div>
              ))
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
