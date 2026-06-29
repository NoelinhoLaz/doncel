"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import styles from "./page.module.css";
import Pagination from "@/app/components/Pagination";
import { Search, SlidersHorizontal, Info, Pencil, User, Map, List } from "lucide-react";
import { PipelineCharts } from "./Charts";

type EstadoCampana = "Pdt. Visitar" | "Visitando" | "Pdt. Cotizar" | "Cotizado" | "Revisión" | "Aceptado" | "Denegado" | "Imp. Cotizar";

type Fila = {
  contacto: string;
  localidad: string;
  responsables: number;
  ultCampana: EstadoCampana[];
  pdtVisitar: string | null;
  visitando: string | null;
  pdtCotizar: string | null;
  cotizado: string | null;
  revision: string | null;
  aceptado: string | null;
  denegado: string | null;
  impCotizar: string | null;
};

const DATOS: Fila[] = [
  { contacto: "Familia García López",      localidad: "Madrid",       responsables: 2, ultCampana: ["Aceptado", "Denegado", "Aceptado"],             pdtVisitar: "12/01/2026",  visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Ana y Pedro Martínez",      localidad: "Sevilla",      responsables: 1, ultCampana: ["Denegado"],                                      pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: "18/02/2026",  revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Colegio San José Madrid",   localidad: "Madrid",       responsables: 3, ultCampana: ["Pdt. Cotizar", "Revisión"],                      pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: "25/02/2026",  impCotizar: null },
  { contacto: "Distribuciones Norte S.L.", localidad: "Burgos",       responsables: 1, ultCampana: ["Aceptado", "Aceptado", "Cotizado", "Revisión"],  pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: "15/03/2026",  aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Roberto Sanz Herrero",      localidad: "Valencia",     responsables: 2, ultCampana: ["Pdt. Visitar"],                                  pdtVisitar: null,          visitando: null,          pdtCotizar: "22/02/2026",  cotizado: null,          revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Marta Iglesias Vega",       localidad: "Barcelona",    responsables: 1, ultCampana: ["Cotizado", "Denegado"],                          pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: "22/04/2026",  denegado: null,          impCotizar: null },
  { contacto: "Javier y Laura Ruiz",       localidad: "Zaragoza",     responsables: 3, ultCampana: ["Revisión", "Aceptado", "Revisión"],              pdtVisitar: null,          visitando: "18/03/2026",  pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Carlos Mendoza Ortiz",      localidad: "Málaga",       responsables: 1, ultCampana: ["Denegado", "Denegado"],                          pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: "08/03/2026",  impCotizar: null },
  { contacto: "Elena Ferreira Costa",      localidad: "Porto",        responsables: 2, ultCampana: ["Aceptado"],                                      pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: "14/04/2026",  aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Asociación Mayores Alcalá", localidad: "Alcalá de H.", responsables: 0, ultCampana: ["Visitando", "Pdt. Cotizar", "Aceptado"],         pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: "15/04/2026",  denegado: null,          impCotizar: null },
  { contacto: "David y Sofía Blanco",      localidad: "Bilbao",       responsables: 1, ultCampana: ["Aceptado", "Cotizado"],                          pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: "30/03/2026",  denegado: null,          impCotizar: null },
  { contacto: "Clínica Dental Europea",    localidad: "Madrid",       responsables: 2, ultCampana: ["Pdt. Cotizar", "Revisión", "Denegado"],          pdtVisitar: null,          visitando: "21/01/2026",  pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Tomás Aranda Prieto",       localidad: "Salamanca",    responsables: 1, ultCampana: ["Denegado"],                                      pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: "18/04/2026",  impCotizar: null },
  { contacto: "Familia Moreno Castillo",   localidad: "Granada",      responsables: 3, ultCampana: ["Cotizado", "Aceptado"],                          pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: "26/03/2026",  revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Pilar Navarro Jiménez",     localidad: "Murcia",       responsables: 1, ultCampana: ["Pdt. Visitar", "Denegado"],                      pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: "19/02/2026",  impCotizar: null },
  { contacto: "Club Ski Madrid Norte",     localidad: "Madrid",       responsables: 2, ultCampana: ["Aceptado", "Aceptado", "Revisión"],              pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: "25/02/2026",  aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Rosa Delgado Serrano",      localidad: "Alicante",     responsables: 1, ultCampana: ["Revisión", "Cotizado"],                          pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: "19/03/2026",  revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Grupo Amigos Salamanca",    localidad: "Salamanca",    responsables: 0, ultCampana: ["Pdt. Visitar"],                                  pdtVisitar: "14/04/2026",  visitando: null,          pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "IES Ramón y Cajal Bilbao",  localidad: "Bilbao",       responsables: 2, ultCampana: ["Visitando", "Pdt. Cotizar"],                     pdtVisitar: null,          visitando: "02/04/2026",  pdtCotizar: null,          cotizado: null,          revision: null,          aceptado: null,          denegado: null,          impCotizar: null },
  { contacto: "Lucía Campos Esteve",       localidad: "Valencia",     responsables: 2, ultCampana: ["Cotizado", "Revisión", "Aceptado"],              pdtVisitar: null,          visitando: null,          pdtCotizar: null,          cotizado: null,          revision: "20/04/2026",  aceptado: null,          denegado: null,          impCotizar: null },
];

const VARIANTES: Record<DateColKey, keyof typeof COLORES> = {
  pdtVisitar: "neutral",
  visitando:  "blue",
  pdtCotizar: "orange",
  cotizado:   "orange",
  revision:   "gold",
  aceptado:   "pink",
  denegado:   "red",
  impCotizar: "purple",
};

const COLORES = {
  neutral:  { bg: "#7c3aed", color: "#ffffff" },  // violeta  — Pdt. Visitar
  blue:     { bg: "#e8650a", color: "#ffffff" },  // naranja  — Visitando
  orange:   { bg: "#0ea5c8", color: "#ffffff" },  // cyan     — Pdt. Cotizar / Cotizado
  gold:     { bg: "#eab308", color: "#ffffff" },  // amarillo — Revisión
  pink:     { bg: "#db2777", color: "#ffffff" },  // fucsia   — Aceptado
  red:      { bg: "#374151", color: "#ffffff" },  // gris     — Denegado
  purple:   { bg: "#374151", color: "#ffffff" },  // gris     — Imp. Cotizar
  potencial:{ bg: "#3d9183", color: "#ffffff" },  // teal     — Potencial
};

const ESTADO_VARIANTE: Record<EstadoCampana, keyof typeof COLORES> = {
  "Pdt. Visitar": "neutral",
  "Visitando":    "blue",
  "Pdt. Cotizar": "orange",
  "Cotizado":     "orange",
  "Revisión":     "gold",
  "Aceptado":     "pink",
  "Denegado":     "red",
  "Imp. Cotizar": "purple",
};

const INICIALES: Record<EstadoCampana, string> = {
  "Pdt. Visitar": "PV",
  "Visitando":    "VI",
  "Pdt. Cotizar": "PC",
  "Cotizado":     "CO",
  "Revisión":     "RE",
  "Aceptado":     "AC",
  "Denegado":     "DE",
  "Imp. Cotizar": "IC",
};

function CampanasBubbles({ estados, mono = false }: { estados: EstadoCampana[]; mono?: boolean }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const SIZE = 22;
  const OVERLAP = 8;
  const totalW = estados.length * SIZE - (estados.length - 1) * OVERLAP;

  return (
    <div style={{ position: "relative", width: totalW, height: SIZE, display: "inline-flex" }}>
      {estados.map((estado, i) => {
        const { bg: rawBg, color } = COLORES[ESTADO_VARIANTE[estado]];
        const bg = mono ? "color-mix(in srgb, var(--primary-color, #475569) 60%, white)" : rawBg;
        const isHovered = hoveredIdx === i;
        return (
          <div
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              position: "absolute",
              left: i * (SIZE - OVERLAP),
              zIndex: isHovered ? 10 : i + 1,
              width: isHovered ? "auto" : SIZE,
              height: SIZE,
              borderRadius: 99,
              background: bg,
              color,
              border: "1.5px solid #fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.6rem",
              fontWeight: 700,
              cursor: "default",
              whiteSpace: "nowrap",
              padding: isHovered ? "0 8px" : "0",
              transition: "all 0.15s ease",
              boxShadow: isHovered ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
            }}
          >
            {isHovered ? estado : INICIALES[estado]}
          </div>
        );
      })}
    </div>
  );
}

function DatePill({ fecha, variant, mono = false }: { fecha: string | null; variant: keyof typeof COLORES; mono?: boolean }) {
  if (!fecha) return <span style={{ color: "#e2e8f0", fontSize: "0.7rem" }}>—</span>;
  const { bg, color } = COLORES[variant];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 18, borderRadius: 99, background: mono ? "color-mix(in srgb, var(--primary-color, #475569) 55%, white)" : bg, color, fontSize: "0.68rem", fontWeight: 600, padding: "0 6px", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
      {fecha}
    </span>
  );
}

const ESTIMACION = 26000;

type ColKey = keyof Omit<Fila, "contacto" | "localidad" | "responsables" | "ultCampana">;

function colStats(key: ColKey, src: Fila[] = DATOS) {
  const count = src.filter(r => r[key] !== null).length;
  const total = count * ESTIMACION;
  return { count, total };
}

function ColHeader({ label, colKey, align = "center", className }: { label: string; colKey: ColKey | "estimacion"; align?: "left" | "center" | "right"; className?: string }) {
  const { count, total } = colKey === "estimacion"
    ? { count: DATOS.length, total: DATOS.length * ESTIMACION }
    : colStats(colKey as ColKey);
  return (
    <th className={`${styles.th}${className ? " " + className : ""}`} style={{ textAlign: align }}>
      {label}
    </th>
  );
}

const ESTADOS: EstadoCampana[] = ["Pdt. Visitar", "Visitando", "Pdt. Cotizar", "Cotizado", "Revisión", "Aceptado", "Denegado", "Imp. Cotizar"];

type DateColKey = "pdtVisitar" | "visitando" | "pdtCotizar" | "cotizado" | "revision" | "aceptado" | "denegado" | "impCotizar";

const ESTADO_COL_MAP: Record<EstadoCampana, DateColKey> = {
  "Pdt. Visitar": "pdtVisitar",
  "Visitando":    "visitando",
  "Pdt. Cotizar": "pdtCotizar",
  "Cotizado":     "cotizado",
  "Revisión":     "revision",
  "Aceptado":     "aceptado",
  "Denegado":     "denegado",
  "Imp. Cotizar": "impCotizar",
};

export default function OportunidadesPage() {
  const [datos, setDatos] = useState<Fila[]>(DATOS);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [prioridadFilter, setPrioridadFilter] = useState<number[]>([]);
  const [estadoFilter, setEstadoFilter] = useState<EstadoCampana[]>([]);
  const [ultCampanaFilter, setUltCampanaFilter] = useState<EstadoCampana[]>([]);
  const [localidadFilter, setLocalidadFilter] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<"prioridad"|"estado"|"ultCampana"|"localidad"|null>(null);

  const LOCALIDADES = useMemo(() => [...new Set(datos.map(r => r.localidad))].sort(), [datos]);

  const [dragOver, setDragOver] = useState<{ contacto: string; col: DateColKey } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, contacto: string, col: DateColKey, fecha: string) => {
    e.dataTransfer.setData("contacto", contacto);
    e.dataTransfer.setData("fromCol", col);
    e.dataTransfer.setData("fecha", fecha);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const DATE_COLS: DateColKey[] = ["pdtVisitar","visitando","pdtCotizar","cotizado","revision","aceptado","denegado","impCotizar"];

  const handleDrop = useCallback((e: React.DragEvent, toCol: DateColKey, toContacto: string) => {
    e.preventDefault();
    const contacto = e.dataTransfer.getData("contacto");
    const fromCol  = e.dataTransfer.getData("fromCol") as DateColKey;
    const fecha    = e.dataTransfer.getData("fecha");
    if (!contacto || !fromCol || !fecha) return;
    setDatos(prev => prev.map(row => {
      if (row.contacto === contacto) {
        // Clear all date cols, then set only the target
        const cleared = DATE_COLS.reduce((acc, k) => ({ ...acc, [k]: null }), {} as Pick<Fila, DateColKey>);
        return { ...row, ...cleared, [toCol]: fecha };
      }
      return row;
    }));
    setDragOver(null);
  }, []);
  const filterRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openDropdown) return;
    function handleClick(e: MouseEvent) {
      // The dropdown menu is position:absolute inside filterRow — still in the DOM tree
      if (filterRowRef.current && !filterRowRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    // Use capture phase so it fires before any stopPropagation inside the menu
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [openDropdown]);

  const filtered = useMemo(() => {
    return datos.filter((row, idx) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!row.contacto.toLowerCase().includes(q)) return false;
      }
      if (prioridadFilter.length > 0) {
        if (!prioridadFilter.includes((idx % 5) + 1)) return false;
      }
      if (estadoFilter.length > 0) {
        const estadoColMap: Record<EstadoCampana, keyof Fila> = {
          "Pdt. Visitar": "pdtVisitar", "Visitando": "visitando", "Pdt. Cotizar": "pdtCotizar",
          "Cotizado": "cotizado", "Revisión": "revision", "Aceptado": "aceptado",
          "Denegado": "denegado", "Imp. Cotizar": "impCotizar",
        };
        const hasAny = estadoFilter.some(e => row[estadoColMap[e]] !== null);
        if (!hasAny) return false;
      }
      if (ultCampanaFilter.length > 0) {
        const hasAny = ultCampanaFilter.some(e => row.ultCampana.includes(e));
        if (!hasAny) return false;
      }
      if (localidadFilter.length > 0) {
        if (!localidadFilter.includes(row.localidad)) return false;
      }
      return true;
    });
  }, [datos, searchQuery, prioridadFilter, estadoFilter, ultCampanaFilter, localidadFilter]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [currentPage, itemsPerPage, filtered]);

  const KPIS: { label: string; colKey: ColKey | "estimacion"; variant: keyof typeof COLORES }[] = [
    { label: "Potencial",     colKey: "estimacion",  variant: "potencial" },
    { label: "Pdt. Visitar",  colKey: "pdtVisitar",  variant: "neutral"   },
    { label: "Visitando",     colKey: "visitando",   variant: "blue"      },
    { label: "Pdt. Cotizar",  colKey: "pdtCotizar",  variant: "orange"    },
    { label: "Cotizado",      colKey: "cotizado",    variant: "orange"    },
    { label: "Revisión",      colKey: "revision",    variant: "gold"      },
    { label: "Aceptado",      colKey: "aceptado",    variant: "pink"      },
    { label: "Denegado",      colKey: "denegado",    variant: "red"       },
    { label: "Imp. Cotizar",  colKey: "impCotizar",  variant: "purple"    },
  ];

  const [monocromo, setMonocromo] = useState(false);
  const [viewMode, setViewMode] = useState<"lista" | "mapa">("lista");

  const monoColor = (hex: string) => monocromo ? "var(--primary-color, #475569)" : hex;
  const monoBg    = (_hex: string, alpha = 20) => monocromo ? `color-mix(in srgb, var(--primary-color, #475569) ${alpha}%, white)` : _hex;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Oportunidades</h1>
        <button
          className={styles.monoSwitch}
          onClick={() => setViewMode(v => v === "lista" ? "mapa" : "lista")}
          title={viewMode === "lista" ? "Ver en mapa" : "Ver en lista"}
        >
          {viewMode === "lista" ? <Map size={18} /> : <List size={18} />}
        </button>
        <button className={styles.monoSwitch} onClick={() => setMonocromo(v => !v)} title={monocromo ? "Cambiar a color" : "Cambiar a monocromo"}>
          {monocromo ? (
            /* Círculo mitad 20% / mitad 60% del color principal */
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="13" cy="13" r="12" fill="color-mix(in srgb, var(--primary-color, #475569) 20%, white)" stroke="color-mix(in srgb, var(--primary-color, #475569) 40%, white)" strokeWidth="1"/>
              <path d="M13 1 A12 12 0 0 1 13 25 Z" fill="color-mix(in srgb, var(--primary-color, #475569) 60%, white)"/>
            </svg>
          ) : (
            /* Rueda de colores */
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="13" cy="13" r="12" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
              {[
                { color: "#ef4444", r: 0 },
                { color: "#f97316", r: 60 },
                { color: "#eab308", r: 120 },
                { color: "#22c55e", r: 180 },
                { color: "#3b82f6", r: 240 },
                { color: "#a855f7", r: 300 },
              ].map(({ color, r }, i) => {
                const start = (r - 30) * Math.PI / 180;
                const end   = (r + 30) * Math.PI / 180;
                const x1 = 13 + 12 * Math.cos(start);
                const y1 = 13 + 12 * Math.sin(start);
                const x2 = 13 + 12 * Math.cos(end);
                const y2 = 13 + 12 * Math.sin(end);
                return (
                  <path key={i}
                    d={`M13,13 L${x1.toFixed(2)},${y1.toFixed(2)} A12,12 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`}
                    fill={color}
                  />
                );
              })}
              <circle cx="13" cy="13" r="5" fill="white"/>
            </svg>
          )}
        </button>
      </div>

      <div className={`${styles.kpiRow}${monocromo ? " " + styles.monoMode : ""}`}>
        {KPIS.map(({ label, colKey, variant }, kpiIdx) => {
          const { count, total } = colKey === "estimacion"
            ? { count: DATOS.length, total: DATOS.length * ESTIMACION }
            : colStats(colKey as ColKey);
          const { bg, color } = COLORES[variant];
          // Split into two halves for P1 / P2 sub-rows
          const half = Math.ceil(count / 2);
          const p1count = half;
          const p2count = count - half;
          const p1total = p1count * ESTIMACION;
          const p2total = p2count * ESTIMACION;
          // Mono KPIs: gradient of alphas from 80% (first) to 25% (last)
          const monoAlpha = Math.round(80 - kpiIdx * (55 / Math.max(KPIS.length - 1, 1)));
          const cardBg  = monoBg(bg, monoAlpha);
          const cardClr = monocromo ? "#fff" : color;
          return (
            <div key={label} className={styles.kpiCard} style={{ background: cardBg }}>
              <span className={styles.kpiLabel} style={{ color: `${cardClr}99`, textAlign: "center" }}>{label.toUpperCase()}</span>
              <span className={styles.kpiTotal} style={{ color: cardClr, textAlign: "center" }}>
                {total.toLocaleString("es-ES")} € <span style={{ fontWeight: 500, fontSize: "0.85rem" }}>({count})</span>
              </span>
              <div style={{ borderTop: `1px solid ${cardClr}33`, marginTop: "0.35rem", paddingTop: "0.3rem", display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: `${cardClr}cc` }}>
                  <span>P1</span>
                  <span>{p1total.toLocaleString("es-ES")} € ({p1count})</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: `${cardClr}cc` }}>
                  <span>P2</span>
                  <span>{p2total.toLocaleString("es-ES")} € ({p2count})</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <PipelineCharts monocromo={monocromo} />

      {viewMode === "mapa" && (
        <div style={{ flex: 1, minHeight: 400, background: "#f1f5f9", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "1rem", gap: "0.5rem" }}>
          <Map size={24} />
          Vista de mapa — próximamente
        </div>
      )}

      <div className={styles.tableWrapper} style={{ display: viewMode === "mapa" ? "none" : undefined }}>
        {/* Tabla header row */}
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>Listado de oportunidades ({filtered.length})</span>
          <div className={styles.tableActions}>
            <div className={styles.searchWrapper}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Buscar contacto..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <button
              className={`${styles.filterIconBtn} ${showFilters || prioridadFilter.length > 0 || estadoFilter.length > 0 || ultCampanaFilter.length > 0 || localidadFilter.length > 0 ? styles.filterIconBtnActive : ""}`}
              onClick={() => { setShowFilters(v => !v); setOpenDropdown(null); }}
              title="Filtros"
            >
              <SlidersHorizontal size={15} />
              {(prioridadFilter.length + estadoFilter.length + ultCampanaFilter.length + localidadFilter.length) > 0 && (
                <span className={styles.filterBadge}>{prioridadFilter.length + estadoFilter.length + ultCampanaFilter.length + localidadFilter.length}</span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className={styles.filterRow} ref={filterRowRef}>
            {/* Prioridad dropdown */}
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger} ${prioridadFilter.length > 0 ? styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "prioridad" ? null : "prioridad")}
              >
                Prioridad {prioridadFilter.length > 0 && <span className={styles.filterDropdownBadge}>{prioridadFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "prioridad" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "prioridad" && (
                <div className={styles.filterDropdownMenu}>
                  {[1,2,3,4,5].map(p => {
                    const active = prioridadFilter.includes(p);
                    return (
                      <label key={p} className={styles.filterDropdownItem}>
                        <input type="checkbox" checked={active} onChange={() => {
                          setPrioridadFilter(prev => active ? prev.filter(x => x !== p) : [...prev, p]);
                          setCurrentPage(1);
                        }} />
                        <span className={styles.prioridad} style={{ width: 20, height: 20, fontSize: "0.65rem" }}>{p}</span>
                        <span>Prioridad {p}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Estado dropdown */}
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger} ${estadoFilter.length > 0 ? styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "estado" ? null : "estado")}
              >
                Estado {estadoFilter.length > 0 && <span className={styles.filterDropdownBadge}>{estadoFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "estado" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "estado" && (
                <div className={styles.filterDropdownMenu}>
                  {ESTADOS.map(estado => {
                    const active = estadoFilter.includes(estado);
                    const { bg, color } = COLORES[ESTADO_VARIANTE[estado]];
                    return (
                      <label key={estado} className={styles.filterDropdownItem}>
                        <input type="checkbox" checked={active} onChange={() => {
                          setEstadoFilter(prev => active ? prev.filter(e => e !== estado) : [...prev, estado]);
                          setCurrentPage(1);
                        }} />
                        <span className={styles.filterPillChip} style={{ background: bg, color }}>{estado}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ult. Campaña dropdown */}
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger} ${ultCampanaFilter.length > 0 ? styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "ultCampana" ? null : "ultCampana")}
              >
                Ult. Campaña {ultCampanaFilter.length > 0 && <span className={styles.filterDropdownBadge}>{ultCampanaFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "ultCampana" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "ultCampana" && (
                <div className={styles.filterDropdownMenu}>
                  {ESTADOS.map(estado => {
                    const active = ultCampanaFilter.includes(estado);
                    const { bg, color } = COLORES[ESTADO_VARIANTE[estado]];
                    return (
                      <label key={estado} className={styles.filterDropdownItem}>
                        <input type="checkbox" checked={active} onChange={() => {
                          setUltCampanaFilter(prev => active ? prev.filter(e => e !== estado) : [...prev, estado]);
                          setCurrentPage(1);
                        }} />
                        <span className={styles.filterPillChip} style={{ background: bg, color }}>{estado}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Localidad dropdown */}
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger} ${localidadFilter.length > 0 ? styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "localidad" ? null : "localidad")}
              >
                Localidad {localidadFilter.length > 0 && <span className={styles.filterDropdownBadge}>{localidadFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "localidad" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "localidad" && (
                <div className={styles.filterDropdownMenu}>
                  {LOCALIDADES.map(loc => {
                    const active = localidadFilter.includes(loc);
                    return (
                      <label key={loc} className={styles.filterDropdownItem}>
                        <input type="checkbox" checked={active} onChange={() => {
                          setLocalidadFilter(prev => active ? prev.filter(l => l !== loc) : [...prev, loc]);
                          setCurrentPage(1);
                        }} />
                        <span>{loc}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {(prioridadFilter.length + estadoFilter.length + ultCampanaFilter.length + localidadFilter.length) > 0 && (
              <button className={styles.filterClear} onClick={() => { setPrioridadFilter([]); setEstadoFilter([]); setUltCampanaFilter([]); setLocalidadFilter([]); setOpenDropdown(null); }}>
                Limpiar todo
              </button>
            )}
          </div>
        )}

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} style={{ textAlign: "center", width: 36 }}>P</th>
              <th className={styles.th} style={{ textAlign: "left" }}>Contacto</th>
              <th className={styles.th} style={{ textAlign: "center", width: 48 }}>Resp.</th>
              <th className={styles.th}>Ult. Campaña</th>
              <ColHeader label="Pdt. Visitar"  colKey="pdtVisitar"  />
              <ColHeader label="Visitando"      colKey="visitando"   />
              <ColHeader label="Pdt. Cotizar"  colKey="pdtCotizar"  />
              <ColHeader label="Cotizado"       colKey="cotizado"    />
              <ColHeader label="Revisión"       colKey="revision"    />
              <ColHeader label="Aceptado"       colKey="aceptado"    />
              <th className={styles.thSep} />
              <ColHeader label="Denegado"       colKey="denegado"    className={styles.thGray} />
              <ColHeader label="Imp. Cotizar"   colKey="impCotizar"  className={styles.thGray} />
              <ColHeader label="Estimación"     colKey="estimacion"  align="right" />
              <th className={styles.th} style={{ textAlign: "center", width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr key={i} className={styles.tr}>
                <td className={styles.tdCenter}>
                  <span className={styles.prioridad}>{(i % 5) + 1}</span>
                </td>
                <td className={styles.td}>
                  <span style={{ fontWeight: 600, color: "#1e293b", display: "block" }}>{row.contacto}</span>
                  <span className={styles.responsable}>{row.localidad}</span>
                </td>
                <td className={styles.tdCenter}>
                  <span className={styles.respCell}>
                    <User size={11} strokeWidth={2} />
                    {row.responsables}
                  </span>
                </td>
                <td className={styles.td}><CampanasBubbles estados={row.ultCampana} mono={monocromo} /></td>
                {(["pdtVisitar","visitando","pdtCotizar","cotizado","revision","aceptado","denegado","impCotizar"] as DateColKey[]).map((col, ci) => {
                  const fecha = row[col] as string | null;
                  const variant = VARIANTES[col];
                  const isOver = dragOver?.contacto === row.contacto && dragOver?.col === col;
                  const isGray = col === "denegado" || col === "impCotizar";
                  const isSepBefore = ci === 6;
                  return (
                    <React.Fragment key={col}>
                      {isSepBefore && <td className={styles.tdSep} />}
                      <td
                        className={`${styles.tdCenter}${isGray ? " " + styles.tdGray : ""}`}
                        onDragOver={e => { e.preventDefault(); setDragOver({ contacto: row.contacto, col }); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={e => handleDrop(e, col, row.contacto)}
                        style={{ background: isOver ? "rgba(99,102,241,0.08)" : undefined, transition: "background 0.1s" }}
                      >
                        {fecha ? (
                          <span
                            draggable
                            onDragStart={e => handleDragStart(e, row.contacto, col, fecha)}
                            style={{ cursor: "grab", display: "inline-block" }}
                          >
                            <DatePill fecha={fecha} variant={variant} mono={monocromo} />
                          </span>
                        ) : (
                          <span style={{ display: "block", height: 18 }} />
                        )}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className={styles.tdRight} style={{ fontWeight: 600, color: "#1e293b" }}>26.000 €</td>
                <td className={styles.tdCenter}>
                  <div className={styles.acciones}>
                    <button className={styles.accionBtn} title="Info"><Info size={14} /></button>
                    <button className={styles.accionBtn} title="Editar"><Pencil size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
}
