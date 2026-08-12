"use client";

import { useState, useRef } from "react";
import { X, Mail, AlertTriangle, Upload, FileText, Plus } from "lucide-react";
import { sendCotizacionEmail } from "@/actions/comunicaciones";
import { formatBytes } from "@/app/expedientes/[id]/components/comunicaciones.types";

interface Props {
  cotizacionId?: string | null;
  destinatario: { nombre: string; email: string };
  onClose: () => void;
  onSent: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1.5px solid #e2e8f0", borderRadius: "8px", padding: "0.5rem 0.75rem",
  fontSize: "0.83rem", color: "#0f172a", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem",
};

function EmailChips({ emails, onRemove }: { emails: string[]; onRemove: (email: string) => void }) {
  if (emails.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.4rem" }}>
      {emails.map((e) => (
        <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "0.18rem 0.5rem 0.18rem 0.55rem", fontSize: "0.73rem", fontWeight: 600 }}>
          {e}
          <button onClick={() => onRemove(e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#94a3b8", display: "flex" }}>
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

function EmailAddRow({ value, onChange, onAdd, placeholder }: { value: string; onChange: (v: string) => void; onAdd: () => void; placeholder: string }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <input
        type="email"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
        style={{ ...inputStyle, flex: 1 }}
      />
      <button
        onClick={onAdd}
        disabled={!value.trim()}
        style={{ padding: "0.42rem 0.75rem", borderRadius: "8px", border: "none", background: value.trim() ? "var(--primary-color, #475569)" : "#e2e8f0", color: value.trim() ? "#fff" : "#94a3b8", cursor: value.trim() ? "pointer" : "default", display: "flex", alignItems: "center" }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export function EnviarMailProveedorModal({ cotizacionId, destinatario, onClose, onSent }: Props) {
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCc, setShowCc] = useState(false);
  const [showCco, setShowCco] = useState(false);
  const [ccInput, setCcInput] = useState("");
  const [ccoInput, setCcoInput] = useState("");
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccoList, setCcoList] = useState<string[]>([]);

  const tieneEmail = !!destinatario.email && destinatario.email.includes("@");

  const addCc = () => {
    const v = ccInput.trim();
    if (!v || !v.includes("@") || ccList.includes(v)) return;
    setCcList((prev) => [...prev, v]);
    setCcInput("");
  };
  const addCco = () => {
    const v = ccoInput.trim();
    if (!v || !v.includes("@") || ccoList.includes(v)) return;
    setCcoList((prev) => [...prev, v]);
    setCcoInput("");
  };

  const canSend = tieneEmail && cuerpo.trim().length > 0 && !enviando;

  const handleEnviar = async () => {
    if (!canSend) return;
    setEnviando(true);
    setError(null);

    const adjuntosB64 = await Promise.all(
      adjuntos.map((f) => new Promise<{ nombre: string; tamanio: number; contenido: string; tipo: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ nombre: f.name, tamanio: f.size, contenido: (reader.result as string).split(",")[1] || "", tipo: f.type });
        reader.onerror = reject;
        reader.readAsDataURL(f);
      }))
    );

    const res = await sendCotizacionEmail({
      cotizacionId,
      to: destinatario.email,
      toNombre: destinatario.nombre,
      cc: ccList,
      cco: ccoList,
      asunto: asunto || "(Sin asunto)",
      cuerpo,
      adjuntos: adjuntosB64,
    });

    setEnviando(false);
    if (res.success) { onClose(); onSent(); }
    else setError(res.error || "Error desconocido.");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "560px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "color-mix(in srgb, var(--primary-color, #475569), transparent 88%)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-color, #475569)" }}>
              <Mail size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Enviar email al proveedor</h3>
              <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Se envía desde tu cuenta de correo configurada</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

          {/* Para */}
          <div>
            <label style={labelStyle}>Para</label>
            {tieneEmail ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#0f172a" }}>{destinatario.nombre}</span>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{destinatario.email}</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.75rem", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: "8px", color: "#92400e", fontSize: "0.8rem" }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                {destinatario.nombre ? `${destinatario.nombre} no tiene email registrado.` : "Este servicio no tiene proveedor asignado."} Añade el email en la ficha del proveedor.
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              {!showCc && (
                <button onClick={() => setShowCc(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--primary-color, #475569)", fontWeight: 600, padding: 0 }}>
                  + CC
                </button>
              )}
              {!showCco && (
                <button onClick={() => setShowCco(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--primary-color, #475569)", fontWeight: 600, padding: 0 }}>
                  + CCO
                </button>
              )}
            </div>
          </div>

          {/* CC */}
          {showCc && (
            <div>
              <label style={labelStyle}>CC</label>
              <EmailAddRow value={ccInput} onChange={setCcInput} onAdd={addCc} placeholder="Email en copia..." />
              <EmailChips emails={ccList} onRemove={(e) => setCcList((prev) => prev.filter((x) => x !== e))} />
            </div>
          )}

          {/* CCO */}
          {showCco && (
            <div>
              <label style={labelStyle}>CCO</label>
              <EmailAddRow value={ccoInput} onChange={setCcoInput} onAdd={addCco} placeholder="Email en copia oculta..." />
              <EmailChips emails={ccoList} onRemove={(e) => setCcoList((prev) => prev.filter((x) => x !== e))} />
            </div>
          )}

          {/* Asunto */}
          <div>
            <label style={labelStyle}>Asunto</label>
            <input
              type="text"
              placeholder="Escribe el asunto del email..."
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary-color, #475569)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
            />
          </div>

          {/* Mensaje */}
          <div>
            <label style={labelStyle}>Mensaje</label>
            <textarea
              placeholder="Escribe el cuerpo del email..."
              rows={6}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary-color, #475569)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
            />
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.75rem 0.85rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.78rem", color: "#dc2626" }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
              {error === "GMAIL_AUTH_FAILED" ? (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>Error de autenticación con Gmail</div>
                  <div style={{ color: "#7f1d1d", lineHeight: 1.5 }}>
                    Gmail no acepta contraseñas normales en SMTP. Debes usar una <strong>Contraseña de aplicación</strong> guardada en Ajustes → Correo.
                  </div>
                </div>
              ) : error}
            </div>
          )}

          {/* Adjuntos */}
          <div>
            <label style={labelStyle}>Adjuntos</label>
            <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => { setAdjuntos((prev) => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
            {adjuntos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.5rem" }}>
                {adjuntos.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.35rem 0.65rem", background: "#f8fafc", borderRadius: "7px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                      <FileText size={13} style={{ color: "#64748b", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.77rem", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                      <span style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0 }}>{formatBytes(f.size)}</span>
                    </div>
                    <button onClick={() => setAdjuntos((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0 0 0 0.5rem", display: "flex" }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.4rem 0.85rem", borderRadius: "8px", border: "1.5px dashed #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: "0.79rem", fontWeight: 500, cursor: "pointer", width: "100%", justifyContent: "center" }}
            >
              <Upload size={13} /> Adjuntar archivo
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem", flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "0.45rem 1rem", borderRadius: "8px", border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            disabled={!canSend}
            onClick={handleEnviar}
            style={{ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: canSend ? "var(--primary-color, #475569)" : "#e2e8f0", color: canSend ? "#fff" : "#94a3b8", fontWeight: 600, fontSize: "0.82rem", cursor: canSend ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Mail size={14} />
            {enviando ? "Enviando..." : "Enviar Email"}
          </button>
        </div>
      </div>
    </div>
  );
}
