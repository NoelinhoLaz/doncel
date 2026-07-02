import React from "react";
import type { TextoEstilo } from "../types";

// Variables que se sustituyen en el previsualizador
export const VARIABLES_PROPUESTA: Record<string, string> = {
  "[Nombre_Cliente]": "María",
  "[Apellidos_Cliente]": "García López",
  "[Nombre_Responsable]": "Carlos Martínez",
  "[Fecha_Salida]": "15 de agosto de 2025",
  "[Fecha_Vuelta]": "25 de agosto de 2025",
  "[Destino]": "París",
  "[Num_Viajeros]": "2",
  "[Num_Noches]": "10",
  "[Precio_Total]": "3.200 €",
  "[Precio_Por_Persona]": "1.600 €",
};

function sustituirVariables(texto: string): string {
  return Object.entries(VARIABLES_PROPUESTA).reduce(
    (t, [key, val]) => t.replaceAll(key, val),
    texto
  );
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
  keyPrefix: string
): React.ReactNode[] {
  const partes = texto.split(/(\*\*.*?\*\*)/g);
  return partes.flatMap((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      const inner = p.slice(2, -2);
      return [
        React.createElement(
          "strong",
          {
            key: `${keyPrefix}-b-${i}`,
            style: { color: colorDestacado ?? "#6366f1", fontWeight: grosorDestacado ?? "bold" },
          },
          ...parsearInlineLinks(inner, colorDestacado, `${keyPrefix}-b-${i}`)
        ),
      ];
    }
    return parsearInlineLinks(p, colorDestacado, `${keyPrefix}-${i}`);
  });
}

export function parseFormattedText(
  texto: string,
  colorDestacado?: string,
  grosorDestacado?: string,
  estilo?: TextoEstilo
): React.ReactNode {
  if (!texto) return null;
  const color = colorDestacado ?? estilo?.colorDestacado ?? undefined;
  const grosor = grosorDestacado ?? estilo?.grosorDestacado ?? "bold";

  const textoConVariables = sustituirVariables(texto);

  return textoConVariables.split("\n").map((linea, index) => {
    const trimmed = linea.trim();
    const esVineta = trimmed.startsWith(".-");
    const contenido = esVineta ? trimmed.slice(2).trim() : linea;

    const lineContent = parsearInline(contenido, color, grosor, `l${index}`);

    if (esVineta) {
      return React.createElement(
        "span",
        {
          key: index,
          style: {
            display: "flex", gap: "8px", alignItems: "flex-start",
            paddingLeft: "8px", marginTop: "4px", marginBottom: "4px", textAlign: "left" as const,
          },
        },
        React.createElement("span", { style: { color: color ?? "#6366f1", fontWeight: "bold" } }, "•"),
        React.createElement("span", { style: { flex: 1 } }, ...lineContent)
      );
    }

    return React.createElement(
      "span",
      { key: index, style: { display: "block", minHeight: linea === "" ? "0.75em" : undefined } },
      ...lineContent
    );
  });
}
