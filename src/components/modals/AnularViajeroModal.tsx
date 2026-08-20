"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { Loader2 } from "lucide-react";
import { anularViajero } from "@/actions/viajeros";
import { createReembolsoMovimiento } from "@/actions/cobros";

interface Viajero {
  id: string;
  name: string;
  entidad_id: string;
  importe: number;
}

interface AnularViajeroModalProps {
  isOpen: boolean;
  onClose: () => void;
  viajero: Viajero | null;
  expedienteId: string;
  onSuccess: () => void;
}

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

export default function AnularViajeroModal({ isOpen, onClose, viajero, expedienteId, onSuccess }: AnularViajeroModalProps) {
  const [step, setStep] = useState<"confirmar" | "reembolso">("confirmar");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importe, setImporte] = useState("");
  const [concepto, setConcepto] = useState("");
  const [medioPago, setMedioPago] = useState<"banco" | "efectivo" | "tarjeta" | "online">("banco");
  const [fecha, setFecha] = useState(hoyISO());

  useEffect(() => {
    if (!isOpen) {
      setStep("confirmar");
      setMotivo("");
      setError(null);
      setImporte("");
      setConcepto("");
      setMedioPago("banco");
      setFecha(hoyISO());
    } else if (viajero) {
      setImporte(viajero.importe ? String(viajero.importe) : "");
      setConcepto(`Reembolso anulación ${viajero.name}`);
    }
  }, [isOpen, viajero]);

  if (!isOpen || !viajero) return null;

  const handleAnular = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await anularViajero(viajero.id, motivo.trim() || undefined);
      if (!res.success) throw new Error(res.error);
      onSuccess();
      setStep("reembolso");
    } catch (err: any) {
      setError(err.message || "Error al anular el viajero");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerarReembolso = async () => {
    const importeNum = parseFloat(importe.replace(",", "."));
    if (!importeNum || importeNum <= 0) { setError("Introduce un importe válido mayor que 0."); return; }
    if (!concepto.trim()) { setError("Introduce un concepto."); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await createReembolsoMovimiento({
        expediente_id: expedienteId,
        entidad_id: viajero.entidad_id,
        tipo: "reembolso_cobro",
        importe_total: importeNum,
        concepto: concepto.trim(),
        medio_pago: medioPago,
        fecha,
      });
      if (!res.success) throw new Error(res.error);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al generar el reembolso");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={saving ? undefined : onClose}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(12px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "480px", maxHeight: "80vh", overflowY: "auto", backgroundColor: "rgba(255, 255, 255, 0.98)", borderRadius: "1.5rem", padding: "1.5rem", boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)", border: "1px solid rgba(255, 255, 255, 0.8)" }}
      >
        {!saving && (
          <button
            onClick={onClose}
            style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
          >
            <Icons.Close size={16} />
          </button>
        )}

        {step === "confirmar" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Anular viajero</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1.25rem 0" }}>
              Vas a anular a <strong>{viajero.name}</strong>. El viajero no se elimina, quedará marcado como inactivo/anulado.
            </p>

            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Motivo (opcional)</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Motivo de la anulación..."
                style={{ width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.82rem", color: "#0f172a", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{ padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAnular}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "none", background: "#dc2626", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Anular viajero
              </button>
            </div>
          </>
        )}

        {step === "reembolso" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>¿Deseas generar un reembolso?</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1.25rem 0" }}>
              El viajero <strong>{viajero.name}</strong> ha sido anulado. Puedes registrar el reembolso a cliente asociado a esta anulación.
            </p>

            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Importe (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={importe}
                  onChange={(e) => setImporte(e.target.value)}
                  style={{ width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#0f172a", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Concepto</label>
                <input
                  type="text"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  style={{ width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#0f172a", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Medio de pago</label>
                  <select
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value as any)}
                    style={{ width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#0f172a", boxSizing: "border-box", background: "#fff" }}
                  >
                    <option value="banco">Banco</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    style={{ width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#0f172a", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{ padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                No, gracias
              </button>
              <button
                onClick={handleGenerarReembolso}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Generar reembolso
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
