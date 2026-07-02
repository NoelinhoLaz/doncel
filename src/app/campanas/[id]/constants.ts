"use client";

import React from "react";

// ─── Color constants ──────────────────────────────────────────────────────────

export const P = "var(--primary-color, #475569)";
export const PL = "color-mix(in srgb, var(--primary-color, #475569) 12%, white)";
export const PB = "color-mix(in srgb, var(--primary-color, #475569) 18%, white)";
export const PBG = "color-mix(in srgb, var(--primary-color, #475569) 5%, white)";

// ─── CSS properties ───────────────────────────────────────────────────────────

export const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" };
export const inp: React.CSSProperties = { width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.55rem", borderRadius: 6, border: "1.5px solid #e2e8f0", outline: "none", boxSizing: "border-box" };
export const th: React.CSSProperties = { textAlign: "left", padding: "0.3rem 0.5rem 0.3rem 0", fontWeight: 600, color: "#94a3b8", fontSize: "0.65rem", textTransform: "uppercase" };
export const td: React.CSSProperties = { padding: "0.4rem 0.5rem 0.4rem 0", color: "#1e293b", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
export const EMPTY_CONTACTO_FORM = { nombre: "", apellido: "", cargo: "", telefono: "", movil: "", email: "", antiguedad: "", desde: "", anios_experiencia: "", poder_decision: "", estrategia: "", horarios: "" };

// ─── Quincenas ────────────────────────────────────────────────────────────────

export const MAPEO_PERIODO_DECISION: Record<string, string> = {
  '1q-sept': 'Finales de Agosto (Pre-campaña)',
  '2q-sept': '1ª Quincena de Septiembre',
  '1q-oct': '2ª Quincena de Septiembre 🚀',
  '2q-oct': '1ª Quincena de Octubre 🚀',
  '1q-nov': '2ª Quincena de Octubre',
  '2q-nov': '1ª Quincena de Noviembre',
  '1q-dic': '2ª Quincena de Noviembre',
  '2q-dic': '1ª Quincena de Diciembre',
};

export const calcularMesVisitaRecomendado = (periodoDecision: string): string => {
  if (!periodoDecision) return "";
  return MAPEO_PERIODO_DECISION[periodoDecision] || "";
};

// ─── Tabla ────────────────────────────────────────────────────────────────────

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
