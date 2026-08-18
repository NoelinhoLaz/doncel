"use client";

import listStyles from "../expedientes/page.module.css";
import styles from "../expedientes/[id]/page.module.css";
import { Icons } from "@/lib/icons";
import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Trash2, UserRound, X, Search, MapPin, SlidersHorizontal, ChevronRight, ChevronDown, Compass, Link2, ClipboardPaste, Layers } from "lucide-react";
import Pagination from "@/app/components/Pagination";
import { duplicateCotizacion, deleteCotizacion, updateCotizacionLinea, updateCotizacionMeta, tieneCotizacionPropuestasVinculadas } from "@/actions/cotizaciones";
import { getCurrentUsuario } from "@/actions/usuarios";
import TipoIcon from "@/app/components/cotizacion/TipoIcon";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import SingleSelectDropdown from "@/app/components/SingleSelectDropdown";
import dynamic from "next/dynamic";
import { computeMonthsData, computeDaysData } from "@/lib/utils/expedientesUtils";

const MapComponent = dynamic(() => import("../expedientes/MapComponent"), {
  ssr: false,
  loading: () => <div style={{ height: 600, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", background: "#f8fafc", borderRadius: 10 }}>Cargando mapa...</div>,
});

export default function CotizacionesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agruparPor, setAgruparPor] = useState<"cotizacion" | "tipo" | "proveedor" | "desagrupar">("cotizacion");
  const viewMode: "cotizaciones" | "lineas" = agruparPor === "cotizacion" ? "cotizaciones" : "lineas";
  const isGrupoLineas = agruparPor === "tipo" || agruparPor === "proveedor";
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [duplicarModal, setDuplicarModal] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; titulo: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [agenteFilterInicializado, setAgenteFilterInicializado] = useState(false);
  const [nombreAgenteActual, setNombreAgenteActual] = useState<string | null>(null);
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [currentRol, setCurrentRol] = useState<string | null>(null);
  const [destinoFilter, setDestinoFilter] = useState<string[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [estadoFilter, setEstadoFilter] = useState<string[]>([]);
  const [estadoCotizacionFilter, setEstadoCotizacionFilter] = useState<string[]>(() => {
    const estadoParam = searchParams.get("estado");
    return estadoParam ? [estadoParam] : [];
  });
  const [showMap, setShowMap] = useState(false);
  const [expandedCotizacionIds, setExpandedCotizacionIds] = useState<string[]>([]);
  const [collapsedTipoGroups, setCollapsedTipoGroups] = useState<Set<string>>(new Set());
  const [allServiceTypes, setAllServiceTypes] = useState<any[]>([]);
  const [estadoPickerRowId, setEstadoPickerRowId] = useState<string | null>(null);
  const [estadoPickerPos, setEstadoPickerPos] = useState<{ top: number; left: number } | null>(null);
  const estadoPickerRef = useRef<HTMLDivElement | null>(null);

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

  const ESTADOS_COTIZACION: { value: "borrador" | "presentada" | "aceptada" | "rechazada"; label: string }[] = [
    { value: "borrador", label: "Borrador" },
    { value: "presentada", label: "Presentada" },
    { value: "aceptada", label: "Aceptada" },
    { value: "rechazada", label: "Rechazada" },
  ];

  useEffect(() => {
    if (!estadoPickerRowId) return;
    function onDocClick(e: MouseEvent) {
      if (estadoPickerRef.current && estadoPickerRef.current.contains(e.target as Node)) return;
      setEstadoPickerRowId(null);
      setEstadoPickerPos(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [estadoPickerRowId]);

  const handleEstadoChange = async (cotizacionId: string, estado: "borrador" | "presentada" | "aceptada" | "rechazada") => {
    setEstadoPickerRowId(null);
    setEstadoPickerPos(null);
    setCotizaciones(prev => prev.map(c => c.id === cotizacionId ? { ...c, estado } : c));
    try {
      await updateCotizacionMeta(cotizacionId, { estado });
    } catch (err) {
      console.error(err);
      loadCotizaciones();
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
    getCurrentUsuario()
      .then((u: any) => {
        if (u) setNombreAgenteActual(`${u.nombre ?? ''} ${u.apellidos ?? ''}`.trim());
      })
      .catch(() => {});
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.success) {
        setCurrentAuthUserId(d.data.authUserId);
        setCurrentRol(d.data.rol);
      }
    }).catch(() => {});
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
          fecha_regreso: c.fecha_regreso,
          cotizacionContacto: c.contabilidad_entidades?.nombre || "",
          cotizacionResponsable: c.crm_contactos?.nombre || "",
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

  useEffect(() => {
    if (agenteFilterInicializado) return;
    if (!currentAuthUserId || cotizaciones.length === 0) return;
    const propias = cotizaciones.find((c: any) => c.agente_id === currentAuthUserId);
    if (propias?.agente?.nombre) {
      setAgenteFilter([propias.agente.nombre]);
    } else if (nombreAgenteActual && agenteOptions.includes(nombreAgenteActual)) {
      // Fallback por nombre para cotizaciones antiguas sin agente_id coincidente
      setAgenteFilter([nombreAgenteActual]);
    }
    setAgenteFilterInicializado(true);
  }, [currentAuthUserId, cotizaciones, nombreAgenteActual, agenteOptions, agenteFilterInicializado]);

  // Normaliza para agrupar variantes de un mismo destino (MADRID / Madrid / Paris / París...)
  const normalizeDestino = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Mapa clave normalizada -> label a mostrar (la variante más frecuente) y todas las variantes reales
  const { destinoOptions, destinoVariantesPorClave } = useMemo(() => {
    const names: string[] = [];
    if (viewMode === "cotizaciones") {
      cotizaciones.forEach((c: any) => {
        (c.destinos_unicos || []).forEach((destName: string) => {
          if (destName) names.push(destName);
        });
      });
    } else {
      cotizaciones.forEach((c: any) => {
        const lineas = c.operativa_cotizacion_lineas || [];
        lineas.forEach((l: any) => {
          const destName = l.maestro_destinos ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre) : "";
          if (destName) names.push(destName);
        });
      });
    }
    const countByVariant = new Map<string, number>();
    const variantsByKey = new Map<string, Set<string>>();
    names.forEach(n => {
      const key = normalizeDestino(n);
      countByVariant.set(n, (countByVariant.get(n) ?? 0) + 1);
      const set = variantsByKey.get(key) ?? new Set<string>();
      set.add(n);
      variantsByKey.set(key, set);
    });
    const labelByKey = new Map<string, string>();
    variantsByKey.forEach((variants, key) => {
      const best = Array.from(variants).sort((a, b) => (countByVariant.get(b)! - countByVariant.get(a)!) || a.localeCompare(b))[0];
      labelByKey.set(key, best);
    });
    const options = Array.from(labelByKey.values()).sort() as string[];
    const variantesPorClave = new Map<string, string[]>();
    variantsByKey.forEach((variants, key) => variantesPorClave.set(labelByKey.get(key)!, Array.from(variants)));
    return { destinoOptions: options, destinoVariantesPorClave: variantesPorClave };
  }, [cotizaciones, viewMode]);

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

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const cotizacionesFechaRows = useMemo(() => {
    return cotizaciones.map((c: any) => ({ fechaSalida: c.fecha_salida })) as any[];
  }, [cotizaciones]);

  const monthsData = useMemo(() => {
    return computeMonthsData(cotizacionesFechaRows);
  }, [cotizacionesFechaRows]);

  const daysData = useMemo(() => {
    return computeDaysData(selectedMonth, cotizacionesFechaRows, monthsData);
  }, [selectedMonth, cotizacionesFechaRows, monthsData]);

  const filteredCotizaciones = useMemo(() => {
    return cotizaciones.filter((c: any) => {
      if (search) {
        const q = search.toLowerCase();
        const destinoPrincipal = (c.destinos_unicos || [])[0] || "";
        const contactoNombre = c.contabilidad_entidades?.nombre || "";
        const responsableNombre = c.crm_contactos?.nombre || "";
        const proveedores = (c.operativa_cotizacion_lineas || [])
          .map((l: any) => l.contabilidad_proveedores?.nombre || "")
          .join(" ");
        const matchesSearch =
          (c.titulo || "").toLowerCase().includes(q) ||
          (c.id || "").toLowerCase().includes(q) ||
          destinoPrincipal.toLowerCase().includes(q) ||
          contactoNombre.toLowerCase().includes(q) ||
          responsableNombre.toLowerCase().includes(q) ||
          proveedores.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (agenteFilter.length > 0 && (!c.agente?.nombre || !agenteFilter.includes(c.agente.nombre))) return false;
      if (destinoFilter.length > 0) {
        const destinosCotizacion: string[] = c.destinos_unicos || [];
        if (destinosCotizacion.length === 0) return false;
        const variantesSeleccionadas = new Set(destinoFilter.flatMap(label => destinoVariantesPorClave.get(label) ?? [label]));
        if (!destinosCotizacion.some(d => variantesSeleccionadas.has(d))) return false;
      }
      if (fechaDesde && c.fecha_salida && c.fecha_salida < fechaDesde) return false;
      if (fechaHasta && c.fecha_regreso && c.fecha_regreso > fechaHasta) return false;
      if (estadoCotizacionFilter.length > 0 && !estadoCotizacionFilter.includes(c.estado || "borrador")) return false;
      return true;
    });
  }, [cotizaciones, search, agenteFilter, destinoFilter, fechaDesde, fechaHasta, destinoVariantesPorClave, estadoCotizacionFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (agenteFilter.length > 0) count++;
    if (destinoFilter.length > 0) count++;
    if (fechaDesde) count++;
    if (fechaHasta) count++;
    if (estadoCotizacionFilter.length > 0) count++;
    return count;
  }, [agenteFilter, destinoFilter, fechaDesde, fechaHasta, estadoCotizacionFilter]);

  const isAdminRol = currentRol ? ["Admin", "SuperAdmin", "Owner"].includes(currentRol) : false;
  const puedeEliminar = (c: any) => {
    if (isAdminRol) return true;
    if (!c.agente_id) return true;
    return c.agente_id === currentAuthUserId;
  };

  const filteredLines = useMemo(() => {
    return allLines.filter((l: any) => {
      if (search) {
        const q = search.toLowerCase();
        const destName = l.maestro_destinos ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre) : "";
        const provName = l.contabilidad_proveedores ? (l.contabilidad_proveedores.nombre || l.contabilidad_proveedores.razon_social) : "";
        const matchesSearch = (l.descripcion || "").toLowerCase().includes(q) ||
          (l.cotizacionTitulo || "").toLowerCase().includes(q) ||
          destName.toLowerCase().includes(q) ||
          provName.toLowerCase().includes(q) ||
          (l.cotizacionContacto || "").toLowerCase().includes(q) ||
          (l.cotizacionResponsable || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (agenteFilter.length > 0 && (!l.agente?.nombre || !agenteFilter.includes(l.agente.nombre))) return false;
      if (destinoFilter.length > 0) {
        const destName = l.maestro_destinos ? (l.maestro_destinos.nombre_comercial || l.maestro_destinos.nombre) : "";
        const variantesSeleccionadas = new Set(destinoFilter.flatMap(label => destinoVariantesPorClave.get(label) ?? [label]));
        if (!variantesSeleccionadas.has(destName)) return false;
      }
      if (fechaDesde && l.fecha_salida && l.fecha_salida < fechaDesde) return false;
      if (fechaHasta && l.fecha_regreso && l.fecha_regreso > fechaHasta) return false;
      if (tipoFilter.length > 0 && (!l.config_tipos_servicios?.etiqueta || !tipoFilter.includes(l.config_tipos_servicios.etiqueta))) return false;
      if (agruparPor === "desagrupar" && estadoFilter.length > 0) {
        const estadoServicio = l.confirmado ? "Confirmado" : "Pendiente";
        if (!estadoFilter.includes(estadoServicio)) return false;
      }
      return true;
    });
  }, [allLines, search, agenteFilter, destinoFilter, fechaDesde, fechaHasta, tipoFilter, estadoFilter, agruparPor, destinoVariantesPorClave]);

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
    if (agruparPor !== "tipo" && agruparPor !== "proveedor") return null;
    const map = new Map<string, { key: string; label: string; icono: string | null; items: any[] }>();
    for (const l of filteredLines) {
      let key: string, label: string, icono: string | null;
      if (agruparPor === "proveedor") {
        const provName = l.contabilidad_proveedores ? (l.contabilidad_proveedores.nombre || l.contabilidad_proveedores.razon_social) : null;
        key = provName || "__sin_proveedor__";
        label = provName || "Sin proveedor";
        icono = null;
      } else {
        key = l.config_tipos_servicios?.etiqueta || "__sin_tipo__";
        label = l.config_tipos_servicios?.etiqueta || "Sin tipo";
        icono = l.config_tipos_servicios?.icono || "compass";
      }
      const grupo = map.get(key) || { key, label, icono, items: [] as any[] };
      grupo.items.push(l);
      map.set(key, grupo);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [agruparPor, filteredLines]);

  useEffect(() => {
    if (isGrupoLineas && gruposPorTipo) {
      setCollapsedTipoGroups(new Set(gruposPorTipo.map((g) => g.key)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agruparPor]);

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
        <td style={{ width: "95px", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
          {l.fecha_salida ? formatDate(l.fecha_salida) : "—"}
        </td>
        <td style={{ width: "95px", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
          {l.fecha_regreso ? formatDate(l.fecha_regreso) : "—"}
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

  const handleDelete = (e: React.MouseEvent, id: string, titulo: string) => {
    e.stopPropagation();
    setDeleteModal({ id, titulo });
  };

  const confirmarDelete = async () => {
    if (!deleteModal) return;
    const { id } = deleteModal;
    setDeleteModal(null);
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
      {deleteModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.35)" }} onClick={() => setDeleteModal(null)}>
          <div style={{ background: "#fff", borderRadius: "0.75rem", width: 420, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem 0.75rem", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Eliminar cotización</span>
              <button onClick={() => setDeleteModal(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "1rem 1.25rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#475569", margin: 0 }}>
                ¿Eliminar la cotización <strong>"{deleteModal.titulo || 'Cotización'}"</strong> y todas sus líneas? Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0.75rem 1.25rem 1rem" }}>
              <button onClick={() => setDeleteModal(null)} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "0.4rem 0.85rem", cursor: "pointer", color: "#475569", fontSize: "0.8rem", fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmarDelete} style={{ border: "none", background: "#dc2626", borderRadius: 6, padding: "0.4rem 0.85rem", cursor: "pointer", color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      <header className={listStyles.header} style={{ marginBottom: "0px" }}>
        <div className={listStyles.headerRow}>
          <h1 className={listStyles.title}>Cotizaciones</h1>
        </div>
      </header>

      <div className={listStyles.topGrid} style={{ marginBottom: "1.25rem" }}>
        <div className={listStyles.statsColumn}>
          <div className={listStyles.card}>
            <div className={listStyles.cardHeaderWithAction}>
              <span className={listStyles.cardLabel}>
                {selectedMonth ? `DETALLE DIARIO: ${selectedMonth.toUpperCase()}` : "COTIZACIONES POR FECHA DE SALIDA"}
              </span>
              {selectedMonth && (
                <button className={listStyles.backButton} onClick={() => setSelectedMonth(null)} title="Volver a meses">
                  <Icons.ChevronDown size={14} style={{ transform: "rotate(90deg)" }} />
                </button>
              )}
            </div>
            <div className={listStyles.barChart}>
              {!selectedMonth ? (
                monthsData.map((item: any) => (
                  <div
                    key={item.month}
                    className={listStyles.barColumn}
                    onClick={() => setSelectedMonth(item.month)}
                    data-tooltip={`${item.month}: ${item.count} ${item.count === 1 ? "cotización" : "cotizaciones"}`}
                  >
                    <div className={listStyles.barWrapper}>
                      <div className={`${listStyles.bar} ${listStyles.clickableBar}`} style={{ height: `${item.val}%` }} />
                    </div>
                    <span className={listStyles.monthInitial}>{item.month.charAt(0)}</span>
                  </div>
                ))
              ) : (
                <div className={listStyles.daysGrid}>
                  {daysData.map((item: any) => (
                    <div
                      key={item.day}
                      className={listStyles.dayColumn}
                      data-tooltip={`Día ${item.day}: ${item.count} ${item.count === 1 ? "cotización" : "cotizaciones"}`}
                    >
                      <div className={listStyles.dayBarWrapper}>
                        <div className={listStyles.bar} style={{ height: `${item.val}%` }} />
                      </div>
                      <span className={listStyles.dayNumber}>{item.day}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={listStyles.card}>
            <span className={listStyles.cardLabel}>SERVICIOS POR TIPO</span>
            <div className={listStyles.barChart}>
              {kpisServicios.types.map((type: any) => {
                const maxCount = Math.max(...kpisServicios.types.map((t: any) => t.count), 1);
                const val = Math.round((type.count / maxCount) * 100);
                return (
                  <div key={type.label} className={listStyles.barColumn} data-tooltip={`${type.label}: ${type.count}`}>
                    <div className={listStyles.barWrapper}>
                      <div className={listStyles.bar} style={{ height: `${val}%` }} />
                    </div>
                    <div style={{ marginTop: "2px", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <TipoIcon iconName={type.icon} size={13} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={listStyles.mapCard}>
          <MapComponent puntos={cotizacionesMapPoints} />
        </div>
      </div>

      <div style={{ background: "#ffffff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)", marginTop: "-1rem" }}>
        <div className={styles.listHeaderTop} style={{ marginBottom: "0", borderTopLeftRadius: "0.75rem", borderTopRightRadius: "0.75rem" }}>
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
                  placeholder={viewMode === "cotizaciones" ? "Buscar por título, destino, cliente, responsable o proveedor..." : "Buscar línea..."}
                  className={styles.searchInput}
                  style={{ width: 380 }}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                />
              </div>
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
                padding: 0, position: "relative"
              }}
            >
              <SlidersHorizontal size={15} />
              {activeFilterCount > 0 && (
                <span
                  key={activeFilterCount}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    minWidth: "16px",
                    height: "16px",
                    padding: "0 4px",
                    borderRadius: "999px",
                    background: "var(--primary-color, #6366f1)",
                    color: "#fff",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
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
              type="button"
              className={styles.addActionButton}
              title="Importar cotización desde Excel/Sheets"
              onClick={async () => {
                try {
                  const res = await fetch('/api/cotizaciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ titulo: 'Cotización' }),
                  });
                  const j = await res.json();
                  if (j?.success && j.data?.id) {
                    router.push(`/cotizaciones/nueva?id=${j.data.id}&importar=1`);
                  } else {
                    alert('Error al crear cotización: ' + (j?.error || 'unknown'));
                  }
                } catch (err: any) {
                  alert('Error al crear cotización: ' + (err?.message || String(err)));
                }
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "0.5rem", border: "1px solid #cbd5e1",
                background: "#fff", color: "#475569", cursor: "pointer", padding: 0
              }}
            >
              <ClipboardPaste size={15} />
            </button>
            <button
              className={styles.addActionButton}
              style={{ position: "relative" }}
              title={selectedLineIds.length > 0 ? "Crear cotización con líneas seleccionadas" : "Nueva cotización"}
              onClick={async () => {
                if (!(selectedLineIds.length > 0)) {
                  try {
                    const res = await fetch('/api/cotizaciones', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ titulo: 'Cotización' })
                    });
                    const j = await res.json();
                    if (j?.success && j.data?.id) {
                      router.push(`/cotizaciones/nueva?id=${j.data.id}`);
                    } else {
                      alert('Error al crear cotización: ' + (j?.error || 'unknown'));
                    }
                  } catch (err: any) {
                    alert('Error al crear cotización: ' + (err?.message || String(err)));
                  }
                  return;
                }
                try {
                  const isCopy = selectedLineIds.length > 0;
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
                            proveedor: l.proveedor ?? l.contabilidad_proveedores?.id ?? null,
                            destino: l.destino ?? l.maestro_destinos?.id ?? null,
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

                    setSelectedLineIds([]);
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
              {selectedLineIds.length > 0 && (
                <span
                  key={selectedLineIds.length}
                  className={styles.selectedLinesBadge}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    minWidth: "16px",
                    height: "16px",
                    padding: "0 4px",
                    borderRadius: "999px",
                    background: "#e60073",
                    color: "#fff",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {selectedLineIds.length}
                </span>
              )}
            </button>
          </div>
        </div>

         {showFilters && (
          <div className={styles.filterRow} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", padding: "1rem", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <div className={styles.filterGroup} style={{ width: "180px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Agrupar por</label>
              <SingleSelectDropdown
                options={[
                  { value: "cotizacion", label: "Cotización" },
                  { value: "tipo", label: "Tipo" },
                  { value: "proveedor", label: "Proveedor" },
                  { value: "desagrupar", label: "Desagrupar" },
                ]}
                value={agruparPor}
                onChange={(v) => {
                  setAgruparPor(v as "cotizacion" | "tipo" | "proveedor" | "desagrupar");
                  if (v !== "tipo") setTipoFilter([]);
                  setCurrentPage(1);
                }}
                style={{ padding: "0.3rem 0.5rem" }}
              />
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
            {(agruparPor === "tipo" || agruparPor === "proveedor" || agruparPor === "desagrupar") && (
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
            {agruparPor === "desagrupar" && (
              <div className={styles.filterGroup} style={{ width: "200px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Estado</label>
                <MultiSelectDropdown
                  options={["Pendiente", "Confirmado"]}
                  selected={estadoFilter}
                  onChange={(selected) => { setEstadoFilter(selected); setCurrentPage(1); }}
                  placeholder="Estados"
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

        <div style={{ borderBottomLeftRadius: "0.75rem", borderBottomRightRadius: "0.75rem", overflow: "hidden" }}>
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
                      <th style={{ width: "140px" }}>Destino</th>
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
                          <td style={{ paddingLeft: "0.5rem" }}>
                            {c.contabilidad_entidades ? (
                              <div
                                style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 500, marginBottom: "2px", display: "inline-block" }}
                              >
                                {c.contabilidad_entidades.nombre}
                              </div>
                            ) : (
                              <div
                                style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 400, marginBottom: "2px", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                title="Sin contacto"
                              >
                                <UserRound size={10} /> Sin contacto
                              </div>
                            )}
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                              {c.titulo || "Cotización"}
                              {c.presupuesto_id && (
                                <span title="Tiene presupuesto vinculado" style={{ display: "inline-flex", alignItems: "center", color: "var(--primary-color, #4f46e5)" }}>
                                  <Link2 size={13} />
                                </span>
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
                          <td onClick={e => e.stopPropagation()}>
                            {c.destinos_unicos && c.destinos_unicos.length > 0 ? (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", maxWidth: "100%" }}>
                                <span style={{ fontSize: "0.78rem", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.destinos_unicos[0]}>
                                  {c.destinos_unicos[0]}
                                </span>
                                {c.destinos_unicos.length > 1 && (
                                  <span
                                    title={c.destinos_unicos.slice(1).join(", ")}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      color: "var(--primary-color, #4f46e5)",
                                      background: "color-mix(in srgb, var(--primary-color, #6366f1) 12%, transparent)",
                                      padding: "1px 6px",
                                      borderRadius: "10px",
                                      fontSize: "0.68rem",
                                      fontWeight: 600,
                                      cursor: "help",
                                      flexShrink: 0,
                                    }}
                                  >
                                    +{c.destinos_unicos.length - 1}
                                  </span>
                                )}
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
                          <td onClick={(e) => e.stopPropagation()}>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (estadoPickerRowId === c.id) { setEstadoPickerRowId(null); setEstadoPickerPos(null); return; }
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setEstadoPickerPos({ top: rect.bottom + 6, left: rect.left });
                                setEstadoPickerRowId(c.id);
                              }}
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.6rem",
                                borderRadius: "0.5rem",
                                fontSize: "0.6rem",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                backgroundColor: ec.bg,
                                color: ec.color,
                                cursor: "pointer"
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
                                title={puedeEliminar(c) ? "Eliminar cotización" : "Solo el creador o un administrador puede eliminar"}
                                disabled={deleting === c.id || !puedeEliminar(c)}
                                onClick={(e) => puedeEliminar(c) && handleDelete(e, c.id, c.titulo)}
                                style={{ border: "1px solid #fecaca", background: "#fff", borderRadius: 6, padding: "0.2rem 0.35rem", cursor: puedeEliminar(c) ? "pointer" : "not-allowed", color: puedeEliminar(c) ? "#dc2626" : "#cbd5e1", display: "inline-flex", alignItems: "center", opacity: deleting === c.id ? 0.5 : 1, borderColor: puedeEliminar(c) ? "#fecaca" : "#e2e8f0" }}
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
                                        <tr>
                                          <th style={{ width: "24px", padding: "0.25rem" }} />
                                          <th style={{ width: "32px", paddingLeft: "0.1rem" }} />
                                          <th style={{ width: "22px", paddingLeft: "0.1rem" }}>Tipo</th>
                                          <th style={{ width: "450px" }}>Descripción / Proveedor</th>
                                          <th style={{ width: "140px" }}>Destino</th>
                                          <th style={{ width: "95px" }}>Salida</th>
                                          <th style={{ width: "95px" }}>Regreso</th>
                                          <th style={{ width: "70px", textAlign: "right" }}>Plazas</th>
                                          <th style={{ width: "70px", textAlign: "right" }}>Noches</th>
                                          <th style={{ width: "110px", textAlign: "right" }}>Neto / PVP</th>
                                          <th style={{ width: "110px", textAlign: "right" }}>Tot. Neto / PVP</th>
                                          <th style={{ width: "95px", textAlign: "center" }}>Estado</th>
                                          <th style={{ width: "200px" }}>Cotización / Agente</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lineas.map((l: any) => renderLineaRow({
                                          ...l,
                                          cotizacionId: c.id,
                                          cotizacionTitulo: c.titulo || "Cotización",
                                          agente: c.agente,
                                          fecha_salida: l.fecha_salida ?? c.fecha_salida,
                                          fecha_regreso: l.fecha_regreso ?? c.fecha_regreso,
                                        }))}
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
                      <th style={{ width: "95px" }}>Salida</th>
                      <th style={{ width: "95px" }}>Regreso</th>
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
                        <td colSpan={13} style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>
                          No hay líneas de cotización.
                        </td>
                      </tr>
                    ) : isGrupoLineas && gruposPorTipo ? (
                      gruposPorTipo.map((grupo) => {
                        const isCollapsed = collapsedTipoGroups.has(grupo.key);
                        return (
                          <Fragment key={grupo.key}>
                            <tr
                              onClick={() => toggleTipoGroup(grupo.key)}
                              style={{ cursor: "pointer", background: "#f1f5f9" }}
                            >
                              <td colSpan={13} style={{ padding: "0.4rem 0.75rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.78rem", color: "#334155" }}>
                                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                  {grupo.icono && <TipoIcon iconName={grupo.icono} size={14} />}
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
             {!isGrupoLineas && (
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
        </div>
      </div>
      {estadoPickerRowId && estadoPickerPos && (
        <div
          ref={estadoPickerRef}
          style={{
            position: "fixed", top: estadoPickerPos.top, left: estadoPickerPos.left,
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
            boxShadow: "0 8px 32px rgba(15,23,42,0.14)", zIndex: 99999,
            minWidth: 150, padding: "0.3rem 0", fontSize: "0.8rem",
          }}
        >
          {ESTADOS_COTIZACION.map(opt => {
            const cot = cotizaciones.find(c => c.id === estadoPickerRowId);
            const isSelected = (cot?.estado || "borrador") === opt.value;
            const oc = estadoColor(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => handleEstadoChange(estadoPickerRowId, opt.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0.4rem 0.85rem", cursor: "pointer",
                  fontWeight: isSelected ? 600 : 400, color: "#1e293b",
                  background: isSelected ? "#f8fafc" : undefined,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? "#f8fafc" : ""; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: oc.color, flexShrink: 0 }} />
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
