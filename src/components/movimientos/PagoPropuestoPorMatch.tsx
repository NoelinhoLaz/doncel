"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { conciliarDesdeMovimientoBanco } from "@/actions/banco";

interface PagoPropuestoPorMatchProps {
  movimiento: {
    id: string;
    importe: number;
    fecha_operacion: string;
  };
  match: {
    origen?: "documento" | "servicio";
    expediente_id: string;
    expediente_numero?: string;
    expediente_referencia?: string;
    documento_id: string | null;
    servicio_id?: string | null;
    proveedor_nombre: string;
    proveedor_nif: string;
    match_score: number;
    razon: string;
    pagos: Array<{ id: string; importe: number; metodo_pago: string }>;
  };
  onConciliado?: () => void;
}

export function PagoPropuestoPorMatch({
  movimiento,
  match,
  onConciliado,
}: PagoPropuestoPorMatchProps) {
  const [conciliando, setConciliando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazado, setRechazado] = useState(false);
  const [selectedPagos, setSelectedPagos] = useState<Set<string>>(new Set(match.pagos.map(p => p.id)));

  const displayScore = match.match_score <= 1 ? Math.round(match.match_score * 100) : Math.round(match.match_score);
  const isExacta = displayScore === 100;
  const isSimilar = displayScore >= 90;

  // Premium harmonized colors
  const primaryColor = isExacta ? "#10b981" : isSimilar ? "var(--primary-color, #475569)" : "#64748b";
  const lightBgColor = isExacta ? "#f0fdf4" : isSimilar ? "color-mix(in srgb, var(--primary-color, #475569), transparent 90%)" : "#f8fafc";
  const darkTextColor = isExacta ? "#166534" : isSimilar ? "var(--primary-color, #475569)" : "#334155";
  const borderColor = isExacta ? "#bbf7d0" : isSimilar ? "color-mix(in srgb, var(--primary-color, #475569), transparent 75%)" : "#e2e8f0";

  const handleConciliar = async () => {
    setConciliando(true);
    setError(null);

    try {
      const pagoIds = selectedPagos.size > 0
        ? match.pagos.filter(p => selectedPagos.has(p.id)).map(p => p.id)
        : match.pagos.map(p => p.id);

      if (pagoIds.length === 0) {
        setError("Debes seleccionar al menos un plazo");
        setConciliando(false);
        return;
      }

      const result = await conciliarDesdeMovimientoBanco(
        movimiento.id,
        pagoIds
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: lightBgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: "0.75rem",
        padding: "1rem",
        color: darkTextColor,
        fontFamily: '"Montserrat", "Inter", sans-serif',
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Header */}
      <div 
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          borderBottom: `1px solid ${borderColor}`,
          paddingBottom: "0.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          {isExacta ? (
            <CheckCircle2 size={16} style={{ color: "#10b981" }} />
          ) : (
            <AlertCircle size={16} style={{ color: primaryColor }} />
          )}
          <span
            style={{
              fontWeight: "700",
              fontSize: "0.85rem",
              color: primaryColor
            }}
          >
            {displayScore}% Confianza
          </span>
        </div>

        <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#64748b" }}>
          {match.origen === "servicio" ? "Servicio" : isExacta ? "Coincidencia exacta" : isSimilar ? "Coincidencia similar" : "Coincidencia posible"}
        </div>
      </div>

      {/* Detalles */}
      <div 
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
          marginBottom: "0.75rem"
        }}
      >
        <div>
          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>
            Expediente
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a" }}>
            {match.expediente_numero ? `#${match.expediente_numero}` : `#${match.expediente_id.slice(0, 8).toUpperCase()}`}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>
            Proveedor
          </div>
          <div 
            style={{ 
              fontSize: "0.8rem", 
              fontWeight: "700", 
              color: "#0f172a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }} 
            title={match.proveedor_nombre}
          >
            {match.proveedor_nombre}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>
            Importe Cargo
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a" }}>
            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.abs(movimiento.importe))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "0.15rem" }}>
            {match.origen === "servicio" ? "Tipo" : "Plazos Asociados"}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a" }}>
            {match.origen === "servicio" ? "Servicio directo" : `${match.pagos.length} ${match.pagos.length === 1 ? "plazo" : "plazos"}`}
          </div>
        </div>
      </div>

      {/* Plazos con checkboxes */}
      {match.pagos.length > 1 && (
        <div 
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.4)",
            border: "1px solid rgba(226, 232, 240, 0.4)",
            borderRadius: "0.375rem",
            padding: "0.5rem",
            marginBottom: "0.75rem",
            fontSize: "0.7rem",
            color: "#475569"
          }}
        >
          <p style={{ fontWeight: "700", color: "#334155", marginBottom: "0.25rem", marginTop: 0 }}>
            {match.pagos.length} {match.pagos.length === 1 ? "plazo" : "plazos"}
          </p>
          {match.pagos.map((p) => {
            const isChecked = selectedPagos.has(p.id);
            return (
              <label key={p.id} style={{ marginLeft: "0.5rem", marginBottom: "0.15rem", fontWeight: "500", display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.75rem" }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    setSelectedPagos(prev => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                      return next;
                    });
                  }}
                  style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer", margin: 0 }}
                />
                {p.metodo_pago || "Pago"}: {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(p.importe)}
              </label>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div 
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fee2e2",
            borderRadius: "0.375rem",
            padding: "0.6rem",
            marginBottom: "0.75rem",
            fontSize: "0.75rem",
            color: "#991b1b",
            fontWeight: "600"
          }}
        >
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Botones */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={handleConciliar}
          disabled={conciliando}
          style={{
            flexGrow: 1,
            flex: 1,
            backgroundColor: "var(--primary-color, #475569)",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.375rem",
            padding: "0.6rem",
            fontWeight: "700",
            fontSize: "0.85rem",
            cursor: conciliando ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.35rem",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => {
            if (!conciliando) e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary-color, #475569), #000000 12%)";
          }}
          onMouseLeave={(e) => {
            if (!conciliando) e.currentTarget.style.backgroundColor = "var(--primary-color, #475569)";
          }}
        >
          {conciliando && <Loader2 size={14} className="animate-spin" />}
          {conciliando ? "Conciliando..." : "Conciliar y Asentar"}
        </button>

        <button
          onClick={() => setRechazado(true)}
          style={{
            backgroundColor: "#f8fafc",
            color: "#64748b",
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            padding: "0.6rem 1rem",
            fontWeight: "600",
            fontSize: "0.85rem",
            cursor: "pointer",
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f1f5f9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#f8fafc";
          }}
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
