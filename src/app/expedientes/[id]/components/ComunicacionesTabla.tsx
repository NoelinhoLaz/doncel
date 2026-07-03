"use client";

import { useState } from "react";
import {
  Mail, Users, Backpack, Megaphone, FileText,
  Paperclip, CheckCheck, Check, AlertTriangle, Eye, ChevronRight, StickyNote,
  ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import { ComunicacionDB, DestinatarioTracking, WhatsAppIcon, formatBytes } from "./comunicaciones.types";

// ── Badge estado individual ───────────────────────────────────────────────────
export function EstadoDestBadge({ dest }: { dest: DestinatarioTracking }) {
  if (dest.estado === "error") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#fef2f2", color: "#dc2626", borderRadius: "20px", padding: "0.1rem 0.45rem", fontSize: "0.67rem", fontWeight: "700" }} title={dest.error_detalle || undefined}>
      <AlertTriangle size={10} /> Fallido
    </span>
  );
  if (dest.estado === "abierto") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#f0fdf4", color: "#15803d", borderRadius: "20px", padding: "0.1rem 0.45rem", fontSize: "0.67rem", fontWeight: "700" }}>
      <Eye size={10} /> Abierto
    </span>
  );
  if (dest.estado === "entregado") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#eff6ff", color: "#2563eb", borderRadius: "20px", padding: "0.1rem 0.45rem", fontSize: "0.67rem", fontWeight: "700" }}>
      <CheckCheck size={10} /> Entregado
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#f8fafc", color: "#64748b", borderRadius: "20px", padding: "0.1rem 0.45rem", fontSize: "0.67rem", fontWeight: "700" }}>
      <Check size={10} /> Enviado
    </span>
  );
}

// ── Badge estado agregado ─────────────────────────────────────────────────────
export function EstadoBadge({ item }: { item: ComunicacionDB }) {
  const dests = item.comunicaciones_destinatarios ?? [];
  const isWa = item.canal === "whatsapp";

  if (item.estado === "error") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "20px", padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: "700" }} title={item.error_detalle || undefined}>
      <AlertTriangle size={11} /> Fallido
    </span>
  );
  if (item.estado === "parcial") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: "20px", padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: "700" }}>
      <AlertTriangle size={11} /> Parcial
    </span>
  );

  // Check if it is a received email
  const isRecibido = item.destinatarios && item.destinatarios.some((d: any) => d.rol === "remitente");
  if (isRecibido) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "20px", padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: "700" }}>
        Recibido
      </span>
    );
  }

  if (dests.length > 0) {
    const abiertos = dests.filter((d) => d.estado === "abierto").length;
    const total = dests.length;
    if (abiertos === total) return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: "20px", padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: "700" }}>
        <Eye size={11} /> Abierto ({abiertos}/{total})
      </span>
    );
    if (abiertos > 0) return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", borderRadius: "20px", padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: "700" }}>
        <Eye size={11} /> Abierto ({abiertos}/{total})
      </span>
    );
    const entregados = dests.filter((d) => d.estado === "entregado").length;
    if (entregados > 0) return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: "20px", padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: "700" }}>
        <CheckCheck size={11} /> Entregado
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: "700" }}>
      {isWa ? <CheckCheck size={11} /> : <Check size={11} />} Enviado
    </span>
  );
}

