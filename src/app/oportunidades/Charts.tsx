"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const FUNNEL_DATA = [
  { fase: "Denegado",     euros: 182000, count:  7, color: "#374151" },
  { fase: "Aceptado",     euros: 260000, count: 10, color: "#db2777" },
  { fase: "Revisión",     euros: 182000, count:  7, color: "#eab308" },
  { fase: "Cotizado",     euros: 364000, count: 14, color: "#0ea5c8" },
  { fase: "Pdt. Cotizar", euros: 234000, count:  9, color: "#0ea5c8" },
  { fase: "Visitando",    euros: 234000, count:  9, color: "#e8650a" },
  { fase: "Pdt. Visitar", euros: 260000, count: 10, color: "#7c3aed" },
];

const AREA_DATA = [
  { fase: "Pdt. Visitar", euros: 260000, count: 10, color: "#7c3aed" },
  { fase: "Visitando",    euros: 234000, count:  9, color: "#e8650a" },
  { fase: "Pdt. Cotizar", euros: 234000, count:  9, color: "#0ea5c8" },
  { fase: "Cotizado",     euros: 364000, count: 14, color: "#0ea5c8" },
  { fase: "Revisión",     euros: 182000, count:  7, color: "#eab308" },
  { fase: "Aceptado",     euros: 260000, count: 10, color: "#db2777" },
];

function EurosTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: "8px 12px", border: "none" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#38bdf8" }}>{Number(payload[0].value).toLocaleString("es-ES")} €</div>
      {payload[1] && <div style={{ fontSize: 12, color: "#a78bfa" }}>{payload[1].value} contactos</div>}
    </div>
  );
}

const POTENCIAL_TOTAL = 520000;
const OBJETIVO_LOGRADO = 260000; // Aceptado
const META = 390000;

