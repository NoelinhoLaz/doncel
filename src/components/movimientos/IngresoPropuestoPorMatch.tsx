"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { conciliarIngresoTutor } from "@/actions/banco";

interface IngresoPropuestoPorMatchProps {
  movimiento: {
    id: string;
    importe: number;
    fecha_operacion: string;
  };
  match: {
    expediente_id: string;
    expediente_numero?: string;
    expediente_referencia?: string;
    pagador_id: string;
    pagador_nombre: string;
    match_score: number;
    razon: string;
    importe_total: number;
    importe_abonado: number;
    viajeros: Array<{ id: string; nombre: string }>;
  };
  onConciliado?: () => void;
}

export function IngresoPropuestoPorMatch({
  movimiento,
  match,
  onConciliado,
}: IngresoPropuestoPorMatchProps) {
  const [conciliando, setConciliando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazado, setRechazado] = useState(false);
  const [confirmarExceso, setConfirmarExceso] = useState(false);

  const displayScore = match.match_score <= 1 ? Math.round(match.match_score * 100) : Math.round(match.match_score);
  const isExacta = displayScore >= 90; // IBAN o muy fuerte
  const isSimilar = displayScore >= 60;

  // Premium harmonized colors
  const primaryColor = isExacta ? "#10b981" : isSimilar ? "var(--primary-color, #475569)" : "#64748b";
  const lightBgColor = isExacta ? "#f0fdf4" : isSimilar ? "color-mix(in srgb, var(--primary-color, #475569), transparent 90%)" : "#f8fafc";
  const darkTextColor = isExacta ? "#166534" : isSimilar ? "var(--primary-color, #475569)" : "#334155";
  const borderColor = isExacta ? "#bbf7d0" : isSimilar ? "color-mix(in srgb, var(--primary-color, #475569), transparent 75%)" : "#e2e8f0";

  const deudaPendiente = match.importe_total - match.importe_abonado;
  const hayExceso = movimiento.importe > deudaPendiente + 1; // 1 euro de tolerancia

  const handleConciliar = async (forzarExceso: boolean = false) => {
    if (hayExceso && !forzarExceso) {
      setConfirmarExceso(true);
      return;
    }

    setConciliando(true);
    setError(null);

    try {
      const result = await conciliarIngresoTutor(
        movimiento.id,
        match.expediente_id,
        match.pagador_id,
        movimiento.importe
      );

      if (result.success) {
        onConciliado?.();
      } else {
        setError(result.error || "Error en conciliación");
      }
    } catch (err: any) {
      setError(err.message || "Error al conciliar");
      console.error(err);
    } finally {
      setConciliando(false);
    }
  };

  if (rechazado) {
    return null;
  }

  if (confirmarExceso) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", backgroundColor: "#fffbeb",
        border: "1.5px solid #fde68a", borderRadius: "0.75rem", padding: "1rem", color: "#92400e"
      }}>
        <h4 style={{ fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <AlertCircle size={16} /> Exceso de pago detectado
        </h4>
        <p style={{ fontSize: "0.8rem", marginBottom: "0.75rem", lineHeight: 1.4 }}>
          El importe recibido (<b>{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(movimiento.importe)}</b>) 
          supera la deuda pendiente (<b>{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(deudaPendiente)}</b>). 
          ¿Deseas asignar el total a este pagador dejándolo con saldo a favor?
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => handleConciliar(true)} disabled={conciliando} style={{
            flex: 1, backgroundColor: "#d97706", color: "#fff", border: "none", borderRadius: "0.375rem", padding: "0.5rem", fontWeight: 700, cursor: "pointer"
          }}>
            {conciliando ? <Loader2 size={14} className="animate-spin" /> : "Sí, asignar exceso"}
          </button>
          <button onClick={() => setConfirmarExceso(false)} disabled={conciliando} style={{
            flex: 1, backgroundColor: "#fef3c7", color: "#b45309", border: "1px solid #fcd34d", borderRadius: "0.375rem", padding: "0.5rem", fontWeight: 600, cursor: "pointer"
          }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", backgroundColor: lightBgColor, border: `1.5px solid ${borderColor}`,
        borderRadius: "0.75rem", padding: "1rem", color: darkTextColor, fontFamily: '"Montserrat", "Inter", sans-serif',
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", borderBottom: `1px solid ${borderColor}`, paddingBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          {isExacta ? <CheckCircle2 size={16} style={{ color: "#10b981" }} /> : <AlertCircle size={16} style={{ color: primaryColor }} />}
          <span style={{ fontWeight: "700", fontSize: "0.85rem", color: primaryColor }}>{displayScore}% Confianza</span>
        </div>
        <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#64748b" }}>
          {isExacta && "Coincidencia Fuerte"}
          {isSimilar && !isExacta && "Coincidencia Moderada"}
          {!isSimilar && "Coincidencia Débil"}
        </div>
      </div>

      {/* Detalles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>Tutor / Pagador</div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={match.pagador_nombre}>{match.pagador_nombre}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>Expediente</div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a" }}>#{match.expediente_numero || match.expediente_id.slice(0,8).toUpperCase()}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>Importe Recibido</div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a" }}>{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(movimiento.importe)}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>Deuda Pendiente</div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a" }}>{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(deudaPendiente)}</div>
        </div>
      </div>

      {/* Viajeros identificados */}
      {match.viajeros && match.viajeros.length > 0 && (
        <div style={{ backgroundColor: "rgba(255, 255, 255, 0.4)", border: "1px solid rgba(226, 232, 240, 0.4)", borderRadius: "0.375rem", padding: "0.5rem", marginBottom: "0.75rem", fontSize: "0.7rem", color: "#475569" }}>
          <p style={{ fontWeight: "700", color: "#334155", marginBottom: "0.25rem", marginTop: 0 }}>Viajero:</p>
          {match.viajeros.map((v) => (
            <div key={v.id} style={{ marginLeft: "0.5rem", marginBottom: "0.1rem", fontWeight: "500" }}>• {v.nombre}</div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "0.375rem", padding: "0.6rem", marginBottom: "0.75rem", fontSize: "0.75rem", color: "#991b1b", fontWeight: "600" }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Botones */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={() => handleConciliar(false)} disabled={conciliando} style={{ flexGrow: 1, flex: 1, backgroundColor: "var(--primary-color, #475569)", color: "#ffffff", border: "none", borderRadius: "0.375rem", padding: "0.6rem", fontWeight: "700", fontSize: "0.85rem", cursor: conciliando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)", transition: "all 0.15s ease" }}>
          {conciliando && <Loader2 size={14} className="animate-spin" />}
          {conciliando ? "Conciliando..." : "Conciliar Ingreso"}
        </button>
        <button onClick={() => setRechazado(true)} style={{ backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: "0.375rem", padding: "0.6rem 1rem", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", transition: "all 0.15s ease" }}>Rechazar</button>
      </div>
    </div>
  );
}
