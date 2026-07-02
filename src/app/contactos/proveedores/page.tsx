"use client";

import styles from "../page.module.css";
import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import Pagination from "@/app/components/Pagination";

type Proveedor = {
  id: string;
  nombre: string;
  tipo: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  pais: string | null;
};

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    fetch("/api/contactos/proveedores")
      .then((r) => r.json())
      .then((j) => { if (j?.success) setProveedores(j.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = proveedores.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nombre?.toLowerCase().includes(q) ||
      p.tipo?.toLowerCase().includes(q) ||
      p.ciudad?.toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };

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
      </div>

      {loading ? (
        <div className={styles.emptyState}>Cargando…</div>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th>País</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>No hay proveedores</td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nombre}</td>
                    <td>{p.tipo ?? "—"}</td>
                    <td>{p.email ?? "—"}</td>
                    <td>{p.telefono ?? "—"}</td>
                    <td>{p.ciudad ?? "—"}</td>
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
                    totalItems={filtered.length}
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
