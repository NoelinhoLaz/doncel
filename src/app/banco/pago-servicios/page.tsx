"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import * as LucideIcons from "lucide-react";
import { ShoppingCart, FolderPlus, ChevronDown, ChevronRight, SlidersHorizontal, Plus } from "lucide-react";
import { Icons } from "@/lib/icons";
import { getAllServiciosEnriquecidos } from "@/actions/servicios";
import { getTiposServicios } from "@/actions/tiposServicios";
import CompactMultiSelectDropdown from "./CompactMultiSelectDropdown";
import RegistrarPagoMultiModal from "@/components/modals/RegistrarPagoMultiModal";
import EstadoPagoBadgeConTooltip from "@/app/components/servicios/EstadoPagoBadgeConTooltip";
import styles from "@/app/expedientes/shared.module.css";
import listStyles from "../../expedientes/page.module.css";
import pageStyles from "@/app/contactos/page.module.css";

const TYPE_COLORS = [
  { color: "#2563eb", bg: "#eff6ff" },
  { color: "#16a34a", bg: "#f0fdf4" },
  { color: "#d97706", bg: "#fffbeb" },
  { color: "#7c3aed", bg: "#f5f3ff" },
  { color: "#0891b2", bg: "#ecfeff" },
  { color: "#db2777", bg: "#fdf2f8" },
];

const DEFAULT_TYPES: any[] = [];

function EstadoPagoBadge({ abonado, totalNeto, pendienteConciliar, onBuscarMovimiento, pagos }: { abonado: number; totalNeto: number; pendienteConciliar?: boolean; onBuscarMovimiento?: () => void; pagos?: any[] }) {
  const { label, color, bg } = totalNeto > 0 && abonado >= totalNeto
    ? { label: "Pagado", color: "#16a34a", bg: "#f0fdf4" }
    : abonado > 0
      ? { label: "Parcial", color: "#d97706", bg: "#fffbeb" }
      : pendienteConciliar
        ? { label: "Pdt. Conciliar", color: "#2563eb", bg: "#eff6ff" }
        : { label: "Pendiente", color: "#94a3b8", bg: "#f8fafc" };

  const clicable = pendienteConciliar && !!onBuscarMovimiento;
  const esPagado = totalNeto > 0 && abonado >= totalNeto;

  return (
    <EstadoPagoBadgeConTooltip
      label={label}
      color={color}
      bg={bg}
      clicable={clicable}
      onClick={onBuscarMovimiento}
      pagos={pagos}
      mostrarTooltipPagos={esPagado}
    />
  );
}

