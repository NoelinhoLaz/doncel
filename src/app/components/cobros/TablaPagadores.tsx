"use client";

import { Fragment } from "react";
import { Landmark } from "lucide-react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import PlazoDots from "./PlazoDots";
import { isValidSpanishNifCif } from "@/lib/utils/validation";
import { formatEuro } from "@/lib/utils/currency";
import type { Pagador, MovimientoCobro } from "@/lib/types/cobros";
import styles from "@/app/expedientes/[id]/page.module.css";

interface Props {
  paginatedData: Pagador[];
  filteredData: Pagador[];
  movimientos: MovimientoCobro[];
  movimientosBanco: any[];
  viajerosByPagador: Map<string, any[]>;
  globalPlazos: any[];
  search: string;
  onSearchChange: (v: string) => void;
  currentPage: number;
  rowsPerPage: number;
  onPageChange: (p: number) => void;
  onRowsPerPageChange: (r: number) => void;
  sortKey: string;
  sortDirection: "asc" | "desc";
  onSort: (key: string) => void;
  expandedPagadores: Set<string>;
  onToggleExpand: (id: string) => void;
  isFilterRowOpen: boolean;
  onToggleFilterRow: () => void;
  openDropdown: "plazos" | null;
  onSetOpenDropdown: (v: "plazos" | null) => void;
  activePlazoFilters: string[];
  onTogglePlazoFilter: (id: string) => void;
  onClearPlazoFilters: () => void;
  paymentPlazosList: any[];
  matchesCobros: any[];
  onOpenMatchModal?: () => void;
  onAddCobro: () => void;
}

// Helper para encabezados de columna ordenables
function SortTh({
  label,
  colKey,
  currentKey,
  direction,
  onSort,
  align = "left",
  narrow = false,
}: {
  label: string;
  colKey: string;
  currentKey: string;
  direction: "asc" | "desc";
  onSort: (k: string) => void;
  align?: "left" | "right";
  narrow?: boolean;
}) {
  const isActive = currentKey === colKey;
  return (
    <th
      onClick={() => onSort(colKey)}
      style={{
        cursor: "pointer",
        textAlign: align,
        width: narrow ? "1%" : undefined,
        whiteSpace: narrow ? "nowrap" : undefined,
      }}
    >
      <div
        className={styles.headerSort}
        style={align === "right" ? { justifyContent: "flex-end" } : undefined}
      >
        <span>{label}</span>
        <Icons.ChevronDown
          size={12}
          className={styles.sortIcon}
          style={{
            transform: isActive && direction === "desc" ? "rotate(180deg)" : "rotate(0deg)",
            color: isActive ? "#1e293b" : "#cbd5e1",
            transition: "transform 0.2s, color 0.2s",
          }}
        />
      </div>
    </th>
  );
}

