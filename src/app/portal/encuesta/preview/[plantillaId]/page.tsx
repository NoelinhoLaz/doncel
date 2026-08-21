"use client";

import { useState, useEffect, use } from "react";
import { getPlantillaPreview } from "@/actions/encuestas";
import EncuestaPreguntas, { PreguntaEncuesta } from "@/components/EncuestaPreguntas";

export default function EncuestaPreviewPage({ params }: { params: Promise<{ plantillaId: string }> }) {
  const { plantillaId } = use(params);
  const [encuesta, setEncuesta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, string | number | string[]>>({});

  useEffect(() => {
    getPlantillaPreview(plantillaId)
      .then((data) => {
        if (!data) setNotFound(true);
        else setEncuesta(data);
      })
      .catch((err) => {
        console.error("Error cargando preview:", err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [plantillaId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Cargando...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "1rem" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔍</div>
        <h1 style={{ margin: "0 0 8px", fontSize: "1.2rem", color: "#0f172a" }}>Encuesta no encontrada</h1>
      </div>
    </div>
  );

  const preguntas: PreguntaEncuesta[] = encuesta.preguntas || [];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            background: "#0f172a", color: "#fff", fontSize: "0.75rem", fontWeight: 600,
            padding: "0.5rem", borderRadius: "10px 10px 0 0", letterSpacing: "0.03em",
          }}
        >
          👁 VISTA PREVIA — así la verá el cliente, las respuestas no se guardan
        </div>

        <div style={{ background: "var(--primary-color,#475569)", padding: "2rem 1.5rem" }}>
          <h1 style={{ margin: "0 0 6px", color: "#fff", fontSize: "1.3rem", fontWeight: 700 }}>{encuesta.nombre}</h1>
          {encuesta.descripcion && (
            <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.88rem" }}>{encuesta.descripcion}</p>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: "0 0 12px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <EncuestaPreguntas
            preguntas={preguntas}
            respuestas={respuestas}
            onChange={(id, valor) => setRespuestas((prev) => ({ ...prev, [id]: valor }))}
          />

          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
            <button
              disabled
              style={{ background: "var(--primary-color,#475569)", color: "#fff", border: "none", borderRadius: 8, padding: "0.6rem 1.4rem", fontSize: "0.88rem", fontWeight: 600, opacity: 0.5, cursor: "default" }}
            >
              Enviar respuestas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
