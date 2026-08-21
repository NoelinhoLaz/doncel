"use client";

import { useState, useEffect, useRef } from "react";
import { enviarEncuesta, getPlantillas } from "@/actions/encuestas";
import { buscarEntidades } from "@/actions/entidades";

interface Entidad {
  id: string;
  nombre: string;
  localidad: string | null;
  email: string | null;
}

interface PlantillaOption {
  id: string;
  nombre: string;
  activa: boolean;
}

interface Props {
  plantillaId?: string;
  expedienteId?: string;
  entidadPreseleccionada?: { id: string; nombre: string; email: string | null };
  onClose: () => void;
  onSent?: () => void;
}

export default function ModalEnviarEncuesta({ plantillaId, expedienteId, entidadPreseleccionada, onClose, onSent }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaOption[]>([]);
  const [selectedPlantillaId, setSelectedPlantillaId] = useState(plantillaId || "");
  const [query, setQuery] = useState(entidadPreseleccionada?.nombre || "");
  const [resultados, setResultados] = useState<Entidad[]>([]);
  const [entidad, setEntidad] = useState<Entidad | null>(
    entidadPreseleccionada ? { ...entidadPreseleccionada, localidad: null } : null
  );
  const [email, setEmail] = useState(entidadPreseleccionada?.email || "");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (plantillaId) return;
    getPlantillas().then((data) => setPlantillas((data as PlantillaOption[]).filter((p) => p.activa)));
  }, [plantillaId]);

  useEffect(() => {
    if (!query.trim() || entidad) {
      setResultados([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await buscarEntidades(query);
      setResultados(res as Entidad[]);
    }, 300);
  }, [query, entidad]);

  const selectEntidad = (e: Entidad) => {
    setEntidad(e);
    setQuery(e.nombre);
    setResultados([]);
    if (e.email) setEmail(e.email);
  };

  const handleSend = async () => {
    if (!entidad || !email.includes("@") || !selectedPlantillaId) return;
    setSending(true);
    setResult(null);
    try {
      const res = await enviarEncuesta({
        plantillaId: selectedPlantillaId,
        entidadId: entidad.id,
        expedienteId,
        emailDestino: email,
        appBaseUrl: window.location.origin,
      });
      if (res.success) {
        setResult({ ok: true, msg: "Encuesta enviada correctamente." });
        onSent?.();
      } else {
        setResult({ ok: false, msg: res.error || "Error al enviar." });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(480px,100%)", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 40px rgba(0,0,0,0.16)", display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1rem", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Enviar encuesta</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#64748b", fontSize: "1.3rem", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
          {!plantillaId && (
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Encuesta *</label>
              <select
                value={selectedPlantillaId}
                onChange={(e) => setSelectedPlantillaId(e.target.value)}
                style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
              >
                <option value="">Selecciona una encuesta...</option>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {plantillas.length === 0 && (
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>No hay encuestas activas. Crea una en Fidelización &gt; Encuestas.</span>
              )}
            </div>
          )}

          <div style={{ display: "grid", gap: 6, position: "relative" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Cliente *</label>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setEntidad(null); }}
              placeholder="Buscar cliente por nombre..."
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
            />
            {resultados.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,0.1)", maxHeight: 220, overflow: "auto", marginTop: 2 }}>
                {resultados.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectEntidad(r)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.7rem", border: "none", background: "#fff", cursor: "pointer", fontSize: "0.82rem", color: "#0f172a" }}
                  >
                    {r.nombre}
                    {r.localidad && <span style={{ color: "#94a3b8" }}> — {r.localidad}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Email de destino *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
            />
          </div>

          {result && (
            <div style={{ padding: "0.6rem 0.8rem", borderRadius: 6, background: result.ok ? "#dcfce7" : "#fee2e2", color: result.ok ? "#15803d" : "#dc2626", fontSize: "0.82rem" }}>
              {result.msg}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0.9rem 1rem", borderTop: "1px solid #e2e8f0", marginTop: "auto" }}>
          <button onClick={onClose} style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "0.45rem 0.8rem", cursor: "pointer", fontSize: "0.85rem" }}>
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !entidad || !email.includes("@") || !selectedPlantillaId || !!result?.ok}
            style={{ border: "none", background: "var(--primary-color,#475569)", color: "#fff", borderRadius: 6, padding: "0.45rem 0.9rem", cursor: sending || !entidad || !email.includes("@") || !selectedPlantillaId || !!result?.ok ? "default" : "pointer", opacity: sending || !entidad || !email.includes("@") || !selectedPlantillaId ? 0.6 : 1, fontSize: "0.85rem", fontWeight: 600 }}
          >
            {sending ? "Enviando..." : "Enviar encuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}
