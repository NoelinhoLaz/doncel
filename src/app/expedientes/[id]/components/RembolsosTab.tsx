"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Trash2, Users, Building2, RefreshCw } from "lucide-react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import styles from "../page.module.css";
import { getViajerosConPagadorByExpediente } from "@/actions/viajeros";
import { getReembolsosByExpediente, createReembolsoMovimiento } from "@/actions/cobros";
import { getEntidades } from "@/actions/entidades";
import { getMatchesPendientesPorExpediente, recalcularMatchesReembolsos } from "@/actions/banco";
import { Landmark } from "lucide-react";

interface Rembolso {
  id: string;
  concepto: string;
  entidad_nombre: string;
  importe_total: number;
  fecha: string;
  estado: "pendiente" | "confirmado" | "anulado";
  tipo: "reembolso_cobro" | "reembolso_pago";
}

interface WizardViajero {
  id: string;
  entidad_id: string;
  pagador_id: string | null;
  viajero: { id: string; nombre: string } | null;
  pagador: { id: string; nombre: string } | null;
}

interface WizardEntidad {
  id: string;
  nombre: string;
}

interface Props {
  expedienteId: string;
  onOpenMatchModal?: () => void;
}

const estadoColors: Record<string, { bg: string; color: string }> = {
  pendiente:  { bg: "#fef9c3", color: "#a16207" },
  confirmado: { bg: "#dcfce7", color: "#16a34a" },
  anulado:    { bg: "#fee2e2", color: "#dc2626" },
};

const formatEuro = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const TODAY = new Date().toISOString().split("T")[0];

