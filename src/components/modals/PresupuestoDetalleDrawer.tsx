"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Calendar, MapPin, DollarSign, Users, Briefcase, FileText, Edit } from "lucide-react";
import { getPresupuestoDetalle } from "@/actions/presupuestos";
import { useRouter } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  presupuestoId: string;
}

const PREFERENCIAS_LABEL_MAP: Record<string, string> = {
  viajaron_ano_pasado: "viajaron campaña anterior?",
  alojamiento: "Alojamiento",
  transporte: "Transporte",
  enfoque: "Enfoque del viaje",
  programa_destino: "Programa / Destino",
  viaje_anterior: "Viaje anterior",
  aconsejamos_destino: "¿Aconsejamos destino?",
};

function Chip({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "6px",
      fontSize: "0.72rem",
      fontWeight: 500,
      background: active ? "#f8fafc" : "#f1f5f9",
      color: active ? "#334155" : "#64748b",
      border: "1px solid #e2e8f0",
    }}>
      {children}
    </span>
  );
}

function renderPreferenciaValue(key: string, val: any) {
  if (val === null || val === undefined) return <span style={{ color: "#cbd5e1" }}>—</span>;

  const foodRegimes: Record<string, string> = {
    pc: "Pensión Completa (PC)",
    mp: "Media Pensión (MP)",
    ad: "Alojamiento y Desayuno (AD)",
    sa: "Solo Alojamiento (SA)",
  };

  if (typeof val === "boolean") {
    return <Chip active={val}>{val ? "Sí" : "No"}</Chip>;
  }

  if (typeof val === "string") {
    return <Chip>{val}</Chip>;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return <span style={{ color: "#cbd5e1" }}>—</span>;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {val.map((item, idx) => (
          <Chip key={idx}>{foodRegimes[String(item).toLowerCase()] ?? String(item)}</Chip>
        ))}
      </div>
    );
  }

  if (typeof val === "object") {
    const chips: React.ReactNode[] = [];
    
    if (key === "alojamiento") {
      if (val.tipo) {
        const tipos = Array.isArray(val.tipo) ? val.tipo : [val.tipo];
        tipos.forEach((t: any) => chips.push(<Chip key={`tipo-${t}`}>{t}</Chip>));
      }
      if (val.categoria_minima) {
        const cats = Array.isArray(val.categoria_minima) ? val.categoria_minima : [val.categoria_minima];
        cats.forEach((c: any) => chips.push(<Chip key={`cat-${c}`}>{c}</Chip>));
      }
      if (val.ubicacion) {
        chips.push(<Chip key={`ub-${val.ubicacion}`}>{val.ubicacion}</Chip>);
      }
      if (val.preferencia_habitaciones) {
        const prefs = Array.isArray(val.preferencia_habitaciones) ? val.preferencia_habitaciones : [val.preferencia_habitaciones];
        prefs.forEach((p: any) => chips.push(<Chip key={`pref-${p}`}>{p}</Chip>));
      }
    }
    else if (key === "transporte") {
      if (val.requiere_vuelo) chips.push(<Chip key="vuelo">Vuelo</Chip>);
      if (val.requiere_tren) chips.push(<Chip key="tren">Tren</Chip>);
      if (val.requiere_bus_origen) chips.push(<Chip key="bus">Bus en Origen</Chip>);
      if (val.tipo_aerolinea) chips.push(<Chip key="aero">{val.tipo_aerolinea}</Chip>);
    }
    else if (key === "programa_destino") {
      if (val.conoce_destino) chips.push(<Chip key="conoce">Conoce destino</Chip>);
      if (val.requiere_monitores_24h) chips.push(<Chip key="monitores">Monitores 24h</Chip>);
      if (val.regimen_comidas) {
        const regimes = Array.isArray(val.regimen_comidas) ? val.regimen_comidas : [val.regimen_comidas];
        regimes.forEach((r: any) => chips.push(<Chip key={`reg-${r}`}>{foodRegimes[String(r).toLowerCase()] ?? r}</Chip>));
      }
      if (val.visitas_incluidas) {
        const visitas = Array.isArray(val.visitas_incluidas) ? val.visitas_incluidas : [val.visitas_incluidas];
        visitas.forEach((v: any) => chips.push(<Chip key={`vis-${v}`}>{v}</Chip>));
      }
    }
    else if (key === "viaje_anterior") {
      if (val.destino) chips.push(<Chip key="prev-dest">{val.destino}</Chip>);
      if (val.agencia) chips.push(<Chip key="prev-agency">{val.agencia}</Chip>);
      if (val.valoracion) chips.push(<Chip key="prev-val">Valoración: {val.valoracion}</Chip>);
      if (val.excursiones) chips.push(<Chip key="prev-exc">{val.excursiones}</Chip>);
    }
    else {
      Object.entries(val).forEach(([k, v]) => {
        if (v === true) {
          chips.push(<Chip key={k}>{k.replace(/_/g, " ")}</Chip>);
        } else if (v && typeof v !== "object") {
          chips.push(<Chip key={k}>{k.replace(/_/g, " ")}: {String(v)}</Chip>);
        }
      });
    }

    if (chips.length === 0) return <span style={{ color: "#cbd5e1" }}>—</span>;
    return <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{chips}</div>;
  }

  return <span>{String(val)}</span>;
}

