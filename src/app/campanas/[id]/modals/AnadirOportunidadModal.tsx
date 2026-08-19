"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Plus, Loader2 } from "lucide-react";
import styles from "../page.module.css";
import { buscarEntidades } from "@/actions/entidades";

export type EntidadEncontrada = { id: string; nombre: string; localidad?: string | null };

// Primer paso del flujo "+" del listado de oportunidades: elegir si la oportunidad
// es de un cliente ya existente (buscador con autocomplete) o de uno nuevo
// (delega en NuevoClientePanel, ya existente, desde el componente padre).
export function AnadirOportunidadModal({
  onClose,
  onClienteExistente,
  onClienteNuevo,
}: {
  onClose: () => void;
  onClienteExistente: (entidad: EntidadEncontrada) => void;
  onClienteNuevo: () => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<EntidadEncontrada[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [huboBusqueda, setHuboBusqueda] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResultados([]);
      setHuboBusqueda(false);
      return;
    }
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await buscarEntidades(query.trim());
        setResultados(data);
      } finally {
        setBuscando(false);
        setHuboBusqueda(true);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Añadir oportunidad</span>
          <button className={styles.btnClose} onClick={onClose}><X size={15} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}>Buscar cliente existente</label>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                autoFocus
                className={styles.input}
                style={{ width: "100%", boxSizing: "border-box", paddingLeft: "2rem" }}
                type="text"
                placeholder="Nombre del cliente o centro..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{ minHeight: "60px", maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {buscando ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "1.25rem 0" }}>
                <Loader2 size={18} className="animate-spin" style={{ color: "#94a3b8" }} />
              </div>
            ) : resultados.length > 0 ? (
              resultados.map((ent) => (
                <button
                  key={ent.id}
                  onClick={() => onClienteExistente(ent)}
                  style={{
                    display: "flex", flexDirection: "column", gap: "0.1rem", padding: "0.6rem 0.75rem",
                    border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#0f172a" }}>{ent.nombre}</span>
                  {ent.localidad && (
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{ent.localidad}</span>
                  )}
                </button>
              ))
            ) : huboBusqueda ? (
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", padding: "1rem 0" }}>
                Sin resultados para "{query}".
              </p>
            ) : null}
          </div>

          <button
            onClick={onClienteNuevo}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              width: "100%", marginTop: "0.75rem", padding: "0.65rem 1rem",
              border: "1px dashed #cbd5e1", borderRadius: "0.5rem", background: "#f8fafc",
              color: "#475569", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={15} />
            El cliente no existe, crear uno nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
