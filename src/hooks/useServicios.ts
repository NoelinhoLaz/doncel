"use client";

import { useState, useEffect, useMemo } from "react";
import { FolderPlus } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { getExpedienteServicios, deleteExpedienteServicio, toggleServicioOpcional, updateExpedienteServicioImportes, updateExpedienteServicioNoches, updateExpedienteServicioDestino, updateExpedienteServicio, getCotizacionLineaIdForServicio, vincularServicioACotizacion } from "@/actions/servicios";
import { updateCotizacionLinea } from "@/actions/cotizaciones";
import { getTiposServicios } from "@/actions/tiposServicios";
import { createDestinoFromPlace } from "@/actions/destinos";
import { getMatchesPendientesPorExpediente } from "@/actions/banco";
import { calculateKpis, calculateCategoryCosts, serviceHasMatch } from "@/lib/utils/servicios";

const DEFAULT_TYPES = [
  { id: "transporte", label: "Transporte", icono: "Plane", color: "#0369a1", bg: "#e0f2fe" },
  { id: "alojamiento", label: "Alojamiento", icono: "Bed", color: "#4338ca", bg: "#e0e7ff" },
  { id: "actividad", label: "Actividad", icono: "Compass", color: "#be185d", bg: "#fce7f3" },
  { id: "otros", label: "Otros", icono: "FolderPlus", color: "#475569", bg: "#f1f5f9" },
];

const TYPE_COLORS = [
  { color: "#0369a1", bg: "#e0f2fe" },
  { color: "#4338ca", bg: "#e0e7ff" },
  { color: "#be185d", bg: "#fce7f3" },
  { color: "#16a34a", bg: "#dcfce7" },
  { color: "#7c3aed", bg: "#f3e8ff" },
  { color: "#ca8a04", bg: "#fef9c3" },
  { color: "#ea580c", bg: "#ffedd5" },
];

