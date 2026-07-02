import React from "react";
import type { TextoEstilo } from "../types";
import { FUENTE_FAMILY } from "../constants";

export function estiloTextoCSS(e?: TextoEstilo): React.CSSProperties {
  if (!e) return {};
  const tamanoNum = e.tamano ? parseInt(e.tamano) : 0;
  return {
    ...(e.fuente      ? { fontFamily: FUENTE_FAMILY[e.fuente] ?? e.fuente } : {}),
    ...(e.tamano      ? { fontSize: e.tamano.endsWith("px") && tamanoNum > 0 ? `min(${e.tamano}, calc(${tamanoNum / 1920} * 100cqw))` : e.tamano } : {}),
    ...(e.grosor      ? { fontWeight: e.grosor } : {}),
    ...(e.alineacionH ? { textAlign: e.alineacionH as React.CSSProperties["textAlign"] } : {}),
    ...(e.color       ? { color: e.color } : {}),
  };
}

export function getMaxWidth(anchoMax?: string): string {
  if (anchoMax === "900px")  return "min(900px, 46.875cqw)";
  if (anchoMax === "1200px") return "min(1200px, 62.5cqw)";
  return "min(1920px, 100cqw)";
}
