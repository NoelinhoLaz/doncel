"use client";

import { useState, useEffect, useMemo } from "react";
import { getViajerosByExpediente } from "@/actions/viajeros";
import { getExtrasIconMap } from "@/actions/servicios";
import { getMatchesPendientesPorExpediente } from "@/actions/banco";
import { getPaymentPlazos, getPlazoDetail } from "@/lib/utils/cobrosUtils";
import type { Pagador } from "@/lib/types/cobros";

function mapRawViajero(v: any, pvpViajero: number, fechaSalida?: string): any {
  const entidad = v.contabilidad_entidades || {};
  const metadatos = entidad.metadatos || {};
  const extrasRaw = v.extras;
  let extras: any[] = [];
  if (typeof extrasRaw === "string") {
    try { extras = JSON.parse(extrasRaw); } catch { extras = []; }
  } else if (Array.isArray(extrasRaw)) {
    extras = extrasRaw;
  }
  const tutor = v.tutores || {};
  const documento_caducidad = entidad.documento_caducidad || metadatos.documento_caducidad || "";
  const warningDoc = (() => {
    if (!documento_caducidad || !fechaSalida) return false;
    const cad = new Date(documento_caducidad);
    const salida = new Date(fechaSalida);
    if (isNaN(cad.getTime()) || isNaN(salida.getTime())) return false;
    return (cad.getTime() - salida.getTime()) / (1000 * 60 * 60 * 24 * 30.44) < 6;
  })();

  const boolFlag = (val: any, trueVals: string[], falseVals: string[], fallback: boolean) =>
    trueVals.includes(String(val)) || val === true
      ? "S"
      : falseVals.includes(String(val)) || val === false
        ? "N"
        : fallback ? "S" : "N";

  return {
    id: v.id,
    entidad_id: v.entidad_id,
    pagador_id: v.pagador_id,
    name: entidad.nombre || "Sin nombre",
    tutor: tutor.nombre || "",
    email: entidad.email || "",
    tutorEmail: tutor.email || "",
    phone: entidad.telefono || "",
    tutorPhone: tutor.telefono || "",
    dni: entidad.documento || "",
    tutorDni: tutor.documento || "",
    type: metadatos.sexo === "M" ? "CHD" : "ADL",
    gender: metadatos.sexo || "",
    birthDate: metadatos.fecha_nacimiento || "",
    alergias: (() => {
      const raw = v.alergias;
      if (!raw) return [];
      let arr: any[] = [];
      if (Array.isArray(raw)) arr = raw;
      else if (typeof raw === "string") { try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : []; } catch { return []; } }
      return arr.map((a: any) => (a && typeof a === "object" ? a.nombre ?? a.label ?? String(a) : a)).filter(Boolean);
    })(),
    status: v.estado ? v.estado.toUpperCase() : "PENDIENTE",
    extras,
    importe: (pvpViajero ?? 0) + (v.importe_extras ?? 0),
    warningDoc,
    documentoCaducidad: documento_caducidad,
    newsletter: boolFlag(metadatos.newsletter, ["S", "si", "Sí"], ["N", "no", "No"], v.id.charCodeAt(0) % 2 === 0),
    contrato: boolFlag(
      metadatos.contrato ?? metadatos.contrato_firmado,
      ["S", "si", "Sí"],
      ["N", "no", "No"],
      v.id.charCodeAt(1) % 2 === 0
    ),
  };
}

