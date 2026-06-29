"use client";

import { ExternalLink } from "lucide-react";
import { Icons } from "@/lib/icons";
import { formatDate } from "@/lib/utils/date";
import { formatEuro } from "@/lib/utils/currency";
import { getDocTypeBadge, getPaymentStatusBadge } from "@/lib/utils/documentos";
import styles from "@/app/expedientes/[id]/page.module.css";

interface Props {
  docs: any[];
  onOpen: (doc: any) => void;
}

export default function DocumentosList({ docs, onOpen }: Props) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Emisor / Proveedor</th>
            <th>Nº Documento</th>
            <th>Tipo</th>
            <th>Fecha Emisión</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th style={{ textAlign: "center" }}>Estado Pago</th>
            <th style={{ textAlign: "right" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>No se encontraron documentos.</td></tr>
          ) : docs.map((doc) => {
            const badge = getDocTypeBadge(doc.documento_tipo);
            const payBadge = getPaymentStatusBadge(doc.estado_pago);
            const provName = doc.extraccion_json?.cabecera?.proveedor_nombre || "Emisor no detectado";
            return (
              <tr key={doc.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Icons.Documentos size={18} style={{ color: badge.color }} />
                    <span className={styles.mainText} style={{ fontWeight: 600 }}>{provName}</span>
                  </div>
                </td>
                <td>{doc.documento_numero || "—"}</td>
                <td>
                  <span style={{ padding: "0.2rem 0.5rem", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600, backgroundColor: badge.bg, color: badge.color, textTransform: "uppercase" }}>
                    {badge.text}
                  </span>
                </td>
                <td>{formatDate(doc.fecha_emision)}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{formatEuro(Number(doc.total_documento || 0))}</td>
                <td style={{ textAlign: "center" }}>
                  <span style={{ display: "inline-block", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", fontSize: "0.7rem", fontWeight: 700, backgroundColor: payBadge.bg, color: payBadge.color, border: payBadge.border, textTransform: "uppercase" }}>
                    {payBadge.text}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.25rem" }}>
                    <button className={styles.actionIconButton} title="Ver detalles y conciliar" onClick={() => onOpen(doc)}><Icons.Eye size={14} /></button>
                    <a href={doc.archivo_url} target="_blank" rel="noreferrer" className={styles.actionIconButton} style={{ display: "flex", alignItems: "center", justifyContent: "center" }} title="Ver PDF original"><ExternalLink size={13} /></a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
