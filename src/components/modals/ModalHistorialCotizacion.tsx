"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { MapPin, Users, Moon, List } from "lucide-react";
import { Icons } from "@/lib/icons";
import TipoIcon from "@/app/components/cotizacion/TipoIcon";
import { formatCurrency } from "@/hooks/useCotizacion";
import { formatDate } from "@/lib/utils/date";

const CotizacionLineasMap = dynamic(() => import("@/app/expedientes/[id]/components/CotizacionLineasMap"), { ssr: false });

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: any[];
  tiposMap: Record<string, any>;
  onAddItem?: (item: any, opcional: boolean) => void;
}

function useRatings(items: any[]) {
  const [ratings, setRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    items.forEach((it) => {
      const det = typeof it.detalles === 'string' ? (() => { try { return JSON.parse(it.detalles); } catch { return {}; } })() : (it.detalles || {});
      if (det?.rating_google != null) {
        setRatings(prev => ({ ...prev, [it.id]: det.rating_google }));
        return;
      }
      const fotos: string[] = Array.isArray(det?.fotos_google) ? det.fotos_google : [];
      if (!fotos.length) return;
      const match = fotos[0].match(/^places\/([^/]+)\/photos\//);
      if (!match) return;
      const placeId = match[1];
      fetch(`/api/places/rating?place_id=${encodeURIComponent(placeId)}`)
        .then(r => r.json())
        .then(d => { if (d.rating != null) setRatings(prev => ({ ...prev, [it.id]: d.rating })); })
        .catch(() => {});
    });
  }, [items]);

  return ratings;
}

