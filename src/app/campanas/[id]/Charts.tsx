"use client";

import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

type Estado = { id: string; nombre: string; color: string; orden: number; es_final: boolean; es_ganado: boolean };
type Oportunidad = { id: string; estado_id: string; valor_estimado: number };

function monoPrimaryColor(alpha: number) {
  return `color-mix(in srgb, var(--primary-color, #475569) ${alpha}%, white)`;
}
const MONO_ALPHAS = [90, 75, 60, 45, 35, 25, 18, 12];

function EurosTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: "8px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#38bdf8" }}>{Number(payload[0]?.value ?? 0).toLocaleString("es-ES")} €</div>
      {payload[1] && <div style={{ fontSize: 12, color: "#a78bfa" }}>{payload[1].value} oport.</div>}
    </div>
  );
}

function BulletChart({ estados, oportunidades, objetivoTotal, monocromo }: {
  estados: Estado[];
  oportunidades: Oportunidad[];
  objetivoTotal: number;
  monocromo: boolean;
}) {
  const estadosGanado = estados.filter(e => e.es_ganado);
  const totalPotencial = oportunidades.reduce((s, o) => s + o.valor_estimado, 0);
  const ganado = oportunidades
    .filter(o => estadosGanado.some(e => e.id === o.estado_id))
    .reduce((s, o) => s + o.valor_estimado, 0);

  // Base = potencial (la barra de fondo siempre es el potencial)
  // La línea de meta = objetivo
  const base = totalPotencial > 0 ? totalPotencial : 1;
  const ganadoPct = Math.min((ganado / base) * 100, 100);
  const metaPct = objetivoTotal > 0 ? Math.min((objetivoTotal / base) * 100, 100) : null;
  const vsObjetivo = objetivoTotal > 0 ? Math.round((ganado / objetivoTotal) * 100) : null;

  return (
    <div style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", padding: "1rem 1.25rem 1rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b" }}>Objetivo vs. Potencial</div>
        <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 1 }}>Volumen ganado sobre el potencial total del pipeline</div>
      </div>

      <div style={{ position: "relative", height: 44, marginTop: "2.2rem" }}>
        {/* Fondo: potencial total */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 99, background: "#e2e8f0" }} />

        {/* Barra ganado */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: 0,
          width: `${ganadoPct}%`,
          background: monocromo
            ? `linear-gradient(90deg, ${monoPrimaryColor(40)}, ${monoPrimaryColor(80)})`
            : "linear-gradient(90deg, #f472b6, #db2777)",
          borderRadius: 99,
          transition: "width 0.6s ease",
          display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10, overflow: "hidden",
        }}>
          {ganadoPct > 12 && (
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
              <span style={{ fontSize: "0.5rem", fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.06em" }}>GANADO</span>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{ganado.toLocaleString("es-ES")} €</span>
            </span>
          )}
        </div>

        {/* Línea de meta (objetivo) */}
        {metaPct !== null && (
          <>
            <div style={{
              position: "absolute", top: -5, bottom: -5,
              left: `${metaPct}%`,
              width: 2.5, background: "#1e293b", borderRadius: 2, zIndex: 10,
            }} />
            <div style={{
              position: "absolute", top: -34, left: `${metaPct}%`,
              transform: "translateX(-50%)", textAlign: "center",
              fontSize: "0.58rem", fontWeight: 700, color: "#1e293b",
              whiteSpace: "nowrap", letterSpacing: "0.04em", lineHeight: 1.4,
            }}>
              <div>META</div>
              <div>{objetivoTotal.toLocaleString("es-ES")} €</div>
            </div>
          </>
        )}

        {/* Etiqueta potencial al final */}
        <div style={{
          position: "absolute", top: -34, right: 0, textAlign: "right",
          fontSize: "0.58rem", fontWeight: 700, color: "#64748b",
          whiteSpace: "nowrap", letterSpacing: "0.04em", lineHeight: 1.4,
        }}>
          <div>POTENCIAL</div>
          <div>{totalPotencial.toLocaleString("es-ES")} €</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ganado</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: monocromo ? "var(--primary-color, #475569)" : "#db2777" }}>
            {vsObjetivo === null ? "—" : `${vsObjetivo}%`}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Restante</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#64748b" }}>{(totalPotencial - ganado).toLocaleString("es-ES")} €</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>vs. Potencial</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: monocromo ? "var(--primary-color, #475569)" : "#f59e0b" }}>
            {Math.round(ganadoPct)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function EstadosFiltroBtn({ estados, visibles, onChange }: {
  estados: Estado[];
  visibles: Set<string>;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 5, right: window.innerWidth - r.right });
    }
    setOpen(v => !v);
  }

  const hayFiltro = visibles.size < estados.length;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 26, height: 26, border: "none", borderRadius: "0.4rem",
          background: hayFiltro ? "color-mix(in srgb, var(--primary-color, #475569) 12%, white)" : "transparent",
          color: hayFiltro ? "var(--primary-color, #475569)" : "#94a3b8",
          cursor: "pointer", transition: "all 0.12s",
        }}
        title="Filtrar estados"
      >
        <Settings size={13} />
      </button>
      {open && (
        <div ref={menuRef} style={{
          position: "fixed", top: pos.top, right: pos.right, zIndex: 9999,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.65rem",
          boxShadow: "0 8px 24px rgba(15,23,42,0.12)", padding: "0.4rem 0",
          minWidth: 170,
        }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", padding: "0 0.75rem 0.3rem" }}>
            Mostrar estados
          </div>
          {estados.map(e => (
            <label key={e.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.28rem 0.75rem", cursor: "pointer", fontSize: "0.78rem", color: "#475569" }}>
              <input
                type="checkbox"
                checked={visibles.has(e.id)}
                onChange={() => onChange(e.id)}
                style={{ accentColor: e.color, cursor: "pointer", flexShrink: 0 }}
              />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
              <span>{e.nombre}</span>
            </label>
          ))}
        </div>
      )}
    </>
  );
}