export default function TablaPagadores({
  paginatedData,
  filteredData,
  movimientos,
  movimientosBanco,
  viajerosByPagador,
  globalPlazos,
  search,
  onSearchChange,
  currentPage,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  sortKey,
  sortDirection,
  onSort,
  expandedPagadores,
  onToggleExpand,
  isFilterRowOpen,
  onToggleFilterRow,
  openDropdown,
  onSetOpenDropdown,
  activePlazoFilters,
  onTogglePlazoFilter,
  onClearPlazoFilters,
  paymentPlazosList,
  matchesCobros,
  onOpenMatchModal,
  onAddCobro,
}: Props) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "0.75rem",
        border: "1px solid #f1f5f9",
        overflow: "hidden",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        marginBottom: "1.5rem",
      }}
    >
      {/* ── Header bar ── */}
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Icons.Cobros size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>
            Pagadores/clientes del expediente ({filteredData.length})
          </h2>
        </div>
        <div className={styles.actionsWrapper}>
          <div className={styles.searchWrapper}>
            <Icons.Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por cliente, DNI o viajero..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <button
            className={styles.actionIconButton}
            style={
              isFilterRowOpen
                ? { backgroundColor: "#e2e8f0", color: "#0f172a", borderColor: "#cbd5e1" }
                : undefined
            }
            onClick={onToggleFilterRow}
            title="Filtrar por plazos"
          >
            <Icons.Filter size={18} />
          </button>
          <button className={styles.actionIconButton} title="Exportar cobros">
            <Icons.Export size={18} />
          </button>
          {matchesCobros.length > 0 && (
            <button
              className={styles.actionIconButton}
              title={`${matchesCobros.length} cobro${matchesCobros.length > 1 ? "s" : ""} bancario${matchesCobros.length > 1 ? "s" : ""} pendiente${matchesCobros.length > 1 ? "s" : ""} de conciliar`}
              style={{ position: "relative" }}
              onClick={onOpenMatchModal}
            >
              <Landmark size={18} />
              <span
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  minWidth: "16px",
                  height: "16px",
                  borderRadius: "8px",
                  backgroundColor: "var(--primary-color, #475569)",
                  color: "#fff",
                  fontSize: "0.6rem",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 3px",
                  lineHeight: "1",
                  border: "1.5px solid #fff",
                }}
              >
                {matchesCobros.length}
              </span>
            </button>
          )}
          <button className={styles.addActionButton} title="Añadir cobro" onClick={onAddCobro}>
            <Icons.Add size={18} />
          </button>
        </div>
      </div>

      {/* click-away overlay for filter dropdown */}
      {openDropdown !== null && (
        <div
          onClick={() => onSetOpenDropdown(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 998,
            backgroundColor: "transparent",
          }}
        />
      )}

      {/* ── Filter row ── */}
      {isFilterRowOpen && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            alignItems: "center",
            transition: "all 0.3s ease-in-out",
          }}
        >
          <div style={{ position: "relative" }}>
            <button
              onClick={() => onSetOpenDropdown(openDropdown === "plazos" ? null : "plazos")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                backgroundColor: "#fff",
                color: "#334155",
                fontSize: "0.75rem",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
                outline: "none",
                minWidth: "180px",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                <span>Seleccionar plazos</span>
                {activePlazoFilters.length > 0 && (
                  <span
                    style={{
                      backgroundColor: "var(--primary-color, #475569)",
                      color: "#fff",
                      fontSize: "0.65rem",
                      fontWeight: "700",
                      padding: "0.05rem 0.35rem",
                      borderRadius: "9999px",
                    }}
                  >
                    {activePlazoFilters.length}
                  </span>
                )}
              </span>
              <Icons.ChevronDown
                size={12}
                style={{
                  transform: openDropdown === "plazos" ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
            </button>

            {openDropdown === "plazos" && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  width: "240px",
                  maxHeight: "300px",
                  overflowY: "auto",
                  backgroundColor: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.5rem",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                  padding: "0.4rem",
                  marginTop: "0.25rem",
                  zIndex: 999,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                {paymentPlazosList.length === 0 ? (
                  <div style={{ padding: "0.4rem", fontSize: "0.7rem", color: "#64748b", textAlign: "center" }}>
                    No hay plazos de pago
                  </div>
                ) : (
                  paymentPlazosList.map((p: any, idx: number) => {
                    const desc = p.descripcion || `Plazo ${idx + 1}`;
                    const statuses = [
                      { id: `${idx}-green`, label: "Abonado", color: "#22c55e" },
                      { id: `${idx}-orange`, label: "Parcial", color: "#f97316" },
                      { id: `${idx}-gray`, label: "Pendiente", color: "#94a3b8" },
                    ];
                    return (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: "700",
                            color: "#1e293b",
                            padding: "0.15rem 0.3rem",
                            borderBottom: "1px solid #f1f5f9",
                            marginBottom: "0.1rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {desc}:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.05rem", paddingLeft: "0.5rem" }}>
                          {statuses.map((opt) => {
                            const isChecked = activePlazoFilters.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  padding: "0.2rem 0.4rem",
                                  borderRadius: "0.25rem",
                                  cursor: "pointer",
                                  fontSize: "0.7rem",
                                  color: "#475569",
                                  fontWeight: "600",
                                  backgroundColor: isChecked ? "#f1f5f9" : "transparent",
                                  transition: "background-color 0.1s",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isChecked) e.currentTarget.style.backgroundColor = "#f8fafc";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isChecked) e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => onTogglePlazoFilter(opt.id)}
                                  style={{ accentColor: opt.color, cursor: "pointer", transform: "scale(0.85)" }}
                                />
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: opt.color }} />
                                  {opt.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {activePlazoFilters.length > 0 && (
            <button
              onClick={onClearPlazoFilters}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                backgroundColor: "#fff",
                color: "#64748b",
                fontSize: "0.75rem",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#fff"; e.currentTarget.style.color = "#64748b"; }}
            >
              <Icons.Close size={12} /> Limpiar Filtros
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: "1%", padding: "0.5rem" }} />
              <SortTh label="CLIENTE" colKey="cliente" currentKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortTh label="CIF/NIF" colKey="cif_nif" currentKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortTh label="VIAJEROS ASOCIADOS" colKey="viajeros" currentKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortTh label="TOTAL" colKey="total" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="right" narrow />
              <SortTh label="Abonado" colKey="abonado" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="right" narrow />
              <SortTh label="Saldo" colKey="saldo" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="right" narrow />
              <SortTh label="PLAZOS" colKey="plazos" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="right" narrow />
              <SortTh label="ESTADO" colKey="estado" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => {
              const saldo = Number(item.importe_total || 0) - Number(item.importe_abonado || 0);
              const myViajeros = viajerosByPagador.get(item.entidad_id) || [];
              const travelersText =
                myViajeros.length === 0
                  ? "—"
                  : myViajeros.length === 1
                  ? myViajeros[0]?.contabilidad_entidades?.nombre || "Sin nombre"
                  : `${myViajeros[0]?.contabilidad_entidades?.nombre || "Sin nombre"} +${myViajeros.length - 1}`;
              const isExpanded = expandedPagadores.has(item.id);

              return (
                <Fragment key={item.id}>
                  <tr style={{ borderBottom: isExpanded ? "none" : "1px solid #f1f5f9" }}>
                    <td style={{ width: "1%", padding: "0.25rem", textAlign: "center" }}>
                      <button
                        onClick={() => onToggleExpand(item.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0.25rem",
                          color: "#64748b",
                          outline: "none",
                        }}
                        title={isExpanded ? "Colapsar movimientos" : "Desplegar movimientos"}
                      >
                        <Icons.ChevronDown
                          size={16}
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                        />
                      </button>
                    </td>
                    <td>
                      <span className={styles.mainText}>
                        {(item.contabilidad_entidades?.nombre || "—").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.monoText}
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                      >
                        {item.contabilidad_entidades?.documento || "—"}
                        {item.contabilidad_entidades?.documento &&
                          !isValidSpanishNifCif(item.contabilidad_entidades.documento) && (
                            <span title="NIF/CIF no válido" style={{ display: "inline-flex", alignItems: "center" }}>
                              <Icons.Warning size={14} style={{ color: "#ef4444" }} />
                            </span>
                          )}
                      </span>
                    </td>
                    <td><span className={styles.mainText}>{travelersText}</span></td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: "#1e293b", width: "1%", whiteSpace: "nowrap" }}>
                      {formatEuro(Number(item.importe_total || 0))}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: "#16a34a", width: "1%", whiteSpace: "nowrap" }}>
                      {formatEuro(Number(item.importe_abonado || 0))}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: saldo > 0 ? "#d97706" : "#64748b", width: "1%", whiteSpace: "nowrap" }}>
                      {formatEuro(saldo)}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <PlazoDots pagador={item} globalPlazos={globalPlazos} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`${styles.statusTag} ${item.estado === "completado" ? styles.statusSuccess : styles.statusPending}`}>
                        {item.estado}
                      </span>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <td colSpan={9} style={{ padding: "0.75rem 1.5rem" }}>
                        <MovimientosSubTable
                          pagador={item}
                          movimientos={movimientos}
                          movimientosBanco={movimientosBanco}
                          viajerosByPagador={viajerosByPagador}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                  No se encontraron pagadores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filteredData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredData.length}
            itemsPerPage={rowsPerPage}
            onPageChange={onPageChange}
            onItemsPerPageChange={onRowsPerPageChange}
          />
        )}
      </div>
    </div>
  );
}

