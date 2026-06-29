"use client";

import styles from "./page.module.css";
import { Icons } from "@/lib/icons";
import dynamic from "next/dynamic";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Pagination from "@/app/components/Pagination";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import { getExpedientes } from "@/actions/expedientes";
import NuevoExpedienteModal from "@/app/components/operativa/NuevoExpedienteModal";
import NominatimDestinoTooltip from "@/app/expedientes/components/NominatimDestinoTooltip";
import ModalPvpExpediente from "@/components/modals/ModalPvpExpediente";
import ModalContactoExpediente from "@/components/modals/ModalContactoExpediente";
import {
  mapExpedienteToRow,
  computeMonthsData,
  computeDaysData,
  formatDate,
  type ExpedienteRow,
} from "@/lib/utils/expedientesUtils";

const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Cargando mapa interactivo...</div>,
});

export default function ExpedientesPage() {
  const router = useRouter();

  // ── List data ────────────────────────────────────────────────────────────
  const [dbExpedientes, setDbExpedientes] = useState<any[]>([]);

  // ── Pagination / filters ─────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [sucursalFilter, setSucursalFilter] = useState<string[]>([]);
  const [destinoFilter, setDestinoFilter] = useState<string[]>([]);

  // ── Destino tooltip ───────────────────────────────────────────────────────
  const [activeDestinoTooltip, setActiveDestinoTooltip] = useState<string | null>(null);
  const [destinoTooltipPos, setDestinoTooltipPos] = useState({ top: 0, left: 0 });

  // ── Modal: Nuevo / Editar expediente ─────────────────────────────────────
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [selectedExpediente, setSelectedExpediente] = useState<any | null>(null);

  // ── Modal: PVP ───────────────────────────────────────────────────────────
  const [isPvpOpen, setIsPvpOpen] = useState(false);
  const [pvpExpediente, setPvpExpediente] = useState<ExpedienteRow | null>(null);

  // ── Modal: Contacto ───────────────────────────────────────────────────────
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactExpediente, setContactExpediente] = useState<ExpedienteRow | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadDbExpedientes = useCallback(async () => {
    try {
      const data = await getExpedientes();
      setDbExpedientes(data || []);
    } catch (err) {
      console.error("Error loading expedientes:", err);
    }
  }, []);

  useEffect(() => {
    loadDbExpedientes();
  }, [loadDbExpedientes]);

  const openEditExpediente = useCallback(
    (expediente: any) => {
      const original = expediente.realId
        ? dbExpedientes.find((item) => item.id === expediente.realId)
        : expediente;
      setSelectedExpediente(original ?? expediente);
      setIsExpModalOpen(true);
    },
    [dbExpedientes]
  );

  // ── Derived data ──────────────────────────────────────────────────────────
  const mappedExpedientes = useMemo(
    () => dbExpedientes.map(mapExpedienteToRow),
    [dbExpedientes]
  );

  const agenteOptions = useMemo(
    () => Array.from(new Set(mappedExpedientes.map((e) => e.agente))).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [mappedExpedientes]
  );

  const sucursalOptions = useMemo(
    () => Array.from(new Set(mappedExpedientes.map((e) => e.sucursal))).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [mappedExpedientes]
  );

  const destinoOptions = useMemo(
    () => Array.from(new Set(mappedExpedientes.map((e) => e.destino))).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [mappedExpedientes]
  );

  const monthsData = useMemo(() => computeMonthsData(mappedExpedientes), [mappedExpedientes]);
  const daysData   = useMemo(() => computeDaysData(selectedMonth, mappedExpedientes, monthsData), [selectedMonth, mappedExpedientes, monthsData]);

  const filteredData = useMemo(() => {
    return mappedExpedientes.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !item.id.toLowerCase().includes(q) &&
          !item.cliente.toLowerCase().includes(q) &&
          !item.clienteDesc.toLowerCase().includes(q) &&
          !item.destino.toLowerCase().includes(q) &&
          !(item.contactoNombre?.toLowerCase().includes(q) ?? false)
        ) return false;
      }
      if (agentFilter.length > 0 && !agentFilter.includes(item.agente)) return false;
      if (sucursalFilter.length > 0 && !sucursalFilter.includes(item.sucursal)) return false;
      if (destinoFilter.length > 0 && !destinoFilter.includes(item.destino)) return false;
      if (startDate && item.fechaSalida < startDate) return false;
      if (endDate && item.fechaSalida > endDate) return false;
      return true;
    });
  }, [mappedExpedientes, searchQuery, startDate, endDate, agentFilter, sucursalFilter, destinoFilter]);

  const mapPuntos = useMemo(() =>
    filteredData
      .filter((item) => item.mapLat != null && item.mapLng != null)
      .map((item) => ({
        expedienteId: item.realId,
        numero: item.id,
        referencia: item.clienteDesc,
        destinoNombre: item.destino,
        lat: item.mapLat as number,
        lng: item.mapLng as number,
        estado: item.estado,
      })),
    [filteredData]
  );

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [currentPage, itemsPerPage, filteredData]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Listado de Expedientes</h1>
        </div>
      </header>

      {/* Grid de Stats y Mapa */}
      <div className={styles.topGrid}>
        <div className={styles.statsColumn}>
          <div className={styles.statsRow}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>TENDENCIA COBROS</span>
              <div className={styles.sparkline}>
                <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="gradientCobros" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: "var(--primary-color, #475569)", stopOpacity: 0.3 }} />
                      <stop offset="100%" style={{ stopColor: "white", stopOpacity: 0.1 }} />
                    </linearGradient>
                  </defs>
                  <path d="M0,25 L20,20 L40,28 L60,10 L80,15 L100,5 L100,30 L0,30 Z" fill="url(#gradientCobros)" />
                  <path d="M0,25 L20,20 L40,28 L60,10 L80,15 L100,5" fill="none" stroke="var(--primary-color, #475569)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>OCUPACIÓN ACTUAL</span>
              <div className={styles.occupationContent}>
                <div className={styles.circularProgress}>
                  <svg viewBox="0 0 36 36" className={styles.circularChart}>
                    <path className={styles.circleBg} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className={styles.circle} strokeDasharray="101, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <text x="18" y="20.35" className={styles.percentage}>101%</text>
                  </svg>
                </div>
                <div className={styles.occupationText}>
                  <span className={styles.mainValue}>1172</span>
                  <span className={styles.subValue}>REGISTRADOS de 1160 est.</span>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.statsRow}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>TOTAL COBRADO</span>
              <div className={styles.amountContent}>
                <span className={styles.amount}>26.999,00 €</span>
                <span className={styles.pending}>Pendiente: 662.061,00 €</span>
              </div>
              <Icons.Search size={16} className={styles.cardIcon} />
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeaderWithAction}>
                <span className={styles.cardLabel}>
                  {selectedMonth ? `DETALLE DIARIO: ${selectedMonth.toUpperCase()}` : "EVOLUCIÓN MENSUAL"}
                </span>
                {selectedMonth && (
                  <button className={styles.backButton} onClick={() => setSelectedMonth(null)} title="Volver a meses">
                    <Icons.ChevronDown size={14} style={{ transform: "rotate(90deg)" }} />
                  </button>
                )}
              </div>
              <div className={styles.barChart}>
                {!selectedMonth ? (
                  monthsData.map((item, i) => (
                    <div
                      key={i}
                      className={styles.barColumn}
                      onClick={() => setSelectedMonth(item.month)}
                      data-tooltip={`${item.month}: ${item.count} ${item.count === 1 ? "expediente" : "expedientes"}`}
                    >
                      <div className={styles.barWrapper}>
                        <div className={`${styles.bar} ${styles.clickableBar}`} style={{ height: `${item.val}%` }} />
                      </div>
                      <span className={styles.monthInitial}>{item.month.charAt(0)}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.daysGrid}>
                    {daysData.map((item, i) => (
                      <div
                        key={i}
                        className={styles.dayColumn}
                        data-tooltip={`Día ${item.day}: ${item.count} ${item.count === 1 ? "expediente" : "expedientes"}`}
                      >
                        <div className={styles.dayBarWrapper}>
                          <div className={styles.bar} style={{ height: `${item.val}%` }} />
                        </div>
                        <span className={styles.dayNumber}>{item.day}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.mapCard}>
          <MapComponent
            puntos={mapPuntos}
            onFilterDestino={(name: string) => {
              setDestinoFilter([name]);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Tabla de Expedientes */}
      <div className={styles.tableContainer}>
        <div className={styles.listHeaderTop}>
          <div className={styles.listTitleWrapper}>
            <Icons.Expedientes size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Expedientes ({filteredData.length})</h2>
          </div>
          <div className={styles.actionsWrapper}>
            <div className={styles.searchWrapper}>
              <Icons.Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar por nombre, ID..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <button
              className={`${styles.actionIconButton} ${showFilters ? styles.activeAction : ""}`}
              onClick={() => setShowFilters(!showFilters)}
              title="Filtrar"
            >
              <Icons.Filter size={18} />
            </button>
            <button className={styles.actionIconButton} title="Exportar">
              <Icons.Export size={18} />
            </button>
            <button
              className={styles.addActionButton}
              title="Nuevo Expediente"
              onClick={() => { setSelectedExpediente(null); setIsExpModalOpen(true); }}
            >
              <Icons.Add size={18} />
            </button>
          </div>
        </div>

        {/* Fila de Filtros */}
        {showFilters && (
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Fecha desde</label>
              <input
                type="date"
                className={styles.filterInput}
                value={startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!endDate || v <= endDate) setStartDate(v);
                  else alert("La fecha desde debe ser anterior a la fecha hasta");
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className={styles.filterGroup}>
              <label>Hasta</label>
              <input
                type="date"
                className={styles.filterInput}
                value={endDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!startDate || startDate <= v) setEndDate(v);
                  else alert("La fecha hasta debe ser posterior a la fecha desde");
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className={styles.filterGroup}>
              <label>Agente</label>
              <MultiSelectDropdown options={agenteOptions} selected={agentFilter} onChange={(s) => { setAgentFilter(s); setCurrentPage(1); }} placeholder="Agentes" />
            </div>
            <div className={styles.filterGroup}>
              <label>Sucursal</label>
              <MultiSelectDropdown options={sucursalOptions} selected={sucursalFilter} onChange={(s) => { setSucursalFilter(s); setCurrentPage(1); }} placeholder="Oficinas" />
            </div>
            <div className={styles.filterGroup}>
              <label>Destino</label>
              <MultiSelectDropdown options={destinoOptions} selected={destinoFilter} onChange={(s) => { setDestinoFilter(s); setCurrentPage(1); }} placeholder="Destinos" />
            </div>
          </div>
        )}

        <table className={styles.table}>
          <thead>
            <tr>
              {["EXPEDIENTE", "CLIENTE", "DESTINO", "TIPO", "ESTADO", "PVP", "FECHAS", "PLAZAS", "PROGRESO"].map((col) => (
                <th key={col}>
                  <div className={styles.headerSort}>
                    <span>{col}</span>
                    <Icons.ChevronDown size={12} className={styles.sortIcon} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((exp) => (
              <tr
                key={exp.id}
                onClick={() => router.push(`/expedientes/${exp.realId}`)}
                className={styles.clickableRow}
              >
                <td>
                  <div className={styles.idCell}>
                    <div className={styles.initials}>{exp.iniciales}</div>
                    <div>
                      <div className={styles.expId}>{exp.id}</div>
                      <div className={styles.expDate}>{exp.fecha}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className={styles.clientCell}>
                    {exp.contactoNombre ? (
                      <div
                        onClick={(e) => { e.stopPropagation(); setContactExpediente(exp); setIsContactOpen(true); }}
                        className={styles.clientName}
                        style={{ cursor: "pointer", display: "inline-block" }}
                        title="Cambiar contacto"
                      >
                        {exp.contactoNombre}
                      </div>
                    ) : (
                      <div
                        onClick={(e) => { e.stopPropagation(); setContactExpediente(exp); setIsContactOpen(true); }}
                        className={styles.sinContactoWarning}
                      >
                        ⚠️ Sin Contacto
                      </div>
                    )}
                    <div className={styles.clientDesc}>{exp.clienteDesc}</div>
                  </div>
                </td>
                <td>
                  <div
                    className={styles.destinoCell}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setDestinoTooltipPos({ top: rect.bottom + 4, left: rect.left });
                      setActiveDestinoTooltip(activeDestinoTooltip === exp.realId ? null : exp.realId);
                    }}
                  >
                    <div className={styles.tag}><Icons.Destino size={12} /> {exp.destino}</div>
                    <Icons.ChevronDown size={10} className={styles.destinoChevron} />
                  </div>
                </td>
                <td><span className={styles.typeTag}>{exp.tipo}</span></td>
                <td>
                  <span className={styles.statusTag}>
                    <span className={styles.dot} /> {exp.estado}
                  </span>
                </td>
                <td>
                  <div
                    className={styles.pvpCell}
                    onClick={(e) => { e.stopPropagation(); setPvpExpediente(exp); setIsPvpOpen(true); }}
                  >
                    {exp.pvpViajero != null
                      ? `${Number(exp.pvpViajero).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`
                      : exp.pvpTotal != null
                        ? `${Number(exp.pvpTotal).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`
                        : <span className={styles.pvpEmpty}>-</span>}
                  </div>
                </td>
                <td>
                  <div className={styles.dateCell}>
                    <span>{formatDate(exp.fechaSalida)}</span>
                    <span className={styles.dateReturn}>{formatDate(exp.fechaRegreso)}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.plazasCell}>
                    <span>Ocupación</span>
                    <div className={styles.progressBar}>
                      <div className={styles.progress} style={{ width: `${Math.max(exp.plazasProg, 8)}%` }}>
                        <span className={styles.progressLabel}>{exp.plazas}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className={styles.progressCell}>
                    <div className={styles.progressInfo}>
                      <span>Cobrado</span>
                      <span className={styles.progressValue}><b>{exp.cobrado}</b> / {exp.total}</span>
                    </div>
                    <div className={styles.progressBarMini}>
                      <div className={styles.progressMini} style={{ width: `${exp.progreso}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
        />
      </div>

      {/* Tooltip selector de destino */}
      {activeDestinoTooltip && (() => {
        const exp = filteredData.find((e) => e.realId === activeDestinoTooltip);
        if (!exp) return null;
        return (
          <NominatimDestinoTooltip
            expedienteId={exp.realId}
            currentDestinoName={exp.destino}
            currentDestinoId={exp.destinoId}
            position={destinoTooltipPos}
            onClose={() => setActiveDestinoTooltip(null)}
            onUpdated={loadDbExpedientes}
          />
        );
      })()}

      {/* Modal: Nuevo / Editar expediente */}
      <NuevoExpedienteModal
        isOpen={isExpModalOpen}
        expedienteToEdit={selectedExpediente}
        onClose={() => { setIsExpModalOpen(false); setSelectedExpediente(null); }}
        onSuccess={loadDbExpedientes}
      />

      {/* Modal: PVP */}
      <ModalPvpExpediente
        isOpen={isPvpOpen}
        onClose={() => { setIsPvpOpen(false); setPvpExpediente(null); }}
        expediente={pvpExpediente}
        onSuccess={loadDbExpedientes}
      />

      {/* Modal: Contacto */}
      <ModalContactoExpediente
        isOpen={isContactOpen}
        onClose={() => { setIsContactOpen(false); setContactExpediente(null); }}
        expediente={contactExpediente}
        onSuccess={loadDbExpedientes}
      />
    </div>
  );
}
