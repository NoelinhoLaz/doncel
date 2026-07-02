"use client";

import styles from "../page.module.css";
import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import Pagination from "@/app/components/Pagination";

type Viajero = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  pasaporte: string | null;
  nacionalidad: string | null;
};

export default function ViajerosPage() {
  const [viajeros, setViajeros] = useState<Viajero[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    fetch("/api/contactos/viajeros")
      .then((r) => r.json())
      .then((j) => { if (j?.success) setViajeros(j.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = viajeros.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.nombre?.toLowerCase().includes(q) ||
      v.apellidos?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };

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
      </div>

      {loading ? (
        <div className={styles.emptyState}>Cargando…</div>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Apellidos</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Pasaporte</th>
                <th>Nacionalidad</th>
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
                    <td>{v.nombre}</td>
                    <td>{v.apellidos ?? "—"}</td>
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
