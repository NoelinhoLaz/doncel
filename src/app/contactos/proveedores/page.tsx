"use client";

import styles from "../page.module.css";
import { Search } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import Pagination from "@/app/components/Pagination";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import { PanelProveedor, type ProveedorDetalle } from "@/components/panels/PanelProveedor";
import { SortableTh, sortToggle, compareValues, type SortState } from "@/app/components/SortableTh";

type SortKey = "nombre" | "tipo" | "email" | "telefono" | "ciudad" | "pais";

type Proveedor = ProveedorDetalle & {
  nombre: string;
  ciudad: string | null;
  pais: string | null;
  expedientes: { id: string; numero: string | null; referencia: string }[];
};

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [search, setSearch] = useState("");
  const [expedienteFilter, setExpedienteFilter] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [proveedorPanel, setProveedorPanel] = useState<Proveedor | null>(null);
  const [sort, setSort] = useState<SortState<SortKey>>(null);

  useEffect(() => {
    fetch("/api/contactos/proveedores")
      .then((r) => r.json())
      .then((j) => { if (j?.success) setProveedores(j.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const expedienteLabel = (e: { numero: string | null; referencia: string }) =>
    e.numero ? `${e.numero} · ${e.referencia}` : e.referencia;

  const expedienteOptions = useMemo(() => {
    const labels = new Set<string>();
    proveedores.forEach((p) => p.expedientes.forEach((e) => labels.add(expedienteLabel(e))));
    return Array.from(labels).sort();
  }, [proveedores]);

  const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const filtered = proveedores.filter((p) => {
    const q = normalizar(search.trim());
    if (q.length >= 3) {
      const matchesSearch =
        (p.nombre && normalizar(p.nombre).includes(q)) ||
        (p.tipo && normalizar(p.tipo).includes(q)) ||
        (p.ciudad && normalizar(p.ciudad).includes(q));
      if (!matchesSearch) return false;
    }
    if (expedienteFilter.length > 0 && !p.expedientes.some((e) => expedienteFilter.includes(expedienteLabel(e)))) return false;
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
        <h1 className={styles.title}>Proveedores</h1>
        <div className={styles.searchBar}>
          <Search size={16} />
          <input
            placeholder="Buscar proveedores…"
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
                <SortableTh label="Tipo" sortKey="tipo" sort={sort} onSort={handleSort} />
                <SortableTh label="Email" sortKey="email" sort={sort} onSort={handleSort} />
                <SortableTh label="Teléfono" sortKey="telefono" sort={sort} onSort={handleSort} />
                <SortableTh label="Ciudad" sortKey="ciudad" sort={sort} onSort={handleSort} />
                <SortableTh label="País" sortKey="pais" sort={sort} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>No hay proveedores</td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <tr key={p.id} onClick={() => setProveedorPanel(p)} style={{ cursor: "pointer" }}>
                    <td>{p.nombre?.toUpperCase()}</td>
                    <td>{p.tipo ?? "—"}</td>
                    <td>{p.email ?? "—"}</td>
                    <td>{p.telefono ?? "—"}</td>
                    <td>{p.ciudad?.toUpperCase() ?? "—"}</td>
                    <td>{p.pais ?? "—"}</td>
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

      {proveedorPanel && (
        <PanelProveedor
          proveedor={proveedorPanel}
          onClose={() => setProveedorPanel(null)}
        />
      )}
    </div>
  );
}
