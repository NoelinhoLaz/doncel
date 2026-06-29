"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getFacturasEmitidasByExpediente, type FacturaEmitida } from "@/actions/facturacion";

export function useFacturacion(expedienteId: string) {
  const [facturas, setFacturas] = useState<FacturaEmitida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getFacturasEmitidasByExpediente(expedienteId);
    setFacturas(data);
    setLoading(false);
  }, [expedienteId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredFacturas = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return facturas;
    return facturas.filter(
      (f) =>
        f.numero_factura.toLowerCase().includes(term) ||
        f.cliente_nombre.toLowerCase().includes(term) ||
        f.cliente_nif.toLowerCase().includes(term)
    );
  }, [facturas, search]);

  const paginatedFacturas = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredFacturas.slice(start, start + rowsPerPage);
  }, [filteredFacturas, currentPage, rowsPerPage]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setCurrentPage(1);
  };

  const handleRowsPerPageChange = (r: number) => {
    setRowsPerPage(r);
    setCurrentPage(1);
  };

  return {
    facturas,
    loading,
    load,
    filteredFacturas,
    paginatedFacturas,
    search,
    handleSearchChange,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    handleRowsPerPageChange,
  };
}
