"use client";

import styles from "../page.module.css";
import { Search, Plus, SlidersHorizontal, Tag, Megaphone, IdCard } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Pagination from "@/app/components/Pagination";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import SucursalAgenteFilter, { type AgenteOpcion } from "@/app/components/SucursalAgenteFilter";
import { NuevoClientePanel } from "@/components/modals/NuevoClientePanel";
import AsignarEtiquetaMasivaModal from "@/components/modals/AsignarEtiquetaMasivaModal";
import ReasignarAgenteMasivoModal from "@/components/modals/ReasignarAgenteMasivoModal";
import NuevaDifusionModal from "@/components/modals/NuevaDifusionModal";
import type { EntidadDestinatarios } from "@/actions/difusiones";
import { getCurrentAgentePublic } from "@/actions/crm";
import { PanelEntidad } from "@/app/campanas/[id]/panels/PanelEntidad";
import { SortableTh, sortToggle, compareValues, type SortState } from "@/app/components/SortableTh";
import TipClientesCard from "./TipClientesCard";

type SortKey = "nombre" | "email" | "telefono" | "ciudad" | "tipo" | "agente";

type Cliente = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  pais: string | null;
  sucursal: string | null;
  expedientes: { id: string; numero: string | null; referencia: string; fecha_inicio: string | null }[];
  tipo_entidad?: string | null;
  tipo_cliente_id?: string | null;
  tipo_cliente?: { id: string; etiqueta: string } | null;
  etiquetas?: { id: string; nombre: string; color: string }[];
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [expedienteFilter, setExpedienteFilter] = useState<string[]>([]);
  const [sucursalFilter, setSucursalFilter] = useState<string[]>([]);
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [etiquetaFilter, setEtiquetaFilter] = useState<string[]>([]);
  const [localidadFilter, setLocalidadFilter] = useState<string[]>([]);
  const [filtroEspecial, setFiltroEspecial] = useState<{ tipo: "email_ausente" | "telefono_ausente" | "etiqueta_ausente" | "localidad" | "localidad_ausente" | "etiqueta" | "inactivo_2_3" | "inactivo_5_mas"; valor?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showEtiquetaMasiva, setShowEtiquetaMasiva] = useState(false);
  const [showDifusionModal, setShowDifusionModal] = useState(false);
  const [showReasignarAgente, setShowReasignarAgente] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [entidadPanel, setEntidadPanel] = useState<Cliente | null>(null);
  const [sort, setSort] = useState<SortState<SortKey>>(null);

  function cargarClientes() {
    setLoading(true);
    fetch("/api/contactos/clientes", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j?.success) setClientes(j.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargarClientes(); }, []);

  // Deep-link: si llegamos con ?clienteId=, abre directamente el panel de ese
  // cliente en cuanto termine de cargar el listado (p.ej. desde "Usar este"
  // en NuevoClientePanel al detectar un cliente duplicado por DNI/CIF).
  useEffect(() => {
    if (loading || clientes.length === 0) return;
    const clienteId = searchParams.get("clienteId");
    if (!clienteId) return;
    const match = clientes.find((c) => c.id === clienteId);
    if (match) {
      setEntidadPanel(match);
      router.replace("/contactos/clientes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, clientes]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d?.success && d.data?.usuarioId) setAgenteFilter([d.data.usuarioId]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getCurrentAgentePublic()
      .then(({ rol }) => setIsOwner(rol === "Owner"))
      .catch(() => {});
  }, []);

  const TIPO_COLORES: Record<string, { bg: string; color: string }> = {
    Persona: { bg: "#dbeafe", color: "#2563eb" },
    Empresa: { bg: "#fef3c7", color: "#b45309" },
    Grupo: { bg: "#dcfce7", color: "#16a34a" },
  };
  const colorTipo = (etiqueta?: string | null) => (etiqueta && TIPO_COLORES[etiqueta]) || { bg: "#f1f5f9", color: "#64748b" };

  const expedienteLabel = (e: { numero: string | null; referencia: string }) =>
    e.numero ? `${e.numero} · ${e.referencia}` : e.referencia;

  const expedienteOptions = useMemo(() => {
    const labels = new Set<string>();
    clientes.forEach((c) => c.expedientes.forEach((e) => labels.add(expedienteLabel(e))));
    return Array.from(labels).sort();
  }, [clientes]);

  const agenteOptions = useMemo(() => {
    const porId = new Map<string, AgenteOpcion>();
    clientes.forEach((c) => {
      if (!c.agente?.id) return;
      if (porId.has(c.agente.id)) return;
      porId.set(c.agente.id, {
        id: c.agente.id,
        nombre: `${c.agente.nombre} ${c.agente.apellidos ?? ""}`.trim(),
        sucursal: c.sucursal ?? null,
      });
    });
    return Array.from(porId.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes]);

  const tipoClienteOptions = useMemo(() => {
    const labels = new Set<string>();
    clientes.forEach((c) => { if (c.tipo_cliente?.etiqueta) labels.add(c.tipo_cliente.etiqueta); });
    return Array.from(labels).sort();
  }, [clientes]);

  const etiquetaOptions = useMemo(() => {
    const labels = new Set<string>();
    clientes.forEach((c) => c.etiquetas?.forEach((e) => labels.add(e.nombre)));
    return Array.from(labels).sort();
  }, [clientes]);

  const localidadOptions = useMemo(() => {
    const labels = new Set<string>();
    clientes.forEach((c) => { if (c.ciudad) labels.add(c.ciudad); });
    return Array.from(labels).sort();
  }, [clientes]);

  const HACE_2_ANIOS = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d; })();
  const HACE_5_ANIOS = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 5); return d; })();

  const ultimaFechaExpediente = (c: Cliente): Date | null => {
    const fechas = c.expedientes.map((e) => e.fecha_inicio).filter(Boolean) as string[];
    if (fechas.length === 0) return null;
    return new Date(Math.max(...fechas.map((f) => new Date(f).getTime())));
  };

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.nombre?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.ciudad?.toLowerCase().includes(q) ||
      c.documento?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (expedienteFilter.length > 0 && !c.expedientes.some((e) => expedienteFilter.includes(expedienteLabel(e)))) return false;
    if (agenteFilter.length > 0 && !(c.agente?.id && agenteFilter.includes(c.agente.id))) return false;
    if (tipoFilter.length > 0 && !(c.tipo_cliente?.etiqueta && tipoFilter.includes(c.tipo_cliente.etiqueta))) return false;
    if (etiquetaFilter.length > 0 && !(c.etiquetas?.some((e) => etiquetaFilter.includes(e.nombre)))) return false;
    if (localidadFilter.length > 0 && !(c.ciudad && localidadFilter.includes(c.ciudad))) return false;
    if (filtroEspecial?.tipo === "email_ausente" && c.email) return false;
    if (filtroEspecial?.tipo === "telefono_ausente" && (c.telefono || (c.otros_tlfs?.length ?? 0) > 0)) return false;
    if (filtroEspecial?.tipo === "etiqueta_ausente" && (c.etiquetas?.length ?? 0) > 0) return false;
    if (filtroEspecial?.tipo === "localidad_ausente" && c.ciudad) return false;
    if (filtroEspecial?.tipo === "etiqueta" && !c.etiquetas?.some((e) => e.nombre === filtroEspecial.valor)) return false;
    if (filtroEspecial?.tipo === "localidad" && c.ciudad !== filtroEspecial.valor) return false;
    if (filtroEspecial?.tipo === "inactivo_2_3") {
      const ultima = ultimaFechaExpediente(c);
      if (!ultima || ultima >= HACE_2_ANIOS || ultima < HACE_5_ANIOS) return false;
    }
    if (filtroEspecial?.tipo === "inactivo_5_mas") {
      const ultima = ultimaFechaExpediente(c);
      if (!ultima || ultima >= HACE_5_ANIOS) return false;
    }
    return true;
  });

  const sortAccessor = (c: Cliente, key: SortKey): unknown => {
    if (key === "tipo") return c.tipo_cliente?.etiqueta ?? null;
    if (key === "agente") return c.agente ? `${c.agente.nombre} ${c.agente.apellidos ?? ""}`.trim() : null;
    return c[key];
  };

  const sorted = sort
    ? [...filtered].sort((a, b) => {
        const cmp = compareValues(sortAccessor(a, sort.key), sortAccessor(b, sort.key));
        return sort.direction === "asc" ? cmp : -cmp;
      })
    : filtered;

  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalFiltrosActivos = expedienteFilter.length + sucursalFilter.length + agenteFilter.length + tipoFilter.length + etiquetaFilter.length + localidadFilter.length;

  const entidadesParaDifusion: EntidadDestinatarios[] = (() => {
    const result: EntidadDestinatarios[] = [];
    for (const c of filtered) {
      const emails: EntidadDestinatarios["emails"] = [];
      const vistos = new Set<string>();
      if (c.email) { emails.push({ email: c.email, etiqueta: "Grupo", principal: true, tipo: "institucional" }); vistos.add(c.email); }
      for (const otro of c.otros_emails ?? []) {
        if (!otro || vistos.has(otro)) continue;
        vistos.add(otro);
        emails.push({ email: otro, etiqueta: "Otro email", principal: false, tipo: "institucional" });
      }
      if (emails.length > 0) result.push({ entidad_id: c.id, nombre: c.nombre, emails });
    }
    return result;
  })();

  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };
  const handleExpedienteFilter = (v: string[]) => { setExpedienteFilter(v); setCurrentPage(1); };
  const handleSucursalFilter = (v: string[]) => { setSucursalFilter(v); setCurrentPage(1); };
  const handleAgenteFilter = (v: string[]) => { setAgenteFilter(v); setCurrentPage(1); };
  const handleTipoFilter = (v: string[]) => { setTipoFilter(v); setCurrentPage(1); };
  const handleEtiquetaFilter = (v: string[]) => { setEtiquetaFilter(v); setCurrentPage(1); };
  const handleLocalidadFilter = (v: string[]) => { setLocalidadFilter(v); setCurrentPage(1); };
  const handleSort = (key: SortKey) => { setSort((prev) => sortToggle(prev, key)); setCurrentPage(1); };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Clientes</h1>
      </div>

      <TipClientesCard
        onAplicarFiltro={(filtro, agenteId) => {
          setFiltroEspecial(filtro);
          if (agenteId) setAgenteFilter([agenteId]);
          setCurrentPage(1);
        }}
      />

      {filtroEspecial && (
        <div className={styles.filtroEspecialBanner}>
          <span>Filtro del consejo del copiloto Alivia activo</span>
          <button type="button" onClick={() => { setFiltroEspecial(null); setAgenteFilter([]); }}>Quitar filtro</button>
        </div>
      )}

      {showNuevoCliente && (
        <NuevoClientePanel
          onClose={() => setShowNuevoCliente(false)}
          onCreated={() => { setShowNuevoCliente(false); cargarClientes(); }}
        />
      )}

      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>Listado de clientes ({filtered.length})</span>
          <div className={styles.tableHeaderActions}>
            <div className={styles.searchBar}>
              <Search size={16} />
              <input
                placeholder="Buscar por nombre, documento, localidad…"
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
              onClick={() => setShowEtiquetaMasiva(true)}
              title="Añadir etiqueta a los clientes filtrados"
            >
              <Tag size={16} />
            </button>
            {isOwner && (
              <button
                type="button"
                className={styles.filterIconBtn}
                onClick={() => setShowReasignarAgente(true)}
                title="Reasignar agente a los clientes filtrados"
              >
                <IdCard size={16} />
              </button>
            )}
            <button
              type="button"
              className={styles.filterIconBtn}
              onClick={() => setShowDifusionModal(true)}
              title="Crear difusión con los clientes filtrados"
            >
              <Megaphone size={16} />
            </button>
            <button
              type="button"
              className={styles.addIconBtn}
              onClick={() => setShowNuevoCliente(true)}
              title="Nuevo cliente"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className={styles.filtersRow}>
            <div style={{ width: 220, flexShrink: 0 }}>
              <MultiSelectDropdown
                options={expedienteOptions}
                selected={expedienteFilter}
                onChange={handleExpedienteFilter}
                placeholder="Expedientes"
              />
            </div>
            <div style={{ width: 220, flexShrink: 0 }}>
              <SucursalAgenteFilter
                agentes={agenteOptions}
                selectedAgentes={agenteFilter}
                onChangeAgentes={handleAgenteFilter}
                selectedSucursales={sucursalFilter}
                onChangeSucursales={handleSucursalFilter}
                placeholder="Agencia"
              />
            </div>
            <div style={{ width: 180, flexShrink: 0 }}>
              <MultiSelectDropdown
                options={tipoClienteOptions}
                selected={tipoFilter}
                onChange={handleTipoFilter}
                placeholder="Tipo"
              />
            </div>
            <div style={{ width: 180, flexShrink: 0 }}>
              <MultiSelectDropdown
                options={etiquetaOptions}
                selected={etiquetaFilter}
                onChange={handleEtiquetaFilter}
                placeholder="Etiquetas"
              />
            </div>
            <div style={{ width: 180, flexShrink: 0 }}>
              <MultiSelectDropdown
                options={localidadOptions}
                selected={localidadFilter}
                onChange={handleLocalidadFilter}
                placeholder="Localidad"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className={styles.emptyState}>Cargando…</div>
        ) : (
          <table className={styles.table} style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr>
                <SortableTh label="Nombre" sortKey="nombre" sort={sort} onSort={handleSort} />
                <SortableTh label="Email" sortKey="email" sort={sort} onSort={handleSort} />
                <SortableTh label="Teléfono" sortKey="telefono" sort={sort} onSort={handleSort} />
                <SortableTh label="Localidad" sortKey="ciudad" sort={sort} onSort={handleSort} />
                <SortableTh label="Tipo" sortKey="tipo" sort={sort} onSort={handleSort} />
                <SortableTh label="Agente" sortKey="agente" sort={sort} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>No hay clientes</td>
                </tr>
              ) : (
                paginated.map((c) => {
                  const ct = colorTipo(c.tipo_cliente?.etiqueta);
                  return (
                    <tr key={c.id} onClick={() => setEntidadPanel(c)} style={{ cursor: "pointer" }}>
                      <td style={{ padding: "0.15rem 1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre?.toUpperCase()}</td>
                      <td style={{ padding: "0.15rem 1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email ?? "—"}</td>
                      <td style={{ padding: "0.15rem 1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.telefono ?? "—"}</td>
                      <td style={{ padding: "0.15rem 1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ciudad?.toUpperCase() ?? "—"}</td>
                      <td style={{ padding: "0.15rem 1rem" }}>
                        {c.tipo_cliente?.etiqueta ? (
                          <span style={{
                            display: "inline-block", width: 70, padding: "0.2rem 0", borderRadius: "0.5rem",
                            fontSize: "0.65rem", fontWeight: 600, textAlign: "center",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            backgroundColor: ct.bg, color: ct.color,
                          }}>
                            {c.tipo_cliente.etiqueta}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "0.15rem 1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.agente ? `${c.agente.nombre} ${c.agente.apellidos ?? ""}`.trim() : "—"}</td>
                    </tr>
                  );
                })
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
        )}
      </div>

      {entidadPanel && (
        <PanelEntidad
          data={{ entidad: { ...entidadPanel, crm_agentes: entidadPanel.agente ?? null, config_tipos_cliente: entidadPanel.tipo_cliente ?? null } as any }}
          onClose={() => setEntidadPanel(null)}
          onEntidadUpdated={(entidadActualizada) => {
            setEntidadPanel((p) => (p ? { ...p, ...entidadActualizada } : p));
            setClientes((prev) => prev.map((c) => (c.id === entidadActualizada.id ? { ...c, ...entidadActualizada } : c)));
          }}
          onEntidadDeleted={(id) => {
            setClientes((prev) => prev.filter((c) => c.id !== id));
            setEntidadPanel(null);
          }}
        />
      )}

      {showEtiquetaMasiva && (
        <AsignarEtiquetaMasivaModal
          entidadIds={filtered.map((c) => c.id)}
          onClose={() => setShowEtiquetaMasiva(false)}
          onApplied={(etiqueta) => {
            const idsFiltrados = new Set(filtered.map((c) => c.id));
            setClientes((prev) =>
              prev.map((c) =>
                idsFiltrados.has(c.id) && !c.etiquetas?.some((e) => e.id === etiqueta.id)
                  ? { ...c, etiquetas: [...(c.etiquetas ?? []), etiqueta] }
                  : c
              )
            );
          }}
        />
      )}

      {showDifusionModal && (
        <NuevaDifusionModal
          initialEntidades={entidadesParaDifusion}
          onClose={() => setShowDifusionModal(false)}
          onCreated={() => setShowDifusionModal(false)}
        />
      )}

      {showReasignarAgente && (
        <ReasignarAgenteMasivoModal
          entidadIds={filtered.map((c) => c.id)}
          onClose={() => setShowReasignarAgente(false)}
          onApplied={(agente) => {
            const idsFiltrados = new Set(filtered.map((c) => c.id));
            setClientes((prev) =>
              prev.map((c) =>
                idsFiltrados.has(c.id)
                  ? { ...c, agente_id: agente.id, agente: { id: agente.id, nombre: agente.nombre, apellidos: agente.apellidos || "" } }
                  : c
              )
            );
          }}
        />
      )}
    </div>
  );
}
