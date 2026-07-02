"use client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Error de red");
  return json;
}

export function initials(nombre: string, apellidos?: string | null) {
  return ((nombre[0] ?? "") + ((apellidos ?? "")[0] ?? "")).toUpperCase() || "??";
}

export function formatFecha(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function capitalizarCiudad(c: string): string {
  return c.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export function formatNotasTooltip(notas: string | null | undefined): string {
  if (!notas) return "";
  try {
    const d = JSON.parse(notas);
    if (typeof d !== "object" || d === null) return notas;
    const lines: string[] = [];
    if (d.motivo) lines.push(`Motivo: ${d.motivo}`);
    // competidor puede estar en raíz o dentro de auditoria
    const competidor = d.competidor || d.auditoria?.competidor;
    if (competidor) lines.push(`Agencia: ${competidor}`);
    if (d.periodoDecision) lines.push(`Decisión: ${d.periodoDecision}`);
    if (d.interesFuturo) lines.push(`Interés: ${d.interesFuturo}`);
    if (d.visitaSugerida) lines.push(`Visita: ${d.visitaSugerida}`);
    if (d.observaciones) lines.push(`Obs: ${d.observaciones}`);
    if (d.estrategiaCampana) lines.push(`Estrategia: ${d.estrategiaCampana}`);
    // nunca mostrar el JSON crudo como fallback
    return lines.join("\n");
  } catch {
    // Si no es JSON válido, mostrar como texto plano
    return notas;
  }
}
