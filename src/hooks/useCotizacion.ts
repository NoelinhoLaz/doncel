"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getTiposServicios } from "@/actions/tiposServicios";
import { createDestinoFromPlace } from "@/actions/destinos";
import { computeLineTotals } from "@/lib/utils/cotizaciones";

const _fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const formatCurrency = (v: any): string => {
  if (v === undefined || v === null || v === "") return "—";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : _fmt.format(n);
};

export function useCotizacion(
  cotizacionId: string | null | undefined,
  initialCotizacion: any | null,
  opcionalFilter?: boolean
) {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [tiposMap, setTiposMap] = useState<Record<string, any>>({});
  const [search, setSearchRaw] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPageRaw] = useState(100);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showAddTipoPopup, setShowAddTipoPopup] = useState(false);
  const addBtnRef = useRef<HTMLDivElement>(null);
  const [summaryPlazas, setSummaryPlazas] = useState(30);
  const [summaryFree, setSummaryFree] = useState(2);
  const [summaryPvpViajero, setSummaryPvpViajero] = useState(0);
  const [hasEditedPvp, setHasEditedPvp] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [allItemsForHistory, setAllItemsForHistory] = useState<any[]>([]);
  const openHistoryModal = async () => {
    if (cotizacionId) {
      try {
        const res = await fetch(`/api/cotizaciones?id=${cotizacionId}`);
        const j = await res.json();
        setAllItemsForHistory((j?.data?.operativa_cotizacion_lineas || []).map(parseDetalles));
      } catch { setAllItemsForHistory(items); }
    } else {
      setAllItemsForHistory(items);
    }
    setShowHistoryModal(true);
  };
  const [infoModalItem, setInfoModalItem] = useState<any | null>(null);

  const persistChange = async (id: string, payload: Record<string, any>) => {
    setSaveStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const res = await fetch('/api/cotizaciones/lineas/update', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      });
      const j = await res.json();
      if (j?.success) {
        if (j.data) setItems(prev => prev.map(it => it.id === id ? { ...it, ...j.data } : it));
        setSaveStatus(prev => ({ ...prev, [id]: 'saved' }));
        setTimeout(() => setSaveStatus(prev => { const n = { ...prev }; delete n[id]; return n; }), 2000);
      } else {
        setSaveStatus(prev => ({ ...prev, [id]: 'error' }));
      }
    } catch {
      setSaveStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const parseDetalles = (l: any) => {
    if (typeof l.detalles === 'string') {
      try { return { ...l, detalles: JSON.parse(l.detalles) }; } catch { return { ...l, detalles: {} }; }
    }
    return l;
  };

  const initItems = (lineas: any[]) => {
    setItems(lineas.map(parseDetalles));
    setCheckedIds(Object.fromEntries(lineas.map((l: any) => [l.id, l.checked !== false])));
    lineas.forEach((line: any) => {
      if (!line?.id || String(line.id).startsWith('new-')) return;
      const totals = computeLineTotals(line);
      if (Number(line.total_neto ?? 0) !== totals.total_neto || Number(line.total_pvp ?? 0) !== totals.total_pvp) {
        persistChange(line.id, totals);
      }
    });
  };

  useEffect(() => {
    async function load() {
      if (cotizacionId) {
        setLoading(true);
        try {
          const res = await fetch(`/api/cotizaciones?id=${cotizacionId}`);
          const j = await res.json();
          initItems(j?.success && j.data ? j.data.operativa_cotizacion_lineas || [] : []);
        } catch { setItems([]); }
        setLoading(false);
      } else if (initialCotizacion) {
        initItems(initialCotizacion.operativa_cotizacion_lineas || []);
        setLoading(false);
      } else {
        setLoading(false);
        setItems([]);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizacionId]);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu-container]')) setOpenMenuId(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenuId]);

  useEffect(() => {
    if (!showAddTipoPopup) return;
    const handler = (e: MouseEvent) => {
      if (addBtnRef.current && !addBtnRef.current.contains(e.target as Node)) setShowAddTipoPopup(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddTipoPopup]);

  useEffect(() => {
    getTiposServicios().then((tipos) => {
      const map: Record<string, any> = {};
      (tipos || []).forEach((t: any) => { map[t.id] = t; });
      setTiposMap(map);
    }).catch(() => {});
  }, []);

  const handleItemChange = (id: any, field: string, value: any) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      if (['plazas', 'noches', 'neto', 'pvp'].includes(field)) Object.assign(updated, computeLineTotals(updated));
      return updated;
    }));
    if (typeof id === 'string' && !id.startsWith('new-') && cotizacionId) {
      const payload: Record<string, any> = { [field]: value };
      if (['plazas', 'noches', 'neto', 'pvp'].includes(field)) {
        Object.assign(payload, computeLineTotals({ ...items.find((it: any) => it.id === id), [field]: value }));
      }
      persistChange(id, payload);
    }
  };

  const createLineaOnServer = async (tempId: string, line: any) => {
    if (!cotizacionId) return;
    try {
      const res = await fetch('/api/cotizaciones/lineas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacion_id: cotizacionId, ...line }),
      });
      const j = await res.json();
      if (j?.success && j.data) setItems(prev => prev.map(it => it.id === tempId ? j.data : it));
      else alert('Error creating línea: ' + (j?.error || 'unknown'));
    } catch (err: any) {
      alert('Error creating línea: ' + (err?.message || String(err)));
    }
  };

  const displayItems = useMemo(
    () => opcionalFilter !== undefined ? items.filter(i => i.opcional === opcionalFilter) : items,
    [items, opcionalFilter]
  );

  const filtered = useMemo(
    () => displayItems.filter(i => (i.title || "").toLowerCase().includes(search.toLowerCase())),
    [displayItems, search]
  );

  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [filtered, currentPage, rowsPerPage]
  );

  const totalCost = useMemo(
    () => displayItems.reduce((sum, it) => {
      if (checkedIds[it.id] === false) return sum;
      return sum + Number(it.total_neto ?? (Number(it.neto || 0) * Number(it.plazas || 0) * Number(it.noches || 0)));
    }, 0),
    [displayItems, checkedIds]
  );

  const totalRevenue = useMemo(
    () => displayItems.reduce((sum, it) => {
      if (checkedIds[it.id] === false) return sum;
      return sum + Number(it.total_pvp ?? (Number(it.pvp || 0) * Number(it.plazas || 0) * Number(it.noches || 0)));
    }, 0),
    [displayItems, checkedIds]
  );

  useEffect(() => {
    if (!hasEditedPvp && summaryPlazas > 0) setSummaryPvpViajero(Math.round(totalRevenue / summaryPlazas));
  }, [totalRevenue, summaryPlazas, hasEditedPvp]);

  const handleDeleteItem = (id: any) => {
    setItems(prev => prev.filter(it => it.id !== id));
    if (typeof id === 'string' && !id.startsWith('new-') && cotizacionId) {
      fetch(`/api/cotizaciones/lineas?id=${id}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const handleDuplicateItem = (item: any) => {
    const newItem = { ...item, id: `new-${Date.now()}`, grupo_alternativa_id: null };
    setItems(prev => {
      const idx = prev.findIndex(it => it.id === item.id);
      if (idx === -1) return [newItem, ...prev];
      const updated = [...prev];
      updated.splice(idx + 1, 0, newItem);
      return updated;
    });
  };

  const handleCreateAlternative = (item: any) => {
    const groupId = item.grupo_alternativa_id || crypto.randomUUID();
    const newId = `new-${Date.now()}`;
    const newItem = { ...item, id: newId, checked: false, grupo_alternativa_id: groupId };
    setItems(prev => {
      const updated = prev.map(i => i.id === item.id ? { ...i, grupo_alternativa_id: groupId } : i);
      const idx = updated.findIndex(i => i.id === item.id);
      if (idx === -1) return [newItem, ...updated];
      updated.splice(idx + 1, 0, newItem);
      return updated;
    });
    setCheckedIds(prev => ({ ...prev, [newId]: false, [item.id]: true }));
    if (cotizacionId) {
      if (!item.id.startsWith('new-')) persistChange(item.id, { grupo_alternativa_id: groupId });
      const serverPayload: any = { cotizacion_id: cotizacionId, ...newItem };
      delete serverPayload.id;
      delete serverPayload.config_tipos_servicios;
      delete serverPayload.maestro_destinos;
      createLineaOnServer(newId, serverPayload);
    }
  };

  const handleUngroup = (item: any) => {
    const groupId = item.grupo_alternativa_id;
    if (!groupId) return;
    setItems(prev => prev.map(i => i.grupo_alternativa_id === groupId ? { ...i, grupo_alternativa_id: null } : i));
    if (cotizacionId) {
      items.forEach(i => {
        if (i.grupo_alternativa_id === groupId && typeof i.id === 'string' && !i.id.startsWith('new-')) {
          persistChange(i.id, { grupo_alternativa_id: null });
        }
      });
    }
  };

  const handleCheckedChange = (id: string, val: boolean, grupoAlternativaId: string | null) => {
    setCheckedIds(prev => {
      const next = { ...prev, [String(id)]: val };
      if (val && grupoAlternativaId) {
        displayItems.forEach(i => {
          if (String(i.id) !== String(id) && i.grupo_alternativa_id === grupoAlternativaId) {
            next[String(i.id)] = false;
          }
        });
      }
      return next;
    });
    if (!id.startsWith('new-') && cotizacionId) {
      handleItemChange(id, 'checked', val);
      if (val && grupoAlternativaId) {
        displayItems.forEach(i => {
          if (i.id !== id && i.grupo_alternativa_id === grupoAlternativaId && typeof i.id === 'string' && !i.id.startsWith('new-')) {
            persistChange(i.id, { checked: false });
          }
        });
      }
    }
  };

  const handleAddItemByTipo = (t: any) => {
    setShowAddTipoPopup(false);
    const newItem: any = {
      id: `new-${Date.now()}`, tipo: t.id, descripcion: "", proveedor: "", destino: "",
      plazas: null, noches: null, neto: null, pvp: null, total_neto: null, total_pvp: null, detalles: {},
    };
    if (opcionalFilter !== undefined) newItem.opcional = opcionalFilter;
    setItems(prev => [newItem, ...prev]);
    setCurrentPage(1);
    if (cotizacionId) createLineaOnServer(newItem.id, newItem);
  };

  const addItemFromHistory = async (sourceItem: any) => {
    const tempId = `new-${Date.now()}`;
    const newItem: any = {
      id: tempId,
      tipo: sourceItem.tipo,
      descripcion: sourceItem.descripcion ?? '',
      proveedor: sourceItem.proveedor ?? null,
      destino: sourceItem.destino ?? null,
      plazas: sourceItem.plazas ?? null,
      noches: sourceItem.noches ?? null,
      neto: sourceItem.neto ?? null,
      pvp: sourceItem.pvp ?? null,
      total_neto: sourceItem.total_neto ?? null,
      total_pvp: sourceItem.total_pvp ?? null,
      detalles: sourceItem.detalles ?? {},
      opcional: sourceItem.opcional ?? false,
    };
    setItems(prev => [newItem, ...prev]);
    setCurrentPage(1);
    if (cotizacionId) {
      const serverPayload = { ...newItem };
      delete serverPayload.id;
      await createLineaOnServer(tempId, serverPayload);
      // Refresh to get full joined data (proveedor, destino, tipo relations)
      try {
        const res = await fetch(`/api/cotizaciones?id=${cotizacionId}`);
        const j = await res.json();
        if (j?.success && j.data) initItems(j.data.operativa_cotizacion_lineas || []);
      } catch {}
    }
  };

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
    const finalNative: Record<string, any> = { ...nativeValues, destino: destId };
    const currentItem = items.find(it => it.id === id);
    (['descripcion', 'proveedor', 'destino', 'plazas', 'noches', 'neto'] as const).forEach(f => {
      if (finalNative[f] !== currentItem?.[f]) handleItemChange(id, f, finalNative[f]);
    });
    const finalDetalles = { ...formValues };
    if (pendingPlace?.photos?.length > 0) {
      finalDetalles.fotos_google = pendingPlace.photos.map((ph: any) => ph.name);
    }
    if (pendingPlace?.rating != null) finalDetalles.rating_google = pendingPlace.rating;
    if (pendingPlace?.userRatingCount != null) finalDetalles.user_rating_count = pendingPlace.userRatingCount;
    if (pendingPlace?.displayName) finalDetalles.nombre_lugar = pendingPlace.displayName;
    handleItemChange(id, 'detalles', finalDetalles);
  };

  /**
   * Imports an array of pre-parsed rows (produced by the two-step Sheets modal).
   * Each row already has the correct tipo selected by the user.
   */
  const handleImportFromSheets = (
    rows: Array<{
      proveedor: string;
      plazas: number;
      neto: number;
      noches: number;
      total: number;
      tipoId: string;
      opcional?: boolean;
    }>
  ): number => {
    if (!rows.length) return 0;

    const nuevasLineas: any[] = rows.map((r) => {
      const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return {
        id,
        tipo: r.tipoId || (Object.keys(tiposMap)[0] ?? null),
        descripcion: r.proveedor,
        proveedor: '',
        destino: '',
        plazas: r.plazas,
        noches: r.noches,
        neto: r.neto,
        pvp: null,
        total_neto: r.total || r.plazas * r.neto * r.noches,
        total_pvp: null,
        opcional: r.opcional ?? false,
        detalles: {},
      };
    });

    setItems(prev => [...nuevasLineas, ...prev]);
    setCurrentPage(1);
    if (cotizacionId) {
      nuevasLineas.forEach(nl => createLineaOnServer(nl.id, nl));
    }

    return nuevasLineas.length;
  };

  return {
    router,
    items, allItems: allItemsForHistory, loading, tiposMap,
    displayItems, filtered, paginated,
    checkedIds, saveStatus,
    search, setSearch: (v: string) => { setSearchRaw(v); setCurrentPage(1); },
    currentPage, setCurrentPage,
    rowsPerPage, setRowsPerPage: (r: number) => { setRowsPerPageRaw(r); setCurrentPage(1); },
    openMenuId, setOpenMenuId,
    showAddTipoPopup, setShowAddTipoPopup, addBtnRef,
    summaryPlazas, setSummaryPlazas,
    summaryFree, setSummaryFree,
    summaryPvpViajero, setSummaryPvpViajero,
    hasEditedPvp, setHasEditedPvp,
    totalCost, totalRevenue,
    showHistoryModal, setShowHistoryModal, openHistoryModal,
    infoModalItem, openInfoModal: setInfoModalItem, closeInfoModal: () => setInfoModalItem(null),
    handleItemChange, handleCheckedChange, handleDeleteItem, handleDuplicateItem,
    handleCreateAlternative, handleUngroup, handleAddItemByTipo, addItemFromHistory, handleSaveInfoModal,
    handleImportFromSheets,
    persistChange,
  };
}
