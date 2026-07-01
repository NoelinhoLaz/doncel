"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  BarChart2,
  Map as MapIcon,
  FileText,
  TrendingUp,
  TrendingDown,
  Download,
  Building2,
  Calendar,
  Euro,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import styles from "./page.module.css";
import type { ServicioProveedor } from "@/actions/proveedor";

const HeatmapChart = dynamic(() => import("./HeatmapChart"), { ssr: false });

interface Props {
  nombre: string;
  cifNif: string;
  servicios: ServicioProveedor[];
}

type Tab = "demanda" | "servicios" | "rendimiento";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatEur(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatMes(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("es-ES", {
    month: "short",
    year: "2-digit",
  });
}

// ── Badges ────────────────────────────────────────────────────────────────────

function BadgeEstado({ estado }: { estado: string | null }) {
  if (!estado) return <span className={`${styles.badge} ${styles.badgeOtro}`}>—</span>;
  const lower = estado.toLowerCase();
  if (lower === "confirmado")
    return (
      <span className={`${styles.badge} ${styles.badgePagado}`}>
        <CheckCircle2 size={10} /> Pagado
      </span>
    );
  if (lower === "parcial")
    return (
      <span className={`${styles.badge} ${styles.badgeParcial}`}>
        <Clock size={10} /> Parcial
      </span>
    );
  if (lower === "pendiente")
    return (
      <span className={`${styles.badge} ${styles.badgePendiente}`}>
        <AlertCircle size={10} /> Pendiente
      </span>
    );
  if (lower === "anulado")
    return (
      <span className={`${styles.badge} ${styles.badgeOtro}`}>
        <XCircle size={10} /> Anulado
      </span>
    );
  if (lower === "opcional")
    return (
      <span className={`${styles.badge} ${styles.badgeOpcional}`}>
        <AlertCircle size={10} /> Opcional
      </span>
    );
  return <span className={`${styles.badge} ${styles.badgeOtro}`}>{estado}</span>;
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV(servicios: ServicioProveedor[]) {
  const headers = [
    "Agencia",
    "Fecha",
    "Concepto",
    "Expediente",
    "Fecha inicio",
    "Fecha fin",
    "Importe",
    "Estado",
  ];
  const rows = servicios.map((s) => [
    s.agencia_nombre,
    s.fecha ?? "",
    s.concepto ?? "",
    s.expediente_referencia ?? "",
    s.fecha_inicio ?? "",
    s.fecha_fin ?? "",
    s.importe.toFixed(2),
    s.estado ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `servicios_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  accent?: boolean;
}) {
  return (
    <div className={`${styles.kpiCard} ${accent ? styles.kpiCardAccent : ""}`}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={`${styles.kpiIcon} ${accent ? styles.kpiIconAccent : ""}`}>
          <Icon size={15} />
        </span>
      </div>
      <div className={styles.kpiValue}>{value}</div>
      {sub && (
        <div className={styles.kpiSub}>
          {trend === "up" && <TrendingUp size={11} className={styles.trendUp} />}
          {trend === "down" && <TrendingDown size={11} className={styles.trendDown} />}
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Tab: Mis Servicios ────────────────────────────────────────────────────────

function TabServicios({ servicios }: { servicios: ServicioProveedor[] }) {
  const [filtroAgencia, setFiltroAgencia] = useState("");
  const [filtroBuscar, setFiltroBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const agenciasUnicas = useMemo(
    () => [...new Set(servicios.map((s) => s.agencia_nombre))].sort(),
    [servicios]
  );

  const filtrados = useMemo(() => {
    const buscar = filtroBuscar.toLowerCase();
    return servicios.filter((s) => {
      if (filtroAgencia && s.agencia_nombre !== filtroAgencia) return false;
      if (filtroEstado && (s.estado ?? "").toLowerCase() !== filtroEstado) return false;
      if (
        buscar &&
        !s.concepto?.toLowerCase().includes(buscar) &&
        !s.expediente_referencia?.toLowerCase().includes(buscar) &&
        !s.expediente_numero?.toLowerCase().includes(buscar)
      )
        return false;
      return true;
    });
  }, [servicios, filtroAgencia, filtroBuscar, filtroEstado]);

  const totalImporte     = filtrados.reduce((s, x) => s + x.importe, 0);
  const totalPagado      = filtrados.reduce((s, x) => s + x.importe_pagado, 0);
  const pendientes       = filtrados.filter((s) => s.estado === "pendiente").length;
  const parciales        = filtrados.filter((s) => s.estado === "parcial").length;
  const tasaConfirmacion =
    filtrados.length > 0
      ? Math.round(
          (filtrados.filter((s) => s.estado === "confirmado").length / filtrados.length) * 100
        )
      : 0;

  return (
    <div>
      {/* KPIs */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="Volumen total"
          value={formatEur(totalImporte)}
          icon={Euro}
          sub={`${filtrados.length} servicios`}
        />
        <KpiCard
          label="Cobrado"
          value={formatEur(totalPagado)}
          icon={CheckCircle2}
          sub={`${tasaConfirmacion}% pagado íntegro`}
          trend={tasaConfirmacion >= 70 ? "up" : "down"}
          accent
        />
        <KpiCard
          label="Pendiente"
          value={String(pendientes)}
          icon={Clock}
          sub={parciales > 0 ? `+ ${parciales} parciales` : "Sin pagos"}
        />
        <KpiCard
          label="Agencias"
          value={String(agenciasUnicas.length)}
          icon={Building2}
          sub="En tu red"
        />
      </div>

      {/* Tabla */}
      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>Historial de servicios</h2>
          <button
            className={styles.exportBtn}
            onClick={() => exportCSV(filtrados)}
            title="Exportar CSV"
          >
            <Download size={13} />
            Exportar
          </button>
        </div>

        <div className={styles.filterRow}>
          <input
            className={styles.filterInput}
            placeholder="Buscar concepto o referencia..."
            value={filtroBuscar}
            onChange={(e) => setFiltroBuscar(e.target.value)}
          />
          {agenciasUnicas.length > 1 && (
            <select
              className={styles.filterInput}
              value={filtroAgencia}
              onChange={(e) => setFiltroAgencia(e.target.value)}
            >
              <option value="">Todas las agencias</option>
              {agenciasUnicas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          <select
            className={styles.filterInput}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="confirmado">Pagado</option>
            <option value="parcial">Parcial</option>
            <option value="pendiente">Pendiente</option>
            <option value="opcional">Opcional</option>
            <option value="anulado">Anulado</option>
          </select>
        </div>

        {filtrados.length === 0 ? (
          <div className={styles.empty}>No hay servicios para los filtros seleccionados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Agencia</th>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Expediente</th>
                  <th>Viaje</th>
                  <th>Importe</th>
                  <th>Pagado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((s) => (
                  <tr key={`${s.agencia_id}-${s.id}`}>
                    <td>
                      <span className={styles.agenciaChip}>{s.agencia_nombre}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                      {formatDate(s.fecha)}
                    </td>
                    <td style={{ maxWidth: 200 }}>{s.concepto || "—"}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                        {s.expediente_referencia || "—"}
                      </div>
                      {s.expediente_numero && (
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          #{s.expediente_numero}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                      <div>{formatDate(s.fecha_inicio)}</div>
                      {s.fecha_fin && s.fecha_fin !== s.fecha_inicio && (
                        <div style={{ color: "#94a3b8" }}>→ {formatDate(s.fecha_fin)}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatEur(s.importe)}</td>
                    <td>
                      {s.importe_pagado > 0 ? (
                        <span style={{ fontWeight: 600, color: s.estado === "confirmado" ? "#16a34a" : "#d97706" }}>
                          {formatEur(s.importe_pagado)}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>—</span>
                      )}
                    </td>
                    <td>
                      <BadgeEstado estado={s.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtrados.length > 0 && (
          <div className={styles.tableFooter}>
            <span>{filtrados.length} registros</span>
            <span style={{ fontWeight: 700 }}>{formatEur(totalImporte)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Rendimiento ──────────────────────────────────────────────────────────

function TabRendimiento({ servicios }: { servicios: ServicioProveedor[] }) {
  // Volumen por agencia
  const porAgencia = useMemo(() => {
    const map = new Map<string, { nombre: string; total: number; count: number }>();
    for (const s of servicios) {
      const ex = map.get(s.agencia_id) ?? { nombre: s.agencia_nombre, total: 0, count: 0 };
      ex.total += s.importe;
      ex.count += 1;
      map.set(s.agencia_id, ex);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [servicios]);

  // Evolución mensual
  const evolucionMensual = useMemo(() => {
    const map = new Map<string, { mes: string; importe: number; count: number }>();
    for (const s of servicios) {
      if (!s.fecha_inicio) continue;
      const key = s.fecha_inicio.slice(0, 7); // "2025-03"
      const ex = map.get(key) ?? { mes: key, importe: 0, count: 0 };
      ex.importe += s.importe;
      ex.count += 1;
      map.set(key, ex);
    }
    return [...map.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12)
      .map((v) => ({ ...v, mesLabel: formatMes(v.mes + "-01") }));
  }, [servicios]);

  // Tasa de confirmación global
  const totalServicios = servicios.length;
  const confirmados = servicios.filter((s) => s.estado === "confirmado").length;
  const tasaConfirmacion = totalServicios > 0 ? Math.round((confirmados / totalServicios) * 100) : 0;
  const volumenTotal = servicios.reduce((s, x) => s + x.importe, 0);
  const ticketMedio =
    totalServicios > 0 ? volumenTotal / totalServicios : 0;

  const maxAgencia = porAgencia[0]?.total ?? 1;

  return (
    <div>
      {/* KPIs de rendimiento */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="Volumen total"
          value={formatEur(volumenTotal)}
          icon={Euro}
          sub={`${totalServicios} servicios en total`}
          accent
        />
        <KpiCard
          label="Ticket medio"
          value={formatEur(ticketMedio)}
          icon={TrendingUp}
          sub="Por servicio"
        />
        <KpiCard
          label="Tasa confirmación"
          value={`${tasaConfirmacion}%`}
          icon={CheckCircle2}
          sub={`${confirmados} de ${totalServicios}`}
          trend={tasaConfirmacion >= 70 ? "up" : "down"}
        />
        <KpiCard
          label="Red de agencias"
          value={String(porAgencia.length)}
          icon={Building2}
          sub="Agencias activas"
        />
      </div>

      <div className={styles.rendimientoGrid}>
        {/* Ranking agencias */}
        <div className={styles.rendCard}>
          <h3 className={styles.rendTitle}>
            <Building2 size={14} /> Volumen por agencia
          </h3>
          {porAgencia.length === 0 ? (
            <p className={styles.empty} style={{ padding: "1.5rem" }}>Sin datos</p>
          ) : (
            <ol className={styles.agenciaRankList}>
              {porAgencia.map((a, i) => (
                <li key={a.nombre} className={styles.agenciaRankItem}>
                  <div className={styles.agenciaRankTop}>
                    <span className={styles.agenciaRankNum}>{i + 1}</span>
                    <span className={styles.agenciaRankNombre}>{a.nombre}</span>
                    <span className={styles.agenciaRankImporte}>{formatEur(a.total)}</span>
                  </div>
                  <div className={styles.agenciaRankBar}>
                    <div
                      className={styles.agenciaRankFill}
                      style={{ width: `${Math.round((a.total / maxAgencia) * 100)}%` }}
                    />
                  </div>
                  <div className={styles.agenciaRankSub}>{a.count} servicios</div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Evolución mensual */}
        <div className={styles.rendCard}>
          <h3 className={styles.rendTitle}>
            <Calendar size={14} /> Evolución mensual (últimos 12 meses)
          </h3>
          {evolucionMensual.length === 0 ? (
            <p className={styles.empty} style={{ padding: "1.5rem" }}>Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={evolucionMensual} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="mesLabel"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => [formatEur(v), "Importe"]}
                  contentStyle={{
                    fontSize: "0.78rem",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Bar dataKey="importe" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Servicios por estado */}
        <div className={styles.rendCard} style={{ gridColumn: "1 / -1" }}>
          <h3 className={styles.rendTitle}>
            <BarChart2 size={14} /> Distribución por estado
          </h3>
          <div className={styles.estadoDistRow}>
            {(["confirmado", "parcial", "pendiente", "opcional", "anulado"] as const).map((est) => {
              const count = servicios.filter((s) => (s.estado ?? "").toLowerCase() === est).length;
              const pct = totalServicios > 0 ? Math.round((count / totalServicios) * 100) : 0;
              const vol = servicios
                .filter((s) => (s.estado ?? "").toLowerCase() === est)
                .reduce((s, x) => s + x.importe, 0);
              return (
                <div key={est} className={styles.estadoCard}>
                  <BadgeEstado estado={est} />
                  <div className={styles.estadoCount}>{count}</div>
                  <div className={styles.estadoPct}>{pct}% · {formatEur(vol)}</div>
                  <div className={styles.estadoBar}>
                    <div
                      className={styles.estadoFill}
                      data-est={est}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function ProveedorDashboardClient({ nombre, cifNif, servicios }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("demanda");

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "demanda",     label: "Mapa de demanda", icon: MapIcon    },
    { id: "servicios",   label: "Mis servicios",   icon: FileText   },
    { id: "rendimiento", label: "Rendimiento",      icon: BarChart2  },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerLogo}>P</div>
          <div>
            <h1 className={styles.headerTitle}>{nombre}</h1>
            <p className={styles.headerMeta}>Portal Proveedor · {cifNif}</p>
          </div>
        </div>
        <form method="post" action="/api/proveedor/logout">
          <button type="submit" className={styles.logoutBtn}>Salir</button>
        </form>
      </header>

      {/* Tabs */}
      <nav className={styles.tabNav}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === "demanda" && <HeatmapChart />}
        {activeTab === "servicios" && <TabServicios servicios={servicios} />}
        {activeTab === "rendimiento" && <TabRendimiento servicios={servicios} />}
      </div>
    </div>
  );
}
