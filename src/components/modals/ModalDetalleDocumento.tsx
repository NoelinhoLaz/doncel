"use client";

import { CheckCircle2, AlertCircle, ArrowRight, Check } from "lucide-react";
import { Icons } from "@/lib/icons";
import { formatDate } from "@/lib/utils/date";
import { formatEuro } from "@/lib/utils/currency";
import { getPaymentStatusBadge } from "@/lib/utils/documentos";
import s from "./documentoModal.module.css";

interface Props {
  doc: any;
  payments: any[];
  loadingPayments: boolean;
  reconcilingPago: any | null;
  bankMovements: any[];
  loadingBank: boolean;
  selectedBankMovId: string | null;
  onSelectBankMov: (id: string) => void;
  reconcileLoading: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  onReconcile: () => void;
  onStartReconcile: (pago: any) => void;
  onCancelReconcile: () => void;
  onClose: () => void;
}

export default function ModalDetalleDocumento({ doc, payments, loadingPayments, reconcilingPago, bankMovements, loadingBank, selectedBankMovId, onSelectBankMov, reconcileLoading, successMessage, errorMessage, onReconcile, onStartReconcile, onCancelReconcile, onClose }: Props) {
  const payBadge = getPaymentStatusBadge(doc.estado_pago);
  const total = Number(doc.total_documento || 0);
  const pagado = Number(doc.importe_pagado || 0);

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={`${s.modal} ${reconcilingPago ? s.modalWide : s.modalNarrow}`} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <header className={s.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Icons.Documentos size={18} style={{ color: "var(--primary-color, #475569)" }} />
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Detalles del Documento y Conciliación</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icons.Close size={16} />
          </button>
        </header>

        <div className={s.body}>
          {/* LEFT PANEL */}
          <div className={s.leftPanel}>
            {successMessage && (
              <div className={s.successBanner}><CheckCircle2 size={16} /><span>{successMessage}</span></div>
            )}

            {/* Doc summary */}
            <div className={s.docSummary}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", margin: "0 0 0.15rem" }}>
                    {doc.extraccion_json?.cabecera?.proveedor_nombre || "Proveedor"}
                  </h4>
                  <p style={{ fontSize: "0.72rem", color: "#64748b", margin: 0 }}>
                    NIF: {doc.extraccion_json?.cabecera?.proveedor_nif || "No detectado"} · Tipo: {doc.documento_tipo}
                  </p>
                </div>
                <span style={{ padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.72rem", fontWeight: 700, backgroundColor: payBadge.bg, color: payBadge.color, border: payBadge.border, textTransform: "uppercase" }}>
                  {payBadge.text}
                </span>
              </div>
              <div style={{ width: "100%", height: "1px", backgroundColor: "#cbd5e1", margin: "0.5rem 0" }} />
              <div className={s.docSummaryGrid}>
                {[
                  { label: "Total Factura", value: formatEuro(total), color: "#0f172a" },
                  { label: "Abonado", value: formatEuro(pagado), color: "#16a34a" },
                  { label: "Pendiente", value: formatEuro(total - pagado), color: "#dc2626" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plazos */}
            <div>
              <h4 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "0.75rem" }}>
                Plazos y Cantidades de Pago{" "}
                <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "none", color: "#94a3b8" }}>(detectados por IA)</span>
              </h4>

              {loadingPayments ? (
                <div style={{ textAlign: "center", padding: "2rem" }}><span className={s.spinner} /></div>
              ) : payments.length === 0 ? (
                <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "0.5rem", padding: "1.5rem", textAlign: "center", color: "#64748b", fontSize: "0.78rem" }}>
                  No se han detectado plazos. El pago completo de {formatEuro(total)} se considera un único plazo.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {payments.map((pago: any) => {
                    const isReconciled = !!pago.movimiento_banco_id;
                    const isActive = reconcilingPago?.id === pago.id;
                    return (
                      <div key={pago.id} className={`${s.plazoCard} ${isActive ? s.plazoCardActive : ""}`}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}>{formatEuro(Number(pago.importe))}</span>
                            <span style={{ padding: "0.1rem 0.35rem", borderRadius: "0.25rem", fontSize: "0.62rem", fontWeight: 700, backgroundColor: "#f1f5f9", color: "#475569", textTransform: "uppercase" }}>
                              {pago.metodo_pago}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.15rem" }}>
                            Fecha: {formatDate(pago.fecha_movimiento)}{pago.referencia ? ` · Ref: ${pago.referencia}` : ""}
                          </div>
                          {isReconciled && pago.contabilidad_movimientos_banco && (
                            <div className={s.reconciledDetail}>
                              <Check size={10} />
                              <span>Conciliado con cargo del {formatDate(pago.contabilidad_movimientos_banco.fecha_operacion)} ({formatEuro(Math.abs(pago.contabilidad_movimientos_banco.importe))})</span>
                            </div>
                          )}
                        </div>
                        <div>
                          {isReconciled ? (
                            <span className={s.reconciledBadge}><Check size={11} /><span>Conciliado</span></span>
                          ) : (
                            <button onClick={() => onStartReconcile(pago)} style={{ padding: "0.3rem 0.65rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.72rem", fontWeight: 600, color: "#6366f1", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              Conciliar banco <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL — reconciliation */}
          {reconcilingPago && (
            <div className={s.rightPanel}>
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.15rem" }}>Cruzar con Extracto Bancario</h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  Buscando cargos por valor de <strong style={{ color: "#0f172a" }}>{formatEuro(Number(reconcilingPago.importe))}</strong>.
                </p>
              </div>

              {errorMessage && (
                <div className={s.errorBanner}><AlertCircle size={14} /><span>{errorMessage}</span></div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, minHeight: "200px" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Cargos Bancarios Disponibles ({bankMovements.length})
                </div>

                {loadingBank ? (
                  <div style={{ textAlign: "center", padding: "3rem 0" }}><span className={s.spinner} /></div>
                ) : bankMovements.length === 0 ? (
                  <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: "0.5rem", padding: "2rem 1rem", textAlign: "center", color: "#64748b", fontSize: "0.75rem" }}>
                    No hay movimientos bancarios de cargo pendientes de conciliar.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "250px", overflowY: "auto" }}>
                    {bankMovements.map((mov) => {
                      const isExact = Math.abs(Number(mov.importe)) === Number(reconcilingPago.importe);
                      const isSel = selectedBankMovId === mov.id;
                      return (
                        <div key={mov.id} onClick={() => onSelectBankMov(mov.id)} className={`${s.bankCard} ${isExact ? s.bankCardMatch : ""} ${isSel ? s.bankCardSelected : ""}`}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e293b" }}>{formatEuro(mov.importe)}</span>
                              {isExact && <span style={{ padding: "0.05rem 0.3rem", borderRadius: "0.2rem", fontSize: "0.6rem", fontWeight: 700, background: "#dcfce7", color: "#15803d", textTransform: "uppercase" }}>Recomendado</span>}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "230px" }} title={mov.concepto_original}>
                              {mov.concepto_original || "Sin concepto"}
                            </div>
                            <div style={{ fontSize: "0.65rem", color: "#64748b", marginTop: "0.15rem" }}>Fecha op: {formatDate(mov.fecha_operacion)}</div>
                          </div>
                          <div className={`${s.radioCircle} ${isSel ? s.radioCircleOn : ""}`}>
                            {isSel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                <button onClick={onCancelReconcile} style={{ flex: 1, padding: "0.45rem 1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.8rem", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={onReconcile} disabled={!selectedBankMovId || reconcileLoading} style={{ flex: 1.2, padding: "0.45rem 1rem", borderRadius: "0.375rem", border: "none", background: !selectedBankMovId || reconcileLoading ? "#cbd5e1" : "#6366f1", fontSize: "0.8rem", fontWeight: 600, color: "#fff", cursor: !selectedBankMovId || reconcileLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {reconcileLoading ? "Procesando..." : "Confirmar Conciliación"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
