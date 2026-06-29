"use client";

import { FileText, ExternalLink } from "lucide-react";
import { Icons } from "@/lib/icons";
import { formatEuro } from "@/lib/utils/currency";
import { getDocTypeBadge, getPaymentStatusBadge } from "@/lib/utils/documentos";
import styles from "@/app/expedientes/[id]/page.module.css";

interface Props {
  docs: any[];
  onOpen: (doc: any) => void;
}

export default function DocumentosGrid({ docs, onOpen }: Props) {
  if (docs.length === 0) {
    return (
      <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#64748b", padding: "4rem 2rem", background: "#ffffff", border: "1px dashed #e2e8f0", borderRadius: "0.75rem" }}>
        <FileText size={40} style={{ color: "#cbd5e1", marginBottom: "0.5rem" }} />
        <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>No hay documentos asociados a este expediente.</p>
        <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Importa una factura de proveedor desde la pestaña de Servicios.</p>
      </div>
    );
  }

  return (
    <>
      {docs.map((doc) => {
        const badge = getDocTypeBadge(doc.documento_tipo);
        const payBadge = getPaymentStatusBadge(doc.estado_pago);
        const provName = doc.extraccion_json?.cabecera?.proveedor_nombre || "Emisor no detectado";
        return (
          <div key={doc.id} className={styles.docCard}>
            <div className={styles.docIconWrapper}>
              <Icons.Documentos size={28} style={{ color: badge.color }} />
              <span className={styles.docFormatBadge} style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.text}</span>
            </div>
            <div className={styles.stackedCell}>
              <span className={styles.mainText} style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", fontWeight: 700 }}>
                {provName}
              </span>
              <span className={styles.subText} style={{ fontWeight: 500, color: "#0f172a" }}>
                Nº {doc.documento_numero || "—"} · {formatEuro(Number(doc.total_documento || 0))}
              </span>
              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", marginTop: "0.35rem" }}>
                <span style={{ padding: "0.15rem 0.4rem", borderRadius: "0.25rem", fontSize: "0.68rem", fontWeight: 700, backgroundColor: payBadge.bg, color: payBadge.color, border: payBadge.border, textTransform: "uppercase" }}>
                  {payBadge.text}
                </span>
                <span className={styles.subText} style={{ fontSize: "0.65rem" }}>Abonado: {formatEuro(Number(doc.importe_pagado || 0))}</span>
              </div>
            </div>
            <div className={styles.docActions}>
              <button className={styles.actionIconButton} style={{ width: 28, height: 28 }} title="Ver detalles y conciliar" onClick={() => onOpen(doc)}>
                <Icons.Eye size={14} />
              </button>
              <a href={doc.archivo_url} target="_blank" rel="noreferrer" className={styles.actionIconButton} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }} title="Ver PDF original">
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        );
      })}
    </>
  );
}
