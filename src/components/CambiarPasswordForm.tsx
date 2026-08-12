"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function CambiarPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    setPassword("");
    setConfirm("");
  }

  const inp: React.CSSProperties = { width: "100%", fontSize: "0.85rem", padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid #e2e8f0", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: 6 };

  return (
    <div style={{ maxWidth: 380 }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}>Cambiar contraseña</h3>
      <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1.25rem" }}>
        Actualiza la contraseña de tu cuenta. Deberás usarla la próxima vez que inicies sesión.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div>
          <label style={lbl}>Nueva contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            style={inp}
            required
          />
        </div>
        <div>
          <label style={lbl}>Confirmar contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repite la contraseña"
            style={inp}
            required
          />
        </div>
        {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>}
        {success && <p style={{ fontSize: "0.78rem", color: "#16a34a", margin: 0 }}>Contraseña actualizada correctamente.</p>}
        <button
          type="submit"
          disabled={saving}
          style={{ alignSelf: "flex-start", padding: "0.5rem 1.1rem", borderRadius: 8, border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}
