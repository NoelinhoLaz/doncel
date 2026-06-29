"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, CreditCard, CheckCircle2, Clock } from "lucide-react";
import { crearTiqueteManual, getTiquesByFecha } from "@/actions/tpv";
import type { TiqueteManual, TpvLinea } from "@/actions/tpv";

interface Props {
  selectedDate: string;
  onReconciliationComplete?: (total: number) => void;
  forceOpen?: boolean;
  onForceOpenChange?: (v: boolean) => void;
}

const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const fmtEur = (n: number) => fmt.format(n);

const inp: React.CSSProperties = {
  border: "1px solid #e2e8f0", borderRadius: 6, padding: "0.35rem 0.5rem",
  fontSize: "0.82rem", outline: "none", background: "#fff", color: "#0f172a",
  boxSizing: "border-box",
};

export function RegistroTPV({ selectedDate, onReconciliationComplete, forceOpen, onForceOpenChange }: Props) {
  const [tiquetes, setTiquetes] = useState<TiqueteManual[]>([]);
  const [loading, setLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = forceOpen !== undefined ? forceOpen : internalOpen;
  const setIsOpen = (v: boolean) => {
    if (forceOpen !== undefined) onForceOpenChange?.(v);
    else setInternalOpen(v);
  };

  // Modal state
  const [lineas, setLineas] = useState<TpvLinea[]>([]);
  const [subtotal, setSubtotal] = useState("");
  const [comision, setComision] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setTiquetes(await getTiquesByFecha(selectedDate));
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedDate]);

  const linesSum = lineas.reduce((s, l) => s + (Number(l.importe) || 0), 0);
  const subtotalVal = parseFloat(subtotal) || 0;
  const comisionVal = parseFloat(comision) || 0;
  const total = Math.max(0, subtotalVal - comisionVal);

  const openModal = () => {
    setLineas([]);
    setSubtotal("");
    setComision("");
    setError(null);
    setIsOpen(true);
  };

  const updateLinea = (i: number, patch: Partial<TpvLinea>) => {
    const updated = lineas.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    setLineas(updated);
    // Auto-sync subtotal from lines if all have valid imports
    const sum = updated.reduce((s, l) => s + (Number(l.importe) || 0), 0);
    if (sum > 0) setSubtotal(sum.toFixed(2));
  };

  const handleSave = async () => {
    if (subtotalVal <= 0) { setError("Introduce un subtotal mayor que 0."); return; }
    const validLineas = lineas.filter((l) => l.descripcion.trim() && Number(l.importe) > 0);
    setSaving(true);
    setError(null);
    const res = await crearTiqueteManual(selectedDate, validLineas, comisionVal, subtotalVal);
    setSaving(false);
    if (!res.success) { setError(res.error || "Error al guardar."); return; }
    setIsOpen(false);
    load();
    if (onReconciliationComplete && res.total !== undefined) onReconciliationComplete(res.total);
  };

  return (
    <>
      {/* Lista de tiquetes del día — solo en modo autónomo */}
      {forceOpen === undefined && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {loading ? (
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", padding: "0.5rem 0" }}>Cargando...</div>
          ) : tiquetes.map((t) => (
            <div key={t.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
                  <CreditCard size={13} />
                  {t.numero_tiquete}
                </span>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.4rem", borderRadius: 9999, background: t.estado === "sincronizado" ? "#dcfce7" : "#fef9c3", color: t.estado === "sincronizado" ? "#16a34a" : "#ca8a04", display: "flex", alignItems: "center", gap: 3 }}>
                  {t.estado === "sincronizado" ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                  {t.estado}
                </span>
              </div>
              <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.75rem", color: "#64748b" }}>
                <span>Subtotal: <strong style={{ color: "#0f172a" }}>{fmtEur(t.subtotal)}</strong></span>
                <span>Comisión: <strong style={{ color: "#0f172a" }}>{fmtEur(t.comision)}</strong></span>
                <span>Total: <strong style={{ color: "#0f172a" }}>{fmtEur(t.total)}</strong></span>
              </div>
              {t.lineas.length > 0 && (
                <div style={{ marginTop: "0.35rem", display: "flex", flexDirection: "column", gap: 2 }}>
                  {t.lineas.map((l, i) => (
                    <div key={i} style={{ fontSize: "0.7rem", color: "#475569", display: "flex", justifyContent: "space-between" }}>
                      <span>{l.descripcion}</span>
                      <span>{fmtEur(l.importe)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button onClick={openModal} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.45rem 0.75rem", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.78rem", fontWeight: 600, color: "#475569", cursor: "pointer", alignSelf: "flex-start", marginTop: "0.25rem" }}>
            <Plus size={14} />
            Registrar TPV
          </button>
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 100%)", background: "#fff", borderRadius: 12, boxShadow: "0 20px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1rem", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CreditCard size={18} style={{ color: "var(--primary-color, #475569)" }} />
                <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Registrar Liquidación TPV</h3>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ border: "none", background: "transparent", fontSize: "1.3rem", color: "#64748b", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "60vh", overflowY: "auto" }}>
              {/* Lines */}
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
                  Cobros con tarjeta
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {lineas.map((l, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <input
                        placeholder="Descripción (ej: Exp 25/001 – García)"
                        value={l.descripcion}
                        onChange={(e) => updateLinea(i, { descripcion: e.target.value })}
                        style={{ ...inp, flex: 1 }}
                      />
                      <input
                        type="number"
                        placeholder="0,00"
                        value={l.importe || ""}
                        onChange={(e) => updateLinea(i, { importe: parseFloat(e.target.value) || 0 })}
                        style={{ ...inp, width: 90, textAlign: "right" }}
                      />
                      <button onClick={() => setLineas((p) => p.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setLineas((p) => [...p, { descripcion: "", importe: 0 }])}
                  style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--primary-color, #475569)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: "0.2rem 0" }}
                >
                  <Plus size={13} /> Añadir línea (opcional)
                </button>
              </div>

              {/* Totals */}
              <div style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "#475569" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>Subtotal *</span>
                    {linesSum > 0 && Math.abs(linesSum - subtotalVal) > 0.01 && (
                      <span style={{ fontSize: "0.68rem", color: "#f59e0b" }}>Líneas suman {fmtEur(linesSum)}</span>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    style={{ ...inp, width: 90, textAlign: "right", fontWeight: 600 }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "#475569" }}>
                  <span>Comisión banco</span>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={comision}
                    onChange={(e) => setComision(e.target.value)}
                    style={{ ...inp, width: 90, textAlign: "right" }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.4rem", marginTop: "0.1rem" }}>
                  <strong>Total ingresado</strong>
                  <strong style={{ color: "var(--primary-color, #475569)" }}>{fmtEur(total)}</strong>
                </div>
              </div>

              {error && <div style={{ fontSize: "0.78rem", color: "#ef4444", background: "#fef2f2", borderRadius: 6, padding: "0.4rem 0.6rem" }}>{error}</div>}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0.75rem 1rem", borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setIsOpen(false)} style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "0.45rem 0.8rem", cursor: "pointer", fontSize: "0.82rem" }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ border: "none", background: "var(--primary-color, #475569)", color: "#fff", borderRadius: 6, padding: "0.45rem 0.9rem", cursor: saving ? "default" : "pointer", fontSize: "0.82rem", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
