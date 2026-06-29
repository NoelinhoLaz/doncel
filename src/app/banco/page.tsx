"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import styles from "../expedientes/[id]/page.module.css";
import listStyles from "../expedientes/page.module.css";
import { getMovimientosBanco, recalcularTodosLosMatches, regenerarPoolsBanco } from "@/actions/banco";
import { getCuentasBancarias } from "@/actions/cuentasBancarias";
import ImportarN43 from "@/app/components/contabilidad/ImportarN43";
import { PagoPropuestoPorMatch } from "@/components/movimientos/PagoPropuestoPorMatch";
import { IngresoPropuestoPorMatch } from "@/components/movimientos/IngresoPropuestoPorMatch";
import { MatchTooltipWrapper } from "@/components/movimientos/MatchTooltipWrapper";

const getAccountBadgeStyle = (cuenta?: string) => {
  const c = (cuenta || "").toUpperCase();
  if (c.includes("SANTANDER")) {
    return {
      bg: "#fef2f2",
      color: "#ef4444",
      border: "1px solid #fee2e2",
      label: "Banco Santander"
    };
  } else if (c.includes("CAIXA")) {
    return {
      bg: "#f0fdfa",
      color: "#0d9488",
      border: "1px solid #ccfbf1",
      label: "CaixaBank"
    };
  } else if (c.includes("BBVA")) {
    return {
      bg: "#eff6ff",
      color: "#3b82f6",
      border: "1px solid #dbeafe",
      label: "BBVA"
    };
  } else {
    return {
      bg: "#f8fafc",
      color: "#64748b",
      border: "1px solid #e2e8f0",
      label: cuenta || "Banco"
    };
  }
};

const getEstadoBadgeStyle = (estado: string) => {
  switch (estado) {
    case "conciliado":
      return {
        bg: "#dcfce7",
        color: "#15803d",
        border: "1px solid #bbf7d0",
        label: "Conciliado"
      };
    case "propuesto":
      return {
        bg: "color-mix(in srgb, var(--primary-color, #475569) 10%, white)",
        color: "var(--primary-color, #475569)",
        border: "1px solid color-mix(in srgb, var(--primary-color, #475569) 30%, white)",
        label: "Matching"
      };
    case "pendiente":
    default:
      return {
        bg: "#f1f5f9",
        color: "#475569",
        border: "1px solid #e2e8f0",
        label: "Pendiente"
      };
  }
};

