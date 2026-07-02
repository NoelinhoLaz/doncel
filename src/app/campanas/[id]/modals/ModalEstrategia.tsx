"use client";
import { useState } from "react";
import { X, Plus, User, Mail, Phone, Clock, Rocket, Pencil, Trash2 } from "lucide-react";
import { Oportunidad } from "../types";
import { EMPTY_CONTACTO_FORM } from "../constants";

export function ModalEstrategia({ op, onClose, onSave, onOportunidadUpdate }: {
  op: Oportunidad;
  onClose: () => void;
  onSave: (descripcion: string) => void;
  onOportunidadUpdate?: (id: string, patch: Partial<Oportunidad>) => void;
}) {
  function limpiarDescripcion(raw: string | null): string {
    if (!raw) return "";
    // Quitar todo a partir de "--- DETALLES DE CIERRE ---" (datos legado)
    const corte = raw.indexOf("--- DETALLES DE CIERRE ---");
    const limpio = corte >= 0 ? raw.slice(0, corte) : raw;
    // Quitar líneas que parezcan ciudad/localidad (primera línea tipo "Ciudad (X)")
    return limpio
      .split("\n")
      .filter(l => !/^[A-ZÁÉÍÓÚÑ][^()\n]*\([^)]+\)\s*$/.test(l.trim()))
      .join("\n")
      .trim();
  }

  const [saving, setSaving] = useState(false);
  // Más reciente primero
  const campanas = [...(op.estados_campanas_anteriores ?? [])].sort((a, b) =>
    (a.campanaCreatedAt ?? "") > (b.campanaCreatedAt ?? "") ? -1 : 1
  );
  // Estrategia del año que viene = la de la campaña anterior más reciente
  const campanaReciente = campanas.length ? campanas[0] : null;
  const estrategiaAnterior = campanaReciente
    ? (campanaReciente.estrategia || limpiarDescripcionLegado(campanaReciente.descripcion).estrategia)
    : null;
  // El textarea muestra: estrategia extraída de descripcion propia, si no la de campaña anterior
  const estrategiaPropia = limpiarDescripcionLegado(op.descripcion).estrategia;
  const [texto, setTexto] = useState(estrategiaPropia || estrategiaAnterior || "");

  const [checks, setChecks] = useState({ valido: false, nombre: false, email: false, telefono: false, horarios: false, preferencias: false });
  const setCheck = (k: keyof typeof checks) => setChecks(p => ({ ...p, [k]: !p[k] }));
  const [prioridad, setPrioridad] = useState<number | null>(op.prioridad);
  const [valorEstimado, setValorEstimado] = useState<number>(op.valor_estimado);
  const [editingPrioridad, setEditingPrioridad] = useState(false);
  const [editingValor, setEditingValor] = useState(false);

  async function savePrioridad(val: number | null) {
    setPrioridad(val);
    setEditingPrioridad(false);
    await fetch(`/api/crm/oportunidades/${op.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prioridad: val }) });
  }
  async function saveValor(val: number) {
    setValorEstimado(val);
    setEditingValor(false);
    await fetch(`/api/crm/oportunidades/${op.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valor_estimado: val }) });
  }
  const [contactoSelIdx, setContactoSelIdx] = useState<number | null>(null);
  const [contactoHoverIdx, setContactoHoverIdx] = useState<number | null>(null);
  const [contactoConfirmBorrar, setContactoConfirmBorrar] = useState<number | null>(null);
  const [editandoContacto, setEditandoContacto] = useState<{ id: string; form: typeof EMPTY_CONTACTO_FORM } | null>(null);
  const [savingContactoEst, setSavingContactoEst] = useState(false);

  function limpiarDescripcionLegado(raw: string | null): { cuerpo: string; estrategia: string | null } {
    if (!raw) return { cuerpo: "", estrategia: null };
    // Extraer estrategia del campo legado si existe
    const estrategiaMatch = raw.match(/Estrategia campa[ñn]a pr[oó]xima:\s*([\s\S]+?)(?:\n--- DETALLES|$)/);
    const estrategia = estrategiaMatch ? estrategiaMatch[1].trim() : null;
    // Quitar la línea de ciudad (formato "Texto (Texto)" al inicio)
    const lineas = raw.split("\n").filter(l => !/^[A-ZÁÉÍÓÚÑ][^()\n]*\([^)]+\)\s*$/.test(l.trim()));
    // Quitar la línea de "Estrategia campaña próxima:" y todo lo que haya después si es legado duplicado
    const corte = lineas.findIndex(l => /Estrategia campa[ñn]a pr[oó]xima:/.test(l));
    const cuerpo = (corte >= 0 ? lineas.slice(0, corte) : lineas).join("\n").trim();
    return { cuerpo, estrategia };
  }

  async function handleGuardar() {
    setSaving(true);
    const { cuerpo } = limpiarDescripcionLegado(op.descripcion);
    const textoTrimmed = texto.trim();
    const descripcionFinal = textoTrimmed
      ? (cuerpo ? `${cuerpo}\n\nEstrategia campaña próxima:\n${textoTrimmed}` : `Estrategia campaña próxima:\n${textoTrimmed}`)
      : cuerpo;
    await onSave(descripcionFinal);
    setSaving(false);
  }

  function openEditarContacto(c: NonNullable<NonNullable<typeof op.contabilidad_entidades>["crm_contactos"]>[number]) {
    const meta = c.metadatos ?? {};
    const parts = (c.nombre ?? "").split(" ");
    setEditandoContacto({
      id: c.id,
      form: {
        nombre: parts[0] ?? "",
        apellido: parts.slice(1).join(" "),
        cargo: c.cargo ?? "",
        telefono: c.telefono ?? "",
        movil: meta.movil ?? "",
        email: c.email ?? "",
        antiguedad: meta.antiguedad ?? "",
        desde: meta.desde ?? "",
        anios_experiencia: meta.anios_experiencia ?? "",
        poder_decision: meta.poder_decision ?? "",
        estrategia: meta.estrategia ?? "",
        horarios: meta.horarios ?? "",
      },
    });
  }

  async function handleGuardarContacto() {
    if (!editandoContacto) return;
    setSavingContactoEst(true);
    const { id, form } = editandoContacto;
    const metadatos: Record<string, string> = {};
    if (form.apellido) metadatos.apellido = form.apellido;
    if (form.movil) metadatos.movil = form.movil;
    if (form.antiguedad) metadatos.antiguedad = form.antiguedad;
    if (form.desde) metadatos.desde = form.desde;
    if (form.anios_experiencia) metadatos.anios_experiencia = form.anios_experiencia;
    if (form.poder_decision) metadatos.poder_decision = form.poder_decision;
    if (form.estrategia) metadatos.estrategia = form.estrategia;
    if (form.horarios) metadatos.horarios = form.horarios;
    await fetch(`/api/crm/contactos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: [form.nombre.trim(), form.apellido.trim()].filter(Boolean).join(" "),
        cargo: form.cargo.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        metadatos: Object.keys(metadatos).length ? metadatos : undefined,
      }),
    });
    setSavingContactoEst(false);
    setEditandoContacto(null);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ position: "relative", background: "#fff", borderRadius: 14, width: "min(900px, 94vw)", height: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(15,23,42,0.22)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "1rem 1.4rem 0.8rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Estrategia de captación</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{op.titulo}</div>
          </div>
          {/* Prioridad editable */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Prioridad</span>
            {editingPrioridad ? (
              <select
                autoFocus
                value={prioridad ?? ""}
                onChange={e => savePrioridad(e.target.value === "" ? null : Number(e.target.value))}
                onBlur={() => setEditingPrioridad(false)}
                style={{ fontSize: "0.78rem", padding: "2px 6px", border: "1.5px solid var(--primary-color,#475569)", borderRadius: 6, outline: "none" }}
              >
                <option value="">—</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              <span
                onClick={() => setEditingPrioridad(true)}
                style={{ fontSize: "0.82rem", fontWeight: 700, color: prioridad ? "#1e293b" : "#cbd5e1", cursor: "pointer", padding: "2px 8px", borderRadius: 6, border: "1.5px solid #e2e8f0", minWidth: 32, textAlign: "center" }}
                title="Editar prioridad"
              >{prioridad ?? "—"}</span>
            )}
          </div>
          {/* Valor estimado editable */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Estimado</span>
            {editingValor ? (
              <input
                autoFocus
                type="number"
                min={0}
                defaultValue={valorEstimado}
                onBlur={e => saveValor(parseFloat(e.target.value) || 0)}
                onKeyDown={e => { if (e.key === "Enter") saveValor(parseFloat((e.target as HTMLInputElement).value) || 0); if (e.key === "Escape") setEditingValor(false); }}
                style={{ fontSize: "0.78rem", padding: "2px 6px", border: "1.5px solid var(--primary-color,#475569)", borderRadius: 6, outline: "none", width: 90 }}
              />
            ) : (
              <span
                onClick={() => setEditingValor(true)}
                style={{ fontSize: "0.82rem", fontWeight: 700, color: valorEstimado ? "#1e293b" : "#cbd5e1", cursor: "pointer", padding: "2px 8px", borderRadius: 6, border: "1.5px solid #e2e8f0", minWidth: 60, textAlign: "right" }}
                title="Editar valor estimado"
              >{valorEstimado ? `${valorEstimado.toLocaleString("es-ES")} €` : "—"}</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, flexShrink: 0 }}><X size={18} /></button>
        </div>

        {/* Body — dos columnas */}
        <div style={{ display: "grid", gridTemplateColumns: campanas.length ? "1fr 1fr" : "1fr", gap: 0, flex: 1, overflow: "hidden" }}>

          {/* Columna izquierda — última campaña + datos de contacto */}
          {campanas.length > 0 && (() => {
            const c = campanas[0];
            const { cuerpo } = limpiarDescripcionLegado(c.descripcion);
            const contactos = op.contabilidad_entidades?.crm_contactos ?? [];
            return (
              <div style={{ padding: "1.1rem 1.4rem", overflowY: "auto", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Datos del contacto */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {contactos.length > 1 ? `Responsables (${contactos.length})` : "Responsable"}
                    </div>
                    <button
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4, padding: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--primary-color,#475569)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
                      onClick={() => {}}
                    >
                      <Plus size={12} /> Responsable
                    </button>
                  </div>
                  {contactos.length === 0 ? (
                    <div style={{ fontSize: "0.74rem", color: "#94a3b8", fontStyle: "italic" }}>Sin contacto registrado</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {contactos.map((contacto, ci) => {
                        const sel = contactoSelIdx === ci;
                        const hover = contactoHoverIdx === ci;
                        const confirmando = contactoConfirmBorrar === ci;
                        const fields = [
                          { icon: <User size={13} />, value: contacto.nombre, text: contacto.nombre ? <>{contacto.nombre}{contacto.cargo ? <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 4 }}>· {contacto.cargo}</span> : null}</> : "Sin nombre" },
                          { icon: <Mail size={12} />, value: contacto.email, text: contacto.email || "—" },
                          { icon: <Phone size={12} />, value: contacto.telefono || contacto.metadatos?.movil, text: contacto.telefono || contacto.metadatos?.movil || "—" },
                          { icon: <Clock size={12} />, value: contacto.metadatos?.horarios, text: contacto.metadatos?.horarios || "—" },
                          { icon: <User size={12} />, value: contacto.metadatos?.poder_decision, text: contacto.metadatos?.poder_decision ? `Decisión: ${contacto.metadatos.poder_decision}` : "—" },
                          { icon: <Rocket size={12} />, value: contacto.metadatos?.estrategia, text: contacto.metadatos?.estrategia || "—" },
                        ];
                        return (
                          <div
                            key={ci}
                            onClick={() => { if (!confirmando) setContactoSelIdx(sel ? null : ci); }}
                            onMouseEnter={() => setContactoHoverIdx(ci)}
                            onMouseLeave={() => { setContactoHoverIdx(null); setContactoConfirmBorrar(null); }}
                            style={{
                              position: "relative", padding: "0.6rem 0.75rem", borderRadius: 8, cursor: "pointer",
                              border: sel ? "1.5px solid var(--primary-color,#475569)" : "1.5px solid #e2e8f0",
                              background: sel ? "#f1f5f9" : "#f8fafc",
                              transition: "border-color 0.15s, background 0.15s",
                              display: "flex", flexDirection: "column", gap: "0.2rem",
                            }}
                          >
                            {/* Botones hover */}
                            {(hover || confirmando) && !confirmando && (
                              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                                <button title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 3, display: "flex", borderRadius: 4 }}
                                  onMouseEnter={e => (e.currentTarget.style.color = "var(--primary-color,#475569)")}
                                  onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
                                  onClick={() => openEditarContacto(contacto)}
                                ><Pencil size={12} /></button>
                                <button title="Desvincular" style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 3, display: "flex", borderRadius: 4 }}
                                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                                  onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
                                  onClick={() => setContactoConfirmBorrar(ci)}
                                ><Trash2 size={12} /></button>
                              </div>
                            )}
                            {/* Confirm borrar */}
                            {confirmando && (
                              <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(255,255,255,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "0.5rem", zIndex: 2 }} onClick={e => e.stopPropagation()}>
                                <span style={{ fontSize: "0.72rem", color: "#475569", textAlign: "center", lineHeight: 1.4 }}>
                                  El responsable dejará de estar vinculado al centro pero se mantendrá en la base de datos.
                                </span>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => setContactoConfirmBorrar(null)} style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#475569" }}>Cancelar</button>
                                  <button onClick={() => { setContactoConfirmBorrar(null); }} style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 6, border: "none", background: "#ef4444", cursor: "pointer", color: "#fff", fontWeight: 600 }}>Desvincular</button>
                                </div>
                              </div>
                            )}
                            {fields.map((f, fi) => (
                              <div key={fi} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: fi === 0 ? "0.78rem" : "0.75rem" }}>
                                <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                                  <span style={{ color: "#94a3b8", display: "flex" }}>{f.icon}</span>
                                  {!f.value && <span style={{ position: "absolute", top: -3, right: -3, width: 6, height: 6, borderRadius: 99, background: "#fbbf24", border: "1px solid #fff" }} />}
                                </span>
                                <span style={{ color: f.value ? (fi === 0 ? "#1e293b" : "#475569") : "#cbd5e1", fontWeight: fi === 0 ? 600 : 400 }}>{f.text}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Última campaña */}
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Última campaña</div>
                  <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: cuerpo ? 6 : 0 }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e293b" }}>{c.nombre}</span>
                      {c.campana && <span style={{ fontSize: "0.68rem", color: "#64748b", marginLeft: 2 }}>· {c.campana}</span>}
                    </div>
                    {cuerpo ? (
                      <div style={{ fontSize: "0.74rem", color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{cuerpo}</div>
                    ) : (
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontStyle: "italic" }}>Sin notas registradas</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Columna derecha — estrategia libre */}
          <div style={{ padding: "1.1rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {/* Switches de datos del contacto */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1e293b" }}>¿Tenemos datos válidos del responsable/contacto?</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.1rem", paddingLeft: 2 }}>
                {([
                  { key: "nombre", label: "Nombre", icon: <User size={14} /> },
                  { key: "email", label: "Email", icon: <Mail size={14} /> },
                  { key: "telefono", label: "Teléfono", icon: <Phone size={14} /> },
                  { key: "horarios", label: "Horarios", icon: <Clock size={14} /> },
                  { key: "preferencias", label: "Preferencias", icon: <Rocket size={14} /> },
                ] as { key: keyof typeof checks; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }} title={label}>
                    <span style={{ color: checks[key] ? "var(--primary-color,#475569)" : "#94a3b8", display: "flex", alignItems: "center" }}>{icon}</span>
                    <span
                      onClick={() => setCheck(key)}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 18, borderRadius: 99, flexShrink: 0,
                        background: checks[key] ? "var(--primary-color,#475569)" : "#e2e8f0",
                        transition: "background 0.15s", cursor: "pointer", position: "relative",
                      }}
                    >
                      <span style={{ width: 12, height: 12, borderRadius: 99, background: "#fff", position: "absolute", transition: "left 0.15s", left: checks[key] ? 17 : 3, boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }} />
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>
              Estrategia para esta campaña
            </div>
            <textarea
              autoFocus
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Describe el enfoque comercial, cuándo contactar, qué palancas usar..."
              style={{ flex: 1, resize: "none", fontSize: "0.82rem", lineHeight: 1.6, padding: "0.75rem", border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none", fontFamily: "inherit", color: "#1e293b", minHeight: 180 }}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--primary-color,#475569)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0.9rem 1.4rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
          <button onClick={onClose} style={{ padding: "0.45rem 1rem", border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff", fontSize: "0.82rem", color: "#64748b", cursor: "pointer" }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ padding: "0.45rem 1.1rem", border: "none", borderRadius: 7, background: "var(--primary-color,#475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>

        {/* Modal edición de responsable */}
        {editandoContacto && (() => {
          const f = editandoContacto.form;
          const setF = (k: keyof typeof EMPTY_CONTACTO_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setEditandoContacto(prev => prev ? { ...prev, form: { ...prev.form, [k]: e.target.value } } : prev);
          const inp: React.CSSProperties = { width: "100%", fontSize: "0.78rem", padding: "0.3rem 0.5rem", border: "1px solid #e2e8f0", borderRadius: 6, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
          const lbl: React.CSSProperties = { fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 3 };
          return (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(255,255,255,0.97)", borderRadius: 14, display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: "1rem 1.4rem 0.8rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e293b" }}>Editar responsable</div>
                <button onClick={() => setEditandoContacto(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={17} /></button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}><label style={lbl}>Nombre *</label><input autoFocus value={f.nombre} onChange={setF("nombre")} style={inp} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Apellido</label><input value={f.apellido} onChange={setF("apellido")} style={inp} /></div>
                </div>
                <div><label style={lbl}>Cargo</label><input value={f.cargo} onChange={setF("cargo")} style={inp} /></div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}><label style={lbl}>Teléfono</label><input value={f.telefono} onChange={setF("telefono")} style={inp} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Móvil</label><input value={f.movil} onChange={setF("movil")} style={inp} /></div>
                </div>
                <div><label style={lbl}>Email</label><input value={f.email} onChange={setF("email")} style={inp} /></div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}><label style={lbl}>Antigüedad</label><input value={f.antiguedad} onChange={setF("antiguedad")} style={inp} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Desde</label><input value={f.desde} onChange={setF("desde")} style={inp} /></div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}><label style={lbl}>Años experiencia</label><input type="number" min={0} value={f.anios_experiencia} onChange={setF("anios_experiencia")} style={inp} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Poder de decisión</label><input value={f.poder_decision} onChange={setF("poder_decision")} style={inp} /></div>
                </div>
                <div><label style={lbl}>Horarios</label><textarea value={f.horarios} onChange={setF("horarios")} rows={2} style={{ ...inp, resize: "vertical" }} /></div>
                <div>
                  <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}><Rocket size={11} /> Estrategia</label>
                  <textarea value={f.estrategia} onChange={setF("estrategia")} rows={3} style={{ ...inp, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ padding: "0.75rem 1.4rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => setEditandoContacto(null)} style={{ fontSize: "0.78rem", padding: "0.35rem 0.9rem", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                <button onClick={handleGuardarContacto} disabled={savingContactoEst || !f.nombre.trim()} style={{ fontSize: "0.78rem", padding: "0.35rem 0.9rem", borderRadius: 6, border: "none", background: "var(--primary-color,#475569)", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: savingContactoEst || !f.nombre.trim() ? 0.6 : 1 }}>
                  {savingContactoEst ? "Guardando…" : "Actualizar"}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
