"use client";

import { useState, useMemo, useEffect } from "react";
import { getViajerosByExpediente } from "@/actions/viajeros";
import { getMatchesPendientesPorExpediente } from "@/actions/banco";
import { getPaymentPlazos, getPlazoDetail } from "@/lib/utils/cobrosUtils";
import type { Pagador, MovimientoCobro } from "@/lib/types/cobros";

export function useCobros(
  pagadores: Pagador[],
  movimientos: MovimientoCobro[],
  plazos: any[],
  expedienteId?: string
) {
  const [viajeros, setViajeros] = useState<any[]>([]);
  const [expandedPagadores, setExpandedPagadores] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isFilterRowOpen, setIsFilterRowOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"plazos" | null>(null);
  const [activePlazoFilters, setActivePlazoFilters] = useState<string[]>([]);
  const [matchesCobros, setMatchesCobros] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState("cliente");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  // Reserved for future movimientos section
  const [movsCurrentPage] = useState(1);
  const [movsRowsPerPage] = useState(5);
  const [movsSearch] = useState("");

  useEffect(() => {
    if (!expedienteId) return;
    getViajerosByExpediente(expedienteId)
      .then(setViajeros)
      .catch((err) => console.error("useCobros: error fetching viajeros:", err));
    getMatchesPendientesPorExpediente(expedienteId)
      .then((matches) =>
        setMatchesCobros((matches || []).filter((m: any) => Number(m.importe) > 0))
      )
      .catch(() => {});
  }, [expedienteId]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const toggleExpandPagador = (id: string) => {
    setExpandedPagadores((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setCurrentPage(1);
  };

  const togglePlazoFilter = (id: string) => {
    setActivePlazoFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setCurrentPage(1);
  };

  const clearPlazoFilters = () => {
    setActivePlazoFilters([]);
    setCurrentPage(1);
  };

  const handleRowsPerPageChange = (r: number) => {
    setRowsPerPage(r);
    setCurrentPage(1);
  };

  const viajerosByPagador = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const v of viajeros) {
      if (v.pagador_id) {
        if (!map.has(v.pagador_id)) map.set(v.pagador_id, []);
        map.get(v.pagador_id)!.push(v);
      }
    }
    return map;
  }, [viajeros]);

  const paymentPlazosList = useMemo(() => {
    return (plazos || []).filter((p: any) => !p.tipo || p.tipo === "pago");
  }, [plazos]);

  const plazoFilterOptions = useMemo(() => {
    const options: Array<{ id: string; plazoIndex: number; status: string; label: string; color: string }> = [];
    paymentPlazosList.forEach((p: any, idx: number) => {
      const desc = p.descripcion || `Plazo ${idx + 1}`;
      options.push(
        { id: `${idx}-green`, plazoIndex: idx, status: "green", label: `${desc} (Abonado)`, color: "#22c55e" },
        { id: `${idx}-orange`, plazoIndex: idx, status: "orange", label: `${desc} (Parcial)`, color: "#f97316" },
        { id: `${idx}-gray`, plazoIndex: idx, status: "gray", label: `${desc} (Pendiente)`, color: "#94a3b8" }
      );
    });
    return options;
  }, [paymentPlazosList]);

  const plazoFiltersGrouped = useMemo(() => {
    const groups: Record<number, string[]> = {};
    activePlazoFilters.forEach((fid) => {
      const option = plazoFilterOptions.find((o) => o.id === fid);
      if (option) {
        if (!groups[option.plazoIndex]) groups[option.plazoIndex] = [];
        groups[option.plazoIndex].push(option.status);
      }
    });
    return groups;
  }, [activePlazoFilters, plazoFilterOptions]);

  const filteredData = useMemo(() => {
    return pagadores.filter((item) => {
      const term = search.toLowerCase();
      const myViajeros = viajerosByPagador.get(item.entidad_id) || [];
      const matchesSearch =
        (item.contabilidad_entidades?.nombre || "").toLowerCase().includes(term) ||
        (item.contabilidad_entidades?.documento || "").toLowerCase().includes(term) ||
        myViajeros.some((v) => (v.contabilidad_entidades?.nombre || "").toLowerCase().includes(term));
      if (!matchesSearch) return false;

      for (const [pIdxStr, statuses] of Object.entries(plazoFiltersGrouped)) {
        if (!statuses.includes(getPlazoDetail(item, plazos, Number(pIdxStr)).color)) return false;
      }
      return true;
    });
  }, [pagadores, search, viajerosByPagador, plazoFiltersGrouped, plazos]);

  const sortedData = useMemo(() => {
    const data = [...filteredData];
    if (!sortKey) return data;

    data.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortKey) {
        case "cliente":
          valA = (a.contabilidad_entidades?.nombre || "").toLowerCase();
          valB = (b.contabilidad_entidades?.nombre || "").toLowerCase();
          break;
        case "cif_nif":
          valA = (a.contabilidad_entidades?.documento || "").toLowerCase();
          valB = (b.contabilidad_entidades?.documento || "").toLowerCase();
          break;
        case "viajeros":
          valA = (viajerosByPagador.get(a.entidad_id) || []).length;
          valB = (viajerosByPagador.get(b.entidad_id) || []).length;
          break;
        case "total":
          valA = Number(a.importe_total || 0);
          valB = Number(b.importe_total || 0);
          break;
        case "abonado":
          valA = Number(a.importe_abonado || 0);
          valB = Number(b.importe_abonado || 0);
          break;
        case "saldo":
          valA = Number(a.importe_total || 0) - Number(a.importe_abonado || 0);
          valB = Number(b.importe_total || 0) - Number(b.importe_abonado || 0);
          break;
        case "plazos":
          valA = getPaymentPlazos(a, plazos).length;
          valB = getPaymentPlazos(b, plazos).length;
          break;
        case "estado":
          valA = (a.estado || "").toLowerCase();
          valB = (b.estado || "").toLowerCase();
          break;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === "asc"
        ? valA > valB ? 1 : valA < valB ? -1 : 0
        : valA < valB ? 1 : valA > valB ? -1 : 0;
    });

    return data;
  }, [filteredData, sortKey, sortDirection, viajerosByPagador, plazos]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const filteredMovs = useMemo(() => {
    const term = movsSearch.toLowerCase();
    return movimientos.filter(
      (item) =>
        (item.entidad_nombre || "").toLowerCase().includes(term) ||
        (item.concepto || "").toLowerCase().includes(term) ||
        (item.medio_pago || "").toLowerCase().includes(term) ||
        (item.viajeros || []).some((v) => (v.viajero_nombre || "").toLowerCase().includes(term))
    );
  }, [movimientos, movsSearch]);

  const paginatedMovs = useMemo(() => {
    const start = (movsCurrentPage - 1) * movsRowsPerPage;
    return filteredMovs.slice(start, start + movsRowsPerPage);
  }, [filteredMovs, movsCurrentPage, movsRowsPerPage]);

  return {
    viajeros,
    expandedPagadores,
    toggleExpandPagador,
    isAddModalOpen,
    setIsAddModalOpen,
    search,
    handleSearchChange,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    handleRowsPerPageChange,
    isFilterRowOpen,
    setIsFilterRowOpen,
    openDropdown,
    setOpenDropdown,
    activePlazoFilters,
    togglePlazoFilter,
    clearPlazoFilters,
    matchesCobros,
    sortKey,
    sortDirection,
    handleSort,
    viajerosByPagador,
    paymentPlazosList,
    filteredData,
    paginatedData,
    paginatedMovs,
  };
}
