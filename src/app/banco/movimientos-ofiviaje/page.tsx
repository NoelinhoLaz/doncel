"use client";

import { useEffect, useState, useMemo } from "react";
import NextLink from "next/link";
import { ArrowLeft, ArrowLeftRight, Download, Filter, Link2, Search, X } from "lucide-react";
import { descargarMovimientosOfiviaje, descargarMovimientosOFISinDuplicar, getOfiPagos, getOfiCobros, buscarCandidatosMovimientoBanco, vincularManualmenteMovimientoBanco, conciliarDesdeOfiPagos, conciliarDesdeOfiCobros, vincularOfiDesdeRevision } from "@/actions/banco";
import { RefreshCw } from "lucide-react";
import { MatchTooltipWrapper } from "@/components/movimientos/MatchTooltipWrapper";
import { Icons } from "@/lib/icons";
import listStyles from "../../expedientes/page.module.css";

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

export interface FiltrosOfi {
  cuentas: string[];
  proveedor: string;
  fechaDesde: string;
  fechaHasta: string;
  importeMin: string;
  importeMax: string;
  estado: "todos" | "conciliados" | "pendientes";
}

const FILTROS_OFI_VACIOS: FiltrosOfi = {
  cuentas: [],
  proveedor: "",
  fechaDesde: "",
  fechaHasta: "",
  importeMin: "",
  importeMax: "",
  estado: "todos",
};

function hayFiltrosActivos(f: FiltrosOfi): boolean {
  return (
    f.cuentas.length > 0 ||
    !!f.proveedor ||
    !!f.fechaDesde ||
    !!f.fechaHasta ||
    !!f.importeMin ||
    !!f.importeMax ||
    f.estado !== "todos"
  );
}

const inputFiltroStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  padding: "0.3rem 0.4rem",
  border: "1px solid #e2e8f0",
  borderRadius: "0.3rem",
  width: "100%",
  boxSizing: "border-box",
};

/**
 * Sidebar de filtros al estilo de /banco (mismo layout de 240px + estilos
 * inline). Cada listado (Pagos / Cobros) instancia su propia copia con
 * estado independiente — mostrarProveedor se desactiva en Cobros porque ahí
 * el campo equivalente es "pagador", no "proveedor".
 */
