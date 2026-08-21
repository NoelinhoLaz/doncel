"use client";

export default function ValoracionBadge({ valor }: { valor: number | null | undefined }) {
  if (valor === null || valor === undefined) return <span style={{ color: "#cbd5e1", fontSize: "0.8rem" }}>—</span>;
  const pct = Math.round(valor * 100);
  const color = valor >= 0.7 ? "#16a34a" : valor >= 0.4 ? "#a16207" : "#dc2626";
  const bg = valor >= 0.7 ? "#dcfce7" : valor >= 0.4 ? "#fef9c3" : "#fee2e2";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "0.15rem 0.55rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 600, background: bg, color }}>
      {pct}%
    </span>
  );
}
