"use client";

import listStyles from "../expedientes/page.module.css";
import styles from "../expedientes/[id]/page.module.css";
import { Icons } from "@/lib/icons";
import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, UserRound, X, Search, MapPin, SlidersHorizontal, ChevronRight, ChevronDown, Compass, DatabaseZap, Link2 } from "lucide-react";
import { PresupuestoDetalleDrawer } from "@/components/modals/PresupuestoDetalleDrawer";
import Pagination from "@/app/components/Pagination";
import { duplicateCotizacion, deleteCotizacion, updateCotizacionLinea, tieneCotizacionPropuestasVinculadas } from "@/actions/cotizaciones";
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
  const [agruparPor, setAgruparPor] = useState<"cotizacion" | "tipo" | "desagrupar">("cotizacion");
  const viewMode: "cotizaciones" | "lineas" = agruparPor === "cotizacion" ? "cotizaciones" : "lineas";
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [duplicarModal, setDuplicarModal] = useState<string | null>(null);
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
  const [collapsedTipoGroups, setCollapsedTipoGroups] = useState<Set<string>>(new Set());
  const [allServiceTypes, setAllServiceTypes] = useState<any[]>([]);
  const [showMigracion, setShowMigracion] = useState(false);
  const [migracionPreview, setMigracionPreview] = useState<any[]>([]);
  const [migracionLoading, setMigracionLoading] = useState(false);
  const [migracionResult, setMigracionResult] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [migracionSearch, setMigracionSearch] = useState("");
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState<string | null>(null);

  const toggleExpandCotizacion = (id: string) => {
    if (expandedCotizacionIds.includes(id)) {
      setExpandedCotizacionIds(expandedCotizacionIds.filter(x => x !== id));
    } else {
      setExpandedCotizacionIds([...expandedCotizacionIds, id]);
    }
  };

  const toggleTipoGroup = (key: string) => setCollapsedTipoGroups((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

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

  const gruposPorTipo = useMemo(() => {
    if (agruparPor !== "tipo") return null;
    const map = new Map<string, { key: string; label: string; icono: string; items: any[] }>();
    for (const l of filteredLines) {
      const key = l.config_tipos_servicios?.etiqueta || "__sin_tipo__";
      const label = l.config_tipos_servicios?.etiqueta || "Sin tipo";
      const icono = l.config_tipos_servicios?.icono || "compass";
      const grupo = map.get(key) || { key, label, icono, items: [] as any[] };
      grupo.items.push(l);
      map.set(key, grupo);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [agruparPor, filteredLines]);

  useEffect(() => {
    if (agruparPor === "tipo" && gruposPorTipo) {
      setCollapsedTipoGroups(new Set(gruposPorTipo.map((g) => g.key)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agruparPor]);

  const filteredMigracionPreview = useMemo(() => {
    if (!migracionSearch.trim()) return migracionPreview;
    const query = migracionSearch.toLowerCase();
    return migracionPreview.filter((c: any) =>
      (c.titulo ?? "").toLowerCase().includes(query) ||
      (c.agente_nombre ?? "").toLowerCase().includes(query) ||
      (c.entidad_nombre ?? "").toLowerCase().includes(query)
    );
  }, [migracionPreview, migracionSearch]);

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

  const renderLineaRow = (l: any) => {
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
        <td style={{ width: "22px", paddingLeft: "0.1rem", position: "relative" }}>
          <div title={l.config_tipos_servicios?.etiqueta || 'Tipo'} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <TipoIcon iconName={l.config_tipos_servicios?.icono || 'compass'} size={15} />
            {l.opcional && (
              <span
                title="Opcional"
                style={{
                  position: 'absolute', top: -6, left: 10, fontSize: '0.5rem', fontWeight: 700,
                  color: '#d97706', background: '#fef3c7', borderRadius: '0.2rem', padding: '0 2px', lineHeight: '1.1'
                }}
              >
                Op.
              </span>
            )}
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
            background: l.confirmado ? "#dcfce7" : "#fffbeb",
            color: l.confirmado ? "#16a34a" : "#d97706"
          }}>
            {l.confirmado ? "Confirmada" : "Pendiente"}
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
  };

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
    const check = await tieneCotizacionPropuestasVinculadas(id);
    if (check.tienePropuestas) {
      setDuplicarModal(id);
      return;
    }
    setDuplicating(id);
    try {
      const result = await duplicateCotizacion(id, false);
      if (result.success) {
        loadCotizaciones();
      } else {
        alert("Error al duplicar: " + result.error);
      }
    } finally {
      setDuplicating(null);
    }
  };

  const confirmarDuplicar = async (vincular: boolean) => {
    if (!duplicarModal) return;
    const id = duplicarModal;
    setDuplicarModal(null);
    setDuplicating(id);
    try {
      const result = await duplicateCotizacion(id, vincular);
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
      {/* Modal importar desde CSV legacy */}
      {showMigracion && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.45)" }} onClick={() => { setShowMigracion(false); setCsvFile(null); setMigracionPreview([]); setMigracionResult(null); setMigracionSearch(""); }}>
          <div style={{ background: "#fff", borderRadius: "1rem", width: 720, maxWidth: "95vw", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DatabaseZap size={16} style={{ color: "#6366f1" }} />
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Importar cotizaciones desde CSV</span>
              </div>
              <button onClick={() => { setShowMigracion(false); setCsvFile(null); setMigracionPreview([]); setMigracionResult(null); setMigracionSearch(""); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={16} /></button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>
              {migracionResult ? (
                /* ── Resultado final ── */
                <div>
                  <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "0.5rem", background: migracionResult.errores > 0 ? "#fef9c3" : "#dcfce7", color: migracionResult.errores > 0 ? "#854d0e" : "#16a34a", fontWeight: 600, fontSize: "0.85rem" }}>
                    ✓ Importación completada: <strong>{migracionResult.importadas}</strong> cotizaciones importadas
                    {migracionResult.errores > 0 && <>, <strong style={{ color: "#dc2626" }}>{migracionResult.errores} errores</strong></>}.
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                    <thead><tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#64748b", fontWeight: 600 }}>Título</th>
                      <th style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#64748b", fontWeight: 600 }}>Servicios</th>
                      <th style={{ padding: "0.4rem 0.6rem", textAlign: "right", color: "#64748b", fontWeight: 600 }}>Resultado</th>
                    </tr></thead>
                    <tbody>
                      {(migracionResult.data ?? []).map((r: any) => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "0.4rem 0.6rem", color: "#1e293b" }}>{r.titulo ?? "—"}</td>
                          <td style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#475569" }}>{r.lineas ?? "—"}</td>
                          <td style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>
                            {r.ok ? <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ OK</span> : <span style={{ color: "#dc2626", fontWeight: 600 }}>✗ {r.error}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : migracionLoading ? (
                /* ── Cargando ── */
                <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                  <div style={{ marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 600 }}>Procesando CSV…</div>
                  <div style={{ fontSize: "0.78rem" }}>Esto puede tardar unos segundos.</div>
                </div>
              ) : migracionPreview.length > 0 ? (
                /* ── Preview ── */
                <>
                  {/* Buscador */}
                  <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      placeholder="Buscar por título, agente o entidad..."
                      value={migracionSearch}
                      onChange={(e) => setMigracionSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                      <strong style={{ color: "#1e293b" }}>
                        {Array.from(selectedImportIds).filter(id => filteredMigracionPreview.some(fp => fp.id === id)).length}
                      </strong> de <strong style={{ color: "#1e293b" }}>{filteredMigracionPreview.length}</strong> seleccionadas
                      {csvFile && <span style={{ color: "#94a3b8" }}> · {csvFile.name}</span>}
                    </p>
                    <button
                      onClick={() => {
                        const allVisibleIds = filteredMigracionPreview.map((c: any) => c.id);
                        const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedImportIds.has(id));
                        const next = new Set(selectedImportIds);
                        if (allVisibleSelected) {
                          allVisibleIds.forEach(id => next.delete(id));
                        } else {
                          allVisibleIds.forEach(id => next.add(id));
                        }
                        setSelectedImportIds(next);
                      }}
                      style={{ fontSize: "0.75rem", color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      {filteredMigracionPreview.length > 0 && filteredMigracionPreview.map((c: any) => c.id).every(id => selectedImportIds.has(id))
                        ? "Deseleccionar visibles"
                        : "Seleccionar visibles"}
                    </button>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                    <thead><tr style={{ borderBottom: "2px solid #f1f5f9", background: "#f8fafc" }}>
                      <th style={{ padding: "0.4rem 0.5rem", width: 32 }}>
                        <input
                          type="checkbox"
                          checked={filteredMigracionPreview.length > 0 && filteredMigracionPreview.map((c: any) => c.id).every(id => selectedImportIds.has(id))}
                          onChange={(e) => {
                            const next = new Set(selectedImportIds);
                            const allVisibleIds = filteredMigracionPreview.map((c: any) => c.id);
                            if (e.target.checked) {
                              allVisibleIds.forEach(id => next.add(id));
                            } else {
                              allVisibleIds.forEach(id => next.delete(id));
                            }
                            setSelectedImportIds(next);
                          }}
                          style={{ cursor: "pointer", accentColor: "#6366f1" }}
                        />
                      </th>
                      <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#64748b", fontWeight: 600 }}>Título</th>
                      <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#64748b", fontWeight: 600 }}>Agente</th>
                      <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#64748b", fontWeight: 600 }}>Estado</th>
                      <th style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#64748b", fontWeight: 600 }}>Servicios</th>
                      <th style={{ padding: "0.4rem 0.6rem", textAlign: "right", color: "#64748b", fontWeight: 600 }}>Total</th>
                    </tr></thead>
                    <tbody>
                      {filteredMigracionPreview.map((c: any) => {
                        const isSelected = selectedImportIds.has(c.id);
                        return (
                          <tr
                            key={c.id}
                            style={{ borderBottom: "1px solid #f8fafc", background: isSelected ? "#fafafa" : "#fff", cursor: "pointer" }}
                            onClick={() => {
                              const next = new Set(selectedImportIds);
                              if (isSelected) next.delete(c.id); else next.add(c.id);
                              setSelectedImportIds(next);
                            }}
                          >
                            <td style={{ padding: "0.4rem 0.5rem" }} onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const next = new Set(selectedImportIds);
                                  if (e.target.checked) next.add(c.id); else next.delete(c.id);
                                  setSelectedImportIds(next);
                                }}
                                style={{ cursor: "pointer", accentColor: "#6366f1" }}
                              />
                            </td>
                            <td style={{ padding: "0.4rem 0.6rem", maxWidth: 220 }}>
                              <div style={{ fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.titulo || "Sin título"}>
                                {c.titulo ?? "Sin título"}
                              </div>
                              {c.entidad_nombre ? (
                                <div style={{ fontSize: "0.68rem", color: "#16a34a", fontWeight: 500, marginTop: "2px" }} title="Contacto asociado automáticamente">
                                  ✓ {c.entidad_nombre}
                                </div>
                              ) : (
                                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "2px" }}>
                                  Sin contacto
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "0.4rem 0.6rem" }}>
                              <div
                                title={c.agente_nombre ?? 'Agente'}
                                style={{
                                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                                  background: 'color-mix(in srgb, var(--primary-color, #6366f1) 25%, transparent)',
                                  color: 'var(--primary-color, #4f46e5)',
                                }}
                              >
                                {c.agente_nombre
                                  ? c.agente_nombre.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                                  : "?"
                                }
                              </div>
                            </td>
                            <td style={{ padding: "0.4rem 0.6rem" }}>
                              <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "0.15rem 0.45rem", borderRadius: "0.3rem", background: c.estado === "aceptada" ? "#dcfce7" : c.estado === "rechazada" ? "#fee2e2" : "#f1f5f9", color: c.estado === "aceptada" ? "#16a34a" : c.estado === "rechazada" ? "#dc2626" : "#64748b" }}>{c.estado ?? "—"}</span>
                            </td>
                            <td style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#475569" }}>{c.lineas_count}</td>
                            <td style={{ padding: "0.4rem 0.6rem", textAlign: "right", color: "#0f172a", fontWeight: 600 }}>
                              {c.total ? `${Number(c.total).toLocaleString("es-ES", { maximumFractionDigits: 0 })} €` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                /* ── Paso 1: Seleccionar fichero ── */
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", padding: "2rem 1rem" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <DatabaseZap size={24} style={{ color: "#6366f1" }} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", marginBottom: "0.35rem" }}>Selecciona el fichero CSV exportado</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", maxWidth: 420 }}>Exporta la tabla <code style={{ background: "#f1f5f9", padding: "0.1rem 0.3rem", borderRadius: 4 }}>cotizaciones</code> desde Supabase como CSV y selecciónalo aquí. Solo se importarán las versiones actuales (<code style={{ background: "#f1f5f9", padding: "0.1rem 0.3rem", borderRadius: 4 }}>es_version_actual = true</code>).</div>
                  </div>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setCsvFile(file);
                      setMigracionLoading(true);
                      try {
                        const fd = new FormData();
                        fd.append("csv", file);
                        fd.append("modo", "preview");
                        const r = await fetch("/api/migracion/cotizaciones-csv", { method: "POST", body: fd });
                        const j = await r.json();
                        if (j.success) {
                          setMigracionPreview(j.data ?? []);
                          setSelectedImportIds(new Set((j.data ?? []).map((c: any) => c.id)));
                        }
                        else { alert("Error procesando CSV: " + j.error); }
                      } finally {
                        setMigracionLoading(false);
                      }
                    }}
                  />
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    style={{ padding: "0.6rem 1.5rem", borderRadius: "0.6rem", border: "2px dashed #c7d2fe", background: "#f5f3ff", color: "#6366f1", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <DatabaseZap size={15} /> Seleccionar fichero CSV…
                  </button>
                  {csvFile && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>📄 {csvFile.name}</div>}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "0.85rem 1.25rem", borderTop: "1px solid #f1f5f9" }}>
              <div>
                {migracionPreview.length > 0 && !migracionResult && (
                  <button
                    onClick={() => { setCsvFile(null); setMigracionPreview([]); setSelectedImportIds(new Set()); if (csvInputRef.current) csvInputRef.current.value = ""; }}
                    style={{ padding: "0.4rem 0.85rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}
                  >
                    ← Cambiar fichero
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {migracionResult ? (
                  <button
                    onClick={() => { setShowMigracion(false); setCsvFile(null); setMigracionPreview([]); setMigracionResult(null); setMigracionSearch(""); loadCotizaciones(); }}
                    style={{ padding: "0.45rem 1.1rem", borderRadius: "0.5rem", border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
                  >
                    Cerrar y recargar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setShowMigracion(false); setCsvFile(null); setMigracionPreview([]); setMigracionResult(null); setMigracionSearch(""); }}
                      style={{ padding: "0.45rem 1rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                    {migracionPreview.length > 0 && (
                      <button
                        disabled={migracionLoading || selectedImportIds.size === 0}
                        onClick={async () => {
                          if (!csvFile) return;
                          setMigracionLoading(true);
                          try {
                            const fd = new FormData();
                            fd.append("csv", csvFile);
                            fd.append("modo", "import");
                            fd.append("selectedIds", JSON.stringify(Array.from(selectedImportIds)));
                            const r = await fetch("/api/migracion/cotizaciones-csv", { method: "POST", body: fd });
                            const j = await r.json();
                            setMigracionResult(j);
                          } finally {
                            setMigracionLoading(false);
                          }
                        }}
                        style={{ padding: "0.45rem 1.1rem", borderRadius: "0.5rem", border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: (migracionLoading || selectedImportIds.size === 0) ? "not-allowed" : "pointer", opacity: (migracionLoading || selectedImportIds.size === 0) ? 0.6 : 1 }}
                      >
                        {migracionLoading ? "Importando…" : `Importar ${selectedImportIds.size} cotizaciones`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {contactoModal && (
        <ModalBuscarContacto
          modal={contactoModal}
          onClose={() => setContactoModal(null)}
          onSelect={handleSelectContacto}
        />
      )}

      {duplicarModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.35)" }} onClick={() => setDuplicarModal(null)}>
          <div style={{ background: "#fff", borderRadius: "0.75rem", width: 420, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem 0.75rem", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Duplicar cotización</span>
              <button onClick={() => setDuplicarModal(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "1rem 1.25rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#475569", margin: 0 }}>
                Esta cotización tiene propuestas vinculadas. ¿Deseas duplicarlas también y mantener el vínculo en las copias?
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0.75rem 1.25rem 1rem" }}>
              <button onClick={() => setDuplicarModal(null)} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "0.4rem 0.85rem", cursor: "pointer", color: "#475569", fontSize: "0.8rem", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => confirmarDuplicar(false)} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "0.4rem 0.85rem", cursor: "pointer", color: "#475569", fontSize: "0.8rem", fontWeight: 600 }}>Solo cotización</button>
              <button onClick={() => confirmarDuplicar(true)} style={{ border: "none", background: "#1e293b", borderRadius: 6, padding: "0.4rem 0.85rem", cursor: "pointer", color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>Duplicar ambas</button>
            </div>
          </div>
        </div>
      )}
      <header className={listStyles.header} style={{ marginBottom: "0px" }}>
        <div className={listStyles.headerRow}>
          <h1 className={listStyles.title}>Cotizaciones</h1>
        </div>
      </header>

      {(() => {
        const items = kpisServicios.types;
        const total = items.length;
        if (total === 0) return null;

        const renderCard = (type: any) => (
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
        );

        if (total <= 6) {
          return (
            <div 
              style={{ 
                display: "grid", 
                gridTemplateColumns: `repeat(${total}, 1fr)`,
                gap: "1rem", 
                marginBottom: "1.25rem",
                width: "100%",
                boxSizing: "border-box"
              }}
            >
              {items.map(renderCard)}
            </div>
          );
        } else {
          const topCount = Math.ceil(total / 2);
          const topRowItems = items.slice(0, topCount);
          const bottomRowItems = items.slice(topCount);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem", width: "100%" }}>
              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: `repeat(${topCount}, 1fr)`,
                  gap: "1rem",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              >
                {topRowItems.map(renderCard)}
              </div>
              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: `repeat(${topCount}, 1fr)`,
                  gap: "1rem",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              >
                {bottomRowItems.map(renderCard)}
                {bottomRowItems.length < topCount && (
                  Array.from({ length: topCount - bottomRowItems.length }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ visibility: "hidden" }} />
                  ))
                )}
              </div>
            </div>
          );
        }
      })()}

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
                title="Importar cotizaciones desde CSV"
                onClick={() => {
                  setShowMigracion(true);
                  setCsvFile(null);
                  setMigracionPreview([]);
                  setMigracionResult(null);
                  setMigracionLoading(false);
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "0.5rem", border: "1px solid #cbd5e1", background: "#fff", color: "#6366f1", cursor: "pointer", padding: 0 }}
              >
                <DatabaseZap size={15} />
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
              <SlidersHorizontal size={15} />
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
            <div className={styles.filterGroup} style={{ width: "180px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Agrupar por</label>
              <select
                value={agruparPor}
                onChange={(e) => {
                  setAgruparPor(e.target.value as "cotizacion" | "tipo" | "desagrupar");
                  setSelectedLineIds([]);
                  if (e.target.value !== "tipo") setTipoFilter([]);
                  setCurrentPage(1);
                }}
                style={{ padding: "0.3rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "#fff", width: "100%" }}
              >
                <option value="cotizacion">Cotización</option>
                <option value="tipo">Tipo</option>
                <option value="desagrupar">Desagrupar</option>
              </select>
            </div>
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
            {agruparPor === "tipo" && (
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
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                              {c.titulo || "Cotización"}
                              {c.presupuesto_id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPresupuestoId(c.presupuesto_id);
                                  }}
                                  style={{ background: "none", border: "none", color: "var(--primary-color, #4f46e5)", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 0 }}
                                  title="Ver presupuesto vinculado"
                                >
                                  <Link2 size={13} />
                                </button>
                              )}
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
                            <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                title={isExpanded ? "Contraer" : "Desplegar"}
                                onClick={() => toggleExpandCotizacion(c.id)}
                                style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "0.2rem 0.35rem", cursor: "pointer", color: "#64748b", display: "inline-flex", alignItems: "center" }}
                              >
                                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                              <button
                                title="Duplicar cotización"
                                disabled={duplicating === c.id}
                                onClick={(e) => handleDuplicate(e, c.id)}
                                style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "0.2rem 0.35rem", cursor: "pointer", color: "#64748b", display: "inline-flex", alignItems: "center", opacity: duplicating === c.id ? 0.5 : 1 }}
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                title="Eliminar cotización"
                                disabled={deleting === c.id}
                                onClick={(e) => handleDelete(e, c.id, c.titulo)}
                                style={{ border: "1px solid #fecaca", background: "#fff", borderRadius: 6, padding: "0.2rem 0.35rem", cursor: "pointer", color: "#dc2626", display: "inline-flex", alignItems: "center", opacity: deleting === c.id ? 0.5 : 1 }}
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
                                          <th style={{ padding: '4px 8px', fontWeight: 600, width: '22px' }}>Tipo</th>
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
                                                <div title={l.config_tipos_servicios?.etiqueta || 'Tipo'} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                  <TipoIcon iconName={l.config_tipos_servicios?.icono || 'compass'} size={13} />
                                                  {l.opcional && (
                                                    <span
                                                      title="Opcional"
                                                      style={{
                                                        position: 'absolute', top: -6, left: 9, fontSize: '0.48rem', fontWeight: 700,
                                                        color: '#d97706', background: '#fef3c7', borderRadius: '0.2rem', padding: '0 2px', lineHeight: '1.1'
                                                      }}
                                                    >
                                                      Op.
                                                    </span>
                                                  )}
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
                                                  background: l.confirmado ? "#dcfce7" : "#fffbeb",
                                                  color: l.confirmado ? "#16a34a" : "#d97706"
                                                }}>
                                                  {l.confirmado ? "Confirmada" : "Pendiente"}
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
                      <th style={{ width: "22px", paddingLeft: "0.1rem" }}>Tipo</th>
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
                    ) : agruparPor === "tipo" && gruposPorTipo ? (
                      gruposPorTipo.map((grupo) => {
                        const isCollapsed = collapsedTipoGroups.has(grupo.key);
                        return (
                          <Fragment key={grupo.key}>
                            <tr
                              onClick={() => toggleTipoGroup(grupo.key)}
                              style={{ cursor: "pointer", background: "#f1f5f9" }}
                            >
                              <td colSpan={11} style={{ padding: "0.4rem 0.75rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.78rem", color: "#334155" }}>
                                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                  <TipoIcon iconName={grupo.icono} size={14} />
                                  {grupo.label}
                                  <span style={{ fontWeight: 500, color: "#94a3b8" }}>({grupo.items.length})</span>
                                </div>
                              </td>
                            </tr>
                            {!isCollapsed && grupo.items.map((l: any) => renderLineaRow(l))}
                          </Fragment>
                        );
                      })
                    ) : (
                      paginated.map((l: any) => renderLineaRow(l))
                    )}
                  </tbody>
                </>
              )}
             </table>
             {agruparPor !== "tipo" && (
               <Pagination
                 currentPage={currentPage}
                 totalItems={totalItems}
                 itemsPerPage={itemsPerPage}
                 onPageChange={setCurrentPage}
                 onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
               />
             )}
          </>
        )}
        <PresupuestoDetalleDrawer
          isOpen={!!selectedPresupuestoId}
          onClose={() => setSelectedPresupuestoId(null)}
          presupuestoId={selectedPresupuestoId || ""}
        />
      </div>
    </div>
  );
}
