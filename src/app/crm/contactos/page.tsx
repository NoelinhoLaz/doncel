"use client";

import styles from "./page.module.css";
import { Search, X, Building2, Megaphone, SlidersHorizontal } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import Pagination from "@/app/components/Pagination";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import { PanelEntidad } from "@/app/campanas/[id]/panels/PanelEntidad";
import NuevaDifusionModal from "@/components/modals/NuevaDifusionModal";
import type { EntidadDestinatarios } from "@/actions/difusiones";
import { SortableTh, sortToggle, compareValues, type SortState } from "@/app/components/SortableTh";
import { getCurrentUsuario } from "@/actions/usuarios";

type SortKey = "nombre" | "cargo" | "email" | "entidad_nombre" | "sucursal";

type Contacto = {
  id: string;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  es_principal: boolean;
  metadatos: any;
  entidad_id: string | null;
  entidad_nombre: string | null;
  agente_id: string | null;
  agente: { id: string; nombre: string; apellidos: string; avatar_url?: string | null } | null;
  sucursal: string | null;
};

function agenteNombre(a: Contacto["agente"]) {
  if (!a) return null;
  return `${a.nombre} ${a.apellidos ?? ""}`.trim();
}

function ContactoModal({ contacto, onClose, onVerEntidad }: { contacto: Contacto; onClose: () => void; onVerEntidad: (entidadId: string) => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{contacto.nombre}</span>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {contacto.es_principal && <span className={styles.badge}>Contacto principal</span>}

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Cargo</span>
            {contacto.cargo ? <span className={styles.fieldValue}>{contacto.cargo}</span> : <span className={styles.fieldValueEmpty}>Sin especificar</span>}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            {contacto.email ? (
              <a href={`mailto:${contacto.email}`} className={styles.entidadLink}>{contacto.email}</a>
            ) : <span className={styles.fieldValueEmpty}>Sin especificar</span>}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Teléfono</span>
            {contacto.telefono ? (
              <a href={`tel:${contacto.telefono}`} className={styles.entidadLink}>{contacto.telefono}</a>
            ) : <span className={styles.fieldValueEmpty}>Sin especificar</span>}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Cliente / Centro</span>
            {contacto.entidad_id && contacto.entidad_nombre ? (
              <span
                className={styles.entidadLink}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                onClick={() => onVerEntidad(contacto.entidad_id!)}
              >
                <Building2 size={13} /> {contacto.entidad_nombre}
              </span>
            ) : <span className={styles.fieldValueEmpty}>Sin vincular</span>}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Agente</span>
            {contacto.agente ? <span className={styles.fieldValue}>{agenteNombre(contacto.agente)}</span> : <span className={styles.fieldValueEmpty}>Sin asignar</span>}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Sucursal</span>
            {contacto.sucursal ? <span className={styles.fieldValue}>{contacto.sucursal}</span> : <span className={styles.fieldValueEmpty}>Sin especificar</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactosCrmPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [sucursalFilter, setSucursalFilter] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [contactoSeleccionado, setContactoSeleccionado] = useState<Contacto | null>(null);
  const [entidadPanelId, setEntidadPanelId] = useState<string | null>(null);
  const [showDifusionModal, setShowDifusionModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortState<SortKey>>(null);

  function cargarContactos() {
    setLoading(true);
    fetch("/api/crm/contactos/listado")
      .then((r) => r.json())
      .then((j) => { if (j?.success) setContactos(j.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargarContactos();
    getCurrentUsuario()
      .then((u: any) => {
        if (u) {
          const nombreCompleto = `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim();
          if (nombreCompleto) {
            setAgenteFilter([nombreCompleto]);
          }
        }
      })
      .catch(() => {});
  }, []);

  const agenteOptions = useMemo(() => {
    const labels = new Set<string>();
    contactos.forEach((c) => { const n = agenteNombre(c.agente); if (n) labels.add(n); });
    agenteFilter.forEach((af) => { if (af) labels.add(af); });
    return Array.from(labels).sort();
  }, [contactos, agenteFilter]);

  const sucursalOptions = useMemo(() => {
    const labels = new Set<string>();
    contactos.forEach((c) => { if (c.sucursal) labels.add(c.sucursal); });
    return Array.from(labels).sort();
  }, [contactos]);

  const filtered = contactos.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.nombre?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.entidad_nombre?.toLowerCase().includes(q) ||
      c.cargo?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (agenteFilter.length > 0 && !(agenteNombre(c.agente) && agenteFilter.includes(agenteNombre(c.agente)!))) return false;
    if (sucursalFilter.length > 0 && !(c.sucursal && sucursalFilter.includes(c.sucursal))) return false;
    return true;
  });

  const sorted = sort
    ? [...filtered].sort((a, b) => {
        const cmp = compareValues(a[sort.key], b[sort.key]);
        return sort.direction === "asc" ? cmp : -cmp;
      })
    : filtered;

  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const entidadesParaDifusion: EntidadDestinatarios[] = (() => {
    const porEntidad = new Map<string, EntidadDestinatarios>();
    for (const c of filtered) {
      if (!c.email) continue;
      const key = c.entidad_id ?? `sin-entidad-${c.id}`;
      const ent = porEntidad.get(key) ?? { entidad_id: key, nombre: c.entidad_nombre ?? c.nombre, emails: [] };
      ent.emails.push({ email: c.email, etiqueta: c.nombre, principal: c.es_principal, tipo: "contacto" });
      porEntidad.set(key, ent);
    }
    return Array.from(porEntidad.values());
  })();

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };
  const handleAgenteFilter = (v: string[]) => { setAgenteFilter(v); setCurrentPage(1); };
  const handleSucursalFilter = (v: string[]) => { setSucursalFilter(v); setCurrentPage(1); };
  const totalFiltrosActivos = agenteFilter.length + sucursalFilter.length;
  const handleSort = (key: SortKey) => { setSort((prev) => sortToggle(prev, key)); setCurrentPage(1); };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Responsables</h1>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>Listado de responsables ({filtered.length})</span>
          <div className={styles.tableHeaderActions}>
            <div className={styles.searchBar}>
              <Search size={16} />
              <input
                placeholder="Buscar contactos…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={`${styles.filterIconBtn} ${showFilters || totalFiltrosActivos > 0 ? styles.filterIconBtnActive : ""}`}
              onClick={() => setShowFilters((v) => !v)}
              title="Filtros"
            >
              <SlidersHorizontal size={16} />
              {totalFiltrosActivos > 0 && <span className={styles.filterBadge}>{totalFiltrosActivos}</span>}
            </button>
            <button
              type="button"
              className={styles.filterIconBtn}
              onClick={() => setShowDifusionModal(true)}
              title="Crear difusión con los contactos filtrados"
            >
              <Megaphone size={16} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className={styles.filtersRow}>
            <div style={{ width: 200, flexShrink: 0 }}>
              <MultiSelectDropdown
                options={agenteOptions}
                selected={agenteFilter}
                onChange={handleAgenteFilter}
                placeholder="Todos los agentes"
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
          </div>
        )}

        {loading ? (
          <div className={styles.emptyState}>Cargando…</div>
        ) : (
          <table className={styles.table} style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <SortableTh label="Nombre" sortKey="nombre" sort={sort} onSort={handleSort} />
                <SortableTh label="Cargo" sortKey="cargo" sort={sort} onSort={handleSort} />
                <SortableTh label="Email" sortKey="email" sort={sort} onSort={handleSort} />
                <SortableTh label="Cliente / Centro" sortKey="entidad_nombre" sort={sort} onSort={handleSort} />
                <SortableTh label="Sucursal" sortKey="sucursal" sort={sort} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>No hay contactos</td>
                </tr>
              ) : (
                paginated.map((c) => (
                  <tr key={c.id} onClick={() => setContactoSeleccionado(c)} style={{ cursor: "pointer" }}>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</td>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.cargo ?? "—"}</td>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email ?? "—"}</td>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.entidad_nombre ?? "—"}</td>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.sucursal ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ padding: 0 }}>
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
        )}
      </div>

      {contactoSeleccionado && (
        <ContactoModal
          contacto={contactoSeleccionado}
          onClose={() => setContactoSeleccionado(null)}
          onVerEntidad={(entidadId) => { setContactoSeleccionado(null); setEntidadPanelId(entidadId); }}
        />
      )}

      {entidadPanelId && (() => {
        const c = contactos.find((x) => x.entidad_id === entidadPanelId);
        if (!c) return null;
        return (
          <PanelEntidad
            data={{ entidad: { id: c.entidad_id, nombre: c.entidad_nombre, crm_agentes: c.agente ?? null } as any }}
            onClose={() => setEntidadPanelId(null)}
          />
        );
      })()}

      {showDifusionModal && (
        <NuevaDifusionModal
          initialEntidades={entidadesParaDifusion}
          onClose={() => setShowDifusionModal(false)}
          onCreated={() => setShowDifusionModal(false)}
        />
      )}
    </div>
  );
}
