"use client";

import { AlertTriangle, Landmark } from "lucide-react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import { formatBirthDate } from "@/lib/utils/date";
import { getPaymentPlazos, getPlazoDetail } from "@/lib/utils/cobrosUtils";
import type { Pagador } from "@/lib/types/cobros";
import styles from "@/app/expedientes/[id]/page.module.css";
import { useState, useRef } from "react";

function AlergiaTip({ alergias }: { alergias: string[] }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function handleMouseEnter() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left + r.width / 2, y: r.top });
  }

  return (
    <span ref={ref} style={{ display: "inline-flex", cursor: "default" }}
      onMouseEnter={handleMouseEnter} onMouseLeave={() => setPos(null)}>
      <AlertTriangle size={14} style={{ color: "#f59e0b" }} />
      {pos && (
        <span style={{
          position: "fixed", left: pos.x, top: pos.y - 8,
          transform: "translate(-50%, -100%)",
          background: "#1e293b", color: "#f8fafc",
          fontSize: "0.72rem", lineHeight: 1.4, whiteSpace: "nowrap",
          padding: "4px 8px", borderRadius: 5,
          pointerEvents: "none", zIndex: 99999,
        }}>
          {alergias.join(" · ")}
        </span>
      )}
    </span>
  );
}

// Build icon lookup from Icons registry
const extraIconLookup: Record<string, any> = {};
Object.entries(Icons).forEach(([k, c]) => { extraIconLookup[k.toLowerCase()] = c; });

// ─── Internal helpers ──────────────────────────────────────────────────────────

interface SortThProps {
  label?: string;
  icon?: React.ReactNode;
  colKey: string;
  currentKey: string;
  direction: "asc" | "desc";
  onSort: (k: string) => void;
  align?: "left" | "center" | "right";
}
function SortTh({ label, icon, colKey, currentKey, direction, onSort, align }: SortThProps) {
  const active = colKey === currentKey;
  const justify = align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";
  return (
    <th onClick={() => onSort(colKey)} style={{ cursor: "pointer", textAlign: align, width: align !== "left" ? "1%" : undefined, whiteSpace: "nowrap" }}>
      <div className={styles.headerSort} style={{ justifyContent: justify }} title={icon ? label : undefined}>
        {icon ?? <span>{label}</span>}
        {!icon && (
          <Icons.ChevronDown size={12} className={styles.sortIcon} style={{ transform: active && direction === "desc" ? "rotate(180deg)" : "rotate(0deg)", color: active ? "#1e293b" : "#cbd5e1", transition: "transform 0.2s, color 0.2s" }} />
        )}
      </div>
    </th>
  );
}

const BADGE_STYLE: React.CSSProperties = {
  backgroundColor: "var(--primary-color, #475569)", color: "#fff",
  fontSize: "0.65rem", fontWeight: 700, padding: "0.05rem 0.35rem", borderRadius: "9999px",
};
const DROPDOWN_BTN: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "space-between",
  gap: "0.5rem", padding: "0.35rem 0.75rem", borderRadius: "0.5rem",
  border: "1px solid #cbd5e1", backgroundColor: "#fff", color: "#334155",
  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
  boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)", outline: "none",
};
const DROPDOWN_PANEL: React.CSSProperties = {
  position: "absolute", top: "100%", left: 0, minWidth: "180px",
  maxHeight: "300px", overflowY: "auto",
  backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
  padding: "0.4rem", marginTop: "0.25rem", zIndex: 999,
  display: "flex", flexDirection: "column", gap: "0.1rem",
};
const CHECKBOX_LABEL_BASE: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.4rem",
  borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.7rem",
  color: "#475569", fontWeight: 600, transition: "background-color 0.1s",
};

interface FilterDropdownProps {
  id: "plazos" | "extras" | "newsletter" | "contrato";
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  minWidth?: number;
  children: React.ReactNode;
}
function FilterDropdown({ id, label, count, isOpen, onToggle, minWidth = 180, children }: FilterDropdownProps) {
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onToggle} style={{ ...DROPDOWN_BTN, minWidth }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          {label}
          {count > 0 && <span style={BADGE_STYLE}>{count}</span>}
        </span>
        <Icons.ChevronDown size={12} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {isOpen && <div style={DROPDOWN_PANEL}>{children}</div>}
    </div>
  );
}

