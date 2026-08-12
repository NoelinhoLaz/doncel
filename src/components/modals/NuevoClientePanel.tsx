"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { X, MapPin, Plus, Phone, Building2, Info, Rocket } from "lucide-react";
import styles from "./nuevoClientePanel.module.css";
import { EtiquetasSelector, Etiqueta } from "@/components/EtiquetasSelector";
import { BuscarNegocioModal, LugarPlaces } from "@/components/modals/BuscarNegocioModal";

const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" };
const inp: React.CSSProperties = { width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.55rem", borderRadius: 6, border: "1.5px solid #e2e8f0", outline: "none", boxSizing: "border-box" };
const EMPTY_CONTACTO_FORM = { nombre: "", apellido: "", cargo: "", telefono: "", movil: "", email: "", antiguedad: "", desde: "", anios_experiencia: "", poder_decision: "", estrategia: "", horarios: "" };
type ContactoForm = typeof EMPTY_CONTACTO_FORM;

export type NuevoClienteResult = {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  documento?: string | null;
  tipo_entidad?: string | null;
  razon_social?: string | null;
};

export function NuevoClientePanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (entidad: NuevoClienteResult) => void;
}) {
  const [tipoCliente, setTipoCliente] = useState<"persona" | "empresa">("persona");
  const [form, setForm] = useState({ nombre: "", razonSocial: "", email: "", telefono: "", documento: "", notas: "" });
  const [direccion, setDireccion] = useState<{ direccion?: string; cp?: string; ciudad?: string; provincia?: string } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  type ContactoPendiente = { tipo: "nuevo"; form: ContactoForm } | { tipo: "existente"; id: string; nombre: string; cargo?: string | null };
  const [contactos, setContactos] = useState<ContactoPendiente[]>([]);
  const [showNuevoContacto, setShowNuevoContacto] = useState(false);
  const [contactoForm, setContactoForm] = useState<ContactoForm>(EMPTY_CONTACTO_FORM);
  const setCF = (k: keyof ContactoForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContactoForm(p => ({ ...p, [k]: e.target.value }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscador de contactos existentes
  const [contactoSearch, setContactoSearch] = useState("");
  const [contactoResultados, setContactoResultados] = useState<any[]>([]);
  const [contactoSearchLoading, setContactoSearchLoading] = useState(false);

  useEffect(() => {
    if (contactoSearch.trim().length < 3) { setContactoResultados([]); return; }
    setContactoSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm/contactos/buscar?q=${encodeURIComponent(contactoSearch)}`);
        const json = await res.json();
        setContactoResultados(json.success ? json.data : []);
      } catch { setContactoResultados([]); }
      finally { setContactoSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [contactoSearch]);

  function handleSeleccionarContactoExistente(c: any) {
    if (contactos.some(ct => ct.tipo === "existente" && ct.id === c.id)) return;
    setContactos(prev => [...prev, { tipo: "existente", id: c.id, nombre: c.nombre, cargo: c.cargo }]);
    setContactoSearch("");
    setContactoResultados([]);
    setShowNuevoContacto(false);
  }

  // Places (solo para empresa)
  const [showBuscarNegocio, setShowBuscarNegocio] = useState(false);

  function seleccionarLugar(lugar: LugarPlaces) {
    setForm(p => ({ ...p, nombre: lugar.nombre || p.nombre, telefono: p.telefono || lugar.telefono || "" }));
    setDireccion({ direccion: lugar.calle || undefined, cp: lugar.cp || undefined, ciudad: lugar.ciudad || undefined, provincia: lugar.provincia || undefined });
    if (lugar.lat != null && lugar.lng != null) setCoords({ lat: lugar.lat, lng: lugar.lng });
    setShowBuscarNegocio(false);
  }

  function buildContactoPayload(c: ContactoForm) {
    const metadatos: Record<string, string> = {};
    if (c.apellido) metadatos.apellido = c.apellido;
    if (c.movil) metadatos.movil = c.movil;
    if (c.antiguedad) metadatos.antiguedad = c.antiguedad;
    if (c.desde) metadatos.desde = c.desde;
    if (c.anios_experiencia) metadatos.anios_experiencia = c.anios_experiencia;
    if (c.poder_decision) metadatos.poder_decision = c.poder_decision;
    if (c.estrategia) metadatos.estrategia = c.estrategia;
    if (c.horarios) metadatos.horarios = c.horarios;
    return {
      nombre: [c.nombre.trim(), c.apellido.trim()].filter(Boolean).join(" "),
      cargo: c.cargo.trim() || null,
      telefono: c.telefono.trim() || null,
      email: c.email.trim() || null,
      metadatos: Object.keys(metadatos).length ? metadatos : undefined,
    };
  }

  function handleGuardarContacto() {
    if (!contactoForm.nombre.trim()) return;
    setContactos(prev => [...prev, { tipo: "nuevo", form: contactoForm }]);
    setContactoForm(EMPTY_CONTACTO_FORM);
    setShowNuevoContacto(false);
  }

  async function handleCrear() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/entidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          razon_social: tipoCliente === "empresa" ? (form.razonSocial.trim() || undefined) : undefined,
          email: form.email.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          documento: form.documento.trim() || undefined,
          tipo_entidad: tipoCliente,
          direccion: direccion || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          metadatos: form.notas.trim() ? { notas: form.notas.trim() } : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error al crear cliente");

      if (contactos.length > 0) {
        await Promise.all(contactos.map((c, i) =>
          c.tipo === "nuevo"
            ? fetch("/api/crm/contactos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...buildContactoPayload(c.form), entidad_id: json.data.id, es_principal: i === 0 }),
              }).catch(() => {})
            : fetch(`/api/entidades/${json.data.id}/contactos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contacto_id: c.id }),
              }).catch(() => {})
        ));
      }

      if (etiquetas.length > 0) {
        await Promise.all(etiquetas.map(et =>
          fetch(`/api/entidades/${json.data.id}/etiquetas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ etiqueta_id: et.id }),
          }).catch(() => {})
        ));
      }

      onCreated(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 1100 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 680, zIndex: 1101,
        background: "#fff",
        boxShadow: "-8px 0 32px rgba(15,23,42,0.12)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.2s ease",
      }}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Nuevo cliente</span>
          <button className={styles.btnClose} onClick={onClose}><X size={15} /></button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ display: "flex", gap: "1rem" }}>
            {(["persona", "empresa"] as const).map(t => (
              <label key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "#334155", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="tipoCliente"
                  checked={tipoCliente === t}
                  onChange={() => setTipoCliente(t)}
                  style={{ accentColor: "var(--primary-color, #475569)" }}
                />
                {t === "persona" ? "Persona" : "Empresa"}
              </label>
            ))}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{tipoCliente === "empresa" ? "Nombre comercial *" : "Nombre *"}</label>
            <div style={{ position: "relative" }}>
              <input
                autoFocus
                className={styles.input}
                placeholder={tipoCliente === "empresa" ? "Nombre comercial" : "Nombre del cliente"}
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                style={{ width: "100%", paddingRight: tipoCliente === "empresa" ? "2.2rem" : undefined }}
              />
              {tipoCliente === "empresa" && (
                <button
                  type="button"
                  title="Buscar negocio en Google Places"
                  onClick={() => setShowBuscarNegocio(true)}
                  style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", color: "var(--primary-color, #475569)" }}
                >
                  <MapPin size={15} />
                </button>
              )}
            </div>
          </div>

          {tipoCliente === "empresa" && (
            <div className={styles.field}>
              <label className={styles.label}>Razón social</label>
              <input
                className={styles.input}
                placeholder="Razón social (nombre fiscal)"
                value={form.razonSocial}
                onChange={e => setForm(p => ({ ...p, razonSocial: e.target.value }))}
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>{tipoCliente === "empresa" ? "CIF" : "NIF"}</label>
            <input
              className={styles.input}
              placeholder={tipoCliente === "empresa" ? "B12345678" : "12345678A"}
              value={form.documento}
              onChange={e => setForm(p => ({ ...p, documento: e.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Dirección</label>
            <input
              className={styles.input}
              placeholder="Calle y número"
              value={direccion?.direccion ?? ""}
              onChange={e => setDireccion(p => ({ ...(p ?? {}), direccion: e.target.value }))}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Código postal</label>
              <input
                className={styles.input}
                placeholder="14700"
                value={direccion?.cp ?? ""}
                onChange={e => setDireccion(p => ({ ...(p ?? {}), cp: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Localidad</label>
              <input
                className={styles.input}
                placeholder="Ej: Córdoba"
                value={direccion?.ciudad ?? ""}
                onChange={e => setDireccion(p => ({ ...(p ?? {}), ciudad: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Provincia</label>
              <input
                className={styles.input}
                placeholder="Ej: Córdoba"
                value={direccion?.provincia ?? ""}
                onChange={e => setDireccion(p => ({ ...(p ?? {}), provincia: e.target.value }))}
              />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Teléfono</label>
              <input className={styles.input} placeholder="957123456" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} placeholder="centro@ejemplo.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>

          {tipoCliente === "empresa" && (
            <>
            <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: 0 }} />
            <div className={styles.field}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className={styles.label} style={{ marginBottom: 0 }}>
                  Contactos {contactos.length > 0 && `(${contactos.length})`}
                </label>
                {!showNuevoContacto && (
                  <button
                    type="button"
                    onClick={() => setShowNuevoContacto(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 600, color: "var(--primary-color, #475569)", background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0.3rem", borderRadius: 4 }}
                  >
                    <Plus size={12} /> Añadir
                  </button>
                )}
              </div>

              {contactos.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.4rem" }}>
                  {contactos.map((c, i) => {
                    const nombre = c.tipo === "nuevo" ? [c.form.nombre, c.form.apellido].filter(Boolean).join(" ") : c.nombre;
                    const cargo = c.tipo === "nuevo" ? c.form.cargo : c.cargo;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", borderRadius: 8, padding: "0.4rem 0.6rem" }}>
                        <div style={{ fontSize: "0.78rem", color: "#1e293b" }}>
                          <span style={{ fontWeight: 600 }}>{nombre}</span>
                          {cargo && <span style={{ color: "#64748b" }}> · {cargo}</span>}
                          {c.tipo === "existente" && <span style={{ marginLeft: 6, fontSize: "0.62rem", fontWeight: 600, color: "#0ea5e9" }}>Existente</span>}
                          {i === 0 && <span style={{ marginLeft: 6, fontSize: "0.62rem", fontWeight: 600, color: "var(--primary-color, #475569)" }}>Principal</span>}
                        </div>
                        <button type="button" onClick={() => setContactos(prev => prev.filter((_, j) => j !== i))} style={{ display: "flex", border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8" }}>
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {showNuevoContacto && (
                <div style={{ position: "relative", marginTop: "0.6rem" }}>
                  <label style={lbl}>¿Ya existe este contacto?</label>
                  <input
                    autoFocus
                    placeholder="Buscar contacto por nombre… (ej. si ya trabajaba en otro cliente)"
                    value={contactoSearch}
                    onChange={e => setContactoSearch(e.target.value)}
                    style={inp}
                  />
                  {contactoSearchLoading && (
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>Buscando…</div>
                  )}
                  {contactoResultados.length > 0 && (
                    <div style={{ marginTop: "0.4rem", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                      {contactoResultados.map((c: any) => {
                        const yaAnadido = contactos.some(ct => ct.tipo === "existente" && ct.id === c.id);
                        const entidadesActivas = (c.crm_contactos_organizaciones ?? [])
                          .filter((o: any) => o.es_activa)
                          .map((o: any) => o.contabilidad_entidades?.nombre)
                          .filter(Boolean);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            disabled={yaAnadido}
                            onClick={() => handleSeleccionarContactoExistente(c)}
                            style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "0.5rem 0.65rem", border: "none", borderBottom: "1px solid #f1f5f9", background: "#fff", cursor: yaAnadido ? "default" : "pointer", textAlign: "left", opacity: yaAnadido ? 0.5 : 1 }}
                            onMouseEnter={ev => { if (!yaAnadido) ev.currentTarget.style.background = "#f8fafc"; }}
                            onMouseLeave={ev => (ev.currentTarget.style.background = "#fff")}
                          >
                            <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "#1e293b" }}>{c.nombre}{c.cargo ? ` · ${c.cargo}` : ""}</span>
                            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                              {yaAnadido ? "Ya añadido" : entidadesActivas.length > 0 ? `Actualmente en: ${entidadesActivas.join(", ")}` : "Sin cliente asignado"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0.85rem 0" }}>
                    <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                    <span style={{ fontSize: "0.65rem", color: "#94a3b8", textTransform: "uppercase" }}>o crear nuevo</span>
                    <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                  </div>
                </div>
              )}

              {showNuevoContacto && (
                <div style={{ marginTop: "0.6rem", border: "1.5px solid var(--primary-color, #475569)", borderRadius: "0.75rem", padding: "1rem", background: "#fff", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)" }}>Nuevo contacto</div>

                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Nombre *</label>
                      <input autoFocus placeholder="Nombre del responsable" value={contactoForm.nombre} onChange={setCF("nombre")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Apellido</label>
                      <input placeholder="Apellido del responsable" value={contactoForm.apellido} onChange={setCF("apellido")} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Cargo</label>
                      <input placeholder="Ej: Director, Jefe de Estudios..." value={contactoForm.cargo} onChange={setCF("cargo")} style={inp} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 5 }}>
                      <Phone size={13} /> Información de Contacto
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Teléfono</label>
                        <input placeholder="+34 123 456 789" value={contactoForm.telefono} onChange={setCF("telefono")} style={inp} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Móvil</label>
                        <input placeholder="657197072 (solo números)" value={contactoForm.movil} onChange={setCF("movil")} style={inp} />
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 2 }}>Solo números, sin espacios ni caracteres especiales</div>
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Email</label>
                      <input placeholder="responsable@centro.edu" value={contactoForm.email} onChange={setCF("email")} style={inp} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 5 }}>
                      <Building2 size={13} /> Información Profesional
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Antigüedad</label>
                        <input placeholder="Ej: 5 años, 2 meses" value={contactoForm.antiguedad} onChange={setCF("antiguedad")} style={inp} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Desde</label>
                        <input placeholder="Ej: Septiembre 2020" value={contactoForm.desde} onChange={setCF("desde")} style={inp} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem" }}>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Años de Experiencia</label>
                        <input type="number" min={0} placeholder="0" value={contactoForm.anios_experiencia} onChange={setCF("anios_experiencia")} style={inp} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 5 }}>
                      <Info size={13} /> Información Adicional
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Poder de Decisión</label>
                        <input placeholder="Ej: Alto, Medio, Bajo" value={contactoForm.poder_decision} onChange={setCF("poder_decision")} style={inp} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Horarios</label>
                        <textarea placeholder="Horarios de disponibilidad..." value={contactoForm.horarios} onChange={setCF("horarios")} rows={2} style={{ ...inp, resize: "vertical" }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}><Rocket size={12} /> Estrategia</label>
                      <textarea placeholder="Estrategia o enfoque del responsable..." value={contactoForm.estrategia} onChange={setCF("estrategia")} rows={3} style={{ ...inp, resize: "vertical" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
                    <button type="button" onClick={() => { setShowNuevoContacto(false); setContactoForm(EMPTY_CONTACTO_FORM); }} style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                    <button type="button" onClick={handleGuardarContacto} disabled={!contactoForm.nombre.trim()} style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: 6, border: "none", background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", opacity: !contactoForm.nombre.trim() ? 0.5 : 1 }}>
                      Guardar contacto
                    </button>
                  </div>
                </div>
              )}
            </div>
            <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: 0 }} />
            </>
          )}

          <div className={styles.field}>
            <EtiquetasSelector label="Etiquetas" value={etiquetas} onChange={setEtiquetas} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Notas</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="Notas adicionales sobre el cliente…"
              value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
            />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleCrear} disabled={saving || !form.nombre.trim()}>
            {saving ? "Creando…" : "Crear cliente"}
          </button>
        </div>
      </div>

      {showBuscarNegocio && (
        <BuscarNegocioModal onClose={() => setShowBuscarNegocio(false)} onSelect={seleccionarLugar} />
      )}
    </>
  );
}
