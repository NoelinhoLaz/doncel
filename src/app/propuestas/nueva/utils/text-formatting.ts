import React from "react";
import type { TextoEstilo } from "../types";
import { FUENTE_FAMILY } from "../constants";
import { estiloTextoCSS, sustituirVariables, VARIABLES_PROPUESTA } from "./style-utils";
import { renderRichText } from "./render-rich-text";

export { VARIABLES_PROPUESTA };

function esHTML(texto: string): boolean {
  return /^\s*<[a-z][\s\S]*>/i.test(texto);
}

// Divide un fragmento de texto en partes: links [texto](url) y texto plano
function parsearInlineLinks(
  texto: string,
  colorDestacado: string | undefined,
  keyPrefix: string
): React.ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(texto)) !== null) {
    if (match.index > lastIndex) {
      result.push(texto.slice(lastIndex, match.index));
    }
    result.push(
      React.createElement(
        "a",
        {
          key: `${keyPrefix}-link-${match.index}`,
          href: match[2],
          target: "_blank",
          rel: "noopener noreferrer",
          style: { color: colorDestacado ?? "#6366f1", textDecoration: "underline" },
        },
        match[1]
      )
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < texto.length) {
    result.push(texto.slice(lastIndex));
  }

  return result;
}

// Divide un fragmento por **negrita**, luego parsea links dentro de cada parte
function parsearInline(
  texto: string,
  colorDestacado: string | undefined,
  grosorDestacado: string | undefined,
  tipo: string,
  keyPrefix: string
): React.ReactNode[] {
  const color = (colorDestacado && colorDestacado !== "#ffffff" && colorDestacado !== "#1e293b" && colorDestacado !== "#64748b" && colorDestacado !== "#334155")
    ? colorDestacado
    : `var(--momo-color-destacado-${tipo})`;
  const grosor = grosorDestacado || "bold";

  const partes = texto.split(/(\*\*.*?\*\*)/g);
  return partes.flatMap((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      const inner = p.slice(2, -2);
      return [
        React.createElement(
          "strong",
          {
            key: `${keyPrefix}-b-${i}`,
            style: {
              color: color,
              fontWeight: grosor as any
            },
          },
          ...parsearInlineLinks(inner, color, `${keyPrefix}-b-${i}`)
        ),
      ];
    }
    return parsearInlineLinks(p, color, `${keyPrefix}-${i}`);
  });
}

export function parseFormattedText(
  texto: string,
  colorDestacado?: string,
  grosorDestacado?: string,
  estilo?: TextoEstilo,
  defaultTipo?: "titulo" | "subtitulo" | "parrafo" | "negrita"
): React.ReactNode {
  if (!texto) return null;

  if (esHTML(texto)) {
    return renderRichText(texto, { colorDestacado, grosorDestacado, estilo, defaultTipo });
  }

  const tipo = defaultTipo ?? "parrafo";
  const localColor = colorDestacado ?? estilo?.colorDestacado;
  const color = (localColor && localColor !== "#ffffff" && localColor !== "#1e293b" && localColor !== "#64748b" && localColor !== "#334155")
    ? localColor
    : `var(--momo-color-destacado-${tipo})`;
  const grosor = grosorDestacado ?? estilo?.grosorDestacado ?? "bold";

  const textoConVariables = sustituirVariables(texto);

  return textoConVariables.split("\n").map((linea, index) => {
    const trimmed = linea.trim();
    const esVineta = trimmed.startsWith(".-");
    const contenido = esVineta ? trimmed.slice(2).trim() : linea;

    const lineContent = parsearInline(contenido, color, grosor, tipo, `l${index}`);

    const baseParagraphStyle = estiloTextoCSS(estilo, tipo);

    if (esVineta) {
      return React.createElement(
        "span",
        {
          key: index,
          style: {
            display: "flex", gap: "8px", alignItems: "flex-start",
            paddingLeft: "8px", marginTop: "4px", marginBottom: "4px", textAlign: "left" as const,
            ...baseParagraphStyle
          },
        },
        React.createElement("span", { style: { color: color ?? "#6366f1", fontWeight: "bold" } }, "•"),
        React.createElement("span", { style: { flex: 1 } }, ...lineContent)
      );
    }

    return React.createElement(
      "span",
      {
        key: index,
        style: {
          display: "block",
          minHeight: linea === "" ? "0.75em" : undefined,
          ...baseParagraphStyle
        }
      },
      ...lineContent
    );
  });
}
