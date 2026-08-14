"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";

export type Etiqueta = { id: string; nombre: string; color: string };
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

/**
 * Selector de etiquetas para una entidad/cliente.
 * - Con `entidadId`: persiste la asignación en el servidor de inmediato (modo edición).
 * - Sin `entidadId`: modo controlado en memoria vía `value`/`onChange` (para formularios
 *   de creación, donde la entidad todavía no existe). Crear etiquetas nuevas sigue
 *   persistiendo en crm_etiquetas de inmediato; solo la asignación queda en memoria.
 *
 * El picker de etiquetas disponibles se filtra por 3 pestañas: mías / mi sucursal / agencia.
 */
export function EtiquetasSelector({
  entidadId,
  value,
  onChange,
  label,
  onCountChange,
}: {
  entidadId?: string;
  value?: Etiqueta[];
  onChange?: (etiquetas: Etiqueta[]) => void;
  label?: string;
  onCountChange?: (count: number) => void;
}) {
  const controlado = entidadId == null;
  const [asignadasInternas, setAsignadasInternas] = useState<Etiqueta[]>([]);
  const asignadas = controlado ? (value ?? []) : asignadasInternas;

  useEffect(() => { onCountChange?.(asignadas.length); }, [asignadas.length]);

  const [scope, setScope] = useState<Scope>("agencia");
  const [disponibles, setDisponibles] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [showNuevaEtiqueta, setShowNuevaEtiqueta] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
        setShowNuevaEtiqueta(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (entidadId) {
      setLoading(true);
      fetch(`/api/entidades/${entidadId}/etiquetas`).then(r => r.json())
        .then(asig => setAsignadasInternas(asig.success ? asig.data : []))
        .finally(() => setLoading(false));
    }
  }, [entidadId]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/crm/etiquetas?scope=${scope}`).then(r => r.json())
      .then(disp => setDisponibles(disp.success ? disp.data : []))
      .finally(() => setLoading(false));
  }, [scope]);

  async function asignar(etiquetaId: string) {
    const etiqueta = disponibles.find(e => e.id === etiquetaId);
    if (!etiqueta) return;

    if (controlado) {
      onChange?.([...asignadas, etiqueta]);
      return;
    }

    setAsignadasInternas(prev => [...prev, etiqueta]);
    try {
      await fetch(`/api/entidades/${entidadId}/etiquetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta_id: etiquetaId }),
      });
    } catch {
      setAsignadasInternas(prev => prev.filter(e => e.id !== etiquetaId));
    }
  }

  async function quitar(etiquetaId: string) {
    if (controlado) {
      onChange?.(asignadas.filter(e => e.id !== etiquetaId));
      return;
    }

    setAsignadasInternas(prev => prev.filter(e => e.id !== etiquetaId));
    try {
      await fetch(`/api/entidades/${entidadId}/etiquetas?etiqueta_id=${etiquetaId}`, { method: "DELETE" });
    } catch {
      // no-op: la próxima carga reflejará el estado real
    }
  }

  async function crearYAsignar() {
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
      setDisponibles(prev => [...prev, json.data]);
      const etiqueta = json.data as Etiqueta;
      if (controlado) onChange?.([...asignadas, etiqueta]);
      else await asignar(etiqueta.id);
      setNuevoNombre("");
      setShowNuevaEtiqueta(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreando(false);
    }
  }

  const asignadasIds = new Set(asignadas.map(e => e.id));
  const seleccionables = disponibles.filter(e => !asignadasIds.has(e.id));

  return (
    <div style={{ position: "relative" }} ref={pickerRef}>
      {label && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>{label}</span>
          {!showPicker && (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 600, color: "var(--primary-color, #475569)", background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0.3rem", borderRadius: 4 }}
            >
              <Plus size={12} /> Añadir
            </button>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {asignadas.map(e => (
          <span
            key={e.id}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 99, fontSize: "0.7rem", fontWeight: 600,
              background: `color-mix(in srgb, ${e.color} 16%, white)`,
              color: e.color, border: `1px solid color-mix(in srgb, ${e.color} 35%, white)`,
            }}
          >
            {e.nombre}
            <button
              type="button"
              onClick={() => quitar(e.id)}
              style={{ display: "flex", border: "none", background: "transparent", cursor: "pointer", color: "inherit", opacity: 0.7, padding: 0 }}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {!label && !showPicker && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 600, color: "var(--primary-color, #475569)", background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0.3rem", borderRadius: 4 }}
          >
            <Plus size={12} /> Añadir
          </button>
        )}
      </div>

      {showPicker && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
          boxShadow: "0 8px 32px rgba(15,23,42,0.14)", minWidth: 240, padding: "0.4rem 0", fontSize: "0.8rem",
        }}>
          <div style={{ display: "flex", gap: 2, padding: "0 0.5rem 0.4rem", borderBottom: "1px solid #f1f5f9", marginBottom: 2 }}>
            {(["agente", "sucursal", "agencia"] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                style={{
                  flex: 1, padding: "0.3rem 0.4rem", fontSize: "0.68rem", fontWeight: 600,
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
            <div style={{ padding: "0.5rem 0.85rem", color: "#94a3b8" }}>Cargando…</div>
          ) : (
            <>
              {seleccionables.length === 0 && !showNuevaEtiqueta && (
                <div style={{ padding: "0.5rem 0.85rem", color: "#94a3b8", fontStyle: "italic" }}>Sin etiquetas disponibles</div>
              )}
              {seleccionables.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { asignar(e.id); setShowPicker(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "0.4rem 0.85rem", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", color: "#1e293b" }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={ev => (ev.currentTarget.style.background = "")}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{e.nombre}</span>
                </button>
              ))}

              {!showNuevaEtiqueta ? (
                <button
                  type="button"
                  onClick={() => setShowNuevaEtiqueta(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "0.4rem 0.85rem", border: "none", borderTop: "1px solid #f1f5f9", marginTop: 2, background: "transparent", cursor: "pointer", color: "var(--primary-color, #475569)", fontWeight: 600 }}
                >
                  <Plus size={12} /> Nueva etiqueta
                </button>
              ) : (
                <div style={{ padding: "0.5rem 0.85rem", borderTop: "1px solid #f1f5f9", marginTop: 2, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <input
                    autoFocus
                    value={nuevoNombre}
                    onChange={ev => setNuevoNombre(ev.target.value)}
                    placeholder="Nombre de la etiqueta"
                    style={{ width: "100%", padding: "0.35rem 0.5rem", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: "0.78rem", fontFamily: "inherit" }}
                  />
                  {error && <p style={{ fontSize: "0.7rem", color: "#dc2626", margin: 0 }}>{error}</p>}
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => { setShowNuevaEtiqueta(false); setError(null); }} style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                    <button type="button" onClick={crearYAsignar} disabled={creando || !nuevoNombre.trim()} style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem", border: "none", borderRadius: 6, background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", opacity: creando || !nuevoNombre.trim() ? 0.6 : 1 }}>
                      {creando ? "Creando…" : "Crear"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