export default function ModalHistorialCotizacion({ isOpen, onClose, items, tiposMap, onAddItem }: Props) {
  const ratings = useRatings(isOpen ? items : []);
  const [pendingItem, setPendingItem] = useState<any | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyTipoFilter, setHistoryTipoFilter] = useState<string[] | null>(null);
  const [historyDestFilter, setHistoryDestFilter] = useState<string | null>(null);
  const [historyDestPrincipalFilter, setHistoryDestPrincipalFilter] = useState<string | null>(null);
  const [historyEstadoFilter, setHistoryEstadoFilter] = useState<"" | "confirmado" | "pendiente">("");
  const [historyFechaDesde, setHistoryFechaDesde] = useState("");
  const [historyFechaHasta, setHistoryFechaHasta] = useState("");
  const [histEstadoFilterOpen, setHistEstadoFilterOpen] = useState(false);
  const histEstadoFilterRef = useRef<HTMLDivElement>(null);
  const [histDestFilterOpen, setHistDestFilterOpen] = useState(false);
  const histDestFilterRef = useRef<HTMLDivElement>(null);
  const [histDestSearch, setHistDestSearch] = useState("");
  const [histDestPrincipalFilterOpen, setHistDestPrincipalFilterOpen] = useState(false);
  const histDestPrincipalFilterRef = useRef<HTMLDivElement>(null);
  const [histDestPrincipalSearch, setHistDestPrincipalSearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [showMap, setShowMap] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setHistorySearch(""); setHistoryTipoFilter(null); setHistoryDestFilter(null); setHistoryDestPrincipalFilter(null); setHistoryEstadoFilter(""); setHistoryFechaDesde(""); setHistoryFechaHasta(""); setHistoryPage(1); setShowMap(false); setSelectedIds(new Set());
  }, [isOpen]);

  useEffect(() => {
    if (!histEstadoFilterOpen) return;
    function handler(e: MouseEvent) {
      if (histEstadoFilterRef.current && !histEstadoFilterRef.current.contains(e.target as Node)) setHistEstadoFilterOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [histEstadoFilterOpen]);

  useEffect(() => {
    if (!histDestFilterOpen) return;
    function handler(e: MouseEvent) {
      if (histDestFilterRef.current && !histDestFilterRef.current.contains(e.target as Node)) setHistDestFilterOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [histDestFilterOpen]);

  useEffect(() => {
    if (!histDestFilterOpen) setHistDestSearch("");
  }, [histDestFilterOpen]);

  useEffect(() => {
    if (!histDestPrincipalFilterOpen) return;
    function handler(e: MouseEvent) {
      if (histDestPrincipalFilterRef.current && !histDestPrincipalFilterRef.current.contains(e.target as Node)) setHistDestPrincipalFilterOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [histDestPrincipalFilterOpen]);

  useEffect(() => {
    if (!histDestPrincipalFilterOpen) setHistDestPrincipalSearch("");
  }, [histDestPrincipalFilterOpen]);

  const historyFilteredItems = useMemo(() => items.filter((it: any) => {
    if (historySearch) {
      const q = historySearch.toLowerCase();
      const descripcion = it.descripcion || "";
      const proveedor = it.contabilidad_proveedores?.nombre || it.contabilidad_proveedores?.razon_social || "";
      const destino = it.maestro_destinos?.nombre_comercial || it.maestro_destinos?.nombre || "";
      if (
        !descripcion.toLowerCase().includes(q) &&
        !proveedor.toLowerCase().includes(q) &&
        !destino.toLowerCase().includes(q)
      ) return false;
    }
    if (historyTipoFilter !== null && !historyTipoFilter.includes(it.tipo)) return false;
    if (historyDestFilter && it.maestro_destinos?.id !== historyDestFilter) return false;
    if (historyDestPrincipalFilter && !(it.destinosPrincipales || []).some((d: any) => d.id === historyDestPrincipalFilter)) return false;
    if (historyEstadoFilter === "confirmado" && !it.confirmado) return false;
    if (historyEstadoFilter === "pendiente" && !!it.confirmado) return false;
    if (historyFechaDesde && (!it.fecha_salida || it.fecha_salida < historyFechaDesde)) return false;
    if (historyFechaHasta && (!it.fecha_salida || it.fecha_salida > historyFechaHasta)) return false;
    return true;
  }), [items, historySearch, historyTipoFilter, historyDestFilter, historyDestPrincipalFilter, historyEstadoFilter, historyFechaDesde, historyFechaHasta]);

  const historyPoints = useMemo(() => historyFilteredItems
    .map((it: any) => {
      const d = it.maestro_destinos;
      const lat = Number(d?.lat); const lng = Number(d?.lng);
      if (!d || Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { id: it.id, destinoId: d.id, label: d.nombre_comercial || d.nombre || "Destino", subtitle: it.descripcion || undefined, lat, lng };
    })
    .filter(Boolean) as Array<{ id: string; destinoId: string; label: string; subtitle?: string; lat: number; lng: number }>,
  [historyFilteredItems]);

  const tiposUnicos = Array.from(new Map(items.map((it: any) => [it.tipo, it.config_tipos_servicios])).entries()).filter(([, cs]: any) => cs);
  const destinosUnicos = Array.from(new Map<string, any>(items.map((it: any) => [it.maestro_destinos?.id, it.maestro_destinos] as [string, any]).filter(([id]) => id)).values());
  const destinosPrincipalesUnicos = Array.from(new Map<string, any>(
    items.flatMap((it: any) => (it.destinosPrincipales || []).map((d: any) => [d.id, d] as [string, any]))
  ).values());
  const isAll = historyTipoFilter === null;
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(historyFilteredItems.length / pageSize));
  const safePage = Math.min(historyPage, totalPages);
  const paginated = historyFilteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (!isOpen) return null;

  const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: '0.62rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', padding: '0.3rem 0.4rem' };
  const tdStyle: React.CSSProperties = { padding: '0.25rem 0.4rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.72rem' };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ width: 'min(1280px, 95vw)', maxHeight: '90vh', background: '#ffffff', borderRadius: 12, boxShadow: '0 24px 48px rgba(2,6,23,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1rem 1rem 0.6rem', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Rastreador de servicios históricos</h3>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '0.2rem 0.4rem' }} aria-label="Cerrar">×</button>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.4rem' }}>
            Todas las líneas de cotización ({items.length})
          </div>
        </div>

        {/* Table section */}
        <div style={{ padding: '1rem', overflow: 'auto' }}>
          {/* Search row */}
          <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
            <input
              type="text"
              placeholder="Buscar por descripción, proveedor o destino..."
              value={historySearch}
              onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
              style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 1.7rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', outline: 'none', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
            />
            <Icons.Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </div>

          {/* Filters row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setPendingBulk(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.7rem',
                  border: 'none', borderRadius: 6, background: '#475569', color: '#fff',
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                }}
              >
                Añadir {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {[...tiposUnicos].sort((a: any, b: any) => (a[1]?.etiqueta || '').localeCompare(b[1]?.etiqueta || '')).map(([id, cs]: any) => {
                const active = isAll || (historyTipoFilter || []).includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    title={cs.etiqueta}
                    onClick={() => {
                      setHistoryPage(1);
                      if (isAll) {
                        setHistoryTipoFilter(tiposUnicos.map(([tid]: any) => tid).filter((tid: string) => tid !== id));
                      } else if ((historyTipoFilter || []).includes(id)) {
                        const next = (historyTipoFilter || []).filter((v: string) => v !== id);
                        setHistoryTipoFilter(next);
                      } else {
                        const next = [...(historyTipoFilter || []), id];
                        setHistoryTipoFilter(next.length === tiposUnicos.length ? null : next);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, border: `1px solid ${active ? 'var(--primary-color, #475569)' : '#e2e8f0'}`,
                      borderRadius: 6, background: active ? 'color-mix(in srgb, var(--primary-color, #6366f1) 12%, transparent)' : '#f8fafc',
                      color: active ? 'var(--primary-color, #475569)' : '#94a3b8',
                      cursor: 'pointer', flexShrink: 0, opacity: active ? 1 : 0.55, transition: 'all 0.15s ease',
                    }}
                  >
                    <TipoIcon iconName={cs.icono} size={14} />
                  </button>
                );
              })}
            </div>
            <div style={{ position: 'relative', minWidth: 140 }} ref={histEstadoFilterRef}>
              <div
                onClick={() => setHistEstadoFilterOpen(!histEstadoFilterOpen)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', color: '#0f172a', background: '#ffffff', height: 30, boxSizing: 'border-box' }}
              >
                <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {historyEstadoFilter === "" ? 'Todos los estados' : historyEstadoFilter === "confirmado" ? 'Confirmado' : 'Pendiente'}
                </span>
                <Icons.ChevronDown size={12} style={{ color: '#64748b', flexShrink: 0, transform: histEstadoFilterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
              {histEstadoFilterOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 99999, background: '#ffffff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', padding: '0.35rem', minWidth: 160 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {([
                      { value: "" as const, label: "Todos" },
                      { value: "confirmado" as const, label: "Confirmado" },
                      { value: "pendiente" as const, label: "Pendiente" },
                    ]).map((opt) => (
                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.4rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#0f172a' }}>
                        <input
                          type="radio"
                          name="historyEstadoFilter"
                          checked={historyEstadoFilter === opt.value}
                          onChange={() => { setHistoryEstadoFilter(opt.value); setHistoryPage(1); setHistEstadoFilterOpen(false); }}
                          style={{ accentColor: '#475569', margin: 0 }}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: 'relative', minWidth: 150 }} ref={histDestPrincipalFilterRef}>
              <div
                onClick={() => setHistDestPrincipalFilterOpen(!histDestPrincipalFilterOpen)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', color: '#0f172a', background: '#ffffff', height: 30, boxSizing: 'border-box' }}
              >
                <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {historyDestPrincipalFilter
                    ? (destinosPrincipalesUnicos.find((d: any) => d.id === historyDestPrincipalFilter)?.nombre_comercial || destinosPrincipalesUnicos.find((d: any) => d.id === historyDestPrincipalFilter)?.nombre || 'Destino principal')
                    : 'Destino principal'}
                </span>
                <Icons.ChevronDown size={12} style={{ color: '#64748b', flexShrink: 0, transform: histDestPrincipalFilterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
              {histDestPrincipalFilterOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 99999, background: '#ffffff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', padding: '0.35rem', minWidth: 200 }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar..."
                    value={histDestPrincipalSearch}
                    onChange={(e) => setHistDestPrincipalSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.75rem', outline: 'none', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box', marginBottom: '0.3rem' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.4rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }}
                      onClick={(e) => { e.preventDefault(); setHistoryDestPrincipalFilter(null); setHistoryPage(1); setHistDestPrincipalFilterOpen(false); }}
                    >
                      <input type="radio" name="historyDestPrincipalFilter" checked={!historyDestPrincipalFilter} readOnly style={{ accentColor: '#475569', margin: 0 }} />
                      Todos
                    </label>
                    {destinosPrincipalesUnicos
                      .filter((d: any) => (d.nombre_comercial || d.nombre || '').toLowerCase().includes(histDestPrincipalSearch.toLowerCase()))
                      .map((d: any) => (
                        <label
                          key={d.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.4rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#0f172a' }}
                          onClick={(e) => { e.preventDefault(); setHistoryDestPrincipalFilter(d.id); setHistoryPage(1); setHistDestPrincipalFilterOpen(false); }}
                        >
                          <input type="radio" name="historyDestPrincipalFilter" checked={historyDestPrincipalFilter === d.id} readOnly style={{ accentColor: '#475569', margin: 0 }} />
                          {d.nombre_comercial || d.nombre || 'Destino'}
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: 'relative', minWidth: 150 }} ref={histDestFilterRef}>
              <div
                onClick={() => setHistDestFilterOpen(!histDestFilterOpen)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', color: '#0f172a', background: '#ffffff', height: 30, boxSizing: 'border-box' }}
              >
                <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {historyDestFilter ? (destinosUnicos.find((d: any) => d.id === historyDestFilter)?.nombre_comercial || destinosUnicos.find((d: any) => d.id === historyDestFilter)?.nombre || 'Destino') : 'Destino servicio'}
                </span>
                <Icons.ChevronDown size={12} style={{ color: '#64748b', flexShrink: 0, transform: histDestFilterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
              {histDestFilterOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 99999, background: '#ffffff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', padding: '0.35rem', minWidth: 200 }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar..."
                    value={histDestSearch}
                    onChange={(e) => setHistDestSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.75rem', outline: 'none', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box', marginBottom: '0.3rem' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.4rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }}
                      onClick={(e) => { e.preventDefault(); setHistoryDestFilter(null); setHistoryPage(1); setHistDestFilterOpen(false); }}
                    >
                      <input type="radio" name="historyDestFilter" checked={!historyDestFilter} readOnly style={{ accentColor: '#475569', margin: 0 }} />
                      Todos
                    </label>
                    {destinosUnicos
                      .filter((d: any) => (d.nombre_comercial || d.nombre || '').toLowerCase().includes(histDestSearch.toLowerCase()))
                      .map((d: any) => (
                        <label
                          key={d.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.4rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', color: '#0f172a' }}
                          onClick={(e) => { e.preventDefault(); setHistoryDestFilter(d.id); setHistoryPage(1); setHistDestFilterOpen(false); }}
                        >
                          <input type="radio" name="historyDestFilter" checked={historyDestFilter === d.id} readOnly style={{ accentColor: '#475569', margin: 0 }} />
                          {d.nombre_comercial || d.nombre || 'Destino'}
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <input
              type="date"
              value={historyFechaDesde}
              onChange={(e) => { setHistoryFechaDesde(e.target.value); setHistoryPage(1); }}
              title="Fecha desde"
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.75rem', outline: 'none', color: '#0f172a', background: '#ffffff', height: 30, boxSizing: 'border-box' }}
            />
            <input
              type="date"
              value={historyFechaHasta}
              onChange={(e) => { setHistoryFechaHasta(e.target.value); setHistoryPage(1); }}
              title="Fecha hasta"
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.75rem', outline: 'none', color: '#0f172a', background: '#ffffff', height: 30, boxSizing: 'border-box' }}
            />
            <button
              onClick={() => setShowMap((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                height: 30, padding: '0 0.7rem', border: '1px solid #cbd5e1', borderRadius: 6,
                background: showMap ? '#475569' : '#fff', color: showMap ? '#fff' : '#475569',
                cursor: 'pointer', flexShrink: 0, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                marginLeft: 'auto',
              }}
            >
              {showMap ? <List size={15} /> : <MapPin size={15} />}
              {showMap ? 'Mostrar listado' : 'Mostrar en mapa'}
            </button>
          </div>

          {/* Active destination filter chips */}
          {(historyDestFilter || historyDestPrincipalFilter) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              {historyDestPrincipalFilter && (() => {
                const dest = destinosPrincipalesUnicos.find((d: any) => d.id === historyDestPrincipalFilter);
                return (
                  <>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Destino principal:</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eef2ff', color: '#4338ca', borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}>
                      {dest?.nombre_comercial || dest?.nombre || historyDestPrincipalFilter}
                      <span onClick={() => setHistoryDestPrincipalFilter(null)} style={{ cursor: 'pointer', marginLeft: 2, fontSize: '0.85rem', lineHeight: 1 }}>&times;</span>
                    </span>
                  </>
                );
              })()}
              {historyDestFilter && (() => {
                const dest = items.find((it: any) => it.maestro_destinos?.id === historyDestFilter)?.maestro_destinos;
                return (
                  <>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Destino servicio:</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eef2ff', color: '#4338ca', borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}>
                      {dest?.nombre_comercial || dest?.nombre || historyDestFilter}
                      <span onClick={() => setHistoryDestFilter(null)} style={{ cursor: 'pointer', marginLeft: 2, fontSize: '0.85rem', lineHeight: 1 }}>&times;</span>
                    </span>
                  </>
                );
              })()}
            </div>
          )}

          {/* Items table / map */}
          {showMap ? (
            <CotizacionLineasMap points={historyPoints} onDestinationClick={(id) => setHistoryDestFilter(id)} height={600} />
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              {onAddItem && <col style={{ width: 28 }} />}
              <col style={{ width: 22 }} />
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 85 }} />
              <col style={{ width: 85 }} />
              <col style={{ width: 55 }} />
              <col style={{ width: 55 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 170 }} />
            </colgroup>
            <thead>
              <tr>
                {onAddItem && (
                  <th style={{ ...thStyle, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={paginated.length > 0 && paginated.every((it: any) => selectedIds.has(it.id))}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          paginated.forEach((it: any) => { e.target.checked ? next.add(it.id) : next.delete(it.id); });
                          return next;
                        });
                      }}
                      style={{ accentColor: '#475569', margin: 0 }}
                    />
                  </th>
                )}
                {[
                  'Tipo', 'Descripción / Proveedor', 'Destino', 'Salida', 'Regreso',
                  <Users key="plazas" size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} />,
                  <Moon key="noches" size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} />,
                  'Neto / PVP', 'Tot. Neto / PVP', 'Estado', 'Cotización / Agente',
                ].map((h, i) => (
                  <th key={i} style={{ ...thStyle, textAlign: (i === 5 || i === 6 || i === 7 || i === 8) ? 'right' : i === 9 ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={onAddItem ? 12 : 11} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                    No hay servicios con el filtro seleccionado
                  </td>
                </tr>
              ) : paginated.map((it: any) => (
                <tr
                  key={`hist-${it.id}`}
                  onClick={() => onAddItem && setPendingItem(it)}
                  style={{ cursor: onAddItem ? 'pointer' : undefined }}
                  onMouseEnter={(e) => { if (onAddItem) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { if (onAddItem) e.currentTarget.style.background = ''; }}
                >
                  {onAddItem && (
                    <td style={{ ...tdStyle, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(it.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(it.id) : next.delete(it.id);
                            return next;
                          });
                        }}
                        style={{ accentColor: '#475569', margin: 0 }}
                      />
                    </td>
                  )}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div title={it.config_tipos_servicios?.etiqueta || it.tipo || '-'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ position: 'relative', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: 4 }}>
                        {!!it.opcional && (
                          <span
                            title="Servicio opcional"
                            style={{ position: 'absolute', top: -5, right: -5, backgroundColor: '#f97316', color: '#fff', fontSize: '0.36rem', fontWeight: 700, padding: '0.05rem 0.2rem', borderRadius: 999, whiteSpace: 'nowrap', lineHeight: 1.4, border: '1px solid #fff', zIndex: 1 }}
                          >
                            Op.
                          </span>
                        )}
                        <TipoIcon iconName={it.config_tipos_servicios?.icono || tiposMap[it.tipo]?.icono} size={11} />
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 0 }}>
                    <div title={it.descripcion || '-'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#1e293b' }}>{it.descripcion || '-'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1, flexWrap: 'wrap' }}>
                      {(() => { const n = it.contabilidad_proveedores?.nombre || it.contabilidad_proveedores?.razon_social || ''; return n ? <span style={{ fontSize: '0.64rem', color: '#64748b' }}>{n.length > 32 ? n.slice(0, 32) + '…' : n}</span> : null; })()}
                      {ratings[it.id] != null && (() => {
                        const stars = Math.round(ratings[it.id]);
                        return (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                            <span style={{ color: '#f59e0b', fontSize: '0.6rem', letterSpacing: 0.5 }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b' }}>{Number(ratings[it.id]).toFixed(1)}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }} title={it.maestro_destinos?.nombre_comercial || it.maestro_destinos?.nombre || ''}>
                    {it.maestro_destinos?.nombre_comercial || it.maestro_destinos?.nombre || '—'}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.68rem' }}>{it.fecha_salida ? formatDate(it.fecha_salida) : '—'}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.68rem' }}>{it.fecha_regreso ? formatDate(it.fecha_regreso) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{it.plazas ?? '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{it.noches ?? '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ fontWeight: 500 }}>{formatCurrency(it.neto)}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{formatCurrency(it.pvp)}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(it.total_neto ?? (Number(it.neto || 0) * Number(it.plazas || 1) * Number(it.noches || 1)))}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{formatCurrency(it.total_pvp)}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', backgroundColor: it.confirmado ? '#f0fdf4' : '#fffbeb', color: it.confirmado ? '#16a34a' : '#d97706' }}>
                      {it.confirmado ? 'Confirmado' : 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden' }}>
                    {it.cotizacionTitulo && (
                      <div style={{ fontWeight: 600, fontSize: '0.72rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.cotizacionTitulo}>
                        {it.cotizacionTitulo}
                      </div>
                    )}
                    <div style={{ fontSize: '0.64rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.agente?.nombre || 'Agente'}>
                      {it.agente?.nombre || '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}

          {pendingItem && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setPendingItem(null)}
            >
              <div
                style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', maxWidth: 380, width: '90vw', boxShadow: '0 16px 48px rgba(2,6,23,0.2)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Añadir servicio</p>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
                  {pendingItem.descripcion || '—'}<br />
                  ¿Cómo quieres añadir este servicio?
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => { onAddItem!(pendingItem, false); setPendingItem(null); }}
                    style={{ flex: 1, padding: '0.6rem 0.75rem', background: '#475569', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    Para todos los viajeros
                  </button>
                  <button
                    onClick={() => { onAddItem!(pendingItem, true); setPendingItem(null); }}
                    style={{ flex: 1, padding: '0.6rem 0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    Opcional
                  </button>
                </div>
                <button onClick={() => setPendingItem(null)} style={{ marginTop: '0.75rem', width: '100%', padding: '0.45rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Cancelar</button>
              </div>
            </div>
          )}

          {pendingBulk && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setPendingBulk(false)}
            >
              <div
                style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', maxWidth: 380, width: '90vw', boxShadow: '0 16px 48px rgba(2,6,23,0.2)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Añadir servicios</p>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
                  {selectedIds.size} línea{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}.<br />
                  ¿Cómo quieres añadirlas?
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => {
                      items.filter((it: any) => selectedIds.has(it.id)).forEach((it: any) => onAddItem!(it, false));
                      setSelectedIds(new Set()); setPendingBulk(false);
                    }}
                    style={{ flex: 1, padding: '0.6rem 0.75rem', background: '#475569', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    Para todos los viajeros
                  </button>
                  <button
                    onClick={() => {
                      items.filter((it: any) => selectedIds.has(it.id)).forEach((it: any) => onAddItem!(it, true));
                      setSelectedIds(new Set()); setPendingBulk(false);
                    }}
                    style={{ flex: 1, padding: '0.6rem 0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    Opcional
                  </button>
                </div>
                <button onClick={() => setPendingBulk(false)} style={{ marginTop: '0.75rem', width: '100%', padding: '0.45rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Cancelar</button>
              </div>
            </div>
          )}

          {!showMap && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button disabled={safePage <= 1} onClick={() => setHistoryPage(safePage - 1)} style={{ border: '1px solid #cbd5e1', background: safePage <= 1 ? '#f1f5f9' : '#fff', color: safePage <= 1 ? '#94a3b8' : '#0f172a', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: safePage <= 1 ? 'default' : 'pointer', fontSize: '0.75rem' }}>Anterior</button>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>{safePage} / {totalPages}</span>
              <button disabled={safePage >= totalPages} onClick={() => setHistoryPage(safePage + 1)} style={{ border: '1px solid #cbd5e1', background: safePage >= totalPages ? '#f1f5f9' : '#fff', color: safePage >= totalPages ? '#94a3b8' : '#0f172a', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: safePage >= totalPages ? 'default' : 'pointer', fontSize: '0.75rem' }}>Siguiente</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
