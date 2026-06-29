"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Mail, Users, Backpack, Megaphone, Search, ChevronDown, X,
  Upload, FileText, AlertTriangle, UserRound,
} from "lucide-react";
import { getViajerosByExpediente } from "@/actions/viajeros";
import { sendExpedienteEmail } from "@/actions/comunicaciones";
import { Contacto, FiltroGrupo, WhatsAppIcon, formatBytes } from "./comunicaciones.types.tsx";

interface Props {
  expedienteId: string;
  pagadores: any[];
  onClose: () => void;
  onSent: () => void;
}

export default function NuevaComunicacionModal({ expedienteId, pagadores, onClose, onSent }: Props) {
  const [canal, setCanal] = useState<"email" | "whatsapp">("email");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadingContactos, setLoadingContactos] = useState(false);
  const [listaPagadores, setListaPagadores] = useState<Contacto[]>([]);
  const [listaViajeros, setListaViajeros] = useState<Contacto[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pagadoresComoContacto = useMemo<Contacto[]>(() =>
    pagadores
      .map((p) => {
        const ent = p.contabilidad_entidades || {};
        return { key: `p-${p.entidad_id}`, rol: "pagador" as const, nombre: ent.nombre || "Sin nombre", email: ent.email || "", telefono: ent.telefono || "" };
      })
      .filter((c, idx, arr) => arr.findIndex((x) => x.key === c.key) === idx),
  [pagadores]);

  // Cargar viajeros al montar
  useEffect(() => {
    setLoadingContactos(true);
    setListaPagadores(pagadoresComoContacto);
    getViajerosByExpediente(expedienteId)
      .then((data) => {
        const viajeros: Contacto[] = (data || []).map((v: any) => {
          const ent = v.contabilidad_entidades || {};
          return { key: `v-${v.id}`, rol: "viajero" as const, nombre: ent.nombre || "Sin nombre", email: ent.email || "", telefono: ent.telefono || "" };
        });
        setListaViajeros(viajeros);
        setSeleccionados(new Set(pagadoresComoContacto.map((c) => c.key)));
      })
      .catch(() => setListaViajeros([]))
      .finally(() => setLoadingContactos(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId]);

  // Preselección al cambiar canal
  useEffect(() => {
    if (canal === "email") setSeleccionados(new Set(listaPagadores.map((c) => c.key)));
    else setSeleccionados(new Set(listaViajeros.map((c) => c.key)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const todosContactos = useMemo<Contacto[]>(() => [...listaPagadores, ...listaViajeros], [listaPagadores, listaViajeros]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    if (!q) return todosContactos;
    return todosContactos.filter((c) => {
      const byNombre = c.nombre.toLowerCase().includes(q);
      const byContacto = canal === "whatsapp" ? c.telefono.toLowerCase().includes(q) : c.email.toLowerCase().includes(q);
      return byNombre || byContacto;
    });
  }, [todosContactos, busqueda, canal]);

  const filtradosPagadores = useMemo(() => filtrados.filter((c) => c.rol === "pagador"), [filtrados]);
  const filtradosViajeros = useMemo(() => filtrados.filter((c) => c.rol === "viajero"), [filtrados]);

  const toggle = (key: string) => {
    setSeleccionados((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const aplicarGrupo = (grupo: FiltroGrupo) => {
    const keys = grupo === "pagadores" ? listaPagadores.map((c) => c.key) : grupo === "viajeros" ? listaViajeros.map((c) => c.key) : todosContactos.map((c) => c.key);
    setSeleccionados(new Set(keys));
    setBusqueda("");
  };

  const contactosSeleccionados = useMemo(() => todosContactos.filter((c) => seleccionados.has(c.key)), [todosContactos, seleccionados]);

  const grupoActivo = useMemo((): FiltroGrupo | null => {
    const sel = [...seleccionados];
    const pagKeys = new Set(listaPagadores.map((c) => c.key));
    const viaKeys = new Set(listaViajeros.map((c) => c.key));
    const allKeys = new Set(todosContactos.map((c) => c.key));
    if (sel.length === allKeys.size && sel.every((k) => allKeys.has(k))) return "todos";
    if (sel.length === pagKeys.size && sel.every((k) => pagKeys.has(k)) && pagKeys.size > 0) return "pagadores";
    if (sel.length === viaKeys.size && sel.every((k) => viaKeys.has(k)) && viaKeys.size > 0) return "viajeros";
    return null;
  }, [seleccionados, listaPagadores, listaViajeros, todosContactos]);

  const accentColor = canal === "whatsapp" ? "#25d366" : "var(--primary-color, #475569)";
  const accentBg = canal === "whatsapp" ? "color-mix(in srgb, #25d366, transparent 88%)" : "color-mix(in srgb, var(--primary-color, #475569), transparent 88%)";

  const handleEnviar = async () => {
    if (contactosSeleccionados.length === 0 || enviando) return;
    setEnviando(true);
    setEnvioError(null);

    const adjuntosB64 = await Promise.all(
      adjuntos.map((f) => new Promise<{ nombre: string; tamanio: number; contenido: string; tipo: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ nombre: f.name, tamanio: f.size, contenido: (reader.result as string).split(",")[1] || "", tipo: f.type });
        reader.onerror = reject;
        reader.readAsDataURL(f);
      }))
    );

    const res = await sendExpedienteEmail({
      expedienteId,
      asunto: asunto || "(Sin asunto)",
      cuerpo,
      destinatarios: contactosSeleccionados.map((c) => ({ viajero_id: c.key, nombre: c.nombre, email: c.email, telefono: c.telefono, rol: c.rol })),
      adjuntos: adjuntosB64,
      appBaseUrl: window.location.origin,
    });

    setEnviando(false);
    if (res.success) { onClose(); onSent(); }
    else setEnvioError(res.error || "Error desconocido.");
  };

  const ContactoRow = ({ c }: { c: Contacto }) => {
    const sel = seleccionados.has(c.key);
    const isPag = c.rol === "pagador";
    const contacto = canal === "whatsapp" ? c.telefono : c.email;
    return (
      <div
        onClick={() => toggle(c.key)}
        style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.85rem", cursor: "pointer", background: sel ? "color-mix(in srgb, var(--primary-color, #475569), transparent 92%)" : "transparent", borderBottom: "1px solid #f8fafc", transition: "background 0.1s" }}
        onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#f8fafc"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = sel ? "color-mix(in srgb, var(--primary-color, #475569), transparent 92%)" : "transparent"; }}
      >
        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: sel ? "var(--primary-color, #475569)" : isPag ? "#e0f2fe" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: sel ? "#fff" : isPag ? "#0369a1" : "#15803d" }}>
          {isPag ? <Users size={13} /> : <Backpack size={13} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.81rem", fontWeight: "600", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</div>
          {!contacto
            ? <div style={{ fontSize: "0.7rem", color: "#f59e0b", fontWeight: "600" }}>Sin {canal === "whatsapp" ? "teléfono" : "email"}</div>
            : <div style={{ fontSize: "0.7rem", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contacto}</div>}
        </div>
        <span style={{ fontSize: "0.62rem", fontWeight: "700", letterSpacing: "0.04em", padding: "0.15rem 0.45rem", borderRadius: "20px", background: isPag ? "#e0f2fe" : "#f0fdf4", color: isPag ? "#0369a1" : "#15803d", flexShrink: 0 }}>
          {isPag ? "PAGADOR" : "VIAJERO"}
        </span>
        <div style={{ width: "15px", height: "15px", borderRadius: "4px", border: `2px solid ${sel ? "var(--primary-color, #475569)" : "#cbd5e1"}`, background: sel ? "var(--primary-color, #475569)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}>
          {sel && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "580px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: accentBg, display: "flex", alignItems: "center", justifyContent: "center", color: accentColor, transition: "all 0.2s" }}>
              {canal === "whatsapp" ? <WhatsAppIcon size={18} /> : <Mail size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "700", color: "#0f172a" }}>Nueva comunicación</h3>
              <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                {canal === "email" ? "Enviar email desde tu cuenta de agente" : "Enviar mensaje de WhatsApp"}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

          {/* Canal */}
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>Canal</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["email", "whatsapp"] as const).map((c) => {
                const active = canal === c;
                const isWa = c === "whatsapp";
                const col = isWa ? "#25d366" : "var(--primary-color, #475569)";
                const bg = isWa ? "color-mix(in srgb, #25d366, transparent 88%)" : "color-mix(in srgb, var(--primary-color, #475569), transparent 88%)";
                return (
                  <button key={c} onClick={() => setCanal(c)} style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.45rem 1rem", borderRadius: "8px", border: `1.5px solid ${active ? col : "#e2e8f0"}`, background: active ? bg : "#fff", color: active ? col : "#64748b", fontWeight: active ? "700" : "500", fontSize: "0.82rem", cursor: "pointer", transition: "all 0.15s" }}>
                    {isWa ? <WhatsAppIcon size={14} /> : <Mail size={14} />}
                    {isWa ? "WhatsApp" : "Email"}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "#64748b", background: canal === "whatsapp" ? "#f0fdf4" : "color-mix(in srgb, var(--primary-color, #475569), transparent 93%)", border: `1px solid ${canal === "whatsapp" ? "#bbf7d0" : "color-mix(in srgb, var(--primary-color, #475569), transparent 75%)"}`, borderRadius: "7px", padding: "0.4rem 0.7rem" }}>
              {canal === "email" ? "Email ideal para contratos y facturas. Se preseleccionan los pagadores." : "WhatsApp ideal para avisos urgentes en ruta. Se preseleccionan los viajeros."}
            </div>
          </div>

          {/* Enviar a — píldoras rápidas */}
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>Enviar a</label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {([
                { id: "pagadores" as FiltroGrupo, Icon: Users, label: "Solo Pagadores", count: listaPagadores.length, desc: "Facturas, contratos, cobros" },
                { id: "viajeros" as FiltroGrupo, Icon: Backpack, label: "Solo Viajeros", count: listaViajeros.length, desc: "Itinerario, horarios, equipaje" },
                { id: "todos" as FiltroGrupo, Icon: Megaphone, label: "Todos", count: todosContactos.length, desc: "Emergencias, cancelaciones" },
              ] as const).map(({ id, Icon, label, count, desc }) => {
                const active = grupoActivo === id;
                return (
                  <button key={id} onClick={() => aplicarGrupo(id)} title={desc} disabled={loadingContactos}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.85rem", borderRadius: "20px", border: `1.5px solid ${active ? accentColor : "#e2e8f0"}`, background: active ? accentBg : "#f8fafc", color: active ? accentColor : "#475569", fontWeight: active ? "700" : "500", fontSize: "0.8rem", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap", opacity: loadingContactos ? 0.5 : 1 }}>
                    <Icon size={13} />
                    <span>{label}</span>
                    <span style={{ background: active ? accentColor : "#e2e8f0", color: active ? "#fff" : "#64748b", borderRadius: "10px", padding: "0 0.4rem", fontSize: "0.7rem", fontWeight: "700", minWidth: "18px", textAlign: "center" }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destinatarios */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Destinatarios
                {contactosSeleccionados.length > 0 && (
                  <span style={{ marginLeft: "0.4rem", background: accentBg, color: accentColor, borderRadius: "10px", padding: "0 0.4rem", fontSize: "0.7rem", fontWeight: "700" }}>{contactosSeleccionados.length}</span>
                )}
              </label>
              {contactosSeleccionados.length > 0 && (
                <button onClick={() => setSeleccionados(new Set())} style={{ fontSize: "0.7rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Limpiar</button>
              )}
            </div>

            {contactosSeleccionados.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem", maxHeight: "84px", overflowY: "auto" }}>
                {contactosSeleccionados.map((c) => {
                  const isPag = c.rol === "pagador";
                  return (
                    <span key={c.key} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: isPag ? "#e0f2fe" : "#f0fdf4", color: isPag ? "#0369a1" : "#15803d", border: `1px solid ${isPag ? "#bae6fd" : "#bbf7d0"}`, borderRadius: "20px", padding: "0.18rem 0.5rem 0.18rem 0.55rem", fontSize: "0.73rem", fontWeight: "600" }}>
                      {isPag ? <Users size={10} /> : <Backpack size={10} />}
                      <span>{c.nombre}</span>
                      <button onClick={() => toggle(c.key)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit", opacity: 0.6, display: "flex", alignItems: "center" }}>
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div ref={dropdownRef} style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${dropdownOpen ? accentColor : "#e2e8f0"}`, borderRadius: "8px", padding: "0.42rem 0.75rem", background: "#fff", gap: "0.5rem", transition: "border-color 0.15s" }}>
                <Search size={13} style={{ flexShrink: 0, color: "#94a3b8" }} />
                <input
                  placeholder={canal === "whatsapp" ? "Buscar por nombre o teléfono..." : "Buscar por nombre o email..."}
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setDropdownOpen(true); }}
                  onClick={() => setDropdownOpen(true)}
                  style={{ border: "none", outline: "none", flex: 1, fontSize: "0.82rem", color: "#0f172a", background: "transparent" }}
                />
                {busqueda && <button onClick={() => setBusqueda("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}><X size={12} /></button>}
                <ChevronDown size={13} style={{ flexShrink: 0, color: "#94a3b8", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
              </div>

              {dropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "10px", boxShadow: "0 12px 32px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: "280px", overflowY: "auto" }}>
                  {loadingContactos ? (
                    <div style={{ padding: "1.25rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Cargando contactos...</div>
                  ) : filtrados.length === 0 ? (
                    <div style={{ padding: "1.25rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>Sin resultados para "{busqueda}"</div>
                  ) : (
                    <>
                      {!busqueda && (
                        <div style={{ borderBottom: "1.5px solid #f1f5f9" }}>
                          {([
                            { id: "pagadores" as FiltroGrupo, Icon: Users, label: "Todos los Pagadores", count: listaPagadores.length, color: "#0369a1", bg: "#e0f2fe" },
                            { id: "viajeros" as FiltroGrupo, Icon: Backpack, label: "Todos los Viajeros", count: listaViajeros.length, color: "#15803d", bg: "#f0fdf4" },
                          ] as const).map(({ id, Icon, label, count, color, bg }) => (
                            <div key={id} onClick={() => { aplicarGrupo(id); setDropdownOpen(false); }}
                              style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.85rem", cursor: "pointer", borderBottom: "1px solid #f8fafc" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                                <Icon size={13} />
                              </div>
                              <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", flex: 1 }}>{label}</span>
                              <span style={{ background: "#e2e8f0", color: "#475569", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.72rem", fontWeight: "700" }}>{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {filtradosPagadores.length > 0 && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.85rem 0.2rem", fontSize: "0.68rem", fontWeight: "700", color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.07em", background: "#f0f9ff", borderBottom: "1px solid #e0f2fe" }}>
                            <Users size={11} /> Pagadores / Tutores
                          </div>
                          {filtradosPagadores.map((c) => <ContactoRow key={c.key} c={c} />)}
                        </>
                      )}
                      {filtradosViajeros.length > 0 && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.85rem 0.2rem", fontSize: "0.68rem", fontWeight: "700", color: "#15803d", textTransform: "uppercase", letterSpacing: "0.07em", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0" }}>
                            <Backpack size={11} /> Viajeros / Alumnos
                          </div>
                          {filtradosViajeros.map((c) => <ContactoRow key={c.key} c={c} />)}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Asunto */}
          {canal === "email" && (
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>Asunto</label>
              <input type="text" placeholder="Escribe el asunto del email..." value={asunto} onChange={(e) => setAsunto(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: "8px", padding: "0.5rem 0.75rem", fontSize: "0.83rem", color: "#0f172a", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")} />
            </div>
          )}

          {/* Mensaje */}
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>Mensaje</label>
            <textarea placeholder={canal === "whatsapp" ? "Escribe el mensaje de WhatsApp..." : "Escribe el cuerpo del email..."} rows={5} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)}
              style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: "8px", padding: "0.5rem 0.75rem", fontSize: "0.83rem", color: "#0f172a", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")} />
          </div>

          {envioError && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.6rem 0.85rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.78rem", color: "#dc2626" }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
              {envioError}
            </div>
          )}

          {/* Adjuntos */}
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>Adjuntos</label>
            <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => { setAdjuntos((prev) => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
            {adjuntos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.5rem" }}>
                {adjuntos.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.35rem 0.65rem", background: "#f8fafc", borderRadius: "7px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                      <FileText size={13} style={{ color: "#64748b", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.77rem", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                      <span style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0 }}>{formatBytes(f.size)}</span>
                    </div>
                    <button onClick={() => setAdjuntos((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0 0 0 0.5rem", display: "flex" }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.4rem 0.85rem", borderRadius: "8px", border: "1.5px dashed #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: "0.79rem", fontWeight: "500", cursor: "pointer", width: "100%", justifyContent: "center", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.color = accentColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#64748b"; }}>
              <Upload size={13} /> Adjuntar archivo
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.74rem", color: "#94a3b8" }}>
            <UserRound size={13} style={{ flexShrink: 0 }} />
            {contactosSeleccionados.length === 0
              ? "Ningún destinatario"
              : `${contactosSeleccionados.length} destinatario${contactosSeleccionados.length !== 1 ? "s" : ""} · ${canal === "whatsapp" ? contactosSeleccionados.filter((c) => c.telefono).length : contactosSeleccionados.filter((c) => c.email).length} con ${canal === "whatsapp" ? "teléfono" : "email"}${adjuntos.length > 0 ? ` · ${adjuntos.length} adjunto${adjuntos.length !== 1 ? "s" : ""}` : ""}`}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={onClose} style={{ padding: "0.45rem 1rem", borderRadius: "8px", border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}>
              Cancelar
            </button>
            {(() => {
              const isWa = canal === "whatsapp";
              const canSend = contactosSeleccionados.length > 0 && cuerpo.trim().length > 0 && !enviando;
              return (
                <button disabled={!canSend} onClick={canal === "email" ? handleEnviar : undefined}
                  style={{ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: canSend ? accentColor : "#e2e8f0", color: canSend ? "#fff" : "#94a3b8", fontWeight: "600", fontSize: "0.82rem", cursor: canSend ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "0.4rem", transition: "background 0.2s" }}>
                  {enviando ? <span>Enviando...</span> : <>{isWa ? <WhatsAppIcon size={14} /> : <Mail size={14} />} {isWa ? "Enviar WhatsApp" : "Enviar Email"}</>}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
