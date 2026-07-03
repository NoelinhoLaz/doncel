"use client";

import styles from "./page.module.css";
import { Icons } from "@/lib/icons";
import { CheckCircle2, AlertCircle, Receipt, Globe, Mail, Paperclip, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useState, use, useEffect } from "react";
import ExpedienteActionsToolbar from "@/app/components/ExpedienteActionsToolbar";
import { getExpedienteById, getExpedienteLinksStatus } from "@/actions/expedientes";
import { getCobrosByExpediente } from "@/actions/cobros";
import { getMatchesPendientesPorExpediente, conciliarDesdeMovimientoBanco, conciliarIngresoTutor } from "@/actions/banco";

// Import custom tab components
import ResumenTab from "./components/ResumenTab";
import AjustesTab from "./components/AjustesTab";
import ViajerosTab from "./components/ViajerosTab";
import CobrosTab from "./components/CobrosTab";
import ServiciosTab from "./components/ServiciosTab";
import FacturacionTab from "./components/FacturacionTab";
import AcomodacionTab from "./components/AcomodacionTab";
import DocumentosTab from "./components/DocumentosTab";
import ComunicacionesTab from "./components/ComunicacionesTab";
import RembolsosTab from "./components/RembolsosTab";

export default function ExpedienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [activeTab, setActiveTab] = useState("resumen");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const resolvedParams = use(params);
  
  const [expediente, setExpediente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linksStatus, setLinksStatus] = useState({ hasCotizacion: false, hasPropuesta: false });
  const [cobrosData, setCobrosData] = useState<{ pagadores: any[]; movimientos?: any[]; movimientosBanco: any[] }>({ pagadores: [], movimientos: [], movimientosBanco: [] });

  // States for bank match detection modal
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [matchFilter, setMatchFilter] = useState<"all" | "cobros" | "pagos">("all");
  const [matchConciliando, setMatchConciliando] = useState<Record<string, boolean>>({});
  const [matchRechazado, setMatchRechazado] = useState<string[]>([]);
  const [matchError, setMatchError] = useState<Record<string, string>>({});
  const [matchExceso, setMatchExceso] = useState<string | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [bulkConciliando, setBulkConciliando] = useState(false);
  const [selectedPagos, setSelectedPagos] = useState<Record<string, Set<string>>>({});

  const openMatchModal = (filter: "all" | "cobros" | "pagos" = "all") => {
    setMatchFilter(filter);
    setMatchRechazado([]);
    setSelectedMatches(new Set());
    setMatchError({});
    setMatchExceso(null);
    setIsMatchModalOpen(true);
  };

  const toggleSelectMatch = (id: string) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkConciliar = async () => {
    setBulkConciliando(true);
    for (const movId of selectedMatches) {
      const mov = pendingMatches.find(m => m.id === movId);
      if (!mov || matchRechazado.includes(movId)) continue;
      const meta = mov.match_metadatos || {};
      const esIngreso = Number(mov.importe) > 0;

      setMatchConciliando(prev => ({ ...prev, [movId]: true }));
      setMatchError(prev => ({ ...prev, [movId]: "" }));

      try {
        let result;
        if (esIngreso) {
          result = await conciliarIngresoTutor(movId, meta.expediente_id, meta.pagador_id, mov.importe);
        } else {
          const selPagos = selectedPagos[movId];
          const pagosFiltrados = selPagos?.size
            ? (meta.pagos || []).filter((p: any) => selPagos.has(p.id))
            : (meta.pagos || []);
          const pagoIds = pagosFiltrados.map((p: any) => p.id);
          result = await conciliarDesdeMovimientoBanco(movId, pagoIds);
        }

        if (!result?.success) {
          setMatchError(prev => ({ ...prev, [movId]: result?.error || "Error en conciliación" }));
          setBulkConciliando(false);
          return;
        }
      } catch (err: any) {
        setMatchError(prev => ({ ...prev, [movId]: err.message || "Error al conciliar" }));
        setBulkConciliando(false);
        return;
      } finally {
        setMatchConciliando(prev => ({ ...prev, [movId]: false }));
      }
    }
    setIsMatchModalOpen(false);
    window.location.reload();
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await getExpedienteById(resolvedParams.id);
        setExpediente(data);

        // Fetch links status
        const links = await getExpedienteLinksStatus(resolvedParams.id);
        setLinksStatus(links);

        // Fetch pending matches for this expediente
        const matches = await getMatchesPendientesPorExpediente(resolvedParams.id);
        if (matches && matches.length > 0) {
          setPendingMatches(matches);
          setIsMatchModalOpen(true);
        }
      } catch (err) {
        console.error("Error loading expediente:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [resolvedParams.id]);

  useEffect(() => {
    getCobrosByExpediente(resolvedParams.id).then(setCobrosData);
  }, [resolvedParams.id]);

  const tabs = [
    { id: "resumen", label: "Resumen", icon: <Icons.Resumen size={16} /> },
    { id: "ajustes", label: "Ajustes", icon: <Icons.Settings size={16} /> },
    { id: "viajeros", label: "Viajeros", icon: <Icons.Viajeros size={16} /> },
    { id: "cobros", label: "Cobros", icon: <Icons.Cobros size={16} /> },
    { id: "servicios", label: "Servicios", icon: <Icons.Servicios size={16} /> },
    { id: "rembolsos", label: "Rembolsos", icon: <Icons.Rembolsos size={16} /> },
    { id: "facturacion", label: "Facturación", icon: <Icons.Facturacion size={16} /> },
    { id: "acomodacion", label: "Acomodación", icon: <Icons.Acomodacion size={16} /> },
    { id: "documentos", label: "Documentos", icon: <Icons.Documentos size={16} /> },
    { id: "comunicaciones", label: "Comunicaciones", icon: <Icons.Mail size={16} /> }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "resumen":
        return <ResumenTab expediente={expediente} />;
      case "ajustes":
        return <AjustesTab key={expediente?.id || "loading"} expedienteId={resolvedParams.id} expediente={expediente} />;
      case "viajeros":
        return <ViajerosTab expedienteId={resolvedParams.id} fechaSalida={expediente?.fecha_inicio} pvpViajero={expediente?.pvp_viajero} pagadores={cobrosData.pagadores} plazos={expediente?.plazos} onOpenMatchModal={() => openMatchModal("cobros")} />;
      case "cobros":
        return <CobrosTab pagadores={cobrosData.pagadores} movimientos={cobrosData.movimientos} movimientosBanco={cobrosData.movimientosBanco} plazos={expediente?.plazos} expedienteId={resolvedParams.id} onOpenMatchModal={() => openMatchModal("cobros")} />;
      case "servicios":
        return <ServiciosTab expedienteId={resolvedParams.id} onOpenMatchModal={() => openMatchModal("pagos")} />;
      case "rembolsos":
        return <RembolsosTab expedienteId={resolvedParams.id} onOpenMatchModal={() => openMatchModal("pagos")} />;
      case "facturacion":
        return <FacturacionTab expedienteId={resolvedParams.id} />;
      case "acomodacion":
        return <AcomodacionTab />;
      case "documentos":
        return <DocumentosTab expedienteId={resolvedParams.id} />;
      case "comunicaciones":
        return <ComunicacionesTab expedienteId={resolvedParams.id} pagadores={cobrosData.pagadores} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleRow} style={{ alignItems: "center" }}>
          <Link href="/expedientes" className={styles.backIconButton} title="Volver al listado">
            <Icons.ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} />
          </Link>
        <div className={styles.titleGroup}>
          <h1 className={styles.entityName}>{expediente?.contabilidad_entidades?.nombre || "Sin contacto"}</h1>
          <p className={styles.reference}>{expediente?.numero ? `${expediente.numero} - ${expediente.referencia}` : expediente?.referencia}</p>
        </div>
          <div style={{ flexGrow: 1 }} />
          
          <ExpedienteActionsToolbar expedienteId={resolvedParams.id} />
        </div>
      </header>

      <div className={styles.detailLayout}>
        <aside className={`${styles.sidebar} ${isSidebarCollapsed ? styles.collapsed : ""}`}>
          <div className={styles.sidebarHeader}>
            {!isSidebarCollapsed && <span className={styles.sidebarTitle}>MENÚ</span>}
            <button 
              className={styles.collapseButton} 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}
            >
              {isSidebarCollapsed ? <Icons.MenuOpen size={18} strokeWidth={1.5} /> : <Icons.MenuClose size={18} strokeWidth={1.5} />}
            </button>
          </div>
          <nav className={styles.nav}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ""}`}
                onClick={() => setActiveTab(tab.id)}
                title={isSidebarCollapsed ? tab.label : ""}
              >
                {tab.icon}
                {!isSidebarCollapsed && <span>{tab.label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <main className={styles.content}>
          {renderTabContent()}
        </main>
      </div>

      {/* MODAL FOR PENDING BANK MATCHES (Payment + Income) */}
      {isMatchModalOpen && pendingMatches.length > 0 && (
        <div
          className="premium-modal-overlay"
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
        >
          <div
            className="premium-modal-content"
            style={{
              position: "relative", width: "520px", maxHeight: "80vh",
              backgroundColor: "rgba(255, 255, 255, 0.98)", borderRadius: "1.5rem",
              padding: "1.25rem 1.5rem",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.8)", textAlign: "left",
              fontFamily: '"Montserrat", "Inter", sans-serif',
              display: "flex", flexDirection: "column",
            }}
          >
            <button
              onClick={() => setIsMatchModalOpen(false)}
              style={{
                position: "absolute", top: "1.25rem", right: "1.25rem",
                background: "#f1f5f9", border: "none", borderRadius: "50%",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#64748b", transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#0f172a"; e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.transform = "scale(1)"; }}
            >
              <Icons.Close size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "42px", height: "42px", borderRadius: "12px", background: "color-mix(in srgb, var(--primary-color, #475569), transparent 90%)", color: "var(--primary-color, #475569)" }}>
                <Icons.Landmark size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
                  ¡Match Detectado!
                </h3>
                <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Inteligencia de Conciliación — {pendingMatches.filter(m => matchFilter === "all" ? true : matchFilter === "cobros" ? Number(m.importe) > 0 : Number(m.importe) < 0).length} match{pendingMatches.filter(m => matchFilter === "all" ? true : matchFilter === "cobros" ? Number(m.importe) > 0 : Number(m.importe) < 0).length !== 1 ? "es" : ""}
                </span>
              </div>
            </div>

            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.825rem", color: "#475569", lineHeight: "1.45" }}>
              Movimientos bancarios pendientes que coinciden con este expediente. Selecciona varios y concílialos en lote.
            </p>

            {/* Selection controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", cursor: "pointer", color: "#475569" }}>
                <input
                  type="checkbox"
                  checked={selectedMatches.size > 0 && selectedMatches.size === pendingMatches.filter(m => !matchRechazado.includes(m.id) && (matchFilter === "all" ? true : matchFilter === "cobros" ? Number(m.importe) > 0 : Number(m.importe) < 0)).length}
                  onChange={() => {
                    const visible = pendingMatches.filter(m => !matchRechazado.includes(m.id) && (matchFilter === "all" ? true : matchFilter === "cobros" ? Number(m.importe) > 0 : Number(m.importe) < 0));
                    if (selectedMatches.size === visible.length) {
                      setSelectedMatches(new Set());
                    } else {
                      setSelectedMatches(new Set(visible.map(m => m.id)));
                    }
                  }}
                  style={{ accentColor: "var(--primary-color, #475569)" }}
                />
                Seleccionar todos
              </label>
              {selectedMatches.size > 0 && (
                <button
                  onClick={handleBulkConciliar}
                  disabled={bulkConciliando}
                  style={{
                    backgroundColor: "var(--primary-color, #475569)", color: "#fff",
                    border: "none", borderRadius: "0.375rem", padding: "0.35rem 0.75rem",
                    fontWeight: "600", fontSize: "0.8rem", cursor: bulkConciliando ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: "0.35rem",
                  }}
                >
                  {bulkConciliando ? "Conciliando..." : `Conciliar ${selectedMatches.size} seleccionado${selectedMatches.size !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>

            {/* Scrollable list */}
            <div style={{ overflowY: "auto", maxHeight: "48vh", display: "flex", flexDirection: "column", gap: "0.75rem", paddingRight: "0.25rem" }}>
              {pendingMatches.filter(m => !matchRechazado.includes(m.id) && (matchFilter === "all" ? true : matchFilter === "cobros" ? Number(m.importe) > 0 : Number(m.importe) < 0)).map((mov) => {
                const meta = mov.match_metadatos || {};
                const score = Number(mov.match_score);
                const isExacta = score === 100;
                const isSimilar = score >= 90;
                const esIngreso = Number(mov.importe) > 0;

                const primaryColor = isExacta ? "#10b981" : isSimilar ? "var(--primary-color, #475569)" : "#64748b";
                const lightBgColor = isExacta ? "#f0fdf4" : isSimilar ? "color-mix(in srgb, var(--primary-color, #475569), transparent 90%)" : "#f8fafc";
                const darkTextColor = isExacta ? "#166534" : isSimilar ? "var(--primary-color, #475569)" : "#334155";
                const borderColor = isExacta ? "#bbf7d0" : isSimilar ? "color-mix(in srgb, var(--primary-color, #475569), transparent 75%)" : "#e2e8f0";

                const isConciliando = matchConciliando[mov.id] || false;
                const errorMsg = matchError[mov.id] || null;
                const showingExceso = matchExceso === mov.id;

                const handleConciliar = async (forzarExceso = false) => {
                  if (esIngreso && !forzarExceso) {
                    const deudaPendiente = Number(meta.importe_total || 0) - Number(meta.importe_abonado || 0);
                    if (mov.importe > deudaPendiente + 1) {
                      setMatchExceso(mov.id);
                      return;
                    }
                  }

                  setMatchConciliando(prev => ({ ...prev, [mov.id]: true }));
                  setMatchError(prev => ({ ...prev, [mov.id]: "" }));

                  try {
                    let result;
                    if (esIngreso) {
                      result = await conciliarIngresoTutor(
                        mov.id, meta.expediente_id, meta.pagador_id, mov.importe
                      );
                    } else {
                      const selPagos = selectedPagos[mov.id];
                      const pagosFiltrados = selPagos?.size
                        ? (meta.pagos || []).filter((p: any) => selPagos.has(p.id))
                        : (meta.pagos || []);
                      const pagoIds = pagosFiltrados.map((p: any) => p.id);
                      result = await conciliarDesdeMovimientoBanco(mov.id, pagoIds);
                    }

                    if (result?.success) {
                      setIsMatchModalOpen(false);
                      window.location.reload();
                    } else {
                      setMatchError(prev => ({ ...prev, [mov.id]: result?.error || "Error en conciliación" }));
                    }
                  } catch (err: any) {
                    setMatchError(prev => ({ ...prev, [mov.id]: err.message || "Error al conciliar" }));
                  } finally {
                    setMatchConciliando(prev => ({ ...prev, [mov.id]: false }));
                  }
                };

                if (showingExceso) {
                  return (
                    <div key={mov.id} style={{
                      display: "flex", flexDirection: "column", backgroundColor: "#fffbeb",
                      border: "1.5px solid #fde68a", borderRadius: "0.75rem", padding: "1rem", color: "#92400e",
                      fontFamily: '"Montserrat", "Inter", sans-serif',
                    }}>
                      <h4 style={{ fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <AlertCircle size={16} /> Exceso de pago detectado
                      </h4>
                      <p style={{ fontSize: "0.8rem", marginBottom: "0.75rem", lineHeight: 1.4 }}>
                        El importe recibido (<b>{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(mov.importe)}</b>)
                        supera la deuda pendiente (<b>{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(meta.importe_total || 0) - Number(meta.importe_abonado || 0))}</b>).
                        ¿Deseas asignar el total a este pagador dejándolo con saldo a favor?
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => handleConciliar(true)} disabled={isConciliando} style={{
                          flex: 1, backgroundColor: "#d97706", color: "#fff", border: "none", borderRadius: "0.375rem", padding: "0.5rem", fontWeight: 700, cursor: "pointer"
                        }}>
                          {isConciliando ? "Conciliando..." : "Sí, asignar exceso"}
                        </button>
                        <button onClick={() => setMatchExceso(null)} disabled={isConciliando} style={{
                          flex: 1, backgroundColor: "#fef3c7", color: "#b45309", border: "1px solid #fcd34d", borderRadius: "0.375rem", padding: "0.5rem", fontWeight: 600, cursor: "pointer"
                        }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={mov.id} style={{
                    display: "flex", flexDirection: "column",
                    backgroundColor: lightBgColor, border: `1.5px solid ${borderColor}`,
                    borderRadius: "0.75rem", padding: "1rem", color: darkTextColor,
                    fontFamily: '"Montserrat", "Inter", sans-serif',
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                  }}>
                    {/* Header: score + checkbox */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", borderBottom: `1px solid ${borderColor}`, paddingBottom: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={selectedMatches.has(mov.id)}
                          onChange={() => toggleSelectMatch(mov.id)}
                          style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer", margin: 0 }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          {isExacta ? (
                            <CheckCircle2 size={16} style={{ color: "#10b981" }} />
                          ) : (
                            <AlertCircle size={16} style={{ color: primaryColor }} />
                          )}
                          <span style={{ fontWeight: "700", fontSize: "0.85rem", color: primaryColor }}>
                            {score}% Confianza
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#64748b" }}>
                        {esIngreso ? "Ingreso" : "Pago"}
                        {isExacta && " · Exacto"}
                        {isSimilar && !isExacta && " · Similar"}
                        {!isSimilar && " · Posible"}
                        <span style={{ marginLeft: "0.5rem", fontWeight: "700" }}>
                          {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.abs(mov.importe))}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    {!esIngreso ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                        <div>
                          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>
                            Proveedor
                          </div>
                          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                            title={meta.proveedor_nombre}>
                            {meta.proveedor_nombre}
                          </div>
                          {meta.proveedor_nif && (
                            <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.1rem" }}>
                              NIF: {meta.proveedor_nif}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>
                            Importe
                          </div>
                          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a" }}>
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.abs(mov.importe))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div>
                          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>
                            Concepto
                          </div>
                          <div style={{ fontSize: "0.75rem", fontWeight: "500", color: "#334155", lineHeight: "1.35", wordBreak: "break-word" }}>
                            {mov.concepto_original || "—"}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Viajeros for income */}
                    {esIngreso && (meta.pagador_nombre || (meta.viajeros && meta.viajeros.length > 0)) && (
                      <div style={{ backgroundColor: "rgba(255, 255, 255, 0.4)", border: "1px solid rgba(226, 232, 240, 0.4)", borderRadius: "0.375rem", padding: "0.5rem", marginBottom: "0.75rem", fontSize: "0.8rem", color: "#334155" }}>
                        {meta.pagador_nombre && (
                          <div style={{ marginBottom: "0.15rem", lineHeight: "1.4" }}>
                            <span style={{ fontWeight: "400", color: "#64748b" }}>Cliente:</span>{" "}
                            <span style={{ fontWeight: "500" }}>{meta.pagador_nombre}</span>
                          </div>
                        )}
                        {meta.viajeros && meta.viajeros.map((v: any) => (
                          <div key={v.id} style={{ marginBottom: "0.1rem", lineHeight: "1.4" }}>
                            <span style={{ fontWeight: "400", color: "#64748b" }}>Viajero:</span>{" "}
                            <span style={{ fontWeight: "500" }}>{v.nombre}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Plazos for payment */}
                    {!esIngreso && meta.pagos && meta.pagos.length > 0 && (
                      <div style={{ backgroundColor: "rgba(255, 255, 255, 0.4)", border: "1px solid rgba(226, 232, 240, 0.4)", borderRadius: "0.375rem", padding: "0.5rem", marginBottom: "0.75rem", fontSize: "0.7rem", color: "#475569" }}>
                        <p style={{ fontWeight: "700", color: "#334155", marginBottom: "0.25rem", marginTop: 0 }}>
                          {meta.pagos.length} {meta.pagos.length === 1 ? "plazo" : "plazos"}
                        </p>
                        {meta.pagos.map((p: any) => {
                          const selPagos = selectedPagos[mov.id] || new Set();
                          const isChecked = selPagos.size === 0 || selPagos.has(p.id);
                          return (
                            <label key={p.id} style={{ marginLeft: "0.5rem", marginBottom: "0.15rem", fontWeight: "500", display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.75rem" }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedPagos(prev => {
                                    const next = { ...prev };
                                    const set = new Set(next[mov.id] || (meta.pagos || []).map((x: any) => x.id));
                                    if (set.has(p.id)) set.delete(p.id); else set.add(p.id);
                                    next[mov.id] = set;
                                    return next;
                                  });
                                }}
                                style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer", margin: 0 }}
                              />
                              {p.metodo_pago || "Pago"}: {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(p.importe)}
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Error */}
                    {errorMsg && (
                      <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "0.375rem", padding: "0.6rem", marginBottom: "0.75rem", fontSize: "0.75rem", color: "#991b1b", fontWeight: "600" }}>
                        <p style={{ margin: 0 }}>{errorMsg}</p>
                      </div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleConciliar(false)}
                        disabled={isConciliando}
                        style={{
                          flex: 1, backgroundColor: "var(--primary-color, #475569)", color: "#ffffff",
                          border: "none", borderRadius: "0.375rem", padding: "0.6rem",
                          fontWeight: "700", fontSize: "0.85rem",
                          cursor: isConciliando ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem",
                          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                        }}
                      >
                        {isConciliando ? "Conciliando..." : esIngreso ? "Conciliar Ingreso" : "Conciliar y Asentar"}
                      </button>
                      <button
                        onClick={() => setMatchRechazado(prev => [...prev, mov.id])}
                        style={{
                          backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
                          borderRadius: "0.375rem", padding: "0.6rem 1rem",
                          fontWeight: "600", fontSize: "0.85rem", cursor: "pointer",
                        }}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes modalOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalContentSlideUp {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .premium-modal-overlay {
          animation: modalOverlayFadeIn 0.3s ease-out forwards;
        }
        .premium-modal-content {
          animation: modalContentSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
