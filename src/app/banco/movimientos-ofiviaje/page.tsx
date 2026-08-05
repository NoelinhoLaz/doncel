"use client";

import { useEffect, useState, useMemo } from "react";
import NextLink from "next/link";
import { ArrowLeft, Download, Link2, Search, X } from "lucide-react";
import { descargarMovimientosOfiviaje, descargarMovimientosOFISinDuplicar, getOfiPagos, getOfiCobros, buscarCandidatosMovimientoBanco, vincularManualmenteMovimientoBanco, conciliarDesdeOfiPagos, conciliarDesdeOfiCobros, vincularOfiDesdeRevision } from "@/actions/banco";
import { RefreshCw } from "lucide-react";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";
import { MatchTooltipWrapper } from "@/components/movimientos/MatchTooltipWrapper";

function ConciliadoCell({
  movimientosBanco,
  onBuscar,
}: {
  movimientosBanco: any[];
  onBuscar: () => void;
}) {
  if (movimientosBanco.length === 0) {
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

  return (
    <MatchTooltipWrapper
      label=""
      badgeStyles={{ background: "transparent", color: "#15803d", border: "none" }}
      trigger={
        <span style={{ display: "inline-flex", color: "#15803d" }}>
          <Link2 size={16} />
        </span>
      }
    >
      {movimientosBanco.length === 1 ? (
        (() => {
          const m = movimientosBanco[0];
          return (
            <>
              <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>{m.concepto_original || "Movimiento sin concepto"}</div>
              <div>Fecha: {m.fecha_operacion ? formatoFecha(m.fecha_operacion) : "—"}</div>
              <div>Importe: {m.importe != null ? formatoImporte(m.importe) : "—"}</div>
            </>
          );
        })()
      ) : (
        <>
          <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>{movimientosBanco.length} movimientos bancarios vinculados</div>
          {movimientosBanco.map((m, i) => (
            <div
              key={m.id}
              style={{
                marginBottom: i < movimientosBanco.length - 1 ? "0.5rem" : 0,
                paddingBottom: i < movimientosBanco.length - 1 ? "0.5rem" : 0,
                borderBottom: i < movimientosBanco.length - 1 ? "1px solid #f1f5f9" : "none",
              }}
            >
              <div style={{ fontWeight: 600 }}>{m.concepto_original || "Movimiento sin concepto"}</div>
              <div>
                {m.fecha_operacion ? formatoFecha(m.fecha_operacion) : "—"} · {m.importe != null ? formatoImporte(m.importe) : "—"}
              </div>
            </div>
          ))}
        </>
      )}
    </MatchTooltipWrapper>
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

interface DetalleConciliacion {
  sincronizados: { documento: string; proveedorNombre: string; movimientoBancoId: string }[];
  conciliados: {
    documento: string;
    proveedorNombre: string;
    nombrePasajero: string;
    importe: number;
    fechaVencto: string;
    referenciaProvCte: string;
    documentoCobroPago: string;
    movimientoConcepto: string;
    movimientoFecha: string;
    movimientoImporte: number;
  }[];
  revisados: {
    id: string;
    tipo: "pago" | "cobro";
    documento: string;
    proveedorNombre: string;
    nombrePasajero: string;
    importe: number;
    fechaVencto: string;
    referenciaProvCte: string;
    documentoCobroPago: string;
    candidatos: { movimientoBancoId: string; movimientoConcepto: string; movimientoFecha: string; movimientoImporte: number }[];
  }[];
}

function DetalleConciliacionModal({
  detalle,
  onClose,
  onVinculado,
}: {
  detalle: DetalleConciliacion;
  onClose: () => void;
  onVinculado: () => void;
}) {
  const [tab, setTab] = useState<"sincronizados" | "conciliados" | "revisados">(
    detalle.revisados.length > 0 ? "revisados" : detalle.conciliados.length > 0 ? "conciliados" : "sincronizados"
  );
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);
  const [idsVinculados, setIdsVinculados] = useState<Set<string>>(new Set());

  const handleVincular = async (r: DetalleConciliacion["revisados"][number], movimientoBancoId: string) => {
    setVinculandoId(`${r.id}-${movimientoBancoId}`);
    try {
      await vincularOfiDesdeRevision(r.tipo, r.id, movimientoBancoId);
      setIdsVinculados((prev) => new Set(prev).add(r.id));
      onVinculado();
    } catch (e: any) {
      alert(e?.message || "Error al vincular.");
    } finally {
      setVinculandoId(null);
    }
  };

  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: "revisados", label: "Sin desambiguar", count: detalle.revisados.length },
    { key: "conciliados", label: "Conciliados", count: detalle.conciliados.length },
    { key: "sincronizados", label: "Sincronizados", count: detalle.sincronizados.length },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ background: "#fff", borderRadius: "0.6rem", padding: "1.25rem", width: "min(720px, 92vw)", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Detalle de la conciliación</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "1.25rem", borderBottom: "1px solid #e2e8f0", marginBottom: "1rem" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "0.5rem 0.1rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: tab === t.key ? "#334155" : "#94a3b8",
                background: "none",
                border: "none",
                borderBottom: tab === t.key ? "2px solid #334155" : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {tab === "revisados" && (
          detalle.revisados.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Ninguno.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {detalle.revisados.map((r, i) => {
                const yaVinculado = idsVinculados.has(r.id);
                return (
                  <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.7rem 0.9rem", opacity: yaVinculado ? 0.5 : 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>
                      {r.proveedorNombre} · {formatoImporte(r.importe)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.4rem" }}>
                      Documento: {r.documento} · Fec. Vcto: {r.fechaVencto || "—"} · LOC: {r.documentoCobroPago || "—"} · Expediente: {r.referenciaProvCte || "—"}
                    </div>
                    {r.nombrePasajero && (
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Pasajero: {r.nombrePasajero}</div>
                    )}
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.candidatos.length} movimientos bancarios candidatos:</div>
                    <ul style={{ margin: "0.3rem 0 0", paddingLeft: 0, listStyle: "none", fontSize: "0.75rem", color: "#334155" }}>
                      {r.candidatos.map((c, j) => (
                        <li key={j} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.15rem 0" }}>
                          <span>
                            {formatoFecha(c.movimientoFecha)} · {formatoImporte(c.movimientoImporte)} · {c.movimientoConcepto}
                          </span>
                          {!yaVinculado && (
                            <button
                              onClick={() => handleVincular(r, c.movimientoBancoId)}
                              disabled={vinculandoId === `${r.id}-${c.movimientoBancoId}`}
                              title="Vincular a este movimiento"
                              style={{ display: "inline-flex", color: "#15803d", background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                            >
                              <Link2 size={14} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "conciliados" && (
          detalle.conciliados.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Ninguno.</p>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden" }}>
              {detalle.conciliados.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0.6rem 0.8rem",
                    borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "center",
                    fontSize: "0.8rem",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#334155" }}>{c.proveedorNombre} · {c.documento}</div>
                    <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                      Fec. Vcto: {c.fechaVencto || "—"} · LOC: {c.documentoCobroPago || "—"} · Expediente: {c.referenciaProvCte || "—"}
                    </div>
                    {c.nombrePasajero && (
                      <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Pasajero: {c.nombrePasajero}</div>
                    )}
                    <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                      → {formatoFecha(c.movimientoFecha)} · {c.movimientoConcepto}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>{formatoImporte(c.importe)}</div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "sincronizados" && (
          detalle.sincronizados.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Ninguno.</p>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden" }}>
              {detalle.sincronizados.map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0.6rem 0.8rem",
                    borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                    fontSize: "0.8rem",
                    color: "#334155",
                  }}
                >
                  {s.proveedorNombre} · {s.documento}
                </div>
              ))}
            </div>
          )
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
  // Intentar extraer prefijo de los primeros 3 caracteres (ej: "001260182")
  let prefijo = referenciaProvCte.slice(0, 3);
  if (AGENCIA_POR_PREFIJO[prefijo]) return AGENCIA_POR_PREFIJO[prefijo];

  // Si no coincide, buscar el patrón en cualquier parte (ej: "Exp.002260182" → "002")
  const match = referenciaProvCte.match(/[^0-9]*(001|002|003)[0-9]/);
  if (match) {
    prefijo = match[1];
    return AGENCIA_POR_PREFIJO[prefijo] ?? null;
  }

  return null;
}

export default function MovimientosOfiviajePage() {
  const [pagos, setPagos] = useState<any[]>([]);
  const [cobros, setCobros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [conciliando, setConciliando] = useState(false);
  const [idsPagosAmbiguos, setIdsPagosAmbiguos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<string | null>(null);
  const [detalleConciliacion, setDetalleConciliacion] = useState<DetalleConciliacion | null>(null);
  const [mostrarDetalleConciliacion, setMostrarDetalleConciliacion] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroConciliado, setFiltroConciliado] = useState<"todos" | "conciliados" | "pendientes">("todos");
  const [filtroCuentas, setFiltroCuentas] = useState<string[]>([]);
  const [cuentasDisponibles, setCuentasDisponibles] = useState<{ numero: string; alias: string }[]>([]);
  const [objetivoBusqueda, setObjetivoBusqueda] = useState<{ tipo: "pago" | "cobro"; registro: any } | null>(null);
  const cargar = () => {
    return Promise.all([getOfiPagos(), getOfiCobros()]).then(([p, c]) => {
      setPagos(p as any[]);
      setCobros(c as any[]);

      // Extraer cuentas bancarias únicas
      const cuentasSet = new Set<string>();
      [...(p as any[]), ...(c as any[])].forEach(item => {
        if (item.cuenta_tesoreria) cuentasSet.add(item.cuenta_tesoreria);
      });

      const cuentas = Array.from(cuentasSet).map(numero => ({
        numero,
        alias: numero // Por ahora usar el número como alias
      })).sort((a, b) => a.numero.localeCompare(b.numero));

      setCuentasDisponibles(cuentas);
    });
  };

  useEffect(() => {
    cargar().finally(() => setLoading(false));
  }, []);

  const handleDescargar = async () => {
    setDescargando(true);
    setResultado(null);
    try {
      const r = await descargarMovimientosOFISinDuplicar();
      if (r.success) {
        const informe = `✓ Descarga completada sin duplicar\n\n📊 Registros nuevos encontrados:\n• Pagos: ${r.pagosNuevos || 0}\n• Cobros: ${r.cobrosNuevos || 0}\n\nTotal nuevos: ${(r.pagosNuevos || 0) + (r.cobrosNuevos || 0)}`;
        setResultado(informe);
        await cargar();
      } else {
        setResultado(`Error: ${r.mensaje}`);
      }
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
      if (filtroCuentas.length > 0) {
        if (!p.cuenta_tesoreria || !filtroCuentas.includes(p.cuenta_tesoreria)) return false;
      }
      if (!q) return true;
      return [p.documento, p.referencia_prov_cte, p.proveedor_nombre, p.nombre_pasajero]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [pagos, busqueda, filtroConciliado, filtroCuentas]);

  const cobrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cobros.filter((c) => {
      if (!pasaFiltroConciliado(c.movimiento_banco_id)) return false;
      if (filtroCuentas.length > 0) {
        if (!c.cuenta_tesoreria || !filtroCuentas.includes(c.cuenta_tesoreria)) return false;
      }
      if (!q) return true;
      return [c.factura, c.nombre_pagador, c.concepto_movimiento]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [cobros, busqueda, filtroConciliado, filtroCuentas]);


  const handleConciliar = async () => {
    setConciliando(true);
    setResultado(null);
    setDetalleConciliacion(null);
    try {
      const [rPagos, rCobros] = await Promise.all([conciliarDesdeOfiPagos(), conciliarDesdeOfiCobros()]);
      setResultado(
        `${rPagos.pagosSincronizados} ya conciliados sincronizados · ${rPagos.pagosConciliados + rCobros.cobrosConciliados} conciliados (${rPagos.pagosConciliados} pagos, ${rCobros.cobrosConciliados} cobros) · ${rPagos.pagosRevisados + rCobros.cobrosRevisados} sin desambiguar (revisión manual)`
      );
      setIdsPagosAmbiguos(new Set([...rPagos.idsPagosRevisados, ...rCobros.idsCobrosRevisados]));
      setDetalleConciliacion({
        sincronizados: rPagos.detalleSincronizados,
        conciliados: [...rPagos.detalleConciliados, ...rCobros.detalleConciliados],
        revisados: [...rPagos.detalleRevisados, ...rCobros.detalleRevisados],
      });
      setMostrarDetalleConciliacion(true);
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
        <div
          style={{
            fontSize: "0.85rem",
            color: resultado.startsWith("Error") ? "#dc2626" : "#15803d",
            marginBottom: "1rem",
            padding: "0.75rem",
            backgroundColor: resultado.startsWith("Error") ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${resultado.startsWith("Error") ? "#fecaca" : "#bbf7d0"}`,
            borderRadius: "0.375rem",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
          }}
        >
          {resultado}
          {detalleConciliacion && (
            <button
              onClick={() => setMostrarDetalleConciliacion(true)}
              style={{ marginLeft: "0.6rem", marginTop: "0.5rem", fontSize: "0.8rem", color: "#334155", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 }}
            >
              Ver detalle
            </button>
          )}
        </div>
      )}

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
        <div style={{ width: 220, flex: "0 0 auto" }}>
          <MultiSelectDropdown
            options={cuentasDisponibles.map(c => c.numero)}
            selected={filtroCuentas}
            onChange={setFiltroCuentas}
            placeholder="Todas las cuentas"
          />
        </div>
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
                { header: "Expediente", width: "1%", render: (p) => p.referencia_prov_cte ?? "—" },
                { header: "Proveedor", render: (p) => p.proveedor_nombre ?? "—" },
                { header: "Pasajero", render: (p) => p.nombre_pasajero ?? "—" },
                { header: "LOC", width: "1%", render: (p) => p.documento_cobro_pago ?? "—" },
                { header: "Documento", width: "1%", render: (p) => p.documento ?? "—" },
                { header: "Importe", render: (p) => formatoImporte(p.importe_pendiente), align: "right" },
                {
                  header: "Conciliado",
                  width: "1%",
                  render: (p) => (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <ConciliadoCell
                        movimientosBanco={p.movimientos_banco ?? (p.movimiento_banco ? [p.movimiento_banco] : [])}
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
                      movimientosBanco={c.movimientos_banco ?? (c.movimiento_banco ? [c.movimiento_banco] : [])}
                      onBuscar={() => setObjetivoBusqueda({ tipo: "cobro", registro: c })}
                    />
                  ),
                },
              ]}
            />
          </section>
        </>
      )}

      {objetivoBusqueda && (
        <BuscarMovimientoModal
          objetivo={objetivoBusqueda}
          onClose={() => setObjetivoBusqueda(null)}
          onVinculado={cargar}
        />
      )}

      {mostrarDetalleConciliacion && detalleConciliacion && (
        <DetalleConciliacionModal detalle={detalleConciliacion} onClose={() => setMostrarDetalleConciliacion(false)} onVinculado={cargar} />
      )}
    </div>
  );
}
