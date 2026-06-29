"use client";

import { useState, useMemo } from "react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import styles from "../[id]/page.module.css";
import listStyles from "../page.module.css";
import { Bed, Plane, Compass, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

// Mock Data para Reservas
const MOCK_RESERVAS = [
  {
    id: 1,
    tipo: "hotel",
    concepto: "Hotel Meliá Barajas 4*",
    proveedor: "Meliá Hotels & Resorts",
    localizador: "MEL-9283A",
    fecha_inicio: "2026-06-12",
    fecha_fin: "2026-06-15",
    estado: "confirmado",
    importe: 345.00
  },
  {
    id: 2,
    tipo: "vuelo",
    concepto: "Vuelo Madrid (MAD) - París (CDG)",
    proveedor: "Iberia Express",
    localizador: "IB-7829B",
    fecha_inicio: "2026-06-12",
    fecha_fin: "2026-06-12",
    estado: "confirmado",
    importe: 189.50
  },
  {
    id: 3,
    tipo: "excursion",
    concepto: "Tour guiado Museo del Louvre",
    proveedor: "Civitatis",
    localizador: "CIV-0021A",
    fecha_inicio: "2026-06-13",
    fecha_fin: "2026-06-13",
    estado: "pendiente",
    importe: 75.00
  },
  {
    id: 4,
    tipo: "hotel",
    concepto: "Hotel Riu Plaza España",
    proveedor: "Riu Hotels & Resorts",
    localizador: "RIU-7729C",
    fecha_inicio: "2026-07-04",
    fecha_fin: "2026-07-06",
    estado: "confirmado",
    importe: 420.00
  },
  {
    id: 5,
    tipo: "vuelo",
    concepto: "Vuelo Barcelona (BCN) - Roma (FCO)",
    proveedor: "Vueling Airlines",
    localizador: "VU-9081X",
    fecha_inicio: "2026-07-20",
    fecha_fin: "2026-07-27",
    estado: "confirmado",
    importe: 215.00
  },
  {
    id: 6,
    tipo: "excursion",
    concepto: "Paseo en góndola por Venecia",
    proveedor: "GetYourGuide",
    localizador: "GYG-5512B",
    fecha_inicio: "2026-07-25",
    fecha_fin: "2026-07-25",
    estado: "cancelado",
    importe: 90.00
  },
  {
    id: 7,
    tipo: "hotel",
    concepto: "Gran Hotel Miramar 5*",
    proveedor: "Hoteles Santos",
    localizador: "MIR-1029F",
    fecha_inicio: "2026-08-01",
    fecha_fin: "2026-08-05",
    estado: "pendiente",
    importe: 980.00
  },
  {
    id: 8,
    tipo: "vuelo",
    concepto: "Vuelo Londres (LHR) - Nueva York (JFK)",
    proveedor: "British Airways",
    localizador: "BA-1002Z",
    fecha_inicio: "2026-09-10",
    fecha_fin: "2026-09-18",
    estado: "confirmado",
    importe: 1450.00
  },
  {
    id: 9,
    tipo: "excursion",
    concepto: "Safari privado en Kenia (Masaai Mara)",
    proveedor: "Sensaciones del Mundo",
    localizador: "SAF-9923P",
    fecha_inicio: "2026-10-02",
    fecha_fin: "2026-10-05",
    estado: "pendiente",
    importe: 1200.00
  },
  {
    id: 10,
    tipo: "hotel",
    concepto: "Resort Atlantis The Palm Dubai",
    proveedor: "Atlantis Resorts",
    localizador: "ATL-4412K",
    fecha_inicio: "2026-11-15",
    fecha_fin: "2026-11-20",
    estado: "confirmado",
    importe: 2250.00
  }
];

const getTipoBadgeStyle = (tipo: string) => {
  switch (tipo) {
    case "hotel":
      return {
        bg: "#eff6ff",
        color: "#3b82f6",
        border: "1px solid #dbeafe",
        icon: Bed,
        label: "Hotel"
      };
    case "vuelo":
      return {
        bg: "#f0fdfa",
        color: "#0d9488",
        border: "1px solid #ccfbf1",
        icon: Plane,
        label: "Vuelo"
      };
    case "excursion":
    default:
      return {
        bg: "#faf5ff",
        color: "#a855f7",
        border: "1px solid #f3e8ff",
        icon: Compass,
        label: "Excursión"
      };
  }
};

const getEstadoBadgeStyle = (estado: string) => {
  switch (estado) {
    case "confirmado":
      return {
        bg: "#dcfce7",
        color: "#15803d",
        border: "1px solid #bbf7d0",
        icon: CheckCircle2,
        label: "Confirmado"
      };
    case "pendiente":
      return {
        bg: "#fef3c7",
        color: "#b45309",
        border: "1px solid #fde68a",
        icon: AlertCircle,
        label: "Pendiente"
      };
    case "cancelado":
    default:
      return {
        bg: "#fee2e2",
        color: "#b91c1c",
        border: "1px solid #fecaca",
        icon: XCircle,
        label: "Cancelado"
      };
  }
};

export default function ReservasPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todos" | "hotel" | "vuelo" | "excursion">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "confirmado" | "pendiente" | "cancelado">("todos");
  const [showFilters, setShowFilters] = useState(false);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatImporte = (val: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(val);
  };

  // Filtrado y búsqueda combinados
  const filteredReservas = useMemo(() => {
    return MOCK_RESERVAS.filter((res) => {
      // Filtro por tipo
      if (activeFilter !== "todos" && res.tipo !== activeFilter) {
        return false;
      }
      // Filtro por estado
      if (statusFilter !== "todos" && res.estado !== statusFilter) {
        return false;
      }
      // Búsqueda por texto
      if (searchInput.trim()) {
        const query = searchInput.toLowerCase();
        return (
          res.concepto.toLowerCase().includes(query) ||
          res.proveedor.toLowerCase().includes(query) ||
          res.localizador.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [searchInput, activeFilter, statusFilter]);

  // Paginación
  const paginatedReservas = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredReservas.slice(start, start + rowsPerPage);
  }, [filteredReservas, currentPage, rowsPerPage]);

  const totalItems = filteredReservas.length;

  return (
    <div className={listStyles.container}>
      <header className={listStyles.header}>
        <div className={listStyles.headerRow}>
          <h1 className={listStyles.title}>Reservas Unificadas</h1>
        </div>
      </header>

      {/* SECCIÓN LISTADO RESERVAS */}
      <div style={{ background: "#ffffff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)" }}>
        
        {/* Cabecera del Listado con Buscador e Icono de Filtro */}
        <div className={styles.listHeaderTop} style={{ flexWrap: "wrap", gap: "1rem" }}>
          
          <div className={styles.listTitleWrapper}>
            <Icons.Calendar size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Reservas Unificadas ({totalItems})</h2>
          </div>

          <div className={styles.actionsWrapper}>
            <div className={styles.searchWrapper}>
              <Icons.Search size={16} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Buscar por concepto, localizador..." 
                className={styles.searchInput}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <button 
              className={`${styles.actionIconButton} ${showFilters ? styles.activeAction : ""}`} 
              title="Filtrar"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Icons.Filter size={18} />
            </button>

            <button className={styles.actionIconButton} title="Exportar">
              <Icons.Export size={18} />
            </button>

            <button 
              className={styles.actionIconButton} 
              title="Restablecer"
              onClick={() => {
                setSearchInput("");
                setActiveFilter("todos");
                setStatusFilter("todos");
                setCurrentPage(1);
              }}
            >
              <Icons.RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Línea de Filtros Desplegable */}
        {showFilters && (
          <div style={{
            display: "flex",
            gap: "1.5rem",
            padding: "1rem 1.25rem",
            background: "#f8fafc",
            borderBottom: "1px solid #edf2f7",
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tipo de Servicio</span>
              <select
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "0.4rem 1.75rem 0.4rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.8rem",
                  color: "#1e293b",
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  minWidth: "165px",
                  outline: "none"
                }}
              >
                <option value="todos">Todos los servicios</option>
                <option value="hotel">Hoteles</option>
                <option value="vuelo">Vuelos / Aviones</option>
                <option value="excursion">Excursiones / Actividades</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Estado</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "0.4rem 1.75rem 0.4rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.8rem",
                  color: "#1e293b",
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  minWidth: "165px",
                  outline: "none"
                }}
              >
                <option value="todos">Todos los estados</option>
                <option value="confirmado">Confirmados</option>
                <option value="pendiente">Pendientes</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>
          </div>
        )}

        {/* Tabla de Reservas */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "1%", paddingRight: "0" }}></th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>TIPO</th>
                <th>CONCEPTO / SERVICIO</th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>PROVEEDOR</th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>LOCALIZADOR</th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>F. INICIO</th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>F. FIN</th>
                <th style={{ width: "1%", whiteSpace: "nowrap", textAlign: "center" }}>ESTADO</th>
                <th style={{ textAlign: "right" }}>IMPORTE</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "#64748b", padding: "4rem" }}>
                    <Icons.Search size={32} style={{ color: "#94a3b8", marginBottom: "0.75rem", strokeWidth: 1.5 }} />
                    <div style={{ fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>No se encontraron reservas</div>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>Prueba a cambiar los criterios de búsqueda o filtros</div>
                  </td>
                </tr>
              ) : paginatedReservas.map((res) => {
                const badge = getTipoBadgeStyle(res.tipo);
                const estadoBadge = getEstadoBadgeStyle(res.estado);
                const TypeIcon = badge.icon;
                const StateIcon = estadoBadge.icon;

                return (
                  <tr key={res.id}>
                    <td style={{ width: "1%", paddingRight: "0" }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: badge.bg,
                        color: badge.color,
                        border: badge.border
                      }} title={badge.label}>
                        <TypeIcon size={14} />
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontWeight: "600", color: badge.color }}>
                      {badge.label}
                    </td>
                    <td>
                      <span className={styles.mainText} style={{ fontWeight: "600", color: "#0f172a" }}>
                        {res.concepto}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "#475569" }}>
                      {res.proveedor}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <code style={{ background: "#f1f5f9", padding: "0.2rem 0.4rem", borderRadius: "0.25rem", color: "#475569", fontSize: "0.8rem", fontFamily: "monospace" }}>
                        {res.localizador}
                      </code>
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "#475569" }}>
                      {formatDate(res.fecha_inicio)}
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "#475569" }}>
                      {formatDate(res.fecha_fin)}
                    </td>
                    <td style={{ width: "1%", whiteSpace: "nowrap", textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        background: estadoBadge.bg,
                        color: estadoBadge.color,
                        border: estadoBadge.border,
                        textTransform: "uppercase"
                      }}>
                        <StateIcon size={12} />
                        {estadoBadge.label}
                      </span>
                    </td>
                    <td style={{ 
                      textAlign: "right",
                      fontWeight: "700", 
                      color: res.estado === "cancelado" ? "#94a3b8" : "#0f172a"
                    }}>
                      <span style={{ textDecoration: res.estado === "cancelado" ? "line-through" : "none" }}>
                        {formatImporte(res.importe)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {filteredReservas.length > 0 && (
          <div style={{ borderTop: "1px solid #f1f5f9", padding: "0.75rem 1rem" }}>
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={rowsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
              onItemsPerPageChange={(limit) => {
                setRowsPerPage(limit);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
