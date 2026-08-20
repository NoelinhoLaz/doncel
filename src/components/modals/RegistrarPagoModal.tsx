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

type Step = "importe" | "seleccion" | "metodo" | "buscador" | "confirmarBanco";

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

export default function RegistrarPagoModal({ isOpen, onClose, servicios, onSuccess }: RegistrarPagoModalProps) {
  const [step, setStep] = useState<Step>("importe");
  const [importePago, setImportePago] = useState<number | "">("");
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  const gruposPorProveedor = useMemo(() => {
    const map = new Map<string, { key: string; nombre: string; servicios: any[] }>();
    for (const ser of seleccionablesFiltrados) {
      const key = ser.proveedor_id || ser.proveedor || "__sin_proveedor__";
      const grupo = map.get(key) || { key, nombre: ser.proveedor || "Sin proveedor", servicios: [] };
      grupo.servicios.push(ser);
      map.set(key, grupo);
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [seleccionablesFiltrados]);

  useEffect(() => {
    if (!isOpen) {
      setStep("importe");
      setImportePago("");
      setFechaPago(hoyISO());
      setSelectedIds(new Set());
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
    const proveedorId = Array.from(selectedIds)
      .map((id) => servicios.find((s) => s.id === id)?.proveedor_id)[0];
    setSobranteActivo(proveedorId ? sobrantesPorProveedor[proveedorId] || null : null);
  }, [selectedIds, sobrantesPorProveedor, servicios]);

  const importeValido = typeof importePago === "number" && importePago > 0;

  // Reparto equitativo del importe total del pago entre los servicios marcados en el paso 2.
  const selected = useMemo(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !importeValido) return {} as Record<string, number>;
    const porServicio = Math.round(((importePago as number) / ids.length) * 100) / 100;
    const map: Record<string, number> = {};
    ids.forEach((id, i) => {
      // El último servicio absorbe el redondeo para que la suma cuadre exactamente con el importe total.
      map[id] = i === ids.length - 1
        ? Math.round(((importePago as number) - porServicio * (ids.length - 1)) * 100) / 100
        : porServicio;
    });
    return map;
  }, [selectedIds, importePago, importeValido]);

  const totalSeleccionado = Object.values(selected).reduce((acc: number, v: number) => acc + (v || 0), 0);

  if (!isOpen) return null;

  const toggleServicio = (ser: any) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ser.id)) next.delete(ser.id);
      else next.add(ser.id);
      return next;
    });
  };

  const serviciosSeleccionados = () =>
    Object.entries(selected)
      .filter(([, importe]) => (importe as number) > 0)
      .map(([id, importe]) => {
        const ser = servicios.find((s) => s.id === id);
        // proveedor_id identifica al proveedor de forma inequívoca (evita agrupar mal por
        // pequeñas diferencias de texto en el nombre resuelto cuando hay varios servicios
        // del mismo proveedor real).
        return { id, importe: importe as number, proveedor: ser?.proveedor, proveedor_id: ser?.proveedor_id };
      });

  const handleConfirmarDirecto = async (medio: "tarjeta" | "efectivo") => {
    setSaving(true);
    setError(null);
    try {
      const res = await registrarPagoServicios({
        expediente_id: servicios[0]?.expediente_id,
        medio_pago: medio,
        servicios: serviciosSeleccionados(),
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
      // Se respeta siempre el importe que el agente asignó manualmente a cada línea en el
      // paso de selección — no se reparte ni recalcula proporcionalmente contra el importe
      // real del movimiento bancario. Si la suma seleccionada no coincide exactamente con el
      // importe del banco, la diferencia se guarda como sobrante (a favor o en contra) del
      // proveedor, disponible para el siguiente pago.
      const seleccionados = serviciosSeleccionados();
      const importeBanco = Math.abs(importeMovimiento);
      const totalSeleccionadoPago = seleccionados.reduce((sum, s) => sum + s.importe, 0);

      const sobranteDisponible = aplicarSobrante ? sobranteActivo : null;
      const importeDisponible = importeBanco + (sobranteDisponible?.total || 0);

      const sobrante = Math.max(0, Math.round((importeDisponible - totalSeleccionadoPago) * 100) / 100);

      const res = await vincularServiciosAMovimientoBanco({
        expediente_id: servicios[0]?.expediente_id,
        movimiento_banco_id: movimientoBancoId,
        servicios: seleccionados,
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

  const handleVolver = () => {
    if (step === "confirmarBanco") { setMovimientoElegido(null); setStep("buscador"); return; }
    if (step === "buscador") { setStep("metodo"); return; }
    if (step === "metodo") { setStep("seleccion"); return; }
    if (step === "seleccion") { setStep("importe"); return; }
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
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1.25rem 0" }}>Indica el importe y la fecha del pago que vas a registrar.</p>

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
                onClick={() => setStep("seleccion")}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: importeValido ? "pointer" : "not-allowed", opacity: importeValido ? 1 : 0.5 }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "seleccion" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Servicios abonados</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>
              Selecciona los servicios que se abonan con este pago de <strong>{(importePago as number).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong>. El importe se reparte a partes iguales.
            </p>

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
                {gruposPorProveedor.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center", padding: "1.5rem 0" }}>Sin resultados.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "340px", overflowY: "auto" }}>
                    {gruposPorProveedor.map((grupo) => (
                      <div key={grupo.key}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.03em", marginBottom: "0.4rem", textTransform: "uppercase" }}>
                          {grupo.nombre}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {grupo.servicios.map((ser) => {
                            const isChecked = selectedIds.has(ser.id);
                            return (
                              <div key={ser.id} onClick={() => toggleServicio(ser)} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", backgroundColor: isChecked ? "#f8fafc" : "#fff", cursor: "pointer" }}>
                                <input type="checkbox" checked={isChecked} onChange={() => toggleServicio(ser)} style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ser.descripcion}</div>
                                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Pendiente: {pendiente(ser).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
                                </div>
                                {isChecked && (
                                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}>
                                    {(selected[ser.id] || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Repartido: <strong style={{ color: totalSeleccionado > (importePago as number) + 0.01 ? "#dc2626" : "#0f172a" }}>{totalSeleccionado.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong> / {(importePago as number).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
              </span>
              <button
                disabled={selectedIds.size === 0}
                onClick={() => setStep("metodo")}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: selectedIds.size > 0 ? "pointer" : "not-allowed", opacity: selectedIds.size > 0 ? 1 : 0.5 }}
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