export function useServicios(expedienteId: string) {
  const [servicios, setServicios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [matchesPendientes, setMatchesPendientes] = useState<any[]>([]);
  const [tiposMap, setTiposMap] = useState<Record<string, any>>({});
  const [infoModalItem, setInfoModalItem] = useState<any | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isImportCotizacionOpen, setIsImportCotizacionOpen] = useState(false);
  const [isImportPdfOpen, setIsImportPdfOpen] = useState(false);
  const [isMatchBancarioOpen, setIsMatchBancarioOpen] = useState(false);
  const [isRegistrarPagoOpen, setIsRegistrarPagoOpen] = useState(false);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [editServiceData, setEditServiceData] = useState<any | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearchRaw] = useState("");
  const [expandedServicios, setExpandedServicios] = useState<Set<string>>(new Set());

  useEffect(() => {
    getTiposServicios()
      .then((types) => {
        setServiceTypes(
          types?.length
            ? types.map((t: any, i: number) => ({ id: t.id, label: t.etiqueta, icono: t.icono, ...TYPE_COLORS[i % TYPE_COLORS.length] }))
            : DEFAULT_TYPES
        );
        const map: Record<string, any> = {};
        (types || []).forEach((t: any) => { map[t.id] = t; });
        setTiposMap(map);
      })
      .catch(() => setServiceTypes(DEFAULT_TYPES));
  }, []);

  const loadServicios = async () => {
    setLoading(true);
    try { setServicios((await getExpedienteServicios(expedienteId)) || []); }
    catch { setServicios([]); }
    finally { setLoading(false); }
  };

  const loadMatches = async () => {
    try { setMatchesPendientes((await getMatchesPendientesPorExpediente(expedienteId)) || []); }
    catch { /* silent */ }
  };

  useEffect(() => { loadServicios(); }, [expedienteId]);
  useEffect(() => { loadMatches(); }, [expedienteId]);

  useEffect(() => {
    if (!showAddMenu) return;
    function handler(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("[data-add-menu]") || t.closest("[data-add-btn]")) return;
      setShowAddMenu(false);
    }
    setTimeout(() => document.addEventListener("mousedown", handler));
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddMenu]);

  // Aplica un cambio local (optimista) a un servicio y marca el estado de guardado en esa
  // fila (saving/saved/error), sin recargar toda la tabla. `mutate` actualiza el estado local
  // al instante; `persist` es la llamada al servidor que confirma el cambio.
  const applyLocalChange = (id: string, patch: Record<string, any>) => {
    setServicios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const persistFieldChange = async (id: string, localPatch: Record<string, any>, persist: () => Promise<{ success: boolean; error?: string }>) => {
    applyLocalChange(id, localPatch);
    setSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
    try {
      const res = await persist();
      if (!res.success) {
        setSaveStatus((prev) => ({ ...prev, [id]: 'error' }));
        alert(res.error || "Error al guardar el cambio");
        return;
      }
      setSaveStatus((prev) => ({ ...prev, [id]: 'saved' }));
      setTimeout(() => setSaveStatus((prev) => { const n = { ...prev }; delete n[id]; return n; }), 2000);
    } catch (err: any) {
      setSaveStatus((prev) => ({ ...prev, [id]: 'error' }));
      alert(err.message || "Error al guardar el cambio");
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteExpedienteServicio(id, expedienteId); loadServicios(); }
    catch (err: any) { alert("Error al eliminar el servicio: " + err.message); }
  };

  const openAddService = () => { setEditServiceId(null); setEditServiceData(null); setIsServiceFormOpen(true); };
  const openEditService = (ser: any) => { setEditServiceId(ser.id); setEditServiceData(ser); setIsServiceFormOpen(true); };
  const closeServiceForm = () => { setIsServiceFormOpen(false); setEditServiceId(null); setEditServiceData(null); };

  const toggleExpand = (id: string) => setExpandedServicios(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const getTypeInfo = (typeId: string) => {
    const cat = serviceTypes.find(c => c.id === typeId || c.label.toLowerCase() === typeId?.toLowerCase());
    return cat ?? { label: "Otros", icono: "FolderPlus", color: "#475569", bg: "#f1f5f9" };
  };

  const getTypeIconComponent = (typeId: string) => (LucideIcons as any)[getTypeInfo(typeId).icono] || FolderPlus;

  const visibleServicios = useMemo(() => servicios.filter(s => !s.opcional), [servicios]);
  const optionalServicios = useMemo(() => servicios.filter(s => s.opcional), [servicios]);
  const nonOptionalServicios = useMemo(() => servicios.filter(s => !s.opcional), [servicios]);
  const hasOptionalOnly = visibleServicios.length === 0 && servicios.length > 0;
  const kpis = useMemo(() => calculateKpis(servicios), [servicios]);

  const categoriesToRender = useMemo(() =>
    calculateCategoryCosts(servicios, serviceTypes, getTypeInfo).map((cat: any) => ({
      ...cat,
      ...getTypeInfo(cat.id),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [servicios, serviceTypes]);

  const abonadosServicios = useMemo(() => servicios.filter(s => Number(s.abonado || 0) > 0), [servicios]);

  const filteredData = useMemo(
    () => abonadosServicios.filter(s =>
      s.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      s.proveedor.toLowerCase().includes(search.toLowerCase())
    ),
    [abonadosServicios, search]
  );

  const paginatedData = useMemo(
    () => filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [filteredData, currentPage, rowsPerPage]
  );

  const getMatch = (ser: any) => serviceHasMatch(ser, matchesPendientes);
  const pendingMatchCount = useMemo(
    () => matchesPendientes.filter(m => Number(m.importe) < 0).length,
    [matchesPendientes]
  );

    const handleToggleOpcional = async (id: string, opcional: boolean) => {
      await toggleServicioOpcional(id, opcional);
      loadServicios();
    };

    const handleUpdateImporte = async (id: string, neto: number | undefined, pvp: number | undefined) => {
      const patch: Record<string, any> = {};
      if (neto !== undefined) patch.neto = neto;
      if (pvp !== undefined) patch.pvp = pvp;
      await persistFieldChange(id, patch, () => updateExpedienteServicioImportes(id, { neto, pvp }, expedienteId));
    };

    const handleUpdateNoches = async (id: string, noches: number | null) => {
      await persistFieldChange(id, { noches }, () => updateExpedienteServicioNoches(id, noches, expedienteId));
    };

    const handleUpdateDestino = async (id: string, destino: string | null) => {
      await persistFieldChange(id, { destino }, () => updateExpedienteServicioDestino(id, destino, expedienteId));
    };

    const handleUpdateDescripcion = async (id: string, descripcion: string) => {
      await persistFieldChange(id, { descripcion }, async () => {
        await updateExpedienteServicio(id, { descripcion });
        return { success: true };
      });
    };

    const handleUpdateProveedor = async (id: string, proveedor: string) => {
      await persistFieldChange(id, { proveedor, proveedor_id: proveedor || null }, async () => {
        await updateExpedienteServicio(id, { proveedor });
        return { success: true };
      });
    };

    const handleUpdatePlazas = async (id: string, plazas: number) => {
      await persistFieldChange(id, { plazas }, async () => {
        await updateExpedienteServicio(id, { plazas });
        return { success: true };
      });
    };

    const handleUpdateTipo = async (id: string, tipo: string) => {
      await persistFieldChange(id, { tipo }, async () => {
        await updateExpedienteServicio(id, { tipo });
        return { success: true };
      });
    };

    const handleVincularCotizacion = async (id: string) => {
      if (!confirm("¿Añadir este servicio a la cotización del expediente?")) return;
      const res = await vincularServicioACotizacion(id);
      if (!res.success) alert(res.error || "Error al añadir el servicio a la cotización");
      await loadServicios();
    };

    const openInfoModal = (ser: any) => setInfoModalItem(ser);
    const closeInfoModal = () => setInfoModalItem(null);

    const handleSaveInfoModal = async (id: string, nativeValues: Record<string, any>, formValues: Record<string, any>, pendingPlace: any | null) => {
      let destId = nativeValues.destino;
      if (pendingPlace) {
        try {
          const destino = await createDestinoFromPlace(pendingPlace);
          if (destino) destId = destino.id;
        } catch (err: any) {
          console.error("Error al crear destino:", err);
        }
      }
      const finalDetalles = { ...formValues };
      if (pendingPlace?.photos?.length > 0) {
        finalDetalles.fotos_google = pendingPlace.photos.map((ph: any) => ph.name);
      }
      if (pendingPlace?.rating != null) finalDetalles.rating_google = pendingPlace.rating;
      if (pendingPlace?.userRatingCount != null) finalDetalles.user_rating_count = pendingPlace.userRatingCount;
      if (pendingPlace?.displayName) finalDetalles.nombre_lugar = pendingPlace.displayName;

      const neto = nativeValues.neto === "" ? 0 : Number(nativeValues.neto || 0);
      const pvp = nativeValues.pvp === "" ? 0 : Number(nativeValues.pvp || 0);
      const plazas = nativeValues.plazas ?? undefined;
      const noches = Number(nativeValues.noches || 0) || 1;

      try {
        // El formulario dinámico (detalles) vive en un único sitio: la línea de cotización
        // vinculada, si existe. Así evitamos duplicar y desincronizar el mismo dato en dos tablas.
        const lineaId = await getCotizacionLineaIdForServicio(id);

        if (lineaId) {
          await updateCotizacionLinea(lineaId, {
            descripcion: nativeValues.descripcion,
            proveedor: nativeValues.proveedor || undefined,
            destino: destId || null,
            plazas: plazas ?? null,
            noches: nativeValues.noches ?? null,
            neto,
            pvp,
            total_neto: neto * (plazas || 1) * noches,
            total_pvp: pvp * (plazas || 1) * noches,
            detalles: finalDetalles,
          });
          await updateExpedienteServicio(id, {
            descripcion: nativeValues.descripcion,
            proveedor: nativeValues.proveedor,
            destino: destId || null,
            plazas,
            noches: nativeValues.noches ?? null,
            neto,
            pvp,
          });
        } else {
          alert("Este servicio no está vinculado a ninguna línea de cotización, por lo que el formulario detallado no se puede guardar. Solo se guardarán los campos básicos.");
          await updateExpedienteServicio(id, {
            descripcion: nativeValues.descripcion,
            proveedor: nativeValues.proveedor,
            destino: destId || null,
            plazas,
            noches: nativeValues.noches ?? null,
            neto,
            pvp,
          });
        }
      } catch (err: any) {
        alert("Error al guardar el servicio: " + err.message);
      }
      await loadServicios();
    };

    return {
    servicios, loading, serviceTypes, matchesPendientes, visibleServicios, optionalServicios, nonOptionalServicios, hasOptionalOnly, abonadosServicios,
    isServiceFormOpen, isImportCotizacionOpen, isImportPdfOpen, isMatchBancarioOpen, isRegistrarPagoOpen,
    editServiceId, editServiceData, selectedMatch,
    tiposMap, infoModalItem, openInfoModal, closeInfoModal, handleSaveInfoModal, saveStatus,
    showAddMenu, setShowAddMenu,
    currentPage, setCurrentPage,
    rowsPerPage, setRowsPerPage: (r: number) => { setRowsPerPage(r); setCurrentPage(1); },
    search, setSearch: (v: string) => { setSearchRaw(v); setCurrentPage(1); },
    expandedServicios, toggleExpand,
    kpis, categoriesToRender, filteredData, paginatedData,
    getTypeInfo, getTypeIconComponent, getMatch, pendingMatchCount,
    loadServicios, loadMatches,
    handleDelete, handleToggleOpcional, handleUpdateImporte, handleUpdateNoches, handleUpdateDestino, handleUpdateDescripcion, handleUpdateProveedor, handleUpdatePlazas, handleUpdateTipo, handleVincularCotizacion, openAddService, openEditService, closeServiceForm,
    openImportCotizacion: () => setIsImportCotizacionOpen(true),
    closeImportCotizacion: () => setIsImportCotizacionOpen(false),
    openImportPdf: () => setIsImportPdfOpen(true),
    closeImportPdf: () => setIsImportPdfOpen(false),
    openMatchBancario: (match: any) => { setSelectedMatch(match); setIsMatchBancarioOpen(true); },
    closeMatchBancario: () => { setIsMatchBancarioOpen(false); setSelectedMatch(null); },
    openRegistrarPago: () => setIsRegistrarPagoOpen(true),
    closeRegistrarPago: () => setIsRegistrarPagoOpen(false),
  };
}
