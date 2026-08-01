"use client";

import { useEffect, useState, useMemo } from "react";
import NextLink from "next/link";
import { ArrowLeft, Download, Link2, Search, X } from "lucide-react";
import { descargarMovimientosOfiviaje, getOfiPagos, getOfiCobros, buscarCandidatosMovimientoBanco, vincularManualmenteMovimientoBanco, conciliarDesdeOfiPagos, getPagosPendientesDeRevision, getGruposAgrupacionPendientes, conciliarGrupoAgrupacion } from "@/actions/banco";
import { RefreshCw } from "lucide-react";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";

function ConciliadoCell({
  movimientoBanco,
  onBuscar,
}: {
  movimientoBanco: any | null;
  onBuscar: () => void;
}) {
  if (movimientoBanco) {
    const tooltip = [
      movimientoBanco.concepto_original,
      movimientoBanco.fecha_operacion ? formatoFecha(movimientoBanco.fecha_operacion) : null,
      movimientoBanco.importe != null ? formatoImporte(movimientoBanco.importe) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <span title={tooltip} style={{ display: "inline-flex", color: "#15803d", cursor: "default" }}>
        <Link2 size={16} />
      </span>
    );
  }
  return (
    <button
      onClick={onBuscar}
      title="Buscar movimiento bancario"
      style={{ display: "inline-flex", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <Search size={16} />
    </button>
  );
}

function BuscarMovimientoModal({
  objetivo,
  onClose,
  onVinculado,
}: {
  objetivo: { tipo: "pago" | "cobro"; registro: any };
  onClose: () => void;
  onVinculado: () => void;
}) {
  const { tipo, registro } = objetivo;
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);

  useEffect(() => {
    buscarCandidatosMovimientoBanco(tipo, registro.id)
      .then((data) => setCandidatos(data))
      .finally(() => setLoading(false));
  }, [tipo, registro.id]);

  const handleVincular = async (movimientoBancoId: string) => {
    setVinculandoId(movimientoBancoId);
    try {
      await vincularManualmenteMovimientoBanco(tipo, registro.id, movimientoBancoId);
      onVinculado();
      onClose();
    } finally {
      setVinculandoId(null);
    }
  };

  const datosOfi =
    tipo === "pago"
      ? [
          { label: "Documento", valor: registro.documento },
          { label: "Doc. cobro/pago", valor: registro.documento_cobro_pago },
          { label: "Expediente", valor: registro.referencia_prov_cte },
          { label: "Proveedor", valor: registro.proveedor_nombre },
          { label: "Pasajero", valor: registro.nombre_pasajero },
          { label: "Fec. Doc", valor: formatoFecha(registro.fecha_doc) },
          { label: "Fec. Vcto", valor: formatoFecha(registro.fecha_vencto) },
          { label: "Importe", valor: formatoImporte(registro.importe_pendiente) },
        ]
      : [
          { label: "Factura", valor: registro.factura },
          { label: "Pagador", valor: registro.nombre_pagador },
          { label: "Concepto", valor: registro.concepto_movimiento },
          { label: "Fecha", valor: formatoFecha(registro.fecha_movimiento) },
          { label: "Importe", valor: formatoImporte(registro.importe_cobro) },
        ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ background: "#fff", borderRadius: "0.6rem", padding: "1.25rem", width: "min(640px, 92vw)", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Buscar movimiento bancario</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.4rem" }}>
            Datos OFI {tipo === "pago" ? "· Pago" : "· Cobro"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem 1rem", fontSize: "0.8rem" }}>
            {datosOfi
              .filter((d) => d.valor && d.valor !== "—")
              .map((d) => (
                <div key={d.label}>
                  <span style={{ color: "#94a3b8" }}>{d.label}:</span> <span style={{ color: "#334155", fontWeight: 600 }}>{d.valor}</span>
                </div>
              ))}
          </div>
        </div>

        <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>
          Candidatos por importe y fecha (±60 días).
        </p>

        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Buscando…</p>
        ) : candidatos.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin resultados con importe/fecha similares.</p>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden" }}>
            {candidatos.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: "0.6rem 0.8rem",
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div title={m.concepto_original} style={{ fontSize: "0.8rem", color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.concepto_original}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{formatoFecha(m.fecha_operacion)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: m.importe < 0 ? "#dc2626" : "#15803d", whiteSpace: "nowrap" }}>
                    {formatoImporte(m.importe)}
                  </span>
                  <button
                    onClick={() => handleVincular(m.id)}
                    disabled={vinculandoId === m.id}
                    style={{
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#fff",
                      background: "#334155",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: vinculandoId === m.id ? "default" : "pointer",
                      opacity: vinculandoId === m.id ? 0.6 : 1,
                    }}
                  >
                    {vinculandoId === m.id ? "..." : "Vincular"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const POR_PAGINA = 20;

function formatoImporte(v: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(v || 0));
}

// fecha_vencto/fecha_movimiento llegan de la BD como "yyyy-mm-dd" (DATE); se
// muestran en formato local DD/MM/AAAA sin pasar por Date (evita desfases de
// zona horaria en fechas sin hora).
function formatoFecha(v: string | null) {
  if (!v) return "—";
  const [yyyy, mm, dd] = v.split("-");
  return dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : v;
}

function Tabla<T extends { id: string }>({
  filas,
  columnas,
  vacio,
}: {
  filas: T[];
  columnas: { header: string; render: (f: T) => React.ReactNode; align?: "left" | "right"; width?: string }[];
  vacio: string;
}) {
  const [pagina, setPagina] = useState(1);

  if (filas.length === 0) {
    return <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{vacio}</p>;
  }

  const totalPaginas = Math.ceil(filas.length / POR_PAGINA);
  const filasPagina = filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#f8fafc" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#eef1f6", textAlign: "left" }}>
              {columnas.map((c) => (
                <th
                  key={c.header}
                  style={{ padding: "0.3rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: c.align ?? "left", width: c.width ?? "auto", whiteSpace: "nowrap" }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filasPagina.map((f) => (
              <tr key={f.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                {columnas.map((c) => (
                  <td key={c.header} style={{ padding: "0.3rem 0.9rem", color: "#334155", textAlign: c.align ?? "left", whiteSpace: c.width ? "nowrap" : "normal" }}>
                    {c.render(f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPaginas > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", marginTop: "0.6rem" }}>
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", background: "#fff", cursor: pagina <= 1 ? "default" : "pointer", opacity: pagina <= 1 ? 0.5 : 1 }}
          >
            Anterior
          </button>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina >= totalPaginas}
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", background: "#fff", cursor: pagina >= totalPaginas ? "default" : "pointer", opacity: pagina >= totalPaginas ? 0.5 : 1 }}
          >
            Siguiente
          </button>
        </div>
      )}
    </>
  );
}

// El prefijo de 3 dígitos de la referencia de expediente (referencia_prov_cte
// del XML de OFIviaje, ej. "003251325") identifica la agencia/oficina de
// origen del expediente.
const AGENCIA_POR_PREFIJO: Record<string, string> = {
  "001": "Alcalá",
  "002": "Guadalajara",
  "003": "Palma",
};

function agenciaDeExpediente(referenciaProvCte: string | null): string | null {
  if (!referenciaProvCte) return null;
  const prefijo = referenciaProvCte.slice(0, 3);
  return AGENCIA_POR_PREFIJO[prefijo] ?? null;
}

function TablaRevision({
  candidatos,
  onAccionCompletada,
}: {
  candidatos: any[];
  onAccionCompletada: () => void;
}) {
  const [pagina, setPagina] = useState(1);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  if (candidatos.length === 0) {
    return <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin candidatos pendientes de revisión.</p>;
  }

  const totalPaginas = Math.ceil(candidatos.length / POR_PAGINA);
  const filasPagina = candidatos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const clave = (c: any) => `${c.pagoOfiId}|${c.movimientoBancoId}`;

  const handleVincular = async (c: any) => {
    setProcesandoId(clave(c));
    try {
      await vincularManualmenteMovimientoBanco("pago", c.pagoOfiId, c.movimientoBancoId);
      onAccionCompletada();
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#f8fafc" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#eef1f6", textAlign: "left" }}>
              <th style={{ padding: "0.3rem 0.9rem", fontWeight: 600, color: "#334155" }}>Motivo</th>
              <th style={{ padding: "0.3rem 0.9rem", fontWeight: 600, color: "#334155" }}>Pago OFI</th>
              <th style={{ padding: "0.3rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Importe OFI</th>
              <th style={{ padding: "0.3rem 0.9rem", fontWeight: 600, color: "#334155" }}>Movimiento banco</th>
              <th style={{ padding: "0.3rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Importe banco</th>
              <th style={{ padding: "0.3rem 0.9rem", fontWeight: 600, color: "#334155", width: "1%" }}></th>
            </tr>
          </thead>
          <tbody>
            {filasPagina.map((c) => (
              <tr key={clave(c)} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: "0.3rem 0.9rem" }}>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      padding: "0.1rem 0.4rem",
                      borderRadius: "999px",
                      color: c.coincidePorImporte ? "#1d4ed8" : "#b45309",
                      background: c.coincidePorImporte ? "#dbeafe" : "#fef3c7",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.coincidePorImporte ? "Mismo importe" : "Mismo proveedor"}
                  </span>
                </td>
                <td style={{ padding: "0.3rem 0.9rem", color: "#334155" }}>
                  <div>{c.documento}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{c.proveedorNombre} · {formatoFecha(c.fechaVencto)}</div>
                </td>
                <td style={{ padding: "0.3rem 0.9rem", textAlign: "right", color: "#334155" }}>{formatoImporte(c.importePendiente)}</td>
                <td style={{ padding: "0.3rem 0.9rem", color: "#334155", maxWidth: 320 }}>
                  <div title={c.movimientoConcepto} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.movimientoConcepto}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{formatoFecha(c.movimientoFecha)}</div>
                </td>
                <td style={{ padding: "0.3rem 0.9rem", textAlign: "right", color: c.movimientoImporte < 0 ? "#dc2626" : "#15803d" }}>
                  {formatoImporte(c.movimientoImporte)}
                </td>
                <td style={{ padding: "0.3rem 0.9rem" }}>
                  <button
                    onClick={() => handleVincular(c)}
                    disabled={procesandoId === clave(c)}
                    style={{
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#fff",
                      background: "#334155",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: procesandoId === clave(c) ? "default" : "pointer",
                      opacity: procesandoId === clave(c) ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {procesandoId === clave(c) ? "..." : "Vincular"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPaginas > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", marginTop: "0.6rem" }}>
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", background: "#fff", cursor: pagina <= 1 ? "default" : "pointer", opacity: pagina <= 1 ? 0.5 : 1 }}
          >
            Anterior
          </button>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina >= totalPaginas}
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", background: "#fff", cursor: pagina >= totalPaginas ? "default" : "pointer", opacity: pagina >= totalPaginas ? 0.5 : 1 }}
          >
            Siguiente
          </button>
        </div>
      )}
    </>
  );
}

function TablaGrupos({
  grupos,
  onAccionCompletada,
}: {
  grupos: any[];
  onAccionCompletada: () => void;
}) {
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  if (grupos.length === 0) {
    return <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin agrupaciones detectadas.</p>;
  }

  const handleConciliar = async (g: any) => {
    setProcesandoId(g.movimientoBancoId);
    try {
      await conciliarGrupoAgrupacion(g.pagoIds, g.movimientoBancoId);
      onAccionCompletada();
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {grupos.map((g) => (
        <div key={g.movimientoBancoId} style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#f8fafc", padding: "0.75rem 0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>
                {g.proveedorNombre} · {formatoFecha(g.fechaVencto)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {g.pagoIds.length} pagos: {g.documentos.join(", ")}
              </div>
              <div title={g.movimientoConcepto} style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem", maxWidth: 480, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Movimiento: {g.movimientoConcepto} · {formatoFecha(g.movimientoFecha)}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>{formatoImporte(g.sumaImporte)}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>suma de {g.pagoIds.length}</div>
              </div>
              <button
                onClick={() => handleConciliar(g)}
                disabled={procesandoId === g.movimientoBancoId}
                style={{
                  padding: "0.35rem 0.7rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#fff",
                  background: "#334155",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: procesandoId === g.movimientoBancoId ? "default" : "pointer",
                  opacity: procesandoId === g.movimientoBancoId ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {procesandoId === g.movimientoBancoId ? "..." : "Conciliar grupo"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MovimientosOfiviajePage() {
  const [pagos, setPagos] = useState<any[]>([]);
  const [cobros, setCobros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [conciliando, setConciliando] = useState(false);
  const [idsPagosAmbiguos, setIdsPagosAmbiguos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroConciliado, setFiltroConciliado] = useState<"todos" | "conciliados" | "pendientes">("todos");
  const [filtroAgencia, setFiltroAgencia] = useState<string[]>([]);
  const [objetivoBusqueda, setObjetivoBusqueda] = useState<{ tipo: "pago" | "cobro"; registro: any } | null>(null);
  const [pestana, setPestana] = useState<"listados" | "revision">("listados");
  const [candidatosRevision, setCandidatosRevision] = useState<any[]>([]);
  const [gruposRevision, setGruposRevision] = useState<any[]>([]);
  const [cargandoRevision, setCargandoRevision] = useState(false);

  const cargar = () => {
    return Promise.all([getOfiPagos(), getOfiCobros()]).then(([p, c]) => {
      setPagos(p as any[]);
      setCobros(c as any[]);
    });
  };

  const cargarRevision = () => {
    setCargandoRevision(true);
    return Promise.all([getPagosPendientesDeRevision(), getGruposAgrupacionPendientes()])
      .then(([candidatos, grupos]) => {
        setCandidatosRevision(candidatos as any[]);
        setGruposRevision(grupos as any[]);
      })
      .finally(() => setCargandoRevision(false));
  };

  useEffect(() => {
    cargar().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (pestana === "revision" && candidatosRevision.length === 0 && gruposRevision.length === 0) cargarRevision();
  }, [pestana]);

  const handleDescargar = async () => {
    setDescargando(true);
    setResultado(null);
    try {
      const r = await descargarMovimientosOfiviaje();
      setResultado(`${r.ficherosLeidos} fichero(s) leídos · ${r.pagosInsertados} pagos nuevos · ${r.cobrosInsertados} cobros nuevos`);
      await cargar();
    } catch (e: any) {
      setResultado(`Error: ${e.message || "no se pudieron descargar los movimientos"}`);
    } finally {
      setDescargando(false);
    }
  };

  const pasaFiltroConciliado = (movimientoBancoId: string | null) => {
    if (filtroConciliado === "conciliados") return !!movimientoBancoId;
    if (filtroConciliado === "pendientes") return !movimientoBancoId;
    return true;
  };

  const pagosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pagos.filter((p) => {
      if (!pasaFiltroConciliado(p.movimiento_banco_id)) return false;
      if (filtroAgencia.length > 0) {
        const agencia = agenciaDeExpediente(p.referencia_prov_cte);
        if (!agencia || !filtroAgencia.includes(agencia)) return false;
      }
      if (!q) return true;
      return [p.documento, p.referencia_prov_cte, p.proveedor_nombre, p.nombre_pasajero]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [pagos, busqueda, filtroConciliado, filtroAgencia]);

  const cobrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cobros.filter((c) => {
      if (!pasaFiltroConciliado(c.movimiento_banco_id)) return false;
      if (!q) return true;
      return [c.factura, c.nombre_pagador, c.concepto_movimiento]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [cobros, busqueda, filtroConciliado]);


  const handleConciliar = async () => {
    setConciliando(true);
    setResultado(null);
    try {
      const r = await conciliarDesdeOfiPagos();
      setResultado(`${r.pagosSincronizados} ya conciliados sincronizados · ${r.pagosConciliados} pagos conciliados · ${r.pagosRevisados} sin desambiguar (revisión manual)`);
      setIdsPagosAmbiguos(new Set(r.idsPagosRevisados));
      await cargar();
    } catch (e: any) {
      setResultado(`Error: ${e.message || "no se pudo conciliar"}`);
    } finally {
      setConciliando(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem 2rem", width: "100%" }}>
      <NextLink href="/banco" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#64748b", fontSize: "0.85rem", textDecoration: "none", marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Volver
      </NextLink>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Movimientos OFIviaje</h1>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            onClick={handleConciliar}
            disabled={conciliando}
            title="Busca en los movimientos de OFI de la base de datos que aún no están conciliados un movimiento bancario con el que hacer match."
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 0.9rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "0.375rem",
              cursor: conciliando ? "default" : "pointer",
              opacity: conciliando ? 0.6 : 1,
            }}
          >
            <RefreshCw size={16} />
            {conciliando ? "Conciliando..." : "Conciliar"}
          </button>
          <button
            onClick={handleDescargar}
            disabled={descargando}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 0.9rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#fff",
              background: "#334155",
              border: "none",
              borderRadius: "0.375rem",
              cursor: descargando ? "default" : "pointer",
              opacity: descargando ? 0.6 : 1,
            }}
          >
            <Download size={16} />
            {descargando ? "Descargando..." : "Descargar movimientos"}
          </button>
        </div>
      </div>

      {resultado && (
        <p style={{ fontSize: "0.85rem", color: resultado.startsWith("Error") ? "#dc2626" : "#15803d", marginBottom: "1rem" }}>
          {resultado}
        </p>
      )}

      <div style={{ display: "flex", gap: "1.5rem", borderBottom: "1px solid #e2e8f0", marginBottom: "1.25rem" }}>
        <button
          onClick={() => setPestana("listados")}
          style={{
            padding: "0.5rem 0.1rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: pestana === "listados" ? "#334155" : "#94a3b8",
            background: "none",
            border: "none",
            borderBottom: pestana === "listados" ? "2px solid #334155" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          Pagos y Cobros
        </button>
        <button
          onClick={() => setPestana("revision")}
          style={{
            padding: "0.5rem 0.1rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: pestana === "revision" ? "#334155" : "#94a3b8",
            background: "none",
            border: "none",
            borderBottom: pestana === "revision" ? "2px solid #334155" : "2px solid transparent",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          Revisión
          {candidatosRevision.length + gruposRevision.length > 0 && (
            <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.05rem 0.4rem", borderRadius: "999px", color: "#b45309", background: "#fef3c7" }}>
              {candidatosRevision.length + gruposRevision.length}
            </span>
          )}
        </button>
      </div>

      {pestana === "revision" ? (
        <>
          {cargandoRevision ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Cargando…</p>
          ) : (
            <>
              <section style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#334155", marginBottom: "0.4rem" }}>Posibles agrupaciones ({gruposRevision.length})</h2>
                <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
                  Varios pagos OFI del mismo proveedor y fecha cuya suma coincide con un único movimiento bancario (ej. recibos agrupados en un cargo consolidado).
                </p>
                <TablaGrupos
                  grupos={gruposRevision}
                  onAccionCompletada={() => {
                    cargar();
                    cargarRevision();
                  }}
                />
              </section>

              <section>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#334155", marginBottom: "0.4rem" }}>Coincidencias parciales ({candidatosRevision.length})</h2>
                <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
                  Pares (pago OFI, movimiento bancario) con coincidencia parcial — mismo importe con fecha cercana, o mismo proveedor con fecha cercana — que no se conciliaron automáticamente por no cumplir ambos criterios a la vez.
                </p>
                <TablaRevision
                  candidatos={candidatosRevision}
                  onAccionCompletada={() => {
                    cargar();
                    cargarRevision();
                  }}
                />
              </section>
            </>
          )}
        </>
      ) : (
      <>
      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "1 1 260px", minWidth: 220, padding: "0.4rem 0.7rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", background: "#fff" }}>
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Buscar por documento, factura, proveedor, pasajero, concepto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: "0.85rem", width: "100%", background: "transparent" }}
          />
        </div>
        <select
          value={filtroConciliado}
          onChange={(e) => setFiltroConciliado(e.target.value as "todos" | "conciliados" | "pendientes")}
          style={{ padding: "0.4rem 0.7rem", fontSize: "0.85rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", background: "#fff", color: "#334155" }}
        >
          <option value="todos">Todos</option>
          <option value="conciliados">Conciliados</option>
          <option value="pendientes">Pendientes</option>
        </select>
        <MultiSelectDropdown
          options={["Alcalá", "Guadalajara", "Palma"]}
          selected={filtroAgencia}
          onChange={setFiltroAgencia}
          placeholder="Todas las agencias"
        />
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Cargando…</p>
      ) : (
        <>
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#334155", marginBottom: "0.75rem" }}>Pagos ({pagosFiltrados.length})</h2>
            <Tabla
              filas={pagosFiltrados}
              vacio="Todavía no hay pagos descargados. Pulsa 'Descargar movimientos' para leerlos desde Drive."
              columnas={[
                { header: "Fec. Doc", width: "1%", render: (p) => formatoFecha(p.fecha_doc) },
                { header: "Fec. Vcto", width: "1%", render: (p) => formatoFecha(p.fecha_vencto) },
                { header: "Expediente", render: (p) => p.referencia_prov_cte ?? "—" },
                { header: "Proveedor", render: (p) => p.proveedor_nombre ?? "—" },
                { header: "Pasajero", render: (p) => p.nombre_pasajero ?? "—" },
                { header: "Documento", width: "1%", render: (p) => p.documento ?? "—" },
                { header: "Importe", render: (p) => formatoImporte(p.importe_pendiente), align: "right" },
                {
                  header: "Conciliado",
                  width: "1%",
                  render: (p) => (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <ConciliadoCell
                        movimientoBanco={p.movimiento_banco}
                        onBuscar={() => setObjetivoBusqueda({ tipo: "pago", registro: p })}
                      />
                      {idsPagosAmbiguos.has(p.id) && (
                        <span
                          title="Hay varios movimientos bancarios candidatos y ninguno se pudo desambiguar automáticamente. Usa la lupa para elegir manualmente."
                          style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "999px", color: "#b45309", background: "#fef3c7", whiteSpace: "nowrap" }}
                        >
                          Ambiguo
                        </span>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </section>

          <section>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#334155", marginBottom: "0.75rem" }}>Cobros ({cobrosFiltrados.length})</h2>
            <Tabla
              filas={cobrosFiltrados}
              vacio="Todavía no hay cobros descargados. Pulsa 'Descargar movimientos' para leerlos desde Drive."
              columnas={[
                { header: "Factura", render: (c) => c.factura ?? "—" },
                { header: "Fecha", width: "1%", render: (c) => formatoFecha(c.fecha_movimiento) },
                { header: "Pagador", render: (c) => c.nombre_pagador ?? "—" },
                { header: "Concepto", render: (c) => c.concepto_movimiento ?? "—" },
                { header: "Importe", render: (c) => formatoImporte(c.importe_cobro), align: "right" },
                {
                  header: "Conciliado",
                  width: "1%",
                  render: (c) => (
                    <ConciliadoCell
                      movimientoBanco={c.movimiento_banco}
                      onBuscar={() => setObjetivoBusqueda({ tipo: "cobro", registro: c })}
                    />
                  ),
                },
              ]}
            />
          </section>
        </>
      )}
      </>
      )}

      {objetivoBusqueda && (
        <BuscarMovimientoModal
          objetivo={objetivoBusqueda}
          onClose={() => setObjetivoBusqueda(null)}
          onVinculado={cargar}
        />
      )}
    </div>
  );
}
