"use client";

import { useState, useEffect, use } from "react";
import { getEncuestaByToken, guardarRespuestas } from "@/actions/encuestas";
import EncuestaPreguntas, { PreguntaEncuesta } from "@/components/EncuestaPreguntas";

export default function EncuestaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [encuesta, setEncuesta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, string | number | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getEncuestaByToken(token).then((data) => {
      if (!data) setNotFound(true);
      else setEncuesta(data);
      setLoading(false);
    });
  }, [token]);

  const preguntas: PreguntaEncuesta[] = encuesta?.preguntas || [];
  const faltanObligatorias = preguntas.some((p) => p.obligatoria && respuestas[p.id] === undefined);

  const handleSubmit = async () => {
    const payload = preguntas
      .filter((p) => respuestas[p.id] !== undefined)
      .map((p) => ({ pregunta_id: p.id, tipo: p.tipo, valor: respuestas[p.id] }));

    if (payload.length === 0) return;
    setSubmitting(true);
    setError("");
    const res = await guardarRespuestas(token, payload);
    if (res.success) setDone(true);
    else setError(res.error || "Error al enviar las respuestas.");
    setSubmitting(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Cargando...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "1rem" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔍</div>
        <h1 style={{ margin: "0 0 8px", fontSize: "1.2rem", color: "#0f172a" }}>Enlace no válido</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Este enlace de encuesta no existe o ha caducado.</p>
      </div>
    </div>
  );

  if (done || encuesta.completado_at) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "1rem" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🙏</div>
        <h1 style={{ margin: "0 0 8px", fontSize: "1.3rem", color: "#0f172a" }}>¡Gracias por tu respuesta!</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Tu opinión nos ayuda a mejorar.</p>
      </div>
    </div>
  );

  const setValor = (preguntaId: string, valor: string | number | string[]) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ background: "var(--primary-color,#475569)", borderRadius: "12px 12px 0 0", padding: "2rem 1.5rem" }}>
          <h1 style={{ margin: "0 0 6px", color: "#fff", fontSize: "1.3rem", fontWeight: 700 }}>{encuesta.nombre}</h1>
          {encuesta.descripcion && (
            <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.88rem" }}>{encuesta.descripcion}</p>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: "0 0 12px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <EncuestaPreguntas preguntas={preguntas} respuestas={respuestas} onChange={setValor} />

          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 8 }}>
            {error && <div style={{ color: "#ef4444", fontSize: "0.8rem" }}>{error}</div>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <button
                onClick={handleSubmit}
                disabled={submitting || faltanObligatorias || preguntas.length === 0}
                style={{ background: "var(--primary-color,#475569)", color: "#fff", border: "none", borderRadius: 8, padding: "0.6rem 1.4rem", fontSize: "0.88rem", fontWeight: 600, cursor: faltanObligatorias || submitting ? "default" : "pointer", opacity: faltanObligatorias ? 0.5 : 1 }}
              >
                {submitting ? "Enviando..." : "Enviar respuestas"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