function BulletChart({ monocromo = false }: { monocromo?: boolean }) {
  const logradoPct  = (OBJETIVO_LOGRADO / POTENCIAL_TOTAL) * 100;
  const metaPct     = (META / POTENCIAL_TOTAL) * 100;
  const restante    = POTENCIAL_TOTAL - OBJETIVO_LOGRADO;

  return (
    <div style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", padding: "1rem 1.25rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b" }}>Objetivo vs. Potencial</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 1 }}>Objetivo logrado sobre el potencial total del pipeline</div>
        </div>
      </div>

      {/* Barra bullet */}
      <div style={{ position: "relative", height: 44, marginTop: "2.2rem" }}>
        {/* Fondo gris: potencial total */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 99, background: "#e2e8f0" }} />

        {/* Barra lograda */}
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, left: 0,
          width: `${logradoPct}%`,
          background: monocromo ? `linear-gradient(90deg, ${monoPrimaryColor(40)} 0%, ${monoPrimaryColor(80)} 100%)` : "linear-gradient(90deg, #f472b6 0%, #db2777 100%)",
          borderRadius: 99,
          transition: "width 0.6s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 10,
          overflow: "hidden",
        }}>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
            <span style={{ fontSize: "0.5rem", fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.06em" }}>OBJETIVO</span>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{OBJETIVO_LOGRADO.toLocaleString("es-ES")} €</span>
          </span>
        </div>

        {/* Línea de meta */}
        <div style={{
          position: "absolute",
          top: -5, bottom: -5,
          left: `${metaPct}%`,
          width: 2.5,
          background: "#1e293b",
          borderRadius: 2,
          zIndex: 10,
        }} />
        <div style={{
          position: "absolute",
          top: -34,
          left: `${metaPct}%`,
          transform: "translateX(-50%)",
          textAlign: "center",
          fontSize: "0.58rem",
          fontWeight: 700,
          color: "#1e293b",
          whiteSpace: "nowrap",
          letterSpacing: "0.04em",
          lineHeight: 1.4,
        }}>
          <div>META</div>
          <div>{META.toLocaleString("es-ES")} €</div>
        </div>

        {/* Etiqueta potencial al final */}
        <div style={{
          position: "absolute",
          top: -34,
          right: 0,
          textAlign: "right",
          fontSize: "0.58rem",
          fontWeight: 700,
          color: "#64748b",
          whiteSpace: "nowrap",
          letterSpacing: "0.04em",
          lineHeight: 1.4,
        }}>
          <div>POTENCIAL</div>
          <div>{POTENCIAL_TOTAL.toLocaleString("es-ES")} €</div>
        </div>
      </div>

      {/* Métricas debajo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Logrado</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: monocromo ? "var(--primary-color, #475569)" : "#db2777" }}>{Math.round(logradoPct)}%</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Restante</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#64748b" }}>{restante.toLocaleString("es-ES")} €</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>vs. Meta</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: OBJETIVO_LOGRADO >= META ? "#22c55e" : "#f59e0b" }}>
            {OBJETIVO_LOGRADO >= META ? "✓ Alcanzada" : `${Math.round((OBJETIVO_LOGRADO / META) * 100)}%`}
          </div>
        </div>
      </div>
    </div>
  );
}

// Porcentajes de opacidad del color principal para escala monocromo (de más oscuro a más claro)
const MONO_ALPHAS = [90, 75, 60, 45, 35, 25];

function monoPrimaryColor(alpha: number) {
  return `color-mix(in srgb, var(--primary-color, #475569) ${alpha}%, white)`;
}

export function PipelineCharts({ monocromo = false }: { monocromo?: boolean }) {
  const monoFunnel = FUNNEL_DATA.map((d, i) => ({ ...d, color: monocromo ? monoPrimaryColor(MONO_ALPHAS[i % MONO_ALPHAS.length]) : d.color }));
  const monoArea   = AREA_DATA.map((d, i)   => ({ ...d, color: monocromo ? monoPrimaryColor(MONO_ALPHAS[i % MONO_ALPHAS.length]) : d.color }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
      <BulletChart monocromo={monocromo} />
      {/* Área suavizada */}
      <div style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", padding: "1rem 1.25rem 0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b" }}>Flujo del Pipeline</div>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 1 }}>Volumen financiero por fase</div>
          </div>
          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: monocromo ? "var(--primary-color, #475569)" : "#6366f1", background: monocromo ? "color-mix(in srgb, var(--primary-color, #475569) 10%, white)" : "#eef2ff", padding: "3px 8px", borderRadius: 99 }}>
            {AREA_DATA.reduce((s, d) => s + d.euros, 0).toLocaleString("es-ES")} €
          </span>
        </div>
        <div style={{ height: 145 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monoArea} margin={{ top: 8, right: 11, left: 11, bottom: 20 }}>
              <defs>
                <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={monocromo ? "var(--primary-color, #475569)" : "#6366f1"} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={monocromo ? "var(--primary-color, #475569)" : "#6366f1"} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={monocromo ? "var(--primary-color, #475569)" : "#db2777"} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={monocromo ? "var(--primary-color, #475569)" : "#db2777"} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="fase"
                axisLine={false} tickLine={false}
                interval={0}
                padding={{ left: 0, right: 0 }}
                tick={({ x, y, payload }: any) => {
                  const MONO_BG_XAXIS = [
                    "color-mix(in srgb, var(--primary-color, #475569) 90%, white)",
                    "color-mix(in srgb, var(--primary-color, #475569) 74%, white)",
                    "color-mix(in srgb, var(--primary-color, #475569) 58%, white)",
                    "color-mix(in srgb, var(--primary-color, #475569) 44%, white)",
                    "color-mix(in srgb, var(--primary-color, #475569) 32%, white)",
                    "color-mix(in srgb, var(--primary-color, #475569) 22%, white)",
                  ];
                  const INICIALES: Record<string, { ini: string; bg: string }> = {
                    "Pdt. Visitar": { ini: "PV", bg: monocromo ? MONO_BG_XAXIS[0] : "#7c3aed" },
                    "Visitando":    { ini: "VI", bg: monocromo ? MONO_BG_XAXIS[1] : "#e8650a" },
                    "Pdt. Cotizar": { ini: "PC", bg: monocromo ? MONO_BG_XAXIS[2] : "#0ea5c8" },
                    "Cotizado":     { ini: "CO", bg: monocromo ? MONO_BG_XAXIS[3] : "#0ea5c8" },
                    "Revisión":     { ini: "RE", bg: monocromo ? MONO_BG_XAXIS[4] : "#eab308" },
                    "Aceptado":     { ini: "AC", bg: monocromo ? MONO_BG_XAXIS[5] : "#db2777" },
                  };
                  const { ini, bg } = INICIALES[payload.value] ?? { ini: "?", bg: "#94a3b8" };
                  const r = 11;
                  return (
                    <g transform={`translate(${x},${y + 6})`}>
                      <circle cx={0} cy={r} r={r} fill={bg} opacity={0.85} />
                      <text x={0} y={r} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700} fill="#fff">
                        {ini}
                      </text>
                    </g>
                  );
                }}
                height={32}
              />
              <YAxis hide width={0} />
              <Tooltip content={<EurosTooltip />} />
              <Area type="monotone" dataKey="euros"
                stroke={monocromo ? "var(--primary-color, #475569)" : "#6366f1"} strokeWidth={2}
                fill="url(#gradArea)" dot={false} />
              <Area type="monotone" dataKey="count"
                stroke={monocromo ? "var(--primary-color, #475569)" : "#db2777"} strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="url(#gradCount)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Embudo CSS pill */}
      <div style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", padding: "1rem 1.25rem 0.75rem", overflow: "hidden", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b" }}>Embudo de Conversión</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 1 }}>De potencial a acuerdo cerrado</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", width: "100%" }}>
          {monoFunnel.map((d, i) => {
            const maxEuros = Math.max(...monoFunnel.map(x => x.euros));
            const MIN_PCT = 30;
            const pct = MIN_PCT + Math.round(((d.euros / maxEuros) * (100 - MIN_PCT)));
            return (
              <div
                key={d.fase}
                title={`${d.fase}: ${d.euros.toLocaleString("es-ES")} € (${d.count})`}
                style={{
                  width: `${pct}%`,
                  height: 16,
                  borderRadius: 99,
                  background: d.color,
                  opacity: 0.82,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  transition: "opacity 0.15s",
                  cursor: "default",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.82")}
              >
                {d.fase} — {d.count}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
