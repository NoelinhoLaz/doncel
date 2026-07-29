"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getHistorialProcesosOfiviaje, forzarProcesoOfiviajeUsuarioActual } from "@/actions/banco";
import { getCurrentAgencyDetails } from "@/actions/agencias";

const parseFechaUtc = (valor: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(valor) ? valor : `${valor}Z`);

interface HistorialFila {
  ficheroId: string;
  nombreFichero: string;
  procesadoEn: string;
  procesados: number;
  pagos: number;
  cobros: number;
  conciliados: number;
  revision: number;
  origen: "manual" | "automatico";
}

export default function HistorialProcesosPage() {
  const router = useRouter();
  const [filas, setFilas] = useState<HistorialFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyDetails, setAgencyDetails] = useState<any>(null);
  const [procesando, setProcesando] = useState(false);

  const cargarHistorial = () => {
    setLoading(true);
    getHistorialProcesosOfiviaje()
      .then((data) => setFilas(data as HistorialFila[]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargarHistorial();
    getCurrentAgencyDetails().then(setAgencyDetails);
  }, []);

  const handleProcesarArchivos = async () => {
    setProcesando(true);
    try {
      const res = await forzarProcesoOfiviajeUsuarioActual();
      if (res.error) {
        alert(res.error);
      } else {
        cargarHistorial();
      }
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#1D2441" }}>
      <header
        style={{
          flexShrink: 0,
          background: "#1D2441",
          boxSizing: "border-box",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div
          style={{
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1.5rem",
          }}
        >
          <img
            src="/alivia_logo_no_text.png"
            alt="Alivia"
            style={{ height: "24px", maxWidth: "150px", objectFit: "contain" }}
          />
          <span
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: "0.85rem",
              fontWeight: 300,
              fontFamily: "var(--font-raleway), sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "180px",
            }}
          >
            {agencyDetails?.nombre_comercial || ""}
          </span>
        </div>
      </header>

      <div style={{ flex: 1, background: "#1D2441" }}>
        <div style={{ width: "100%", background: "#f8fafc", padding: "1.5rem" }}>
          <NextLink
            href="/movimientos-app"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#334155", fontSize: "0.85rem", textDecoration: "none", marginBottom: "1rem" }}
          >
            <ArrowLeft size={16} />
            Volver
          </NextLink>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>
                Historial de procesos
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Ficheros OFIviaje procesados, con pagos/cobros procesados, movimientos conciliados automáticamente y tareas pendientes de revisión.
              </p>
            </div>
            <button
              onClick={handleProcesarArchivos}
              disabled={procesando}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.45rem 0.85rem",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "#334155",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                cursor: procesando ? "default" : "pointer",
                opacity: procesando ? 0.6 : 1,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <RefreshCw size={14} />
              {procesando ? "Procesando..." : "Procesar archivos"}
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Cargando...</p>
          ) : filas.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Todavía no se ha procesado ningún fichero.</p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#f8fafc" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#eef1f6", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Fecha</th>
                    <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Fichero</th>
                    <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Tipo</th>
                    <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Procesados</th>
                    <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Conciliados</th>
                    <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Pagos</th>
                    <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Cobros</th>
                    <th style={{ padding: "0.6rem 1.75rem 0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Revisión</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr
                      key={`${f.ficheroId}-${i}`}
                      onClick={() => router.push(`/movimientos-app/historial-procesos/${f.ficheroId}?fecha=${encodeURIComponent(f.procesadoEn)}`)}
                      style={{ borderTop: "1px solid #e2e8f0", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "0.6rem 0.9rem", color: "#334155", whiteSpace: "nowrap" }}>
                        {parseFechaUtc(f.procesadoEn).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}
                      </td>
                      <td style={{ padding: "0.6rem 0.9rem", color: "#334155" }}>{f.nombreFichero}</td>
                      <td style={{ padding: "0.6rem 0.9rem" }}>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "999px",
                            color: f.origen === "automatico" ? "#1d4ed8" : "#7c3aed",
                            background: f.origen === "automatico" ? "#eff6ff" : "#f5f3ff",
                          }}
                        >
                          {f.origen === "automatico" ? "Cronjob" : "App"}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.9rem", color: "#334155", textAlign: "right" }}>{f.procesados}</td>
                      <td style={{ padding: "0.6rem 0.9rem", color: "#15803d", fontWeight: 600, textAlign: "right" }}>{f.conciliados}</td>
                      <td style={{ padding: "0.6rem 0.9rem", color: "#334155", textAlign: "right" }}>{f.pagos}</td>
                      <td style={{ padding: "0.6rem 0.9rem", color: "#334155", textAlign: "right" }}>{f.cobros}</td>
                      <td style={{ padding: "0.6rem 1.75rem 0.6rem 0.9rem", color: f.revision > 0 ? "#b45309" : "#94a3b8", fontWeight: 600, textAlign: "right" }}>
                        {f.revision}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