export function CampanaCharts({
  campanaId,
  estados,
  oportunidades,
  objetivoTotal = 0,
  monocromo = false,
}: {
  campanaId: string;
  estados: Estado[];
  oportunidades: Oportunidad[];
  objetivoTotal?: number;
  monocromo?: boolean;
}) {
  const estadosOrdenados = [...estados].sort((a, b) => a.orden - b.orden);

  function loadStored(key: string, allIds: string[]): Set<string> {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        const valid = saved.filter(id => allIds.includes(id));
        if (valid.length > 0) return new Set(valid);
      }
    } catch {}
    return new Set(allIds);
  }

  const allIds = estadosOrdenados.map(e => e.id);
  const keyFlujo = `chart_flujo_${campanaId}`;
  const keyEmbudo = `chart_embudo_${campanaId}`;

  const [visiblesFlujo, setVisiblesFlujo] = useState<Set<string>>(() => loadStored(keyFlujo, allIds));
  const [visiblesEmbudo, setVisiblesEmbudo] = useState<Set<string>>(() => loadStored(keyEmbudo, allIds));

  // When estados load for the first time (empty → populated), initialize from storage
  useEffect(() => {
    if (estados.length === 0) return;
    const ids = estados.map(e => e.id);
    setVisiblesFlujo(loadStored(keyFlujo, ids));
    setVisiblesEmbudo(loadStored(keyEmbudo, ids));
  }, [campanaId, estados.length]);

  function toggleFlujo(id: string) {
    setVisiblesFlujo(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      localStorage.setItem(keyFlujo, JSON.stringify([...s]));
      return s;
    });
  }
  function toggleEmbudo(id: string) {
    setVisiblesEmbudo(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      localStorage.setItem(keyEmbudo, JSON.stringify([...s]));
      return s;
    });
  }

  const allData = estadosOrdenados.map((e, i) => {
    const ops = oportunidades.filter(o => o.estado_id === e.id);
    return {
      id: e.id,
      fase: e.nombre,
      euros: ops.reduce((s, o) => s + o.valor_estimado, 0),
      count: ops.length,
      color: monocromo ? monoPrimaryColor(MONO_ALPHAS[i % MONO_ALPHAS.length]) : e.color,
    };
  });

  const areaData = allData.filter(d => visiblesFlujo.has(d.id));
  const funnelData = [...allData.filter(d => visiblesEmbudo.has(d.id))].reverse();
  const maxEuros = Math.max(...funnelData.map(d => d.euros), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
      <BulletChart estados={estados} oportunidades={oportunidades} objetivoTotal={objetivoTotal} monocromo={monocromo} />

      {/* Flujo del pipeline */}
      <div style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", padding: "1rem 1.25rem 0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b" }}>Flujo del Pipeline</div>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 1 }}>Volumen financiero por fase</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: monocromo ? "var(--primary-color, #475569)" : "#6366f1", background: monocromo ? "color-mix(in srgb, var(--primary-color, #475569) 10%, white)" : "#eef2ff", padding: "3px 8px", borderRadius: 99 }}>
              {areaData.reduce((s, d) => s + d.euros, 0).toLocaleString("es-ES")} €
            </span>
            <EstadosFiltroBtn estados={estadosOrdenados} visibles={visiblesFlujo} onChange={toggleFlujo} />
          </div>
        </div>
        <div style={{ height: 145 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData} margin={{ top: 8, right: 11, left: 11, bottom: 20 }}>
              <defs>
                <linearGradient id="gradCampArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={monocromo ? "var(--primary-color, #475569)" : "#6366f1"} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={monocromo ? "var(--primary-color, #475569)" : "#6366f1"} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradCampCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={monocromo ? "var(--primary-color, #475569)" : "#db2777"} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={monocromo ? "var(--primary-color, #475569)" : "#db2777"} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="fase"
                axisLine={false} tickLine={false}
                interval={0}
                tick={({ x, y, payload, index }: any) => {
                  const d = areaData[index];
                  const bg = d ? d.color : "#94a3b8";
                  const ini = (payload.value as string).slice(0, 2).toUpperCase();
                  return (
                    <g transform={`translate(${x},${y + 6})`}>
                      <circle cx={0} cy={11} r={11} fill={bg} opacity={0.85} />
                      <text x={0} y={11} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700} fill="#fff">{ini}</text>
                    </g>
                  );
                }}
                height={32}
              />
              <YAxis hide width={0} />
              <Tooltip content={<EurosTooltip />} />
              <Area type="monotone" dataKey="euros" stroke={monocromo ? "var(--primary-color, #475569)" : "#6366f1"} strokeWidth={2} fill="url(#gradCampArea)" dot={false} />
              <Area type="monotone" dataKey="count" stroke={monocromo ? "var(--primary-color, #475569)" : "#db2777"} strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gradCampCount)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Embudo */}
      <div style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", padding: "1rem 1.25rem 0.75rem", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b" }}>Embudo de Conversión</div>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 1 }}>De potencial a acuerdo cerrado</div>
          </div>
          <EstadosFiltroBtn estados={estadosOrdenados} visibles={visiblesEmbudo} onChange={toggleEmbudo} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", width: "100%" }}>
          {funnelData.map((d) => {
            const MIN_PCT = 30;
            const pct = MIN_PCT + Math.round((d.euros / maxEuros) * (100 - MIN_PCT));
            return (
              <div
                key={d.id}
                title={`${d.fase}: ${d.euros.toLocaleString("es-ES")} € (${d.count})`}
                style={{
                  width: `${pct}%`, height: 16, borderRadius: 99,
                  background: d.color, opacity: 0.82,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.62rem", fontWeight: 700, color: "#fff",
                  whiteSpace: "nowrap", overflow: "hidden",
                  transition: "opacity 0.15s", cursor: "default",
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
