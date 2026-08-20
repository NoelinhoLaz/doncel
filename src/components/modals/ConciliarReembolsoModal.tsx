"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { Search, Loader2 } from "lucide-react";
import { getMovimientosBanco } from "@/actions/banco";
import { vincularReembolsoAMovimientoBanco } from "@/actions/cobros";
import { getCuentasBancarias } from "@/actions/cuentasBancarias";

interface Reembolso {
  id: string;
  concepto: string;
  entidad_nombre: string;
  importe_total: number;
  tipo: "reembolso_cobro" | "reembolso_pago";
}

interface ConciliarReembolsoModalProps {
  isOpen: boolean;
  onClose: () => void;
  reembolso: Reembolso | null;
  onSuccess: () => void;
}

export default function ConciliarReembolsoModal({ isOpen, onClose, reembolso, onSuccess }: ConciliarReembolsoModalProps) {
  const [search, setSearch] = useState("");
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [importeMin, setImporteMin] = useState("");
  const [importeMax, setImporteMax] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [cuentas, setCuentas] = useState<any[]>([]);

  // Reembolso a cliente (reembolso_cobro): sale dinero del banco -> debe.
  // Reembolso de proveedor (reembolso_pago): entra dinero al banco -> haber.
  const tipoMovimiento = reembolso?.tipo === "reembolso_cobro" ? "debe" : "haber";

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setMovimientos([]);
      setError(null);
      setFechaDesde("");
      setFechaHasta("");
      setImporteMin("");
      setImporteMax("");
      setCuentaId("");
    } else {
      getCuentasBancarias().then(setCuentas).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !reembolso) return;
    let active = true;
    setLoadingMovs(true);
    const t = setTimeout(async () => {
      try {
        const res = await getMovimientosBanco({
          search,
          tipoMovimiento,
          estados: ["pendiente", "propuesto"],
          limit: 20,
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
          importeMin: importeMin !== "" ? parseFloat(importeMin) : undefined,
          importeMax: importeMax !== "" ? parseFloat(importeMax) : undefined,
          cuentaIds: cuentaId ? [cuentaId] : undefined,
        });
        if (active) setMovimientos(res.data || []);
      } finally {
        if (active) setLoadingMovs(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [isOpen, reembolso, tipoMovimiento, search, fechaDesde, fechaHasta, importeMin, importeMax, cuentaId]);

  if (!isOpen || !reembolso) return null;

  const handleElegir = async (movimientoId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await vincularReembolsoAMovimientoBanco(reembolso.id, movimientoId);
      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al conciliar el reembolso");
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

        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Buscar movimiento bancario</h3>
        <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>
          Conciliar el reembolso de <strong>{reembolso.entidad_nombre}</strong> ({reembolso.importe_total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €) con un movimiento de banco.
        </p>

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

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.9rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Importe desde</label>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={importeMin}
                onChange={(e) => setImporteMin(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Importe hasta</label>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={importeMax}
                onChange={(e) => setImporteMax(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Cuenta bancaria</label>
            <select
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
              style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.78rem", boxSizing: "border-box", background: "#fff" }}
            >
              <option value="">Todas las cuentas</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.banco}{c.iban ? ` · ${c.iban}` : ""}
                </option>
              ))}
            </select>
          </div>
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
                onClick={() => handleElegir(m.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "320px" }}>{m.concepto_original || "Movimiento bancario"}</div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{m.fecha_operacion}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: Number(m.importe) < 0 ? "#dc2626" : "#16a34a" }}>
                    {Number(m.importe).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                  </div>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
