"use client";

import { useState, useEffect, useMemo } from "react";
import { Icons } from "@/lib/icons";
import { validateSpanishNifDetailed } from "@/lib/utils/validation";
import { formatEuro } from "@/lib/utils/currency";
import type { NifValidationResult } from "@/lib/types/facturacion";
import {
  getPagadoresInvoicingStatus,
  crearFacturasMasivas,
  type PagadorInvoicingStatus,
  type CrearFacturaItem,
} from "@/actions/facturacion";
import styles from "./facturar.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  onSuccess: () => void;
}

const DEFAULT_REAV =
  "Servicios de viaje correspondientes al Expediente: {referencia} (Viajero: {viajero}). Precio con IVA incluido. Régimen Especial de las Agencias de Viajes.";
const DEFAULT_GENERAL =
  "Organización, gestión y prestación de servicios de transporte y estancia según programa para el Expediente: {referencia} (Viajero: {viajero})";

export default function ModalFacturar({ isOpen, onClose, expedienteId, onSuccess }: Props) {
  const [pagadoresStatus, setPagadoresStatus] = useState<PagadorInvoicingStatus[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [regimenOverride, setRegimenOverride] = useState<Record<string, "REAV" | "GENERAL">>({});

  const [step, setStep] = useState(1);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [excepcionesEmail, setExcepcionesEmail] = useState<Set<string>>(new Set());
  const [declararAeat, setDeclararAeat] = useState(true);
  const [excepcionesAeat, setExcepcionesAeat] = useState<Set<string>>(new Set());
  const [expandExcepcionesEmail, setExpandExcepcionesEmail] = useState(false);
  const [expandExcepcionesAeat, setExpandExcepcionesAeat] = useState(false);

  const [conceptoReav, setConceptoReav] = useState(DEFAULT_REAV);
  const [conceptoGeneral, setConceptoGeneral] = useState(DEFAULT_GENERAL);

  const [emitting, setEmitting] = useState(false);
  const [emitError, setEmitError] = useState<string | null>(null);
  const [emitSuccess, setEmitSuccess] = useState(false);

  const [validandoNifs, setValidandoNifs] = useState(false);
  const [nifResults, setNifResults] = useState<NifValidationResult[]>([]);
  const [expandNifDetails, setExpandNifDetails] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingModal(true);
    setStep(1);
    setModalSearch("");
    setEmitError(null);
    setEmitSuccess(false);
    setNifResults([]);
    setExcepcionesEmail(new Set());
    setExcepcionesAeat(new Set());
    setExpandExcepcionesEmail(false);
    setExpandExcepcionesAeat(false);
    setEnviarEmail(true);
    setDeclararAeat(true);

    getPagadoresInvoicingStatus(expedienteId).then((data) => {
      setPagadoresStatus(data);
      const withPending = data.filter((p) => p.importe_a_facturar > 0);
      setSelectedIds(new Set(withPending.map((p) => p.entidad_id)));
      setRegimenOverride({});
      setLoadingModal(false);
    });
  }, [isOpen, expedienteId]);

  const filteredPagadores = useMemo(() => {
    const term = modalSearch.toLowerCase();
    if (!term) return pagadoresStatus;
    return pagadoresStatus.filter(
      (p) =>
        p.cliente_nombre.toLowerCase().includes(term) ||
        p.cliente_nif.toLowerCase().includes(term)
    );
  }, [pagadoresStatus, modalSearch]);

  const allPendingIds = useMemo(
    () => filteredPagadores.filter((p) => p.importe_a_facturar > 0).map((p) => p.entidad_id),
    [filteredPagadores]
  );

  const allSelected =
    allPendingIds.length > 0 && allPendingIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) allPendingIds.forEach((id) => next.delete(id));
    else allPendingIds.forEach((id) => next.add(id));
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const getRegimen = (p: PagadorInvoicingStatus): "REAV" | "GENERAL" =>
    regimenOverride[p.entidad_id] ?? p.regimen_iva;

  const selectedPagadores = pagadoresStatus.filter((p) => selectedIds.has(p.entidad_id));
  const pendingSelected = selectedPagadores.filter((p) => p.importe_a_facturar > 0);
  const totalAEmitir = pendingSelected.reduce((s, p) => s + p.importe_a_facturar, 0);

  const handleContinuar = async () => {
    if (pendingSelected.length === 0) return;
    setValidandoNifs(true);
    setNifResults([]);
    setExpandNifDetails(false);
    await new Promise((r) => setTimeout(r, 180));
    const results: NifValidationResult[] = pendingSelected.map((p) => ({
      entidad_id: p.entidad_id,
      nombre: p.cliente_nombre,
      nif: p.cliente_nif,
      ...validateSpanishNifDetailed(p.cliente_nif),
    }));
    setNifResults(results);
    setValidandoNifs(false);
    setStep(2);
  };

  const handleEmitir = async () => {
    if (pendingSelected.length === 0) return;
    setEmitting(true);
    setEmitError(null);

    const items: CrearFacturaItem[] = pendingSelected.map((p) => {
      const isReav = getRegimen(p) === "REAV";
      const template = isReav ? conceptoReav : conceptoGeneral;
      return {
        pagadorId: p.entidad_id,
        importe: p.importe_a_facturar,
        regimenIva: getRegimen(p),
        concepto: template
          .replaceAll("{referencia}", p.expediente_referencia || "Expediente")
          .replaceAll("{viajero}", p.viajero_nombre || p.cliente_nombre),
        clienteNombre: p.cliente_nombre,
        clienteNif: p.cliente_nif,
        declararAeat: declararAeat && !excepcionesAeat.has(p.entidad_id),
      };
    });

    const result = await crearFacturasMasivas(expedienteId, items);
    if (!result.success) {
      setEmitError(result.error || "Error desconocido");
      setEmitting(false);
      return;
    }

    setEmitSuccess(true);
    setEmitting(false);
    onSuccess();
    setTimeout(() => {
      onClose();
      setEmitSuccess(false);
    }, 1200);
  };

  const toggleExcepcion = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  if (!isOpen) return null;

  const nifVerified = nifResults.filter((r) => r.valid);
  const nifUnverified = nifResults.filter((r) => !r.valid);
  const allNifsGood = nifResults.length > 0 && nifUnverified.length === 0;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div className={styles.headerIconWrap}>
              <Icons.Facturacion size={18} style={{ color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Facturar Cobros</div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                {validandoNifs
                  ? "Validando NIFs..."
                  : step === 1
                    ? "Paso 1: Selecciona los clientes y regímenes"
                    : "Paso 2: Validación y opciones de envío"}
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={emitting}>
            <Icons.Close size={20} />
          </button>
        </div>

        {/* Wizard track */}
        <div
          className={`${styles.wizardTrack} ${validandoNifs ? styles.wizardTrackNoTransition : ""}`}
          style={{ transform: step === 1 ? "translateX(0)" : "translateX(-50%)" }}
        >
          {/* PASO 1 */}
          <div className={styles.step}>
            <div className={styles.searchBarWrap}>
              <div className={styles.searchBar}>
                <Icons.Search size={15} style={{ color: "#94a3b8", flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className={styles.searchInput}
                  autoFocus
                />
              </div>
            </div>

            <div className={styles.tableBody}>
              {loadingModal ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                  Calculando saldos pendientes...
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }}>
                      <th style={{ width: 32, padding: "0.35rem 0.6rem" }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          disabled={allPendingIds.length === 0}
                          style={{ cursor: "pointer" }}
                          title="Seleccionar todos"
                        />
                      </th>
                      {["Cliente", "Abonado", "Facturado", "A Facturar", "Régimen"].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            padding: "0.35rem 0.6rem",
                            fontSize: "0.63rem",
                            fontWeight: 600,
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            textAlign: i === 0 ? "left" : i < 4 ? "right" : "center",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPagadores.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                          No hay pagadores con importes cobrados.
                        </td>
                      </tr>
                    )}
                    {filteredPagadores.map((p) => {
                      const isSelected = selectedIds.has(p.entidad_id);
                      const hasPending = p.importe_a_facturar > 0;
                      const regimen = getRegimen(p);
                      return (
                        <tr
                          key={p.entidad_id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: isSelected && hasPending ? "rgba(99,102,241,0.03)" : "transparent",
                            opacity: hasPending ? 1 : 0.55,
                          }}
                        >
                          <td style={{ padding: "0.3rem 0.6rem", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => hasPending && toggleOne(p.entidad_id)}
                              disabled={!hasPending}
                              style={{ cursor: hasPending ? "pointer" : "not-allowed" }}
                            />
                          </td>
                          <td style={{ padding: "0.3rem 0.6rem" }}>
                            <div style={{ fontWeight: 600, fontSize: "0.78rem", color: "#1e293b", lineHeight: 1.2 }}>
                              {p.cliente_nombre}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{p.cliente_nif || "Sin NIF"}</div>
                          </td>
                          <td style={{ padding: "0.3rem 0.6rem", textAlign: "right", fontSize: "0.78rem", color: "#475569" }}>
                            {formatEuro(p.importe_abonado)}
                          </td>
                          <td style={{ padding: "0.3rem 0.6rem", textAlign: "right", fontSize: "0.78rem", color: p.importe_facturado > 0 ? "#059669" : "#94a3b8" }}>
                            {p.importe_facturado > 0 ? formatEuro(p.importe_facturado) : "—"}
                          </td>
                          <td style={{ padding: "0.3rem 0.6rem", textAlign: "right", fontWeight: 700, fontSize: "0.8rem", color: hasPending ? "#1e293b" : "#94a3b8" }}>
                            {hasPending ? formatEuro(p.importe_a_facturar) : "Ya facturado"}
                          </td>
                          <td style={{ padding: "0.3rem 0.6rem", textAlign: "center" }}>
                            <select
                              value={regimen}
                              onChange={(e) =>
                                setRegimenOverride((prev) => ({
                                  ...prev,
                                  [p.entidad_id]: e.target.value as "REAV" | "GENERAL",
                                }))
                              }
                              disabled={!hasPending}
                              style={{
                                fontSize: "0.6rem", fontWeight: 700,
                                padding: "0.05rem 0.2rem", borderRadius: "0.25rem",
                                border: "1px solid",
                                borderColor: regimen === "REAV" ? "#c7d2fe" : "#a7f3d0",
                                background: regimen === "REAV" ? "#eef2ff" : "#ecfdf5",
                                color: regimen === "REAV" ? "#4f46e5" : "#047857",
                                cursor: hasPending ? "pointer" : "not-allowed",
                                outline: "none", appearance: "none",
                                WebkitAppearance: "none", MozAppearance: "none",
                                minWidth: "62px", textAlign: "center",
                              }}
                            >
                              <option value="REAV">REAV</option>
                              <option value="GENERAL">GENERAL</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.footer}>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{pendingSelected.length}</span>{" "}
                cliente{pendingSelected.length !== 1 ? "s" : ""} ·{" "}
                <span style={{ fontWeight: 700, color: "var(--primary-color, #475569)" }}>
                  {formatEuro(totalAEmitir)}
                </span>
              </div>
              <div className={styles.footerBtns}>
                <button className={styles.btnCancel} onClick={onClose}>Cancelar</button>
                <button
                  className={styles.btnContinue}
                  onClick={handleContinuar}
                  disabled={validandoNifs || pendingSelected.length === 0}
                >
                  {validandoNifs ? (
                    <><Icons.RefreshCw size={14} className={styles.spin} /> Validando NIFs...</>
                  ) : (
                    <>Continuar <Icons.ChevronRight size={14} /></>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* PASO 2 */}
          <div className={`${styles.step} ${styles.step2}`}>
            <div className={styles.step2Body}>
              <div className={styles.confirmTitle}>
                <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.2rem" }}>
                  Confirmar Emisión de Facturas
                </h4>
                <p style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.4 }}>
                  Se van a generar{" "}
                  <strong style={{ color: "var(--primary-color, #475569)" }}>{pendingSelected.length} facturas</strong>{" "}
                  por un total de{" "}
                  <strong style={{ color: "#059669", fontWeight: 700 }}>{formatEuro(totalAEmitir)}</strong>.
                </p>
              </div>

              {/* NIF validation block */}
              {nifResults.length > 0 && (
                <div
                  className={styles.nifBlock}
                  style={{
                    border: `1px solid ${allNifsGood ? "#dcfce7" : nifUnverified.length === nifResults.length ? "#fecaca" : "#fef08a"}`,
                    background: allNifsGood ? "#f0fdf4" : nifUnverified.length === nifResults.length ? "#fff5f5" : "#fefce8",
                  }}
                >
                  <div
                    className={styles.nifBlockHeader}
                    style={{ borderBottom: expandNifDetails ? `1px solid ${allNifsGood ? "#bbf7d0" : "#fde68a"}` : "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>
                        Validación NIF
                      </span>
                      {nifVerified.length > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", fontWeight: 700, background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: "9999px", padding: "0.1rem 0.5rem" }}>
                          <span style={{ fontSize: "0.65rem" }}>✓</span> {nifVerified.length} verificado{nifVerified.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {nifUnverified.length > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", fontWeight: 700, background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "9999px", padding: "0.1rem 0.5rem" }}>
                          <span style={{ fontSize: "0.65rem" }}>✗</span> {nifUnverified.length} no verificado{nifUnverified.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandNifDetails(!expandNifDetails)}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}
                    >
                      Ver detalles
                      <Icons.ChevronDown size={12} style={{ transform: expandNifDetails ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </button>
                  </div>
                  {expandNifDetails && (
                    <div className={styles.nifDetailRows}>
                      {nifVerified.length > 0 && (
                        <>
                          <div style={{ fontSize: "0.6rem", fontWeight: 800, color: "#15803d", textTransform: "uppercase" }}>Verificados</div>
                          {nifVerified.map((r) => (
                            <div key={r.entidad_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.7rem", padding: "0.15rem 0.4rem", borderRadius: "0.35rem", background: "rgba(21,128,61,0.06)" }}>
                              <span style={{ fontWeight: 600, color: "#1e293b" }}>{r.nombre}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                <span style={{ fontFamily: "monospace", color: "#475569", fontSize: "0.65rem" }}>{r.nif}</span>
                                <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: "0.2rem", padding: "0 0.25rem" }}>{r.type}</span>
                                <span style={{ fontSize: "0.65rem", color: "#15803d" }}>✓</span>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {nifUnverified.length > 0 && (
                        <>
                          <div style={{ fontSize: "0.6rem", fontWeight: 800, color: "#b91c1c", textTransform: "uppercase", marginTop: nifVerified.length > 0 ? "0.35rem" : 0 }}>No verificados</div>
                          {nifUnverified.map((r) => (
                            <div key={r.entidad_id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", fontSize: "0.7rem", padding: "0.2rem 0.4rem", borderRadius: "0.35rem", background: "rgba(185,28,28,0.05)", gap: "0.5rem" }}>
                              <div>
                                <span style={{ fontWeight: 600, color: "#1e293b" }}>{r.nombre}</span>
                                {r.reason && <div style={{ fontSize: "0.62rem", color: "#ef4444", marginTop: "0.05rem" }}>{r.reason}</div>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
                                <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: "0.65rem" }}>{r.nif || "(vacío)"}</span>
                                <span style={{ fontSize: "0.65rem", color: "#ef4444" }}>✗</span>
                              </div>
                            </div>
                          ))}
                          <p style={{ fontSize: "0.62rem", color: "#92400e", marginTop: "0.3rem", padding: "0.25rem 0.35rem", background: "#fffbeb", borderRadius: "0.3rem", border: "1px solid #fde68a" }}>
                            ⚠ Los NIFs no verificados podrían ser rechazados por la AEAT. Puedes continuar pero se recomienda corregirlos antes de emitir.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Toggles */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1rem" }}>
                {/* Toggle Email */}
                <div className={styles.toggleCard}>
                  <div className={styles.toggleRow}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b" }}>Enviar por Email automáticamente</span>
                    <div
                      className={styles.toggleSwitch}
                      onClick={() => setEnviarEmail(!enviarEmail)}
                      style={{ background: enviarEmail ? "var(--primary-color, #475569)" : "#cbd5e1" }}
                    >
                      <div className={styles.toggleKnob} style={{ left: enviarEmail ? "20px" : "2px" }} />
                    </div>
                  </div>
                  {enviarEmail && (
                    <div className={styles.toggleExpand}>
                      <p style={{ fontSize: "0.72rem", color: "#64748b" }}>
                        Se enviará el PDF a los {pendingSelected.length - excepcionesEmail.size} tutores.{" "}
                        <span className={styles.toggleLinkBtn} onClick={() => setExpandExcepcionesEmail(!expandExcepcionesEmail)}>
                          [ Editar excepciones ({excepcionesEmail.size})
                          <Icons.ChevronDown size={12} style={{ transform: expandExcepcionesEmail ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                          ]
                        </span>
                      </p>
                      {expandExcepcionesEmail && (
                        <div>
                          <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>Haga clic para excluir del envío automático:</p>
                          <div className={styles.excepcionesGrid}>
                            {pendingSelected.map((p) => {
                              const isExcluded = excepcionesEmail.has(p.entidad_id);
                              return (
                                <div
                                  key={p.entidad_id}
                                  onClick={() => toggleExcepcion(excepcionesEmail, setExcepcionesEmail, p.entidad_id)}
                                  style={{ padding: "0.15rem 0.4rem", borderRadius: "0.25rem", border: "1px solid", borderColor: isExcluded ? "#ef4444" : "#e2e8f0", background: isExcluded ? "#fef2f2" : "#ffffff", color: isExcluded ? "#ef4444" : "#475569", fontSize: "0.65rem", fontWeight: isExcluded ? 700 : 500, cursor: "pointer", userSelect: "none" }}
                                >
                                  {p.cliente_nombre} {isExcluded ? "❌" : ""}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Toggle AEAT */}
                <div className={styles.toggleCard}>
                  <div className={styles.toggleRow}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b" }}>Enviar a AEAT (Verifactu)</span>
                    <div
                      className={styles.toggleSwitch}
                      onClick={() => setDeclararAeat(!declararAeat)}
                      style={{ background: declararAeat ? "var(--primary-color, #475569)" : "#cbd5e1" }}
                    >
                      <div className={styles.toggleKnob} style={{ left: declararAeat ? "20px" : "2px" }} />
                    </div>
                  </div>
                  {declararAeat && (
                    <div className={styles.toggleExpand}>
                      <p style={{ fontSize: "0.72rem", color: "#64748b" }}>
                        Se certificará el lote en el sistema Verifactu de Hacienda.{" "}
                        <span className={styles.toggleLinkBtn} onClick={() => setExpandExcepcionesAeat(!expandExcepcionesAeat)}>
                          [ Editar excepciones ({excepcionesAeat.size})
                          <Icons.ChevronDown size={12} style={{ transform: expandExcepcionesAeat ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                          ]
                        </span>
                      </p>
                      {expandExcepcionesAeat && (
                        <div>
                          <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>Haga clic para excluir de la declaración:</p>
                          <div className={styles.excepcionesGrid}>
                            {pendingSelected.map((p) => {
                              const isExcluded = excepcionesAeat.has(p.entidad_id);
                              return (
                                <div
                                  key={p.entidad_id}
                                  onClick={() => toggleExcepcion(excepcionesAeat, setExcepcionesAeat, p.entidad_id)}
                                  style={{ padding: "0.15rem 0.4rem", borderRadius: "0.25rem", border: "1px solid", borderColor: isExcluded ? "#ef4444" : "#e2e8f0", background: isExcluded ? "#fef2f2" : "#ffffff", color: isExcluded ? "#ef4444" : "#475569", fontSize: "0.65rem", fontWeight: isExcluded ? 700 : 500, cursor: "pointer", userSelect: "none" }}
                                >
                                  {p.cliente_nombre} {isExcluded ? "❌" : ""}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Concept templates */}
              <div className={styles.conceptCard}>
                <h5 style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.45rem" }}>
                  Plantillas de Concepto (Leyes AEAT)
                </h5>
                <div style={{ marginBottom: "0.6rem" }}>
                  <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "0.15rem" }}>
                    Régimen Especial (REAV) — IVA Incluido
                  </label>
                  <textarea
                    value={conceptoReav}
                    onChange={(e) => setConceptoReav(e.target.value)}
                    className={styles.conceptTextarea}
                  />
                </div>
                <div style={{ marginBottom: "0.6rem" }}>
                  <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "0.15rem" }}>
                    Régimen General — IVA Desglosado
                  </label>
                  <textarea
                    value={conceptoGeneral}
                    onChange={(e) => setConceptoGeneral(e.target.value)}
                    className={styles.conceptTextarea}
                  />
                </div>
                {(() => {
                  const sample = pendingSelected[0];
                  if (!sample) return null;
                  const sampleRegimen = getRegimen(sample);
                  const preview = (sampleRegimen === "REAV" ? conceptoReav : conceptoGeneral)
                    .replaceAll("{referencia}", sample.expediente_referencia || "Expediente")
                    .replaceAll("{viajero}", sample.viajero_nombre || sample.cliente_nombre);
                  return (
                    <div className={styles.previewBox}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--primary-color, #475569)" }}>VISTA PREVIA</span>
                        <span style={{ fontSize: "0.58rem", color: "var(--primary-color, #475569)", fontWeight: 700, background: "rgba(71, 85, 105, 0.1)", padding: "0.05rem 0.25rem", borderRadius: "0.2rem" }}>
                          {sampleRegimen}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.68rem", color: "#334155", fontStyle: "italic", margin: 0, lineHeight: 1.3 }}>
                        "{preview}"
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className={styles.footer}>
              <div>
                {emitSuccess ? (
                  <span style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 600 }}>✓ Facturas emitidas correctamente</span>
                ) : emitError ? (
                  <span style={{ fontSize: "0.82rem", color: "#dc2626", fontWeight: 600 }}>{emitError}</span>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Preparado para emitir {pendingSelected.length} facturas
                  </span>
                )}
              </div>
              <div className={styles.footerBtns}>
                <button
                  className={styles.btnBack}
                  onClick={() => setStep(1)}
                  disabled={emitting || emitSuccess}
                >
                  Atrás
                </button>
                <button
                  className={styles.btnEmit}
                  onClick={handleEmitir}
                  disabled={emitting || pendingSelected.length === 0 || emitSuccess}
                >
                  {emitting ? (
                    <><Icons.RefreshCw size={14} className={styles.spin} /> Emitiendo...</>
                  ) : (
                    <><Icons.Facturacion size={14} /> Confirmar y Emitir <Icons.ChevronRight size={14} /></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
