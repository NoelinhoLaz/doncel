"use client";

import { Icons } from "@/lib/icons";
import type { Filtros } from "@/hooks/useLibroDiario";
import s from "./diario.module.css";

interface Props {
  filtros: Filtros;
  ejercicios: number[];
  cuentasContables: any[];
  searchInput: string;
  loading: boolean;
  onSearchChange: (v: string) => void;
  onUpdateFiltro: <K extends keyof Filtros>(key: K, value: Filtros[K]) => void;
  onReset: () => void;
}

export default function FiltrosDiario({ filtros, ejercicios, cuentasContables, searchInput, loading, onSearchChange, onUpdateFiltro, onReset }: Props) {
  return (
    <div style={{ background: "#ffffff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", padding: "1.25rem", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Icons.Filter size={18} style={{ color: "var(--primary-color, #475569)" }} />
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Filtros de Búsqueda</h2>
        </div>
        <button onClick={onReset} className={s.resetBtn} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Icons.RefreshCw size={12} /> Restablecer filtros
        </button>
      </div>

      <div className={s.filterGrid}>
        <div className={s.filterField}>
          <label>Buscar asiento o cuenta</label>
          <div style={{ position: "relative" }}>
            <input type="text" placeholder="Nº Asiento, concepto, cuenta..." value={searchInput} onChange={(e) => onSearchChange(e.target.value)} style={{ paddingLeft: "2rem" }} />
            <Icons.Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            {loading && searchInput.trim().length >= 3 && (
              <Icons.RefreshCw size={14} className={s.spin} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            )}
          </div>
        </div>

        <div className={s.filterField}>
          <label>Ejercicio Fiscal</label>
          <select value={filtros.ejercicio} onChange={(e) => onUpdateFiltro("ejercicio", e.target.value)}>
            <option value="">Todos los años</option>
            {ejercicios.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className={s.filterField}>
          <label>Filtrar por Cuenta Contable</label>
          <select value={filtros.cuentaId} onChange={(e) => onUpdateFiltro("cuentaId", e.target.value)}>
            <option value="">Todas las cuentas</option>
            {cuentasContables.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.descripcion}</option>)}
          </select>
        </div>

        <div className={s.filterField}>
          <label>Desde Fecha</label>
          <input type="date" value={filtros.fechaDesde} onChange={(e) => onUpdateFiltro("fechaDesde", e.target.value)} />
        </div>

        <div className={s.filterField}>
          <label>Hasta Fecha</label>
          <input type="date" value={filtros.fechaHasta} onChange={(e) => onUpdateFiltro("fechaHasta", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