export default function PagoServiciosPage() {
  const [servicios, setServicios] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>(DEFAULT_TYPES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getTiposServicios()
      .then((types: any[]) => {
        setServiceTypes(
          types?.length
            ? types.map((t: any, i: number) => ({ id: t.id, label: t.etiqueta, icono: t.icono, ...TYPE_COLORS[i % TYPE_COLORS.length] }))
            : DEFAULT_TYPES
        );
      })
      .catch(() => setServiceTypes(DEFAULT_TYPES));
  }, []);

  useEffect(() => {
    getAllServiciosEnriquecidos()
      .then((data: any[]) => setServicios(data || []))
      .catch(() => setServicios([]))
      .finally(() => setLoading(false));
  }, []);

  const getTypeInfo = (typeId: string) => {
    const cat = serviceTypes.find((c) => c.id === typeId || c.label?.toLowerCase() === typeId?.toLowerCase());
    return cat ?? { label: "Otros", icono: "FolderPlus", color: "#475569", bg: "#f1f5f9" };
  };

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggleChecked = (key: string) => setChecked((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const toggleCheckedMany = (keys: string[]) => setChecked((prev) => {
    const allChecked = keys.every((k) => prev.has(k));
    const next = new Set(prev);
    for (const k of keys) allChecked ? next.delete(k) : next.add(k);
    return next;
  });
  const [showRegistrarPago, setShowRegistrarPago] = useState(false);
  const [servicioParaConciliar, setServicioParaConciliar] = useState<any | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [proveedorFilter, setProveedorFilter] = useState<string[]>([]);
  const [expedienteFilter, setExpedienteFilter] = useState<string[]>([]);
  const [estadoFilter, setEstadoFilter] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.data?.nombre) {
          const nombreCompleto = `${d.data.nombre} ${d.data.apellidos ?? ""}`.trim();
          setAgenteFilter([nombreCompleto]);
        }
      })
      .catch(() => {});
  }, []);

  const getEstadoPago = (item: any) => {
    const neto = parseFloat(item.neto) || 0;
    const totalNeto = neto * (item.plazas || 0) * (Number(item.noches || 0) || 1);
    const abonado = Number(item.abonado ?? 0);
    if (totalNeto > 0 && abonado >= totalNeto) return "Pagado";
    if (abonado > 0) return "Parcial";
    if (item.pendiente_conciliar) return "Pdt. Conciliar";
    return "Pendiente";
  };

  const agenteOptions = useMemo(() => [...new Set(servicios.map((s) => s.expediente_agente).filter(Boolean))].sort(), [servicios]);
  const proveedorOptions = useMemo(() => [...new Set(servicios.map((s) => s.proveedor).filter(Boolean))].sort(), [servicios]);
  const expedienteOptions = useMemo(() => [...new Set(servicios.map((s) => s.expediente_numero || s.expediente_referencia).filter(Boolean))].sort(), [servicios]);
  const estadoOptions = ["Pagado", "Parcial", "Pdt. Conciliar", "Pendiente"];
  const totalFiltrosActivos = agenteFilter.length + proveedorFilter.length + expedienteFilter.length + estadoFilter.length;

  const filteredList = useMemo(
    () =>
      servicios.filter((item) => {
        const matchesSearch =
          (item.descripcion || "").toLowerCase().includes(search.toLowerCase()) ||
          (item.proveedor || "").toLowerCase().includes(search.toLowerCase()) ||
          (item.expediente_numero || "").toLowerCase?.().includes(search.toLowerCase()) ||
          (item.expediente_referencia || "").toLowerCase().includes(search.toLowerCase()) ||
          (item.expediente_cliente || "").toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        if (agenteFilter.length > 0 && !agenteFilter.includes(item.expediente_agente)) return false;
        if (proveedorFilter.length > 0 && !proveedorFilter.includes(item.proveedor)) return false;
        if (expedienteFilter.length > 0 && !expedienteFilter.includes(item.expediente_numero || item.expediente_referencia)) return false;
        if (estadoFilter.length > 0 && !estadoFilter.includes(getEstadoPago(item))) return false;
        return true;
      }),
    [servicios, search, agenteFilter, proveedorFilter, expedienteFilter, estadoFilter]
  );

  // Agrupado por proveedor, y dentro de cada proveedor por expediente —
  // mismo patrón de agrupación que la tabla de servicios de un expediente individual.
  const gruposProveedor = useMemo(() => {
    const porProveedor = new Map<string, { key: string; label: string; items: any[] }>();
    for (const item of filteredList) {
      const key = item.proveedor_id || item.proveedor || "__sin_proveedor__";
      const label = item.proveedor || "Sin proveedor";
      const grupo = porProveedor.get(key) || { key, label, items: [] as any[] };
      grupo.items.push(item);
      porProveedor.set(key, grupo);
    }

    return Array.from(porProveedor.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((provGrupo) => {
        const porExpediente = new Map<string, { key: string; label: string; cliente: string | null; items: any[] }>();
        for (const item of provGrupo.items) {
          const key = item.expediente_id;
          const label = item.expediente_numero
            ? `${item.expediente_numero} · ${item.expediente_referencia ?? ""}`
            : (item.expediente_referencia ?? "Sin expediente");
          const grupo = porExpediente.get(key) || { key, label, cliente: item.expediente_cliente ?? null, items: [] as any[] };
          grupo.items.push(item);
          porExpediente.set(key, grupo);
        }
        const expedientes = Array.from(porExpediente.values()).sort((a, b) => a.label.localeCompare(b.label));
        return { ...provGrupo, expedientes };
      });
  }, [filteredList]);

  useEffect(() => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      for (const g of gruposProveedor) {
        next.add(g.key);
        for (const e of g.expedientes) next.add(`${g.key}::${e.key}`);
      }
      return next;
    });
  }, [gruposProveedor]);

  const toggleGroup = (key: string) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div className={pageStyles.container}>
      <div className={pageStyles.header}>
        <h1 className={pageStyles.title}>Servicios de los Expedientes</h1>
      </div>

      <div className={styles.tabContainer}>
        <div className={listStyles.listHeaderTop} style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div className={listStyles.listTitleWrapper}>
            <ShoppingCart size={18} className={listStyles.titleIcon} />
            <h2 className={listStyles.listTitle}>Servicios ({filteredList.length})</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div className={listStyles.searchWrapper}>
              <Icons.Search size={16} className={listStyles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar servicio, proveedor o expediente..."
                className={listStyles.searchInput}
                style={{ width: 340 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={`${pageStyles.filterIconBtn} ${showFilters || totalFiltrosActivos > 0 ? pageStyles.filterIconBtnActive : ""}`}
              onClick={() => setShowFilters((v) => !v)}
              title="Filtros"
            >
              <SlidersHorizontal size={16} />
              {totalFiltrosActivos > 0 && <span className={pageStyles.filterBadge}>{totalFiltrosActivos}</span>}
            </button>
            {checked.size > 0 && (
              <button
                type="button"
                className={pageStyles.addIconBtn}
                onClick={() => setShowRegistrarPago(true)}
                title="Registrar pago de los servicios seleccionados"
                style={{ position: "relative" }}
              >
                <Plus size={16} />
                <span className={pageStyles.filterBadge}>{checked.size}</span>
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className={pageStyles.filtersRow} style={{ gap: "0.4rem", padding: "0.45rem 1.5rem" }}>
            <div style={{ width: 170, flexShrink: 0 }}>
              <CompactMultiSelectDropdown
                options={agenteOptions}
                selected={agenteFilter}
                onChange={setAgenteFilter}
                placeholder="Todos los agentes"
              />
            </div>
            <div style={{ width: 170, flexShrink: 0 }}>
              <CompactMultiSelectDropdown
                options={proveedorOptions}
                selected={proveedorFilter}
                onChange={setProveedorFilter}
                placeholder="Todos los proveedores"
              />
            </div>
            <div style={{ width: 170, flexShrink: 0 }}>
              <CompactMultiSelectDropdown
                options={expedienteOptions}
                selected={expedienteFilter}
                onChange={setExpedienteFilter}
                placeholder="Todos los expedientes"
              />
            </div>
            <div style={{ width: 170, flexShrink: 0 }}>
              <CompactMultiSelectDropdown
                options={estadoOptions}
                selected={estadoFilter}
                onChange={setEstadoFilter}
                placeholder="Todos los estados"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", color: "#64748b", fontSize: "0.85rem" }}>
            Cargando servicios...
          </div>
        ) : filteredList.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem", backgroundColor: "#fff", borderRadius: "0.75rem", textAlign: "center", gap: "0.75rem" }}>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
              {servicios.length === 0 ? "No hay servicios registrados." : "No se encontraron servicios que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className={listStyles.tableContainer} style={{ overflow: "auto", boxShadow: "none", border: "none", background: "transparent", padding: 0 }}>
            <table className={styles.table} style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: 34 }} />
                <col style={{ width: 70 }} />
                <col />
                <col style={{ width: 92 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr>
                  <th></th>
                  <th colSpan={4} style={{ padding: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 1rem", fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      <span>Proveedor</span>
                      <div style={{ flex: 1 }} />
                      <span style={{ width: 100, textAlign: "right" }}>Exp.</span>
                      <span style={{ width: 90, textAlign: "right" }}>Serv.</span>
                      <span style={{ width: 130, textAlign: "right" }}>Total Serv.</span>
                      <span style={{ width: 130, textAlign: "right" }}>Pagado</span>
                      <span style={{ width: 130, textAlign: "right" }}>Pendiente</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {gruposProveedor.map((provGrupo) => {
                  const isCollapsed = collapsedGroups.has(provGrupo.key);
                  const totalProveedor = provGrupo.items.reduce((sum, it) => sum + (parseFloat(it.neto) || 0) * (it.plazas || 1) * (Number(it.noches || 0) || 1), 0);
                  const abonadoProveedor = provGrupo.items.reduce((sum, it) => sum + (Number(it.abonado) || 0), 0);
                  const pendienteProveedor = Math.max(totalProveedor - abonadoProveedor, 0);
                  const provItemIds = provGrupo.items.map((it) => it.id);
                  const provAllChecked = provItemIds.length > 0 && provItemIds.every((id) => checked.has(id));

                  return (
                    <Fragment key={provGrupo.key}>
                      <tr>
                        <td style={{ padding: "0 0 0 1rem", borderTop: "1px solid #e2e8f0", borderBottom: isCollapsed ? "1px solid #e2e8f0" : "none", backgroundColor: "#fff", verticalAlign: "middle" }}>
                          <input
                            type="checkbox"
                            checked={provAllChecked}
                            onChange={() => toggleCheckedMany(provItemIds)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td colSpan={4} onClick={() => toggleGroup(provGrupo.key)} style={{ padding: 0, borderTop: "1px solid #e2e8f0", borderBottom: isCollapsed ? "1px solid #e2e8f0" : "none", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 1rem", backgroundColor: "#fff" }}>
                            {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", textTransform: "uppercase" }}>{provGrupo.label}</span>
                            <div style={{ flex: 1 }} />
                            <span style={{ width: 100, textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>{provGrupo.expedientes.length} exp.</span>
                            <span style={{ width: 90, textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>{provGrupo.items.length} serv.</span>
                            <span style={{ width: 130, textAlign: "right", fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>{totalProveedor.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                            <span style={{ width: 130, textAlign: "right", fontSize: "0.82rem", fontWeight: 700, color: "#16a34a" }}>{abonadoProveedor.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                            <span style={{ width: 130, textAlign: "right", fontSize: "0.82rem", fontWeight: 700, color: pendienteProveedor > 0 ? "#d97706" : "#64748b" }}>{pendienteProveedor.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                          </div>
                        </td>
                      </tr>

                      {!isCollapsed && provGrupo.expedientes.map((expGrupo) => {
                        const expKey = `${provGrupo.key}::${expGrupo.key}`;
                        const isExpCollapsed = collapsedGroups.has(expKey);
                        const totalExpediente = expGrupo.items.reduce((sum, it) => sum + (parseFloat(it.neto) || 0) * (it.plazas || 1) * (Number(it.noches || 0) || 1), 0);
                        const expItemIds = expGrupo.items.map((it) => it.id);
                        const expAllChecked = expItemIds.length > 0 && expItemIds.every((id) => checked.has(id));

                        return (
                        <Fragment key={expGrupo.key}>
                          <tr>
                            <td style={{ padding: "0 0 0 1rem", backgroundColor: "#f8fafc", verticalAlign: "middle" }}>
                              <input
                                type="checkbox"
                                checked={expAllChecked}
                                onChange={() => toggleCheckedMany(expItemIds)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td colSpan={4} onClick={() => toggleGroup(expKey)} style={{ padding: 0, cursor: "pointer" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 1rem 0.4rem 1.1rem", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em", backgroundColor: "#f8fafc" }}>
                                {isExpCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                <span style={{ color: "var(--primary-color, #475569)" }}>
                                  {expGrupo.label}
                                </span>
                                {expGrupo.cliente && <span style={{ textTransform: "none", fontWeight: 500, color: "#94a3b8" }}>— {expGrupo.cliente}</span>}
                                <div style={{ flex: 1 }} />
                                <span style={{ textTransform: "none", fontWeight: 700 }}>{expGrupo.items.length} serv.</span>
                                <span style={{ textTransform: "none", fontWeight: 700, minWidth: 90, textAlign: "right" }}>{totalExpediente.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                              </div>
                            </td>
                          </tr>
                          {!isExpCollapsed && expGrupo.items.map((item) => {
                            const info = getTypeInfo(item.tipo);
                            const IconComponent = (LucideIcons as any)[info.icono] || FolderPlus;
                            const neto = parseFloat(item.neto) || 0;
                            const plazas = item.plazas || 0;
                            const noches = Number(item.noches || 0) || 1;
                            const totalNeto = neto * plazas * noches;

                            return (
                              <tr key={item.id}>
                                <td style={{ padding: "0 0 0 1rem", verticalAlign: "middle" }}>
                                  <input
                                    type="checkbox"
                                    checked={checked.has(item.id)}
                                    onChange={() => toggleChecked(item.id)}
                                  />
                                </td>
                                <td style={{ whiteSpace: "nowrap", verticalAlign: "middle" }}>
                                  <div title={info.label} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", borderRadius: 6, marginLeft: "1.5rem" }}>
                                    <IconComponent size={14} />
                                  </div>
                                </td>
                                <td style={{ verticalAlign: "middle", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: "0.5rem" }}>
                                  {item.descripcion}
                                </td>
                                <td style={{ verticalAlign: "middle", paddingRight: "1.5rem" }}>
                                  <EstadoPagoBadge
                                    abonado={Number(item.abonado ?? 0)}
                                    totalNeto={totalNeto}
                                    pendienteConciliar={item.pendiente_conciliar}
                                    onBuscarMovimiento={() => setServicioParaConciliar(item)}
                                    pagos={item.pagos}
                                  />
                                </td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "middle", fontSize: "0.75rem", fontWeight: 600, paddingLeft: "1rem", paddingRight: "1rem" }}>
                                  {totalNeto.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showRegistrarPago && (
        <RegistrarPagoMultiModal
          isOpen={showRegistrarPago}
          onClose={() => setShowRegistrarPago(false)}
          servicios={servicios.filter((s) => checked.has(s.id))}
          onSuccess={() => {
            setChecked(new Set());
            getAllServiciosEnriquecidos()
              .then((data: any[]) => setServicios(data || []))
              .catch(() => {});
          }}
        />
      )}

      {servicioParaConciliar && (
        <RegistrarPagoMultiModal
          isOpen={!!servicioParaConciliar}
          onClose={() => setServicioParaConciliar(null)}
          servicios={[servicioParaConciliar]}
          initialStep="buscador"
          onSuccess={() => {
            setServicioParaConciliar(null);
            getAllServiciosEnriquecidos()
              .then((data: any[]) => setServicios(data || []))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