export function PresupuestoDetalleDrawer({ isOpen, onClose, presupuestoId }: Props) {
  const router = useRouter();
  const [presupuesto, setPresupuesto] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !presupuestoId) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getPresupuestoDetalle(presupuestoId);
        if (res.success && res.data) {
          setPresupuesto(res.data);
        } else {
          setError(res.error || "No se pudo cargar el presupuesto.");
        }
      } catch (err: any) {
        setError(err.message || "Error al cargar.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isOpen, presupuestoId]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 99998,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          maxWidth: "640px",
          backgroundColor: "#ffffff",
          boxShadow: "-10px 0 30px -5px rgba(15, 23, 42, 0.15)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          animation: "presupuestoDrawerIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          fontFamily: "inherit",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={18} style={{ color: "var(--primary-color, #4f46e5)" }} />
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>Detalle de Presupuesto</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {presupuesto && (
              <button
                onClick={() => {
                  router.push(`/presupuestos?edit=${presupuesto.id}`);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--primary-color, #4f46e5)",
                  background: "color-mix(in srgb, var(--primary-color, #4f46e5) 10%, white)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                title="Editar presupuesto"
              >
                <Edit size={13} />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", borderRadius: "6px", display: "flex" }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f1f5f9"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "10px" }}>
              <Loader2 size={24} style={{ animation: "spin 0.8s linear infinite", color: "var(--primary-color, #4f46e5)" }} />
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Cargando datos del presupuesto...</span>
            </div>
          ) : error ? (
            <div style={{ padding: "1rem", borderRadius: "8px", backgroundColor: "#fef2f2", color: "#b91c1c", fontSize: "0.85rem" }}>
              {error}
            </div>
          ) : presupuesto ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Trip Title & Status */}
              <div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem 0" }}>
                  {presupuesto.titulo_viaje}
                </h4>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ padding: "3px 8px", fontSize: "0.68rem", fontWeight: 700, borderRadius: "99px", textTransform: "uppercase", background: "#e0f2fe", color: "#0369a1" }}>
                    {presupuesto.tipo_presupuesto}
                  </span>
                  <span style={{ padding: "3px 8px", fontSize: "0.68rem", fontWeight: 700, borderRadius: "99px", textTransform: "uppercase", background: "#f1f5f9", color: "#475569" }}>
                    {presupuesto.estado}
                  </span>
                </div>
              </div>

              {/* Main Estimates Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                <div>
                  <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Plazas Estimadas</label>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Users size={14} style={{ color: "#64748b" }} />
                    {presupuesto.plazas_estimadas} viajeros
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Noches Estimadas</label>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Calendar size={14} style={{ color: "#64748b" }} />
                    {presupuesto.noches_estimadas ?? "—"} noches
                  </div>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>PVP Estimado</label>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", display: "flex", alignItems: "center", gap: "4px" }}>
                    <DollarSign size={14} style={{ color: "#10b981" }} />
                    {presupuesto.pvp_estimado ? `${presupuesto.pvp_estimado} €` : "—"}
                  </div>
                </div>
              </div>

              {/* Client Info */}
              {presupuesto.contabilidad_entidades && (
                <div>
                  <h5 style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.35rem", marginBottom: "0.5rem" }}>Cliente / Entidad</h5>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>{presupuesto.contabilidad_entidades.nombre}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
                    {presupuesto.contabilidad_entidades.email && <div>✉ {presupuesto.contabilidad_entidades.email}</div>}
                    {presupuesto.contabilidad_entidades.telefono && <div style={{ marginTop: "2px" }}>📞 {presupuesto.contabilidad_entidades.telefono}</div>}
                  </div>
                </div>
              )}

              {/* Contact Person Details */}
              {(() => {
                const principal = (presupuesto.operativa_presupuesto_contactos || []).find((c: any) => c.es_principal) || (presupuesto.operativa_presupuesto_contactos || [])[0];
                if (!principal) return null;
                return (
                  <div>
                    <h5 style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.35rem", marginBottom: "0.5rem" }}>Persona de Contacto</h5>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                      {principal.nombre} {principal.apellidos || ""}
                      {principal.cargo && <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 400, marginLeft: "6px" }}>({principal.cargo})</span>}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
                      {principal.email && <div>✉ {principal.email}</div>}
                      {principal.telefono && <div style={{ marginTop: "2px" }}>📞 {principal.telefono}</div>}
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              {presupuesto.notas_iniciales && (
                <div>
                  <h5 style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.35rem", marginBottom: "0.5rem" }}>Notas Iniciales</h5>
                  <p style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.5, margin: 0, backgroundColor: "#fafafa", padding: "0.75rem", borderRadius: "6px", border: "1px solid #f1f5f9", whiteSpace: "pre-wrap" }}>
                    {presupuesto.notas_iniciales}
                  </p>
                </div>
              )}

              {/* Preferences */}
              {presupuesto.preferencias && Object.keys(presupuesto.preferencias).length > 0 && (
                <div>
                  <h5 style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.35rem", marginBottom: "0.5rem" }}>Preferencias</h5>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {Object.entries(presupuesto.preferencias).map(([key, val]) => {
                      const label = PREFERENCIAS_LABEL_MAP[key] ?? key.replace(/_/g, " ");
                      return (
                        <div key={key} style={{ display: "flex", flexDirection: "column", gap: "4px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                          <span style={{ color: "#475569", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
                            {renderPreferenciaValue(key, val)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>
              Presupuesto no encontrado.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes presupuestoDrawerIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
