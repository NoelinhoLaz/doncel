"use client";

import { useState, useMemo, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { Landmark, CreditCard, Banknote, Search, Loader2, ArrowLeft, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { registrarPagoServicios, registrarPagoPendienteConciliar } from "@/actions/servicios";
import { getMovimientosBanco } from "@/actions/banco";
import { getCuentasBancarias } from "@/actions/cuentasBancarias";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";

interface RegistrarPagoMultiModalProps {
  isOpen: boolean;
  onClose: () => void;
  servicios: any[]; // cada servicio debe traer: id, descripcion, expediente_id, proveedor, proveedor_id, neto, plazas, noches, abonado
  onSuccess: () => void;
  // Permite abrir el modal directamente en el paso "buscador" (p.ej. desde el badge
  // "Pdt. Conciliar" de un servicio ya identificado), saltando importe/reparto/método.
  // El importe se precarga con el pendiente de los servicios recibidos, repartido a partes iguales.
  initialStep?: Step;
}

type Step = "importe" | "reparto" | "metodo" | "buscador" | "confirmarBanco";

function totalNeto(ser: any) {
  const noches = Number(ser.noches || 0) || 1;
  return Number(ser.neto || 0) * Number(ser.plazas || 1) * noches;
}

function pendiente(ser: any) {
  return Math.max(0, totalNeto(ser) - Number(ser.abonado || 0));
}

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

export default function RegistrarPagoMultiModal({ isOpen, onClose, servicios, onSuccess, initialStep }: RegistrarPagoMultiModalProps) {
  const [step, setStep] = useState<Step>("importe");
  const [importePago, setImportePago] = useState<number | "">("");
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [importesPorServicio, setImportesPorServicio] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchBanco, setSearchBanco] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [importeDesde, setImporteDesde] = useState("");
  const [importeHasta, setImporteHasta] = useState("");
  const [cuentasBancarias, setCuentasBancarias] = useState<{ id: string; label: string }[]>([]);
  const [cuentaFilter, setCuentaFilter] = useState<string[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [movimientoElegido, setMovimientoElegido] = useState<any | null>(null);

  const importeValido = typeof importePago === "number" && importePago > 0;

  useEffect(() => {
    if (!isOpen) {
      setStep("importe");
      setImportePago("");
      setFechaPago(hoyISO());
      setImportesPorServicio({});
      setError(null);
      setSearchBanco("");
      setFechaDesde("");
      setFechaHasta("");
      setImporteDesde("");
      setImporteHasta("");
      setCuentaFilter([]);
      setMovimientos([]);
      setMovimientoElegido(null);
    } else {
      getCuentasBancarias()
        .then((rows: any[]) => {
          setCuentasBancarias(
            (rows || [])
              .filter((c) => c.activa !== false)
              .map((c) => ({ id: c.id, label: c.descripcion || c.banco || "Cuenta sin nombre" }))
          );
        })
        .catch(() => setCuentasBancarias([]));

      if (initialStep === "buscador" && servicios.length > 0) {
        const totalPendiente = servicios.reduce((sum, ser) => sum + pendiente(ser), 0);
        const porServicio = Math.round((totalPendiente / servicios.length) * 100) / 100;
        const map: Record<string, number> = {};
        servicios.forEach((ser, i) => {
          map[ser.id] = i === servicios.length - 1
            ? Math.round((totalPendiente - porServicio * (servicios.length - 1)) * 100) / 100
            : porServicio;
        });
        setImportePago(totalPendiente);
        setImportesPorServicio(map);
        setStep("buscador");
      }
    }
  }, [isOpen]);

  // Reparto inicial equitativo del importe total entre los servicios seleccionados,
  // recalculado cada vez que se entra al paso de reparto con un importe nuevo.
  useEffect(() => {
    if (step !== "reparto" || !importeValido || servicios.length === 0) return;
    const porServicio = Math.round(((importePago as number) / servicios.length) * 100) / 100;
    const map: Record<string, number> = {};
    servicios.forEach((ser, i) => {
      map[ser.id] = i === servicios.length - 1
        ? Math.round(((importePago as number) - porServicio * (servicios.length - 1)) * 100) / 100
        : porServicio;
    });
    setImportesPorServicio(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== "buscador") return;
    if (searchBanco.trim().length > 0 && searchBanco.trim().length < 3) return;
    let active = true;
    setLoadingMovs(true);
    const cuentaIds = cuentaFilter.length > 0
      ? cuentasBancarias.filter((c) => cuentaFilter.includes(c.label)).map((c) => c.id)
      : undefined;
    const t = setTimeout(async () => {
      try {
        const res = await getMovimientosBanco({
          search: searchBanco.trim().length >= 3 ? searchBanco.trim() : undefined,
          tipoMovimiento: "debe",
          estados: ["pendiente", "propuesto"],
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
          importeMin: importeDesde ? Number(importeDesde) : undefined,
          importeMax: importeHasta ? Number(importeHasta) : undefined,
          cuentaIds,
          limit: 20,
        });
        if (active) setMovimientos(res.data || []);
      } finally {
        if (active) setLoadingMovs(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [step, searchBanco, fechaDesde, fechaHasta, importeDesde, importeHasta, cuentaFilter, cuentasBancarias]);

  const totalRepartido = useMemo(
    () => Object.values(importesPorServicio).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [importesPorServicio]
  );
  const diferencia = Math.round(((importePago as number || 0) - totalRepartido) * 100) / 100;
  const cuadra = Math.abs(diferencia) < 0.01;

  if (!isOpen) return null;

  const updateImporteServicio = (id: string, valor: string) => {
    const num = parseFloat(valor.replace(",", "."));
    setImportesPorServicio((prev) => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  const serviciosAAbonar = () =>
    servicios
      .filter((ser) => (importesPorServicio[ser.id] || 0) > 0)
      .map((ser) => ({
        id: ser.id,
        importe: importesPorServicio[ser.id] || 0,
        proveedor: ser.proveedor,
        proveedor_id: ser.proveedor_id,
        expediente_id: ser.expediente_id,
      }));

  const handleConfirmarDirecto = async (medio: "tarjeta" | "efectivo") => {
    setSaving(true);
    setError(null);
    try {
      const res = await registrarPagoServicios({
        medio_pago: medio,
        servicios: serviciosAAbonar(),
        fecha: fechaPago,
      });
      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al registrar el pago");
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrarPendienteConciliar = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await registrarPagoPendienteConciliar({
        medio_pago: "banco",
        servicios: serviciosAAbonar(),
      });
      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al registrar el pago");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmarBanco = async () => {
    if (!movimientoElegido) return;
    setSaving(true);
    setError(null);
    try {
      // Sin conciliación automática de sobrante en este flujo multi-expediente: se registra
      // el pago como confirmado en banco, con la fecha del movimiento elegido.
      const res = await registrarPagoServicios({
        medio_pago: "tarjeta",
        servicios: serviciosAAbonar(),
        fecha: movimientoElegido.fecha_operacion,
        concepto: movimientoElegido.concepto_original || undefined,
      });
      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al registrar el pago");
    } finally {
      setSaving(false);
    }
  };

  const handleVolver = () => {
    if (step === "confirmarBanco") { setMovimientoElegido(null); setStep("buscador"); return; }
    if (step === "buscador") {
      if (initialStep === "buscador") { onClose(); return; }
      setStep("metodo");
      return;
    }
    if (step === "metodo") { setStep("reparto"); return; }
    if (step === "reparto") { setStep("importe"); return; }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(12px)", zIndex: 8900, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "620px", maxHeight: "82vh", overflowY: "auto", backgroundColor: "rgba(255, 255, 255, 0.98)", borderRadius: "1.5rem", padding: "1.5rem", boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)", border: "1px solid rgba(255, 255, 255, 0.8)" }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
        >
          <Icons.Close size={16} />
        </button>

        {step !== "importe" && (
          <button
            onClick={handleVolver}
            style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", color: "#64748b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: "0.75rem" }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
        )}

        {step === "importe" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Registrar pago</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1.25rem 0" }}>
              Vas a registrar el pago de <strong>{servicios.length}</strong> servicio{servicios.length !== 1 ? "s" : ""}. Indica el importe y la fecha del pago.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Importe del pago</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    placeholder="0,00"
                    value={importePago}
                    onChange={(e) => setImportePago(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    style={{ width: "100%", padding: "0.6rem 2rem 0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.9rem" }}>€</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Fecha del pago</label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  style={{ width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#0f172a", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                disabled={!importeValido}
                onClick={() => setStep("reparto")}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: importeValido ? "pointer" : "not-allowed", opacity: importeValido ? 1 : 0.5 }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "reparto" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Reparto del pago</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>
              Ajusta el importe de cada servicio. Por defecto se reparte a partes iguales.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "360px", overflowY: "auto" }}>
              {servicios.map((ser) => (
                <div key={ser.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", backgroundColor: "#fff" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ser.descripcion}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {ser.proveedor || "Sin proveedor"} · Pendiente: {pendiente(ser).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                    </div>
                  </div>
                  <div style={{ position: "relative", width: "120px", flexShrink: 0 }}>
                    <input
                      type="text"
                      value={importesPorServicio[ser.id] ?? ""}
                      onChange={(e) => updateImporteServicio(ser.id, e.target.value)}
                      style={{ width: "100%", padding: "0.4rem 1.6rem 0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", textAlign: "right", boxSizing: "border-box" }}
                    />
                    <span style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.8rem" }}>€</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem", padding: "0.6rem 0.9rem", borderRadius: "0.5rem", backgroundColor: cuadra ? "#f0fdf4" : "#fffbeb", border: `1px solid ${cuadra ? "#bbf7d0" : "#fde68a"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {cuadra ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertTriangle size={16} color="#d97706" />}
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: cuadra ? "#166534" : "#92400e" }}>
                  {cuadra ? "El reparto cuadra con el importe del pago" : `Descuadre de ${Math.abs(diferencia).toLocaleString("es-ES", { minimumFractionDigits: 2 })} € ${diferencia > 0 ? "sin repartir" : "de más"}`}
                </span>
              </div>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {totalRepartido.toLocaleString("es-ES", { minimumFractionDigits: 2 })} € / {(importePago as number).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={() => setStep("metodo")}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "metodo" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Método de pago</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Importe total a registrar: <strong>{totalRepartido.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong></p>

            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button
                onClick={() => setStep("buscador")}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
              >
                <Landmark size={18} color="var(--primary-color, #475569)" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>Transferencia</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Buscar movimiento bancario para conciliar</div>
                </div>
              </button>
              <button
                onClick={() => handleConfirmarDirecto("tarjeta")}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
              >
                <CreditCard size={18} color="var(--primary-color, #475569)" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>Tarjeta</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Registrar pago con tarjeta</div>
                </div>
                {saving && <Loader2 size={14} className="animate-spin" style={{ marginLeft: "auto" }} />}
              </button>
              <button
                onClick={() => handleConfirmarDirecto("efectivo")}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
              >
                <Banknote size={18} color="var(--primary-color, #475569)" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>Efectivo</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Registrar pago en efectivo</div>
                </div>
                {saving && <Loader2 size={14} className="animate-spin" style={{ marginLeft: "auto" }} />}
              </button>
            </div>
          </>
        )}

        {step === "buscador" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.75rem 0" }}>Buscar movimiento bancario</h3>
            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div style={{ position: "relative", marginBottom: "0.6rem" }}>
              <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Buscar por concepto o referencia (mín. 3 letras)..."
                value={searchBanco}
                onChange={(e) => setSearchBanco(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem 0.5rem 2rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.82rem", boxSizing: "border-box" }}
              />
            </div>
            {searchBanco.trim().length > 0 && searchBanco.trim().length < 3 && (
              <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "-0.4rem 0 0.75rem 0" }}>Escribe al menos 3 letras para buscar.</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Fecha desde</label>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Fecha hasta</label>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Importe desde</label>
                <input type="number" step="0.01" placeholder="0,00" value={importeDesde} onChange={(e) => setImporteDesde(e.target.value)} style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Importe hasta</label>
                <input type="number" step="0.01" placeholder="0,00" value={importeHasta} onChange={(e) => setImporteHasta(e.target.value)} style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box" }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Cuenta bancaria</label>
                <MultiSelectDropdown
                  options={cuentasBancarias.map((c) => c.label)}
                  selected={cuentaFilter}
                  onChange={setCuentaFilter}
                  placeholder="Todas las cuentas"
                />
              </div>
            </div>

            {loadingMovs ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#64748b", fontSize: "0.8rem" }}>Buscando movimientos...</div>
            ) : movimientos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#94a3b8", fontSize: "0.8rem" }}>Sin resultados.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "260px", overflowY: "auto" }}>
                {movimientos.map((m) => (
                  <button
                    key={m.id}
                    disabled={saving}
                    onClick={() => { setMovimientoElegido(m); setStep("confirmarBanco"); }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "320px" }}>{m.concepto_original || "Movimiento bancario"}</div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{m.fecha_operacion}</div>
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: Number(m.importe) < 0 ? "#dc2626" : "#16a34a" }}>
                      {Number(m.importe).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleRegistrarPendienteConciliar}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", marginTop: "0.9rem", padding: "0.65rem 1rem", border: "1px dashed #cbd5e1", borderRadius: "0.5rem", background: "#f8fafc", color: "#475569", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
            >
              <Clock size={15} />
              Conciliar más tarde
              {saving && <Loader2 size={14} className="animate-spin" />}
            </button>
          </>
        )}

        {step === "confirmarBanco" && movimientoElegido && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Confirmar pago</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>
              Revisa los datos antes de confirmar. Esta acción registrará el pago y no se puede deshacer desde aquí.
            </p>

            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.9rem 1rem", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b" }}>Movimiento</span>
                <span style={{ fontWeight: 600, color: "#0f172a", textAlign: "right", maxWidth: "70%" }}>{movimientoElegido.concepto_original || "Movimiento bancario"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b" }}>Fecha</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{movimientoElegido.fecha_operacion}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b" }}>Importe del movimiento</span>
                <span style={{ fontWeight: 700, color: Number(movimientoElegido.importe) < 0 ? "#dc2626" : "#16a34a" }}>
                  {Number(movimientoElegido.importe).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                </span>
              </div>
              <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "0.25rem 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b" }}>Servicios a abonar</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{serviciosAAbonar().length}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                onClick={() => { setMovimientoElegido(null); setStep("buscador"); }}
                disabled={saving}
                style={{ padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarBanco}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Aceptar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
