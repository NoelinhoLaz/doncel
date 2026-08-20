"use client";

import { useState, useEffect, cloneElement } from "react";
import { Icons } from "@/lib/icons";
import styles from "../page.module.css";
import { getResumenSatisfaccion } from "@/actions/valoraciones";

function SatisfaccionCard({ expedienteId }: { expedienteId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getResumenSatisfaccion(expedienteId).then((d) => { setData(d); setLoading(false); });
  }, [expedienteId]);

  if (loading) return (
    <div className={styles.detailsCard}>
      <h3 className={styles.detailsTitle}>Satisfacción del cliente</h3>
      <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Cargando...</div>
    </div>
  );

  if (!data || !data.encuestas?.length) return (
    <div className={styles.detailsCard}>
      <h3 className={styles.detailsTitle}>Satisfacción del cliente</h3>
      <div style={{ color: "#cbd5e1", fontSize: "0.8rem", fontStyle: "italic" }}>No se ha enviado ninguna encuesta aún.</div>
    </div>
  );

  const completadas = data.encuestas.filter((e: any) => e.completado_at).length;
  const total = data.encuestas.length;
  const stars = data.promedioGlobal != null ? Math.round(data.promedioGlobal) : 0;

  return (
    <div className={styles.detailsCard}>
      <h3 className={styles.detailsTitle}>Satisfacción del cliente</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.promedioGlobal != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#f59e0b", fontSize: "1.3rem", letterSpacing: 2 }}>
              {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
            </span>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>{data.promedioGlobal.toFixed(1)}</span>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>({data.totalValoraciones} valoracione{data.totalValoraciones !== 1 ? "s" : ""})</span>
          </div>
        )}
        {data.promedioGlobal == null && (
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Encuesta enviada pero aún sin respuestas.</div>
        )}
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Encuestas</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>{total} enviada{total !== 1 ? "s" : ""}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Completadas</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: completadas > 0 ? "#15803d" : "#334155" }}>{completadas} / {total}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DesgloseItem {
  label: string;
  importe: number;
}

interface ResumenKpis {
  viajerosCount: number;
  cobrosRecibidos: number;
  facturacionEmitida: number;
  saldoPendiente: number;
  totalCobrosEstimados: number;
  desgloseCobrosEstimados: DesgloseItem[];
  totalReembolsos: number;
}

interface ResumenPagos {
  serviciosCount: number;
  pagosRealizados: number;
  pendientePago: number;
  facturasSoportadas: number;
  totalPagosEstimados: number;
  desglosePagosEstimados: DesgloseItem[];
  totalReembolsos: number;
}

