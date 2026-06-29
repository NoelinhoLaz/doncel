"use client";

import { useState, useEffect, use } from "react";
import { getEncuestaByToken, guardarValoraciones } from "@/actions/valoraciones";

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{ background: "none", border: "none", padding: 2, cursor: onChange ? "pointer" : "default", fontSize: "1.6rem", color: n <= (hover || value) ? "#f59e0b" : "#e2e8f0", transition: "color 0.1s", lineHeight: 1 }}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ValoracionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [encuesta, setEncuesta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getEncuestaByToken(token).then((data) => {
      if (!data) { setNotFound(true); }
      else { setEncuesta(data); }
      setLoading(false);
    });
  }, [token]);

  const handleSubmit = async () => {
    const valoraciones = (encuesta.servicios || [])
      .filter((s: any) => ratings[s.id])
      .map((s: any) => ({ linea_id: s.id, rating: ratings[s.id], comentario: comentarios[s.id] || undefined }));

    if (valoraciones.length === 0) return;
    setSubmitting(true);
    const res = await guardarValoraciones(token, valoraciones);
    if (res.success) setDone(true);
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
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Este enlace de valoración no existe o ha caducado.</p>
      </div>
    </div>
  );

  if (done || encuesta.completado_at) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "1rem" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🙏</div>
        <h1 style={{ margin: "0 0 8px", fontSize: "1.3rem", color: "#0f172a" }}>¡Gracias por tu valoración!</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Tu opinión nos ayuda a mejorar cada viaje. Esperamos verte pronto.</p>
      </div>
    </div>
  );

  const servicios: any[] = encuesta.servicios || [];
  const ratedCount = servicios.filter((s: any) => ratings[s.id]).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ background: "var(--primary-color,#475569)", borderRadius: "12px 12px 0 0", padding: "2rem 1.5rem" }}>
          <h1 style={{ margin: "0 0 6px", color: "#fff", fontSize: "1.3rem", fontWeight: 700 }}>¿Cómo fue tu viaje?</h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.88rem" }}>
            Puntúa los servicios que disfrutaste. Tu opinión es muy valiosa para nosotros.
          </p>
        </div>

        {/* Servicios */}
        <div style={{ background: "#fff", borderRadius: "0 0 12px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          {servicios.map((s: any, i: number) => {
            const det = typeof s.detalles === "string" ? (() => { try { return JSON.parse(s.detalles); } catch { return {}; } })() : (s.detalles || {});
            const nombreLugar = det?.nombre_lugar || null;
            const etiqueta = s.config_tipos_servicios?.etiqueta || "";

            return (
              <div key={s.id} style={{ padding: "1.2rem 1.5rem", borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
                <div style={{ marginBottom: 10 }}>
                  {etiqueta && <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary-color,#475569)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{etiqueta}</div>}
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" }}>{s.descripcion || nombreLugar || "(Sin descripción)"}</div>
                  {nombreLugar && s.descripcion && <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 1 }}>{nombreLugar}</div>}
                </div>

                <Stars value={ratings[s.id] || 0} onChange={(v) => setRatings(prev => ({ ...prev, [s.id]: v }))} />

                {ratings[s.id] > 0 && (
                  <textarea
                    value={comentarios[s.id] || ""}
                    onChange={(e) => setComentarios(prev => ({ ...prev, [s.id]: e.target.value }))}
                    placeholder="Añade un comentario opcional..."
                    rows={2}
                    style={{ marginTop: 10, width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.82rem", color: "#334155", resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
                  />
                )}
              </div>
            );
          })}

          {servicios.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.88rem" }}>
              No hay servicios para valorar.
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              {ratedCount} de {servicios.length} valorado{ratedCount !== 1 ? "s" : ""}
            </span>
            <button
              onClick={handleSubmit}
              disabled={submitting || ratedCount === 0}
              style={{ background: "var(--primary-color,#475569)", color: "#fff", border: "none", borderRadius: 8, padding: "0.6rem 1.4rem", fontSize: "0.88rem", fontWeight: 600, cursor: ratedCount === 0 || submitting ? "default" : "pointer", opacity: ratedCount === 0 ? 0.5 : 1 }}
            >
              {submitting ? "Enviando..." : "Enviar valoración"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
