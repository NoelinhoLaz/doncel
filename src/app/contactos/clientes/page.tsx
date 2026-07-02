"use client";

import styles from "../page.module.css";
import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import Pagination from "@/app/components/Pagination";

type Cliente = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  pais: string | null;
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    fetch("/api/contactos/clientes")
      .then((r) => r.json())
      .then((j) => { if (j?.success) setClientes(j.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.nombre?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.ciudad?.toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Clientes</h1>
        <div className={styles.searchBar}>
          <Search size={16} />
          <input
            placeholder="Buscar clientes…"
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
                <th>Email</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th>País</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>No hay clientes</td>
                </tr>
              ) : (
                paginated.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>{c.email ?? "—"}</td>
                    <td>{c.telefono ?? "—"}</td>
                    <td>{c.ciudad ?? "—"}</td>
                    <td>{c.pais ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ padding: 0 }}>
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
