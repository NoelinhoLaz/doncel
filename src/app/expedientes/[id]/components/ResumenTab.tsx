"use client";

import { useState, useEffect } from "react";
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

export default function ResumenTab({ expediente }: { expediente: any }) {
  if (!expediente) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
        Cargando...
      </div>
    );
  }

  const agenteNombre = expediente.agente?.nombre || null;

  const kpiData = [
    {
      label: "Viajeros Totales",
      value: expediente.viajeros_count ?? null,
      icon: <Icons.Viajeros size={20} style={{ color: "var(--primary-color, #475569)" }} />,
      bg: "color-mix(in srgb, var(--primary-color, #475569), transparent 90%)",
    },
    {
      label: "Cobros Recibidos",
      value: expediente.cobros_recibidos ?? null,
      icon: <Icons.Cobros size={20} style={{ color: "#16a34a" }} />,
      bg: "#dcfce7",
    },
    {
      label: "Facturación Emitida",
      value: expediente.facturacion_emitida ?? null,
      icon: <Icons.Facturacion size={20} style={{ color: "#2563eb" }} />,
      bg: "#dbeafe",
    },
    {
      label: "Saldo Pendiente",
      value: expediente.saldo_pendiente ?? null,
      icon: <Icons.Cobros size={20} style={{ color: "#d97706" }} />,
      bg: "#fef3c7",
    },
  ];

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

      <div className={styles.dashboardGrid}>
        {kpiData.map((kpi, idx) => (
          <div key={idx} className={styles.kpiCard}>
            <div className={styles.kpiContent}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <span className={styles.kpiValue}>
                {kpi.value !== null && kpi.value !== undefined
                  ? kpi.value
                  : "—"}
              </span>
            </div>
            <div className={styles.kpiIconWrapper} style={{ backgroundColor: kpi.bg }}>
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.detailsSection}>
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
    </>
  );
}
