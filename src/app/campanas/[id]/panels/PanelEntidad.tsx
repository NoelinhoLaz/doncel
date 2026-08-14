"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { X, Pencil, Plus, Phone, Mail, Info, Building2, Rocket, IdCard } from "lucide-react";
import { EntidadDetalle, CampanaHistorialRow } from "../types";
import { EMPTY_CONTACTO_FORM, lbl, inp, th, td } from "../constants";
import { getEntidadHistorial, getEntidadResumen } from "@/actions/crm";
import { apiFetch, initials } from "../utils";
import styles from "../page.module.css";
import { EtiquetasSelector } from "@/components/EtiquetasSelector";

const EntidadMapaDynamic = dynamic(
  () => import("../EntidadMapa").then(m => m.EntidadMapa),
  { ssr: false }
);
const EntidadMapaPlaceholder = dynamic(
  () => import("../EntidadMapa").then(m => m.EntidadMapaPlaceholder),
  { ssr: false }
);

export function PanelEntidad({ data, onClose, onEntidadUpdated }: { data: EntidadDetalle; onClose: () => void; onEntidadUpdated?: (entidad: any) => void }) {
  const router = useRouter();
  const { entidad } = data;
  const [historial, setHistorial] = useState<CampanaHistorialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [contactos, setContactos] = useState(data.entidad?.crm_contactos ?? []);
  const [showNuevoContacto, setShowNuevoContacto] = useState(false);
  const [editingContactoId, setEditingContactoId] = useState<string | null>(null);
  const [hoveredContactoId, setHoveredContactoId] = useState<string | null>(null);
  const [savingContacto, setSavingContacto] = useState(false);
  const [form, setForm] = useState(EMPTY_CONTACTO_FORM);
  const setF = (k: keyof typeof EMPTY_CONTACTO_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  // Buscador de contactos existentes (reutilizar en vez de duplicar)
  const [contactoSearch, setContactoSearch] = useState("");
  const [contactoResultados, setContactoResultados] = useState<any[]>([]);
  const [contactoSearchLoading, setContactoSearchLoading] = useState(false);
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);

  // Picker de agente en la fila de historial de campañas
  const [agentePickerRowId, setAgentePickerRowId] = useState<string | null>(null);
  const [agentePickerPos, setAgentePickerPos] = useState<{ top: number; left: number } | null>(null);
  const agentePickerRef = useRef<HTMLDivElement | null>(null);

  // Picker de agente asignado a la entidad (cliente)
  const [showEntidadAgentePicker, setShowEntidadAgentePicker] = useState(false);
  const [agentesAgencia, setAgentesAgencia] = useState<{ id: string; nombre: string; apellidos: string; avatar_url: string | null; sucursal?: string | null }[]>([]);
  const [loadingAgentesAgencia, setLoadingAgentesAgencia] = useState(false);
  const entidadAgenteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/crm/agentes")
      .then(r => r.json())
      .then(json => { if (json?.success) setAgentesAgencia(json.data ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showEntidadAgentePicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (entidadAgenteRef.current && !entidadAgenteRef.current.contains(e.target as Node)) {
        setShowEntidadAgentePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEntidadAgentePicker]);

  async function abrirEntidadAgentePicker() {
    if (showEntidadAgentePicker) { setShowEntidadAgentePicker(false); return; }
    setShowEntidadAgentePicker(true);
    if (agentesAgencia.length === 0) {
      setLoadingAgentesAgencia(true);
      try {
        const res = await fetch("/api/crm/agentes");
        const json = await res.json();
        if (json?.success) setAgentesAgencia(json.data ?? []);
      } catch { /* noop */ } finally { setLoadingAgentesAgencia(false); }
    }
  }


  async function handleEntidadAgenteChange(agenteId: string | null) {
    setShowEntidadAgentePicker(false);
    const ag = agenteId ? agentesAgencia.find(a => a.id === agenteId) ?? null : null;
    const updated = { ...entidadLocal, agente_id: agenteId, crm_agentes: ag };
    setEntidadLocal(updated);
    onEntidadUpdated?.(updated);
    try {
      await fetch(`/api/crm/entidades/${entidadLocal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agente_id: agenteId }),
      });
    } catch { /* noop */ }
  }

  useEffect(() => {
    if (!agentePickerRowId) return;
    function onDocClick(e: MouseEvent) {
      if (agentePickerRef.current && agentePickerRef.current.contains(e.target as Node)) return;
      setAgentePickerRowId(null);
      setAgentePickerPos(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [agentePickerRowId]);

  async function handleHistorialAgenteChange(row: CampanaHistorialRow, agenteId: string | null) {
    const agEntry = row.crm_campanas?.crm_campanas_agentes?.find(a => a.agente_id === agenteId);
    const ag = agEntry?.crm_agentes ?? null;
    setHistorial(prev => prev.map(h => h.id !== row.id ? h : { ...h, agente_id: agenteId, crm_agentes: ag }));
    try {
      await apiFetch(`/api/crm/oportunidades/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agente_id: agenteId }),
      });
    } catch (e) {
      console.error("Error al cambiar agente:", e);
      setHistorial(prev => prev.map(h => h.id !== row.id ? h : row));
    }
  }

  // Edición de entidad
  const [hoveredEntidad, setHoveredEntidad] = useState(false);
  const [editingEntidad, setEditingEntidad] = useState(false);
  const [savingEntidad, setSavingEntidad] = useState(false);
  const [entidadLocal, setEntidadLocal] = useState<any>(entidad);
  const entidadAgenteSucursal = entidadLocal.crm_agentes
    ? (agentesAgencia.find(a => a.id === entidadLocal.crm_agentes.id)?.sucursal ?? entidadLocal.crm_agentes.sucursal ?? null)
    : null;
  const [entidadForm, setEntidadForm] = useState({
    nombre: entidad?.nombre ?? "",
    telefono: entidad?.telefono ?? "",
    otros_tlfs: (entidad?.otros_tlfs ?? []) as string[],
    email: entidad?.email ?? "",
    otros_emails: (entidad?.otros_emails ?? []) as string[],
    direccion: typeof entidad?.direccion === "string" ? entidad.direccion : (entidad?.direccion?.direccion ?? entidad?.direccion?.calle ?? ""),
    ciudad: typeof entidad?.direccion === "string" ? "" : (entidad?.direccion?.ciudad ?? ""),
    provincia: typeof entidad?.direccion === "string" ? "" : (entidad?.direccion?.provincia ?? ""),
    cp: typeof entidad?.direccion === "string" ? "" : (entidad?.direccion?.cp ?? ""),
  });
  const setEF = (k: keyof typeof entidadForm) => (e: React.ChangeEvent<HTMLInputElement>) => setEntidadForm(p => ({ ...p, [k]: e.target.value }));

  // Edición inline del nombre en el header
  const [editingNombre, setEditingNombre] = useState(false);
  const [nombreDraft, setNombreDraft] = useState(entidad?.nombre ?? "");
  const [savingNombre, setSavingNombre] = useState(false);

  async function guardarNombre() {
    const nuevoNombre = nombreDraft.trim();
    if (!nuevoNombre || nuevoNombre === entidadLocal.nombre) { setEditingNombre(false); return; }
    setSavingNombre(true);
    try {
      await fetch(`/api/crm/entidades/${entidadLocal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre }),
      });
      const updated = { ...entidadLocal, nombre: nuevoNombre };
      setEntidadLocal(updated);
      onEntidadUpdated?.(updated);
      setEditingEntidad(false);
      setEntidadForm(p => ({ ...p, nombre: nuevoNombre }));
      setEditingNombre(false);
    } catch { } finally { setSavingNombre(false); }
  }

  // Edición de datos del cliente (NIF/CIF, fecha de nacimiento, tipo de cliente)
  const [editingDatosCliente, setEditingDatosCliente] = useState(false);
  const [hoveredDatosCliente, setHoveredDatosCliente] = useState(false);
  const [savingDatosCliente, setSavingDatosCliente] = useState(false);
  const [tiposCliente, setTiposCliente] = useState<{ id: string; etiqueta: string }[]>([]);
  const [datosClienteForm, setDatosClienteForm] = useState({
    documento: entidad?.documento ?? "",
    fecha_nacimiento: entidad?.fecha_nacimiento ?? "",
    tipo_cliente_id: entidad?.tipo_cliente_id ?? "",
  });
  const setDCF = (k: "documento" | "fecha_nacimiento") => (e: React.ChangeEvent<HTMLInputElement>) => setDatosClienteForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    fetch("/api/config/tipos-cliente")
      .then(r => r.json())
      .then(json => { if (json?.success) setTiposCliente(json.data ?? []); })
      .catch(() => {});
  }, []);

  async function guardarDatosCliente() {
    setSavingDatosCliente(true);
    try {
      await fetch(`/api/crm/entidades/${entidadLocal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documento: datosClienteForm.documento || null,
          fecha_nacimiento: datosClienteForm.fecha_nacimiento || null,
          tipo_cliente_id: datosClienteForm.tipo_cliente_id || null,
        }),
      });
      const tipoSeleccionado = tiposCliente.find(t => t.id === datosClienteForm.tipo_cliente_id) ?? null;
      const updated = {
        ...entidadLocal,
        documento: datosClienteForm.documento || null,
        fecha_nacimiento: datosClienteForm.fecha_nacimiento || null,
        tipo_cliente_id: datosClienteForm.tipo_cliente_id || null,
        config_tipos_cliente: tipoSeleccionado,
      };
      setEntidadLocal(updated);
      onEntidadUpdated?.(updated);
      setEditingDatosCliente(false);
    } catch { } finally { setSavingDatosCliente(false); }
  }

  // Modal Places
  const [showPlaces, setShowPlaces] = useState(false);
  const [placesQuery, setPlacesQuery] = useState(entidad?.nombre ?? "");
  const [placesResults, setPlacesResults] = useState<any[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [savingCoords, setSavingCoords] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  async function buscarEnPlaces(q: string) {
    if (!q.trim()) return;
    setPlacesLoading(true);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setPlacesResults(json.results ?? []);
    } catch { setPlacesResults([]); } finally { setPlacesLoading(false); }
  }

  async function seleccionarLugar(lugar: any) {
    setSavingCoords(true);
    try {
      // Places devuelve "Calle X, 14700 Ciudad, Provincia" — parseamos
      const partes = (lugar.direccion ?? "").split(",").map((s: string) => s.trim());
      const calle = partes[0] ?? "";
      // buscar el trozo que tiene el CP (5 dígitos)
      const cpIdx = partes.findIndex((p: string) => /\d{5}/.test(p));
      const cpMatch = cpIdx >= 0 ? partes[cpIdx].match(/(\d{5})\s*(.*)/) : null;
      const cp = cpMatch?.[1] ?? "";
      const ciudad = cpMatch?.[2]?.trim() ?? (cpIdx >= 0 ? "" : partes[1] ?? "");
      const provincia = cpIdx >= 0 && cpIdx + 1 < partes.length ? partes[cpIdx + 1] : "";

      const nuevaDireccion = {
        direccion: calle,
        cp: cp || undefined,
        ciudad: ciudad || entidadLocal.direccion?.ciudad || undefined,
        provincia: provincia || entidadLocal.direccion?.provincia || undefined,
      };

      const res = await fetch(`/api/crm/entidades/${entidadLocal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: lugar.lat, lng: lugar.lng, direccion: nuevaDireccion }),
      });
      if (!res.ok) throw new Error("Error guardando coordenadas");
      const updated = { ...entidadLocal, lat: lugar.lat, lng: lugar.lng, direccion: nuevaDireccion };
      setEntidadLocal(updated);
      onEntidadUpdated?.(updated);
      setPlacesError(null);
      setShowPlaces(false);
    } catch (e: any) { setPlacesError(e.message ?? "Error guardando"); } finally { setSavingCoords(false); }
  }

  async function guardarEntidad() {
    setSavingEntidad(true);
    try {
      await fetch(`/api/crm/entidades/${entidadLocal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: entidadForm.nombre,
          telefono: entidadForm.telefono || null,
          otros_tlfs: entidadForm.otros_tlfs.filter(Boolean),
          email: entidadForm.email || null,
          otros_emails: entidadForm.otros_emails.filter(Boolean),
          direccion: {
            direccion: entidadForm.direccion || null,
            ciudad: entidadForm.ciudad || null,
            provincia: entidadForm.provincia || null,
            cp: entidadForm.cp || null,
          },
        }),
      });
      const updated = {
        ...entidadLocal,
        nombre: entidadForm.nombre,
        telefono: entidadForm.telefono || null,
        otros_tlfs: entidadForm.otros_tlfs.filter(Boolean),
        email: entidadForm.email || null,
        otros_emails: entidadForm.otros_emails.filter(Boolean),
        direccion: { direccion: entidadForm.direccion || null, ciudad: entidadForm.ciudad || null, provincia: entidadForm.provincia || null, cp: entidadForm.cp || null },
      };
      setEntidadLocal(updated);
      onEntidadUpdated?.(updated);
      setEditingEntidad(false);
    } catch { } finally { setSavingEntidad(false); }
  }

  useEffect(() => {
    if (!entidad?.id) { setLoading(false); return; }
    Promise.all([
      getEntidadHistorial(entidad.id),
      getEntidadResumen(entidad.id),
    ]).then(([rows, resumen]) => {
      setHistorial(rows as unknown as CampanaHistorialRow[]);
      setPresupuestos(resumen.presupuestos);
      setCotizaciones(resumen.cotizaciones);
      setExpedientes(resumen.expedientes);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [entidad?.id]);

  useEffect(() => {
    if (!entidad?.id) return;
    fetch(`/api/entidades/${entidad.id}/contactos`).then(r => r.json())
      .then(json => { if (json.success) setContactos(json.data); })
      .catch(() => {});
  }, [entidad?.id]);

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

  async function handleVincularContacto(contactoId: string) {
    if (!entidad?.id) return;
    setVinculandoId(contactoId);
    try {
      await fetch(`/api/entidades/${entidad.id}/contactos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacto_id: contactoId }),
      });
      const res = await fetch(`/api/entidades/${entidad.id}/contactos`);
      const json = await res.json();
      if (json.success) {
        setContactos(json.data);
        onEntidadUpdated?.({ ...entidadLocal, crm_contactos: json.data });
      }
      setContactoSearch("");
      setContactoResultados([]);
      setShowNuevoContacto(false);
    } catch { }
    finally { setVinculandoId(null); }
  }

  async function handleDesvincularContacto(contactoId: string) {
    if (!entidad?.id) return;
    const nuevosContactos = contactos.filter((c: any) => c.id !== contactoId);
    setContactos(nuevosContactos);
    onEntidadUpdated?.({ ...entidadLocal, crm_contactos: nuevosContactos });
    try {
      await fetch(`/api/entidades/${entidad.id}/contactos?contacto_id=${contactoId}`, { method: "DELETE" });
    } catch { }
  }

  function openEditContacto(c: any) {
    const meta = c.metadatos ?? {};
    const parts = (c.nombre ?? "").split(" ");
    setForm({
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
    });
    setEditingContactoId(c.id);
    setShowNuevoContacto(false);
  }

  function buildPayload() {
    const metadatos: Record<string, string> = {};
    if (form.apellido) metadatos.apellido = form.apellido;
    if (form.movil) metadatos.movil = form.movil;
    if (form.antiguedad) metadatos.antiguedad = form.antiguedad;
    if (form.desde) metadatos.desde = form.desde;
    if (form.anios_experiencia) metadatos.anios_experiencia = form.anios_experiencia;
    if (form.poder_decision) metadatos.poder_decision = form.poder_decision;
    if (form.estrategia) metadatos.estrategia = form.estrategia;
    if (form.horarios) metadatos.horarios = form.horarios;
    return {
      nombre: [form.nombre.trim(), form.apellido.trim()].filter(Boolean).join(" "),
      cargo: form.cargo.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      metadatos: Object.keys(metadatos).length ? metadatos : undefined,
    };
  }

  async function handleCrearContacto() {
    if (!form.nombre.trim() || !entidad?.id) return;
    setSavingContacto(true);
    try {
      const res = await fetch("/api/crm/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(), entidad_id: entidad.id }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const nuevosContactos = [...contactos, json.data];
        setContactos(nuevosContactos);
        onEntidadUpdated?.({ ...entidadLocal, crm_contactos: nuevosContactos });
        setForm(EMPTY_CONTACTO_FORM);
        setShowNuevoContacto(false);
      }
    } catch { }
    finally { setSavingContacto(false); }
  }

  async function handleEditarContacto() {
    if (!form.nombre.trim() || !editingContactoId) return;
    setSavingContacto(true);
    try {
      const res = await fetch(`/api/crm/contactos/${editingContactoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const nuevosContactos = contactos.map(c => c.id === editingContactoId ? json.data : c);
        setContactos(nuevosContactos);
        onEntidadUpdated?.({ ...entidadLocal, crm_contactos: nuevosContactos });
        setForm(EMPTY_CONTACTO_FORM);
        setEditingContactoId(null);
      }
    } catch { }
    finally { setSavingContacto(false); }
  }

  if (!entidad) return null;
  const dir = entidadLocal.direccion;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 1000 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 680, zIndex: 1001,
        background: "#fff",
        boxShadow: "-8px 0 32px rgba(15,23,42,0.12)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.25rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              {entidadLocal.config_tipos_cliente?.etiqueta ?? "Entidad"}
            </div>
            {editingNombre ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  autoFocus
                  value={nombreDraft}
                  onChange={e => setNombreDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") { setNombreDraft(entidadLocal.nombre ?? ""); setEditingNombre(false); } }}
                  disabled={savingNombre}
                  style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", border: "1.5px solid var(--primary-color, #475569)", borderRadius: 6, padding: "0.15rem 0.4rem", flex: 1, minWidth: 0 }}
                />
                <button type="button" onClick={guardarNombre} disabled={savingNombre} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 22, padding: "0 0.5rem", border: "none", borderRadius: 5, background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", flexShrink: 0, fontSize: "0.7rem", fontWeight: 600 }}>
                  Ok
                </button>
              </div>
            ) : (
              <h2
                onClick={() => { setNombreDraft(entidadLocal.nombre ?? ""); setEditingNombre(true); }}
                onMouseEnter={() => setHoveredEntidad(true)}
                onMouseLeave={() => setHoveredEntidad(false)}
                style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.3, margin: 0, wordBreak: "break-word", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {entidadLocal.nombre}
                <Pencil size={11} style={{ color: "#94a3b8", opacity: hoveredEntidad ? 1 : 0, transition: "opacity 0.12s", flexShrink: 0 }} />
              </h2>
            )}
            <div ref={entidadAgenteRef} style={{ position: "relative", marginTop: 6 }}>
              <div
                onClick={abrirEntidadAgentePicker}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "2px 4px", marginLeft: -4, borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <IdCard size={15} color="#64748b" style={{ flexShrink: 0 }} />
                {entidadLocal.crm_agentes ? (
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                    <strong style={{ color: "#334155" }}>{entidadLocal.crm_agentes.nombre} {entidadLocal.crm_agentes.apellidos}</strong>
                    {entidadAgenteSucursal && <> / {entidadAgenteSucursal}</>}
                  </span>
                ) : (
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontStyle: "italic" }}>Sin agente asignado</span>
                )}
              </div>

              {showEntidadAgentePicker && (
                <div
                  style={{
                    position: "absolute", top: "100%", left: -4, marginTop: 4,
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                    boxShadow: "0 8px 32px rgba(15,23,42,0.14)", zIndex: 9999,
                    minWidth: 200, maxHeight: 260, overflowY: "auto", padding: "0.3rem 0", fontSize: "0.8rem",
                  }}
                >
                  {loadingAgentesAgencia ? (
                    <div style={{ padding: "0.5rem 0.85rem", color: "#94a3b8" }}>Cargando…</div>
                  ) : agentesAgencia.length === 0 ? (
                    <div style={{ padding: "0.5rem 0.85rem", color: "#94a3b8" }}>Sin agentes</div>
                  ) : (
                    agentesAgencia.map(ag => {
                      const isSelected = entidadLocal.agente_id === ag.id;
                      return (
                        <div
                          key={ag.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "0.4rem 0.85rem", cursor: "pointer",
                            background: isSelected ? "color-mix(in srgb, var(--primary-color, #475569) 10%, white)" : undefined,
                            fontWeight: isSelected ? 600 : 400, color: "#1e293b",
                          }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = ""; }}
                          onClick={() => handleEntidadAgenteChange(ag.id)}
                        >
                          <span className={styles.agenteCircle} style={{ width: 22, height: 22, fontSize: "0.6rem", flexShrink: 0 }}>
                            {initials(ag.nombre, ag.apellidos)}
                          </span>
                          <span>
                            {ag.nombre} {ag.apellidos}
                            {ag.sucursal && <span style={{ color: "#94a3b8", fontWeight: 400 }}> / {ag.sucursal}</span>}
                          </span>
                        </div>
                      );
                    })
                  )}
                  {entidadLocal.agente_id && (
                    <div
                      style={{ padding: "0.3rem 0.85rem", cursor: "pointer", color: "#ef4444", fontSize: "0.74rem", borderTop: "1px solid #f1f5f9", marginTop: 2 }}
                      onClick={() => handleEntidadAgenteChange(null)}
                    >
                      Quitar agente
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "#f1f5f9", borderRadius: "0.4rem", cursor: "pointer", color: "#64748b", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Datos del cliente: NIF/CIF, fecha de nacimiento, fecha de alta */}
          <section
            onMouseEnter={() => setHoveredDatosCliente(true)}
            onMouseLeave={() => setHoveredDatosCliente(false)}
            style={{ position: "relative" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Datos del cliente</div>
              {!editingDatosCliente && (
                <button
                  type="button"
                  onClick={() => {
                    setDatosClienteForm({
                      documento: entidadLocal.documento ?? "",
                      fecha_nacimiento: entidadLocal.fecha_nacimiento ?? "",
                      tipo_cliente_id: entidadLocal.tipo_cliente_id ?? "",
                    });
                    setEditingDatosCliente(true);
                  }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, border: "none", borderRadius: 5, background: "#e2e8f0", color: "#64748b", cursor: "pointer", opacity: hoveredDatosCliente ? 1 : 0, transition: "opacity 0.12s" }}
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>

            {editingDatosCliente ? (
              <div style={{ border: "1.5px solid var(--primary-color, #475569)", borderRadius: "0.75rem", padding: "1rem", background: "#fff", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Tipo de cliente</label>
                    <select
                      value={datosClienteForm.tipo_cliente_id}
                      onChange={e => setDatosClienteForm(p => ({ ...p, tipo_cliente_id: e.target.value }))}
                      style={inp}
                    >
                      <option value="">Sin especificar</option>
                      {tiposCliente.map(t => (
                        <option key={t.id} value={t.id}>{t.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>NIF/CIF</label>
                    <input value={datosClienteForm.documento} onChange={setDCF("documento")} style={inp} placeholder="12345678A / B12345678" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Fecha de nacimiento</label>
                    <input type="date" value={datosClienteForm.fecha_nacimiento} onChange={setDCF("fecha_nacimiento")} style={inp} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setEditingDatosCliente(false)} style={{ fontSize: "0.75rem", padding: "0.35rem 0.85rem", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                  <button type="button" onClick={guardarDatosCliente} disabled={savingDatosCliente} style={{ fontSize: "0.75rem", padding: "0.35rem 0.85rem", borderRadius: 6, border: "none", background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", opacity: savingDatosCliente ? 0.6 : 1 }}>
                    {savingDatosCliente ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", fontSize: "0.8rem" }}>
                <div>
                  <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tipo de cliente</div>
                  <div style={{ color: entidadLocal.config_tipos_cliente?.etiqueta ? "#1e293b" : "#94a3b8", fontStyle: entidadLocal.config_tipos_cliente?.etiqueta ? "normal" : "italic" }}>
                    {entidadLocal.config_tipos_cliente?.etiqueta ?? "Sin especificar"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>NIF/CIF</div>
                  <div style={{ color: entidadLocal.documento ? "#1e293b" : "#94a3b8", fontStyle: entidadLocal.documento ? "normal" : "italic" }}>{entidadLocal.documento ?? "Sin especificar"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Fecha de nacimiento</div>
                  <div style={{ color: entidadLocal.fecha_nacimiento ? "#1e293b" : "#94a3b8", fontStyle: entidadLocal.fecha_nacimiento ? "normal" : "italic" }}>
                    {entidadLocal.fecha_nacimiento ? new Date(entidadLocal.fecha_nacimiento).toLocaleDateString("es-ES") : "Sin especificar"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Fecha de alta</div>
                  <div style={{ color: "#1e293b" }}>
                    {entidadLocal.created_at ? new Date(entidadLocal.created_at).toLocaleDateString("es-ES") : "—"}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Dirección + mapa + teléfono + email */}
          <section
            onMouseEnter={() => setHoveredEntidad(true)}
            onMouseLeave={() => setHoveredEntidad(false)}
            style={{ position: "relative" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dirección</div>
              {!editingEntidad && (
                <button
                  type="button"
                  onClick={() => {
                    setEntidadForm({
                      nombre: entidadLocal.nombre ?? "",
                      telefono: entidadLocal.telefono ?? "",
                      otros_tlfs: entidadLocal.otros_tlfs ?? [],
                      email: entidadLocal.email ?? "",
                      otros_emails: entidadLocal.otros_emails ?? [],
                      direccion: entidadLocal.direccion?.direccion ?? entidadLocal.direccion?.calle ?? "",
                      ciudad: entidadLocal.direccion?.ciudad ?? entidadLocal.direccion?.localidad ?? "",
                      provincia: entidadLocal.direccion?.provincia ?? "",
                      cp: entidadLocal.direccion?.cp ?? entidadLocal.direccion?.codigo_postal ?? "",
                    });
                    setEditingEntidad(true);
                  }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, border: "none", borderRadius: 5, background: "#e2e8f0", color: "#64748b", cursor: "pointer", opacity: hoveredEntidad ? 1 : 0, transition: "opacity 0.12s" }}
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>

            {editingEntidad ? (
              <div style={{ border: "1.5px solid var(--primary-color, #475569)", borderRadius: "0.75rem", padding: "1rem", background: "#fff", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)" }}>Editar datos del centro</div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Nombre</label>
                    <input value={entidadForm.nombre} onChange={setEF("nombre")} style={inp} />
                  </div>
                </div>
                {/* Teléfonos */}
                <div>
                  <label style={lbl}>Teléfonos</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <input value={entidadForm.telefono} onChange={setEF("telefono")} style={{ ...inp, flex: 1 }} placeholder="Ej: 957123456" />
                    </div>
                    {entidadForm.otros_tlfs.map((t, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <input
                          value={t}
                          onChange={e => setEntidadForm(p => { const arr = [...p.otros_tlfs]; arr[i] = e.target.value; return { ...p, otros_tlfs: arr }; })}
                          style={{ ...inp, flex: 1 }}
                          placeholder="Teléfono adicional"
                        />
                        <button type="button" onClick={() => setEntidadForm(p => ({ ...p, otros_tlfs: p.otros_tlfs.filter((_, j) => j !== i) }))} style={{ display: "flex", alignItems: "center", padding: "0.3rem", border: "none", background: "#fee2e2", borderRadius: 5, cursor: "pointer", color: "#dc2626", flexShrink: 0 }}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setEntidadForm(p => ({ ...p, otros_tlfs: [...p.otros_tlfs, ""] }))} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "var(--primary-color, #475569)", background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0" }}>
                      <Plus size={12} /> Añadir teléfono
                    </button>
                  </div>
                </div>
                {/* Emails */}
                <div>
                  <label style={lbl}>Emails</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <input value={entidadForm.email} onChange={setEF("email")} style={{ ...inp, flex: 1 }} placeholder="centro@ejemplo.com" />
                    </div>
                    {entidadForm.otros_emails.map((e, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <input
                          value={e}
                          onChange={ev => setEntidadForm(p => { const arr = [...p.otros_emails]; arr[i] = ev.target.value; return { ...p, otros_emails: arr }; })}
                          style={{ ...inp, flex: 1 }}
                          placeholder="Email adicional"
                        />
                        <button type="button" onClick={() => setEntidadForm(p => ({ ...p, otros_emails: p.otros_emails.filter((_, j) => j !== i) }))} style={{ display: "flex", alignItems: "center", padding: "0.3rem", border: "none", background: "#fee2e2", borderRadius: 5, cursor: "pointer", color: "#dc2626", flexShrink: 0 }}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setEntidadForm(p => ({ ...p, otros_emails: [...p.otros_emails, ""] }))} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "var(--primary-color, #475569)", background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0" }}>
                      <Plus size={12} /> Añadir email
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 2 }}>
                    <label style={lbl}>Dirección</label>
                    <input value={entidadForm.direccion} onChange={setEF("direccion")} style={inp} placeholder="Calle y número" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>CP</label>
                    <input value={entidadForm.cp} onChange={setEF("cp")} style={inp} placeholder="14700" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Ciudad</label>
                    <input value={entidadForm.ciudad} onChange={setEF("ciudad")} style={inp} placeholder="Ej: Córdoba" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Provincia</label>
                    <input value={entidadForm.provincia} onChange={setEF("provincia")} style={inp} placeholder="Ej: Córdoba" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setEditingEntidad(false)} style={{ padding: "0.35rem 0.9rem", fontSize: "0.78rem", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                  <button type="button" onClick={guardarEntidad} disabled={savingEntidad} style={{ padding: "0.35rem 0.9rem", fontSize: "0.78rem", border: "none", borderRadius: 6, background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", opacity: savingEntidad ? 0.6 : 1 }}>
                    {savingEntidad ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                {entidadLocal.lat && entidadLocal.lng
                  ? <EntidadMapaDynamic lat={entidadLocal.lat} lng={entidadLocal.lng} nombre={entidadLocal.nombre} />
                  : (
                    <button
                      type="button"
                      onClick={() => { setPlacesQuery(entidadLocal.nombre ?? ""); setPlacesResults([]); setPlacesError(null); setShowPlaces(true); }}
                      title="Buscar ubicación en Google Maps"
                      style={{ all: "unset", cursor: "pointer", flexShrink: 0 }}
                    >
                      <EntidadMapaPlaceholder />
                    </button>
                  )
                }
                <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.6, flex: 1 }}>
                  {dir && typeof dir === "string" && <div>{dir}</div>}
                  {dir && typeof dir === "object" && (() => {
                    const calle = dir.direccion || dir.calle || "";
                    const cp = dir.cp || dir.codigo_postal || "";
                    const ciudad = dir.ciudad || dir.localidad || "";
                    const provincia = dir.provincia || "";
                    const linea2 = [cp, ciudad, provincia].filter(Boolean).join(", ");
                    if (!calle && !linea2) return null;
                    return (
                      <>
                        {calle && <div>{calle}</div>}
                        {linea2 && <div style={{ color: "#64748b" }}>{linea2}</div>}
                      </>
                    );
                  })()}
                  {entidadLocal.telefono && (
                    <div style={{ marginTop: "0.35rem" }}>
                      <a href={`tel:${entidadLocal.telefono}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--primary-color, #475569)", textDecoration: "none" }}>
                        <Phone size={13} /> {entidadLocal.telefono}
                      </a>
                    </div>
                  )}
                  {entidadLocal.otros_tlfs?.map((t: string, i: number) => (
                    <div key={i} style={{ marginTop: "0.2rem" }}>
                      <a href={`tel:${t}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--primary-color, #475569)", textDecoration: "none" }}>
                        <Phone size={13} /> {t}
                      </a>
                    </div>
                  ))}
                  {entidadLocal.email && (
                    <div style={{ marginTop: "0.35rem" }}>
                      <a href={`mailto:${entidadLocal.email}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--primary-color, #475569)", textDecoration: "none" }}>
                        <Mail size={13} /> {entidadLocal.email}
                      </a>
                    </div>
                  )}
                  {entidadLocal.otros_emails?.map((e: string, i: number) => (
                    <div key={i} style={{ marginTop: "0.2rem" }}>
                      <a href={`mailto:${e}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--primary-color, #475569)", textDecoration: "none" }}>
                        <Mail size={13} /> {e}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Contactos (no aplica a clientes tipo Persona) */}
          {entidadLocal.config_tipos_cliente?.etiqueta !== "Persona" && (
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Contactos {contactos.length > 0 && `(${contactos.length})`}
              </div>
              {!showNuevoContacto && !editingContactoId && (
                <button
                  type="button"
                  onClick={() => setShowNuevoContacto(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 600, color: "var(--primary-color, #475569)", background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0.3rem", borderRadius: 4 }}
                >
                  <Plus size={12} /> Añadir
                </button>
              )}
            </div>

            {(showNuevoContacto || editingContactoId) && (
              <div style={{ border: `1.5px solid ${editingContactoId ? "var(--primary-color, #475569)" : "#e2e8f0"}`, borderRadius: "0.75rem", padding: "1rem", marginBottom: "0.75rem", background: "#fff", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: editingContactoId ? "var(--primary-color, #475569)" : "#334155" }}>
                  {editingContactoId ? "Editar contacto" : "Nuevo contacto"}
                </div>

                {!editingContactoId && (
                  <div style={{ position: "relative" }}>
                    <label style={lbl}>¿Ya existe este contacto?</label>
                    <input
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
                          const yaVinculado = contactos.some((ct: any) => ct.id === c.id);
                          const entidadesActivas = (c.crm_contactos_organizaciones ?? [])
                            .filter((o: any) => o.es_activa)
                            .map((o: any) => o.contabilidad_entidades?.nombre)
                            .filter(Boolean);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              disabled={yaVinculado || vinculandoId === c.id}
                              onClick={() => handleVincularContacto(c.id)}
                              style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "0.5rem 0.65rem", border: "none", borderBottom: "1px solid #f1f5f9", background: "#fff", cursor: yaVinculado ? "default" : "pointer", textAlign: "left", opacity: yaVinculado ? 0.5 : 1 }}
                              onMouseEnter={ev => { if (!yaVinculado) ev.currentTarget.style.background = "#f8fafc"; }}
                              onMouseLeave={ev => (ev.currentTarget.style.background = "#fff")}
                            >
                              <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "#1e293b" }}>{c.nombre}{c.cargo ? ` · ${c.cargo}` : ""}</span>
                              <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                                {yaVinculado ? "Ya vinculado a este cliente" : entidadesActivas.length > 0 ? `Actualmente en: ${entidadesActivas.join(", ")}` : "Sin cliente asignado"}
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

                {/* Identificación */}
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Nombre *</label>
                    <input autoFocus placeholder="Nombre del responsable" value={form.nombre} onChange={setF("nombre")} style={inp} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Apellido</label>
                    <input placeholder="Apellido del responsable" value={form.apellido} onChange={setF("apellido")} style={inp} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Cargo</label>
                    <input placeholder="Ej: Director, Jefe de Estudios..." value={form.cargo} onChange={setF("cargo")} style={inp} />
                  </div>
                </div>

                {/* Información de Contacto */}
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 5 }}>
                    <Phone size={13} /> Información de Contacto
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Teléfono</label>
                      <input placeholder="+34 123 456 789" value={form.telefono} onChange={setF("telefono")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Móvil</label>
                      <input placeholder="657197072 (solo números)" value={form.movil} onChange={setF("movil")} style={inp} />
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 2 }}>Solo números, sin espacios ni caracteres especiales</div>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Email</label>
                    <input placeholder="responsable@centro.edu" value={form.email} onChange={setF("email")} style={{ ...inp, paddingLeft: "1.6rem" }} />
                  </div>
                </div>

                {/* Información Profesional */}
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 5 }}>
                    <Building2 size={13} /> Información Profesional
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Antigüedad</label>
                      <input placeholder="Ej: 5 años, 2 meses" value={form.antiguedad} onChange={setF("antiguedad")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Desde</label>
                      <input placeholder="Ej: Septiembre 2020" value={form.desde} onChange={setF("desde")} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Años de Experiencia</label>
                      <input type="number" min={0} placeholder="0" value={form.anios_experiencia} onChange={setF("anios_experiencia")} style={inp} />
                    </div>
                  </div>
                </div>

                {/* Información Adicional */}
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 5 }}>
                    <Info size={13} /> Información Adicional
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Poder de Decisión</label>
                      <input placeholder="Ej: Alto, Medio, Bajo" value={form.poder_decision} onChange={setF("poder_decision")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Horarios</label>
                      <textarea placeholder="Horarios de disponibilidad..." value={form.horarios} onChange={setF("horarios")} rows={2} style={{ ...inp, resize: "vertical" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}><Rocket size={12} /> Estrategia</label>
                    <textarea placeholder="Estrategia o enfoque del responsable..." value={form.estrategia} onChange={setF("estrategia")} rows={3} style={{ ...inp, resize: "vertical" }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
                  <button type="button" onClick={() => { setShowNuevoContacto(false); setEditingContactoId(null); setForm(EMPTY_CONTACTO_FORM); }} style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                  <button type="button" onClick={editingContactoId ? handleEditarContacto : handleCrearContacto} disabled={savingContacto || !form.nombre.trim()} style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: 6, border: "none", background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", opacity: savingContacto || !form.nombre.trim() ? 0.5 : 1 }}>
                    {savingContacto ? "Guardando…" : editingContactoId ? "Actualizar" : "Guardar contacto"}
                  </button>
                </div>
              </div>
            )}

            {contactos.length === 0 && !showNuevoContacto && !editingContactoId ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin contactos</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {contactos.map(c => {
                  const isEditing = editingContactoId === c.id;
                  return (
                    <div
                      key={c.id}
                      onMouseEnter={() => setHoveredContactoId(c.id)}
                      onMouseLeave={() => setHoveredContactoId(null)}
                      style={{ background: isEditing ? "#f0f4ff" : "#f8fafc", borderRadius: "0.6rem", padding: "0.65rem 0.85rem", position: "relative", border: isEditing ? "1.5px solid var(--primary-color, #475569)" : "1.5px solid transparent" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>{c.nombre || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin nombre</span>}</div>
                          {c.cargo && <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 1 }}>{c.cargo}</div>}
                          <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: 2 }}>
                            {c.telefono && c.telefono !== "0" && (
                              <a href={`tel:${c.telefono}`} style={{ fontSize: "0.75rem", color: "var(--primary-color, #475569)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                                <Phone size={11} /> {c.telefono}
                              </a>
                            )}
                            {c.metadatos?.movil && (
                              <a href={`tel:${c.metadatos.movil}`} style={{ fontSize: "0.75rem", color: "var(--primary-color, #475569)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                                <Phone size={11} /> {c.metadatos.movil} <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>(móvil)</span>
                              </a>
                            )}
                            {c.email && (
                              <a href={`mailto:${c.email}`} style={{ fontSize: "0.75rem", color: "var(--primary-color, #475569)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                                <Mail size={11} /> {c.email}
                              </a>
                            )}
                            {(c.metadatos?.poder_decision || c.metadatos?.horarios) && (
                              <div style={{ display: "flex", gap: "0.75rem", marginTop: 2 }}>
                                {c.metadatos?.poder_decision && (
                                  <span style={{ fontSize: "0.72rem", color: "#475569" }}>
                                    <span style={{ fontWeight: 600, color: "#94a3b8", fontSize: "0.65rem", textTransform: "uppercase" }}>Decisión: </span>{c.metadatos.poder_decision}
                                  </span>
                                )}
                                {c.metadatos?.horarios && (
                                  <span style={{ fontSize: "0.72rem", color: "#475569" }}>
                                    <span style={{ fontWeight: 600, color: "#94a3b8", fontSize: "0.65rem", textTransform: "uppercase" }}>Horarios: </span>{c.metadatos.horarios}
                                  </span>
                                )}
                              </div>
                            )}
                            {c.metadatos?.estrategia && (
                              <div style={{ marginTop: 4, fontSize: "0.75rem", color: "#334155", background: "#f0f4ff", borderRadius: 5, padding: "0.3rem 0.5rem", borderLeft: "2.5px solid var(--primary-color, #475569)", display: "flex", gap: 5, alignItems: "flex-start" }}>
                                <Rocket size={11} style={{ flexShrink: 0, marginTop: 2, color: "var(--primary-color, #475569)" }} />
                                <span>{c.metadatos.estrategia}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="contacto-edit-btn"
                            onClick={() => isEditing ? (setEditingContactoId(null), setForm(EMPTY_CONTACTO_FORM)) : openEditContacto(c)}
                            title={isEditing ? "Cancelar edición" : "Editar contacto"}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, border: "none", borderRadius: 5, background: isEditing ? "var(--primary-color, #475569)" : "#e2e8f0", color: isEditing ? "#fff" : "#64748b", cursor: "pointer", opacity: (isEditing || hoveredContactoId === c.id) ? 1 : 0, transition: "opacity 0.12s" }}
                          >
                            {isEditing ? <X size={12} /> : <Pencil size={12} />}
                          </button>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => handleDesvincularContacto(c.id)}
                              title="Quitar de este cliente (el contacto no se elimina)"
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, border: "none", borderRadius: 5, background: "#fee2e2", color: "#dc2626", cursor: "pointer", opacity: hoveredContactoId === c.id ? 1 : 0, transition: "opacity 0.12s" }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {/* Campañas */}
          <section>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Campañas {!loading && historial.length > 0 && `(${historial.length})`}
            </div>
            {loading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Cargando...</div>
            ) : historial.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin campañas registradas</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ ...th, width: 30 }}></th>
                    <th style={th}>Campaña</th>
                    <th style={th}>Estado</th>
                    <th style={{ ...th, textAlign: "center" }}>P</th>
                    <th style={{ ...th, textAlign: "right" }}>Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h, i) => {
                    const estado = h.crm_campanas_estados;
                    const ag = h.crm_agentes;
                    return (
                      <tr key={h.id} style={{ borderBottom: i < historial.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                        <td style={{ ...td, width: 30 }}>
                          <span
                            className={styles.agenteCircle}
                            title={ag ? `${ag.nombre} ${ag.apellidos}` : "Sin agente"}
                            style={{ width: 22, height: 22, fontSize: "0.56rem", cursor: "pointer", opacity: ag ? 1 : 0.35, outline: agentePickerRowId === h.id ? "2px solid var(--primary-color, #475569)" : undefined, outlineOffset: 2 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (agentePickerRowId === h.id) { setAgentePickerRowId(null); setAgentePickerPos(null); return; }
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setAgentePickerPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                              setAgentePickerRowId(h.id);
                            }}
                          >
                            {ag ? initials(ag.nombre, ag.apellidos) : "—"}
                          </span>
                        </td>
                        <td style={td} title={h.crm_campanas?.nombre ?? ""}>{h.crm_campanas?.nombre ?? "—"}</td>
                        <td style={{ ...td, paddingLeft: "0.5rem" }}>
                          {estado ? <span style={{ display: "inline-flex", alignItems: "center", height: 18, borderRadius: 99, background: estado.color, color: "#fff", fontSize: "0.62rem", fontWeight: 600, padding: "0 7px", whiteSpace: "nowrap" }}>{estado.nombre}</span> : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "center", paddingLeft: "0.5rem" }}>{h.prioridad ?? "—"}</td>
                        <td style={{ ...td, textAlign: "right", paddingLeft: "0.5rem" }}>{h.valor_estimado ? `${h.valor_estimado.toLocaleString("es-ES")} €` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {/* Presupuestos */}
          <section>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Presupuestos {!loading && presupuestos.length > 0 && `(${presupuestos.length})`}
            </div>
            {loading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Cargando...</div>
            ) : presupuestos.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin presupuestos</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <th style={th}>Título</th>
                    <th style={th}>Tipo</th>
                    <th style={{ ...th, textAlign: "left" }}>Estado</th>
                    <th style={{ ...th, textAlign: "right" }}>PVP est.</th>
                    <th style={{ ...th, textAlign: "right" }}>Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuestos.map((p: any, i: number) => (
                    <tr key={p.id} style={{ borderBottom: i < presupuestos.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                      <td style={td} title={p.titulo_viaje}>{p.titulo_viaje}</td>
                      <td style={{ ...td, color: "#64748b", fontSize: "0.72rem" }}>{p.tipo_presupuesto ?? "—"}</td>
                      <td style={{ ...td }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 600, color: p.estado === "cotizado" ? "#16a34a" : p.estado === "descartado" ? "#dc2626" : "#475569" }}>
                          {p.estado ?? "—"}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{p.pvp_estimado ? `${Number(p.pvp_estimado).toLocaleString("es-ES")} €` : "—"}</td>
                      <td style={{ ...td, textAlign: "right", color: "#64748b", fontSize: "0.72rem" }}>{p.fecha_salida_estimada ? new Date(p.fecha_salida_estimada).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Cotizaciones */}
          <section>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Cotizaciones {!loading && cotizaciones.length > 0 && `(${cotizaciones.length})`}
            </div>
            {loading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Cargando...</div>
            ) : cotizaciones.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin cotizaciones</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <th style={th}>Título</th>
                    <th style={{ ...th, textAlign: "left" }}>Estado</th>
                    <th style={{ ...th, textAlign: "right" }}>Plazas</th>
                    <th style={{ ...th, textAlign: "right" }}>PVP/pax</th>
                    <th style={{ ...th, textAlign: "right" }}>Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map((c: any, i: number) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/cotizaciones/nueva?id=${c.id}`)}
                      style={{ borderBottom: i < cotizaciones.length - 1 ? "1px solid #f1f5f9" : undefined, cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ ...td, color: "var(--primary-color, #475569)", fontWeight: 600 }} title={c.titulo}>{c.titulo ?? "—"}</td>
                      <td style={{ ...td }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 600, color: c.estado === "aceptada" ? "#16a34a" : c.estado === "rechazada" ? "#dc2626" : c.estado === "presentada" ? "#d97706" : "#475569" }}>
                          {c.estado ?? "—"}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "#64748b" }}>{c.plazas ?? "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{c.pvp_viajero ? `${Number(c.pvp_viajero).toLocaleString("es-ES")} €` : "—"}</td>
                      <td style={{ ...td, textAlign: "right", color: "#64748b", fontSize: "0.72rem" }}>{c.fecha_salida ? new Date(c.fecha_salida).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Expedientes */}
          <section>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Expedientes {!loading && expedientes.length > 0 && `(${expedientes.length})`}
            </div>
            {loading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Cargando...</div>
            ) : expedientes.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin expedientes</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <th style={th}>Nº</th>
                    <th style={{ ...th, textAlign: "left" }}>Expediente</th>
                    <th style={{ ...th, textAlign: "left" }}>Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {expedientes.map((e: any, i: number) => (
                    <tr
                      key={e.id}
                      onClick={() => router.push(`/expedientes/${e.id}`)}
                      style={{ borderBottom: i < expedientes.length - 1 ? "1px solid #f1f5f9" : undefined, cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ ...td, color: "var(--primary-color, #475569)", fontWeight: 600 }}>{e.numero ? `#${e.numero}` : "—"}</td>
                      <td style={{ ...td }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{e.contabilidad_entidades?.nombre ?? "—"}</div>
                        {e.referencia && <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{e.referencia}</div>}
                      </td>
                      <td style={{ ...td }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(e.roles ?? []).filter((rol: string) => rol !== "Tutor").map((rol: string) => (
                            <span key={rol} style={{ fontSize: "0.62rem", fontWeight: 600, padding: "1px 6px", borderRadius: 999, background: "#eef2ff", color: "#4338ca" }}>
                              {rol}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Etiquetas */}
          {entidadLocal.id && (
            <section>
              <EtiquetasSelector label="Etiquetas" entidadId={entidadLocal.id} />
            </section>
          )}
        </div>
      </div>

      {/* Modal búsqueda Google Places */}
      {showPlaces && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => setShowPlaces(false)}>
          <div style={{ background: "#fff", borderRadius: "1rem", padding: "1.5rem", width: 480, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: "1rem" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Buscar ubicación</div>
              <button type="button" onClick={() => setShowPlaces(false)} style={{ border: "none", background: "#f1f5f9", borderRadius: 5, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}><X size={14} /></button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                autoFocus
                value={placesQuery}
                onChange={e => setPlacesQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") buscarEnPlaces(placesQuery); }}
                placeholder="Nombre o dirección del centro..."
                style={{ ...inp, flex: 1 }}
              />
              <button type="button" onClick={() => buscarEnPlaces(placesQuery)} disabled={placesLoading} style={{ padding: "0.35rem 0.9rem", fontSize: "0.78rem", border: "none", borderRadius: 6, background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: placesLoading ? 0.6 : 1 }}>
                {placesLoading ? "…" : "Buscar"}
              </button>
            </div>
            {placesResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 320, overflowY: "auto" }}>
                {placesResults.map((r: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => seleccionarLugar(r)}
                    disabled={savingCoords}
                    style={{ all: "unset", cursor: "pointer", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>{r.nombre}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{r.direccion}</div>
                  </button>
                ))}
              </div>
            )}
            {!placesLoading && placesResults.length === 0 && placesQuery && (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic", textAlign: "center" }}>Sin resultados. Prueba con otro nombre.</div>
            )}
            {placesError && (
              <div style={{ color: "#ef4444", fontSize: "0.75rem", textAlign: "center" }}>{placesError}</div>
            )}
          </div>
        </div>
      )}

      {agentePickerRowId && agentePickerPos && (() => {
        const row = historial.find(h => h.id === agentePickerRowId);
        if (!row) return null;
        const pool = agentesAgencia;
        return (
          <div
            ref={agentePickerRef}
            style={{
              position: "fixed", top: agentePickerPos.top, left: agentePickerPos.left,
              transform: "translateX(-50%)",
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
              boxShadow: "0 8px 32px rgba(15,23,42,0.14)", zIndex: 99999,
              minWidth: 180, padding: "0.3rem 0", fontSize: "0.8rem",
            }}
          >
            {pool.map(ag => {
              const isSelected = row.agente_id === ag.id;
              return (
                <div
                  key={ag.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "0.4rem 0.85rem", cursor: "pointer",
                    background: isSelected ? "color-mix(in srgb, var(--primary-color, #475569) 10%, white)" : undefined,
                    fontWeight: isSelected ? 600 : 400, color: "#1e293b",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = ""; }}
                  onClick={() => { handleHistorialAgenteChange(row, ag.id); setAgentePickerRowId(null); setAgentePickerPos(null); }}
                >
                  <span className={styles.agenteCircle} style={{ width: 24, height: 24, fontSize: "0.62rem", flexShrink: 0 }}>
                    {initials(ag.nombre, ag.apellidos)}
                  </span>
                  {ag.nombre} {ag.apellidos}
                </div>
              );
            })}
            {row.agente_id && (
              <div
                style={{ padding: "0.3rem 0.85rem", cursor: "pointer", color: "#ef4444", fontSize: "0.74rem", borderTop: "1px solid #f1f5f9", marginTop: 2 }}
                onClick={() => { handleHistorialAgenteChange(row, null); setAgentePickerRowId(null); setAgentePickerPos(null); }}
              >
                Quitar agente
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
}
