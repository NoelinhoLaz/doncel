"use client";

import { useState, useEffect, useMemo } from "react";
import { FolderPlus } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { getExpedienteServicios, deleteExpedienteServicio } from "@/actions/servicios";
import { getTiposServicios } from "@/actions/tiposServicios";
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

  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isImportCotizacionOpen, setIsImportCotizacionOpen] = useState(false);
  const [isImportPdfOpen, setIsImportPdfOpen] = useState(false);
  const [isMatchBancarioOpen, setIsMatchBancarioOpen] = useState(false);
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
      .then((types) => setServiceTypes(
        types?.length
          ? types.map((t: any, i: number) => ({ id: t.id, label: t.etiqueta, icono: t.icono, ...TYPE_COLORS[i % TYPE_COLORS.length] }))
          : DEFAULT_TYPES
      ))
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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este servicio del expediente?")) return;
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
  const hasOptionalOnly = visibleServicios.length === 0 && servicios.length > 0;
  const kpis = useMemo(() => calculateKpis(servicios), [servicios]);

  const categoriesToRender = useMemo(() =>
    calculateCategoryCosts(servicios, serviceTypes, getTypeInfo).map((cat: any) => ({
      ...cat,
      ...getTypeInfo(cat.id),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [servicios, serviceTypes]);

  const filteredData = useMemo(
    () => visibleServicios.filter(s =>
      s.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      s.proveedor.toLowerCase().includes(search.toLowerCase())
    ),
    [visibleServicios, search]
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

  return {
    servicios, loading, serviceTypes, matchesPendientes, visibleServicios, hasOptionalOnly,
    isServiceFormOpen, isImportCotizacionOpen, isImportPdfOpen, isMatchBancarioOpen,
    editServiceId, editServiceData, selectedMatch,
    showAddMenu, setShowAddMenu,
    currentPage, setCurrentPage,
    rowsPerPage, setRowsPerPage: (r: number) => { setRowsPerPage(r); setCurrentPage(1); },
    search, setSearch: (v: string) => { setSearchRaw(v); setCurrentPage(1); },
    expandedServicios, toggleExpand,
    kpis, categoriesToRender, filteredData, paginatedData,
    getTypeInfo, getTypeIconComponent, getMatch, pendingMatchCount,
    loadServicios, loadMatches,
    handleDelete, openAddService, openEditService, closeServiceForm,
    openImportCotizacion: () => setIsImportCotizacionOpen(true),
    closeImportCotizacion: () => setIsImportCotizacionOpen(false),
    openImportPdf: () => setIsImportPdfOpen(true),
    closeImportPdf: () => setIsImportPdfOpen(false),
    openMatchBancario: (match: any) => { setSelectedMatch(match); setIsMatchBancarioOpen(true); },
    closeMatchBancario: () => { setIsMatchBancarioOpen(false); setSelectedMatch(null); },
  };
}