// ── Tooltip destinatarios ─────────────────────────────────────────────────────
function DestinatariosCell({ item }: { item: ComunicacionDB }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const total = item.destinatarios.length;
  const primero = item.destinatarios[0];
  if (!primero) return <span style={{ color: "#94a3b8" }}>—</span>;

  const allPagadores = item.destinatarios.every((d) => d.rol === "pagador" || d.viajero_id?.startsWith("p-"));
  const allViajeros = item.destinatarios.every((d) => d.rol === "viajero" || d.viajero_id?.startsWith("v-"));

  const rolColor = allPagadores ? "#0369a1" : allViajeros ? "#15803d" : "#7c3aed";
  const rolBg = allPagadores ? "#e0f2fe" : allViajeros ? "#f0fdf4" : "#f5f3ff";
  const rolBorder = allPagadores ? "#bae6fd" : allViajeros ? "#bbf7d0" : "#ddd6fe";
  const rolLabel = allPagadores ? "Pagadores" : allViajeros ? "Viajeros" : "Mixto";
  const RolIcon = allPagadores ? Users : allViajeros ? Backpack : Megaphone;

  if (total === 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#0f172a" }}>{primero.nombre}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", background: rolBg, color: rolColor, border: `1px solid ${rolBorder}`, borderRadius: "20px", padding: "0.1rem 0.4rem", fontSize: "0.62rem", fontWeight: "700" }}>
            <RolIcon size={9} /> {allPagadores ? "Pagador" : "Viajero"}
          </span>
        </div>
        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{primero.email}</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: rolBg, color: rolColor, border: `1px solid ${rolBorder}`, borderRadius: "20px", padding: "0.2rem 0.6rem", fontSize: "0.73rem", fontWeight: "700" }}>
          <RolIcon size={11} /> {allPagadores || allViajeros ? `Todos los ${rolLabel}` : `${total} destinatarios`} ({total})
        </span>
      </div>
      {tooltipVisible && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#1e293b", color: "#f8fafc", borderRadius: "8px", padding: "0.6rem 0.85rem", fontSize: "0.72rem", lineHeight: "1.6", zIndex: 100, minWidth: "200px", maxWidth: "280px", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", pointerEvents: "none" }}>
          <div style={{ fontWeight: "700", marginBottom: "0.3rem", color: "#94a3b8", textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.05em" }}>{total} destinatarios</div>
          {item.destinatarios.slice(0, 10).map((d, i) => (
            <div key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {d.nombre}{d.email ? ` · ${d.email}` : ""}
            </div>
          ))}
          {total > 10 && <div style={{ color: "#64748b", marginTop: "0.2rem" }}>+{total - 10} más...</div>}
        </div>
      )}
    </div>
  );
}