export default function BancoPage() {
  const [bankMovements, setBankMovements] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [matchReport, setMatchReport] = useState<{
    procesados: number;
    bajos: number;
    medios: number;
    altos: number;
    tiempoMs: number;
  } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [totalItems, setTotalItems] = useState(0);

  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState({
    bancosIds: [] as string[],
    tipoMovimiento: "todos" as "todos" | "debe" | "haber",
    fechaDesde: "",
    fechaHasta: "",
    importeMin: "",
    importeMax: "",
    estados: [] as string[],
    matchRanges: [] as string[],
  });

  const updateFiltro = <K extends keyof typeof filtros>(key: K, value: (typeof filtros)[K]) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
  };

  const toggleEstadoFilter = (estado: string) => {
    setFiltros(prev => ({
      ...prev,
      estados: prev.estados.includes(estado)
        ? prev.estados.filter(e => e !== estado)
        : [...prev.estados, estado]
    }));
  };

  const toggleBancoFilter = (id: string) => {
    setFiltros(prev => ({
      ...prev,
      bancosIds: prev.bancosIds.includes(id)
        ? prev.bancosIds.filter(b => b !== id)
        : [...prev.bancosIds, id]
    }));
  };

  const toggleMatchRangeFilter = (range: string) => {
    setFiltros(prev => ({
      ...prev,
      matchRanges: prev.matchRanges.includes(range)
        ? prev.matchRanges.filter(r => r !== range)
        : [...prev.matchRanges, range]
    }));
  };

  // Load bank accounts list once on mount
  useEffect(() => {
    async function loadAccounts() {
      try {
        const accountsData = await getCuentasBancarias();
        setCuentasBancarias(accountsData || []);
      } catch (error) {
        console.error("Error loading bank accounts:", error);
      }
    }
    loadAccounts();
  }, []);

  const loadData = useCallback(async (filters: typeof filtros) => {
    try {
      setLoading(true);
      const result = await getMovimientosBanco({
        page: currentPage,
        limit: rowsPerPage,
        search: searchQuery,
        matchScoreFilters: filters.matchRanges,
        tipoMovimiento: filters.tipoMovimiento === "todos" ? undefined : filters.tipoMovimiento,
        fechaDesde: filters.fechaDesde || undefined,
        fechaHasta: filters.fechaHasta || undefined,
        importeMin: filters.importeMin ? Number(filters.importeMin) : undefined,
        importeMax: filters.importeMax ? Number(filters.importeMax) : undefined,
        estados: filters.estados.length > 0 ? filters.estados : undefined,
        cuentaIds: filters.bancosIds.length > 0 ? filters.bancosIds : undefined,
      });
      setBankMovements(result.data || []);
      setTotalItems(result.count || 0);
    } catch (error) {
      console.error("Error loading bank movements:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, searchQuery]);

  useEffect(() => {
    loadData(filtros);
  }, [loadData, filtros]);

  // Debounce search input for 2 seconds (wait 2s after typing stops before querying)
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed.length >= 3) {
        setSearchQuery(trimmed);
        setCurrentPage(1);
      } else if (trimmed === "") {
        setSearchQuery("");
        setCurrentPage(1);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatImporte = (val: number) => {
    const formatted = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(Math.abs(val));
    return val >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className={`${listStyles.container} bancoPageContainer`}>
      {/* CABECERA */}
      <header className={listStyles.header}>
        <div className={listStyles.headerRow}>
          <h1 className={listStyles.title}>Movimientos Bancarios</h1>
        </div>
      </header>

      {/* SECCIÓN LISTADO MOVIMIENTOS BANCARIOS */}
      <div style={{ background: "#ffffff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", overflow: "visible", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)" }}>
        <div className={styles.listHeaderTop} style={{ borderTopLeftRadius: "0.75rem", borderTopRightRadius: "0.75rem" }}>
          <div className={styles.listTitleWrapper}>
            <Icons.Landmark size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Movimientos bancarios ({totalItems})</h2>
          </div>
          <div className={styles.actionsWrapper}>
            <div className={styles.searchWrapper}>
              {loading ? (
                <Icons.RefreshCw size={16} className={styles.searchIcon} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Icons.Search size={16} className={styles.searchIcon} />
              )}
              <input 
                type="text" 
                placeholder="Buscar (mín. 3 letras)..." 
                className={styles.searchInput}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button 
              className={styles.actionIconButton} 
              title="Actualizar"
              onClick={async () => {
                setLoading(true);
                try {
                  // 1. Regenerar pool1/pool2 en BD (separa por guiones)
                  await regenerarPoolsBanco();
                  // 2. Re-calcular matches nuevos con buscarMatchesParaIngreso
                  const result = await recalcularTodosLosMatches();
                  if (result && result.tiempoMs !== undefined) {
                    setMatchReport({
                      procesados: result.procesados || 0,
                      bajos: result.bajos || 0,
                      medios: result.medios || 0,
                      altos: result.altos || 0,
                      tiempoMs: result.tiempoMs || 0
                    });
                  }
                } catch (err) {
                  console.error("Error al recalcular matches:", err);
                }
                setSearchInput("");
                setSearchQuery("");
                setCurrentPage(1);
                await loadData(filtros);
              }}
              disabled={loading}
            >
              <Icons.RefreshCw size={18} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
            <button
              className={`${styles.actionIconButton} ${showFilters || filtros.bancosIds.length > 0 || filtros.estados.length > 0 || filtros.matchRanges.length > 0 || filtros.tipoMovimiento !== "todos" || filtros.fechaDesde || filtros.fechaHasta || filtros.importeMin || filtros.importeMax ? listStyles.activeAction : ""}`}
              title="Filtrar"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Icons.Filter size={18} />
            </button>
            <button 
              className={styles.actionIconButton} 
              title="Importar movimientos"
              onClick={() => setIsImportModalOpen(true)}
            >
              <Icons.Download size={18} />
            </button>
            <button className={styles.actionIconButton} title="Exportar movimientos">
              <Icons.Upload size={18} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          {/* FILTER SIDEBAR */}
          {showFilters && (
            <div style={{
              width: "240px", minWidth: "240px", borderRight: "1px solid #e2e8f0",
              padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem",
              fontSize: "0.8rem", backgroundColor: "#fafbfc",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.9rem" }}>Filtros</span>
                <button onClick={() => setShowFilters(false)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#94a3b8", padding: "2px", display: "flex",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
                >
                  <Icons.Close size={16} />
                </button>
              </div>

              {/* Banco multiselect */}
              <div>
                <div style={{ fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>Banco</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "150px", overflowY: "auto" }}>
                  {cuentasBancarias.filter((c: any) => c.iban).length === 0 ? (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Sin cuentas</span>
                  ) : (
                    cuentasBancarias.filter((c: any) => c.iban).map((c: any) => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.78rem" }}>
                        <input type="checkbox"
                          checked={filtros.bancosIds.includes(c.id)}
                          onChange={() => toggleBancoFilter(c.id)}
                          style={{ accentColor: "var(--primary-color, #475569)" }} />
                        {c.banco}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Tipo */}
              <div>
                <div style={{ fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>Debe / Haber</div>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  {["todos", "debe", "haber"].map(t => (
                    <button key={t} onClick={() => updateFiltro("tipoMovimiento", t as any)}
                      style={{
                        flex: 1, padding: "0.3rem 0", fontSize: "0.75rem", fontWeight: "600",
                        border: `1px solid ${filtros.tipoMovimiento === t ? "var(--primary-color, #475569)" : "#e2e8f0"}`,
                        backgroundColor: filtros.tipoMovimiento === t ? "color-mix(in srgb, var(--primary-color, #475569), transparent 90%)" : "#fff",
                        color: filtros.tipoMovimiento === t ? "var(--primary-color, #475569)" : "#64748b",
                        borderRadius: "0.375rem", cursor: "pointer",
                      }}
                    >
                      {t === "todos" ? "Todos" : t === "debe" ? "Debe" : "Haber"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha */}
              <div>
                <div style={{ fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>Fecha</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <input type="date" value={filtros.fechaDesde}
                    onChange={e => updateFiltro("fechaDesde", e.target.value)}
                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.4rem", border: "1px solid #e2e8f0", borderRadius: "0.3rem", width: "100%", boxSizing: "border-box" }} />
                  <span style={{ fontSize: "0.7rem", color: "#94a3b8", textAlign: "center" }}>hasta</span>
                  <input type="date" value={filtros.fechaHasta}
                    onChange={e => updateFiltro("fechaHasta", e.target.value)}
                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.4rem", border: "1px solid #e2e8f0", borderRadius: "0.3rem", width: "100%", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Importe */}
              <div>
                <div style={{ fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>Importe (€)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <input type="number" placeholder="Desde" value={filtros.importeMin}
                    onChange={e => updateFiltro("importeMin", e.target.value)}
                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.4rem", border: "1px solid #e2e8f0", borderRadius: "0.3rem", width: "100%", boxSizing: "border-box" }} />
                  <span style={{ fontSize: "0.7rem", color: "#94a3b8", textAlign: "center" }}>hasta</span>
                  <input type="number" placeholder="Hasta" value={filtros.importeMax}
                    onChange={e => updateFiltro("importeMax", e.target.value)}
                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.4rem", border: "1px solid #e2e8f0", borderRadius: "0.3rem", width: "100%", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Estado */}
              <div>
                <div style={{ fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>Estado</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {[
                    { value: "conciliado", label: "Ok" },
                    { value: "propuesto", label: "Matching" },
                    { value: "pendiente", label: "Pendiente" },
                  ].map(opt => (
                    <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.78rem" }}>
                      <input type="checkbox"
                        checked={filtros.estados.includes(opt.value)}
                        onChange={() => toggleEstadoFilter(opt.value)}
                        style={{ accentColor: "var(--primary-color, #475569)" }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Rango match */}
              <div>
                <div style={{ fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>Rango de match</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {[
                    { value: "bajos", label: "Bajos (60-79%)" },
                    { value: "medios", label: "Medios (80-90%)" },
                    { value: "altos", label: "Altos (>90%)" },
                  ].map(opt => (
                    <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.78rem" }}>
                      <input type="checkbox"
                        checked={filtros.matchRanges.includes(opt.value)}
                        onChange={() => toggleMatchRangeFilter(opt.value)}
                        style={{ accentColor: "var(--primary-color, #475569)" }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Limpiar filtros */}
              {(filtros.bancosIds.length > 0 || filtros.tipoMovimiento !== "todos" || filtros.fechaDesde || filtros.fechaHasta || filtros.importeMin || filtros.importeMax || filtros.estados.length > 0 || filtros.matchRanges.length > 0) && (
                <button onClick={() => {
                  setFiltros({
                    bancosIds: [], tipoMovimiento: "todos", fechaDesde: "", fechaHasta: "",
                    importeMin: "", importeMax: "", estados: [], matchRanges: [],
                  });
                }}
                  style={{
                    width: "100%", padding: "0.4rem",
                    backgroundColor: "#f1f5f9", color: "#475569",
                    border: "1px solid #e2e8f0", borderRadius: "0.375rem",
                    fontWeight: "600", fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Limpiar filtros
                </button>
              )}
              {/* Filtrar */}
              <button onClick={() => {
                setCurrentPage(1);
                loadData(filtros);
              }}
                style={{
                  width: "100%", padding: "0.5rem",
                  backgroundColor: "var(--primary-color, #475569)", color: "#fff",
                  border: "none", borderRadius: "0.375rem", fontWeight: "700", fontSize: "0.85rem",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem",
                }}
              >
                <Icons.Search size={14} />
                Filtrar
              </button>
            </div>
          )}

        <div className={styles.tableWrapper} style={{ flex: 1 }}>
          <table className={`${styles.table} bancoTable`}>
            <thead>
              <tr>
                <th style={{ width: "1%", paddingRight: "0" }}></th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>FECHA</th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>FEC. VALOR</th>
                <th>CONCEPTO</th>
                <th style={{ width: "1%", whiteSpace: "nowrap", textAlign: "center" }}>ESTADO</th>
                <th style={{ textAlign: "right" }}>IMPORTE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>
                    <div className="spinner" style={{ display: "inline-block", width: "24px", height: "24px", border: "3px solid #e2e8f0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: "0.5rem" }} />
                    <div>Cargando movimientos bancarios...</div>
                  </td>
                </tr>
              ) : bankMovements.map((mov) => {
                const bankName = mov.config_cuentas_bancarias?.banco || "Banco";
                const badge = getAccountBadgeStyle(bankName);
                const rawScore = mov.match_score ?? mov.match_metadatos?.score ?? 0;
                const normalizedScore = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
                const isPropuestoValido = mov.estado === "propuesto" && mov.match_metadatos && normalizedScore >= 70;
                const estadoBadge = getEstadoBadgeStyle(isPropuestoValido ? "propuesto" : (mov.estado === "propuesto" ? "pendiente" : mov.estado));
                return (
                  <Fragment key={mov.id}>
                    <tr>
                      <td style={{ width: "1%", paddingRight: "0" }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: badge.bg,
                          color: badge.color,
                          border: badge.border
                        }} title={badge.label}>
                          <Icons.Landmark size={12} />
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDate(mov.fecha_operacion)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDate(mov.fecha_valor)}</td>
                      <td style={{ maxWidth: "450px" }}>
                        <div className="bancoConceptText" title={mov.concepto_original || "Movimiento sin concepto"}>
                          <span className={styles.mainText} style={{ fontWeight: "600", color: "#0f172a" }}>
                            {mov.concepto_original || "Movimiento sin concepto"}
                          </span>
                        </div>
                      </td>
                      <td style={{ width: "1%", whiteSpace: "nowrap", textAlign: "center" }}>
                        {isPropuestoValido ? (
                          <MatchTooltipWrapper
                            label={estadoBadge.label}
                            badgeStyles={{
                              background: `linear-gradient(to right, color-mix(in srgb, var(--primary-color, #475569) 30%, white) ${normalizedScore}%, color-mix(in srgb, var(--primary-color, #475569) 10%, white) ${normalizedScore}%)`,
                              color: estadoBadge.color,
                              border: estadoBadge.border,
                            }}
                          >
                            {mov.importe < 0 ? (
                              <PagoPropuestoPorMatch
                                movimiento={{
                                  id: mov.id,
                                  importe: Number(mov.importe),
                                  fecha_operacion: mov.fecha_operacion || ""
                                }}
                                match={{
                                  origen: mov.match_metadatos.origen || "documento",
                                  expediente_id: mov.match_metadatos.expediente_id,
                                  expediente_numero: mov.match_metadatos.expediente_numero,
                                  expediente_referencia: mov.match_metadatos.expediente_referencia,
                                  documento_id: mov.match_metadatos.documento_id,
                                  servicio_id: mov.match_metadatos.servicio_id,
                                  proveedor_nombre: mov.match_metadatos.proveedor_nombre,
                                  proveedor_nif: mov.match_metadatos.proveedor_nif || "",
                                  match_score: normalizedScore,
                                  razon: mov.match_metadatos.razon || "",
                                  pagos: mov.match_metadatos.pagos || []
                                }}
                                onConciliado={() => {
                                  loadData(filtros);
                                }}
                              />
                            ) : (
                              <IngresoPropuestoPorMatch
                                movimiento={{
                                  id: mov.id,
                                  importe: Number(mov.importe),
                                  fecha_operacion: mov.fecha_operacion || ""
                                }}
                                match={{
                                  expediente_id: mov.match_metadatos.expediente_id,
                                  expediente_numero: mov.match_metadatos.expediente_numero,
                                  expediente_referencia: mov.match_metadatos.expediente_referencia,
                                  pagador_id: mov.match_metadatos.pagador_id,
                                  pagador_nombre: mov.match_metadatos.pagador_nombre,
                                  match_score: normalizedScore,
                                  razon: mov.match_metadatos.razon || "",
                                  importe_total: mov.match_metadatos.importe_total,
                                  importe_abonado: mov.match_metadatos.importe_abonado,
                                  viajeros: mov.match_metadatos.viajeros || []
                                }}
                                onConciliado={() => {
                                  loadData(filtros);
                                }}
                              />
                            )}
                          </MatchTooltipWrapper>
                        ) : (
                          <span style={{
                            display: "inline-block",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: "700",
                            background: estadoBadge.bg,
                            color: estadoBadge.color,
                            border: estadoBadge.border,
                            textTransform: "uppercase"
                          }}>
                            {estadoBadge.label}
                          </span>
                        )}
                      </td>
                      <td style={{ 
                        textAlign: "right",
                        fontWeight: "700", 
                        color: mov.importe >= 0 ? "#10b981" : "#ef4444" 
                      }}>
                        {formatImporte(mov.importe)}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {!loading && bankMovements.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>
                    No se encontraron movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {!loading && totalItems > 0 && (
            <Pagination 
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={rowsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(newRows) => {
                setRowsPerPage(newRows);
                setCurrentPage(1);
              }}
            />
          )}
        </div>
      </div>
      </div>

      {/* MODAL DE IMPORTACIÓN NORMA 43 */}
      <ImportarN43 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setCurrentPage(1);
          loadData(filtros);
        }}
        cuentasBancarias={cuentasBancarias}
      />

      {/* MODAL REPORTE MATCHING */}
      {matchReport && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)"
        }}>
          <div style={{
            backgroundColor: "#ffffff", borderRadius: "1rem", padding: "1.5rem", width: "320px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            fontFamily: '"Inter", sans-serif'
          }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: "700", color: "#0f172a", textAlign: "center" }}>Reporte de Matching</h3>
            
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
              <span style={{ color: "#64748b" }}>Procesados:</span>
              <span style={{ fontWeight: "700", color: "#0f172a" }}>{matchReport.procesados}</span>
            </div>
            
            <div style={{ backgroundColor: "#f8fafc", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem", fontSize: "0.8rem" }}>
                <span style={{ color: "#10b981", fontWeight: "600" }}>Alta (&ge;90%):</span>
                <span style={{ fontWeight: "700", color: "#0f172a" }}>{matchReport.altos}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem", fontSize: "0.8rem" }}>
                <span style={{ color: "var(--primary-color, #475569)", fontWeight: "600" }}>Media (60-89%):</span>
                <span style={{ fontWeight: "700", color: "#0f172a" }}>{matchReport.medios}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                <span style={{ color: "#f59e0b", fontWeight: "600" }}>Baja (30-59%):</span>
                <span style={{ fontWeight: "700", color: "#0f172a" }}>{matchReport.bajos}</span>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem", fontSize: "0.8rem", color: "#94a3b8" }}>
              <span>Tiempo de ejecución:</span>
              <span>{(matchReport.tiempoMs / 1000).toFixed(2)}s</span>
            </div>
            
            <button 
              onClick={() => setMatchReport(null)}
              style={{
                width: "100%", padding: "0.6rem", borderRadius: "0.5rem", border: "none",
                backgroundColor: "var(--primary-color, #475569)", color: "white",
                fontWeight: "600", fontSize: "0.85rem", cursor: "pointer"
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .premium-tooltip {
          animation: tooltipFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top right;
        }
        .bancoPageContainer .bancoTable td {
          vertical-align: middle !important;
          height: 48px !important;
          box-sizing: border-box !important;
          padding-top: 0.35rem !important;
          padding-bottom: 0.35rem !important;
        }
        .bancoPageContainer .bancoTable th {
          vertical-align: middle !important;
          height: 40px !important;
          box-sizing: border-box !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
        .bancoConceptText {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          white-space: normal !important;
          word-break: break-word;
          line-height: 1.4;
          max-height: calc(1.4em * 2);
        }
      `}</style>
    </div>
  );
}

