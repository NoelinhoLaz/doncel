"use client";

import { useState, useEffect } from "react";
import {
  conciliarManualmente,
  getImportePendienteConciliar,
  getConciliacionesManuales,
  guardarAliasProveedor,
  buscarPagosOfi,
  vincularPagosOfiDesdeConciliacionManual,
  type ConciliacionManualDetalle,
} from "@/actions/banco";

const inputStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  padding: "0.4rem 0.5rem",
  border: "1px solid #e2e8f0",
  borderRadius: "0.375rem",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#334155",
  marginBottom: "0.3rem",
  display: "block",
};

export interface ConciliacionManualMov {
  id: string;
  importe: number;
  concepto_original?: string | null;
  estado: string;
}

export interface ConciliacionManualOpciones {
  expediente?: string;
  aliasProveedor?: { proveedorOfi: string; conceptoBanco: string };
}

const formatoEuro = (v: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

// fecha_vencto llega de la BD como "yyyy-mm-dd" (DATE); se muestra en
// formato local DD/MM/AAAA sin pasar por Date (evita desfases de zona horaria).
const formatoFecha = (v: string | null) => {
  if (!v) return "—";
  const [yyyy, mm, dd] = v.split("-");
  return dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : v;
};

/**
 * Modal de conciliación manual, extraído de movimientos-app para reutilizar
 * en /banco. Encapsula su propio estado (importe, expediente, VºBº Dirección Comercial,
 * histórico) y las llamadas a las server actions; el padre solo controla
 * cuándo se abre (pasando `mov`) y qué hacer al cerrarse/conciliar.
 *
 * El selector de pagos OFI permite filtrar libremente por expediente,
 * proveedor y/o rango de fecha, y seleccionar varios pagos a la vez
 * (checkboxes) mostrando la suma seleccionada en vivo.
 */
export function ConciliacionManualModal({
  mov,
  opciones,
  isOwner,
  onClose,
  onConciliado,
}: {
  mov: ConciliacionManualMov | null;
  opciones?: ConciliacionManualOpciones;
  isOwner: boolean;
  onClose: () => void;
  onConciliado: () => void;
}) {
  const [importe, setImporte] = useState("");
  const [nota, setNota] = useState("");
  const [voboDc, setVoboDc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendiente, setPendiente] = useState<number | null>(null);
  const [historico, setHistorico] = useState<ConciliacionManualDetalle[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  const [filtroExpediente, setFiltroExpediente] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [pagosOfi, setPagosOfi] = useState<Awaited<ReturnType<typeof buscarPagosOfi>>>([]);
  const [pagosOfiLoading, setPagosOfiLoading] = useState(false);
  const [pagosOfiSeleccionados, setPagosOfiSeleccionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!mov) return;
    let cancelado = false;

    const fallback = Math.abs(Number(mov.importe));
    setImporte(fallback.toFixed(2));
    setNota("");
    setVoboDc(false);
    setPendiente(fallback);
    setHistorico([]);
    setHistoricoLoading(true);
    setPagosOfi([]);
    setPagosOfiSeleccionados(new Set());
    setFiltroExpediente(opciones?.expediente || "");
    setFiltroProveedor("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");

    getImportePendienteConciliar(mov.id)
      .then(({ importePendiente }) => {
        if (cancelado) return;
        setPendiente(importePendiente);
        setImporte(importePendiente.toFixed(2));
      })
      .catch((error) => console.error("Error obteniendo importe pendiente:", error));

    getConciliacionesManuales(mov.id)
      .then((detalle) => {
        if (!cancelado) setHistorico(detalle);
      })
      .catch((error) => console.error("Error obteniendo histórico de conciliaciones:", error))
      .finally(() => {
        if (!cancelado) setHistoricoLoading(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mov?.id]);

  // Búsqueda de pagos OFI según los filtros activos, con debounce para no
  // disparar una consulta en cada pulsación.
  useEffect(() => {
    if (!mov) return;
    const expediente = filtroExpediente.trim();
    const proveedor = filtroProveedor.trim();
    const fechaDesde = filtroFechaDesde.trim();
    const fechaHasta = filtroFechaHasta.trim();
    if (!expediente && !proveedor && !fechaDesde && !fechaHasta) {
      setPagosOfi([]);
      return;
    }
    let cancelado = false;
    setPagosOfiLoading(true);
    const timeout = setTimeout(() => {
      buscarPagosOfi({ expediente, proveedor, fechaDesde, fechaHasta })
        .then((data) => {
          if (!cancelado) setPagosOfi(data);
        })
        .catch((error: any) => console.error("Error buscando pagos OFI:", error))
        .finally(() => {
          if (!cancelado) setPagosOfiLoading(false);
        });
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroExpediente, filtroProveedor, filtroFechaDesde, filtroFechaHasta, mov?.id]);

  if (!mov) return null;

  const toggleSeleccion = (pagoId: string) => {
    setPagosOfiSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(pagoId)) next.delete(pagoId);
      else next.add(pagoId);
      return next;
    });
  };

  // Los pagos OFI con importePendiente negativo son reembolsos/devoluciones:
  // deben restar de la suma, no sumarse en valor absoluto.
  const sumaSeleccionada = pagosOfi
    .filter((p) => pagosOfiSeleccionados.has(p.id))
    .reduce((sum, p) => sum + p.importePendiente, 0);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleConciliar = async () => {
    const importeNum = Number(importe.replace(",", "."));
    if (!importeNum || importeNum <= 0) {
      alert("Introduce un importe válido.");
      return;
    }
    setLoading(true);
    try {
      if (pagosOfiSeleccionados.size > 0) {
        try {
          await vincularPagosOfiDesdeConciliacionManual([...pagosOfiSeleccionados], mov.id);
        } catch (error: any) {
          alert(error?.message || "Error al vincular los pagos OFI seleccionados.");
          return;
        }
      }
      const res = await conciliarManualmente(mov.id, importeNum, filtroExpediente.trim() || undefined, isOwner && voboDc, nota.trim() || undefined);
      if (!res.success) {
        alert(res.error || "Error al conciliar el movimiento.");
        return;
      }
      if (opciones?.aliasProveedor) {
        guardarAliasProveedor(opciones.aliasProveedor.proveedorOfi, opciones.aliasProveedor.conceptoBanco).catch((err) =>
          console.error("Error guardando alias de proveedor:", err)
        );
      }
      onClose();
      onConciliado();
    } catch (error) {
      console.error("Error conciliando manualmente:", error);
      alert("Error al conciliar el movimiento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "0.75rem",
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            {mov.estado === "conciliado" ? "Conciliación" : "Conciliar manualmente"}
          </h2>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
            {mov.concepto_original || "Movimiento sin concepto"}
          </p>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.9rem", overflowY: "auto" }}>
          {historicoLoading ? (
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>Cargando histórico...</p>
          ) : (
            historico.length > 0 && (
              <div>
                <span style={labelStyle}>Conciliado por</span>
                <ul style={{ listStyle: "none", margin: "0.3rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {historico.map((c) => (
                    <li
                      key={c.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem 0.65rem",
                        background: "#f8fafc",
                        borderRadius: "0.375rem",
                        fontSize: "0.78rem",
                      }}
                    >
                      <span style={{ color: "#334155" }}>
                        {c.usuarioNombre}
                        {c.voboDc && (
                          <span style={{ marginLeft: "0.4rem", fontSize: "0.65rem", fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", borderRadius: "0.25rem", padding: "0.05rem 0.3rem" }}>
                            VºBº Dirección Comercial
                          </span>
                        )}
                        <span style={{ display: "block", color: "#94a3b8", fontSize: "0.7rem" }}>
                          {new Date(c.fecha).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {c.nota && (
                          <span style={{ display: "block", color: "#475569", fontSize: "0.72rem", marginTop: "0.2rem", fontStyle: "italic" }}>
                            {c.nota}
                          </span>
                        )}
                      </span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatoEuro(c.importe)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          {mov.estado !== "conciliado" && (
            <>
              <div>
                <span style={labelStyle}>Importe</span>
                <input type="number" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)} style={inputStyle} />
                {pendiente !== null && (
                  <p style={{ margin: "0.3rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                    Pendiente por conciliar: {formatoEuro(pendiente)}
                  </p>
                )}
              </div>

              <div>
                <span style={labelStyle}>Buscar pagos OFI</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <input
                    type="text"
                    placeholder="Expediente (ej. 001260012)"
                    value={filtroExpediente}
                    onChange={(e) => setFiltroExpediente(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Proveedor"
                    value={filtroProveedor}
                    onChange={(e) => setFiltroProveedor(e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <input
                      type="date"
                      value={filtroFechaDesde}
                      onChange={(e) => setFiltroFechaDesde(e.target.value)}
                      style={inputStyle}
                      title="Fecha desde"
                    />
                    <input
                      type="date"
                      value={filtroFechaHasta}
                      onChange={(e) => setFiltroFechaHasta(e.target.value)}
                      style={inputStyle}
                      title="Fecha hasta"
                    />
                  </div>
                </div>

                {pagosOfiLoading ? (
                  <p style={{ margin: "0.4rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>Buscando pagos OFI…</p>
                ) : pagosOfi.length > 0 ? (
                  <>
                    <div style={{ marginTop: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", overflow: "hidden", maxHeight: "220px", overflowY: "auto" }}>
                      {pagosOfi.map((p) => {
                        const seleccionado = pagosOfiSeleccionados.has(p.id);
                        const restante = Math.abs(p.importePendiente) - p.importeVinculado;
                        return (
                          <label
                            key={p.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              width: "100%",
                              padding: "0.45rem 0.6rem",
                              borderTop: "1px solid #f1f5f9",
                              background: seleccionado ? "#ecfdf5" : "#fff",
                              cursor: p.completo ? "default" : "pointer",
                              opacity: p.completo ? 0.55 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionado}
                              disabled={p.completo}
                              onChange={() => toggleSeleccion(p.id)}
                              style={{ flexShrink: 0 }}
                            />
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: "block", fontSize: "0.76rem", color: "#334155", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {p.proveedorNombre || p.documento}
                              </span>
                              <span style={{ display: "block", fontSize: "0.7rem", color: "#94a3b8" }}>
                                {p.documento} · Exp. {p.referenciaProvCte || "—"} · {p.nombrePasajero || "—"} · {formatoFecha(p.fechaVencto)}
                                {p.completo
                                  ? " · completo"
                                  : p.vinculado
                                  ? ` · quedan ${formatoEuro(restante)}`
                                  : ""}
                              </span>
                            </span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>
                              {formatoEuro(p.importePendiente)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {pagosOfiSeleccionados.size > 0 && (
                      <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", color: "#334155", fontWeight: 600 }}>
                        {pagosOfiSeleccionados.size} seleccionado{pagosOfiSeleccionados.size !== 1 ? "s" : ""} · Suma: {formatoEuro(sumaSeleccionada)}
                      </p>
                    )}
                  </>
                ) : (
                  (filtroExpediente.trim() || filtroProveedor.trim() || filtroFechaDesde || filtroFechaHasta) && (
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>Sin pagos OFI para esos filtros.</p>
                  )
                )}
              </div>

              <div>
                <span style={labelStyle}>Nota (opcional)</span>
                <textarea
                  placeholder="Añade una nota sobre esta conciliación..."
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={500}
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {isOwner && (
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" checked={voboDc} onChange={(e) => setVoboDc(e.target.checked)} />
                  VºBº Dirección Comercial
                </label>
              )}
            </>
          )}
        </div>

        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: "0.6rem",
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: "0.5rem",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {mov.estado === "conciliado" ? "Cerrar" : "Cancelar"}
          </button>
          {mov.estado !== "conciliado" && (
            <button
              onClick={handleConciliar}
              disabled={loading}
              style={{
                flex: 1,
                padding: "0.6rem",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Conciliando..." : "Conciliar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
