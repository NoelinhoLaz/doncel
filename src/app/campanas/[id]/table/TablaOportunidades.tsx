"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Search, SlidersHorizontal, Plus, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, X, Pencil, Trash2, MapPin, Rocket,
} from "lucide-react";
import styles from "../page.module.css";
import { Oportunidad, Estado, AgenteObjetivo, EntidadDetalle } from "../types";
import { PAGE_SIZE_OPTIONS } from "../constants";
import { initials, capitalizarCiudad } from "../utils";
import { CampanaCharts } from "../Charts";
import { StatePill } from "../components/StatePill";
import { EstadosBubbles } from "../components/EstadosBubbles";
import { ResponsablesTooltip } from "../components/ResponsablesTooltip";
import { ModalEstrategia } from "../modals/ModalEstrategia";

const MapaOportunidadesDynamic = dynamic(
  () => import("../MapaOportunidades").then(m => m.MapaOportunidades),
  { ssr: false }
);

export function TablaOportunidades({ oportunidades, estados, monocromo, isOwner, campanaId, objetivoTotal, agentes, onNuevaOportunidad, onNuevaOportunidadPlaces, onEstadoChange, onPresupuestoClick, onCierreClick, onAgenteChange, onEliminarOportunidad, onEntidadClick, onOportunidadUpdate }: {
  oportunidades: Oportunidad[];
  estados: Estado[];
  monocromo: boolean;
  isOwner: boolean;
  campanaId: string;
  objetivoTotal: number;
  agentes: AgenteObjetivo[];
  onNuevaOportunidad: () => void;
  onNuevaOportunidadPlaces: () => void;
  onEstadoChange: (id: string, estadoId: string) => void;
  onPresupuestoClick: (oportunidadId: string) => void;
  onCierreClick: (oportunidadId: string, estadoId: string) => void;
  onAgenteChange?: (oportunidadId: string, agenteId: string | null) => void;
  onEliminarOportunidad?: (oportunidadId: string) => void;
  onEntidadClick?: (data: EntidadDetalle) => void;
  onOportunidadUpdate?: (id: string, patch: Partial<Oportunidad>) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAddMenu) return;
    function handleClick(e: MouseEvent) {
      if (addBtnRef.current && addBtnRef.current.contains(e.target as Node)) return;
      setShowAddMenu(false);
    }
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [showAddMenu]);
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [estadoFilter, setEstadoFilter] = useState<string[]>([]);
  const [ciudadFilter, setCiudadFilter] = useState<string[]>([]);
  const [prioridadFilter, setPrioridadFilter] = useState<number[]>([]);
  const [sortCol, setSortCol] = useState<string | null>("oportunidad");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const filterRowRef = useRef<HTMLDivElement>(null);

  const [estrategiaModal, setEstrategiaModal] = useState<{ op: Oportunidad } | null>(null);
  const [draggedOpId, setDraggedOpId] = useState<string | null>(null);
  const [agentePickerOpId, setAgentePickerOpId] = useState<string | null>(null);
  const [agentePickerPos, setAgentePickerPos] = useState<{ top: number; left: number } | null>(null);
  const agentePickerRef = useRef<HTMLDivElement | null>(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ opId: string; estadoId: string } | null>(null);
  const [showMapa, setShowMapa] = useState(false);
  const [sinCoordsFilter, setSinCoordsFilter] = useState(false);
  const [editingCell, setEditingCell] = useState<{ opId: string; field: "prioridad" | "valor_estimado" } | null>(null);
  const [editingVal, setEditingVal] = useState("");
  const editingCellRef = useRef<{ opId: string; field: "prioridad" | "valor_estimado" } | null>(null);
  const editingValRef = useRef("");
  const savedRef = useRef(false);

  useEffect(() => {
    if (!agentePickerOpId) return;
    function handleClick(e: MouseEvent) {
      if (agentePickerRef.current && agentePickerRef.current.contains(e.target as Node)) return;
      setAgentePickerOpId(null);
      setAgentePickerPos(null);
    }
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [agentePickerOpId]);

  useEffect(() => {
    if (!openDropdown) return;
    function handleClick(e: MouseEvent) {
      if (filterRowRef.current && !filterRowRef.current.contains(e.target as Node)) setOpenDropdown(null);
    }
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [openDropdown]);

  const agentesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    oportunidades.forEach(o => {
      if (o.agente_id && o.crm_agentes)
        map.set(o.agente_id, `${o.crm_agentes.nombre} ${o.crm_agentes.apellidos}`);
    });
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [oportunidades]);

  function normalizarCiudad(c: string): string {
    return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  const prioridadesUnicas = useMemo(() => {
    const set = new Set<number>();
    oportunidades.forEach(o => { if (o.prioridad != null) set.add(o.prioridad); });
    return [...set].sort((a, b) => a - b);
  }, [oportunidades]);

  const ciudadesUnicas = useMemo(() => {
    const map = new Map<string, string>(); // normalizada → capitalizada
    oportunidades.forEach(o => {
      const c = o.contabilidad_entidades?.direccion?.ciudad;
      if (c?.trim()) {
        const key = normalizarCiudad(c);
        if (!map.has(key)) map.set(key, capitalizarCiudad(c));
      }
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([norm, display]) => ({ norm, display }));
  }, [oportunidades]);

  // filtrado completo (listado)
  const filtered = useMemo(() => {
    return oportunidades.filter(o => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = [
          o.titulo,
          o.contabilidad_entidades?.nombre ?? "",
          o.crm_contactos?.nombre ?? "",
          o.crm_agentes ? `${o.crm_agentes.nombre} ${o.crm_agentes.apellidos}` : "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (agenteFilter.length > 0 && !agenteFilter.includes(o.agente_id ?? "")) return false;
      if (estadoFilter.length > 0 && !estadoFilter.includes(o.estado_id)) return false;
      if (ciudadFilter.length > 0) {
        const ciudad = o.contabilidad_entidades?.direccion?.ciudad ?? "";
        if (!ciudadFilter.includes(normalizarCiudad(ciudad))) return false;
      }
      if (prioridadFilter.length > 0 && !prioridadFilter.includes(o.prioridad ?? -1)) return false;
      if (sinCoordsFilter && o.contabilidad_entidades?.lat != null) return false;
      return true;
    });
  }, [oportunidades, search, agenteFilter, estadoFilter, ciudadFilter, prioridadFilter, sinCoordsFilter]);

  // filtrado para KPIs y gráficos (sin filtro de estado ni búsqueda)
  const filteredKpi = useMemo(() => {
    return oportunidades.filter(o => {
      if (agenteFilter.length > 0 && !agenteFilter.includes(o.agente_id ?? "")) return false;
      if (ciudadFilter.length > 0) {
        const ciudad = o.contabilidad_entidades?.direccion?.ciudad ?? "";
        if (!ciudadFilter.includes(normalizarCiudad(ciudad))) return false;
      }
      if (prioridadFilter.length > 0 && !prioridadFilter.includes(o.prioridad ?? -1)) return false;
      return true;
    });
  }, [oportunidades, agenteFilter, ciudadFilter, prioridadFilter]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let va: any, vb: any;
      if (sortCol === "agente") {
        va = a.crm_agentes ? `${a.crm_agentes.nombre} ${a.crm_agentes.apellidos}` : "";
        vb = b.crm_agentes ? `${b.crm_agentes.nombre} ${b.crm_agentes.apellidos}` : "";
      } else if (sortCol === "prioridad") {
        va = a.prioridad ?? 99999; vb = b.prioridad ?? 99999;
      } else if (sortCol === "oportunidad") {
        va = a.contabilidad_entidades?.nombre ?? a.titulo ?? "";
        vb = b.contabilidad_entidades?.nombre ?? b.titulo ?? "";
      } else if (sortCol === "resp") {
        va = a.contabilidad_entidades?.crm_contactos?.length ?? 0;
        vb = b.contabilidad_entidades?.crm_contactos?.length ?? 0;
      } else if (sortCol === "estimacion") {
        va = a.valor_estimado; vb = b.valor_estimado;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb, "es") : vb.localeCompare(va, "es");
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totalFiltrosActivos = agenteFilter.length + estadoFilter.length + ciudadFilter.length + prioridadFilter.length + (sinCoordsFilter ? 1 : 0);

  useEffect(() => { setPage(1); }, [search, agenteFilter, estadoFilter, ciudadFilter, prioridadFilter, sinCoordsFilter, pageSize, sortCol, sortDir]);

  async function saveEditingCell() {
    if (savedRef.current) return;
    const cell = editingCellRef.current;
    if (!cell) return;
    savedRef.current = true;
    const raw = editingValRef.current.trim().replace(/\./g, "").replace(",", ".");
    const val = cell.field === "prioridad" ? parseInt(raw) : parseFloat(raw);
    setEditingCell(null);
    editingCellRef.current = null;
    if (isNaN(val)) return;
    try {
      await fetch(`/api/crm/oportunidades/${cell.opId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cell.field]: val }),
      });
      onOportunidadUpdate?.(cell.opId, { [cell.field]: val });
    } catch { }
  }

  function startEditingCell(opId: string, field: "prioridad" | "valor_estimado", val: string) {
    savedRef.current = false;
    editingCellRef.current = { opId, field };
    editingValRef.current = val;
    setEditingCell({ opId, field });
    setEditingVal(val);
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }
  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronUp size={10} style={{ opacity: 0.3, marginLeft: 2 }} />;
    return sortDir === "asc" ? <ChevronUp size={10} style={{ marginLeft: 2 }} /> : <ChevronDown size={10} style={{ marginLeft: 2 }} />;
  }

  const valorPotencial = filteredKpi.reduce((s, o) => s + o.valor_estimado, 0);

  const objetivoFiltrado = useMemo(() => {
    if (agenteFilter.length === 0) return objetivoTotal;
    return agentes
      .filter(a => agenteFilter.includes(a.agente_id))
      .reduce((s, a) => s + (a.objetivo_valor ?? 0), 0);
  }, [agentes, agenteFilter, objetivoTotal]);

  const estadosNormales = estados.filter(e => !e.es_final || e.es_ganado);
  const estadosFinalesNegativos = estados.filter(e => e.es_final && !e.es_ganado);
  const conSeparador = estadosFinalesNegativos.length > 0;
  const totalCols = 3 + (isOwner ? 1 : 0) + estados.length + (conSeparador ? 1 : 0) + 2;

  return (
    <>
      {/* KPIs */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard} style={{ background: monocromo ? "color-mix(in srgb, var(--primary-color,#475569) 80%, white)" : "#3d9183" }}>
          <span className={styles.kpiCardLabel}>POTENCIAL</span>
          <span className={styles.kpiCardValue}>{valorPotencial.toLocaleString("es-ES")} € ({filteredKpi.length})</span>
          {(() => {
            const p1 = filteredKpi.filter(o => o.prioridad === 1);
            const p2 = filteredKpi.filter(o => o.prioridad === 2);
            const p1val = p1.reduce((s, o) => s + o.valor_estimado, 0);
            const p2val = p2.reduce((s, o) => s + o.valor_estimado, 0);
            return (
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", display: "flex", justifyContent: "space-between", width: "100%" }}><span>P1</span><span>{p1val.toLocaleString("es-ES")} € ({p1.length})</span></span>
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", display: "flex", justifyContent: "space-between", width: "100%" }}><span>P2</span><span>{p2val.toLocaleString("es-ES")} € ({p2.length})</span></span>
              </div>
            );
          })()}
        </div>
        {estados.map((e, i) => {
          const ops = filteredKpi.filter(o => o.estado_id === e.id);
          const valor = ops.reduce((s, o) => s + o.valor_estimado, 0);
          const p1 = ops.filter(o => o.prioridad === 1);
          const p2 = ops.filter(o => o.prioridad === 2);
          const p1val = p1.reduce((s, o) => s + o.valor_estimado, 0);
          const p2val = p2.reduce((s, o) => s + o.valor_estimado, 0);
          const MONO_ALPHAS = [70, 58, 46, 36, 27, 20, 15, 10];
          const bg = monocromo ? `color-mix(in srgb, var(--primary-color,#475569) ${MONO_ALPHAS[i % MONO_ALPHAS.length]}%, white)` : e.color;
          return (
            <div key={e.id} className={styles.kpiCard} style={{ background: bg }}>
              <span className={styles.kpiCardLabel}>{e.nombre.toUpperCase()}</span>
              <span className={styles.kpiCardValue}>
                {valor > 0 ? `${valor.toLocaleString("es-ES")} € (${ops.length})` : ops.length}
              </span>
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", display: "flex", justifyContent: "space-between", width: "100%" }}><span>P1</span><span>{p1val > 0 ? `${p1val.toLocaleString("es-ES")} € ` : "0 € "}({p1.length})</span></span>
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", display: "flex", justifyContent: "space-between", width: "100%" }}><span>P2</span><span>{p2val > 0 ? `${p2val.toLocaleString("es-ES")} € ` : "0 € "}({p2.length})</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráficos */}
      <CampanaCharts campanaId={campanaId} estados={estados} oportunidades={filteredKpi} objetivoTotal={objetivoFiltrado} monocromo={monocromo} />

    <div className={styles.tableWrapper}>
      <div className={styles.tableHeader}>
        <span className={styles.tableTitle}>Listado de oportunidades ({filtered.length})</span>
        <div className={styles.tableActions}>
          <div className={styles.searchWrapperTbl}>
            <Search size={13} className={styles.searchIconTbl} />
            <input
              className={styles.searchInputTbl}
              placeholder="Buscar contacto…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`${styles.filterIconBtn}${showFilters || totalFiltrosActivos > 0 ? " " + styles.filterIconBtnActive : ""}`}
            onClick={() => { setShowFilters(v => !v); setOpenDropdown(null); }}
          >
            <SlidersHorizontal size={15} />
            {totalFiltrosActivos > 0 && <span className={styles.filterBadge}>{totalFiltrosActivos}</span>}
          </button>
          <button
            className={styles.filterIconBtn}
            onClick={() => setShowMapa(v => !v)}
            title={showMapa ? "Ver listado" : "Ver mapa"}
            style={{ color: showMapa ? "var(--primary-color,#475569)" : undefined }}
          >
            <MapPin size={15} />
          </button>
          {isOwner && <div ref={addBtnRef} style={{ position: "relative" }}>
            <button className={styles.addBtn} onClick={() => setShowAddMenu(v => !v)} title="Nueva oportunidad">
              <Plus size={15} />
            </button>
            {showAddMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", minWidth: 210, zIndex: 999, overflow: "hidden" }}>
                <button
                  onClick={() => { setShowAddMenu(false); onNuevaOportunidad(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.65rem 1rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "#1e293b", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <Pencil size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Añadir manualmente</div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Introduce los datos a mano</div>
                  </div>
                </button>
                <div style={{ height: 1, background: "#f1f5f9" }} />
                <button
                  onClick={() => { setShowAddMenu(false); onNuevaOportunidadPlaces(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.65rem 1rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "#1e293b", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <MapPin size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Buscar en Google Places</div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Negocios por zona y tipo</div>
                  </div>
                </button>
              </div>
            )}
          </div>}
        </div>
      </div>

      {showFilters && (
        <div className={styles.filterRow} ref={filterRowRef}>
          {/* Filtro por estado */}
          <div className={styles.filterDropdownGroup}>
            <button
              className={`${styles.filterDropdownTrigger}${estadoFilter.length > 0 ? " " + styles.filterDropdownTriggerActive : ""}`}
              onClick={() => setOpenDropdown(v => v === "estado" ? null : "estado")}
            >
              Estado {estadoFilter.length > 0 && <span className={styles.filterDropdownBadge}>{estadoFilter.length}</span>}
              <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "estado" ? "rotate(180deg)" : undefined }}>▾</span>
            </button>
            {openDropdown === "estado" && (
              <div className={styles.filterDropdownMenu}>
                {estados.map(e => (
                  <label key={e.id} className={styles.filterDropdownItem}>
                    <input type="checkbox" checked={estadoFilter.includes(e.id)} onChange={() => {
                      setEstadoFilter(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id]);
                    }} style={{ accentColor: e.color }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0, display: "inline-block" }} />
                    <span>{e.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Filtro por agente (solo owners) */}
          {isOwner && agentesUnicos.length > 0 && (
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger}${agenteFilter.length > 0 ? " " + styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "agente" ? null : "agente")}
              >
                Agente {agenteFilter.length > 0 && <span className={styles.filterDropdownBadge}>{agenteFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "agente" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "agente" && (
                <div className={styles.filterDropdownMenu}>
                  {agentesUnicos.map(a => (
                    <label key={a.id} className={styles.filterDropdownItem}>
                      <input type="checkbox" checked={agenteFilter.includes(a.id)} onChange={() => {
                        setAgenteFilter(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]);
                      }} />
                      <span>{a.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filtro por ciudad */}
          {ciudadesUnicas.length > 0 && (
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger}${ciudadFilter.length > 0 ? " " + styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "ciudad" ? null : "ciudad")}
              >
                Ciudad {ciudadFilter.length > 0 && <span className={styles.filterDropdownBadge}>{ciudadFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "ciudad" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "ciudad" && (
                <div className={styles.filterDropdownMenu} style={{ maxHeight: 240, overflowY: "auto" }}>
                  {ciudadesUnicas.map(({ norm, display }) => (
                    <label key={norm} className={styles.filterDropdownItem}>
                      <input type="checkbox" checked={ciudadFilter.includes(norm)} onChange={() => {
                        setCiudadFilter(prev => prev.includes(norm) ? prev.filter(x => x !== norm) : [...prev, norm]);
                      }} />
                      <span>{display}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filtro por prioridad */}
          {prioridadesUnicas.length > 0 && (
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger}${prioridadFilter.length > 0 ? " " + styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "prioridad" ? null : "prioridad")}
              >
                Prioridad {prioridadFilter.length > 0 && <span className={styles.filterDropdownBadge}>{prioridadFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "prioridad" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "prioridad" && (
                <div className={styles.filterDropdownMenu} style={{ maxHeight: 200, overflowY: "auto" }}>
                  {prioridadesUnicas.map(p => (
                    <label key={p} className={styles.filterDropdownItem}>
                      <input type="checkbox" checked={prioridadFilter.includes(p)} onChange={() => {
                        setPrioridadFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
                      }} />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setSinCoordsFilter(v => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0.25rem 0.65rem", fontSize: "0.72rem", fontWeight: 600, borderRadius: 6, border: `1.5px solid ${sinCoordsFilter ? "var(--primary-color,#475569)" : "#e2e8f0"}`, background: sinCoordsFilter ? "var(--primary-color,#475569)" : "#fff", color: sinCoordsFilter ? "#fff" : "#64748b", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <MapPin size={11} /> Sin coords
          </button>

          {totalFiltrosActivos > 0 && (
            <button className={styles.filterClear} onClick={() => { setAgenteFilter([]); setEstadoFilter([]); setCiudadFilter([]); setPrioridadFilter([]); setSinCoordsFilter(false); }}>Limpiar todo</button>
          )}
        </div>
      )}

      {showMapa ? (
        <div style={{ height: 520, padding: "0 0 0.5rem" }}>
          <MapaOportunidadesDynamic
            puntos={filtered.flatMap(o => {
              const e = o.contabilidad_entidades;
              if (!e?.lat || !e?.lng) return [];
              return [{
                id: e.id,
                nombre: e.nombre ?? "",
                lat: e.lat,
                lng: e.lng,
                estadoNombre: o.crm_campanas_estados?.nombre ?? "",
                estadoColor: o.crm_campanas_estados?.color ?? "#94a3b8",
                agente: o.crm_agentes ? `${o.crm_agentes.nombre} ${o.crm_agentes.apellidos}` : undefined,
              }];
            })}
            onEntidadClick={id => {
              const op = filtered.find(o => o.contabilidad_entidades?.id === id);
              if (op?.contabilidad_entidades) onEntidadClick?.({ entidad: op.contabilidad_entidades });
            }}
          />
        </div>
      ) : (
      <table className={styles.table}>
        <thead>
          <tr>
            {isOwner && <th className={styles.th} style={{ width: 46, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("agente")}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2 }}>AG<SortIcon col="agente" /></span></th>}
            <th className={styles.th} style={{ width: 46, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("prioridad")}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2 }}>P<SortIcon col="prioridad" /></span></th>
            <th className={styles.th} style={{ textAlign: "left", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("oportunidad")}><span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>Oportunidad<SortIcon col="oportunidad" /></span></th>
            <th className={styles.th} style={{ width: 58, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("resp")}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2 }}>Resp.<SortIcon col="resp" /></span></th>
            <th className={styles.th} style={{ textAlign: "left", whiteSpace: "nowrap" }}>Camp. ant.</th>
            {estadosNormales.map(e => (
              <th key={e.id} className={`${styles.th} ${styles.thEstado}`} style={{ textAlign: "center" }}>{e.nombre}</th>
            ))}
            {conSeparador && <th className={`${styles.thSep} ${styles.thSepEstado}`} />}
            {estadosFinalesNegativos.map(e => (
              <th key={e.id} className={`${styles.th} ${styles.thGray} ${styles.thEstado}`} style={{ textAlign: "center" }}>{e.nombre}</th>
            ))}
            <th className={`${styles.th} ${styles.thEstadoCol}`} style={{ textAlign: "center" }}>Estado</th>
            <th className={styles.th} style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("estimacion")}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 2, width: "100%" }}>Estimación<SortIcon col="estimacion" /></span></th>
            <th className={styles.th} style={{ textAlign: "center", width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((o, i) => (
            <tr key={o.id} className={styles.tr}>
              {isOwner && (
                <td className={styles.tdCenter}>
                  <span
                    className={styles.agenteCircle}
                    title={o.crm_agentes ? `${o.crm_agentes.nombre} ${o.crm_agentes.apellidos}` : "Sin agente"}
                    style={{ cursor: "pointer", opacity: o.crm_agentes ? 1 : 0.35, outline: agentePickerOpId === o.id ? "2px solid var(--primary-color, #475569)" : undefined, outlineOffset: 2 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (agentePickerOpId === o.id) { setAgentePickerOpId(null); setAgentePickerPos(null); return; }
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setAgentePickerPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                      setAgentePickerOpId(o.id);
                    }}
                  >
                    {o.crm_agentes ? initials(o.crm_agentes.nombre, o.crm_agentes.apellidos) : "—"}
                  </span>
                </td>
              )}
              <td className={styles.tdCenter} onClick={e => e.stopPropagation()}>
                {editingCell?.opId === o.id && editingCell.field === "prioridad" ? (
                  <input
                    autoFocus
                    type="number"
                    value={editingVal}
                    onChange={e => { setEditingVal(e.target.value); editingValRef.current = e.target.value; }}
                    onBlur={saveEditingCell}
                    onKeyDown={e => { if (e.key === "Enter") saveEditingCell(); if (e.key === "Escape") { setEditingCell(null); editingCellRef.current = null; } }}
                    style={{ width: 44, fontSize: "0.75rem", textAlign: "center", border: "1.5px solid var(--primary-color,#475569)", borderRadius: 4, padding: "1px 2px", outline: "none" }}
                  />
                ) : (
                  <span
                    className={styles.prioridad}
                    title="Click para editar prioridad"
                    style={{ cursor: "pointer" }}
                    onClick={() => startEditingCell(o.id, "prioridad", String(o.prioridad ?? ""))}
                  >
                    {o.prioridad ?? (safePage - 1) * pageSize + i + 1}
                  </span>
                )}
              </td>
              <td className={styles.td} style={{ maxWidth: 260 }}>
                <span
                  style={{ fontWeight: 600, color: "#1e293b", display: "block", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase", fontSize: "0.75rem", cursor: o.contabilidad_entidades ? "pointer" : "default" }}
                  title={o.contabilidad_entidades?.nombre ?? o.titulo}
                  onClick={e => {
                    e.stopPropagation();
                    if (!o.contabilidad_entidades) return;
                    onEntidadClick?.({ entidad: o.contabilidad_entidades });
                  }}
                >
                  {o.contabilidad_entidades?.nombre ?? o.titulo}
                </span>
                {o.contabilidad_entidades?.direccion?.ciudad && (
                  <span style={{ display: "block", fontSize: "0.68rem", color: "#94a3b8", lineHeight: 1.2 }}>
                    {capitalizarCiudad(o.contabilidad_entidades.direccion.ciudad)}
                  </span>
                )}
              </td>
              <td className={styles.tdCenter}>
                <ResponsablesTooltip contactos={o.contabilidad_entidades?.crm_contactos ?? []} />
              </td>
              <td className={styles.td}>
                <EstadosBubbles estados={o.estados_campanas_anteriores ?? []} mono={monocromo} />
              </td>
              {estadosNormales.map(e => {
                const isVisitando = e.nombre?.toLowerCase() === "visitando";
                return (
                <td
                  key={e.id}
                  className={`${styles.tdCenter} ${styles.dropZone} ${styles.tdEstado} ${
                    dragOverCell?.opId === o.id && dragOverCell?.estadoId === e.id
                      ? styles.dropZoneActive
                      : ""
                  }`}
                  onDragOver={(ev) => {
                    if (draggedOpId === o.id) {
                      ev.preventDefault();
                    }
                  }}
                  onDragEnter={() => {
                    if (draggedOpId === o.id) {
                      setDragOverCell({ opId: o.id, estadoId: e.id });
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverCell(null);
                  }}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setDragOverCell(null);
                    const opId = ev.dataTransfer.getData("text/plain");
                    if (opId === o.id && o.estado_id !== e.id) {
                      onEstadoChange(opId, e.id);
                    }
                  }}
                >
                  {o.estado_id === e.id ? (
                    <div
                      draggable
                      onDragStart={(ev) => {
                        setDraggedOpId(o.id);
                        ev.dataTransfer.setData("text/plain", o.id);
                      }}
                      onDragEnd={() => {
                        setDraggedOpId(null);
                      }}
                      onClick={isVisitando ? () => onPresupuestoClick(o.id) : undefined}
                      className={`${styles.draggablePill} ${
                        draggedOpId === o.id ? styles.draggedSource : ""
                      } ${isVisitando ? styles.pillClickable : ""}`}
                    >
                      <StatePill color={e.color} mono={monocromo} fecha={o.fecha_ultimo_cambio_estado ?? o.fecha_cierre_est} notas={o.ultima_nota_log ?? o.mig_notas?.observaciones ?? null} />
                    </div>
                  ) : (
                    <span style={{ display: "block", height: 18 }} />
                  )}
                </td>
              );
              })}
              {conSeparador && <td className={`${styles.tdSep} ${styles.tdSepEstado}`} />}
              {estadosFinalesNegativos.map(e => (
                <td
                  key={e.id}
                  className={`${styles.tdCenter} ${styles.tdGray} ${styles.dropZone} ${styles.tdEstado} ${
                    dragOverCell?.opId === o.id && dragOverCell?.estadoId === e.id
                      ? styles.dropZoneActive
                      : ""
                  }`}
                  onDragOver={(ev) => {
                    if (draggedOpId === o.id) {
                      ev.preventDefault();
                    }
                  }}
                  onDragEnter={() => {
                    if (draggedOpId === o.id) {
                      setDragOverCell({ opId: o.id, estadoId: e.id });
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverCell(null);
                  }}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setDragOverCell(null);
                    const opId = ev.dataTransfer.getData("text/plain");
                    if (opId === o.id && o.estado_id !== e.id) {
                      onEstadoChange(opId, e.id);
                    }
                  }}
                >
                  {o.estado_id === e.id ? (
                    <div
                      draggable
                      onDragStart={(ev) => {
                        setDraggedOpId(o.id);
                        ev.dataTransfer.setData("text/plain", o.id);
                      }}
                      onDragEnd={() => {
                        setDraggedOpId(null);
                      }}
                      onClick={() => onCierreClick(o.id, o.estado_id)}
                      className={`${styles.draggablePill} ${styles.pillClickable} ${
                        draggedOpId === o.id ? styles.draggedSource : ""
                      }`}
                    >
                      <StatePill color={e.color} mono={monocromo} fecha={o.fecha_cierre_est} notas={o.ultima_nota_log ?? o.mig_notas?.observaciones ?? null} />
                    </div>
                  ) : (
                    <span style={{ display: "block", height: 18 }} />
                  )}
                </td>
              ))}
              <td className={`${styles.tdCenter} ${styles.tdEstadoCol}`}>
                {o.crm_campanas_estados && (
                  <StatePill color={o.crm_campanas_estados.color} mono={monocromo} fecha={o.fecha_ultimo_cambio_estado ?? o.fecha_cierre_est} notas={o.ultima_nota_log ?? o.mig_notas?.observaciones ?? null} />
                )}
              </td>
              <td className={styles.tdRight} style={{ fontWeight: 600, color: "#1e293b" }} onClick={e => e.stopPropagation()}>
                {editingCell?.opId === o.id && editingCell.field === "valor_estimado" ? (
                  <input
                    autoFocus
                    type="number"
                    value={editingVal}
                    onChange={e => { setEditingVal(e.target.value); editingValRef.current = e.target.value; }}
                    onBlur={saveEditingCell}
                    onKeyDown={e => { if (e.key === "Enter") saveEditingCell(); if (e.key === "Escape") { setEditingCell(null); editingCellRef.current = null; } }}
                    style={{ width: 80, fontSize: "0.78rem", textAlign: "right", border: "1.5px solid var(--primary-color,#475569)", borderRadius: 4, padding: "1px 4px", outline: "none" }}
                  />
                ) : (
                  <span
                    style={{ cursor: "pointer" }}
                    title="Click para editar estimación"
                    onClick={() => startEditingCell(o.id, "valor_estimado", String(o.valor_estimado || ""))}
                  >
                    {o.valor_estimado > 0 ? `${o.valor_estimado.toLocaleString("es-ES")} €` : <span style={{ color: "#e2e8f0" }}>—</span>}
                  </span>
                )}
              </td>
              <td className={styles.tdCenter}>
                <div className={styles.acciones}>
                  {!o.expediente_id && (
                    <button
                      className={styles.accionBtn}
                      title="Estrategia de captación"
                      style={{ color: o.descripcion ? "var(--primary-color,#475569)" : "#cbd5e1" }}
                      onClick={e => { e.stopPropagation(); setEstrategiaModal({ op: o }); }}
                    >
                      <Rocket size={14} />
                    </button>
                  )}
                  <button
                    className={`${styles.accionBtn} ${styles.accionBtnDanger}`}
                    title="Eliminar oportunidad"
                    onClick={e => { e.stopPropagation(); setConfirmarEliminarId(o.id); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {paginated.length === 0 && (
            <tr>
              <td colSpan={totalCols} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.82rem" }}>
                {search || agenteFilter.length > 0 ? "No hay resultados." : "Esta campaña aún no tiene oportunidades."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      )}

      {/* Paginación */}
      {!showMapa && <div className={styles.pagination}>
        <div className={styles.pageSizeRow}>
          <span className={styles.pageSizeLabel}>Filas por página:</span>
          {PAGE_SIZE_OPTIONS.map(n => (
            <button
              key={n}
              className={`${styles.pageSizeBtn}${pageSize === n ? " " + styles.pageSizeBtnActive : ""}`}
              onClick={() => setPageSize(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className={styles.pageNav}>
          <span className={styles.pageInfo}>
            {filtered.length === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)}`} de {filtered.length}
          </span>
          <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>
            <ChevronLeft size={14} />
          </button>
          <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>}
    </div>

    {/* Modal confirmar eliminación */}
    {confirmarEliminarId && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}
        onClick={() => setConfirmarEliminarId(null)}>
        <div style={{ background: "#fff", borderRadius: "1rem", padding: "1.75rem", maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          onClick={e => e.stopPropagation()}>
          <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: "0.5rem" }}>¿Eliminar oportunidad?</p>
          <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            Esta acción no se puede deshacer. Se eliminará la oportunidad y todo su historial de estados.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              style={{ padding: "0.5rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", fontSize: "0.82rem", color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => setConfirmarEliminarId(null)}
            >Cancelar</button>
            <button
              style={{ padding: "0.5rem 1rem", border: "none", borderRadius: "0.5rem", background: "#ef4444", fontSize: "0.82rem", fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => { onEliminarOportunidad?.(confirmarEliminarId); setConfirmarEliminarId(null); }}
            >Eliminar</button>
          </div>
        </div>
      </div>
    )}

    {/* Agente picker — fuera del tableWrapper para evitar overflow:hidden */}
    {agentePickerOpId && agentePickerPos && (() => {
      const op = paginated.find(o => o.id === agentePickerOpId);
      if (!op) return null;
      return (
        <div
          ref={agentePickerRef}
          style={{
            position: "fixed", top: agentePickerPos.top, left: agentePickerPos.left,
            transform: "translateX(-50%)",
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
            boxShadow: "0 8px 32px rgba(15,23,42,0.14)", zIndex: 99999,
            minWidth: 180, padding: "0.3rem 0", fontSize: "0.8rem",
          }}
        >
          {agentes.map(a => {
            const ag = a.crm_agentes;
            if (!ag) return null;
            const isSelected = op.agente_id === a.agente_id;
            return (
              <div
                key={a.agente_id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0.4rem 0.85rem", cursor: "pointer",
                  background: isSelected ? "color-mix(in srgb, var(--primary-color, #475569) 10%, white)" : undefined,
                  fontWeight: isSelected ? 600 : 400, color: "#1e293b",
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = ""; }}
                onClick={() => { onAgenteChange?.(op.id, a.agente_id); setAgentePickerOpId(null); setAgentePickerPos(null); }}
              >
                <span className={styles.agenteCircle} style={{ width: 24, height: 24, fontSize: "0.62rem", flexShrink: 0 }}>
                  {initials(ag.nombre, ag.apellidos)}
                </span>
                {ag.nombre} {ag.apellidos}
              </div>
            );
          })}
          {op.agente_id && (
            <div
              style={{ padding: "0.3rem 0.85rem", cursor: "pointer", color: "#ef4444", fontSize: "0.74rem", borderTop: "1px solid #f1f5f9", marginTop: 2 }}
              onClick={() => { onAgenteChange?.(op.id, null); setAgentePickerOpId(null); setAgentePickerPos(null); }}
            >
              Quitar agente
            </div>
          )}
        </div>
      );
    })()}

    {/* Modal estrategia / campañas anteriores */}
    {estrategiaModal && (
      <ModalEstrategia
        op={estrategiaModal.op}
        onClose={() => setEstrategiaModal(null)}
        onOportunidadUpdate={onOportunidadUpdate}
        onSave={async (descripcion) => {
          onOportunidadUpdate?.(estrategiaModal.op.id, { descripcion });
          setEstrategiaModal(null);
          try {
            await fetch(`/api/crm/oportunidades/${estrategiaModal.op.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ descripcion }),
            });
          } catch { }
        }}
      />
    )}
    </>
  );
}
