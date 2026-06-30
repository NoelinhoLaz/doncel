"use client";

import styles from "./page.module.css";
import { Search, Plus, Calendar, X, GripVertical, Copy, ChevronDown, Flame, Pencil, Check, Settings, Trash2 } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAgencyUsers } from "@/actions/agencias";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Error de red");
  return json;
}

type EstadoSegmento = { id: string; nombre: string; color: string; valor: number; pct: number };

type AgenteRow = {
  agente_id: string;
  nombre: string;
  objetivo: number;
  conseguido: number;
  potencial: number;
  numOport: number;
  numConseguido: number;
  segmentos: EstadoSegmento[];
};

type Campana = {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: "activa" | "finalizada" | "planificada";
  // calculados en cliente
  potencial: number;
  conseguido: number;
  objetivo: number;
  numOport: number;
  numConseguido: number;
  agentes: AgenteRow[];
  segmentos: EstadoSegmento[];
  // relaciones raw
  crm_campanas_agentes?: { agente_id: string; objetivo_valor: number | null; crm_agentes?: { nombre: string; apellidos: string } | null }[];
  crm_campanas_estados?: { id: string; nombre: string; color: string; orden: number; es_ganado: boolean }[];
  crm_oportunidades?: { valor_estimado: number; estado_id: string | null; agente_id: string | null }[];
};

type Fase = {
  id: string;
  nombre: string;
  color: string;
};

const FASES_DEFAULT: Fase[] = [
  { id: "pdtVisitar",  nombre: "Pdt. Visitar",  color: "#7c3aed" },
  { id: "visitando",   nombre: "Visitando",      color: "#e8650a" },
  { id: "pdtCotizar",  nombre: "Pdt. Cotizar",   color: "#0ea5c8" },
  { id: "cotizado",    nombre: "Cotizado",        color: "#0ea5c8" },
  { id: "revision",    nombre: "Revisión",        color: "#eab308" },
  { id: "aceptado",    nombre: "Aceptado",        color: "#db2777" },
  { id: "denegado",    nombre: "Denegado",        color: "#374151" },
  { id: "impCotizar",  nombre: "Imp. Cotizar",   color: "#374151" },
];

function formatFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function normalizeCampana(c: any): Campana {
  const ganadorIds = new Set(
    (c.crm_campanas_estados ?? [])
      .filter((e: any) => e.es_ganado)
      .map((e: any) => e.id)
  );
  const oports: any[] = c.crm_oportunidades ?? [];
  const potencial  = oports.reduce((s: number, r: any) => s + (Number(r.valor_estimado) || 0), 0);
  const conseguido = oports.reduce((s: number, r: any) =>
    ganadorIds.has(r.estado_id) ? s + (Number(r.valor_estimado) || 0) : s, 0);
  const objetivo   = (c.crm_campanas_agentes ?? []).reduce((s: number, a: any) => s + (Number(a.objetivo_valor) || 0), 0);
  const numOport      = oports.length;
  const numConseguido = oports.filter((r: any) => ganadorIds.has(r.estado_id)).length;

  const estadosOrdenados = [...(c.crm_campanas_estados ?? [])].sort((a: any, b: any) => a.orden - b.orden);

  function calcSegmentos(ops: any[]): EstadoSegmento[] {
    const segs = estadosOrdenados
      .map((e: any) => {
        const valor = ops
          .filter((o: any) => o.estado_id === e.id)
          .reduce((s: number, o: any) => s + (Number(o.valor_estimado) || 0), 0);
        return { id: e.id, nombre: e.nombre, color: e.color, valor, pct: 0 };
      })
      .filter((s: EstadoSegmento) => s.valor > 0);
    const total = segs.reduce((s, seg) => s + seg.valor, 0);
    if (total > 0) segs.forEach(s => { s.pct = (s.valor / total) * 100; });
    return segs;
  }

  const agentes: AgenteRow[] = (c.crm_campanas_agentes ?? []).map((a: any) => {
    const misOports = oports.filter((o: any) => o.agente_id === a.agente_id);
    const ag = a.crm_agentes;
    return {
      agente_id: a.agente_id,
      nombre: ag ? `${ag.nombre} ${ag.apellidos}`.trim() : a.agente_id,
      objetivo: Number(a.objetivo_valor) || 0,
      potencial: misOports.reduce((s: number, o: any) => s + (Number(o.valor_estimado) || 0), 0),
      conseguido: misOports.reduce((s: number, o: any) =>
        ganadorIds.has(o.estado_id) ? s + (Number(o.valor_estimado) || 0) : s, 0),
      numOport: misOports.length,
      numConseguido: misOports.filter((o: any) => ganadorIds.has(o.estado_id)).length,
      segmentos: calcSegmentos(misOports),
    };
  });
  return { ...c, potencial, conseguido, objetivo, numOport, numConseguido, agentes, segmentos: calcSegmentos(oports) };
}

