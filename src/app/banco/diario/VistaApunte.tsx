"use client";

import { formatDate } from "@/lib/utils/date";
import { formatEuroContable } from "@/lib/utils/contabilidad";
import type { Filtros } from "@/hooks/useLibroDiario";
import s from "./diario.module.css";

interface Props {
  apuntes: any[];
  onUpdateFiltro: <K extends keyof Filtros>(key: K, value: Filtros[K]) => void;
}

export default function VistaApunte({ apuntes, onUpdateFiltro }: Props) {
  return (
    <div className={s.asientoCard} style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className={s.apuntesTable} style={{ width: "100%" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              {["FECHA", "ASIENTO", "CUENTA", "CONTACTO", "CONCEPTO APUNTE"].map(h => (
                <th key={h} style={{ padding: "0.4rem 0.75rem" }}>{h}</th>
              ))}
              <th style={{ padding: "0.4rem 0.75rem", textAlign: "right", width: "135px" }}>DEBE</th>
              <th style={{ padding: "0.4rem 0.75rem", textAlign: "right", width: "135px" }}>HABER</th>
            </tr>
          </thead>
          <tbody>
            {apuntes.map((ap) => {
              const isCredit = Number(ap.haber || 0) > 0;
              return (
                <tr key={ap.id} className={isCredit ? s.creditRow : s.debitRow} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem", color: "#475569", whiteSpace: "nowrap" }}>
                    {formatDate(ap.asientoFecha)}
                  </td>
                  <td style={{ padding: "0.35rem 0.75rem", fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {ap.asientoNumero
                      ? <span style={{ color: "#64748b" }}>{ap.asientoNumero}</span>
                      : <span className={s.pendienteBadge}>Pendiente</span>}
                  </td>
                  <td style={{ padding: "0.35rem 0.75rem" }}>
                    <button onClick={() => onUpdateFiltro("cuentaId", ap.cuenta_id)} className={s.cuentaPill} title="Filtrar por esta cuenta">
                      {ap.subcuenta || ap.config_cuentas_contables?.codigo}
                    </button>
                  </td>
                  <td style={{ padding: "0.35rem 0.75rem" }}>
                    {ap.contabilidad_entidades?.nombre || ap.contabilidad_proveedores?.nombre
                      ? <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{ap.contabilidad_entidades?.nombre || ap.contabilidad_proveedores?.nombre}</span>
                      : <span style={{ color: "#cbd5e1", fontSize: "0.78rem" }}>—</span>}
                  </td>
                  <td style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem", color: "#475569" }}>{ap.concepto || "—"}</td>
                  <td style={{ padding: "0.35rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#0f172a", fontSize: "0.75rem" }}>{formatEuroContable(ap.debe)}</td>
                  <td style={{ padding: "0.35rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#64748b", fontSize: "0.75rem" }}>{formatEuroContable(ap.haber)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
