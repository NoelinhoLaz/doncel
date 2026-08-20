"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search } from "lucide-react";
import { getAgentes } from "@/actions/crm";
import { reasignarAgenteMasivo } from "@/actions/entidades";

type Agente = { id: string; nombre: string; apellidos?: string | null; avatar_url?: string | null; sucursal?: string | null };

export default function ReasignarAgenteMasivoModal({
  entidadIds,
  onClose,
  onApplied,
}: {
  entidadIds: string[];
  onClose: () => void;
  onApplied: (agente: Agente) => void;
}) {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [aplicandoId, setAplicandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAgentes()
      .then((data: any[]) => setAgentes(data || []))
      .catch(() => setAgentes([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredAgentes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agentes;
    return agentes.filter((a) =>
      `${a.nombre} ${a.apellidos || ""}`.toLowerCase().includes(term)
    );
  }, [agentes, search]);

  async function reasignar(agente: Agente) {
    setAplicandoId(agente.id);
    setError(null);
    try {
      const res = await reasignarAgenteMasivo(entidadIds, agente.id);
      if (!res.success) throw new Error(res.error || "Error al reasignar el agente");
      onApplied(agente);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Error al reasignar el agente");
    } finally {
      setAplicandoId(null);
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
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Reasignar agente</span>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "#f1f5f9", borderRadius: "50%", color: "#64748b", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "1rem 1.5rem 0" }}>
          <div style={{ background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 10, padding: "0.6rem 0.85rem", fontSize: "0.82rem", color: "#1e40af" }}>
            Se reasignará a <strong>{entidadIds.length}</strong> cliente{entidadIds.length === 1 ? "" : "s"} filtrado{entidadIds.length === 1 ? "" : "s"}.
          </div>
        </div>

        <div style={{ padding: "1rem 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem", overflowY: "auto" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              autoFocus
              placeholder="Buscar agente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.65rem 0.5rem 2rem", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.85rem", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>

          {loading ? (
            <div style={{ padding: "0.75rem 0", color: "#94a3b8", fontSize: "0.82rem", textAlign: "center" }}>Cargando…</div>
          ) : filteredAgentes.length === 0 ? (
            <div style={{ padding: "0.5rem 0", color: "#94a3b8", fontStyle: "italic", fontSize: "0.82rem" }}>Sin agentes que coincidan</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto" }}>
              {filteredAgentes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => reasignar(a)}
                  disabled={aplicandoId !== null}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "0.5rem 0.6rem", border: "none", borderRadius: 8, background: "transparent", cursor: aplicandoId ? "default" : "pointer", textAlign: "left", color: "#1e293b", opacity: aplicandoId && aplicandoId !== a.id ? 0.5 : 1 }}
                  onMouseEnter={(ev) => { if (!aplicandoId) ev.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: "#e2e8f0", color: "#475569", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>
                    {a.nombre?.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre} {a.apellidos || ""}</div>
                    {a.sucursal && <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{a.sucursal}</div>}
                  </span>
                  {aplicandoId === a.id && (
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", flexShrink: 0 }}>Aplicando…</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
