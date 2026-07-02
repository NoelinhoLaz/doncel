import React from "react";
import type { TextoEstilo } from "../types";

export function parseFormattedText(
  texto: string,
  colorDestacado?: string,
  grosorDestacado?: string,
  estilo?: TextoEstilo
): React.ReactNode {
  if (!texto) return null;
  const color = colorDestacado ?? estilo?.colorDestacado ?? undefined;
  const grosor = grosorDestacado ?? estilo?.grosorDestacado ?? "bold";

  const lineas = texto.split("\n");
  return lineas.map((linea, index) => {
    const trimmed = linea.trim();
    const esVineta = trimmed.startsWith(".-");
    const contenidoLinea = esVineta ? trimmed.slice(2).trim() : linea;

    const partes = contenidoLinea.split(/(\*\*.*?\*\*)/g);
    const lineContent = partes.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? React.createElement("strong", { key: i, style: { color: color ?? "#6366f1", fontWeight: grosor } }, p.slice(2, -2))
        : p
    );

    if (esVineta) {
      return React.createElement(
        "span",
        { key: index, style: { display: "flex", gap: "8px", alignItems: "flex-start", paddingLeft: "8px", marginTop: "4px", marginBottom: "4px", textAlign: "left" as const } },
        React.createElement("span", { style: { color: color ?? "#6366f1", fontWeight: "bold" } }, "•"),
        React.createElement("span", { style: { flex: 1 } }, lineContent)
      );
    }
    return React.createElement(
      "span",
      { key: index, style: { display: "block", minHeight: linea === "" ? "0.75em" : undefined } },
      lineContent
    );
  });
}
