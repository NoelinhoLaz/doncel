"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getLibroDiario, getCuentasContables, getEjerciciosDisponibles } from "@/actions/libroDiario";

export type Filtros = {
  ejercicio: string | number;
  cuentaId: string;
  fechaDesde: string;
  fechaHasta: string;
};

export function useLibroDiario() {
  const [asientos, setAsientos] = useState<any[]>([]);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [cuentasContables, setCuentasContables] = useState<any[]>([]);
  const [ejercicios, setEjercicios] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"asiento" | "apunte">("apunte");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtros, setFiltros] = useState<Filtros>({
    ejercicio: "", cuentaId: "", fechaDesde: "", fechaHasta: "",
  });

  const searchParams = useSearchParams();

  useEffect(() => {
    const v = searchParams?.get("search");
    if (v) { setSearchInput(v); setSearchQuery(v); setCurrentPage(1); }
  }, [searchParams]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const [accounts, years] = await Promise.all([getCuentasContables(), getEjerciciosDisponibles()]);
        setCuentasContables(accounts || []);
        setEjercicios(years || []);
        if (years?.length > 0) setFiltros(prev => ({ ...prev, ejercicio: years[0] }));
      } catch { /* silent */ }
    }
    loadConfig();
  }, []);

  const loadData = useCallback(async (f: Filtros) => {
    setLoading(true);
    try {
      const result = await getLibroDiario({
        page: currentPage, limit: rowsPerPage, search: searchQuery,
        cuentaId: f.cuentaId || undefined,
        ejercicio: f.ejercicio ? Number(f.ejercicio) : undefined,
        fechaDesde: f.fechaDesde || undefined,
        fechaHasta: f.fechaHasta || undefined,
        vista,
      });
      setAsientos(result.data || []);
      setPendientes(result.pendientes || []);
      setTotalItems(result.count || 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [currentPage, rowsPerPage, searchQuery, vista]);

  useEffect(() => { loadData(filtros); }, [loadData, filtros]);
  useEffect(() => { setCurrentPage(1); }, [vista]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      const v = searchInput.trim();
      if (v.length >= 3) { setSearchQuery(v); setCurrentPage(1); }
      else if (v === "") { setSearchQuery(""); setCurrentPage(1); }
    }, 1500);
    return () => clearTimeout(t);
  }, [searchInput]);

  const updateFiltro = <K extends keyof Filtros>(key: K, value: Filtros[K]) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const resetFiltros = () => {
    setFiltros({ ejercicio: ejercicios.length > 0 ? ejercicios[0] : "", cuentaId: "", fechaDesde: "", fechaHasta: "" });
    setSearchInput(""); setSearchQuery(""); setCurrentPage(1);
  };

  const apuntesPlanos = useMemo(() => {
    if (vista === "apunte") return pendientes;
    const list = [
      ...(asientos || []).flatMap(a =>
        (a.contabilidad_apuntes || []).map((ap: any) => ({
          ...ap, asientoNumero: a.numero, asientoFecha: a.fecha,
          asientoEstado: a.estado, asientoConcepto: a.concepto,
        }))
      ),
      ...(pendientes || []).map((ap: any) => ({
        ...ap, asientoNumero: null, asientoFecha: ap.fecha,
        asientoEstado: null, asientoConcepto: null,
      })),
    ];
    list.sort((a, b) => {
      const dA = a.asientoFecha ? new Date(a.asientoFecha).getTime() : 0;
      const dB = b.asientoFecha ? new Date(b.asientoFecha).getTime() : 0;
      if (dB !== dA) return dB - dA;
      return (b.created_at ? new Date(b.created_at).getTime() : 0) -
             (a.created_at ? new Date(a.created_at).getTime() : 0);
    });
    return list;
  }, [asientos, pendientes, vista]);

  return {
    asientos, pendientes, cuentasContables, ejercicios, loading,
    vista, setVista,
    currentPage, setCurrentPage,
    rowsPerPage, setRowsPerPage: (r: number) => { setRowsPerPage(r); setCurrentPage(1); },
    totalItems, searchInput, setSearchInput,
    filtros, updateFiltro, resetFiltros, apuntesPlanos,
  };
}
