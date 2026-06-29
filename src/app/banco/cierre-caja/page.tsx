"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { Banknote, Coins, Upload, Loader2, CheckCircle2, AlertCircle, XCircle, CreditCard } from "lucide-react";
import { getMovimientosCajaDia } from "@/actions/libroDiario";
import { guardarCierreCaja, getCierresCaja } from "@/actions/cierresCaja";
import type { CierreCaja } from "@/actions/cierresCaja";
import { RegistroTPV } from "@/components/tpv/RegistroTPV";
import listStyles from "../../expedientes/page.module.css";

// Denominations representing standard Euro coins and bills
const DENOMINATIONS = [
  { key: "500_billete", value: 500, label: "500 € (Billete)", isBill: true },
  { key: "200_billete", value: 200, label: "200 € (Billete)", isBill: true },
  { key: "100_billete", value: 100, label: "100 € (Billete)", isBill: true },
  { key: "50_billete", value: 50, label: "50 € (Billete)", isBill: true },
  { key: "20_billete", value: 20, label: "20 € (Billete)", isBill: true },
  { key: "10_billete", value: 10, label: "10 € (Billete)", isBill: true },
  { key: "5_billete", value: 5, label: "5 € (Billete)", isBill: true },
  { key: "2_moneda", value: 2, label: "2 € (Moneda)", isBill: false },
  { key: "1_moneda", value: 1, label: "1 € (Moneda)", isBill: false },
  { key: "050_moneda", value: 0.5, label: "0,50 € (Moneda)", isBill: false },
  { key: "020_moneda", value: 0.2, label: "0,20 € (Moneda)", isBill: false },
  { key: "010_moneda", value: 0.1, label: "0,10 € (Moneda)", isBill: false },
  { key: "005_moneda", value: 0.05, label: "0,05 € (Moneda)", isBill: false },
  { key: "002_moneda", value: 0.02, label: "0,02 € (Moneda)", isBill: false },
  { key: "001_moneda", value: 0.01, label: "0,01 € (Moneda)", isBill: false },
];

