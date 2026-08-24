"use client";

import { useState } from "react";
import { Users, Copy, Check } from "lucide-react";
import { generarCodigoAccesoResponsable } from "@/actions/expedientes";
import s from "./ajustes.module.css";

interface Props {
  expedienteId: string;
  codigoAcceso?: string | null;
  emailResponsable?: string | null;
}

export default function AccesoResponsableSection({ expedienteId, codigoAcceso, emailResponsable }: Props) {
  const [codigo, setCodigo] = useState<string | null>(codigoAcceso ?? null);
  const [loading, setLoading] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function handleGenerar() {
    setLoading(true);
    const result = await generarCodigoAccesoResponsable(expedienteId);
    setLoading(false);
    if ("codigo" in result && result.codigo) {
      setCodigo(result.codigo);
    }
  }

  function handleCopiar() {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className={s.fieldWrap} style={{ marginTop: "1rem" }}>
      <span className={s.fieldLabel}>
        <Users size={12} style={{ verticalAlign: "-2px", marginRight: "0.25rem" }} />
        Acceso del responsable del viaje
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {codigo ? (
          <>
            <span className={s.displayVal} style={{ fontFamily: "monospace" }}>{codigo}</span>
            <button
              type="button"
              onClick={handleCopiar}
              className={s.deleteBtn}
              style={{ color: "#475569" }}
              title="Copiar código"
            >
              {copiado ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </>
        ) : (
          <span className={s.displayVal}>—</span>
        )}
        <button
          type="button"
          onClick={handleGenerar}
          disabled={loading}
          className={s.inp}
          style={{ width: "auto", cursor: loading ? "default" : "pointer", fontWeight: 600 }}
        >
          {loading ? "Generando..." : codigo ? "Regenerar código" : "Generar código de acceso"}
        </button>
        {emailResponsable ? (
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{emailResponsable}</span>
        ) : (
          <span style={{ fontSize: "0.78rem", color: "#ef4444" }}>
            El contacto principal no tiene email guardado
          </span>
        )}
      </div>
    </div>
  );
}
