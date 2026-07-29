"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getDetalleProcesoOfiviaje } from "@/actions/banco";
import { getCurrentAgencyDetails } from "@/actions/agencias";

interface Procesado {
  movimientoId: string;
  movimientoFecha: string;
  movimientoConcepto: string;
  movimientoImporte: number;
  proveedorNombre: string;
  expediente: string;
}

interface Tarea {
  id: string;
  tipo: string;
  nombre: string;
  expediente: string;
  importe: number | null;
  movConcepto: string | null;
  movImporte: number | null;
}

const ETIQUETA_TIPO: Record<string, string> = {
  revisarNombre: "Cliente/Proveedor distinto",
  revisarImporte: "Importe distinto",
  revisarSuma: "Suma de movimientos",
  revisarDivision: "División de pagos",
  sinMatch: "Movimiento bancario no encontrado",
};

const formatoImporte = (valor: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.abs(valor));

const parseFechaUtc = (valor: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(valor) ? valor : `${valor}Z`);

const POR_PAGINA = 10;

export default function DetalleProcesoOfiviajePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ficheroId = decodeURIComponent(String(params.id));
  const fecha = searchParams.get("fecha");

  const [nombreFichero, setNombreFichero] = useState("");
  const [procesados, setProcesados] = useState<Procesado[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyDetails, setAgencyDetails] = useState<any>(null);
  const [paginaProcesados, setPaginaProcesados] = useState(1);
  const [paginaTareas, setPaginaTareas] = useState(1);

  useEffect(() => {
    getDetalleProcesoOfiviaje(ficheroId)
      .then((data) => {
        setNombreFichero(data.nombreFichero);
        setProcesados(data.procesados as Procesado[]);
        setTareas(data.tareas as Tarea[]);
      })
      .finally(() => setLoading(false));
    getCurrentAgencyDetails().then(setAgencyDetails);
  }, [ficheroId]);

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
            href="/movimientos-app/historial-procesos"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#334155", fontSize: "0.85rem", textDecoration: "none", marginBottom: "1rem" }}
          >
            <ArrowLeft size={16} />
            Volver al historial
          </NextLink>

          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>
            {nombreFichero || "Detalle del proceso"}
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem" }}>
            {fecha ? parseFechaUtc(fecha).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : ""}
          </p>

          {loading ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Cargando...</p>
          ) : (
            <>
              <div style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "0.8rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                  Procesados ({procesados.length})
                </h2>
                {procesados.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                    Sin movimientos conciliados registrados para este proceso.
                  </p>
                ) : (
                  <>
                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ background: "#eef1f6", textAlign: "left" }}>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Fecha</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Concepto banco</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Proveedor OFI</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Expediente</th>
                            <th style={{ padding: "0.6rem 1.75rem 0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {procesados.slice((paginaProcesados - 1) * POR_PAGINA, paginaProcesados * POR_PAGINA).map((p) => (
                            <tr key={p.movimientoId} style={{ borderTop: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.6rem 0.9rem", color: "#334155", whiteSpace: "nowrap" }}>{p.movimientoFecha}</td>
                              <td
                                title={p.movimientoConcepto}
                                style={{ padding: "0.6rem 0.9rem", color: "#334155", maxWidth: "260px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                              >
                                {p.movimientoConcepto}
                              </td>
                              <td style={{ padding: "0.6rem 0.9rem", color: "#334155", whiteSpace: "nowrap" }}>{p.proveedorNombre}</td>
                              <td style={{ padding: "0.6rem 0.9rem", color: "#334155", whiteSpace: "nowrap" }}>{p.expediente}</td>
                              <td style={{ padding: "0.6rem 1.75rem 0.6rem 0.9rem", color: "#15803d", fontWeight: 600, textAlign: "right" }}>
                                {formatoImporte(p.movimientoImporte)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {procesados.length > POR_PAGINA && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.6rem" }}>
                        <button
                          onClick={() => setPaginaProcesados((p) => Math.max(1, p - 1))}
                          disabled={paginaProcesados === 1}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            color: "#334155",
                            cursor: paginaProcesados === 1 ? "default" : "pointer",
                            opacity: paginaProcesados === 1 ? 0.4 : 1,
                          }}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          Página {paginaProcesados} de {Math.ceil(procesados.length / POR_PAGINA)}
                        </span>
                        <button
                          onClick={() => setPaginaProcesados((p) => Math.min(Math.ceil(procesados.length / POR_PAGINA), p + 1))}
                          disabled={paginaProcesados >= Math.ceil(procesados.length / POR_PAGINA)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            color: "#334155",
                            cursor: paginaProcesados >= Math.ceil(procesados.length / POR_PAGINA) ? "default" : "pointer",
                            opacity: paginaProcesados >= Math.ceil(procesados.length / POR_PAGINA) ? 0.4 : 1,
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <h2 style={{ fontSize: "0.8rem", fontWeight: 700, color: "#b45309", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                  Incidencias ({tareas.length})
                </h2>
                {tareas.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin incidencias para este proceso.</p>
                ) : (
                  <>
                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ background: "#eef1f6", textAlign: "left" }}>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Tipo</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Proveedor OFI</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Expediente</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Concepto banco</th>
                            <th style={{ padding: "0.6rem 1.75rem 0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tareas.slice((paginaTareas - 1) * POR_PAGINA, paginaTareas * POR_PAGINA).map((t) => (
                            <tr key={t.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.6rem 0.9rem" }}>
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "999px",
                                    color: "#b45309",
                                    background: "#fef3c7",
                                  }}
                                >
                                  {ETIQUETA_TIPO[t.tipo] || t.tipo}
                                </span>
                              </td>
                              <td style={{ padding: "0.6rem 0.9rem", color: "#334155", whiteSpace: "nowrap" }}>{t.nombre}</td>
                              <td style={{ padding: "0.6rem 0.9rem", color: "#334155", whiteSpace: "nowrap" }}>{t.expediente}</td>
                              <td
                                title={t.movConcepto || undefined}
                                style={{ padding: "0.6rem 0.9rem", color: "#334155", maxWidth: "260px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                              >
                                {t.movConcepto || "—"}
                              </td>
                              <td style={{ padding: "0.6rem 1.75rem 0.6rem 0.9rem", color: "#334155", fontWeight: 600, textAlign: "right" }}>
                                {t.importe != null ? formatoImporte(t.importe) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {tareas.length > POR_PAGINA && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.6rem" }}>
                        <button
                          onClick={() => setPaginaTareas((p) => Math.max(1, p - 1))}
                          disabled={paginaTareas === 1}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            color: "#334155",
                            cursor: paginaTareas === 1 ? "default" : "pointer",
                            opacity: paginaTareas === 1 ? 0.4 : 1,
                          }}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          Página {paginaTareas} de {Math.ceil(tareas.length / POR_PAGINA)}
                        </span>
                        <button
                          onClick={() => setPaginaTareas((p) => Math.min(Math.ceil(tareas.length / POR_PAGINA), p + 1))}
                          disabled={paginaTareas >= Math.ceil(tareas.length / POR_PAGINA)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            color: "#334155",
                            cursor: paginaTareas >= Math.ceil(tareas.length / POR_PAGINA) ? "default" : "pointer",
                            opacity: paginaTareas >= Math.ceil(tareas.length / POR_PAGINA) ? 0.4 : 1,
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
