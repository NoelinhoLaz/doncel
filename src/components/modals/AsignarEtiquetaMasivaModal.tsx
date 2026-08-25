"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { asignarEtiquetaMasiva } from "@/actions/etiquetas";

type Etiqueta = { id: string; nombre: string; color: string };
type Scope = "agente" | "sucursal" | "agencia";

const SCOPE_LABEL: Record<Scope, string> = {
  agente: "Mías",
  sucursal: "Sucursal",
  agencia: "Agencia",
};

const PALETA_COLORES = ["#0ea5e9", "#8b5cf6", "#f97316", "#10b981", "#ec4899", "#f59e0b", "#6366f1", "#14b8a6"];

function colorAleatorio() {
  return PALETA_COLORES[Math.floor(Math.random() * PALETA_COLORES.length)];
}

export default function AsignarEtiquetaMasivaModal({
  entidadIds,
  onClose,
  onApplied,
}: {
  entidadIds: string[];
  onClose: () => void;
  onApplied: (etiquetas: Etiqueta[]) => void;
}) {
  const [scope, setScope] = useState<Scope>("agencia");
  const [disponibles, setDisponibles] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNuevaEtiqueta, setShowNuevaEtiqueta] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Etiqueta[]>([]);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/crm/etiquetas?scope=${scope}`)
      .then((r) => r.json())
      .then((j) => setDisponibles(j.success ? j.data : []))
      .finally(() => setLoading(false));
  }, [scope]);

  function toggleSeleccion(etiqueta: Etiqueta) {
    setSeleccionadas((prev) =>
      prev.some((e) => e.id === etiqueta.id) ? prev.filter((e) => e.id !== etiqueta.id) : [...prev, etiqueta]
    );
  }

  async function aplicarSeleccionadas() {
    if (seleccionadas.length === 0) return;
    setAplicando(true);
    setError(null);
    try {
      await Promise.all(seleccionadas.map((e) => asignarEtiquetaMasiva(entidadIds, e.id)));
      onApplied(seleccionadas);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Error al asignar las etiquetas");
    } finally {
      setAplicando(false);
    }
  }

  async function crearYSeleccionar() {
    if (!nuevoNombre.trim()) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), color: colorAleatorio() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error al crear etiqueta");
      const nueva = json.data as Etiqueta;
      setDisponibles((prev) => [...prev, nueva]);
      setSeleccionadas((prev) => [...prev, nueva]);
      setNuevoNombre("");
      setShowNuevaEtiqueta(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: "1.25rem", boxShadow: "0 24px 64px rgba(15,23,42,0.18)", width: 380, maxWidth: "calc(100vw - 2rem)", maxHeight: "calc(100vh - 4rem)", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Añadir etiqueta</span>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "#f1f5f9", borderRadius: "50%", color: "#64748b", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "1rem 1.5rem 0" }}>
          <div style={{ background: "#f5f3ff", border: "1px solid #ede9fe", borderRadius: 10, padding: "0.6rem 0.85rem", fontSize: "0.82rem", color: "#5b21b6" }}>
            Se añadirá a <strong>{entidadIds.length}</strong> cliente{entidadIds.length === 1 ? "" : "s"} filtrado{entidadIds.length === 1 ? "" : "s"}.
          </div>
        </div>

        <div style={{ padding: "1rem 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #f1f5f9", paddingBottom: "0.4rem" }}>
            {(["agente", "sucursal", "agencia"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                style={{
                  flex: 1, padding: "0.35rem 0.4rem", fontSize: "0.72rem", fontWeight: 600,
                  border: "none", borderRadius: 6, cursor: "pointer",
                  background: scope === s ? "var(--primary-color, #475569)" : "transparent",
                  color: scope === s ? "#fff" : "#64748b",
                }}
              >
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "0.75rem 0", color: "#94a3b8", fontSize: "0.82rem", textAlign: "center" }}>Cargando…</div>
          ) : (
            <>
              {disponibles.length === 0 && !showNuevaEtiqueta && (
                <div style={{ padding: "0.5rem 0", color: "#94a3b8", fontStyle: "italic", fontSize: "0.82rem" }}>Sin etiquetas disponibles</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 220, overflowY: "auto" }}>
                {disponibles.map((e) => {
                  const checked = seleccionadas.some((s) => s.id === e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleSeleccion(e)}
                      disabled={aplicando}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "0.5rem 0.6rem", border: "none", borderRadius: 8, background: checked ? "#f8fafc" : "transparent", cursor: aplicando ? "default" : "pointer", textAlign: "left", color: "#1e293b" }}
                      onMouseEnter={(ev) => { if (!aplicando) ev.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = checked ? "#f8fafc" : "transparent")}
                    >
                      <input type="checkbox" checked={checked} readOnly style={{ margin: 0, cursor: "pointer" }} />
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: "0.85rem" }}>{e.nombre}</span>
                    </button>
                  );
                })}
              </div>

              {!showNuevaEtiqueta ? (
                <button
                  type="button"
                  onClick={() => setShowNuevaEtiqueta(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "0.5rem 0.6rem", border: "none", borderTop: "1px solid #f1f5f9", marginTop: 4, paddingTop: "0.75rem", background: "transparent", cursor: "pointer", color: "var(--primary-color, #475569)", fontWeight: 600, fontSize: "0.82rem" }}
                >
                  <Plus size={14} /> Crear nueva etiqueta
                </button>
              ) : (
                <div style={{ padding: "0.6rem 0", borderTop: "1px solid #f1f5f9", marginTop: 4, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <input
                    autoFocus
                    value={nuevoNombre}
                    onChange={(ev) => setNuevoNombre(ev.target.value)}
                    placeholder="Nombre de la etiqueta"
                    style={{ width: "100%", padding: "0.5rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.85rem", fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => { setShowNuevaEtiqueta(false); setNuevoNombre(""); setError(null); }} style={{ padding: "0.4rem 0.75rem", fontSize: "0.78rem", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                    <button type="button" onClick={crearYSeleccionar} disabled={creando || !nuevoNombre.trim()} style={{ padding: "0.4rem 0.75rem", fontSize: "0.78rem", border: "none", borderRadius: 8, background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", opacity: creando || !nuevoNombre.trim() ? 0.6 : 1 }}>
                      {creando ? "Creando…" : "Crear y seleccionar"}
                    </button>
                  </div>
                </div>
              )}

              {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>}
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0.85rem 1.5rem", borderTop: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
            {seleccionadas.length === 0 ? "Ninguna etiqueta seleccionada" : `${seleccionadas.length} etiqueta${seleccionadas.length === 1 ? "" : "s"} seleccionada${seleccionadas.length === 1 ? "" : "s"}`}
          </span>
          <button
            type="button"
            onClick={aplicarSeleccionadas}
            disabled={seleccionadas.length === 0 || aplicando}
            style={{ padding: "0.5rem 1rem", fontSize: "0.82rem", fontWeight: 600, border: "none", borderRadius: 8, background: "var(--primary-color, #475569)", color: "#fff", cursor: seleccionadas.length === 0 || aplicando ? "default" : "pointer", opacity: seleccionadas.length === 0 || aplicando ? 0.5 : 1 }}
          >
            {aplicando ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