export default function RembolsosTab({ expedienteId, onOpenMatchModal }: Props) {
  const [rembolsos, setRembolsos] = useState<Rembolso[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("fecha");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Wizard state
  const [showAddModal, setShowAddModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<"type" | "select" | "form">("type");
  const [wizardType, setWizardType] = useState<"cliente" | "proveedor" | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardViajeros, setWizardViajeros] = useState<WizardViajero[]>([]);
  const [wizardEntidades, setWizardEntidades] = useState<WizardEntidad[]>([]);
  const [wizardSearch, setWizardSearch] = useState("");
  const [wizardSelected, setWizardSelected] = useState<{ entidadId: string; label: string; sublabel?: string } | null>(null);
  const [wizardImporte, setWizardImporte] = useState("");
  const [wizardConcepto, setWizardConcepto] = useState("");
  const [wizardMedioPago, setWizardMedioPago] = useState<"banco" | "efectivo" | "tarjeta" | "online">("banco");
  const [wizardFecha, setWizardFecha] = useState(TODAY);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const [matchesPagos, setMatchesPagos] = useState<any[]>([]);
  const [matchingRunning, setMatchingRunning] = useState(false);

  const loadRembolsos = useCallback(async () => {
    setLoading(true);
    const data = await getReembolsosByExpediente(expedienteId);
    setRembolsos(data as Rembolso[]);
    setLoading(false);
  }, [expedienteId]);

  const loadMatches = useCallback(async () => {
    try {
      const matches = await getMatchesPendientesPorExpediente(expedienteId);
      setMatchesPagos((matches || []).filter((m: any) => Number(m.importe) < 0));
    } catch {}
  }, [expedienteId]);

  const runMatching = useCallback(async () => {
    setMatchingRunning(true);
    try {
      await recalcularMatchesReembolsos();
      await loadMatches();
    } catch (e) {
      console.error("Error en matching reembolsos:", e);
    } finally {
      setMatchingRunning(false);
    }
  }, [loadMatches]);

  useEffect(() => {
    loadRembolsos();
    loadMatches();
  }, [loadRembolsos, loadMatches]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const totalConfirmado = rembolsos.filter(r => r.estado === "confirmado").reduce((s, r) => s + r.importe_total, 0);
  const totalPendiente  = rembolsos.filter(r => r.estado === "pendiente").reduce((s, r) => s + r.importe_total, 0);
  const totalGeneral    = rembolsos.reduce((s, r) => s + r.importe_total, 0);

  const estadosCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rembolsos) m[r.estado] = (m[r.estado] || 0) + 1;
    return m;
  }, [rembolsos]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return rembolsos.filter(r =>
      (r.concepto || "").toLowerCase().includes(term) ||
      r.entidad_nombre.toLowerCase().includes(term)
    );
  }, [rembolsos, search]);

  const sortedData = useMemo(() => {
    const data = [...filteredData];
    data.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      if (sortKey === "concepto")    { valA = (a.concepto || "").toLowerCase(); valB = (b.concepto || "").toLowerCase(); }
      else if (sortKey === "entidad") { valA = a.entidad_nombre.toLowerCase(); valB = b.entidad_nombre.toLowerCase(); }
      else if (sortKey === "importe") { valA = a.importe_total; valB = b.importe_total; }
      else if (sortKey === "fecha")   { valA = a.fecha; valB = b.fecha; }
      else if (sortKey === "estado")  { valA = a.estado; valB = b.estado; }
      else if (sortKey === "tipo")    { valA = a.tipo; valB = b.tipo; }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === "asc"
        ? (valA > valB ? 1 : valA < valB ? -1 : 0)
        : (valA < valB ? 1 : valA > valB ? -1 : 0);
    });
    return data;
  }, [filteredData, sortKey, sortDirection]);

  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + rowsPerPage);

  // Wizard helpers
  const openAddModal = () => {
    setShowAddModal(true);
    setWizardStep("type");
    setWizardType(null);
    setWizardSearch("");
    setWizardSelected(null);
    setWizardImporte("");
    setWizardConcepto("");
    setWizardMedioPago("banco");
    setWizardFecha(TODAY);
    setWizardError(null);
    setWizardViajeros([]);
    setWizardEntidades([]);
  };

  const closeAddModal = () => setShowAddModal(false);

  const selectType = async (type: "cliente" | "proveedor") => {
    setWizardType(type);
    setWizardStep("select");
    setWizardSearch("");
    setWizardLoading(true);
    if (type === "cliente") {
      const data = await getViajerosConPagadorByExpediente(expedienteId);
      setWizardViajeros(data as unknown as WizardViajero[]);
    } else {
      const data = await getEntidades();
      setWizardEntidades(data as WizardEntidad[]);
    }
    setWizardLoading(false);
  };

  const selectEntity = (entidadId: string, label: string, sublabel?: string) => {
    setWizardSelected({ entidadId, label, sublabel });
    setWizardStep("form");
    setWizardError(null);
  };

  const handleSubmit = async () => {
    if (!wizardSelected) return;
    const importe = parseFloat(wizardImporte.replace(",", "."));
    if (!importe || importe <= 0) { setWizardError("Introduce un importe válido mayor que 0."); return; }
    if (!wizardConcepto.trim()) { setWizardError("Introduce un concepto."); return; }

    setWizardSaving(true);
    setWizardError(null);
    const result = await createReembolsoMovimiento({
      expediente_id: expedienteId,
      entidad_id: wizardSelected.entidadId,
      tipo: wizardType === "cliente" ? "reembolso_cobro" : "reembolso_pago",
      importe_total: importe,
      concepto: wizardConcepto.trim(),
      medio_pago: wizardMedioPago,
      fecha: wizardFecha,
    });
    setWizardSaving(false);

    if (!result.success) {
      setWizardError(result.error || "Error al crear el reembolso.");
      return;
    }
    closeAddModal();
    loadRembolsos();
  };

  // Filtered wizard list
  const wizardFilteredViajeros = useMemo(() => {
    const term = wizardSearch.toLowerCase();
    if (!term) return wizardViajeros;
    return wizardViajeros.filter(v =>
      (v.viajero?.nombre || "").toLowerCase().includes(term) ||
      (v.pagador?.nombre || "").toLowerCase().includes(term)
    );
  }, [wizardViajeros, wizardSearch]);

  const wizardFilteredEntidades = useMemo(() => {
    const term = wizardSearch.toLowerCase();
    if (!term) return wizardEntidades;
    return wizardEntidades.filter(e => e.nombre.toLowerCase().includes(term));
  }, [wizardEntidades, wizardSearch]);

  const SortTh = ({ label, col, align = "left" }: { label: string; col: string; align?: "left" | "right" }) => (
    <th onClick={() => handleSort(col)} style={{ cursor: "pointer", textAlign: align, width: align === "right" ? "1%" : undefined, whiteSpace: "nowrap" }}>
      <div className={styles.headerSort} style={align === "right" ? { justifyContent: "flex-end" } : undefined}>
        <span>{label}</span>
        <Icons.ChevronDown
          size={12}
          className={styles.sortIcon}
          style={{
            transform: sortKey === col && sortDirection === "desc" ? "rotate(180deg)" : "rotate(0deg)",
            color: sortKey === col ? "#1e293b" : "#cbd5e1",
            transition: "transform 0.2s, color 0.2s"
          }}
        />
      </div>
    </th>
  );

  return (
    <>
      {/* KPIs */}
      <div className={styles.viajerosKpiGrid}>
        <div className={styles.viajerosKpiCard}>
          <div className={styles.blankKpiHeader}>
            <span className={styles.blankKpiTitle}>Total Reembolsos</span>
            <span className={styles.blankKpiBadge}>{rembolsos.length} registros</span>
          </div>
          <div>
            <div className={styles.blankKpiNumber}>{loading ? "—" : formatEuro(totalGeneral)}</div>
            <div className={styles.blankKpiSubtext}>
              {totalConfirmado > 0 && <><strong>{formatEuro(totalConfirmado)} confirmados</strong></>}
              {totalPendiente > 0 && <>, {formatEuro(totalPendiente)} pendientes</>}
            </div>
          </div>
        </div>

        <div className={styles.viajerosKpiCard}>
          <span className={styles.kpiCardTitle}>Estados</span>
          <div className={styles.progressItemsList}>
            {Object.keys(estadosCount).length === 0 && (
              <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin reembolsos</div>
            )}
            {Object.entries(estadosCount).map(([estado, count]) => {
              const pct = rembolsos.length > 0 ? Math.round((count / rembolsos.length) * 100) : 0;
              const colors = estadoColors[estado] || { bg: "#f1f5f9", color: "#475569" };
              return (
                <div key={estado} className={styles.progressItemRow} style={{ marginBottom: "0.25rem" }}>
                  <div className={styles.progressItemLabelRow}>
                    <span>{estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
                    <span className={styles.progressItemVal}>{count} ({pct}%)</span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div className={styles.progressBarFill} style={{ width: `${pct}%`, background: colors.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.viajerosKpiCard}>
          <span className={styles.kpiCardTitle}>Por tipo</span>
          <div className={styles.progressItemsList}>
            {[{ key: "reembolso_cobro", label: "Cliente" }, { key: "reembolso_pago", label: "Proveedor" }].map(({ key, label }) => {
              const count = rembolsos.filter(r => r.tipo === key).length;
              const pct = rembolsos.length > 0 ? Math.round((count / rembolsos.length) * 100) : 0;
              return (
                <div key={key} className={styles.progressItemRow} style={{ marginBottom: "0.25rem" }}>
                  <div className={styles.progressItemLabelRow}>
                    <span>{label}</span>
                    <span className={styles.progressItemVal}>{count} ({pct}%)</span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background: "#ffffff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)", marginBottom: "1.5rem" }}>
        <div className={styles.listHeaderTop}>
          <div className={styles.listTitleWrapper}>
            <Icons.Rembolsos size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Reembolsos ({filteredData.length})</h2>
          </div>
          <div className={styles.actionsWrapper}>
            <div className={styles.searchWrapper}>
              <Icons.Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar por concepto o cliente..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <button className={styles.actionIconButton} title="Filtrar">
              <Icons.Filter size={18} />
            </button>
            <button className={styles.actionIconButton} title="Exportar reembolsos">
              <Icons.Export size={18} />
            </button>
            <button
              className={styles.actionIconButton}
              title={matchingRunning ? "Buscando matches..." : "Buscar matches bancarios para reembolsos"}
              onClick={runMatching}
              disabled={matchingRunning}
              style={{ opacity: matchingRunning ? 0.5 : 1 }}
            >
              <RefreshCw size={16} style={{ animation: matchingRunning ? "spin 1s linear infinite" : undefined }} />
            </button>
            {matchesPagos.length > 0 && (
              <button
                className={styles.actionIconButton}
                style={{ position: "relative" }}
                title={`${matchesPagos.length} salida${matchesPagos.length !== 1 ? "s" : ""} bancaria${matchesPagos.length !== 1 ? "s" : ""} pendiente${matchesPagos.length !== 1 ? "s" : ""} de conciliar`}
                onClick={onOpenMatchModal}
              >
                <Landmark size={18} />
                <span style={{ position: "absolute", top: "-6px", right: "-6px", minWidth: "16px", height: "16px", borderRadius: "8px", backgroundColor: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.6rem", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: "1", border: "1.5px solid #fff" }}>
                  {matchesPagos.length}
                </span>
              </button>
            )}
            <button className={styles.addActionButton} title="Añadir reembolso" onClick={openAddModal}>
              <Icons.Add size={18} />
            </button>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <SortTh label="CONCEPTO" col="concepto" />
                <SortTh label="ENTIDAD" col="entidad" />
                <SortTh label="TIPO" col="tipo" />
                <SortTh label="FECHA" col="fecha" align="right" />
                <SortTh label="IMPORTE" col="importe" align="right" />
                <SortTh label="ESTADO" col="estado" align="right" />
                <th style={{ width: "1%" }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.9rem" }}>
                    Cargando reembolsos...
                  </td>
                </tr>
              )}
              {!loading && paginatedData.map((item) => {
                const colors = estadoColors[item.estado] || { bg: "#f1f5f9", color: "#475569" };
                return (
                  <tr key={item.id}>
                    <td><span className={styles.mainText}>{item.concepto || "—"}</span></td>
                    <td><span className={styles.mainText}>{item.entidad_nombre}</span></td>
                    <td>
                      <span style={{ display: "inline-flex", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", backgroundColor: "#f1f5f9", color: "#475569", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase" }}>
                        {item.tipo === "reembolso_cobro" ? "Cliente" : "Proveedor"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {item.fecha ? new Date(item.fecha).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: "#1e293b", whiteSpace: "nowrap" }}>
                      {formatEuro(item.importe_total)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-flex", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", backgroundColor: colors.bg, color: colors.color, fontSize: "0.75rem", fontWeight: "600" }}>
                        {item.estado.charAt(0).toUpperCase() + item.estado.slice(1)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.4rem", borderRadius: "0.25rem", transition: "color 0.15s, background-color 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.backgroundColor = "#fef2f2"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                        title="Eliminar reembolso"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && paginatedData.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                        <Icons.Rembolsos size={22} />
                      </div>
                      <div>
                        <p style={{ margin: "0 0 0.25rem", fontWeight: "600", fontSize: "0.9rem", color: "#0f172a" }}>No hay reembolsos registrados</p>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Añade el primer reembolso del expediente.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredData.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredData.length}
              itemsPerPage={rowsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(newRows) => { setRowsPerPage(newRows); setCurrentPage(1); }}
            />
          )}
        </div>
      </div>

      {/* Wizard modal */}
      {showAddModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeAddModal(); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)" }}
        >
          <div style={{ background: "#fff", borderRadius: "1rem", width: "100%", maxWidth: "500px", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", margin: "1rem" }}>
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: "700", color: "#0f172a" }}>
                  {wizardStep === "type" && "Nuevo reembolso"}
                  {wizardStep === "select" && wizardType === "cliente" && "Seleccionar viajero"}
                  {wizardStep === "select" && wizardType === "proveedor" && "Seleccionar proveedor / entidad"}
                  {wizardStep === "form" && "Detalles del reembolso"}
                </h2>
                {wizardStep !== "type" && (
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                    {wizardType === "cliente" ? "Reembolso a cliente" : "Reembolso de proveedor"}
                  </p>
                )}
              </div>
              <button
                onClick={closeAddModal}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.2rem", padding: "0.25rem", lineHeight: 1, borderRadius: "0.25rem" }}
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>

              {/* Step: type */}
              {wizardStep === "type" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <button
                    onClick={() => selectType("cliente")}
                    style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.25rem 1.5rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", background: "#fff", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s, background 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#475569"; e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#fff"; }}
                  >
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Users size={20} color="#3b82f6" />
                    </div>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "#0f172a" }}>Reembolso a cliente</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.15rem" }}>Devolver importe a un viajero del expediente</div>
                    </div>
                  </button>

                  <button
                    onClick={() => selectType("proveedor")}
                    style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.25rem 1.5rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", background: "#fff", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s, background 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#475569"; e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#fff"; }}
                  >
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Building2 size={20} color="#16a34a" />
                    </div>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "#0f172a" }}>Reembolso de proveedor</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.15rem" }}>Recibir devolución de un proveedor o entidad</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Step: select */}
              {wizardStep === "select" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ position: "relative" }}>
                    <Icons.Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      autoFocus
                      type="text"
                      placeholder={wizardType === "cliente" ? "Buscar por viajero o cliente..." : "Buscar entidad..."}
                      value={wizardSearch}
                      onChange={(e) => setWizardSearch(e.target.value)}
                      style={{ width: "100%", padding: "0.65rem 0.75rem 0.65rem 2.25rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  {wizardLoading && (
                    <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.85rem" }}>Cargando...</div>
                  )}

                  {!wizardLoading && wizardType === "cliente" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "340px", overflowY: "auto" }}>
                      {wizardFilteredViajeros.length === 0 && (
                        <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.85rem" }}>Sin resultados</div>
                      )}
                      {wizardFilteredViajeros.map((v) => {
                        const viajeroNombre = v.viajero?.nombre || "—";
                        const pagadorNombre = v.pagador?.nombre;
                        const entidadId = v.pagador_id || v.entidad_id;
                        return (
                          <button
                            key={v.id}
                            onClick={() => selectEntity(entidadId, viajeroNombre, pagadorNombre ? `Cliente: ${pagadorNombre}` : undefined)}
                            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "0.75rem 1rem", border: "1px solid #f1f5f9", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left", transition: "background 0.1s, border-color 0.1s" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#f1f5f9"; }}
                          >
                            <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "#0f172a" }}>{viajeroNombre}</span>
                            {pagadorNombre && (
                              <span style={{ fontSize: "0.775rem", color: "#64748b", marginTop: "0.15rem" }}>Cliente: {pagadorNombre}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {!wizardLoading && wizardType === "proveedor" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "340px", overflowY: "auto" }}>
                      {wizardFilteredEntidades.length === 0 && (
                        <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.85rem" }}>Sin resultados</div>
                      )}
                      {wizardFilteredEntidades.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => selectEntity(e.id, e.nombre)}
                          style={{ display: "flex", alignItems: "center", padding: "0.75rem 1rem", border: "1px solid #f1f5f9", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left", transition: "background 0.1s, border-color 0.1s" }}
                          onMouseEnter={(el) => { el.currentTarget.style.background = "#f8fafc"; el.currentTarget.style.borderColor = "#cbd5e1"; }}
                          onMouseLeave={(el) => { el.currentTarget.style.background = "#fff"; el.currentTarget.style.borderColor = "#f1f5f9"; }}
                        >
                          <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "#0f172a" }}>{e.nombre}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => { setWizardStep("type"); setWizardSearch(""); }}
                    style={{ marginTop: "0.25rem", background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "0.8rem", textAlign: "left", padding: "0.25rem 0" }}
                  >
                    ← Volver
                  </button>
                </div>
              )}

              {/* Step: form */}
              {wizardStep === "form" && wizardSelected && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Selected entity badge */}
                  <div style={{ padding: "0.875rem 1rem", background: "#f8fafc", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: "600", fontSize: "0.875rem", color: "#0f172a" }}>{wizardSelected.label}</div>
                    {wizardSelected.sublabel && (
                      <div style={{ fontSize: "0.775rem", color: "#64748b", marginTop: "0.2rem" }}>{wizardSelected.sublabel}</div>
                    )}
                  </div>

                  {/* Importe */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569", marginBottom: "0.35rem" }}>Importe (€)</label>
                    <input
                      autoFocus
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0,00"
                      value={wizardImporte}
                      onChange={(e) => setWizardImporte(e.target.value)}
                      style={{ width: "100%", padding: "0.65rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Concepto */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569", marginBottom: "0.35rem" }}>Concepto</label>
                    <input
                      type="text"
                      placeholder="Describe el motivo del reembolso..."
                      value={wizardConcepto}
                      onChange={(e) => setWizardConcepto(e.target.value)}
                      style={{ width: "100%", padding: "0.65rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Medio de pago + Fecha */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569", marginBottom: "0.35rem" }}>Medio de pago</label>
                      <select
                        value={wizardMedioPago}
                        onChange={(e) => setWizardMedioPago(e.target.value as any)}
                        style={{ width: "100%", padding: "0.65rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", outline: "none", background: "#fff", boxSizing: "border-box" }}
                      >
                        <option value="banco">Banco</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="online">Online</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#475569", marginBottom: "0.35rem" }}>Fecha</label>
                      <input
                        type="date"
                        value={wizardFecha}
                        onChange={(e) => setWizardFecha(e.target.value)}
                        style={{ width: "100%", padding: "0.65rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {wizardError && (
                    <div style={{ padding: "0.65rem 0.875rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", color: "#dc2626", fontSize: "0.8rem" }}>
                      {wizardError}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={wizardSaving}
                    style={{ padding: "0.75rem 1.5rem", background: wizardSaving ? "#94a3b8" : "#0f172a", color: "#fff", border: "none", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: "600", cursor: wizardSaving ? "not-allowed" : "pointer", transition: "background 0.15s" }}
                  >
                    {wizardSaving ? "Guardando..." : "Crear reembolso"}
                  </button>

                  <button
                    onClick={() => { setWizardStep("select"); setWizardSelected(null); setWizardError(null); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "0.8rem", padding: "0.25rem 0" }}
                  >
                    ← Volver
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