export function useViajeros(
  expedienteId: string,
  fechaSalida?: string,
  pvpViajero?: number | null,
  pagadores: any[] = [],
  plazos: any[] = []
) {
  const [viajeros, setViajeros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [extrasIconMap, setExtrasIconMap] = useState<Record<string, string>>({});
  const [matchesCobros, setMatchesCobros] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isFilterRowOpen, setIsFilterRowOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"plazos" | "extras" | "newsletter" | "contrato" | null>(null);
  const [activePlazoFilters, setActivePlazoFilters] = useState<string[]>([]);
  const [activeExtraFilters, setActiveExtraFilters] = useState<string[]>([]);
  const [activeNewsletterFilters, setActiveNewsletterFilters] = useState<string[]>([]);
  const [activeContratoFilters, setActiveContratoFilters] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (!expedienteId) return;
    setLoading(true);
    Promise.all([getViajerosByExpediente(expedienteId), getExtrasIconMap(expedienteId)])
      .then(([data, iconMap]) => {
        setExtrasIconMap(iconMap);
        setViajeros(data.map((v: any) => mapRawViajero(v, pvpViajero ?? 0, fechaSalida)));
      })
      .catch(() => setViajeros([]))
      .finally(() => setLoading(false));
  }, [expedienteId, fechaSalida, pvpViajero]);

  useEffect(() => {
    if (!expedienteId) return;
    getMatchesPendientesPorExpediente(expedienteId)
      .then((m) => setMatchesCobros((m || []).filter((x: any) => Number(x.importe) > 0)))
      .catch(() => {});
  }, [expedienteId]);

  const pagadorMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of pagadores) m.set(p.entidad_id, p);
    return m;
  }, [pagadores]);

  const paymentPlazosList = useMemo(
    () => (plazos || []).filter((p: any) => !p.tipo || p.tipo === "pago"),
    [plazos]
  );

  const plazoFilterOptions = useMemo(() => {
    const opts: Array<{ id: string; plazoIndex: number; status: string; label: string; color: string }> = [];
    paymentPlazosList.forEach((p: any, idx: number) => {
      const desc = p.descripcion || `Plazo ${idx + 1}`;
      opts.push(
        { id: `${idx}-green`, plazoIndex: idx, status: "green", label: `${desc} (Abonado)`, color: "#22c55e" },
        { id: `${idx}-orange`, plazoIndex: idx, status: "orange", label: `${desc} (Parcial)`, color: "#f97316" },
        { id: `${idx}-gray`, plazoIndex: idx, status: "gray", label: `${desc} (Pendiente)`, color: "#94a3b8" }
      );
    });
    return opts;
  }, [paymentPlazosList]);

  const plazoFiltersGrouped = useMemo(() => {
    const groups: Record<number, string[]> = {};
    activePlazoFilters.forEach((fid) => {
      const opt = plazoFilterOptions.find((o) => o.id === fid);
      if (opt) {
        if (!groups[opt.plazoIndex]) groups[opt.plazoIndex] = [];
        groups[opt.plazoIndex].push(opt.status);
      }
    });
    return groups;
  }, [activePlazoFilters, plazoFilterOptions]);

  const dynamicExtras = useMemo(() => {
    const set = new Set<string>();
    viajeros.forEach((v) => (v.extras || []).forEach((e: any) => { if (e.descripcion) set.add(e.descripcion); }));
    return Array.from(set).sort();
  }, [viajeros]);

  const filteredData = useMemo(() => {
    return viajeros.filter((v) => {
      const term = search.toLowerCase();
      if (
        !v.name.toLowerCase().includes(term) &&
        !v.email.toLowerCase().includes(term) &&
        !v.dni.toLowerCase().includes(term) &&
        !(v.tutor || "").toLowerCase().includes(term)
      ) return false;

      for (const [pIdxStr, statuses] of Object.entries(plazoFiltersGrouped)) {
        const pagador = pagadorMap.get(v.pagador_id);
        const color = pagador
          ? getPlazoDetail(pagador as Pagador, plazos, Number(pIdxStr)).color
          : "gray";
        if (!statuses.includes(color)) return false;
      }

      if (activeExtraFilters.length > 0 && !(v.extras || []).some((e: any) => activeExtraFilters.includes(e.descripcion))) return false;
      if (activeNewsletterFilters.length > 0 && !activeNewsletterFilters.includes(v.newsletter === "S" ? "Sí" : "No")) return false;
      if (activeContratoFilters.length > 0 && !activeContratoFilters.includes(v.contrato === "S" ? "Sí" : "No")) return false;

      return true;
    });
  }, [viajeros, search, pagadorMap, plazoFiltersGrouped, plazos, activeExtraFilters, activeNewsletterFilters, activeContratoFilters]);

  const sortedData = useMemo(() => {
    const data = [...filteredData];
    data.sort((a, b) => {
      let va: any = "";
      let vb: any = "";
      switch (sortKey) {
        case "name": va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); break;
        case "email": va = (a.email || "").toLowerCase(); vb = (b.email || "").toLowerCase(); break;
        case "phone": va = (a.phone || "").toLowerCase(); vb = (b.phone || "").toLowerCase(); break;
        case "dni": va = (a.dni || "").toLowerCase(); vb = (b.dni || "").toLowerCase(); break;
        case "gender": va = (a.gender || "").toLowerCase(); vb = (b.gender || "").toLowerCase(); break;
        case "extras": va = (a.extras || []).length; vb = (b.extras || []).length; break;
        case "birthDate": va = a.birthDate || ""; vb = b.birthDate || ""; break;
        case "status": va = (a.status || "").toLowerCase(); vb = (b.status || "").toLowerCase(); break;
        case "newsletter": va = a.newsletter; vb = b.newsletter; break;
        case "contrato": va = a.contrato; vb = b.contrato; break;
        case "importe": va = Number(a.importe || 0); vb = Number(b.importe || 0); break;
        case "plazos": {
          const pa = pagadorMap.get(a.pagador_id);
          const pb = pagadorMap.get(b.pagador_id);
          va = pa ? getPaymentPlazos(pa as Pagador, plazos).length : 0;
          vb = pb ? getPaymentPlazos(pb as Pagador, plazos).length : 0;
          break;
        }
      }
      if (typeof va === "string" && typeof vb === "string")
        return sortDirection === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDirection === "asc" ? (va > vb ? 1 : va < vb ? -1 : 0) : (va < vb ? 1 : va > vb ? -1 : 0);
    });
    return data;
  }, [filteredData, sortKey, sortDirection, pagadorMap, plazos]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDirection("asc"); }
  };
  const handleSearchChange = (v: string) => { setSearch(v); setCurrentPage(1); };
  const handleRowsPerPageChange = (r: number) => { setRowsPerPage(r); setCurrentPage(1); };
  const togglePlazoFilter = (id: string) => { setActivePlazoFilters((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); setCurrentPage(1); };
  const toggleExtraFilter = (v: string) => { setActiveExtraFilters((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]); setCurrentPage(1); };
  const toggleNewsletterFilter = (v: string) => { setActiveNewsletterFilters((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]); setCurrentPage(1); };
  const toggleContratoFilter = (v: string) => { setActiveContratoFilters((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]); setCurrentPage(1); };
  const clearAllFilters = () => { setActivePlazoFilters([]); setActiveExtraFilters([]); setActiveNewsletterFilters([]); setActiveContratoFilters([]); setCurrentPage(1); };

  return {
    viajeros, loading, extrasIconMap, matchesCobros, dynamicExtras, paymentPlazosList, pagadorMap,
    search, handleSearchChange,
    isFilterRowOpen, setIsFilterRowOpen,
    openDropdown, setOpenDropdown,
    activePlazoFilters, togglePlazoFilter,
    activeExtraFilters, toggleExtraFilter,
    activeNewsletterFilters, toggleNewsletterFilter,
    activeContratoFilters, toggleContratoFilter,
    clearAllFilters,
    sortKey, sortDirection, handleSort,
    currentPage, setCurrentPage, rowsPerPage, handleRowsPerPageChange,
    filteredData, paginatedData,
  };
}