export default function CierreCajaPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tpvFisico, setTpvFisico] = useState<number | "">("");
  const [processingTicket, setProcessingTicket] = useState<boolean>(false);
  const [reconciliationResult, setReconciliationResult] = useState<any>(null);
  const [tpvError, setTpvError] = useState<string | null>(null);
  const [tpvModalOpen, setTpvModalOpen] = useState(false);
  const [arqueoModalOpen, setArqueoModalOpen] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [cerradoOk, setCerradoOk] = useState(false);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);

  useEffect(() => {
    getCierresCaja(10).then(setCierres);
  }, []);

  const handleTicketUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingTicket(true);
    setTpvError(null);

    try {
      const formData = new FormData();
      formData.append("tiquete_imagen", file);

      const res = await fetch("/api/tpv/conciliar-tiquete", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setTpvError(data.mensaje || data.error || "Error al conciliar tiquet");
        return;
      }

      setReconciliationResult(data.resultado);
      if (data.resultado?.validacion?.total_tiquete !== undefined) {
        setTpvFisico(data.resultado.validacion.total_tiquete);
      }
    } catch (err) {
      setTpvError(err instanceof Error ? err.message : "Error inesperado al subir el tiquet");
    } finally {
      setProcessingTicket(false);
      e.target.value = "";
    }
  };

  // Cash count physical state: denomination key -> quantity (defaults to 0)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    DENOMINATIONS.forEach((d) => {
      initial[d.key] = 0;
    });
    return initial;
  });

  // Fetch movements of the selected day
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getMovimientosCajaDia(selectedDate);
        setMovements(data || []);
      } catch (err) {
        console.error("Error loading day movements:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedDate]);

  // Separate cash and card movements
  const cashMovements = movements.filter((m) => m.medio_pago === "efectivo");
  const cardMovements = movements.filter((m) => m.medio_pago === "tarjeta");

  // Sum theoretical values
  const totalTeoricoEfectivo = cashMovements.reduce(
    (sum, m) => sum + Number(m.importe_total || 0),
    0
  );
  const totalTeoricoTarjeta = cardMovements.reduce(
    (sum, m) => sum + Number(m.importe_total || 0),
    0
  );

  // Handle quantity changes
  const handleQuantityChange = (key: string, val: number) => {
    const cleanVal = Math.max(0, isNaN(val) ? 0 : val);
    setQuantities((prev) => ({
      ...prev,
      [key]: cleanVal,
    }));
  };

  const handleIncrement = (key: string) => {
    setQuantities((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + 1,
    }));
  };

  const handleDecrement = (key: string) => {
    setQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) - 1),
    }));
  };

  const handleReset = () => {
    const reset: Record<string, number> = {};
    DENOMINATIONS.forEach((d) => {
      reset[d.key] = 0;
    });
    setQuantities(reset);
  };

  // Calculate physical total in real time
  const totalFisico = DENOMINATIONS.reduce((sum, d) => {
    const qty = quantities[d.key] || 0;
    return sum + qty * d.value;
  }, 0);

  const [activeTab, setActiveTab] = useState<"billetes" | "monedas">("billetes");

  const subtotalBilletes = DENOMINATIONS.filter((d) => d.isBill).reduce((sum, d) => {
    const qty = quantities[d.key] || 0;
    return sum + qty * d.value;
  }, 0);

  const subtotalMonedas = DENOMINATIONS.filter((d) => !d.isBill).reduce((sum, d) => {
    const qty = quantities[d.key] || 0;
    return sum + qty * d.value;
  }, 0);

  const diferencia = totalFisico - totalTeoricoEfectivo;

  const tpvFisicoNum = Number(tpvFisico || 0);
  const diferenciaTpv = tpvFisicoNum - totalTeoricoTarjeta;

  const formatEuro = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

  const handleCerrarCaja = async () => {
    setCerrando(true);
    const res = await guardarCierreCaja({
      fecha: selectedDate,
      efectivoTeorico: totalTeoricoEfectivo,
      tpvTeorico: totalTeoricoTarjeta,
      efectivoFisico: totalFisico,
      arqueoDetalle: quantities,
    });
    setCerrando(false);
    if (res.success) {
      setCerradoOk(true);
      setTimeout(() => setCerradoOk(false), 3000);
      getCierresCaja(10).then(setCierres);
    } else {
      alert("Error al cerrar caja: " + res.error);
    }
  };

  return (
    <div className={listStyles.container}>
      <style>{`
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
        .screen-hidden {
          display: none !important;
        }
        @media print {
          .screen-hidden {
            display: flex !important;
          }
          .print-hidden {
            display: none !important;
          }
          /* Hide parent layout elements during printing */
          header,
          aside,
          nav,
          div[class*="sidebar"] {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
            padding-top: 0 !important;
          }
          /* Collapse layout on print */
          body {
            background: white !important;
            color: black !important;
          }
          .main-grid {
            display: block !important;
          }
          .arqueo-container {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .arqueo-list {
            max-height: none !important;
            overflow: visible !important;
          }
          .arqueo-item {
            page-break-inside: avoid;
            background: #ffffff !important;
            border-bottom: 1px solid #cbd5e1 !important;
            display: flex !important;
          }
        }
      `}</style>
      {/* Header */}
      <header className={`${listStyles.header} print-hidden`} style={{ marginBottom: "1.5rem" }}>
        <div className={listStyles.headerRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={listStyles.title}>Cierre de Caja</h1>
            <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.2rem" }}>
              Control y arqueo físico del efectivo en mostrador y cobros por tarjeta.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#475569" }}>FECHA:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: "0.4rem 0.6rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  color: "#1e293b",
                  outline: "none",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
              />
            </div>
            <button
              onClick={handleCerrarCaja}
              disabled={cerrando}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "0.45rem 0.9rem", borderRadius: 8,
                border: "none",
                background: cerradoOk ? "#16a34a" : "var(--primary-color, #475569)",
                color: "#fff", fontSize: "0.82rem", fontWeight: 700,
                cursor: cerrando ? "default" : "pointer",
                opacity: cerrando ? 0.7 : 1, transition: "background 0.3s",
              }}
            >
              {cerrando ? (
                <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Cerrando...</>
              ) : cerradoOk ? (
                <><CheckCircle2 size={14} /> Guardado</>
              ) : (
                <><Icons.Export size={14} /> Cerrar caja</>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      {/* Main Grid Content */}
      <div className="main-grid" style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: "1.5rem",
        alignItems: "start"
      }}>
        {/* LEFT COLUMN: Theoretical movements */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* List 1: Card/Tarjeta (NOW FIRST) */}
          <div style={{
            background: "#ffffff",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <div style={{
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Icons.Asiento size={18} style={{ color: "#2563eb" }} />
                <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "#1e293b" }}>Movimientos de Tarjeta / TPV</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{
                  backgroundColor: "#dbeafe",
                  color: "#1e40af",
                  fontSize: "0.8rem",
                  fontWeight: "700",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "0.25rem"
                }}>
                  Teórico: {formatEuro(totalTeoricoTarjeta)}
                </span>
                <button
                  onClick={() => setTpvModalOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "0.25rem 0.6rem", borderRadius: 6,
                    border: "1px solid #cbd5e1", background: "#fff",
                    fontSize: "0.75rem", fontWeight: 600, color: "#475569",
                    cursor: "pointer", whiteSpace: "nowrap"
                  }}
                >
                  <CreditCard size={13} />
                  Registrar TPV
                </button>
              </div>
            </div>

            <div style={{ padding: "0.5rem" }}>
              {loading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Cargando cobros...</div>
              ) : cardMovements.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                  No se registraron cobros por tarjeta este día.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "0.5rem" }}>Cliente / Alumno</th>
                      <th style={{ padding: "0.5rem" }}>Concepto</th>
                      <th style={{ padding: "0.5rem" }}>Expediente</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardMovements.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.5rem", fontWeight: "600", color: "#1e293b" }}>
                          {m.entidad_nombre.toUpperCase()}
                        </td>
                        <td style={{ padding: "0.5rem", color: "#475569" }}>{m.concepto || "—"}</td>
                        <td style={{ padding: "0.5rem", color: "#64748b" }}>
                          <span style={{ backgroundColor: "#f1f5f9", padding: "0.15rem 0.35rem", borderRadius: "0.25rem", fontSize: "0.72rem", fontWeight: "700" }}>
                            {m.expediente_numero}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "600", color: "#1e293b" }}>
                          {formatEuro(m.importe_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <RegistroTPV
              selectedDate={selectedDate}
              onReconciliationComplete={(total) => setTpvFisico(total)}
              forceOpen={tpvModalOpen}
              onForceOpenChange={setTpvModalOpen}
            />
          </div>

          {/* List 2: Cash/Efectivo (NOW SECOND) */}
          <div style={{
            background: "#ffffff",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <div style={{
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Icons.Euro size={18} style={{ color: "#16a34a" }} />
                <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "#1e293b" }}>Movimientos de Efectivo</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ backgroundColor: "#dcfce7", color: "#15803d", fontSize: "0.8rem", fontWeight: "700", padding: "0.2rem 0.5rem", borderRadius: "0.25rem" }}>
                  Teórico: {formatEuro(totalTeoricoEfectivo)}
                </span>
                <button
                  onClick={() => setArqueoModalOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "0.25rem 0.6rem", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.75rem", fontWeight: 600, color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <Banknote size={13} />
                  Hacer arqueo
                </button>
              </div>
            </div>

            <div style={{ padding: "0.5rem" }}>
              {loading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Cargando cobros...</div>
              ) : cashMovements.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                  No se registraron cobros en efectivo este día.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "0.5rem" }}>Cliente / Alumno</th>
                      <th style={{ padding: "0.5rem" }}>Concepto</th>
                      <th style={{ padding: "0.5rem" }}>Expediente</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashMovements.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.5rem", fontWeight: "600", color: "#1e293b" }}>
                          {m.entidad_nombre.toUpperCase()}
                        </td>
                        <td style={{ padding: "0.5rem", color: "#475569" }}>{m.concepto || "—"}</td>
                        <td style={{ padding: "0.5rem", color: "#64748b" }}>
                          <span style={{ backgroundColor: "#f1f5f9", padding: "0.15rem 0.35rem", borderRadius: "0.25rem", fontSize: "0.72rem", fontWeight: "700" }}>
                            {m.expediente_numero}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "600", color: "#1e293b" }}>
                          {formatEuro(m.importe_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Historial cierres */}
        <div className="arqueo-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <HistorialCierres cierres={cierres} formatEuro={formatEuro} />

        </div>
      </div>

      {/* MODAL: Arqueo de Caja */}
      {arqueoModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px,100%)", maxHeight: "90vh", background: "#fff", borderRadius: 12, boxShadow: "0 20px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.25rem", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Banknote size={18} style={{ color: "#16a34a" }} />
                <span style={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>Arqueo de Caja Físico</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={handleReset} style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Icons.Close size={13} /> Reiniciar
                </button>
                <button onClick={() => setArqueoModalOpen(false)} style={{ border: "none", background: "transparent", fontSize: "1.3rem", color: "#64748b", cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", gap: "0.5rem" }}>
                {(["billetes", "monedas"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.55rem", border: "none", borderBottom: activeTab === tab ? "3px solid #2563eb" : "3px solid transparent", backgroundColor: "transparent", color: activeTab === tab ? "#2563eb" : "#64748b", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", marginBottom: "-1px" }}>
                    {tab === "billetes" ? <Banknote size={14} /> : <Coins size={14} />}
                    {tab === "billetes" ? `Billetes (${formatEuro(subtotalBilletes)})` : `Monedas (${formatEuro(subtotalMonedas)})`}
                  </button>
                ))}
              </div>

              {/* Denomination list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {DENOMINATIONS.map((d) => {
                  if (activeTab === "billetes" ? !d.isBill : d.isBill) return null;
                  const qty = quantities[d.key] || 0;
                  const sub = qty * d.value;
                  return (
                    <div key={d.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.6rem", borderRadius: "0.5rem", background: d.isBill ? "#f8fafc" : "#fff", border: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155", flex: 1 }}>{d.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.15rem", marginRight: "1rem" }}>
                        {(["−", "+"] as const).map((sym) => (
                          <button key={sym} onClick={() => sym === "−" ? handleDecrement(d.key) : handleIncrement(d.key)} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: 700, color: "#475569" }}>{sym}</button>
                        ))}
                        <input type="number" min="0" value={qty === 0 ? "" : qty} placeholder="0" onChange={(e) => handleQuantityChange(d.key, parseInt(e.target.value, 10))} style={{ width: 50, height: 24, textAlign: "center", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: "0.8rem", fontWeight: 700, color: "#1e293b", outline: "none", order: -1 }} />
                      </div>
                      <span style={{ width: 90, textAlign: "right", fontSize: "0.8rem", fontWeight: 700, color: sub > 0 ? "#0f172a" : "#94a3b8" }}>{formatEuro(sub)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div style={{ padding: "0.85rem", borderRadius: "0.75rem", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                {[
                  { label: "Total Teórico (Efectivo DB):", val: totalTeoricoEfectivo, bold: false },
                  { label: "Total Físico (Recuento):", val: totalFisico, bold: true },
                ].map(({ label, val, bold }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.45rem", fontSize: "0.8rem" }}>
                    <span style={{ color: "#64748b", fontWeight: 600 }}>{label}</span>
                    <span style={{ fontWeight: bold ? 800 : 700, color: "#1e293b" }}>{formatEuro(val)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a" }}>Diferencia:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: 800, color: diferencia === 0 ? "#16a34a" : diferencia > 0 ? "#2563eb" : "#ef4444" }}>{formatEuro(diferencia)}</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", background: diferencia === 0 ? "#dcfce7" : diferencia > 0 ? "#dbeafe" : "#fee2e2", color: diferencia === 0 ? "#15803d" : diferencia > 0 ? "#1e40af" : "#b91c1c" }}>
                      {diferencia === 0 ? "Cuadrada" : diferencia > 0 ? "Sobrante" : "Descuadre"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1rem", borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: "0.55rem", borderRadius: 6, background: "var(--primary-color, #475569)", border: "none", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icons.Export size={15} /> Imprimir
              </button>
              <button onClick={() => setArqueoModalOpen(false)} style={{ padding: "0.55rem 1rem", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistorialCierres({ cierres, formatEuro }: { cierres: CierreCaja[]; formatEuro: (n: number) => string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "0.75rem", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Banknote size={16} style={{ color: "#475569" }} />
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Historial de Cierres</span>
        </div>
        <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontStyle: "italic" }}>Últimos 10</span>
      </div>
      {cierres.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", fontStyle: "italic" }}>
          Sin cierres registrados aún.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              {["Día", "Efectivo", "TPV", "Dif. €"].map((h, i) => (
                <th key={h} style={{ padding: "0.45rem 0.75rem", fontWeight: 600, color: "#64748b", textAlign: i === 0 ? "left" : "right", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cierres.map((c) => {
              const dif = c.diferencia_efectivo;
              const color = dif === 0 ? "#16a34a" : dif > 0 ? "#2563eb" : "#ef4444";
              const bg = dif === 0 ? "#dcfce7" : dif > 0 ? "#dbeafe" : "#fee2e2";
              const label = dif === 0 ? "✓" : dif > 0 ? `+${formatEuro(dif)}` : formatEuro(dif);
              const [y, m, d] = c.fecha.split("-");
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#334155" }}>
                    <div>{`${d}/${m}/${y}`}</div>
                    {c.agente_nombre && <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 400 }}>{c.agente_nombre}</div>}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#0f172a", fontWeight: 600 }}>{formatEuro(c.efectivo_fisico)}</td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#0f172a", fontWeight: 600 }}>{formatEuro(c.tpv_fisico)}</td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.4rem", borderRadius: 9999, background: bg, color, whiteSpace: "nowrap" }}>{label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