function CheckboxOption({ value, checked, accentColor = "var(--primary-color, #475569)", onChange, children }: { value: string; checked: boolean; accentColor?: string; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      style={{ ...CHECKBOX_LABEL_BASE, backgroundColor: checked ? "#f1f5f9" : "transparent" }}
      onMouseEnter={(e) => { if (!checked) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
      onMouseLeave={(e) => { if (!checked) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor, cursor: "pointer", transform: "scale(0.85)" }} />
      {children}
    </label>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  viajeros: any[];
  loading: boolean;
  filteredData: any[];
  paginatedData: any[];
  extrasIconMap: Record<string, string>;
  pagadorMap: Map<string, any>;
  globalPlazos: any[];
  paymentPlazosList: any[];
  dynamicExtras: string[];
  matchesCobros: any[];
  onOpenMatchModal?: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  isFilterRowOpen: boolean;
  onToggleFilterRow: () => void;
  openDropdown: "plazos" | "extras" | "newsletter" | "contrato" | null;
  onSetOpenDropdown: (d: "plazos" | "extras" | "newsletter" | "contrato" | null) => void;
  activePlazoFilters: string[];
  onTogglePlazoFilter: (id: string) => void;
  activeExtraFilters: string[];
  onToggleExtraFilter: (v: string) => void;
  activeNewsletterFilters: string[];
  onToggleNewsletterFilter: (v: string) => void;
  activeContratoFilters: string[];
  onToggleContratoFilter: (v: string) => void;
  onClearAllFilters: () => void;
  sortKey: string;
  sortDirection: "asc" | "desc";
  onSort: (k: string) => void;
  currentPage: number;
  rowsPerPage: number;
  onPageChange: (p: number) => void;
  onRowsPerPageChange: (r: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TablaViajeros({
  viajeros, loading, filteredData, paginatedData,
  extrasIconMap, pagadorMap, globalPlazos, paymentPlazosList, dynamicExtras,
  matchesCobros, onOpenMatchModal,
  search, onSearchChange,
  isFilterRowOpen, onToggleFilterRow,
  openDropdown, onSetOpenDropdown,
  activePlazoFilters, onTogglePlazoFilter,
  activeExtraFilters, onToggleExtraFilter,
  activeNewsletterFilters, onToggleNewsletterFilter,
  activeContratoFilters, onToggleContratoFilter,
  onClearAllFilters,
  sortKey, sortDirection, onSort,
  currentPage, rowsPerPage, onPageChange, onRowsPerPageChange,
}: Props) {
  const hasActiveFilters = activePlazoFilters.length + activeExtraFilters.length + activeNewsletterFilters.length + activeContratoFilters.length > 0;

  return (
    <div className={styles.tabContainer}>
      {/* Toolbar */}
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Icons.Viajeros size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>
            Listado de Viajeros ({loading ? "..." : filteredData.length})
          </h2>
        </div>
        <div className={styles.actionsWrapper}>
          <div className={styles.searchWrapper}>
            <Icons.Search size={16} className={styles.searchIcon} />
            <input type="text" placeholder="Buscar viajero o tutor..." className={styles.searchInput} value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </div>
          <button
            className={styles.actionIconButton}
            style={isFilterRowOpen ? { backgroundColor: "#e2e8f0", color: "#0f172a", borderColor: "#cbd5e1" } : undefined}
            onClick={onToggleFilterRow}
            title="Filtrar viajeros"
          >
            <Icons.Filter size={18} />
          </button>
          <button className={styles.actionIconButton} title="Exportar"><Icons.Export size={18} /></button>
          {matchesCobros.length > 0 && (
            <button className={styles.actionIconButton} style={{ position: "relative" }} onClick={onOpenMatchModal}
              title={`${matchesCobros.length} cobro${matchesCobros.length > 1 ? "s" : ""} pendiente${matchesCobros.length > 1 ? "s" : ""} de conciliar`}
            >
              <Landmark size={18} />
              <span style={{ position: "absolute", top: "-6px", right: "-6px", minWidth: "16px", height: "16px", borderRadius: "8px", backgroundColor: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "1.5px solid #fff" }}>
                {matchesCobros.length}
              </span>
            </button>
          )}
          <button className={styles.addActionButton} title="Añadir Viajero"><Icons.Add size={18} /></button>
        </div>
      </div>

      {/* Click-away overlay */}
      {openDropdown !== null && (
        <div onClick={() => onSetOpenDropdown(null)} style={{ position: "fixed", inset: 0, zIndex: 998, background: "transparent" }} />
      )}

      {/* Filter row */}
      {isFilterRowOpen && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", padding: "0.75rem 1.75rem", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", alignItems: "center" }}>
          {/* Plazos */}
          <FilterDropdown id="plazos" label="Seleccionar plazos" count={activePlazoFilters.length} isOpen={openDropdown === "plazos"} onToggle={() => onSetOpenDropdown(openDropdown === "plazos" ? null : "plazos")} minWidth={180}>
            {paymentPlazosList.length === 0 ? (
              <div style={{ padding: "0.4rem", fontSize: "0.7rem", color: "#64748b", textAlign: "center" }}>No hay plazos de pago</div>
            ) : paymentPlazosList.map((p: any, idx: number) => {
              const desc = p.descripcion || `Plazo ${idx + 1}`;
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#1e293b", padding: "0.15rem 0.3rem", borderBottom: "1px solid #f1f5f9", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    {desc}:
                  </div>
                  <div style={{ paddingLeft: "0.5rem" }}>
                    {[{ id: `${idx}-green`, label: "Abonado", color: "#22c55e" }, { id: `${idx}-orange`, label: "Parcial", color: "#f97316" }, { id: `${idx}-gray`, label: "Pendiente", color: "#94a3b8" }]
                      .map((opt) => (
                        <CheckboxOption key={opt.id} value={opt.id} checked={activePlazoFilters.includes(opt.id)} accentColor={opt.color} onChange={() => onTogglePlazoFilter(opt.id)}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: opt.color }} />
                            {opt.label}
                          </span>
                        </CheckboxOption>
                      ))}
                  </div>
                </div>
              );
            })}
          </FilterDropdown>

          {/* Extras */}
          <FilterDropdown id="extras" label="Seleccionar extras" count={activeExtraFilters.length} isOpen={openDropdown === "extras"} onToggle={() => onSetOpenDropdown(openDropdown === "extras" ? null : "extras")} minWidth={180}>
            {dynamicExtras.length === 0
              ? <div style={{ padding: "0.4rem", fontSize: "0.7rem", color: "#64748b", textAlign: "center" }}>No hay extras opcionales</div>
              : dynamicExtras.map((extra) => (
                <CheckboxOption key={extra} value={extra} checked={activeExtraFilters.includes(extra)} onChange={() => onToggleExtraFilter(extra)}>
                  {extra}
                </CheckboxOption>
              ))}
          </FilterDropdown>

          {/* Newsletter */}
          <FilterDropdown id="newsletter" label="Newsletter" count={activeNewsletterFilters.length} isOpen={openDropdown === "newsletter"} onToggle={() => onSetOpenDropdown(openDropdown === "newsletter" ? null : "newsletter")}>
            {["Sí", "No"].map((opt) => (
              <CheckboxOption key={opt} value={opt} checked={activeNewsletterFilters.includes(opt)} onChange={() => onToggleNewsletterFilter(opt)}>
                {opt}
              </CheckboxOption>
            ))}
          </FilterDropdown>

          {/* Contrato */}
          <FilterDropdown id="contrato" label="Contrato" count={activeContratoFilters.length} isOpen={openDropdown === "contrato"} onToggle={() => onSetOpenDropdown(openDropdown === "contrato" ? null : "contrato")}>
            {["Sí", "No"].map((opt) => (
              <CheckboxOption key={opt} value={opt} checked={activeContratoFilters.includes(opt)} onChange={() => onToggleContratoFilter(opt)}>
                {opt}
              </CheckboxOption>
            ))}
          </FilterDropdown>

          {hasActiveFilters && (
            <button
              onClick={onClearAllFilters}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#64748b"; }}
              style={{ ...DROPDOWN_BTN, color: "#64748b", minWidth: "auto", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
            >
              <Icons.Close size={12} /> Limpiar Filtros
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <SortTh label="VIAJERO / TUTOR" colKey="name" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="left" />
              <SortTh label="EMAIL" colKey="email" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="left" />
              <SortTh label="TELÉFONO" colKey="phone" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="left" />
              <SortTh label="DOCUMENTO" colKey="dni" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="left" />
              <th style={{ textAlign: "center" }}>SEXO</th>
              <th style={{ textAlign: "center" }}>ALERG.</th>
              <SortTh label="EXTRAS" colKey="extras" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="left" />
              <SortTh label="FEC. NAC." colKey="birthDate" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="left" />
              <SortTh label="Newsletter" icon={<Icons.Mails size={16} style={{ color: sortKey === "newsletter" ? "#1e293b" : "#64748b" }} />} colKey="newsletter" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="center" />
              <SortTh label="Contrato Firmado" icon={<Icons.Document size={16} style={{ color: sortKey === "contrato" ? "#1e293b" : "#64748b" }} />} colKey="contrato" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="center" />
              <SortTh label="ESTADO" colKey="status" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="right" />
              <SortTh label="PLAZOS" colKey="plazos" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="center" />
              <SortTh label="IMPORTE" colKey="importe" currentKey={sortKey} direction={sortDirection} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>Cargando viajeros...</td></tr>
            ) : paginatedData.map((v) => {
              const pagador = pagadorMap.get(v.pagador_id);
              const plazosList = pagador ? getPaymentPlazos(pagador as Pagador, globalPlazos) : [];
              const dots = plazosList.map((_, i) =>
                pagador ? getPlazoDetail(pagador as Pagador, globalPlazos, i) : { color: "gray", tooltip: "" }
              );
              if (dots.length === 0) for (let i = 0; i < 3; i++) dots.push({ color: "gray", tooltip: "" });

              return (
                <tr key={v.id}>
                  <td>
                    <div className={styles.stackedCell}>
                      <span className={styles.mainText}>{v.name}</span>
                      {v.tutor && <span className={styles.subText}>{v.tutor}</span>}
                    </div>
                  </td>
                  <td>
                    <div className={styles.stackedCell}>
                      <span className={styles.mainText} style={!v.email ? { color: "#d1d5db" } : undefined}>{v.email || "—"}</span>
                      {v.tutorEmail && <span className={styles.subText}>{v.tutorEmail}</span>}
                    </div>
                  </td>
                  <td>
                    <div className={styles.stackedCell}>
                      <span className={styles.mainText} style={!v.phone ? { color: "#d1d5db" } : undefined}>{v.phone || "—"}</span>
                      {v.tutorPhone && <span className={styles.subText}>{v.tutorPhone}</span>}
                    </div>
                  </td>
                  <td>
                    <div className={styles.stackedCell}>
                      <span className={styles.mainText} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        {v.dni}
                        {v.warningDoc && (
                          <span title={`Caduca: ${v.documentoCaducidad ? new Date(v.documentoCaducidad).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}`}>
                            <AlertTriangle size={14} style={{ color: "#f59e0b", minWidth: 14 }} />
                          </span>
                        )}
                      </span>
                      {v.tutorDni && <span className={styles.subText}>{v.tutorDni}</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>{v.gender}</td>
                  <td style={{ textAlign: "center" }}>
                    {v.alergias?.length > 0 ? <AlergiaTip alergias={v.alergias} /> : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td>
                    {v.extras?.length > 0 ? (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        {v.extras.map((extra: any, i: number) => {
                          const raw = extrasIconMap[extra.id] || "";
                          const IconComp = extraIconLookup[raw.toLowerCase().replace(/-/g, "")] ?? Icons.Add;
                          return (
                            <span key={extra.id || i}
                              title={`${extra.descripcion || "Extra"} — ${Number(extra.precio || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, backgroundColor: "color-mix(in srgb, var(--primary-color, #475569) 20%, transparent)", borderRadius: "0.25rem", color: "var(--primary-color, #475569)", cursor: "default" }}
                            >
                              <IconComp size={12} />
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>—</span>
                    )}
                  </td>
                  <td>{formatBirthDate(v.birthDate)}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: v.newsletter === "S" ? "#f0fdf4" : "#f8fafc", color: v.newsletter === "S" ? "#16a34a" : "#64748b", border: v.newsletter === "S" ? "1px solid #dcfce7" : "1px solid #e2e8f0" }}>
                      {v.newsletter}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: v.contrato === "S" ? "#f0fdf4" : "#f8fafc", color: v.contrato === "S" ? "#16a34a" : "#64748b", border: v.contrato === "S" ? "1px solid #dcfce7" : "1px solid #e2e8f0" }}>
                      {v.contrato}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className={`${styles.statusTag} ${v.status === "CONFIRMADO" ? styles.statusSuccess : styles.statusPending}`}>
                      {v.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "3px", justifyContent: "center", alignItems: "center" }}>
                      {dots.map((d, i) => (
                        <div key={i} title={d.tooltip} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: d.color === "green" ? "#22c55e" : d.color === "orange" ? "#f97316" : "#d1d5db", cursor: "pointer" }} />
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "#0f172a" }}>
                      {Number(v.importe).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </td>
                </tr>
              );
            })}
            {!loading && paginatedData.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>No se encontraron viajeros registrados.</td></tr>
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredData.length}
          itemsPerPage={rowsPerPage}
          onPageChange={onPageChange}
          onItemsPerPageChange={onRowsPerPageChange}
        />
      </div>
    </div>
  );
}
