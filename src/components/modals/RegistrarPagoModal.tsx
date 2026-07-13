"use client";

import { useState, useMemo, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { Landmark, CreditCard, Banknote, Search, Loader2, ArrowLeft, Wallet, Clock } from "lucide-react";
import { registrarPagoServicios, vincularServiciosAMovimientoBanco, getSobrantesPorProveedor, aplicarSobrantes, aplicarSobranteAServicios, registrarPagoPendienteConciliar } from "@/actions/servicios";
import { getMovimientosBanco } from "@/actions/banco";

interface RegistrarPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
  servicios: any[];
  onSuccess: () => void;
}

type Step = "seleccion" | "metodo" | "buscador" | "confirmarBanco";

function totalNeto(ser: any) {
  const noches = Number(ser.noches || 0) || 1;
  return Number(ser.neto || 0) * Number(ser.plazas || 1) * noches;
}

function pendiente(ser: any) {
  return Math.max(0, totalNeto(ser) - Number(ser.abonado || 0));
}

export default function RegistrarPagoModal({ isOpen, onClose, servicios, onSuccess }: RegistrarPagoModalProps) {
  const [step, setStep] = useState<Step>("seleccion");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [searchSeleccion, setSearchSeleccion] = useState("");
  const [movimientoElegido, setMovimientoElegido] = useState<any | null>(null);
  const [sobrantesPorProveedor, setSobrantesPorProveedor] = useState<Record<string, { total: number; movimientos: { id: string; sobrante: number }[] }>>({});
  const [aplicarSobrante, setAplicarSobrante] = useState(true);
  const [sobranteActivo, setSobranteActivo] = useState<{ total: number; movimientos: { id: string; sobrante: number }[] } | null>(null);

  const seleccionables = useMemo(
    () => servicios
      .filter((s) => pendiente(s) > 0.01)
      .sort((a, b) => (a.proveedor || "").localeCompare(b.proveedor || "", "es")),
    [servicios]
  );

  const seleccionablesFiltrados = useMemo(
    () => seleccionables.filter((ser) =>
      (ser.descripcion || "").toLowerCase().includes(searchSeleccion.toLowerCase()) ||
      (ser.proveedor || "").toLowerCase().includes(searchSeleccion.toLowerCase())
    ),
    [seleccionables, searchSeleccion]
  );

  useEffect(() => {
    if (!isOpen) {
      setStep("seleccion");
      setSelected({});
      setError(null);
      setSearch("");
      setSearchSeleccion("");
      setMovimientos([]);
      setMovimientoElegido(null);
      setAplicarSobrante(true);
    } else {
      const expedienteId = servicios[0]?.expediente_id;
      if (expedienteId) getSobrantesPorProveedor(expedienteId).then(setSobrantesPorProveedor);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step !== "buscador") return;
    let active = true;
    setLoadingMovs(true);
    const t = setTimeout(async () => {
      try {
        const res = await getMovimientosBanco({ search, tipoMovimiento: "debe", estados: ["pendiente", "propuesto"], limit: 20 });
        if (active) setMovimientos(res.data || []);
      } finally {
        if (active) setLoadingMovs(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [step, search]);

  // Sobrante disponible del proveedor de los servicios seleccionados (asume un único
  // proveedor por pago, igual que el resto del flujo de este modal). El cruce se hace por
  // proveedor_id directamente (contabilidad_proveedores), sin pasar por entidad_id.
  useEffect(() => {
    const proveedorId = Object.entries(selected)
      .filter(([, importe]) => importe > 0)
      .map(([id]) => servicios.find((s) => s.id === id)?.proveedor_id)[0];
    setSobranteActivo(proveedorId ? sobrantesPorProveedor[proveedorId] || null : null);
  }, [selected, sobrantesPorProveedor, servicios]);

  if (!isOpen) return null;

  const totalSeleccionado = Object.values(selected).reduce((acc, v) => acc + (v || 0), 0);

  const toggleServicio = (ser: any) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[ser.id] != null) delete next[ser.id];
      else next[ser.id] = pendiente(ser);
      return next;
    });
  };

  const updateImporte = (id: string, value: number) => {
    setSelected((prev) => ({ ...prev, [id]: value }));
  };

  const serviciosSeleccionados = () =>
    Object.entries(selected)
      .filter(([, importe]) => importe > 0)
      .map(([id, importe]) => {
        const ser = servicios.find((s) => s.id === id);
        // proveedor_id identifica al proveedor de forma inequívoca (evita agrupar mal por
        // pequeñas diferencias de texto en el nombre resuelto cuando hay varios servicios
        // del mismo proveedor real).
        return { id, importe, proveedor: ser?.proveedor, proveedor_id: ser?.proveedor_id };
      });

  const handleConfirmarDirecto = async (medio: "tarjeta" | "efectivo") => {
    setSaving(true);
    setError(null);
    try {
      const res = await registrarPagoServicios({
        expediente_id: servicios[0]?.expediente_id,
        medio_pago: medio,
        servicios: serviciosSeleccionados(),
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
        expediente_id: servicios[0]?.expediente_id,
        medio_pago: "banco",
        servicios: serviciosSeleccionados(),
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

  const handleUsarSobrante = async () => {
    const sobranteInfo = sobranteActivo;
    if (!sobranteInfo) return;
    setSaving(true);
    setError(null);
    try {
      const seleccionados = serviciosSeleccionados();
      // El importe pedido no puede superar el sobrante disponible: se topa cada servicio a
      // su pendiente real y, si en conjunto exceden el saldo, se recorta proporcionalmente.
      const totalPedido = seleccionados.reduce((sum, s) => sum + s.importe, 0);
      const ratio = totalPedido > sobranteInfo.total ? sobranteInfo.total / totalPedido : 1;
      const serviciosAAplicar = seleccionados.map((s) => ({ id: s.id, importe: Math.round(s.importe * ratio * 100) / 100 }));

      const res = await aplicarSobranteAServicios({
        expediente_id: servicios[0]?.expediente_id,
        servicios: serviciosAAplicar,
        movimientos: sobranteInfo.movimientos,
      });
      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al aplicar el saldo a favor");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmarBanco = async () => {
    if (!movimientoElegido) return;
    const movimientoBancoId = movimientoElegido.id;
    const importeMovimiento = Number(movimientoElegido.importe);
    setSaving(true);
    setError(null);
    try {
      // El importe real del movimiento bancario puede ser menor que la suma seleccionada
      // (pago parcial de una factura conjunta): se aplica el mismo % de avance al PENDIENTE de
      // cada servicio (lo que de verdad falta por cobrar, no su total bruto), para que ningún
      // servicio quede "sobrepagado" solo por tener un pendiente pequeño — todos avanzan
      // proporcionalmente al mismo ritmo. Si el banco cubre de sobra (ratio >= 1), cada servicio
      // se paga exactamente su pendiente completo y el resto se guarda como sobrante del pago,
      // disponible para aplicarlo al siguiente pago de este mismo proveedor.
      const seleccionados = serviciosSeleccionados();
      const importeBanco = Math.abs(importeMovimiento);
      const totalPendienteConjunto = seleccionados.reduce((sum, s) => {
        const ser = servicios.find((x) => x.id === s.id);
        return sum + (ser ? pendiente(ser) : 0);
      }, 0);

      const sobranteDisponible = aplicarSobrante ? sobranteActivo : null;
      const importeDisponible = importeBanco + (sobranteDisponible?.total || 0);

      const ratio = totalPendienteConjunto > 0 ? Math.min(1, importeDisponible / totalPendienteConjunto) : 0;
      const serviciosAjustados = seleccionados.map((s) => {
        const ser = servicios.find((x) => x.id === s.id);
        const pend = ser ? pendiente(ser) : 0;
        return { ...s, importe: Math.round(pend * ratio * 100) / 100 };
      });
      const sobrante = Math.max(0, Math.round((importeDisponible - totalPendienteConjunto) * 100) / 100);

      const res = await vincularServiciosAMovimientoBanco({
        expediente_id: servicios[0]?.expediente_id,
        movimiento_banco_id: movimientoBancoId,
        servicios: serviciosAjustados,
        sobrante,
      });
      if (!res.success) throw new Error(res.error);
      if (sobranteDisponible) {
        await aplicarSobrantes(sobranteDisponible.movimientos.map((m) => m.id));
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al registrar el pago");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(12px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "560px", maxHeight: "80vh", overflowY: "auto", backgroundColor: "rgba(255, 255, 255, 0.98)", borderRadius: "1.5rem", padding: "1.5rem", boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)", border: "1px solid rgba(255, 255, 255, 0.8)" }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
        >
          <Icons.Close size={16} />
        </button>

        {step !== "seleccion" && (
          <button
            onClick={() => {
              if (step === "confirmarBanco") { setMovimientoElegido(null); setStep("buscador"); }
              else setStep(step === "buscador" ? "metodo" : "seleccion");
            }}
            style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", color: "#64748b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: "0.75rem" }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
        )}

        {step === "seleccion" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Registrar pago</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Selecciona los servicios que se abonan en este pago.</p>

            {seleccionables.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", textAlign: "center", padding: "2rem 0" }}>No hay servicios pendientes de abonar.</p>
            ) : (
              <>
                <div style={{ position: "relative", marginBottom: "0.65rem" }}>
                  <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Buscar por proveedor o descripción..."
                    value={searchSeleccion}
                    onChange={(e) => setSearchSeleccion(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem 0.5rem 2rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>
                {seleccionablesFiltrados.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center", padding: "1.5rem 0" }}>Sin resultados.</p>
                ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "340px", overflowY: "auto" }}>
                {seleccionablesFiltrados.map((ser) => {
                  const isChecked = selected[ser.id] != null;
                  return (
                    <div key={ser.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", backgroundColor: isChecked ? "#f8fafc" : "#fff" }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleServicio(ser)} style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ser.descripcion}</div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{ser.proveedor || "Sin proveedor"} · Pendiente: {pendiente(ser).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
                      </div>
                      {isChecked && (
                        <input
                          type="number"
                          step="0.01"
                          value={selected[ser.id]}
                          onChange={(e) => updateImporte(ser.id, parseFloat(e.target.value) || 0)}
                          style={{ width: "90px", padding: "0.3rem 0.4rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.8rem", textAlign: "right" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
                )}
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Total seleccionado: <strong style={{ color: "#0f172a" }}>{totalSeleccionado.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong></span>
              <button
                disabled={totalSeleccionado <= 0}
                onClick={() => setStep("metodo")}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: totalSeleccionado > 0 ? "pointer" : "not-allowed", opacity: totalSeleccionado > 0 ? 1 : 0.5 }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "metodo" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Método de pago</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Importe total a registrar: <strong>{totalSeleccionado.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong></p>

            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {sobranteActivo && (
                <button
                  onClick={handleUsarSobrante}
                  disabled={saving}
                  style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", border: "1px solid #bfdbfe", borderRadius: "0.5rem", background: "#eff6ff", cursor: "pointer", textAlign: "left" }}
                >
                  <Wallet size={18} color="#1d4ed8" />
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e3a8a" }}>
                      Usar saldo a favor ({sobranteActivo.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} € disponibles)
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#3b82f6" }}>Aplicar el crédito de un pago anterior de este proveedor, sin necesidad de banco/tarjeta</div>
                  </div>
                  {saving && <Loader2 size={14} className="animate-spin" style={{ marginLeft: "auto" }} />}
                </button>
              )}
              <button
                onClick={() => setStep("buscador")}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
              >
                <Landmark size={18} color="var(--primary-color, #475569)" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>Buscar movimiento bancario</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Conciliar con un movimiento de banco existente</div>
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

            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
              <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Buscar por concepto, referencia o fecha..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem 0.5rem 2rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.82rem", boxSizing: "border-box" }}
              />
            </div>

            {loadingMovs ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#64748b", fontSize: "0.8rem" }}>Buscando movimientos...</div>
            ) : movimientos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#94a3b8", fontSize: "0.8rem" }}>Sin resultados.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "320px", overflowY: "auto" }}>
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
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{serviciosSeleccionados().length}</span>
              </div>
            </div>

            {sobranteActivo && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.7rem 0.9rem", border: "1px solid #bfdbfe", borderRadius: "0.5rem", backgroundColor: "#eff6ff", marginBottom: "1rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={aplicarSobrante}
                  onChange={(e) => setAplicarSobrante(e.target.checked)}
                  style={{ marginTop: "2px", accentColor: "var(--primary-color, #475569)", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.8rem", color: "#1e3a8a" }}>
                  Este proveedor tiene <strong>{sobranteActivo.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong> de saldo a favor de un pago anterior. Aplicarlo a este pago.
                </span>
              </label>
            )}

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
