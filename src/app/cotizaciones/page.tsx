"use client";

import listStyles from "../expedientes/page.module.css";
import styles from "../expedientes/[id]/page.module.css";
import { Icons } from "@/lib/icons";
import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, UserRound, X, Search, MapPin, Rows3, List, Filter, ChevronRight, ChevronDown, Compass } from "lucide-react";
import Pagination from "@/app/components/Pagination";
import { duplicateCotizacion, deleteCotizacion, updateCotizacionLinea } from "@/actions/cotizaciones";
import TipoIcon from "@/app/components/cotizacion/TipoIcon";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("../expedientes/MapComponent"), {
  ssr: false,
  loading: () => <div style={{ height: 600, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", background: "#f8fafc", borderRadius: 10 }}>Cargando mapa...</div>,
});

type ContactoModal = { cotizacionId: string; currentId: string | null; currentNombre: string | null };

function ModalBuscarContacto({ modal, onClose, onSelect }: {
  modal: ContactoModal;
  onClose: () => void;
  onSelect: (cotizacionId: string, entidad: { id: string; nombre: string } | null) => void;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/entidades?q=${encodeURIComponent(q)}`);
        const j = await res.json();
        setResultados(j?.data || []);
      } finally {
        setBuscando(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.35)" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "0.75rem", width: 480, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem 0.75rem", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Asignar contacto</span>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={16} /></button>
        </div>
        {/* Search */}
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar entidad por nombre..."
            style={{ border: "none", outline: "none", width: "100%", fontSize: "0.85rem", color: "#1e293b" }}
          />
        </div>
        {/* Quitar contacto */}
        {modal.currentId && (
          <div style={{ padding: "0.5rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
            <button
              onClick={() => onSelect(modal.cotizacionId, null)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "0.35rem 0.75rem", cursor: "pointer", color: "#dc2626", fontSize: "0.75rem", fontWeight: 600 }}
            >
              <X size={12} /> Quitar contacto actual ({modal.currentNombre})
            </button>
          </div>
        )}
        {/* Resultados */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {buscando ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Buscando...</div>
          ) : resultados.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Sin resultados</div>
          ) : resultados.map((e: any) => (
            <button
              key={e.id}
              onClick={() => onSelect(modal.cotizacionId, { id: e.id, nombre: e.nombre })}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "0.65rem 1.25rem", border: "none", background: modal.currentId === e.id ? "#f0f9ff" : "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f8fafc" }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <UserRound size={13} style={{ color: "#0369a1" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>{e.nombre}</div>
                {e.email && <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{e.email}</div>}
              </div>
              {modal.currentId === e.id && <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#0369a1", fontWeight: 700 }}>Actual</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CotizacionesPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"cotizaciones" | "lineas">("cotizaciones");
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [contactoModal, setContactoModal] = useState<ContactoModal | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [destinoFilter, setDestinoFilter] = useState<string[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [expandedCotizacionIds, setExpandedCotizacionIds] = useState<string[]>([]);
  const [allServiceTypes, setAllServiceTypes] = useState<any[]>([]);

  const toggleExpandCotizacion = (id: string) => {
    if (expandedCotizacionIds.includes(id)) {
      setExpandedCotizacionIds(expandedCotizacionIds.filter(x => x !== id));
    } else {
      setExpandedCotizacionIds([...expandedCotizacionIds, id]);
    }
  };

  const loadCotizaciones = () => {
    fetch("/api/cotizaciones")
      .then(r => r.json())
      .then(j => {
        if (j?.success) setCotizaciones(j.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const loadServiceTypes = () => {
    fetch("/api/tipos-servicios")
      .then(r => r.json())
      .then(data => setAllServiceTypes(data || []))
      .catch(() => {});
  };

  useEffect(() => { 
    loadCotizaciones(); 
    loadServiceTypes();
  }, []);

  const allLines = useMemo(() => {
    const linesList: any[] = [];
    cotizaciones.forEach((c: any) => {
      const lineas: any[] = c.operativa_cotizacion_lineas || [];
      lineas.forEach((l: any) => {
        linesList.push({
          ...l,
          cotizacionId: c.id,
          cotizacionTitulo: c.titulo || "Cotización",
          agente: c.agente,
          fecha_salida: c.fecha_salida,
          fecha_regreso: c.fecha_regreso
        });
      });
    });
    return linesList;
  }, [cotizaciones]);

  const agenteOptions = useMemo(() => {
    const names = cotizaciones
      .map((c: any) => c.agente?.nombre)
      .filter((n: any) => !!n);
    return Array.from(new Set(names)).sort() as string[];
  }, [cotizaciones]);

  const destinoOptions = useMemo(() => {
    const names: string[] = [];
    cotizaciones.forEach((c: any) => {
      const lineas = c.operativa_cotizacion_lineas || [];
      lineas.forEach((l: any) => {
        const destName = l.maestro_destinos ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre) : "";
        if (destName) names.push(destName);
      });
    });
    return Array.from(new Set(names)).sort() as string[];
  }, [cotizaciones]);

  const tipoOptions = useMemo(() => {
    const labels = allLines
      .map((l: any) => l.config_tipos_servicios?.etiqueta)
      .filter((lbl: any) => !!lbl);
    return Array.from(new Set(labels)).sort() as string[];
  }, [allLines]);

  const kpisServicios = useMemo(() => {
    let totalServicios = 0;
    let totalNeto = 0;
    let totalPvp = 0;
    
    const activeByType: Record<string, { count: number; neto: number; pvp: number }> = {};
    
    allLines.forEach((l: any) => {
      totalServicios += 1;
      totalNeto += Number(l.total_neto || l.neto || 0);
      totalPvp += Number(l.total_pvp || l.pvp || 0);
      
      const label = l.config_tipos_servicios?.etiqueta || "Otros";
      if (!activeByType[label]) {
        activeByType[label] = { count: 0, neto: 0, pvp: 0 };
      }
      activeByType[label].count += 1;
      activeByType[label].neto += Number(l.total_neto || l.neto || 0);
      activeByType[label].pvp += Number(l.total_pvp || l.pvp || 0);
    });
    
    const allTypesList = allServiceTypes.map((t: any) => {
      const active = activeByType[t.etiqueta] || { count: 0, neto: 0, pvp: 0 };
      return {
        label: t.etiqueta,
        count: active.count,
        neto: active.neto,
        pvp: active.pvp,
        icon: t.icono || "compass"
      };
    });
    
    const knownLabels = new Set(allServiceTypes.map((t: any) => t.etiqueta));
    const activeLabels = Object.keys(activeByType);
    const hasOtros = activeLabels.some(l => !knownLabels.has(l));
    if (hasOtros) {
      let otrosCount = 0;
      let otrosNeto = 0;
      let otrosPvp = 0;
      activeLabels.forEach(l => {
        if (!knownLabels.has(l)) {
          otrosCount += activeByType[l].count;
          otrosNeto += activeByType[l].neto;
          otrosPvp += activeByType[l].pvp;
        }
      });
      allTypesList.push({
        label: "Otros",
        count: otrosCount,
        neto: otrosNeto,
        pvp: otrosPvp,
        icon: "compass"
      });
    }
    
    const sortedTypes = allTypesList.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    });
    
    return {
      totalServicios,
      totalNeto,
      totalPvp,
      types: sortedTypes
    };
  }, [allLines, allServiceTypes]);

  const filteredCotizaciones = useMemo(() => {
    return cotizaciones.filter((c: any) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch = (c.titulo || "").toLowerCase().includes(q) || (c.id || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (agenteFilter.length > 0 && (!c.agente?.nombre || !agenteFilter.includes(c.agente.nombre))) return false;
      if (destinoFilter.length > 0) {
        const lineas = c.operativa_cotizacion_lineas || [];
        const hasDest = lineas.some((l: any) => {
          const destName = l.maestro_destinos ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre) : "";
          return destinoFilter.includes(destName);
        });
        if (!hasDest) return false;
      }
      if (fechaDesde && c.fecha_salida && c.fecha_salida < fechaDesde) return false;
      if (fechaHasta && c.fecha_regreso && c.fecha_regreso > fechaHasta) return false;
      return true;
    });
  }, [cotizaciones, search, agenteFilter, destinoFilter, fechaDesde, fechaHasta]);

  const filteredLines = useMemo(() => {
    return allLines.filter((l: any) => {
      if (search) {
        const q = search.toLowerCase();
        const destName = l.maestro_destinos ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre) : "";
        const provName = l.contabilidad_proveedores ? (l.contabilidad_proveedores.nombre || l.contabilidad_proveedores.razon_social) : "";
        const matchesSearch = (l.descripcion || "").toLowerCase().includes(q) ||
          (l.cotizacionTitulo || "").toLowerCase().includes(q) ||
          destName.toLowerCase().includes(q) ||
          provName.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (agenteFilter.length > 0 && (!l.agente?.nombre || !agenteFilter.includes(l.agente.nombre))) return false;
      if (destinoFilter.length > 0) {
        const destName = l.maestro_destinos ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre) : "";
        if (!destinoFilter.includes(destName)) return false;
      }
      if (fechaDesde && l.fecha_salida && l.fecha_salida < fechaDesde) return false;
      if (fechaHasta && l.fecha_regreso && l.fecha_regreso > fechaHasta) return false;
      if (tipoFilter.length > 0 && (!l.config_tipos_servicios?.etiqueta || !tipoFilter.includes(l.config_tipos_servicios.etiqueta))) return false;
      return true;
    });
  }, [allLines, search, agenteFilter, destinoFilter, fechaDesde, fechaHasta, tipoFilter]);

  const cotizacionesMapPoints = useMemo(() => {
    const points: any[] = [];
    filteredCotizaciones.forEach((c: any) => {
      const dests: any[] = c.destinos || [];
      dests.forEach((d: any) => {
        const lat = Number(d.lat);
        const lng = Number(d.lng);
        if (d && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          points.push({
            expedienteId: c.id,
            numero: c.id.substring(0, 8),
            referencia: c.titulo || "Cotización",
            destinoNombre: d.nombre,
            lat,
            lng
          });
        }
      });
    });
    return points;
  }, [filteredCotizaciones]);

  const lineasMapPoints = useMemo(() => {
    const points: any[] = [];
    filteredLines.forEach((l: any) => {
      const dst = l.maestro_destinos;
      const lat = Number(dst?.lat);
      const lng = Number(dst?.lng);
      if (dst && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        points.push({
          expedienteId: l.cotizacionId,
          numero: l.cotizacionTitulo || "Línea",
          referencia: l.descripcion || "Servicio",
          destinoNombre: dst.nombre_comercial || dst.nombre || "Destino",
          lat,
          lng
        });
      }
    });
    return points;
  }, [filteredLines]);

  const totalItems = viewMode === "cotizaciones" ? filteredCotizaciones.length : filteredLines.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = useMemo(() => {
    return viewMode === "cotizaciones"
      ? filteredCotizaciones.slice(startIndex, startIndex + itemsPerPage)
      : filteredLines.slice(startIndex, startIndex + itemsPerPage);
  }, [viewMode, filteredCotizaciones, filteredLines, startIndex, itemsPerPage]);

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-ES");
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case "borrador": return { bg: "#f1f5f9", color: "#64748b" };
      case "presentada": return { bg: "#dbeafe", color: "#2563eb" };
      case "aceptada": return { bg: "#dcfce7", color: "#16a34a" };
      case "rechazada": return { bg: "#fee2e2", color: "#dc2626" };
      default: return { bg: "#f1f5f9", color: "#64748b" };
    }
  };

  const f = (n: any) => Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 });

  const handleToggleSelectLine = (lineId: string) => {
    setSelectedLineIds(prev =>
      prev.includes(lineId) ? prev.filter(id => id !== lineId) : [...prev, lineId]
    );
  };

  const handleToggleAllLinesSelect = () => {
    const allChecked = paginated.length > 0 && paginated.every((l: any) => selectedLineIds.includes(l.id));
    const pageLineIds = paginated.map((l: any) => l.id);
    if (allChecked) {
      setSelectedLineIds(prev => prev.filter(id => !pageLineIds.includes(id)));
    } else {
      setSelectedLineIds(prev => {
        const newSelection = [...prev];
        pageLineIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, titulo: string) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la cotización "${titulo || 'Cotización'}" y todas sus líneas? Esta acción no se puede deshacer.`)) return;
    setDeleting(id);
    try {
      const result = await deleteCotizacion(id);
      if (result.success) {
        setCotizaciones(prev => prev.filter(c => c.id !== id));
      } else {
        alert("Error al eliminar: " + result.error);
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleSelectContacto = useCallback(async (cotizacionId: string, entidad: { id: string; nombre: string } | null) => {
    setContactoModal(null);
    await fetch(`/api/cotizaciones?id=${cotizacionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacto: entidad?.id ?? null }),
    });
    setCotizaciones(prev => prev.map(c => c.id === cotizacionId
      ? { ...c, contacto: entidad?.id ?? null, contabilidad_entidades: entidad ? { id: entidad.id, nombre: entidad.nombre } : null }
      : c
    ));
  }, []);

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDuplicating(id);
    try {
      const result = await duplicateCotizacion(id);
      if (result.success) {
        loadCotizaciones();
      } else {
        alert("Error al duplicar: " + result.error);
      }
    } finally {
      setDuplicating(null);
    }
  };

  return (
    <div className={listStyles.container}>
      {contactoModal && (
        <ModalBuscarContacto
          modal={contactoModal}
          onClose={() => setContactoModal(null)}
          onSelect={handleSelectContacto}
        />
      )}
      <header className={listStyles.header} style={{ marginBottom: "0px" }}>
        <div className={listStyles.headerRow}>
          <h1 className={listStyles.title}>Cotizaciones</h1>
        </div>
      </header>

      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(6, 1fr)",
          gridTemplateRows: "repeat(2, auto)",
          gap: "1rem", 
          marginBottom: "1.25rem",
          width: "100%",
          boxSizing: "border-box"
        }}
      >
        {kpisServicios.types.slice(0, 12).map((type) => (
          <div 
            key={type.label} 
            style={{ 
              minWidth: "140px", 
              background: "#fff", 
              borderRadius: "0.75rem", 
              padding: "1rem", 
              border: "1px solid #e2e8f0", 
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              position: "relative",
              overflow: "hidden"
            }}
          >
              <div style={{ position: "relative", zIndex: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em" }}>{type.label}</span>
                </div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.1, marginBottom: "0.25rem" }}>
                  {type.count}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>
                  Neto: <span style={{ fontWeight: 600, color: "#475569" }}>{f(type.neto)} €</span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "2px" }}>
                  PVP: <span style={{ fontWeight: 600, color: "#1e293b" }}>{f(type.pvp)} €</span>
                </div>
              </div>
              <div 
                style={{ 
                  position: "absolute", 
                  right: "-10px", 
                  bottom: "-10px", 
                  color: "var(--primary-color, #4f46e5)", 
                  opacity: 0.08, 
                  pointerEvents: "none"
                }}
              >
                <TipoIcon iconName={type.icon} size={64} />
              </div>
            </div>
          ))}
      </div>

      <div style={{ background: "#ffffff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)", marginTop: "-1rem" }}>
        <div className={styles.listHeaderTop} style={{ marginBottom: "0" }}>
          <div className={styles.listTitleWrapper}>
            <Icons.Facturacion size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>
              {viewMode === "cotizaciones" ? `Cotizaciones (${filteredCotizaciones.length})` : `Líneas de cotización (${filteredLines.length})`}
            </h2>
          </div>
          <div className={styles.actionsWrapper}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div className={styles.searchWrapper}>
                <Icons.Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder={viewMode === "cotizaciones" ? "Buscar cotización..." : "Buscar línea..."}
                  className={styles.searchInput}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <button
                type="button"
                className={styles.addActionButton}
                title={viewMode === "cotizaciones" ? "Vista de líneas" : "Vista de cotizaciones"}
                onClick={() => { setViewMode(viewMode === "cotizaciones" ? "lineas" : "cotizaciones"); setSelectedLineIds([]); setTipoFilter([]); setCurrentPage(1); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: "0.5rem", border: "1px solid #cbd5e1",
                  background: "#fff", color: "#475569", cursor: "pointer", transition: "all 0.15s",
                  padding: 0
                }}
              >
                {viewMode === "cotizaciones" ? <List size={15} /> : <Rows3 size={15} />}
              </button>
            </div>
            <button
              type="button"
              className={styles.addActionButton}
              title="Filtrar"
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "0.5rem", border: "1px solid #cbd5e1",
                background: showFilters ? "#cbd5e1" : "#fff", color: "#475569", cursor: "pointer", transition: "all 0.15s",
                padding: 0
              }}
            >
              <Filter size={15} />
            </button>
            <button
              type="button"
              className={styles.addActionButton}
              title={showMap ? "Ver listado" : "Ver mapa"}
              onClick={() => setShowMap(!showMap)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "0.5rem", border: "1px solid #cbd5e1",
                background: showMap ? "#cbd5e1" : "#fff", color: "#475569", cursor: "pointer", transition: "all 0.15s",
                padding: 0
              }}
            >
              <MapPin size={15} />
            </button>
            <button
              className={styles.addActionButton}
              title={viewMode === "lineas" && selectedLineIds.length > 0 ? "Crear cotización con líneas seleccionadas" : "Nueva cotización"}
              onClick={async () => {
                try {
                  const isCopy = viewMode === "lineas" && selectedLineIds.length > 0;
                  const title = isCopy ? 'Nueva Cotización (Copia)' : 'Cotización';
                  
                  const res = await fetch('/api/cotizaciones', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ titulo: title }) 
                  });
                  const j = await res.json();
                  if (j?.success && j.data?.id) {
                    const newCotId = j.data.id;
                    
                    if (isCopy) {
                      const selectedLinesData = allLines.filter((l: any) => selectedLineIds.includes(l.id));
                      await Promise.all(selectedLinesData.map((l: any) => {
                        return fetch('/api/cotizaciones/lineas', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            cotizacion_id: newCotId,
                            tipo: l.tipo,
                            descripcion: l.descripcion,
                            proveedor: l.proveedor,
                            destino: l.destino,
                            plazas: l.plazas,
                            noches: l.noches,
                            neto: l.neto,
                            pvp: l.pvp,
                            total_neto: l.total_neto,
                            total_pvp: l.total_pvp,
                            detalles: l.detalles,
                            opcional: l.opcional,
                            checked: true
                          })
                        });
                      }));
                    }
                    
                    router.push(`/cotizaciones/nueva?id=${newCotId}`);
                  } else {
                    alert('Error al crear cotización: ' + (j?.error || 'unknown'));
                  }
                } catch (err: any) {
                  alert('Error al crear cotización: ' + (err?.message || String(err)));
                }
              }}
            >
              <Icons.Add size={14} />
            </button>
          </div>
        </div>

         {showFilters && (
          <div className={styles.filterRow} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", padding: "1rem", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <div className={styles.filterGroup} style={{ width: "200px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Agente</label>
              <MultiSelectDropdown
                options={agenteOptions}
                selected={agenteFilter}
                onChange={(selected) => { setAgenteFilter(selected); setCurrentPage(1); }}
                placeholder="Agentes"
                style={{ padding: "0.3rem 0.5rem" }}
              />
            </div>
            <div className={styles.filterGroup} style={{ width: "240px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Destino</label>
              <MultiSelectDropdown
                options={destinoOptions}
                selected={destinoFilter}
                onChange={(selected) => { setDestinoFilter(selected); setCurrentPage(1); }}
                placeholder="Destinos"
                style={{ padding: "0.3rem 0.5rem" }}
              />
            </div>
            {viewMode === "lineas" && (
              <div className={styles.filterGroup} style={{ width: "200px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Tipo</label>
                <MultiSelectDropdown
                  options={tipoOptions}
                  selected={tipoFilter}
                  onChange={(selected) => { setTipoFilter(selected); setCurrentPage(1); }}
                  placeholder="Tipos de servicio"
                  style={{ padding: "0.3rem 0.5rem" }}
                />
              </div>
            )}
            <div className={styles.filterGroup} style={{ width: "160px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Fecha desde</label>
              <input
                type="date"
                className={styles.filterInput}
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); setCurrentPage(1); }}
                style={{ padding: "0.3rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "#fff", width: "100%" }}
              />
            </div>
            <div className={styles.filterGroup} style={{ width: "160px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Fecha hasta</label>
              <input
                type="date"
                className={styles.filterInput}
                value={fechaHasta}
                onChange={(e) => { setFechaHasta(e.target.value); setCurrentPage(1); }}
                style={{ padding: "0.3rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "#fff", width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setAgenteFilter([]);
                  setDestinoFilter([]);
                  setTipoFilter([]);
                  setFechaDesde("");
                  setFechaHasta("");
                  setCurrentPage(1);
                }}
                style={{ padding: "0.35rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.75rem", background: "#fff", color: "#475569", cursor: "pointer", fontWeight: 500 }}
              >
                Limpiar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Cargando cotizaciones...</div>
        ) : showMap ? (
          <div style={{ height: "600px", padding: "1rem", position: "relative" }}>
            <MapComponent
              puntos={viewMode === "cotizaciones" ? cotizacionesMapPoints : lineasMapPoints}
            />
          </div>
        ) : (
          <>
             <table className={styles.table}>
              {viewMode === "cotizaciones" ? (
                <>
                  <thead>
                    <tr>
                      <th style={{ width: 40, paddingLeft: '0.75rem' }} />
                      <th style={{ paddingLeft: "0.5rem" }}>Título</th>
                      <th style={{ width: 60, textAlign: 'center' }} title="Servicios">Serv.</th>
                      <th style={{ width: 50, textAlign: 'center' }} title="Destinos"><MapPin size={15} style={{ display: 'inline' }} /></th>
                      <th>Salida</th>
                      <th>Regreso</th>
                      <th style={{ textAlign: "right" }}>PVP Viajero</th>
                      <th style={{ textAlign: "right" }}>Plazas</th>
                      <th style={{ textAlign: "right" }}>Total Coste</th>
                      <th style={{ textAlign: "right" }}>Total Ingresos</th>
                      <th style={{ textAlign: "right" }}>Total Beneficio</th>
                      <th style={{ textAlign: "right" }}>Margen</th>
                      <th>Creada</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={15} style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>
                          No hay cotizaciones. Crea una nueva con el botón +.
                        </td>
                      </tr>
                    ) : paginated.map((c: any) => {
                      const ec = estadoColor(c.estado);
                      const isExpanded = expandedCotizacionIds.includes(c.id);
                      const lineas = c.operativa_cotizacion_lineas || [];
                      return (
                        <Fragment key={c.id}>
                          <tr
                            onClick={() => router.push(`/cotizaciones/nueva?id=${c.id}`)}
                            className={styles.clickableRow}
                            style={{ cursor: "pointer" }}
                          >
                            <td style={{ paddingLeft: '0.75rem', paddingRight: 0, width: 40 }}>
                            {c.agente?.avatar_url ? (
                              <img
                                src={c.agente.avatar_url}
                                alt={c.agente.nombre}
                                title={c.agente.nombre}
                                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '1.5px solid #e2e8f0' }}
                              />
                            ) : (
                              <div
                                title={c.agente?.nombre ?? 'Agente'}
                                style={{
                                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                                  background: 'color-mix(in srgb, var(--primary-color, #6366f1) 30%, transparent)',
                                  color: 'var(--primary-color, #4f46e5)',
                                  letterSpacing: '-0.5px',
                                }}
                              >
                                {c.agente?.iniciales ?? '?'}
                              </div>
                            )}
                          </td>
                          <td style={{ paddingLeft: "0.5rem" }} onClick={(e) => {
                            if (!c.contabilidad_entidades) {
                              e.stopPropagation();
                              setContactoModal({
                                cotizacionId: c.id,
                                currentId: null,
                                currentNombre: null,
                              });
                            }
                          }}>
                            {c.contabilidad_entidades ? (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContactoModal({
                                    cotizacionId: c.id,
                                    currentId: c.contabilidad_entidades.id,
                                    currentNombre: c.contabilidad_entidades.nombre,
                                  });
                                }}
                                style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 500, marginBottom: "2px", cursor: "pointer", display: "inline-block" }}
                                className="hover-underline"
                                title="Cambiar contacto"
                              >
                                {c.contabilidad_entidades.nombre}
                              </div>
                            ) : (
                              <div 
                                style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 400, marginBottom: "2px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                title="Asignar contacto"
                              >
                                <UserRound size={10} /> Sin contacto
                              </div>
                            )}
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                              {c.titulo || "Cotización"}
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span 
                              style={{ 
                                display: "inline-block", 
                                padding: "2px 7px", 
                                background: "#f1f5f9", 
                                color: "#475569", 
                                borderRadius: "12px", 
                                fontSize: "0.72rem", 
                                fontWeight: 600 
                              }}
                            >
                              {lineas.length}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                            {c.destinos_unicos && c.destinos_unicos.length > 0 ? (
                              <div 
                                title={c.destinos_unicos.join(", ")}
                                style={{ 
                                  display: "inline-flex", 
                                  alignItems: "center", 
                                  gap: "3px", 
                                  color: "var(--primary-color, #4f46e5)", 
                                  background: "color-mix(in srgb, var(--primary-color, #6366f1) 12%, transparent)",
                                  padding: "2px 7px",
                                  borderRadius: "12px",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "help"
                                }}
                              >
                                <MapPin size={11} />
                                {c.destinos_unicos.length}
                              </div>
                            ) : (
                              <span style={{ color: "#cbd5e1" }}>—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: "0.75rem", color: "#475569", whiteSpace: "nowrap" }}>
                              {formatDate(c.fecha_salida)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.75rem", color: "#475569", whiteSpace: "nowrap" }}>
                              {formatDate(c.fecha_regreso)}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "0.8rem", color: "#1e293b" }}>{f(c.pvp_viajero)} €</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "0.8rem", color: "#1e293b" }}>{Number(c.plazas || 0)}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "0.8rem", color: "#dc2626" }}>{f(c.total_coste)} €</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "0.8rem", color: "#15803d", fontWeight: 600 }}>{f(c.total_ingresos)} €</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span style={{
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              color: Number(c.total_beneficio || 0) >= 0 ? "#15803d" : "#dc2626"
                            }}>
                              {f(c.total_beneficio)} €
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                              {Number(c.margen_beneficio || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                              {formatDate(c.created_at)}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              display: "inline-block",
                              padding: "0.2rem 0.6rem",
                              borderRadius: "0.5rem",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              textTransform: "capitalize",
                              backgroundColor: ec.bg,
                              color: ec.color
                            }}>
                              {c.estado || "borrador"}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                title={isExpanded ? "Contraer" : "Desplegar"}
                                onClick={() => toggleExpandCotizacion(c.id)}
                                style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "0.25rem 0.4rem", cursor: "pointer", color: "#64748b", display: "inline-flex", alignItems: "center" }}
                              >
                                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                              <button
                                title="Duplicar cotización"
                                disabled={duplicating === c.id}
                                onClick={(e) => handleDuplicate(e, c.id)}
                                style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "0.25rem 0.4rem", cursor: "pointer", color: "#64748b", display: "inline-flex", alignItems: "center", opacity: duplicating === c.id ? 0.5 : 1 }}
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                title="Eliminar cotización"
                                disabled={deleting === c.id}
                                onClick={(e) => handleDelete(e, c.id, c.titulo)}
                                style={{ border: "1px solid #fecaca", background: "#fff", borderRadius: 6, padding: "0.25rem 0.4rem", cursor: "pointer", color: "#dc2626", display: "inline-flex", alignItems: "center", opacity: deleting === c.id ? 0.5 : 1 }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ background: '#f8fafc' }} onClick={(e) => e.stopPropagation()}>
                              <td colSpan={15} style={{ padding: '0.75rem 1rem 1rem 3rem' }}>
                                <div style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '1rem' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: '0.5rem' }}>
                                    Líneas de Servicio ({lineas.length})
                                  </div>
                                  {lineas.length === 0 ? (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                      No hay líneas en esta cotización.
                                    </div>
                                  ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                                          <th style={{ padding: '4px 8px', fontWeight: 600, width: '32px' }}>Tipo</th>
                                          <th style={{ padding: '4px 8px', fontWeight: 600 }}>Descripción / Proveedor</th>
                                          <th style={{ padding: '4px 8px', fontWeight: 600, width: '350px' }}>Destino</th>
                                          <th style={{ padding: '4px 8px', fontWeight: 600, width: '60px', textAlign: 'right' }}>Plazas</th>
                                          <th style={{ padding: '4px 8px', fontWeight: 600, width: '60px', textAlign: 'right' }}>Noches</th>
                                          <th style={{ padding: '4px 8px', fontWeight: 600, width: '110px', textAlign: 'right' }}>Neto / PVP</th>
                                          <th style={{ padding: '4px 8px', fontWeight: 600, width: '110px', textAlign: 'right' }}>Tot. Neto / PVP</th>
                                          <th style={{ padding: '4px 8px', fontWeight: 600, width: '80px', textAlign: 'center' }}>Estado</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lineas.map((l: any) => {
                                          const provName = l.contabilidad_proveedores 
                                            ? (l.contabilidad_proveedores.nombre || l.contabilidad_proveedores.razon_social)
                                            : "—";
                                          const destName = l.maestro_destinos 
                                            ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre)
                                            : "—";
                                          return (
                                            <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '6px 8px' }}>
                                                <div title={l.config_tipos_servicios?.etiqueta || 'Tipo'} style={{ display: 'flex', alignItems: 'center' }}>
                                                  <TipoIcon iconName={l.config_tipos_servicios?.icono || 'compass'} size={13} />
                                                </div>
                                              </td>
                                              <td style={{ padding: '6px 8px' }}>
                                                <div style={{ fontWeight: 600, color: '#334155' }}>{l.descripcion || '—'}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{provName}</div>
                                              </td>
                                              <td style={{ padding: '6px 8px', color: '#475569' }}>
                                                {destName}
                                              </td>
                                              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>
                                                {l.plazas || '—'}
                                              </td>
                                              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>
                                                {l.noches || '—'}
                                              </td>
                                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                  {f(l.neto)}
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                  {f(l.pvp)}
                                                </div>
                                              </td>
                                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                  {f(l.total_neto)}
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                  {f(l.total_pvp)}
                                                </div>
                                              </td>
                                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                                <span style={{ 
                                                  display: "inline-block", 
                                                  padding: "0.1rem 0.35rem", 
                                                  borderRadius: "0.25rem", 
                                                  fontSize: "0.62rem",
                                                  fontWeight: 600,
                                                  background: l.opcional ? "#fef3c7" : "#dcfce7",
                                                  color: l.opcional ? "#d97706" : "#16a34a"
                                                }}>
                                                  {l.opcional ? "Extra" : "Incluido"}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th style={{ width: "24px", padding: "0.25rem" }} />
                      <th style={{ width: "32px", paddingLeft: "0.1rem" }}>
                        <input 
                          type="checkbox" 
                          checked={selectedLineIds.length > 0 && selectedLineIds.length === allLines.length}
                          ref={el => {
                            if (el) {
                              el.indeterminate = selectedLineIds.length > 0 && selectedLineIds.length < allLines.length;
                            }
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLineIds(allLines.map((l: any) => l.id));
                            } else {
                              setSelectedLineIds([]);
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        />
                      </th>
                      <th style={{ width: "36px", paddingLeft: "0.1rem" }}>Tipo</th>
                      <th style={{ width: "450px" }}>Descripción / Proveedor</th>
                      <th style={{ width: "140px" }}>Destino</th>
                      <th style={{ width: "70px", textAlign: "right" }}>Plazas</th>
                      <th style={{ width: "70px", textAlign: "right" }}>Noches</th>
                      <th style={{ width: "110px", textAlign: "right" }}>Neto / PVP</th>
                      <th style={{ width: "110px", textAlign: "right" }}>Tot. Neto / PVP</th>
                      <th style={{ width: "95px", textAlign: "center" }}>Estado</th>
                      <th style={{ width: "200px" }}>Cotización / Agente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>
                          No hay líneas de cotización.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((l: any) => {
                        const isSelected = selectedLineIds.includes(l.id);
                        const provName = l.contabilidad_proveedores 
                          ? (l.contabilidad_proveedores.nombre || l.contabilidad_proveedores.razon_social)
                          : "—";

                        const destName = l.maestro_destinos 
                          ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre)
                          : "—";

                        const truncatedDesc = l.descripcion 
                          ? (l.descripcion.length > 75 ? l.descripcion.substring(0, 75) + "…" : l.descripcion)
                          : "—";

                        const truncatedDest = destName.length > 25 ? destName.substring(0, 25) + "…" : destName;

                        return (
                          <tr
                            key={l.id}
                            onClick={() => router.push(`/cotizaciones/nueva?id=${l.cotizacionId}`)}
                            className={styles.clickableRow}
                          >
                            <td style={{ width: "24px", padding: "0.25rem" }} />
                            <td style={{ width: "32px", paddingLeft: "0.1rem" }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedLineIds(selectedLineIds.filter(id => id !== l.id));
                                  } else {
                                    setSelectedLineIds([...selectedLineIds, l.id]);
                                  }
                                }}
                                style={{ cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ width: "36px", paddingLeft: "0.1rem" }}>
                              <div title={l.config_tipos_servicios?.etiqueta || 'Tipo'} style={{ display: 'flex', alignItems: 'center' }}>
                                <TipoIcon iconName={l.config_tipos_servicios?.icono || 'compass'} size={15} />
                              </div>
                            </td>
                            <td style={{ width: "450px" }}>
                              <div 
                                style={{ fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "440px" }}
                                title={l.descripcion || ""}
                              >
                                {truncatedDesc}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                                {provName}
                              </div>
                            </td>
                            <td style={{ width: "140px" }}>
                              <div 
                                style={{ fontSize: "0.8rem", color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "130px" }}
                                title={destName}
                              >
                                {truncatedDest}
                              </div>
                            </td>
                            <td style={{ width: "70px", textAlign: "right", color: "#334155", fontWeight: 500 }}>
                              {l.plazas || "—"}
                            </td>
                            <td style={{ width: "70px", textAlign: "right", color: "#334155", fontWeight: 500 }}>
                              {l.noches || "—"}
                            </td>
                            <td style={{ width: "110px", textAlign: "right" }}>
                              <div style={{ fontSize: "0.82rem", color: "#334155", fontWeight: 500, whiteSpace: "nowrap" }}>
                                {f(l.neto)}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px", whiteSpace: "nowrap" }}>
                                {f(l.pvp)}
                              </div>
                            </td>
                            <td style={{ width: "110px", textAlign: "right" }}>
                              <div style={{ fontSize: "0.82rem", color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap" }}>
                                {f(l.total_neto)}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px", whiteSpace: "nowrap" }}>
                                {f(l.total_pvp)}
                              </div>
                            </td>
                            <td style={{ width: "95px", textAlign: "center" }}>
                              <span style={{ 
                                display: "inline-block", 
                                padding: "0.15rem 0.45rem", 
                                borderRadius: "0.25rem", 
                                fontSize: "0.68rem",
                                fontWeight: 600,
                                background: l.opcional ? "#fef3c7" : "#dcfce7",
                                color: l.opcional ? "#d97706" : "#16a34a"
                              }}>
                                {l.opcional ? "Extra" : "Incluido"}
                              </span>
                            </td>
                            <td style={{ width: "200px" }}>
                              <div 
                                style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "190px" }}
                                title={l.cotizacionTitulo}
                              >
                                {l.cotizacionTitulo}
                              </div>
                              <div 
                                style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "190px" }}
                                title={l.agente?.nombre ?? "Agente"}
                              >
                                {l.agente?.nombre ?? "—"}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </>
              )}
             </table>
             <Pagination
               currentPage={currentPage}
               totalItems={totalItems}
               itemsPerPage={itemsPerPage}
               onPageChange={setCurrentPage}
               onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
             />
          </>
        )}
      </div>
    </div>
  );
}