export default function ResumenTab({ expediente, resumenKpis, resumenPagos }: { expediente: any; resumenKpis?: ResumenKpis | null; resumenPagos?: ResumenPagos | null }) {
  if (!expediente) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
        Cargando...
      </div>
    );
  }

  const agenteNombre = expediente.agente?.nombre || null;

  const formatEuroKpi = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const kpiDataCobros = [
    {
      label: "Total Cobros",
      value: resumenKpis ? formatEuroKpi(resumenKpis.totalCobrosEstimados) : null,
      icon: <Icons.Cobros size={20} style={{ color: "#7c3aed" }} />,
      bg: "#ede9fe",
      desglose: resumenKpis
        ? [...resumenKpis.desgloseCobrosEstimados, { label: "Reembolsos", importe: resumenKpis.totalReembolsos }]
        : undefined,
    },
    {
      label: "Viajeros Totales",
      value: resumenKpis ? resumenKpis.viajerosCount : null,
      icon: <Icons.Viajeros size={20} style={{ color: "var(--primary-color, #475569)" }} />,
      bg: "color-mix(in srgb, var(--primary-color, #475569), transparent 90%)",
    },
    {
      label: "Cobros Recibidos",
      value: resumenKpis ? formatEuroKpi(resumenKpis.cobrosRecibidos) : null,
      icon: <Icons.Cobros size={20} style={{ color: "#16a34a" }} />,
      bg: "#dcfce7",
    },
    {
      label: "Pendiente",
      value: resumenKpis ? formatEuroKpi(resumenKpis.saldoPendiente) : null,
      icon: <Icons.Cobros size={20} style={{ color: "#d97706" }} />,
      bg: "#fef3c7",
    },
    {
      label: "Facturas Emitidas",
      value: resumenKpis ? formatEuroKpi(resumenKpis.facturacionEmitida) : null,
      icon: <Icons.Facturacion size={20} style={{ color: "#2563eb" }} />,
      bg: "#dbeafe",
    },
  ];

  const kpiDataPagos = [
    {
      label: "Total Pagos",
      value: resumenPagos ? formatEuroKpi(resumenPagos.totalPagosEstimados) : null,
      icon: <Icons.Cobros size={20} style={{ color: "#7c3aed" }} />,
      bg: "#ede9fe",
      desglose: resumenPagos
        ? [...resumenPagos.desglosePagosEstimados, { label: "Reembolsos", importe: resumenPagos.totalReembolsos }]
        : undefined,
    },
    {
      label: "Servicios",
      value: resumenPagos ? resumenPagos.serviciosCount : null,
      icon: <Icons.Servicios size={20} style={{ color: "var(--primary-color, #475569)" }} />,
      bg: "color-mix(in srgb, var(--primary-color, #475569), transparent 90%)",
    },
    {
      label: "Pagos",
      value: resumenPagos ? formatEuroKpi(resumenPagos.pagosRealizados) : null,
      icon: <Icons.Cobros size={20} style={{ color: "#16a34a" }} />,
      bg: "#dcfce7",
    },
    {
      label: "Pendiente",
      value: resumenPagos ? formatEuroKpi(resumenPagos.pendientePago) : null,
      icon: <Icons.Cobros size={20} style={{ color: "#d97706" }} />,
      bg: "#fef3c7",
    },
    {
      label: "Facturas Soportadas",
      value: resumenPagos ? formatEuroKpi(resumenPagos.facturasSoportadas) : null,
      icon: <Icons.Facturacion size={20} style={{ color: "#2563eb" }} />,
      bg: "#dbeafe",
    },
  ];

  // Beneficio estimado por concepto: cada fila del desglose de Cobros
  // Estimados (PVP Base + cada extra) menos su equivalente en el desglose
  // de Pagos Estimados (Neto Base + el mismo extra por descripción).
  const beneficioTotal = resumenKpis && resumenPagos
    ? resumenKpis.totalCobrosEstimados - resumenPagos.totalPagosEstimados
    : null;
  // % de beneficio = margen sobre ingresos (beneficio / cobros), sin acotar:
  // una pérdida puede superar el -100% cuando el gasto excede varias veces
  // el ingreso. Si no hay ingreso pero sí gasto, es pérdida total (-100%);
  // si no hay ni ingreso ni gasto, no hay nada que reportar (0%).
  const margenPct = (diff: number, ingreso: number, gasto: number) => {
    if (ingreso === 0) return gasto !== 0 ? -100 : 0;
    return Math.round((diff / ingreso) * 100);
  };

  const beneficioPct = resumenKpis && resumenPagos && beneficioTotal !== null
    ? margenPct(beneficioTotal, resumenKpis.totalCobrosEstimados, resumenPagos.totalPagosEstimados)
    : 0;

  const beneficioFilas = resumenKpis && resumenPagos
    ? resumenKpis.desgloseCobrosEstimados.map((cobroItem, i) => {
        const pagoItem = i === 0
          ? resumenPagos.desglosePagosEstimados[0]
          : resumenPagos.desglosePagosEstimados.find(p => p.label === cobroItem.label);
        const pagoImporte = pagoItem?.importe ?? 0;
        const diff = cobroItem.importe - pagoImporte;
        const pct = margenPct(diff, cobroItem.importe, pagoImporte);
        return {
          label: i === 0 ? "PVP Base" : cobroItem.label,
          diff,
          pct,
        };
      })
    : [];

  const formatDate = (d: string | null | undefined) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  const infoFields = [
    { label: "Nombre del Grupo", value: expediente.referencia || null },
    {
      label: "Destino",
      value: expediente.maestro_destinos?.nombre || null,
    },
    { label: "Agente Responsable", value: agenteNombre },
    {
      label: "Fechas de Viaje",
      value:
        expediente.fecha_inicio || expediente.fecha_fin
          ? `${formatDate(expediente.fecha_inicio) || "?"} - ${formatDate(expediente.fecha_fin) || "?"}`
          : null,
    },
    {
      label: "Contacto",
      value: expediente.contabilidad_entidades?.nombre || null,
    },
    {
      label: "Oficina",
      value: expediente.config_oficinas?.nombre || null,
    },
    {
      label: "Estado General",
      value: expediente.estado
        ? expediente.estado.toUpperCase()
        : null,
      isStatus: true,
      statusActive: expediente.estado === "abierto",
    },
    {
      label: "Última Actualización",
      value: expediente.updated_at
        ? `${formatDate(expediente.updated_at)}`
        : null,
    },
  ];

  return (
    <>
      <div
        style={{
          background: "#ffffff",
          borderRadius: "0.75rem",
          border: "1px solid #f1f5f9",
          overflow: "hidden",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          marginBottom: "1rem",
        }}
      >
        <div className={styles.listHeaderTop}>
          <div className={styles.listTitleWrapper}>
            <Icons.Resumen size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Resumen del Expediente</h2>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", padding: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {beneficioTotal !== null && (
            <div className={styles.kpiCard} style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
              <Icons.Cobros size={72} className={styles.kpiIconBg} style={{ color: beneficioTotal >= 0 ? "#16a34a" : "#dc2626" }} />
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Total Beneficios</span>
                <span className={styles.kpiValue} style={{ color: beneficioTotal >= 0 ? "#16a34a" : "#dc2626" }}>
                  {formatEuroKpi(beneficioTotal)} ({beneficioTotal >= 0 ? "+" : "-"}{Math.abs(beneficioPct)}%)
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingTop: "0.5rem", borderTop: "1px solid #f1f5f9" }}>
                {beneficioFilas.map((f, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                    <span
                      title={f.label}
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                    >
                      {f.label}
                    </span>
                    <span style={{ fontWeight: 600, color: f.diff > 0 ? "#16a34a" : f.diff < 0 ? "#dc2626" : "#334155", flexShrink: 0 }}>
                      {f.diff === 0 ? formatEuroKpi(0) : `${f.diff > 0 ? "+" : "-"}${formatEuroKpi(Math.abs(f.diff))} (${f.diff > 0 ? "+" : "-"}${Math.abs(f.pct)}%)`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {kpiDataCobros.map((kpiCobro: any, idx) => {
            const kpiPago = kpiDataPagos[idx];
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {[kpiCobro, kpiPago].map((kpi: any, col: number) => (
                  <div key={col} className={styles.kpiCard} style={kpi.desglose?.length ? { flexDirection: "column", alignItems: "stretch", gap: "0.5rem" } : undefined}>
                    {kpi.icon && cloneElement(kpi.icon, { size: 72, className: styles.kpiIconBg })}
                    <div className={styles.kpiContent}>
                      <span className={styles.kpiLabel}>{kpi.label}</span>
                      <span className={styles.kpiValue}>
                        {kpi.value !== null && kpi.value !== undefined ? kpi.value : "—"}
                      </span>
                    </div>
                    {kpi.desglose && kpi.desglose.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingTop: "0.5rem", borderTop: "1px solid #f1f5f9" }}>
                        {kpi.desglose.map((d: DesgloseItem, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                            <span
                              title={d.label}
                              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                            >
                              {d.label}
                            </span>
                            <span style={{ fontWeight: 600, color: "#334155", flexShrink: 0 }}>{formatEuroKpi(d.importe)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className={styles.detailsCard}>
            <h3 className={styles.detailsTitle}>Información General</h3>
            <div className={styles.infoGrid}>
              {infoFields.map((field, idx) => (
                <div key={idx} className={styles.infoItem}>
                  <span className={styles.infoLabel}>{field.label}</span>
                  {field.value !== null && field.value !== undefined ? (
                    field.isStatus ? (
                      <span className={styles.infoValue}>
                        <span className={styles.statusIndicator}>
                          <span
                            className={`${styles.statusDot} ${field.statusActive ? styles.active : ""}`}
                          />
                          {field.value}
                        </span>
                      </span>
                    ) : (
                      <span className={styles.infoValue}>{field.value}</span>
                    )
                  ) : (
                    <span className={styles.infoValue} style={{ color: "#cbd5e1", fontStyle: "italic" }}>—</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <SatisfaccionCard expedienteId={expediente.id} />

          <div className={styles.detailsCard}>
            <h3 className={styles.detailsTitle}>Notas y Avisos</h3>
            <ul
              style={{
                paddingLeft: "1.2rem",
                margin: 0,
                fontSize: "0.8rem",
                color: "#64748b",
                lineHeight: "1.5",
              }}
            >
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "#334155" }}>Autorizaciones:</strong>{" "}
                Faltan 2 autorizaciones firmadas de los tutores de los menores.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "#334155" }}>Alojamiento:</strong>{" "}
                Hotel Salou Park asignado correctamente. Habitaciones dobles y
                triples.
              </li>
              <li>
                <strong style={{ color: "#334155" }}>Cobros:</strong> Segundo
                plazo vence el 30/05/2026.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
