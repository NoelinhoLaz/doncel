"use client";

import styles from "../page.module.css";
import { Search, Plus } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import Pagination from "@/app/components/Pagination";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import { NuevoClientePanel } from "@/components/modals/NuevoClientePanel";
import { PanelEntidad } from "@/app/campanas/[id]/panels/PanelEntidad";

type Cliente = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  pais: string | null;
  sucursal: string | null;
  expedientes: { id: string; numero: string | null; referencia: string }[];
  tipo_entidad?: string | null;
  tipo_cliente_id?: string | null;
  tipo_cliente?: { id: string; etiqueta: string } | null;
  direccion?: any;
  otros_tlfs?: string[] | null;
  otros_emails?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  agente_id?: string | null;
  agente?: { id: string; nombre: string; apellidos: string; avatar_url?: string | null } | null;
  documento?: string | null;
  fecha_nacimiento?: string | null;
  created_at?: string | null;
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [expedienteFilter, setExpedienteFilter] = useState<string[]>([]);
  const [sucursalFilter, setSucursalFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [entidadPanel, setEntidadPanel] = useState<Cliente | null>(null);

  function cargarClientes() {
    setLoading(true);
    fetch("/api/contactos/clientes")
      .then((r) => r.json())
      .then((j) => { if (j?.success) setClientes(j.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargarClientes(); }, []);

  const expedienteLabel = (e: { numero: string | null; referencia: string }) =>
    e.numero ? `${e.numero} · ${e.referencia}` : e.referencia;

  const expedienteOptions = useMemo(() => {
    const labels = new Set<string>();
    clientes.forEach((c) => c.expedientes.forEach((e) => labels.add(expedienteLabel(e))));
    return Array.from(labels).sort();
  }, [clientes]);

  const sucursalOptions = useMemo(() => {
    const labels = new Set<string>();
    clientes.forEach((c) => { if (c.sucursal) labels.add(c.sucursal); });
    return Array.from(labels).sort();
  }, [clientes]);

  const tipoClienteOptions = useMemo(() => {
    const labels = new Set<string>();
    clientes.forEach((c) => { if (c.tipo_cliente?.etiqueta) labels.add(c.tipo_cliente.etiqueta); });
    return Array.from(labels).sort();
  }, [clientes]);

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.nombre?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.ciudad?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (expedienteFilter.length > 0 && !c.expedientes.some((e) => expedienteFilter.includes(expedienteLabel(e)))) return false;
    if (sucursalFilter.length > 0 && !(c.sucursal && sucursalFilter.includes(c.sucursal))) return false;
    if (tipoFilter.length > 0 && !(c.tipo_cliente?.etiqueta && tipoFilter.includes(c.tipo_cliente.etiqueta))) return false;
    return true;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };
  const handleExpedienteFilter = (v: string[]) => { setExpedienteFilter(v); setCurrentPage(1); };
  const handleSucursalFilter = (v: string[]) => { setSucursalFilter(v); setCurrentPage(1); };
  const handleTipoFilter = (v: string[]) => { setTipoFilter(v); setCurrentPage(1); };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Clientes</h1>
        <div className={styles.searchBar} style={{ width: "auto", flex: 1 }}>
          <Search size={16} />
          <input
            placeholder="Buscar clientes…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div style={{ width: 220, flexShrink: 0 }}>
          <MultiSelectDropdown
            options={expedienteOptions}
            selected={expedienteFilter}
            onChange={handleExpedienteFilter}
            placeholder="Todos los expedientes"
          />
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>
          <MultiSelectDropdown
            options={sucursalOptions}
            selected={sucursalFilter}
            onChange={handleSucursalFilter}
            placeholder="Todas las sucursales"
          />
        </div>
        <div style={{ width: 180, flexShrink: 0 }}>
          <MultiSelectDropdown
            options={tipoClienteOptions}
            selected={tipoFilter}
            onChange={handleTipoFilter}
            placeholder="Todos los tipos"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowNuevoCliente(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", borderRadius: 8, border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      {showNuevoCliente && (
        <NuevoClientePanel
          onClose={() => setShowNuevoCliente(false)}
          onCreated={() => { setShowNuevoCliente(false); cargarClientes(); }}
        />
      )}

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
                <th>Agencia</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>No hay clientes</td>
                </tr>
              ) : (
                paginated.map((c) => (
                  <tr key={c.id} onClick={() => setEntidadPanel(c)} style={{ cursor: "pointer" }}>
                    <td>{c.nombre?.toUpperCase()}</td>
                    <td>{c.email ?? "—"}</td>
                    <td>{c.telefono ?? "—"}</td>
                    <td>{c.ciudad?.toUpperCase() ?? "—"}</td>
                    <td>{c.sucursal ?? "—"}</td>
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

      {entidadPanel && (
        <PanelEntidad
          data={{ entidad: { ...entidadPanel, crm_agentes: entidadPanel.agente ?? null } as any }}
          onClose={() => setEntidadPanel(null)}
          onEntidadUpdated={(entidadActualizada) => {
            setEntidadPanel((p) => (p ? { ...p, ...entidadActualizada } : p));
            setClientes((prev) => prev.map((c) => (c.id === entidadActualizada.id ? { ...c, ...entidadActualizada } : c)));
          }}
        />
      )}
    </div>
  );
}
