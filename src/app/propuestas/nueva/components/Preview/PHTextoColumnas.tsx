"use client";
import React from "react";
import styles from "../../page.module.css";
import type { TextoEstilo } from "../../types";
import { estiloTextoCSS } from "../../utils/style-utils";
import { Ph } from "./PHPlaceholders";

function renderTextWithBold(text?: string, estilo?: TextoEstilo) {
  if (!text) return null;
  const lineas = text.split("\n");
  return lineas.map((linea, index) => {
    const trimmed = linea.trim();
    const esVineta = trimmed.startsWith(".-");
    const contenidoLinea = esVineta ? trimmed.slice(2).trim() : linea;

    const parts = contenidoLinea.split("**");
    const lineContent = parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} style={{ color: estilo?.colorDestacado ?? undefined, fontWeight: estilo?.grosorDestacado ?? "800" }}>{part}</strong>;
      }
      return part;
    });

    if (esVineta) {
      return (
        <span key={index} style={{ display: "flex", gap: "8px", alignItems: "flex-start", paddingLeft: "8px", marginTop: "4px", marginBottom: "4px", textAlign: "left" }}>
          <span style={{ color: estilo?.colorDestacado ?? undefined, fontWeight: "bold" }}>•</span>
          <span style={{ flex: 1 }}>{lineContent}</span>
        </span>
      );
    } else {
      return (
        <span key={index} style={{ display: "block", minHeight: linea === "" ? "0.75em" : undefined }}>
          {lineContent}
        </span>
      );
    }
  });
}

export default function PHTextoColumnas({
  mobile,
  layout,
  titulo,
  colorFondo,
  estiloTitulo,
  estiloTituloDia,
  estiloDescDia,
  columnas,
  anchoMax
}: {
  mobile?: boolean;
  layout?: string;
  titulo?: string;
  colorFondo?: string;
  estiloTitulo?: TextoEstilo;
  estiloTituloDia?: TextoEstilo;
  estiloDescDia?: TextoEstilo;
  columnas?: { titulo?: string; texto?: string }[];
  anchoMax?: string;
}) {
  const colCount = layout === "2-cols" ? 2 : layout === "4-cols" ? 4 : 3;
  const gridClass = mobile
    ? styles.phCol1
    : layout === "2-cols"
    ? styles.phCol2
    : layout === "4-cols"
    ? styles.phCol4
    : styles.phCol3;

  const defaultCols = [
    { titulo: "Columna 1", texto: ".- Elemento de ejemplo." },
    { titulo: "Columna 2", texto: ".- Elemento de ejemplo." },
    { titulo: "Columna 3", texto: ".- Elemento de ejemplo." },
    { titulo: "Columna 4", texto: ".- Elemento de ejemplo." }
  ];

  const displayCols = Array.from({ length: colCount }).map((_, idx) => {
    return (columnas ?? [])[idx] || defaultCols[idx % defaultCols.length];
  });

  const customMaxWidth = anchoMax === "900px" ? "min(900px, 46.875cqw)" : anchoMax === "1200px" ? "min(1200px, 62.5cqw)" : "min(1920px, 100cqw)";

  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div className={styles.phTextoColumnas} style={{ maxWidth: customMaxWidth }}>
          {titulo ? (
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 4px 0", ...estiloTextoCSS(estiloTitulo) }}>{titulo}</h3>
          ) : (
            <div style={{ width: "35%", height: "18px", borderRadius: "9px", background: "#cbd5e1", margin: "0 0 4px 0" }} />
          )}
          <div className={`${styles.phColumnasGrid} ${gridClass}`}>
            {displayCols.map((c, i) => (
              <div key={i} className={styles.phColumnaCard}>
                {c.titulo ? (
                  <h4 className={styles.phColumnaTitulo} style={estiloTextoCSS(estiloTituloDia)}>{c.titulo}</h4>
                ) : (
                  <div style={{ width: "60%", height: "12px", borderRadius: "6px", background: "#cbd5e1" }} />
                )}
                {c.texto ? (
                  <p className={styles.phColumnaTexto} style={estiloTextoCSS(estiloDescDia)}>{renderTextWithBold(c.texto, estiloDescDia)}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ width: "90%", height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
                    <div style={{ width: "85%", height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
                    <div style={{ width: "60%", height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Ph>
    </div>
  );
}
