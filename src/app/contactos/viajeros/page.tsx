"use client";

import styles from "../page.module.css";
import { Search } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import Pagination from "@/app/components/Pagination";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import { SortableTh, sortToggle, compareValues, type SortState } from "@/app/components/SortableTh";

type SortKey = "nombre" | "apellidos" | "email" | "telefono" | "pasaporte" | "nacionalidad";

type Viajero = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  pasaporte: string | null;
  nacionalidad: string | null;
  expedientes: { id: string; numero: string | null; referencia: string }[];
};

export default function ViajerosPage() {
  const [viajeros, setViajeros] = useState<Viajero[]>([]);
  const [search, setSearch] = useState("");
  const [expedienteFilter, setExpedienteFilter] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [sort, setSort] = useState<SortState<SortKey>>(null);

  useEffect(() => {
    fetch("/api/contactos/viajeros")
      .then((r) => r.json())
      .then((j) => { if (j?.success) setViajeros(j.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const expedienteLabel = (e: { numero: string | null; referencia: string }) =>
    e.numero ? `${e.numero} · ${e.referencia}` : e.referencia;

  const expedienteOptions = useMemo(() => {
    const labels = new Set<string>();
    viajeros.forEach((v) => v.expedientes.forEach((e) => labels.add(expedienteLabel(e))));
    return Array.from(labels).sort();
  }, [viajeros]);

  const filtered = viajeros.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      v.nombre?.toLowerCase().includes(q) ||
      v.apellidos?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (expedienteFilter.length > 0 && !v.expedientes.some((e) => expedienteFilter.includes(expedienteLabel(e)))) return false;
    return true;
  });

  const sorted = sort
    ? [...filtered].sort((a, b) => {
        const cmp = compareValues(a[sort.key], b[sort.key]);
        return sort.direction === "asc" ? cmp : -cmp;
      })
    : filtered;

  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };
  const handleExpedienteFilter = (v: string[]) => { setExpedienteFilter(v); setCurrentPage(1); };
  const handleSort = (key: SortKey) => { setSort((prev) => sortToggle(prev, key)); setCurrentPage(1); };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Viajeros</h1>
        <div className={styles.searchBar}>
          <Search size={16} />
          <input
            placeholder="Buscar viajeros…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <MultiSelectDropdown
          options={expedienteOptions}
          selected={expedienteFilter}
          onChange={handleExpedienteFilter}
          placeholder="Todos los expedientes"
        />
      </div>

      {loading ? (
        <div className={styles.emptyState}>Cargando…</div>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <SortableTh label="Nombre" sortKey="nombre" sort={sort} onSort={handleSort} />
                <SortableTh label="Apellidos" sortKey="apellidos" sort={sort} onSort={handleSort} />
                <SortableTh label="Email" sortKey="email" sort={sort} onSort={handleSort} />
                <SortableTh label="Teléfono" sortKey="telefono" sort={sort} onSort={handleSort} />
                <SortableTh label="Pasaporte" sortKey="pasaporte" sort={sort} onSort={handleSort} />
                <SortableTh label="Nacionalidad" sortKey="nacionalidad" sort={sort} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>No hay viajeros</td>
                </tr>
              ) : (
                paginated.map((v) => (
                  <tr key={v.id}>
                    <td>{v.nombre?.toUpperCase()}</td>
                    <td>{v.apellidos?.toUpperCase() ?? "—"}</td>
                    <td>{v.email ?? "—"}</td>
                    <td>{v.telefono ?? "—"}</td>
                    <td>{v.pasaporte ?? "—"}</td>
                    <td>{v.nacionalidad ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  <Pagination
                    currentPage={currentPage}
                    totalItems={sorted.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}
