"use client";

import { Icons } from "@/lib/icons";
import { PagoPropuestoPorMatch } from "@/components/movimientos/PagoPropuestoPorMatch";

interface MatchBancarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMatch: any;
  onConciliado: () => void;
}

export default function MatchBancarioModal({
  isOpen,
  onClose,
  selectedMatch,
  onConciliado,
}: MatchBancarioModalProps) {
  if (!isOpen || !selectedMatch) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(12px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "480px",
          backgroundColor: "rgba(255, 255, 255, 0.98)",
          borderRadius: "1.5rem",
          padding: "1.25rem 1.5rem",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          border: "1px solid rgba(255, 255, 255, 0.8)",
        }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "#f1f5f9",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#64748b",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#0f172a"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}
        >
          <Icons.Close size={16} />
        </button>
        <PagoPropuestoPorMatch
          movimiento={{
            id: selectedMatch.id,
            importe: Number(selectedMatch.importe),
            fecha_operacion: selectedMatch.fecha_operacion || ""
          }}
          match={{
            expediente_id: selectedMatch.match_metadatos.expediente_id,
            expediente_numero: selectedMatch.match_metadatos.expediente_numero,
            documento_id: selectedMatch.match_metadatos.documento_id,
            proveedor_nombre: selectedMatch.match_metadatos.proveedor_nombre,
            proveedor_nif: selectedMatch.match_metadatos.proveedor_nif || "",
            match_score: Number(selectedMatch.match_score),
            razon: selectedMatch.match_metadatos.razon || "",
            pagos: selectedMatch.match_metadatos.pagos || []
          }}
          onConciliado={() => {
            onConciliado();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