// Sub-tabla de movimientos expandida
function MovimientosSubTable({
  pagador,
  movimientos,
  movimientosBanco,
  viajerosByPagador,
}: {
  pagador: Pagador;
  movimientos: MovimientoCobro[];
  movimientosBanco: any[];
  viajerosByPagador: Map<string, any[]>;
}) {
  const itemViajeros = viajerosByPagador.get(pagador.entidad_id) || [];
  const entityIds = new Set([pagador.entidad_id, ...itemViajeros.map((v) => v.entidad_id)]);
  const myMovs = movimientos.filter((m) => entityIds.has(m.entidad_id));

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "0.5rem",
        backgroundColor: "#fff",
        overflow: "hidden",
        boxShadow: "inset 0 2px 4px 0 rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          padding: "0.5rem 1rem",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
          fontWeight: "700",
          fontSize: "0.75rem",
          color: "#475569",
        }}
      >
        Movimientos de cobro de {(pagador.contabilidad_entidades?.nombre || "—").toUpperCase()}
      </div>
      {myMovs.length === 0 ? (
        <div style={{ padding: "1rem", fontSize: "0.75rem", color: "#64748b", textAlign: "center" }}>
          No se encontraron movimientos de cobro para este cliente.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0" }}>
              {["FECHA", "CONCEPTO", "MEDIO", "ESTADO"].map((h) => (
                <th key={h} style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem", fontWeight: 700, color: "#475569", textAlign: "left" }}>
                  {h}
                </th>
              ))}
              <th style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem", fontWeight: 700, color: "#475569", textAlign: "right", whiteSpace: "nowrap", width: "1%" }}>
                IMPORTE
              </th>
            </tr>
          </thead>
          <tbody>
            {myMovs.map((m) => {
              let conceptoText = m.concepto || "—";
              if (m.movimiento_banco_id) {
                const b = movimientosBanco.find((x) => x.id === m.movimiento_banco_id);
                if (b) conceptoText = b.concepto_original || b.concepto_limpio || m.concepto || "—";
              }
              const medioBg = m.medio_pago === "banco" ? "#eff6ff" : m.medio_pago === "tarjeta" ? "#fdf2f8" : "#f0fdf4";
              const medioColor = m.medio_pago === "banco" ? "#2563eb" : m.medio_pago === "tarjeta" ? "#db2777" : "#16a34a";
              const estadoBg = m.estado === "confirmado" ? "#e6f4ea" : m.estado === "pendiente" ? "#fef3c7" : "#f1f5f9";
              const estadoColor = m.estado === "confirmado" ? "#137333" : m.estado === "pendiente" ? "#b45309" : "#64748b";
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ whiteSpace: "nowrap", fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>
                    {m.fecha ? new Date(m.fecha).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>{conceptoText}</td>
                  <td style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>
                    <span style={{ display: "inline-flex", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", fontSize: "0.65rem", fontWeight: "600", textTransform: "capitalize", backgroundColor: medioBg, color: medioColor }}>
                      {m.medio_pago || "—"}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>
                    <span style={{ display: "inline-flex", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", fontSize: "0.65rem", fontWeight: "600", textTransform: "capitalize", backgroundColor: estadoBg, color: estadoColor }}>
                      {m.estado || "—"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: "600", color: "#16a34a", width: "1%", whiteSpace: "nowrap", fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>
                    {formatEuro(Math.abs(Number(m.importe_total || 0)))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
