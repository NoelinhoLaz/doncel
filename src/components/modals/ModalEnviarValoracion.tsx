"use client";

import { useState } from "react";
import { crearYEnviarEncuesta } from "@/actions/valoraciones";

interface Servicio {
  id: string;
  descripcion: string;
  tipo_label?: string;
}

interface Props {
  expedienteId: string;
  servicios: Servicio[];
  onClose: () => void;
  onSent?: () => void;
}

export default function ModalEnviarValoracion({ expedienteId, servicios, onClose, onSent }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(servicios.map((s) => s.id)));
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSend = async () => {
    if (!email.includes("@")) return;
    if (selected.size === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await crearYEnviarEncuesta({
        expedienteId,
        serviciosIds: [...selected],
        emailDestinatario: email,
        nombreDestinatario: nombre || "Cliente",
        appBaseUrl: window.location.origin,
      });
      if (res.success) {
        setResult({ ok: true, msg: "Email enviado correctamente." });
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
        style={{ width: "min(520px,100%)", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 40px rgba(0,0,0,0.16)", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1rem", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Enviar encuesta de satisfacción</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#64748b", fontSize: "1.3rem", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
          {/* Destinatario */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Nombre del destinatario</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del cliente"
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Email del destinatario *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "0.45rem 0.7rem", fontSize: "0.85rem", color: "#0f172a", outline: "none" }}
            />
          </div>

          {/* Selección de servicios */}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>Servicios a valorar</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSelected(new Set(servicios.map((s) => s.id)))} style={{ fontSize: "0.72rem", color: "#475569", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Todos</button>
                <button onClick={() => setSelected(new Set())} style={{ fontSize: "0.72rem", color: "#475569", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Ninguno</button>
              </div>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              {servicios.map((s, i) => (
                <label
                  key={s.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.6rem 0.8rem", cursor: "pointer", background: selected.has(s.id) ? "color-mix(in srgb, var(--primary-color,#475569) 6%, white)" : "#fff", borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    style={{ accentColor: "var(--primary-color,#475569)", width: 15, height: 15, flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", color: "#0f172a", fontWeight: selected.has(s.id) ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.descripcion || "(Sin descripción)"}
                    </div>
                    {s.tipo_label && (
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{s.tipo_label}</div>
                    )}
                  </div>
                </label>
              ))}
              {servicios.length === 0 && (
                <div style={{ padding: "1rem", fontSize: "0.82rem", color: "#94a3b8", textAlign: "center" }}>
                  No hay servicios en este expediente.
                </div>
              )}
            </div>
            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
              {selected.size} de {servicios.length} servicios seleccionados
            </div>
          </div>

          {result && (
            <div style={{ padding: "0.6rem 0.8rem", borderRadius: 6, background: result.ok ? "#dcfce7" : "#fee2e2", color: result.ok ? "#15803d" : "#dc2626", fontSize: "0.82rem" }}>
              {result.msg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0.9rem 1rem", borderTop: "1px solid #e2e8f0", marginTop: "auto" }}>
          <button onClick={onClose} style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "0.45rem 0.8rem", cursor: "pointer", fontSize: "0.85rem" }}>
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0 || !email.includes("@") || !!result?.ok}
            style={{ border: "none", background: "var(--primary-color,#475569)", color: "#fff", borderRadius: 6, padding: "0.45rem 0.9rem", cursor: sending || selected.size === 0 || !email.includes("@") || !!result?.ok ? "default" : "pointer", opacity: sending || selected.size === 0 || !email.includes("@") ? 0.6 : 1, fontSize: "0.85rem", fontWeight: 600 }}
          >
            {sending ? "Enviando..." : "Enviar encuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}
