"use client";

import { useState, useEffect } from "react";
import { getCurrentUsuario, updateMiPerfil } from "@/actions/usuarios";

export function MiPerfilForm() {
  const [form, setForm] = useState({ nombre: "", apellidos: "", email: "", telefono: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getCurrentUsuario().then(u => {
      if (u) {
        setForm({
          nombre: u.nombre || "",
          apellidos: u.apellidos || "",
          email: u.email || "",
          telefono: u.telefono || "",
        });
      }
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await updateMiPerfil(form);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = { width: "100%", fontSize: "0.85rem", padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid #e2e8f0", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: 6 };

  if (loading) return <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Cargando…</div>;

  return (
    <div style={{ maxWidth: 380 }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}>Mis datos</h3>
      <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1.25rem" }}>
        Actualiza tu nombre, teléfono y email.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div>
          <label style={lbl}>Nombre</label>
          <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} style={inp} required />
        </div>
        <div>
          <label style={lbl}>Apellidos</label>
          <input value={form.apellidos} onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))} style={inp} />
        </div>
        <div>
          <label style={lbl}>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inp} required />
        </div>
        <div>
          <label style={lbl}>Teléfono</label>
          <input type="tel" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} style={inp} placeholder="Ej: +34 600000000" />
        </div>
        {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>}
        {success && <p style={{ fontSize: "0.78rem", color: "#16a34a", margin: 0 }}>Datos actualizados correctamente.</p>}
        <button
          type="submit"
          disabled={saving}
          style={{ alignSelf: "flex-start", padding: "0.5rem 1.1rem", borderRadius: 8, border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Guardando…" : "Guardar datos"}
        </button>
      </form>
    </div>
  );
}