const ESTADO_LABELS: Record<Campana["estado"], string> = { activa: "Activa", finalizada: "Finalizada", planificada: "Planificada" };
const ESTADO_COLORS: Record<Campana["estado"], { bg: string; color: string }> = {
  activa:      { bg: "#dcfce7", color: "#16a34a" },
  finalizada:  { bg: "#f1f5f9", color: "#64748b" },
  planificada: { bg: "#eff6ff", color: "#2563eb" },
};

const PALETTE = [
  "#7c3aed","#e8650a","#0ea5c8","#eab308","#db2777",
  "#374151","#16a34a","#2563eb","#dc2626","#0891b2",
  "#d97706","#f43f5e","#be185d","#065f46","#1e40af",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ width: 28, height: 28, borderRadius: 6, background: value, border: "2px solid #e2e8f0", cursor: "pointer", flexShrink: 0 }}
      />
      {open && (
        <div style={{ position: "absolute", top: 34, left: 0, zIndex: 300, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, width: 200 }}>
          {PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              style={{ width: 24, height: 24, borderRadius: 5, background: c, border: c === value ? "2px solid #1e293b" : "2px solid transparent", cursor: "pointer" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ObjetivoAgente = { id: string; nombre: string; avatar: string; objetivo: string };

function initials(nombre: string, apellidos: string) {
  const n = nombre.trim()[0] ?? "";
  const a = apellidos.trim()[0] ?? "";
  return (n + a).toUpperCase() || "??";
}

function NuevaCampanaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [fases, setFases] = useState<Fase[]>([]);
  const [newFaseNombre, setNewFaseNombre] = useState("");
  const [newFaseColor, setNewFaseColor] = useState(PALETTE[0]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Paso 2
  const [agentes, setAgentes] = useState<ObjetivoAgente[]>([]);
  const [selectedAgentes, setSelectedAgentes] = useState<Set<string>>(new Set());
  const [loadingAgentes, setLoadingAgentes] = useState(false);

  useEffect(() => {
    if (step === 2 && agentes.length === 0) {
      setLoadingAgentes(true);
      getAgencyUsers().then(users => {
        setAgentes(users.map(u => ({
          id: u.id,
          nombre: `${u.nombre} ${u.apellidos}`.trim(),
          avatar: initials(u.nombre, u.apellidos),
          objetivo: "",
        })));
        setLoadingAgentes(false);
      });
    }
  }, [step]);

  function toggleAgente(id: string) {
    setSelectedAgentes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateObjetivo(id: string, val: string) {
    setAgentes(prev => prev.map(a => a.id === id ? { ...a, objetivo: val } : a));
  }

  function addFase() {
    if (!newFaseNombre.trim()) return;
    setFases(prev => [...prev, { id: crypto.randomUUID(), nombre: newFaseNombre.trim(), color: newFaseColor }]);
    setNewFaseNombre("");
    setNewFaseColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
  }

  function removeFase(id: string) {
    setFases(prev => prev.filter(f => f.id !== id));
  }

  function handleDragStart(i: number) { setDragIdx(i); }
  function handleDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDragOverIdx(i); }
  function handleDrop(i: number) {
    if (dragIdx === null || dragIdx === i) return;
    const next = [...fases];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setFases(next);
    setDragIdx(null);
    setDragOverIdx(null);
  }

  const totalObjetivo = agentes
    .filter(a => selectedAgentes.has(a.id))
    .reduce((s, a) => s + (parseFloat(a.objetivo.replace(/\./g, "").replace(",", ".")) || 0), 0);
  const step1Valid = nombre.trim() && fases.length > 0;

  async function handleCrear() {
    setSaving(true);
    setSaveError(null);
    try {
      // 1. Crear la campaña
      const { data: campana } = await apiFetch("/api/crm/campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
        }),
      });

      // 2. Crear los estados/fases
      await Promise.all(fases.map((f, i) =>
        apiFetch(`/api/crm/campanas/${campana.id}/estados`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: f.nombre, color: f.color, orden: i }),
        })
      ));

      // 3. Asignar agentes con objetivos
      const agentesSeleccionados = agentes.filter(a => selectedAgentes.has(a.id));
      await Promise.all(agentesSeleccionados.map(a =>
        apiFetch(`/api/crm/campanas/${campana.id}/agentes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agente_id: a.id,
            objetivo_valor: parseFloat(a.objetivo.replace(/\./g, "").replace(",", ".")) || null,
          }),
        })
      ));

      onCreated();
      onClose();
    } catch (err: any) {
      setSaveError(err.message ?? "Error al crear la campaña");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className={styles.modalTitle}>Nueva campaña</span>
            <div className={styles.stepIndicator}>
              <span className={step === 1 ? styles.stepActive : styles.stepDone}>1. Configuración</span>
              <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>→</span>
              <span className={step === 2 ? styles.stepActive : styles.stepPending}>2. Objetivos por agente</span>
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>

        {step === 1 && (
          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre de la campaña</label>
              <input
                className={styles.input}
                placeholder="Ej. Grupos Escolares 2026/2027"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Fecha inicio</label>
                <input type="date" className={styles.input} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Fecha fin</label>
                <input type="date" className={styles.input} value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Fases del pipeline</label>
              <div className={styles.addFaseRow}>
                <ColorPicker value={newFaseColor} onChange={setNewFaseColor} />
                <input
                  className={styles.input}
                  style={{ flex: 1 }}
                  placeholder="Nombre de la fase (ej. Visitando)"
                  value={newFaseNombre}
                  onChange={e => setNewFaseNombre(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addFase()}
                />
                <button type="button" className={styles.addFaseBtn} onClick={addFase} disabled={!newFaseNombre.trim()}>
                  <Plus size={14} />Añadir
                </button>
              </div>

              {fases.length > 0 ? (
                <div className={styles.fasesList}>
                  {fases.map((f, i) => (
                    <div
                      key={f.id}
                      className={styles.faseRow}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={e => handleDragOver(e, i)}
                      onDrop={() => handleDrop(i)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      style={{ opacity: dragIdx === i ? 0.4 : 1, borderTop: dragOverIdx === i && dragIdx !== i ? "2px solid var(--primary-color, #7c3aed)" : "2px solid transparent" }}
                    >
                      <GripVertical size={14} style={{ color: "#cbd5e1", cursor: "grab", flexShrink: 0 }} />
                      <span className={styles.fasePill} style={{ background: f.color }}>{f.nombre}</span>
                      <span style={{ flex: 1, fontSize: "0.82rem", color: "#475569" }}>{f.nombre}</span>
                      <button type="button" className={styles.removeFaseBtn} onClick={() => removeFase(f.id)}><X size={12} /></button>
                    </div>
                  ))}
                  <p className={styles.hint} style={{ marginTop: 4 }}>Arrastra para reordenar</p>
                </div>
              ) : (
                <p className={styles.hint}>Añade al menos una fase para definir el pipeline de esta campaña</p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.modalBody}>
            {loadingAgentes ? (
              <p style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center", padding: "1rem 0" }}>Cargando agentes…</p>
            ) : (
              <>
                <p className={styles.hint} style={{ margin: 0 }}>
                  Selecciona los agentes que participan en esta campaña y asígnales un objetivo de ventas.
                </p>
                <div className={styles.agentesTable}>
                  {agentes.map(a => {
                    const activo = selectedAgentes.has(a.id);
                    return (
                      <div
                        key={a.id}
                        className={styles.agenteRow}
                        style={{ opacity: activo ? 1 : 0.5, cursor: "pointer" }}
                        onClick={() => toggleAgente(a.id)}
                      >
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => toggleAgente(a.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ accentColor: "var(--primary-color, #7c3aed)", width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
                        />
                        <div className={styles.agenteAvatar}>{a.avatar}</div>
                        <span className={styles.agenteNombre}>{a.nombre}</span>
                        {activo && (
                          <div className={styles.agenteObjetivoWrap} onClick={e => e.stopPropagation()}>
                            <input
                              className={`${styles.input} ${styles.inputObjetivo}`}
                              placeholder="0"
                              value={a.objetivo}
                              onChange={e => setAgentes(prev => prev.map(ag => ag.id === a.id ? { ...ag, objetivo: e.target.value.replace(/[^0-9.,]/g, "") } : ag))}
                            />
                            <span className={styles.euroSuffix}>€</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {totalObjetivo > 0 && (
                  <div className={styles.totalObjetivo}>
                    <span style={{ color: "#64748b", fontSize: "0.78rem" }}>
                      Objetivo total · {selectedAgentes.size} agente{selectedAgentes.size !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                      {totalObjetivo.toLocaleString("es-ES")} €
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className={styles.modalFooter}>
          {step === 1 ? (
            <>
              <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
              <button className={styles.btnPrimary} disabled={!step1Valid} onClick={() => setStep(2)}>
                Siguiente →
              </button>
            </>
          ) : (
            <>
              {saveError && <span style={{ fontSize: "0.75rem", color: "#dc2626", flex: 1 }}>{saveError}</span>}
              <button className={styles.btnSecondary} onClick={() => setStep(1)} disabled={saving}>← Atrás</button>
              <button className={styles.btnPrimary} onClick={handleCrear} disabled={saving}>
                {saving ? "Creando…" : "Crear campaña"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DuplicarModal({ campana, onConfirm, onClose }: {
  campana: Campana;
  onConfirm: (conContactos: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Duplicar campaña</span>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          <p style={{ fontSize: "0.85rem", color: "#475569", margin: 0 }}>
            Se duplicará <strong>"{campana.nombre}"</strong> con todas sus fases del pipeline.
          </p>
          <p style={{ fontSize: "0.85rem", color: "#475569", margin: 0, marginTop: "0.5rem" }}>
            ¿Deseas incluir también los contactos asociados a esta campaña?
          </p>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnSecondary} onClick={() => onConfirm(false)}>Solo fases</button>
          <button className={styles.btnPrimary} onClick={() => onConfirm(true)}>Fases y contactos</button>
        </div>
      </div>
    </div>
  );
}

function AjustesCampanaModal({ campana, onClose, onUpdated }: {
  campana: Campana;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [nombre, setNombre] = useState(campana.nombre);
  const [fechaInicio, setFechaInicio] = useState(campana.fecha_inicio?.slice(0, 10) ?? "");
  const [fechaFin, setFechaFin] = useState(campana.fecha_fin?.slice(0, 10) ?? "");
  const [agentes, setAgentes] = useState<ObjetivoAgente[]>([]);
  const [selectedAgentes, setSelectedAgentes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [users, { data: agentesCampana }] = await Promise.all([
          getAgencyUsers(),
          apiFetch(`/api/crm/campanas/${campana.id}/agentes`),
        ]);
        const agenteMap = new Map<string, number | null>((agentesCampana ?? []).map((a: any) => [a.agente_id as string, a.objetivo_valor as number | null]));
        setAgentes(users.map(u => ({
          id: u.id,
          nombre: `${u.nombre} ${u.apellidos}`.trim(),
          avatar: initials(u.nombre, u.apellidos),
          objetivo: agenteMap.has(u.id) ? String(agenteMap.get(u.id) ?? "") : "",
        })));
        setSelectedAgentes(new Set(agenteMap.keys()));
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    }
    load();
  }, [campana.id]);

  function toggleAgente(id: string) {
    setSelectedAgentes(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function updateObjetivo(id: string, val: string) {
    setAgentes(prev => prev.map(a => a.id === id ? { ...a, objetivo: val } : a));
  }

  async function handleGuardar() {
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError(null);
    try {
      // Datos básicos de la campaña
      await apiFetch(`/api/crm/campanas/${campana.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
        }),
      });

      // Agentes actuales en BD
      const { data: actuales } = await apiFetch(`/api/crm/campanas/${campana.id}/agentes`);
      const actualesIds = new Set((actuales ?? []).map((a: any) => a.agente_id));

      // Eliminar los que se desmarcaron
      await Promise.all([...actualesIds].filter(id => !selectedAgentes.has(id as string)).map(id =>
        apiFetch(`/api/crm/campanas/${campana.id}/agentes`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agente_id: id }),
        })
      ));

      // Upsert los seleccionados
      await Promise.all([...selectedAgentes].map(id => {
        const ag = agentes.find(a => a.id === id);
        const objetivo = parseFloat((ag?.objetivo ?? "").replace(/\./g, "").replace(",", ".")) || null;
        return apiFetch(`/api/crm/campanas/${campana.id}/agentes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agente_id: id, objetivo_valor: objetivo }),
        });
      }));

      onUpdated();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const totalObjetivo = agentes
    .filter(a => selectedAgentes.has(a.id))
    .reduce((s, a) => s + (parseFloat(a.objetivo.replace(/\./g, "").replace(",", ".")) || 0), 0);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Ajustes campaña</span>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 3 }}>Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} className={styles.input} style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 3 }}>Fecha inicio</label>
                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={styles.input} style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 3 }}>Fecha fin</label>
                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={styles.input} style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>Agentes y objetivos</p>
            {loading ? (
              <p style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center", padding: "0.5rem 0" }}>Cargando agentes…</p>
            ) : (
              <div className={styles.agentesTable}>
                {agentes.map(a => {
                  const sel = selectedAgentes.has(a.id);
                  return (
                    <label key={a.id} className={`${styles.agenteRow}${sel ? " " + styles.agenteRowSelected : ""}`}>
                      <input type="checkbox" className={styles.agenteCheck} checked={sel} onChange={() => toggleAgente(a.id)} />
                      <div className={styles.agenteAvatar}>{a.avatar}</div>
                      <span className={styles.agenteNombre}>{a.nombre}</span>
                      <input
                        type="text"
                        placeholder="Objetivo €"
                        value={a.objetivo}
                        disabled={!sel}
                        onChange={e => updateObjetivo(a.id, e.target.value)}
                        className={styles.agenteObjetivo}
                        onClick={e => e.preventDefault()}
                      />
                    </label>
                  );
                })}
              </div>
            )}
            {selectedAgentes.size > 0 && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#475569", textAlign: "right" }}>
                Objetivo total: <strong>{totalObjetivo.toLocaleString("es-ES")} €</strong>
              </div>
            )}
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: 0 }}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving || loading}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MinioBullet({ potencial, conseguido, objetivo }: { potencial: number; conseguido: number; objetivo: number }) {
  if (potencial <= 0) return <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>—</span>;
  const ganPct  = Math.min((conseguido / potencial) * 100, 100);
  const metaPct = Math.min((objetivo   / potencial) * 100, 100);
  const vsMetaPct = objetivo > 0 ? Math.round((conseguido / objetivo) * 100) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ position: "relative", height: 10, borderRadius: 5, background: "#e2e8f0", overflow: "visible" }}>
        {/* ganado bar */}
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 5,
          width: `${ganPct}%`,
          background: "linear-gradient(90deg, #db2777, #f472b6)",
        }} />
        {/* META needle */}
        {metaPct > 0 && (
          <div style={{
            position: "absolute", top: -3, bottom: -3,
            left: `${metaPct}%`,
            width: 2, background: "#1e293b", borderRadius: 2, zIndex: 2,
            transform: "translateX(-50%)",
          }} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#94a3b8" }}>
        {vsMetaPct !== null && (
          <span style={{ color: vsMetaPct >= 100 ? "#16a34a" : "#db2777", fontWeight: 600 }}>
            {vsMetaPct >= 100 ? `+${vsMetaPct - 100}% obj.` : `${vsMetaPct}% obj.`}
          </span>
        )}
        <span style={{ color: "#f59e0b", fontWeight: 600 }}>{Math.round(ganPct)}% pot.</span>
      </div>
    </div>
  );
}

function ObjetivoBar({ conseguido, objetivo, height = 12 }: { conseguido: number; objetivo: number; height?: number }) {
  if (objetivo <= 0) return <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>—</span>;
  const over = conseguido > objetivo;
  const pct = Math.min((conseguido / objetivo) * 100, 100);
  const totalPct = Math.round((conseguido / objetivo) * 100);
  const label = `${conseguido.toLocaleString("es-ES")} € de ${objetivo.toLocaleString("es-ES")} € · ${totalPct}%`;
  return (
    <div title={label}>
      <div style={{ position: "relative", width: 200, flexShrink: 0, height, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, #db2777, #f472b6)",
          borderRadius: 99,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

function IphoneBar({ segmentos = [], potencial, height = 12 }: { segmentos?: EstadoSegmento[]; potencial: number; height?: number }) {
  if (!segmentos.length || potencial <= 0) {
    return <div style={{ height, width: 200, borderRadius: 99, background: "#e2e8f0" }} />;
  }
  return (
    <div style={{ display: "flex", height, width: 200, borderRadius: 99, overflow: "hidden", gap: 1, background: "#e2e8f0" }}>
      {segmentos.map((s, i) => (
        <div
          key={s.id}
          title={`${s.nombre}: ${s.valor.toLocaleString("es-ES")} €`}
          style={{
            flex: `0 0 calc(${s.pct}% - 1px)`,
            background: s.color,
            borderRadius: i === 0 ? "99px 0 0 99px" : i === segmentos.length - 1 ? "0 99px 99px 0" : 0,
            minWidth: 3,
          }}
        />
      ))}
    </div>
  );
}

export default function CampanasPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [duplicando, setDuplicando] = useState<Campana | null>(null);
  const [ajustando, setAjustando] = useState<Campana | null>(null);
  const [eliminando, setEliminando] = useState<Campana | null>(null);
  const [eliminandoOk, setEliminandoOk] = useState(false);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [editingNombreId, setEditingNombreId] = useState<string | null>(null);
  const [editingNombreVal, setEditingNombreVal] = useState("");
  const [savingNombre, setSavingNombre] = useState(false);

  async function handleGuardarNombre(id: string) {
    if (!editingNombreVal.trim()) return;
    setSavingNombre(true);
    try {
      await apiFetch(`/api/crm/campanas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: editingNombreVal.trim() }),
      });
      setCampanas(prev => prev.map(c => c.id === id ? { ...c, nombre: editingNombreVal.trim() } : c));
      setEditingNombreId(null);
    } catch (e) { console.error(e); } finally { setSavingNombre(false); }
  }

  async function loadCampanas() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/crm/campanas");
      setCampanas((res.data ?? []).map(normalizeCampana));
      setIsOwner(["Owner", "SuperAdmin", "Admin"].includes(res.rol ?? ""));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCampanas(); }, []);

  async function handleDuplicar(conContactos: boolean) {
    if (!duplicando) return;
    try {
      await apiFetch(`/api/crm/campanas/${duplicando.id}/duplicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ con_contactos: conContactos }),
      });
      await loadCampanas();
    } catch (e) {
      console.error(e);
    } finally {
      setDuplicando(null);
    }
  }

  async function handleEliminar() {
    if (!eliminando) return;
    setEliminandoOk(true);
    try {
      await apiFetch(`/api/crm/campanas/${eliminando.id}`, { method: "DELETE" });
      setCampanas(prev => prev.filter(c => c.id !== eliminando.id));
      setEliminando(null);
    } catch (e) { console.error(e); } finally { setEliminandoOk(false); }
  }

  const filtered = campanas.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()));
  const totalConseguido = campanas.reduce((s, c) => s + c.conseguido, 0);
  const totalObjetivo   = campanas.reduce((s, c) => s + c.objetivo, 0);
  const activas         = campanas.filter(c => c.estado === "activa").length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Campañas</h1>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total campañas</span>
          <span className={styles.kpiValue}>{campanas.length}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Activas</span>
          <span className={styles.kpiValue} style={{ color: "#16a34a" }}>{activas}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Conseguido total</span>
          <span className={styles.kpiValue}>{totalConseguido.toLocaleString("es-ES")} €</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Objetivo total</span>
          <span className={styles.kpiValue}>{totalObjetivo.toLocaleString("es-ES")} €</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>% Logrado</span>
          <span className={styles.kpiValue} style={{ color: totalConseguido >= totalObjetivo ? "#16a34a" : "#f59e0b" }}>
            {Math.round((totalConseguido / totalObjetivo) * 100)}%
          </span>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>Listado de campañas</span>
          <div className={styles.tableActions}>
            <div className={styles.searchWrapper}>
              <Search size={13} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Buscar campaña..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {isOwner && (
              <button className={styles.addBtn} onClick={() => setShowModal(true)}>
                <Plus size={14} />
                Nueva campaña
              </button>
            )}
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Campaña</th>
              <th className={styles.th}>Estado</th>
              {/* Desktop: Inicio y Fin separados */}
              <th className={`${styles.th} ${styles.colDesktop}`} style={{ textAlign: "center" }}>Inicio</th>
              <th className={`${styles.th} ${styles.colDesktop}`} style={{ textAlign: "center" }}>Fin</th>
              {/* Mobile: Inicio/Fin combinados */}
              <th className={`${styles.th} ${styles.colMobile}`} style={{ textAlign: "center" }}>Inicio/Fin</th>
              {/* Desktop: Potencial y Conseguido separados */}
              <th className={`${styles.th} ${styles.colDesktop}`} style={{ textAlign: "right" }}>Potencial</th>
              <th className={`${styles.th} ${styles.colDesktop}`} style={{ textAlign: "right" }}>Conseguido</th>
              {/* Mobile: Potencial/Conseguido combinados */}
              <th className={`${styles.th} ${styles.colMobile}`} style={{ textAlign: "right" }}>Potencial/Conseg.</th>
              <th className={`${styles.th} ${styles.colDesktop}`}>Objetivo</th>
              <th className={`${styles.th} ${styles.colDesktop}`} style={{ textAlign: "right", width: "1%", whiteSpace: "nowrap", fontSize: "0.6rem" }}>%</th>
              <th className={`${styles.th} ${styles.colDesktop}`}>Pipeline</th>
              <th className={`${styles.th} ${styles.colMobile}`}>Objetivo/Pipeline</th>
              <th className={styles.th} />
            </tr>
          </thead>
          <tbody>
            {loading && (
            <tr><td colSpan={10} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.82rem" }}>Cargando campañas…</td></tr>
          )}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={10} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.82rem" }}>No hay campañas. Pulsa &quot;Nueva campaña&quot; para crear la primera.</td></tr>
          )}
          {!loading && filtered.map(c => {
              const over = c.objetivo > 0 && c.conseguido >= c.objetivo;
              const { bg, color } = ESTADO_COLORS[c.estado] ?? ESTADO_COLORS["planificada"];
              const isOpen = expanded.has(c.id);
              const toggleExpand = (e: React.MouseEvent) => {
                e.stopPropagation();
                setExpanded(prev => {
                  const next = new Set(prev);
                  next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                  return next;
                });
              };
              return (
                <React.Fragment key={c.id}>
                  <tr className={styles.tr} style={{ cursor: "pointer" }} onClick={() => editingNombreId !== c.id && router.push(`/campanas/${c.id}`)}>
                    <td className={styles.td} onClick={e => { if (editingNombreId === c.id) e.stopPropagation(); }}>
                      {isOwner && editingNombreId === c.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={editingNombreVal}
                            onChange={e => setEditingNombreVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleGuardarNombre(c.id); if (e.key === "Escape") setEditingNombreId(null); }}
                            style={{ fontSize: "0.85rem", fontWeight: 600, border: "1.5px solid var(--primary-color,#475569)", borderRadius: 5, padding: "0.2rem 0.4rem", outline: "none", width: "100%", minWidth: 180 }}
                          />
                          <button
                            onClick={() => handleGuardarNombre(c.id)}
                            disabled={savingNombre}
                            style={{ border: "none", background: "var(--primary-color,#475569)", color: "#fff", borderRadius: 5, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                          ><Check size={13} /></button>
                          <button
                            onClick={() => setEditingNombreId(null)}
                            style={{ border: "none", background: "#f1f5f9", color: "#64748b", borderRadius: 5, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                          ><X size={13} /></button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }} className={styles.nombreWrapper}>
                          <span className={styles.nombre}>{c.nombre}</span>
                          {isOwner && (
                            <button
                              title="Editar nombre"
                              onClick={e => { e.stopPropagation(); setEditingNombreId(c.id); setEditingNombreVal(c.nombre); }}
                              className={styles.editNombreBtn}
                            ><Pencil size={11} /></button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={styles.td}>
                      <span className={styles.estadoPill} style={{ background: bg, color }}>{ESTADO_LABELS[c.estado]}</span>
                    </td>
                    {/* Desktop: Inicio y Fin separados */}
                    <td className={`${styles.tdCenter} ${styles.colDesktop}`}>
                      <span className={styles.fecha}><Calendar size={11} style={{ opacity: 0.5 }} />{formatFecha(c.fecha_inicio)}</span>
                    </td>
                    <td className={`${styles.tdCenter} ${styles.colDesktop}`}>
                      <span className={styles.fecha}><Calendar size={11} style={{ opacity: 0.5 }} />{formatFecha(c.fecha_fin)}</span>
                    </td>
                    {/* Mobile: Inicio/Fin en una celda */}
                    <td className={`${styles.tdCenter} ${styles.colMobile}`}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span className={styles.fecha}><Calendar size={10} style={{ opacity: 0.5 }} />{formatFecha(c.fecha_inicio)}</span>
                        <span style={{ fontSize: "0.6rem", color: "#cbd5e1" }}>↓</span>
                        <span className={styles.fecha}><Calendar size={10} style={{ opacity: 0.5 }} />{formatFecha(c.fecha_fin)}</span>
                      </div>
                    </td>
                    {/* Desktop: Potencial y Conseguido separados */}
                    <td className={`${styles.tdRight} ${styles.colDesktop}`}>
                      <span style={{ color: "#3d9183", fontWeight: 600 }}>{c.potencial.toLocaleString("es-ES")} € <span style={{ fontWeight: 400, color: "#94a3b8" }}>({c.numOport})</span></span>
                    </td>
                    <td className={`${styles.tdRight} ${styles.colDesktop}`}>
                      <span style={{ fontWeight: 600, color: over ? "#16a34a" : "#1e293b" }}>{c.conseguido.toLocaleString("es-ES")} € <span style={{ fontWeight: 400, color: "#94a3b8" }}>({c.numConseguido})</span></span>
                    </td>
                    {/* Mobile: Potencial/Conseguido en una celda */}
                    <td className={`${styles.tdRight} ${styles.colMobile}`}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <span style={{ color: "#3d9183", fontWeight: 600, fontSize: "0.75rem" }}>{c.potencial.toLocaleString("es-ES")} €</span>
                        <span style={{ fontWeight: 600, color: over ? "#16a34a" : "#1e293b", fontSize: "0.75rem" }}>{c.conseguido.toLocaleString("es-ES")} €</span>
                      </div>
                    </td>
                    {/* Desktop: Objetivo separado */}
                    <td className={`${styles.td} ${styles.colDesktop}`} style={{ paddingRight: 0 }}>
                      <ObjetivoBar conseguido={c.conseguido} objetivo={c.objetivo} height={18} />
                    </td>
                    <td className={`${styles.tdRight} ${styles.colDesktop}`} style={{ whiteSpace: "nowrap", paddingLeft: 6 }}>
                      {c.objetivo > 0 ? (() => {
                        const pctVal = Math.round((c.conseguido / c.objetivo) * 100);
                        return over
                          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.8rem", fontWeight: 700, color: "#16a34a" }}>
                              <Flame size={11} style={{ color: "#eab308", flexShrink: 0 }} />
                              {pctVal}%
                            </span>
                          : <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#6366f1" }}>{pctVal}%</span>;
                      })() : "—"}
                    </td>
                    {/* Desktop: Pipeline separado */}
                    <td className={`${styles.td} ${styles.colDesktop}`} style={{ paddingRight: "0.75rem" }}>
                      <IphoneBar segmentos={c.segmentos} potencial={c.potencial} height={18} />
                    </td>
                    {/* Mobile: Objetivo/Pipeline combinados */}
                    <td className={`${styles.td} ${styles.colMobile}`} style={{ paddingRight: "0.5rem" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <ObjetivoBar conseguido={c.conseguido} objetivo={c.objetivo} height={14} />
                        <IphoneBar segmentos={c.segmentos} potencial={c.potencial} height={14} />
                      </div>
                    </td>
                    <td className={styles.td} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {isOwner && c.agentes.length > 0 && (
                          <button className={styles.expandBtn} onClick={toggleExpand} title={isOpen ? "Contraer" : "Ver agentes"}>
                            <ChevronDown size={13} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
                          </button>
                        )}
                        {isOwner && (
                          <>
                            <button className={styles.dupBtn} title="Ajustar agentes" onClick={() => setAjustando(c)}>
                              <Settings size={13} />
                            </button>
                            <button className={styles.dupBtn} title="Duplicar campaña" onClick={() => setDuplicando(c)}>
                              <Copy size={13} />
                            </button>
                            <button className={`${styles.dupBtn} ${styles.dupBtnDanger}`} title="Eliminar campaña" onClick={() => setEliminando(c)}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && c.agentes.map(a => {
                    const aOver = a.objetivo > 0 && a.conseguido >= a.objetivo;
                    const ini = a.nombre.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                    return (
                      <tr key={`${c.id}-${a.agente_id}`} className={styles.expandRow}>
                        {/* Campaña → nombre agente */}
                        <td className={styles.subTd} style={{ paddingLeft: "2.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div className={styles.agenteAvatar} style={{ width: 22, height: 22, fontSize: "0.55rem", flexShrink: 0 }}>{ini}</div>
                            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#475569" }}>{a.nombre}</span>
                          </div>
                        </td>
                        {/* Estado → vacío */}
                        <td className={styles.subTd} />
                        {/* Desktop: Inicio, Fin vacíos */}
                        <td className={`${styles.subTd} ${styles.colDesktop}`} />
                        <td className={`${styles.subTd} ${styles.colDesktop}`} />
                        {/* Mobile: Inicio/Fin vacío */}
                        <td className={`${styles.subTd} ${styles.colMobile}`} />
                        {/* Desktop: Potencial */}
                        <td className={`${styles.subTdRight} ${styles.colDesktop}`} style={{ color: "#3d9183", fontWeight: 600 }}>
                          {a.potencial > 0 ? <>{a.potencial.toLocaleString("es-ES")} € <span style={{ fontWeight: 400, color: "#94a3b8" }}>({a.numOport})</span></> : "—"}
                        </td>
                        {/* Desktop: Conseguido */}
                        <td className={`${styles.subTdRight} ${styles.colDesktop}`} style={{ color: aOver ? "#16a34a" : "#1e293b", fontWeight: 600 }}>
                          {a.conseguido > 0 ? <>{a.conseguido.toLocaleString("es-ES")} € <span style={{ fontWeight: 400, color: "#94a3b8" }}>({a.numConseguido})</span></> : "—"}
                        </td>
                        {/* Mobile: Potencial/Conseguido */}
                        <td className={`${styles.subTdRight} ${styles.colMobile}`}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                            <span style={{ color: "#3d9183", fontWeight: 600, fontSize: "0.75rem" }}>{a.potencial > 0 ? `${a.potencial.toLocaleString("es-ES")} €` : "—"}</span>
                            <span style={{ fontWeight: 600, color: aOver ? "#16a34a" : "#1e293b", fontSize: "0.75rem" }}>{a.conseguido > 0 ? `${a.conseguido.toLocaleString("es-ES")} €` : "—"}</span>
                          </div>
                        </td>
                        {/* Desktop: Objetivo */}
                        <td className={`${styles.subTd} ${styles.colDesktop}`} style={{ paddingRight: 0 }}>
                          <ObjetivoBar conseguido={a.conseguido} objetivo={a.objetivo} />
                        </td>
                        {/* % obj — solo desktop */}
                        <td className={`${styles.subTdRight} ${styles.colDesktop}`} style={{ whiteSpace: "nowrap", paddingLeft: 6 }}>
                          {a.objetivo > 0 ? (() => {
                            const pctVal = Math.round((a.conseguido / a.objetivo) * 100);
                            return aOver
                              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.8rem", fontWeight: 700, color: "#16a34a" }}>
                                  <Flame size={11} style={{ color: "#eab308", flexShrink: 0 }} />
                                  {pctVal}%
                                </span>
                              : <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#6366f1" }}>{pctVal}%</span>;
                          })() : "—"}
                        </td>
                        {/* Desktop: Pipeline */}
                        <td className={`${styles.subTd} ${styles.colDesktop}`} style={{ paddingRight: "0.75rem" }}>
                          <IphoneBar segmentos={a.segmentos} potencial={a.potencial} />
                        </td>
                        {/* Mobile: Objetivo/Pipeline combinados */}
                        <td className={`${styles.subTd} ${styles.colMobile}`} style={{ paddingRight: "0.5rem" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <ObjetivoBar conseguido={a.conseguido} objetivo={a.objetivo} height={14} />
                            <IphoneBar segmentos={a.segmentos} potencial={a.potencial} height={14} />
                          </div>
                        </td>
                        {/* Acciones → vacío */}
                        <td className={styles.subTd} />
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && <NuevaCampanaModal onClose={() => setShowModal(false)} onCreated={loadCampanas} />}
      {duplicando && (
        <DuplicarModal
          campana={duplicando}
          onConfirm={handleDuplicar}
          onClose={() => setDuplicando(null)}
        />
      )}
      {ajustando && (
        <AjustesCampanaModal
          campana={ajustando}
          onClose={() => setAjustando(null)}
          onUpdated={loadCampanas}
        />
      )}
      {eliminando && (
        <div className={styles.modalOverlay} onClick={() => setEliminando(null)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Eliminar campaña</span>
              <button className={styles.modalClose} onClick={() => setEliminando(null)}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: "0.85rem", color: "#475569" }}>
                ¿Seguro que quieres eliminar <strong>"{eliminando.nombre}"</strong>?
                Se borrarán todas sus oportunidades y estados. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setEliminando(null)}>Cancelar</button>
              <button
                onClick={handleEliminar}
                disabled={eliminandoOk}
                style={{ padding: "0.5rem 1.25rem", border: "none", borderRadius: "0.5rem", background: "#ef4444", color: "#fff", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", opacity: eliminandoOk ? 0.6 : 1 }}
              >
                {eliminandoOk ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