function PanelFiltrosOfi({
  filtros,
  onChange,
  onClose,
  mostrarProveedor,
  cuentasDisponibles,
}: {
  filtros: FiltrosOfi;
  onChange: (f: FiltrosOfi) => void;
  onClose: () => void;
  mostrarProveedor: boolean;
  cuentasDisponibles: { numero: string; alias: string }[];
}) {
  const update = <K extends keyof FiltrosOfi>(key: K, value: FiltrosOfi[K]) => {
    onChange({ ...filtros, [key]: value });
  };

  const toggleCuenta = (numero: string) => {
    update("cuentas", filtros.cuentas.includes(numero) ? filtros.cuentas.filter((c) => c !== numero) : [...filtros.cuentas, numero]);
  };

  return (
    <div
      style={{
        width: "240px",
        minWidth: "240px",
        borderRight: "1px solid #e2e8f0",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        fontSize: "0.8rem",
        backgroundColor: "#fafbfc",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>Filtros</span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px", display: "flex", borderRadius: "4px" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Cuenta bancaria */}
      <div>
        <div style={{ fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Cuenta bancaria</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "150px", overflowY: "auto" }}>
          {cuentasDisponibles.length === 0 ? (
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Sin cuentas</span>
          ) : (
            cuentasDisponibles.map((c) => (
              <label key={c.numero} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.78rem" }}>
                <input
                  type="checkbox"
                  checked={filtros.cuentas.includes(c.numero)}
                  onChange={() => toggleCuenta(c.numero)}
                  style={{ accentColor: "var(--primary-color, #475569)" }}
                />
                {c.alias}
              </label>
            ))
          )}
        </div>
      </div>

      {/* Proveedor (solo Pagos) */}
      {mostrarProveedor && (
        <div>
          <div style={{ fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Proveedor</div>
          <input
            type="text"
            placeholder="Nombre del proveedor"
            value={filtros.proveedor}
            onChange={(e) => update("proveedor", e.target.value)}
            style={inputFiltroStyle}
          />
        </div>
      )}

      {/* Fecha */}
      <div>
        <div style={{ fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Fecha</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <input type="date" value={filtros.fechaDesde} onChange={(e) => update("fechaDesde", e.target.value)} style={inputFiltroStyle} />
          <span style={{ fontSize: "0.7rem", color: "#94a3b8", textAlign: "center" }}>hasta</span>
          <input type="date" value={filtros.fechaHasta} onChange={(e) => update("fechaHasta", e.target.value)} style={inputFiltroStyle} />
        </div>
      </div>

      {/* Importe */}
      <div>
        <div style={{ fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Importe (€)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <input type="number" placeholder="Desde" value={filtros.importeMin} onChange={(e) => update("importeMin", e.target.value)} style={inputFiltroStyle} />
          <span style={{ fontSize: "0.7rem", color: "#94a3b8", textAlign: "center" }}>hasta</span>
          <input type="number" placeholder="Hasta" value={filtros.importeMax} onChange={(e) => update("importeMax", e.target.value)} style={inputFiltroStyle} />
        </div>
      </div>

      {/* Estado */}
      <div>
        <div style={{ fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>Estado</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {[
            { value: "todos", label: "Todos" },
            { value: "conciliados", label: "Conciliados" },
            { value: "pendientes", label: "Pendientes" },
          ].map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.78rem" }}>
              <input
                type="radio"
                name="estado-ofi"
                checked={filtros.estado === opt.value}
                onChange={() => update("estado", opt.value as FiltrosOfi["estado"])}
                style={{ accentColor: "var(--primary-color, #475569)" }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Limpiar filtros */}
      {hayFiltrosActivos(filtros) && (
        <button
          onClick={() => onChange({ ...FILTROS_OFI_VACIOS })}
          style={{
            width: "100%",
            padding: "0.4rem",
            backgroundColor: "#f1f5f9",
            color: "#475569",
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            fontWeight: 600,
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          Limpiar filtros
        </button>
      )}
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
  // Búsqueda y filtros independientes por listado: pagos y cobros no
  // comparten estado, cada uno con su propio panel de filtros y buscador.
  const [busquedaPagos, setBusquedaPagos] = useState("");
  const [busquedaCobros, setBusquedaCobros] = useState("");
  const [filtrosPagos, setFiltrosPagos] = useState<FiltrosOfi>({ ...FILTROS_OFI_VACIOS });
  const [filtrosCobros, setFiltrosCobros] = useState<FiltrosOfi>({ ...FILTROS_OFI_VACIOS });
  const [mostrarFiltrosPagos, setMostrarFiltrosPagos] = useState(false);
  const [mostrarFiltrosCobros, setMostrarFiltrosCobros] = useState(false);
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

  const pasaFiltrosComunes = (
    f: FiltrosOfi,
    datos: { movimientoBancoId: string | null; cuentaTesoreria: string | null; fecha: string | null; importe: number }
  ) => {
    if (f.estado === "conciliados" && !datos.movimientoBancoId) return false;
    if (f.estado === "pendientes" && datos.movimientoBancoId) return false;
    if (f.cuentas.length > 0 && (!datos.cuentaTesoreria || !f.cuentas.includes(datos.cuentaTesoreria))) return false;
    if (f.fechaDesde && (!datos.fecha || datos.fecha < f.fechaDesde)) return false;
    if (f.fechaHasta && (!datos.fecha || datos.fecha > f.fechaHasta)) return false;
    if (f.importeMin && Math.abs(datos.importe) < Number(f.importeMin)) return false;
    if (f.importeMax && Math.abs(datos.importe) > Number(f.importeMax)) return false;
    return true;
  };

  const pagosFiltrados = useMemo(() => {
    const q = busquedaPagos.trim().toLowerCase();
    const proveedorQ = filtrosPagos.proveedor.trim().toLowerCase();
    return pagos.filter((p) => {
      if (!pasaFiltrosComunes(filtrosPagos, { movimientoBancoId: p.movimiento_banco_id, cuentaTesoreria: p.cuenta_tesoreria, fecha: p.fecha_doc, importe: Number(p.importe_pendiente || 0) })) return false;
      if (proveedorQ && !String(p.proveedor_nombre ?? "").toLowerCase().includes(proveedorQ)) return false;
      if (!q) return true;
      return [p.documento, p.referencia_prov_cte, p.proveedor_nombre, p.nombre_pasajero]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [pagos, busquedaPagos, filtrosPagos]);

  const cobrosFiltrados = useMemo(() => {
    const q = busquedaCobros.trim().toLowerCase();
    return cobros.filter((c) => {
      if (!pasaFiltrosComunes(filtrosCobros, { movimientoBancoId: c.movimiento_banco_id, cuentaTesoreria: c.cuenta_tesoreria, fecha: c.fecha_movimiento, importe: Number(c.importe_cobro || 0) })) return false;
      if (!q) return true;
      return [c.factura, c.nombre_pagador, c.concepto_movimiento]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [cobros, busquedaCobros, filtrosCobros]);


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
          <NextLink
            href="/banco/historial-procesos"
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
              textDecoration: "none",
            }}
          >
            <Icons.History size={16} />
            Historial de procesos
          </NextLink>
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

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Cargando…</p>
      ) : (
        <>
          <section
            style={{
              marginBottom: "2rem",
              background: "#fff",
              borderRadius: "0.75rem",
              border: "1px solid #f1f5f9",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
              overflow: "hidden",
            }}
          >
            <div className={listStyles.listHeaderTop}>
              <div className={listStyles.listTitleWrapper}>
                <Icons.Landmark size={18} className={listStyles.titleIcon} />
                <h2 className={listStyles.listTitle}>Pagos ({pagosFiltrados.length})</h2>
              </div>
              <div className={listStyles.actionsWrapper}>
                <div className={listStyles.searchWrapper}>
                  <Search size={16} className={listStyles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Buscar por documento, proveedor, pasajero..."
                    className={listStyles.searchInput}
                    value={busquedaPagos}
                    onChange={(e) => setBusquedaPagos(e.target.value)}
                  />
                </div>
                <button
                  className={`${listStyles.actionIconButton} ${mostrarFiltrosPagos || hayFiltrosActivos(filtrosPagos) ? listStyles.activeAction : ""}`}
                  title="Filtrar"
                  onClick={() => setMostrarFiltrosPagos((v) => !v)}
                >
                  <Filter size={18} />
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              {mostrarFiltrosPagos && (
                <PanelFiltrosOfi
                  filtros={filtrosPagos}
                  onChange={setFiltrosPagos}
                  onClose={() => setMostrarFiltrosPagos(false)}
                  mostrarProveedor
                  cuentasDisponibles={cuentasDisponibles}
                />
              )}
              <div style={{ flex: 1, minWidth: 0, padding: "1rem 1.25rem" }}>
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
              </div>
            </div>
          </section>

          <section
            style={{
              background: "#fff",
              borderRadius: "0.75rem",
              border: "1px solid #f1f5f9",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
              overflow: "hidden",
            }}
          >
            <div className={listStyles.listHeaderTop}>
              <div className={listStyles.listTitleWrapper}>
                <ArrowLeftRight size={18} className={listStyles.titleIcon} />
                <h2 className={listStyles.listTitle}>Cobros ({cobrosFiltrados.length})</h2>
              </div>
              <div className={listStyles.actionsWrapper}>
                <div className={listStyles.searchWrapper}>
                  <Search size={16} className={listStyles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Buscar por factura, pagador, concepto..."
                    className={listStyles.searchInput}
                    value={busquedaCobros}
                    onChange={(e) => setBusquedaCobros(e.target.value)}
                  />
                </div>
                <button
                  className={`${listStyles.actionIconButton} ${mostrarFiltrosCobros || hayFiltrosActivos(filtrosCobros) ? listStyles.activeAction : ""}`}
                  title="Filtrar"
                  onClick={() => setMostrarFiltrosCobros((v) => !v)}
                >
                  <Filter size={18} />
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              {mostrarFiltrosCobros && (
                <PanelFiltrosOfi
                  filtros={filtrosCobros}
                  onChange={setFiltrosCobros}
                  onClose={() => setMostrarFiltrosCobros(false)}
                  mostrarProveedor={false}
                  cuentasDisponibles={cuentasDisponibles}
                />
              )}
              <div style={{ flex: 1, minWidth: 0, padding: "1rem 1.25rem" }}>
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
              </div>
            </div>
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