// ── Fila expandible ───────────────────────────────────────────────────────────
export function FilaComunicacion({ item }: { item: ComunicacionDB }) {
  const [expandida, setExpandida] = useState(false);
  const fecha = new Date(item.created_at).toLocaleString("es-ES", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const tieneAdjuntos = item.adjuntos && item.adjuntos.length > 0;
  const esRecibido = item.destinatarios?.some((d: any) => d.rol === "remitente");

  return (
    <>
      <tr
        style={{ cursor: "pointer", transition: "background 0.1s" }}
        onClick={() => setExpandida((v) => !v)}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = expandida ? "#f8fafc" : ""; }}
      >
        <td style={{ width: "56px", paddingLeft: "1rem", paddingRight: "0.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {item.canal === "email" ? (
              <span title="Email" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "color-mix(in srgb, var(--primary-color,#475569), transparent 88%)", color: "var(--primary-color,#475569)", border: "1px solid color-mix(in srgb, var(--primary-color,#475569), transparent 70%)", borderRadius: "50%" }}>
                <Mail size={13} />
              </span>
            ) : item.canal === "nota" ? (
              <span title="Nota interna" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "#ede9fe", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "50%" }}>
                <StickyNote size={13} />
              </span>
            ) : (
              <span title="WhatsApp" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: "50%" }}>
                <WhatsAppIcon size={13} />
              </span>
            )}
            {item.canal !== "nota" && (
              esRecibido
                ? <ArrowDownLeft size={12} style={{ color: "#7c3aed", flexShrink: 0 }} />
                : <ArrowUpRight size={12} style={{ color: "#64748b", flexShrink: 0 }} />
            )}
          </div>
        </td>
        <td style={{ maxWidth: "200px", paddingLeft: "0.75rem", paddingRight: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
          <DestinatariosCell item={item} />
        </td>
        <td style={{ maxWidth: "260px" }}>
          <div style={{ fontWeight: "600", fontSize: "0.82rem", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.asunto || "(Sin asunto)"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.cuerpo.replace(/\n/g, " ")}
          </div>
        </td>
        <td style={{ width: "60px", textAlign: "center" }}>
          {tieneAdjuntos && (
            <span title={item.adjuntos.map((a) => a.nombre).join(", ")} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", color: "#64748b", fontSize: "0.72rem" }}>
              <Paperclip size={13} /> {item.adjuntos.length}
            </span>
          )}
        </td>
        <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem", color: "#475569" }}>{fecha}</td>
        <td style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.4rem" }}>
            <EstadoBadge item={item} />
            <ChevronRight size={13} style={{ color: "#94a3b8", transform: expandida ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
          </div>
        </td>
      </tr>

      {expandida && (
        <tr style={{ background: "#f8fafc" }}>
          <td colSpan={6} style={{ padding: "0 1rem 1.25rem 1rem", borderBottom: "2px solid #e2e8f0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingTop: "0.85rem" }}>

              {(item.comunicaciones_destinatarios?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.45rem" }}>
                    Trazabilidad por destinatario
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          {["Destinatario", "Rol", "Estado", "Abierto"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "0.45rem 0.75rem", fontWeight: "700", color: "#64748b", fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {item.comunicaciones_destinatarios!.map((dest, i) => {
                          const isPag = dest.rol === "pagador";
                          return (
                            <tr key={dest.id} style={{ borderBottom: i < item.comunicaciones_destinatarios!.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                              <td style={{ padding: "0.45rem 0.75rem" }}>
                                <div style={{ fontWeight: "600", color: "#0f172a" }}>{dest.nombre}</div>
                                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{dest.email}</div>
                              </td>
                              <td style={{ padding: "0.45rem 0.75rem" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: isPag ? "#e0f2fe" : "#f0fdf4", color: isPag ? "#0369a1" : "#15803d", borderRadius: "20px", padding: "0.1rem 0.45rem", fontSize: "0.67rem", fontWeight: "700" }}>
                                  {isPag ? <Users size={9} /> : <Backpack size={9} />}
                                  {isPag ? "Pagador" : "Viajero"}
                                </span>
                              </td>
                              <td style={{ padding: "0.45rem 0.75rem" }}>
                                <EstadoDestBadge dest={dest} />
                              </td>
                              <td style={{ padding: "0.45rem 0.75rem", fontSize: "0.72rem", color: "#475569" }}>
                                {dest.abierto_at
                                  ? new Date(dest.abierto_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                                  : <span style={{ color: "#cbd5e1" }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>Mensaje completo</div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#334155", lineHeight: "1.7", whiteSpace: "pre-wrap", maxHeight: "240px", overflowY: "auto" }}>
                  {item.cuerpo}
                </div>
              </div>

              {tieneAdjuntos && (
                <div>
                  <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>Adjuntos</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {item.adjuntos.map((a, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.3rem 0.65rem", fontSize: "0.75rem", color: "#475569" }}>
                        <FileText size={12} style={{ color: "#64748b" }} />
                        {a.nombre}
                        {a.tamanio ? <span style={{ color: "#94a3b8" }}>({formatBytes(a.tamanio)})</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.error_detalle && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "7px", padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#dc2626" }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span>{item.error_detalle}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ComunicacionesTabla({ items }: { items: ComunicacionDB[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#fafafa" }}>
          <th style={{ padding: "0.65rem 1rem", width: "40px" }}></th>
          <th style={{ padding: "0.65rem 0.75rem", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Destinatario</th>
          <th style={{ padding: "0.65rem 0.75rem", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Asunto / Mensaje</th>
          <th style={{ padding: "0.65rem 0.75rem", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Adjuntos</th>
          <th style={{ padding: "0.65rem 0.75rem", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Fecha</th>
          <th style={{ padding: "0.65rem 1rem", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Estado</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <FilaComunicacion key={item.id} item={item} />
        ))}
      </tbody>
    </table>
  );
}
