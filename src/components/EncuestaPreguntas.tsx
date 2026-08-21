"use client";

import EscalaSatisfaccion from "@/components/EscalaSatisfaccion";
import type { TipoPregunta } from "@/actions/encuestas";

export type PreguntaEncuesta = {
  id: string;
  orden: number;
  texto: string;
  tipo: TipoPregunta;
  opciones: string[] | null;
  obligatoria: boolean;
};

interface Props {
  preguntas: PreguntaEncuesta[];
  respuestas: Record<string, string | number | string[]>;
  onChange: (preguntaId: string, valor: string | number | string[]) => void;
}

export default function EncuestaPreguntas({ preguntas, respuestas, onChange }: Props) {
  const toggleOpcionMultiple = (preguntaId: string, opcion: string) => {
    const actual = Array.isArray(respuestas[preguntaId]) ? (respuestas[preguntaId] as string[]) : [];
    const nuevo = actual.includes(opcion) ? actual.filter((o) => o !== opcion) : [...actual, opcion];
    onChange(preguntaId, nuevo);
  };

  return (
    <>
      {preguntas.map((p, i) => (
        <div key={p.id} style={{ padding: "1.2rem 1.5rem", borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
          <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>
            {p.texto}
            {p.obligatoria && <span style={{ color: "#ef4444" }}> *</span>}
          </div>

          {p.tipo === "rating" && (
            <EscalaSatisfaccion value={(respuestas[p.id] as number) || 0} onChange={(v) => onChange(p.id, v)} />
          )}

          {p.tipo === "nps" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange(p.id, n)}
                  style={{
                    width: 34, height: 34, borderRadius: 6, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                    border: respuestas[p.id] === n ? "2px solid #475569" : "1px solid #e2e8f0",
                    background: respuestas[p.id] === n ? "#475569" : "#fff",
                    color: respuestas[p.id] === n ? "#fff" : "#334155",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "si_no" && (
            <div style={{ display: "flex", gap: 8 }}>
              {["Sí", "No"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(p.id, opt)}
                  style={{
                    padding: "0.5rem 1.2rem", borderRadius: 8, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                    border: respuestas[p.id] === opt ? "2px solid #475569" : "1px solid #e2e8f0",
                    background: respuestas[p.id] === opt ? "#475569" : "#fff",
                    color: respuestas[p.id] === opt ? "#fff" : "#334155",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "opcion_unica" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(p.opciones || []).map((opt) => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                  <input type="radio" name={p.id} checked={respuestas[p.id] === opt} onChange={() => onChange(p.id, opt)} />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {p.tipo === "opcion_multiple" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(p.opciones || []).map((opt) => {
                const seleccionadas = Array.isArray(respuestas[p.id]) ? (respuestas[p.id] as string[]) : [];
                return (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                    <input type="checkbox" checked={seleccionadas.includes(opt)} onChange={() => toggleOpcionMultiple(p.id, opt)} />
                    {opt}
                  </label>
                );
              })}
            </div>
          )}

          {p.tipo === "texto_libre" && (
            <textarea
              value={(respuestas[p.id] as string) || ""}
              onChange={(e) => onChange(p.id, e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={3}
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "0.5rem 0.7rem", fontSize: "0.85rem", color: "#334155", resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
            />
          )}
        </div>
      ))}

      {preguntas.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.88rem" }}>
          Esta encuesta no tiene preguntas.
        </div>
      )}
    </>
  );
}
