"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/lib/icons";
import { getCuentasContables, getEjerciciosDisponibles } from "@/actions/libroDiario";
import { getBalanceSumasSaldos, getApuntesDeSubcuenta, BalanceRowLevel2, ApunteDetalleLevel3 } from "@/actions/balanceSaldos";
import listStyles from "../../expedientes/page.module.css";
import Link from "next/link";

interface Level1Group {
  subcuenta: string;
  nombre_cuenta: string;
  total_debe: number;
  total_haber: number;
  saldo_final: number;
  hijos: BalanceRowLevel2[];
}

export default function BalanceSaldosPage() {
  const [ejercicios, setEjercicios] = useState<number[]>([]);
  const [cuentasContables, setCuentasContables] = useState<any[]>([]);
  const [ejercicioActivo, setEjercicioActivo] = useState<number | "">("");
  const [loading, setLoading] = useState(true);

  // Nivel 2 original y Nivel 1 calculado
  const [balanceNivel2, setBalanceNivel2] = useState<BalanceRowLevel2[]>([]);
  const [balanceNivel1, setBalanceNivel1] = useState<Level1Group[]>([]);

  // Estados de expansión colapsable
  const [expandedNivel1, setExpandedNivel1] = useState<Record<string, boolean>>({});
  const [expandedNivel2, setExpandedNivel2] = useState<Record<string, boolean>>({});

  // Carga perezosa de Nivel 3 (Apuntes)
  const [apuntesCache, setApuntesCache] = useState<Record<string, ApunteDetalleLevel3[]>>({});
  const [apuntesLoading, setApuntesLoading] = useState<Record<string, boolean>>({});

  // Cargar configuraciones iniciales
  useEffect(() => {
    async function loadConfig() {
      try {
        const [years, accounts] = await Promise.all([
          getEjerciciosDisponibles(),
          getCuentasContables()
        ]);
        setEjercicios(years || []);
        setCuentasContables(accounts || []);

        if (years && years.length > 0) {
          setEjercicioActivo(years[0]);
        } else {
          setEjercicioActivo(new Date().getFullYear());
        }
      } catch (error) {
        console.error("Error loading balance configurations:", error);
      }
    }
    loadConfig();
  }, []);

  // Cargar datos principales (Nivel 2) y calcular Nivel 1
  const loadBalanceData = useCallback(async (ejercicio: number) => {
    try {
      setLoading(true);
      const dataL2 = await getBalanceSumasSaldos(ejercicio);
      setBalanceNivel2(dataL2);

      // Limpiar cachés y expansiones al cambiar de ejercicio
      setApuntesCache({});
      setExpandedNivel1({});
      setExpandedNivel2({});

      // Crear mapa rápido para resolver nombres de Nivel 1 desde cuentasContables
      const parentAccountsMap: Record<string, string> = {};
      cuentasContables.forEach(c => {
        if (c.codigo && c.codigo.length === 3) {
          parentAccountsMap[c.codigo] = c.descripcion;
        }
      });

      // Mapeo por defecto de cuentas comunes en MOMO / Plan General Contable
      const fallbacksNivel1: Record<string, string> = {
        "430": "Clientes",
        "438": "Anticipos de clientes (Tutas/Viajes)",
        "572": "Bancos c/c",
        "400": "Proveedores",
        "407": "Anticipos a proveedores",
        "472": "Hacienda Pública, IVA soportado",
        "477": "Hacienda Pública, IVA devengado",
        "600": "Compras de mercaderías",
        "700": "Ventas de mercaderías",
      };

      // 🎯 Reducción en memoria (Frontend) para construir Nivel 1
      const grouped = dataL2.reduce((acc, curr) => {
        const raiz = curr.subcuenta.substring(0, 3);

        if (!acc[raiz]) {
          const dbNombre = parentAccountsMap[raiz];
          const fallbackNombre = fallbacksNivel1[raiz] || "Otras cuentas";
          
          acc[raiz] = {
            subcuenta: raiz,
            nombre_cuenta: dbNombre || fallbackNombre,
            total_debe: 0,
            total_haber: 0,
            saldo_final: 0,
            hijos: []
          };
        }

        acc[raiz].total_debe += curr.total_debe;
        acc[raiz].total_haber += curr.total_haber;
        acc[raiz].saldo_final += curr.saldo_final;
        acc[raiz].hijos.push(curr);

        return acc;
      }, {} as Record<string, Level1Group>);

      // Convertir a array ordenado por código
      const sortedNivel1 = Object.values(grouped).sort((a, b) =>
        a.subcuenta.localeCompare(b.subcuenta)
      );

      setBalanceNivel1(sortedNivel1);
    } catch (error) {
      console.error("Error loading balance sums/saldos list:", error);
    } finally {
      setLoading(false);
    }
  }, [cuentasContables]);

  useEffect(() => {
    if (ejercicioActivo) {
      loadBalanceData(Number(ejercicioActivo));
    }
  }, [loadBalanceData, ejercicioActivo]);

  // Manejar expansión y carga perezosa de Nivel 3 (Apuntes reales)
  const toggleNivel2 = async (subcuenta: string) => {
    const isExpanded = !!expandedNivel2[subcuenta];

    if (isExpanded) {
      // Colapsar
      setExpandedNivel2(prev => ({ ...prev, [subcuenta]: false }));
      return;
    }

    // Si ya está en caché, simplemente expandimos
    if (apuntesCache[subcuenta]) {
      setExpandedNivel2(prev => ({ ...prev, [subcuenta]: true }));
      return;
    }

    // Carga perezosa (Lazy Loading)
    try {
      setApuntesLoading(prev => ({ ...prev, [subcuenta]: true }));
      const apuntes = await getApuntesDeSubcuenta(subcuenta, Number(ejercicioActivo));
      setApuntesCache(prev => ({ ...prev, [subcuenta]: apuntes }));
      setExpandedNivel2(prev => ({ ...prev, [subcuenta]: true }));
    } catch (error) {
      console.error(`Error lazy loading entries for ${subcuenta}:`, error);
    } finally {
      setApuntesLoading(prev => ({ ...prev, [subcuenta]: false }));
    }
  };

  const toggleNivel1 = (codigo: string) => {
    setExpandedNivel1(prev => ({ ...prev, [codigo]: !prev[codigo] }));
  };

  const formatEuro = (val: number) => {
    if (val == null || Number.isNaN(val)) return "";
    if (val === 0) return "0,00 €";
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(val);
  };

  const formatSaldo = (val: number) => {
    if (val == null || Number.isNaN(val)) return "";
    const label = val > 0 ? " (D)" : val < 0 ? " (H)" : "";
    const color = val > 0 ? "#0f172a" : val < 0 ? "#dc2626" : "#64748b";
    return (
      <span style={{ color, fontWeight: "700" }}>
        {formatEuro(Math.abs(val))}
        {label && <span style={{ fontSize: "0.65rem", fontWeight: "600", color: "#94a3b8", marginLeft: "0.15rem" }}>{label}</span>}
      </span>
    );
  };

  // Sumas agregadas totales del informe completo
  const grandTotals = balanceNivel2.reduce(
    (acc, curr) => {
      acc.debe += curr.total_debe;
      acc.haber += curr.total_haber;
      acc.saldo += curr.saldo_final;
      return acc;
    },
    { debe: 0, haber: 0, saldo: 0 }
  );

  return (
    <div className={`${listStyles.container} balanceSaldosPageContainer`}>
      {/* CABECERA */}
      <header className={listStyles.header}>
        <div className={listStyles.headerRow}>
          <h1 className={listStyles.title}>Balance de Sumas y Saldos</h1>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        
        {/* PANEL DE FILTROS */}
        <div style={{
          background: "#ffffff",
          borderRadius: "0.75rem",
          border: "1px solid #f1f5f9",
          padding: "1.25rem",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Icons.Filter size={18} style={{ color: "var(--primary-color, #475569)" }} />
              <h2 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                Control y Ejercicio Fiscal
              </h2>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                Ejercicio contable:
              </label>
              <select
                value={ejercicioActivo}
                onChange={(e) => setEjercicioActivo(Number(e.target.value))}
                style={{
                  padding: "0.45rem 2.25rem 0.45rem 0.75rem",
                  fontSize: "0.8rem",
                  height: "36px",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1"
                }}
              >
                {ejercicios.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ESTRUCTURA DE ÁRBOL DESPLEGABLE */}
        <div className="balanceCard" style={{ overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
              <div className="spinner" style={{ display: "inline-block", width: "28px", height: "28px", border: "3px solid #f1f5f9", borderTopColor: "var(--primary-color, #475569)", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: "1rem" }} />
              <div style={{ fontWeight: "600", color: "#475569" }}>Calculando Balance de Sumas y Saldos...</div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.25rem" }}>Consultando libro mayor contable en tiempo real</div>
            </div>
          ) : balanceNivel1.length === 0 ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
              <Icons.Book size={40} style={{ color: "#94a3b8", marginBottom: "1rem" }} />
              <div style={{ fontWeight: "700", color: "#334155", fontSize: "1rem" }}>No se encontraron apuntes contables</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
                No existen movimientos registrados en el ejercicio fiscal {ejercicioActivo}.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="balanceTreeTable">
                <thead>
                  <tr>
                    <th style={{ width: "240px" }}>CÓDIGO / CUENTA CONTABLE</th>
                    <th>DESCRIPCIÓN / NOMBRE</th>
                    <th style={{ textAlign: "right", width: "160px" }}>TOTAL DEBE</th>
                    <th style={{ textAlign: "right", width: "160px" }}>TOTAL HABER</th>
                    <th style={{ textAlign: "right", width: "180px" }}>SALDO FINAL</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceNivel1.map((grupo) => {
                    const isGroupExpanded = !!expandedNivel1[grupo.subcuenta];
                    return (
                      <tr key={grupo.subcuenta} className="nivel1RowParent">
                        {/* REGISTRO NIVEL 1 */}
                        <td colSpan={5} style={{ padding: 0 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                              <tr
                                onClick={() => toggleNivel1(grupo.subcuenta)}
                                className="nivel1Row"
                                style={{ cursor: "pointer" }}
                              >
                                <td style={{ width: "240px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span className={`arrowIcon ${isGroupExpanded ? "rotated" : ""}`}>
                                      <Icons.ChevronRight size={14} />
                                    </span>
                                    <span className="badgeNivel1">{grupo.subcuenta}</span>
                                  </div>
                                </td>
                                <td style={{ fontWeight: "700", color: "#0f172a" }}>
                                  {grupo.nombre_cuenta}
                                </td>
                                <td style={{ textAlign: "right", width: "160px", fontWeight: "700", color: "#0f172a" }}>
                                  {formatEuro(grupo.total_debe)}
                                </td>
                                <td style={{ textAlign: "right", width: "160px", fontWeight: "700", color: "#64748b" }}>
                                  {formatEuro(grupo.total_haber)}
                                </td>
                                <td style={{ textAlign: "right", width: "180px" }}>
                                  {formatSaldo(grupo.saldo_final)}
                                </td>
                              </tr>

                              {/* REGISTROS NIVEL 2 */}
                              {isGroupExpanded &&
                                grupo.hijos.map((hijo) => {
                                  const isSubcuentaExpanded = !!expandedNivel2[hijo.subcuenta];
                                  const subcuentaLoading = !!apuntesLoading[hijo.subcuenta];
                                  const apuntes = apuntesCache[hijo.subcuenta] || [];

                                  return (
                                    <tr key={hijo.subcuenta} className="nivel2RowParent">
                                      <td colSpan={5} style={{ padding: 0 }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                          <tbody>
                                            <tr
                                              onClick={() => toggleNivel2(hijo.subcuenta)}
                                              className="nivel2Row"
                                              style={{ cursor: "pointer" }}
                                            >
                                              <td style={{ width: "240px", paddingLeft: "2.25rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                  {subcuentaLoading ? (
                                                    <Icons.RefreshCw size={12} className="spin" style={{ color: "#94a3b8" }} />
                                                  ) : (
                                                    <span className={`arrowIcon ${isSubcuentaExpanded ? "rotated" : ""}`}>
                                                      <Icons.ChevronRight size={12} />
                                                    </span>
                                                  )}
                                                  <span className="badgeNivel2">
                                                    {hijo.subcuenta}
                                                  </span>
                                                </div>
                                              </td>
                                              <td style={{ color: "#334155", fontWeight: "600", fontSize: "0.82rem" }}>
                                                {hijo.nombre_cuenta}
                                              </td>
                                              <td style={{ textAlign: "right", width: "160px", fontWeight: "600", color: "#334155", fontSize: "0.8rem" }}>
                                                {formatEuro(hijo.total_debe)}
                                              </td>
                                              <td style={{ textAlign: "right", width: "160px", fontWeight: "600", color: "#64748b", fontSize: "0.8rem" }}>
                                                {formatEuro(hijo.total_haber)}
                                              </td>
                                              <td style={{ textAlign: "right", width: "180px", fontSize: "0.8rem" }}>
                                                {formatSaldo(hijo.saldo_final)}
                                              </td>
                                            </tr>

                                            {/* NIVEL 3 (APUNTES REALES) */}
                                            {isSubcuentaExpanded && (
                                              <tr>
                                                <td colSpan={5} className="nivel3Cell">
                                                  {apuntes.length === 0 ? (
                                                    <div className="noApuntes">No existen apuntes en esta subcuenta.</div>
                                                  ) : (
                                                    <table className="nivel3Table">
                                                      <thead>
                                                        <tr>
                                                          <th style={{ width: "100px" }}>FECHA</th>
                                                          <th style={{ width: "130px" }}>ASIENTO</th>
                                                          <th>CONCEPTO APUNTE</th>
                                                          <th style={{ textAlign: "right", width: "130px" }}>DEBE</th>
                                                          <th style={{ textAlign: "right", width: "130px" }}>HABER</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {apuntes.map((ap) => (
                                                          <tr key={ap.id}>
                                                            <td style={{ whiteSpace: "nowrap" }}>
                                                              {new Date(ap.asiento_fecha).toLocaleDateString("es-ES")}
                                                            </td>
                                                            <td>
                                                              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                                <span className="asientoLinkBadge">{ap.asiento_numero}</span>
                                                                <Link
                                                                  href={`/banco/diario?search=${ap.asiento_numero}`}
                                                                  title="Ver en el Libro Diario"
                                                                  style={{ display: "inline-flex", color: "#3b82f6" }}
                                                                  className="asientoFloatLink"
                                                                >
                                                                  <Icons.ChevronRight size={12} />
                                                                </Link>
                                                              </div>
                                                            </td>
                                                            <td style={{ color: "#475569", fontStyle: "italic" }}>
                                                              {ap.concepto || "—"}
                                                            </td>
                                                            <td style={{ textAlign: "right", fontWeight: "600", color: "#0f172a" }}>
                                                              {formatEuro(ap.debe)}
                                                            </td>
                                                            <td style={{ textAlign: "right", fontWeight: "600", color: "#64748b" }}>
                                                              {formatEuro(ap.haber)}
                                                            </td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                    </table>
                                                  )}
                                                </td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="tfootSummaryRow">
                    <td colSpan={2} style={{ textAlign: "left", fontWeight: "800", color: "#0f172a", paddingLeft: "1.25rem" }}>
                      Saldo final
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "800", color: "#0f172a" }}>
                      {formatEuro(grandTotals.debe)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "800", color: "#64748b" }}>
                      {formatEuro(grandTotals.haber)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                      {formatSaldo(grandTotals.saldo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }

        .balanceCard {
          background: #ffffff;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .balanceTreeTable {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }

        .balanceTreeTable th {
          background-color: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #475569;
          font-weight: 700;
          padding: 0.75rem 1.25rem;
          text-align: left;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Nivel 1 Row styling */
        .nivel1Row {
          background-color: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
          transition: background-color 0.1s ease;
        }
        .nivel1Row:hover {
          background-color: #e2e8f0;
        }
        .nivel1Row td {
          padding: 0.65rem 1.25rem;
          vertical-align: middle;
        }

        /* Nivel 2 Row styling */
        .nivel2Row {
          background-color: #ffffff;
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.1s ease;
        }
        .nivel2Row:hover {
          background-color: #f8fafc;
        }
        .nivel2Row td {
          padding: 0.45rem 1.25rem;
          vertical-align: middle;
        }

        /* Badge PGC styling */
        .badgeNivel1 {
          background-color: #334155;
          color: #ffffff;
          font-size: 0.72rem;
          font-weight: 800;
          padding: 0.125rem 0.45rem;
          border-radius: 0.25rem;
          letter-spacing: 0.02em;
        }

        .badgeNivel2 {
          background-color: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.1rem 0.35rem;
          border-radius: 0.25rem;
          font-family: monospace;
        }

        /* Arrow animation */
        .arrowIcon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          transition: transform 0.2s ease;
        }
        .arrowIcon.rotated {
          transform: rotate(90deg);
        }

        /* Nivel 3 detailed cell */
        .nivel3Cell {
          background-color: #fafbfe;
          padding: 0.5rem 1.25rem 0.75rem 3.5rem !important;
          border-bottom: 1px solid #e2e8f0;
        }

        .noApuntes {
          font-size: 0.75rem;
          color: #94a3b8;
          font-style: italic;
          padding: 0.5rem 0;
        }

        .nivel3Table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);
          overflow: hidden;
        }

        .nivel3Table th {
          background-color: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-weight: 700;
          padding: 0.35rem 0.75rem;
          font-size: 0.68rem;
        }

        .nivel3Table td {
          padding: 0.35rem 0.75rem;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: middle;
        }

        .nivel3Table tr:last-child td {
          border-bottom: none;
        }

        .nivel3Table tr:hover {
          background-color: #fafbfe;
        }

        .asientoLinkBadge {
          background-color: #f1f5f9;
          color: #475569;
          font-weight: 700;
          padding: 0.05rem 0.3rem;
          border-radius: 0.25rem;
          font-size: 0.68rem;
        }

        .asientoFloatLink {
          opacity: 0.6;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .asientoFloatLink:hover {
          opacity: 1;
          transform: translateX(2px);
        }

        /* Summary Tfoot Row */
        .tfootSummaryRow {
          background-color: #f1f5f9;
          border-top: 2px solid #cbd5e1;
        }
        .tfootSummaryRow td {
          padding: 0.75rem 1.25rem;
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  );
}
