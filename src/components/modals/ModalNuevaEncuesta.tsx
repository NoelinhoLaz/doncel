"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { crearPlantilla, PreguntaInput, TipoPregunta } from "@/actions/encuestas";
import EncuestaPreguntas from "@/components/EncuestaPreguntas";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

const TIPOS: { value: TipoPregunta; label: string }[] = [
  { value: "rating", label: "Nivel de satisfacción (6 niveles)" },
  { value: "texto_libre", label: "Texto libre" },
  { value: "opcion_unica", label: "Opción única" },
  { value: "opcion_multiple", label: "Opción múltiple" },
  { value: "si_no", label: "Sí / No" },
  { value: "nps", label: "Escala 0-10 (NPS)" },
];

type PreguntaForm = PreguntaInput & { key: string };

function nuevaPregunta(): PreguntaForm {
  return { key: crypto.randomUUID(), texto: "", tipo: "rating", opciones: [], obligatoria: false };
}

export default function ModalNuevaEncuesta({ onClose, onCreated }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [preguntas, setPreguntas] = useState<PreguntaForm[]>([nuevaPregunta()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewRespuestas, setPreviewRespuestas] = useState<Record<string, string | number | string[]>>({});

  const updatePregunta = (key: string, patch: Partial<PreguntaForm>) => {
    setPreguntas((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const removePregunta = (key: string) => {
    setPreguntas((prev) => prev.filter((p) => p.key !== key));
  };

  const requiereOpciones = (tipo: TipoPregunta) => tipo === "opcion_unica" || tipo === "opcion_multiple";

  const puedeGuardar =
    nombre.trim().length > 0 &&
    preguntas.length > 0 &&
    preguntas.every((p) => p.texto.trim().length > 0 && (!requiereOpciones(p.tipo) || (p.opciones && p.opciones.filter((o) => o.trim()).length >= 2)));

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    setError("");
    const res = await crearPlantilla({
      nombre,
      descripcion,
      preguntas: preguntas.map((p) => ({
        texto: p.texto.trim(),
        tipo: p.tipo,
        obligatoria: p.obligatoria,
        opciones: requiereOpciones(p.tipo) ? (p.opciones || []).map((o) => o.trim()).filter(Boolean) : undefined,
      })),
    });
    setSaving(false);
    if (res.success) {
      onCreated?.();
      onClose();
    } else {
      setError(res.error || "Error al crear la encuesta.");
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(640px,100%)", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 40px rgba(0,0,0,0.16)", display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1rem", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Nueva encuesta</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => { setPreviewRespuestas({}); setShowPreview(true); }}
              disabled={preguntas.every((p) => !p.texto.trim())}
              title="Ver como la ve el cliente"
              style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "0.3rem 0.6rem", cursor: preguntas.every((p) => !p.texto.trim()) ? "default" : "pointer", fontSize: "0.75rem", opacity: preguntas.every((p) => !p.texto.trim()) ? 0.5 : 1 }}
            >
              <Eye size={13} />
              Previsualizar
            </button>
            <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#64748b", fontSize: "1.3rem", cursor: "pointer" }}>×</button>
          </div>
        </div>

        <div style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Nombre de la encuesta *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Satisfacción post-viaje"
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Texto introductorio que verá el cliente"
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none", resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Preguntas</label>
              <button
                onClick={() => setPreguntas((prev) => [...prev, nuevaPregunta()])}
                style={{ fontSize: "0.75rem", color: "#475569", background: "none", border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.3rem 0.6rem", cursor: "pointer" }}
              >
                + Añadir pregunta
              </button>
            </div>

            {preguntas.map((p, idx) => (
              <div key={p.key} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.8rem", display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", paddingTop: 8, minWidth: 18 }}>{idx + 1}.</span>
                  <input
                    type="text"
                    value={p.texto}
                    onChange={(e) => updatePregunta(p.key, { texto: e.target.value })}
                    placeholder="Texto de la pregunta"
                    style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.4rem 0.6rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
                  />
                  <button
                    onClick={() => removePregunta(p.key)}
                    disabled={preguntas.length === 1}
                    style={{ border: "none", background: "transparent", color: preguntas.length === 1 ? "#cbd5e1" : "#ef4444", fontSize: "1.1rem", cursor: preguntas.length === 1 ? "default" : "pointer", padding: "0.3rem" }}
                    title="Eliminar pregunta"
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 26 }}>
                  <select
                    value={p.tipo}
                    onChange={(e) => updatePregunta(p.key, { tipo: e.target.value as TipoPregunta })}
                    style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.35rem 0.5rem", fontSize: "0.8rem", color: "#334155", outline: "none" }}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "#334155", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!p.obligatoria} onChange={(e) => updatePregunta(p.key, { obligatoria: e.target.checked })} />
                    Obligatoria
                  </label>
                </div>

                {requiereOpciones(p.tipo) && (
                  <div style={{ marginLeft: 26, display: "grid", gap: 6 }}>
                    {(p.opciones || []).map((opt, oi) => (
                      <div key={oi} style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const nuevas = [...(p.opciones || [])];
                            nuevas[oi] = e.target.value;
                            updatePregunta(p.key, { opciones: nuevas });
                          }}
                          placeholder={`Opción ${oi + 1}`}
                          style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.35rem 0.6rem", fontSize: "0.8rem", color: "#0f172a", outline: "none" }}
                        />
                        <button
                          onClick={() => updatePregunta(p.key, { opciones: (p.opciones || []).filter((_, i) => i !== oi) })}
                          style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => updatePregunta(p.key, { opciones: [...(p.opciones || []), ""] })}
                      style={{ fontSize: "0.75rem", color: "#475569", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", width: "fit-content" }}
                    >
                      + Añadir opción
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ padding: "0.6rem 0.8rem", borderRadius: 6, background: "#fee2e2", color: "#dc2626", fontSize: "0.82rem" }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0.9rem 1rem", borderTop: "1px solid #e2e8f0", marginTop: "auto" }}>
          <button onClick={onClose} style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "0.45rem 0.8rem", cursor: "pointer", fontSize: "0.85rem" }}>
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving || !puedeGuardar}
            style={{ border: "none", background: "var(--primary-color,#475569)", color: "#fff", borderRadius: 6, padding: "0.45rem 0.9rem", cursor: saving || !puedeGuardar ? "default" : "pointer", opacity: saving || !puedeGuardar ? 0.6 : 1, fontSize: "0.85rem", fontWeight: 600 }}
          >
            {saving ? "Guardando..." : "Crear encuesta"}
          </button>
        </div>
      </div>

      {showPreview && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setShowPreview(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,100%)", maxHeight: "88vh", overflow: "auto", borderRadius: 12 }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
                background: "#0f172a", color: "#fff", fontSize: "0.75rem", fontWeight: 600,
                padding: "0.5rem", borderRadius: "10px 10px 0 0", letterSpacing: "0.03em",
              }}
            >
              👁 VISTA PREVIA — así la verá el cliente
            </div>
            <div style={{ background: "var(--primary-color,#475569)", padding: "2rem 1.5rem" }}>
              <h1 style={{ margin: "0 0 6px", color: "#fff", fontSize: "1.3rem", fontWeight: 700 }}>{nombre || "(Sin nombre)"}</h1>
              {descripcion && <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.88rem" }}>{descripcion}</p>}
            </div>
            <div style={{ background: "#fff", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
              <EncuestaPreguntas
                preguntas={preguntas.filter((p) => p.texto.trim()).map((p, i) => ({ ...p, id: p.key, orden: i, obligatoria: !!p.obligatoria, opciones: p.opciones || null }))}
                respuestas={previewRespuestas}
                onChange={(id, valor) => setPreviewRespuestas((prev) => ({ ...prev, [id]: valor }))}
              />
              <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
                <button disabled style={{ background: "var(--primary-color,#475569)", color: "#fff", border: "none", borderRadius: 8, padding: "0.6rem 1.4rem", fontSize: "0.88rem", fontWeight: 600, opacity: 0.5, cursor: "default" }}>
                  Enviar respuestas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
