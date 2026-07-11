import React from "react";
import type { TextoEstilo } from "../types";
import { FUENTE_FAMILY } from "../constants";

export function estiloTextoCSS(e?: TextoEstilo, defaultTipo?: "titulo" | "subtitulo" | "parrafo" | "negrita"): React.CSSProperties {
  if (!defaultTipo) return {};

  const fuente = `var(--momo-font-${defaultTipo})`;
  const tamano = `var(--momo-size-${defaultTipo})`;
  const grosor = `var(--momo-weight-${defaultTipo})`;
  const color = `var(--momo-color-${defaultTipo})`;
  const alineacionH = e?.alineacionH;

  return {
    fontFamily: fuente,
    fontSize: tamano,
    fontWeight: grosor as any,
    color: color,
    ...(alineacionH ? { textAlign: alineacionH as React.CSSProperties["textAlign"] } : {}),
  };
}

export function getResponsiveSize(size?: string) {
  if (!size) return undefined;
  const num = parseInt(size);
  if (size.endsWith("px") && num > 0) {
    return `min(${size}, calc(${num / 1920} * 100cqw))`;
  }
  return size;
}

export const DEFAULT_ESTILOS_GLOBALES = {
  titulo: { fuente: "Raleway", grosor: "800", tamano: "32px", color: "#1e293b", colorDestacado: "#6366f1" },
  subtitulo: { fuente: "Montserrat", grosor: "400", tamano: "16px", color: "#64748b", colorDestacado: "#6366f1" },
  parrafo: { fuente: "Montserrat", grosor: "400", tamano: "14px", color: "#334155", colorDestacado: "#6366f1" },
};

export function getStyleVars(estilosGlobales: any) {
  const styles = {
    titulo: { ...DEFAULT_ESTILOS_GLOBALES.titulo, ...estilosGlobales?.titulo },
    subtitulo: { ...DEFAULT_ESTILOS_GLOBALES.subtitulo, ...estilosGlobales?.subtitulo },
    parrafo: { ...DEFAULT_ESTILOS_GLOBALES.parrafo, ...estilosGlobales?.parrafo },
  };
  return {
    "--momo-font-titulo": styles.titulo.fuente ? (FUENTE_FAMILY[styles.titulo.fuente] ?? styles.titulo.fuente) : undefined,
    "--momo-size-titulo": getResponsiveSize(styles.titulo.tamano),
    "--momo-weight-titulo": styles.titulo.grosor,
    "--momo-color-titulo": styles.titulo.color,
    "--momo-color-destacado-titulo": styles.titulo.colorDestacado,

    "--momo-font-subtitulo": styles.subtitulo.fuente ? (FUENTE_FAMILY[styles.subtitulo.fuente] ?? styles.subtitulo.fuente) : undefined,
    "--momo-size-subtitulo": getResponsiveSize(styles.subtitulo.tamano),
    "--momo-weight-subtitulo": styles.subtitulo.grosor,
    "--momo-color-subtitulo": styles.subtitulo.color,
    "--momo-color-destacado-subtitulo": styles.subtitulo.colorDestacado,

    "--momo-font-parrafo": styles.parrafo.fuente ? (FUENTE_FAMILY[styles.parrafo.fuente] ?? styles.parrafo.fuente) : undefined,
    "--momo-size-parrafo": getResponsiveSize(styles.parrafo.tamano),
    "--momo-weight-parrafo": styles.parrafo.grosor,
    "--momo-color-parrafo": styles.parrafo.color,
    "--momo-color-destacado-parrafo": styles.parrafo.colorDestacado,
  } as React.CSSProperties;
}

export function getMaxWidth(anchoMax?: string): string {
  if (anchoMax === "900px")  return "min(900px, 46.875cqw)";
  if (anchoMax === "1200px") return "min(1200px, 62.5cqw)";
  return "min(1920px, 100cqw)";
}
