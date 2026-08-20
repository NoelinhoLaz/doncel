"use client";

import { useState, useRef, useEffect } from "react";
import { Icons } from "@/lib/icons";
import styles from "./MultiSelectDropdown.module.css";

export type AgenteOpcion = { id: string; nombre: string; sucursal: string | null };

interface SucursalAgenteFilterProps {
  agentes: AgenteOpcion[];
  selectedAgentes: string[];
  onChangeAgentes: (ids: string[]) => void;
  selectedSucursales: string[];
  onChangeSucursales: (nombres: string[]) => void;
  placeholder?: string;
}

const SIN_SUCURSAL = "Sin sucursal";

export default function SucursalAgenteFilter({
  agentes,
  selectedAgentes,
  onChangeAgentes,
  selectedSucursales,
  onChangeSucursales,
  placeholder = "Todas las agencias",
}: SucursalAgenteFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const grupos = new Map<string, AgenteOpcion[]>();
  for (const a of agentes) {
    const key = a.sucursal ?? SIN_SUCURSAL;
    const list = grupos.get(key) ?? [];
    list.push(a);
    grupos.set(key, list);
  }
  const sucursalesOrdenadas = Array.from(grupos.keys()).sort((a, b) => a.localeCompare(b));

  const q = searchTerm.toLowerCase();
  const sucursalesFiltradas = sucursalesOrdenadas
    .map((suc) => ({
      suc,
      agentesGrupo: (grupos.get(suc) ?? []).filter((a) => a.nombre.toLowerCase().includes(q) || suc.toLowerCase().includes(q)),
    }))
    .filter(({ suc, agentesGrupo }) => agentesGrupo.length > 0 || suc.toLowerCase().includes(q));

  function toggleAgente(id: string) {
    onChangeAgentes(selectedAgentes.includes(id) ? selectedAgentes.filter((x) => x !== id) : [...selectedAgentes, id]);
  }

  function toggleSucursal(suc: string) {
    const idsGrupo = (grupos.get(suc) ?? []).map((a) => a.id);
    const yaSeleccionada = selectedSucursales.includes(suc);
    if (yaSeleccionada) {
      onChangeSucursales(selectedSucursales.filter((s) => s !== suc));
      onChangeAgentes(selectedAgentes.filter((id) => !idsGrupo.includes(id)));
    } else {
      onChangeSucursales([...selectedSucursales, suc]);
      onChangeAgentes([...new Set([...selectedAgentes, ...idsGrupo])]);
    }
  }

  function clearAll() {
    onChangeAgentes([]);
    onChangeSucursales([]);
    setSearchTerm("");
  }

  const totalSeleccionados = selectedAgentes.length + selectedSucursales.length;
  const displayText =
    totalSeleccionados === 0
      ? placeholder
      : totalSeleccionados === 1 && selectedSucursales.length === 1
        ? selectedSucursales[0]
        : totalSeleccionados === 1 && selectedAgentes.length === 1
          ? (agentes.find((a) => a.id === selectedAgentes[0])?.nombre ?? placeholder)
          : `${totalSeleccionados} seleccionados`;

  return (
    <div ref={containerRef} className={styles.container}>
      <button className={styles.trigger} onClick={() => setIsOpen((v) => !v)} type="button">
        <span className={styles.triggerText}>{displayText}</span>
        <Icons.ChevronDown size={16} className={`${styles.triggerIcon} ${isOpen ? styles.open : ""}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown} style={{ maxHeight: 360 }}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.optionsList}>
            {sucursalesFiltradas.length === 0 ? (
              <div className={styles.noOptions}>No hay opciones</div>
            ) : (
              sucursalesFiltradas.map(({ suc, agentesGrupo }) => (
                <div key={suc}>
                  <label className={styles.option} style={{ fontWeight: 700, padding: "4px 12px" }}>
                    <input
                      type="checkbox"
                      checked={selectedSucursales.includes(suc)}
                      onChange={() => toggleSucursal(suc)}
                      className={styles.checkbox}
                    />
                    <span className={styles.optionLabel} style={{ textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.04em", color: "#64748b" }}>
                      {suc}
                    </span>
                  </label>
                  {agentesGrupo.map((a) => (
                    <label key={a.id} className={styles.option} style={{ paddingLeft: 28, paddingTop: 4, paddingBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={selectedAgentes.includes(a.id)}
                        onChange={() => toggleAgente(a.id)}
                        className={styles.checkbox}
                      />
                      <span className={styles.optionLabel}>{a.nombre}</span>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>

          {totalSeleccionados > 0 && (
            <div className={styles.footer}>
              <button type="button" className={styles.clearButton} onClick={clearAll}>
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
