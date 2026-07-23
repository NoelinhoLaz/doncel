import React from "react";
import DOMPurify from "dompurify";
import type { TextoEstilo } from "../types";
import { estiloTextoCSS, sustituirVariables } from "./style-utils";

const ALLOWED_TAGS = ["p", "strong", "em", "s", "code", "ul", "ol", "li", "br", "a"];
const ALLOWED_ATTR = ["href", "target", "rel"];

function esHTML(texto: string): boolean {
  return /^\s*<[a-z][\s\S]*>/i.test(texto);
}

/** Renderiza texto legacy (marcado ** / .- / \n) — se mantiene para datos guardados antes de migrar a HTML. */
function renderLegacy(
  texto: string,
  colorDestacado: string | undefined,
  grosorDestacado: string | undefined,
  tipo: "titulo" | "subtitulo" | "parrafo" | "negrita",
  estilo?: TextoEstilo
): React.ReactNode {
  const color = (colorDestacado && colorDestacado !== "#ffffff" && colorDestacado !== "#1e293b" && colorDestacado !== "#64748b" && colorDestacado !== "#334155")
    ? colorDestacado
    : `var(--momo-color-destacado-${tipo})`;
  const grosor = grosorDestacado || "bold";

  const textoConVariables = sustituirVariables(texto);
  const lineas = textoConVariables.split("\n");

  return lineas.map((linea, index) => {
    const trimmed = linea.trim();
    const esVineta = trimmed.startsWith(".-");
    const contenidoLinea = esVineta ? trimmed.slice(2).trim() : linea;

    const partes = contenidoLinea.split(/(\*\*.*?\*\*)/g);
    const lineContent = partes.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color, fontWeight: grosor as any }}>{p.slice(2, -2)}</strong>
        : p
    );

    if (esVineta) {
      return (
        <span key={index} style={{ display: "flex", gap: "8px", alignItems: "flex-start", paddingLeft: "8px", marginTop: "4px", marginBottom: "4px", textAlign: "left" }}>
          <span style={{ color, fontWeight: "bold" }}>•</span>
          <span style={{ flex: 1 }}>{lineContent}</span>
        </span>
      );
    }
    return (
      <span key={index} style={{ display: "block", minHeight: linea === "" ? "0.75em" : undefined }}>
        {lineContent}
      </span>
    );
  });
}

export interface RenderRichTextOpts {
  colorDestacado?: string;
  grosorDestacado?: string;
  estilo?: TextoEstilo;
  defaultTipo?: "titulo" | "subtitulo" | "parrafo" | "negrita";
}

/** Renderiza un campo de texto de sección: HTML (Tiptap) si el contenido ya es HTML, o el marcado legacy (**, .-) si son datos antiguos. */
export function renderRichText(texto: string | undefined, opts: RenderRichTextOpts = {}): React.ReactNode {
  if (!texto) return null;
  const tipo = opts.defaultTipo ?? "parrafo";
  const colorDestacado = opts.colorDestacado ?? opts.estilo?.colorDestacado;
  const grosorDestacado = opts.grosorDestacado ?? opts.estilo?.grosorDestacado;

  if (!esHTML(texto)) {
    return renderLegacy(texto, colorDestacado, grosorDestacado, tipo, opts.estilo);
  }

  const color = (colorDestacado && colorDestacado !== "#ffffff" && colorDestacado !== "#1e293b" && colorDestacado !== "#64748b" && colorDestacado !== "#334155")
    ? colorDestacado
    : `var(--momo-color-destacado-${tipo})`;
  const grosor = grosorDestacado || "bold";

  const conVariables = sustituirVariables(texto);
  const sanitizado = DOMPurify.sanitize(conVariables, { ALLOWED_TAGS, ALLOWED_ATTR });

  return (
    <span
      className="momo-rich-inline"
      style={{
        ...estiloTextoCSS(opts.estilo, tipo),
        ["--momo-color-destacado" as any]: color,
        ["--momo-grosor-destacado" as any]: grosor,
      }}
      dangerouslySetInnerHTML={{ __html: sanitizado }}
    />
  );
}
