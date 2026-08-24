"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Plus, Loader2, Check } from "lucide-react";
import styles from "../page.module.css";
import {
  buscarEntidades,
  buscarEntidadesAvanzado,
  getAgentesConSucursal,
  getTiposClienteOptions,
} from "@/actions/entidades";
import { SIN_AGENTE_ID } from "@/lib/filtrosClientes";
import SucursalAgenteFilter, { type AgenteOpcion } from "@/app/components/SucursalAgenteFilter";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";

export type EntidadEncontrada = { id: string; nombre: string; localidad?: string | null };

type TipoCliente = { id: string; etiqueta: string };

// Primer paso del flujo "+" del listado de oportunidades: elegir si la oportunidad
// es de un cliente ya existente (buscador con autocomplete + filtros) o de uno nuevo
// (delega en NuevoClientePanel, ya existente, desde el componente padre).
export function AnadirOportunidadModal({
  onClose,
  onClientesSeleccionados,
  onClienteNuevo,
  entidadesExcluidas = [],
}: {
  onClose: () => void;
  onClientesSeleccionados: (entidades: EntidadEncontrada[]) => void;
  onClienteNuevo: () => void;
  entidadesExcluidas?: string[];
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<EntidadEncontrada[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [huboBusqueda, setHuboBusqueda] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Map<string, EntidadEncontrada>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleSeleccion(ent: EntidadEncontrada) {
    setSeleccionados((prev) => {
      const next = new Map(prev);
      if (next.has(ent.id)) next.delete(ent.id);
      else next.set(ent.id, ent);
      return next;
    });
  }

  const [agenteOptions, setAgenteOptions] = useState<AgenteOpcion[]>([]);
  const [tipoClienteOptions, setTipoClienteOptions] = useState<TipoCliente[]>([]);
  const [selectedAgentes, setSelectedAgentes] = useState<string[]>([]);
  const [selectedSucursales, setSelectedSucursales] = useState<string[]>([]);
  const [selectedTiposEtiquetas, setSelectedTiposEtiquetas] = useState<string[]>([]);

  useEffect(() => {
    getAgentesConSucursal().then((agentes) => {
      setAgenteOptions([...agentes, { id: SIN_AGENTE_ID, nombre: "Sin agente asignado", sucursal: null }]);
    });
    getTiposClienteOptions().then(setTipoClienteOptions);
  }, []);

  const selectedTipoIds = tipoClienteOptions
    .filter((t) => selectedTiposEtiquetas.includes(t.etiqueta))
    .map((t) => t.id);

  const hayFiltrosActivos = selectedAgentes.length > 0 || selectedSucursales.length > 0 || selectedTiposEtiquetas.length > 0;

  // Búsqueda por texto libre (sin filtros): comportamiento original, con debounce
  useEffect(() => {
    if (hayFiltrosActivos) return;
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
        setResultados(data.filter((e) => !entidadesExcluidas.includes(e.id)));
      } finally {
        setBuscando(false);
        setHuboBusqueda(true);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, hayFiltrosActivos, entidadesExcluidas]);

  async function handleBuscarConFiltros() {
    setBuscando(true);
    try {
      const data = await buscarEntidadesAvanzado({
        query: query.trim() || undefined,
        agenteIds: selectedAgentes,
        tipoClienteIds: selectedTipoIds,
        excluirIds: entidadesExcluidas,
      });
      setResultados(data.map((e) => ({ id: e.id, nombre: e.nombre, localidad: e.localidad })));
    } finally {
      setBuscando(false);
      setHuboBusqueda(true);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ width: 460 }}>
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

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <SucursalAgenteFilter
              agentes={agenteOptions}
              selectedAgentes={selectedAgentes}
              onChangeAgentes={setSelectedAgentes}
              selectedSucursales={selectedSucursales}
              onChangeSucursales={setSelectedSucursales}
              placeholder="Sucursal / agente"
            />
            <MultiSelectDropdown
              options={tipoClienteOptions.map((t) => t.etiqueta)}
              selected={selectedTiposEtiquetas}
              onChange={setSelectedTiposEtiquetas}
              placeholder="Tipo de cliente"
            />
          </div>

          <button
            onClick={handleBuscarConFiltros}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              width: "100%", marginTop: "0.5rem", padding: "0.6rem 1rem",
              border: "none", borderRadius: "0.5rem",
              background: "var(--primary-color, #7c3aed)", color: "#fff",
              fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
            }}
          >
            <Search size={14} />
            Buscar
          </button>

          {!buscando && huboBusqueda && resultados.length > 0 && (
            <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "0.75rem 0 0.3rem", fontWeight: 600 }}>
              {resultados.length} resultado{resultados.length > 1 ? "s" : ""}
            </p>
          )}

          <div style={{ minHeight: "60px", maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: huboBusqueda && resultados.length > 0 ? 0 : "0.75rem" }}>
            {buscando ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "1.25rem 0" }}>
                <Loader2 size={18} className="animate-spin" style={{ color: "#94a3b8" }} />
              </div>
            ) : resultados.length > 0 ? (
              resultados.map((ent) => {
                const marcado = seleccionados.has(ent.id);
                return (
                  <button
                    key={ent.id}
                    onClick={() => toggleSeleccion(ent)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem",
                      border: marcado ? "1px solid var(--primary-color, #7c3aed)" : "1px solid #e2e8f0",
                      background: marcado ? "color-mix(in srgb, var(--primary-color, #7c3aed) 8%, white)" : "#fff",
                      borderRadius: "0.4rem", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 15, height: 15, borderRadius: "0.25rem", flexShrink: 0,
                      border: marcado ? "1px solid var(--primary-color, #7c3aed)" : "1px solid #cbd5e1",
                      background: marcado ? "var(--primary-color, #7c3aed)" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {marcado && <Check size={10} color="#fff" />}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "0.05rem" }}>
                      <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "#0f172a" }}>{ent.nombre}</span>
                      {ent.localidad && (
                        <span style={{ fontSize: "0.66rem", color: "#64748b" }}>{ent.localidad}</span>
                      )}
                    </span>
                  </button>
                );
              })
            ) : huboBusqueda ? (
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", padding: "1rem 0" }}>
                Sin resultados para "{query}".
              </p>
            ) : null}
          </div>

          {seleccionados.size > 0 && (
            <button
              onClick={() => onClientesSeleccionados(Array.from(seleccionados.values()))}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                width: "100%", marginTop: "0.75rem", padding: "0.65rem 1rem",
                border: "none", borderRadius: "0.5rem", background: "var(--primary-color, #7c3aed)",
                color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
              }}
            >
              Continuar con {seleccionados.size} seleccionado{seleccionados.size > 1 ? "s" : ""}
            </button>
          )}

          <button
            onClick={onClienteNuevo}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              width: "100%", marginTop: "0.5rem", padding: "0.65rem 1rem",
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
