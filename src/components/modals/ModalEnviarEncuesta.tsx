"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { enviarEncuesta, getPlantillas } from "@/actions/encuestas";
import { buscarEntidades } from "@/actions/entidades";

interface Entidad {
  id: string;
  nombre: string;
  localidad: string | null;
  email: string | null;
}

interface Destinatario {
  entidadId?: string;
  nombre: string;
  email: string;
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
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Entidad[]>([]);
  const [emailsManual, setEmailsManual] = useState("");
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>(
    entidadPreseleccionada
      ? [{ entidadId: entidadPreseleccionada.id, nombre: entidadPreseleccionada.nombre, email: entidadPreseleccionada.email || "" }]
      : []
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (plantillaId) return;
    getPlantillas().then((data) => setPlantillas((data as PlantillaOption[]).filter((p) => p.activa)));
  }, [plantillaId]);

  useEffect(() => {
    if (!query.trim()) {
      setResultados([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await buscarEntidades(query);
      setResultados(res as Entidad[]);
    }, 300);
  }, [query]);

  const addDestinatario = (e: Entidad) => {
    setDestinatarios((prev) => {
      if (prev.some((d) => d.entidadId === e.id)) return prev;
      return [...prev, { entidadId: e.id, nombre: e.nombre, email: e.email || "" }];
    });
    setQuery("");
    setResultados([]);
  };

  const removeDestinatario = (key: string) => {
    setDestinatarios((prev) => prev.filter((d) => (d.entidadId || d.email) !== key));
  };

  const updateEmail = (key: string, email: string) => {
    setDestinatarios((prev) => prev.map((d) => ((d.entidadId || d.email) === key ? { ...d, email } : d)));
  };

  const addEmailsManual = () => {
    const emails = emailsManual
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    setDestinatarios((prev) => {
      const existentes = new Set(prev.map((d) => d.email.toLowerCase()));
      const nuevos = emails
        .filter((e) => !existentes.has(e.toLowerCase()))
        .map((e) => ({ nombre: e, email: e }));
      return [...prev, ...nuevos];
    });
    setEmailsManual("");
  };

  const destinatariosValidos = destinatarios.filter((d) => d.email.includes("@"));
  const puedeEnviar = !!selectedPlantillaId && destinatariosValidos.length === destinatarios.length && destinatarios.length > 0;

  const handleSend = async () => {
    if (!puedeEnviar) return;
    setSending(true);
    setResult(null);

    let okCount = 0;
    const errores: string[] = [];

    for (const d of destinatarios) {
      const res = await enviarEncuesta({
        plantillaId: selectedPlantillaId,
        entidadId: d.entidadId,
        expedienteId,
        emailDestino: d.email,
        appBaseUrl: window.location.origin,
      });
      if (res.success) okCount++;
      else errores.push(`${d.nombre}: ${res.error || "error"}`);
    }

    setSending(false);

    if (errores.length === 0) {
      setResult({ ok: true, msg: `Encuesta enviada a ${okCount} destinatario${okCount === 1 ? "" : "s"}.` });
      onSent?.();
    } else {
      setResult({
        ok: false,
        msg: `${okCount} enviada${okCount === 1 ? "" : "s"}, ${errores.length} con error: ${errores.join("; ")}`,
      });
      if (okCount > 0) onSent?.();
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(520px,100%)", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 40px rgba(0,0,0,0.16)", display: "flex", flexDirection: "column" }}
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
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Buscar cliente</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar y añadir clientes..."
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
            />
            {resultados.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,0.1)", maxHeight: 220, overflow: "auto", marginTop: 2 }}>
                {resultados.map((r) => {
                  const yaAnadido = destinatarios.some((d) => d.entidadId === r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => addDestinatario(r)}
                      disabled={yaAnadido}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.7rem", border: "none", background: "#fff", cursor: yaAnadido ? "default" : "pointer", fontSize: "0.82rem", color: yaAnadido ? "#cbd5e1" : "#0f172a" }}
                    >
                      {r.nombre}
                      {r.localidad && <span style={{ color: "#94a3b8" }}> — {r.localidad}</span>}
                      {yaAnadido && <span style={{ color: "#94a3b8" }}> (añadido)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>O introduce emails a mano (separados por comas)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                value={emailsManual}
                onChange={(e) => setEmailsManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmailsManual(); } }}
                placeholder="ana@email.com, luis@email.com"
                style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
              />
              <button
                onClick={addEmailsManual}
                disabled={!emailsManual.trim()}
                style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "0.45rem 0.8rem", fontSize: "0.82rem", cursor: emailsManual.trim() ? "pointer" : "default", opacity: emailsManual.trim() ? 1 : 0.5 }}
              >
                Añadir
              </button>
            </div>
          </div>

          {destinatarios.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {destinatarios.map((d) => {
                const key = d.entidadId || d.email;
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.5rem 0.6rem" }}>
                    <div style={{ minWidth: 0, flexShrink: 0, maxWidth: 140, fontSize: "0.82rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d.entidadId ? d.nombre : <span style={{ fontWeight: 400, color: "#94a3b8" }}>Sin cliente</span>}
                    </div>
                    <input
                      type="email"
                      value={d.email}
                      onChange={(e) => updateEmail(key, e.target.value)}
                      placeholder="email@cliente.com"
                      style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.35rem 0.6rem", fontSize: "0.82rem", color: d.email.includes("@") ? "#0f172a" : "#dc2626", outline: "none" }}
                    />
                    <button
                      onClick={() => removeDestinatario(key)}
                      style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", padding: 2, display: "inline-flex" }}
                      title="Quitar"
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
              <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                {destinatarios.length} destinatario{destinatarios.length === 1 ? "" : "s"}
              </span>
            </div>
          )}

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
            disabled={sending || !puedeEnviar || !!result?.ok}
            style={{ border: "none", background: "var(--primary-color,#475569)", color: "#fff", borderRadius: 6, padding: "0.45rem 0.9rem", cursor: sending || !puedeEnviar || !!result?.ok ? "default" : "pointer", opacity: sending || !puedeEnviar ? 0.6 : 1, fontSize: "0.85rem", fontWeight: 600 }}
          >
            {sending ? "Enviando..." : destinatarios.length > 1 ? `Enviar a ${destinatarios.length}` : "Enviar encuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}
