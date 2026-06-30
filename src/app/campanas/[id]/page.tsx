"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, User, Building2, Calendar,
  X, Search, SlidersHorizontal, Info, Pencil, Trash2, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, CalendarDays, AlertTriangle, Sparkles, Rocket, CheckCircle2, Phone, Mail, MapPin, Clock, Heart,
} from "lucide-react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import { CampanaCharts } from "./Charts";
import NuevoPresupuestoModal from "@/app/presupuestos/NuevoPresupuestoModal";
import { ModalPlacesNearby } from "./ModalPlacesNearby";
import { getEntidadHistorial, getEntidadResumen } from "@/actions/crm";

const EntidadMapaDynamic = dynamic(
  () => import("./EntidadMapa").then(m => m.EntidadMapa),
  { ssr: false }
);
const EntidadMapaPlaceholder = dynamic(
  () => import("./EntidadMapa").then(m => m.EntidadMapaPlaceholder),
  { ssr: false }
);
const MapaOportunidadesDynamic = dynamic(
  () => import("./MapaOportunidades").then(m => m.MapaOportunidades),
  { ssr: false }
);

// ─── Types ───────────────────────────────────────────────────────────────────

type Estado = {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  es_final: boolean;
  es_ganado: boolean;
};

type Oportunidad = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado_id: string;
  valor_estimado: number;
  fecha_cierre_est: string | null;
  prioridad: number | null;
  agente_id: string | null;
  crm_agentes: { id: string; nombre: string; apellidos: string; avatar_url?: string | null } | null;
  contabilidad_entidades: { id: string; nombre: string; tipo_entidad: string; email?: string | null; telefono?: string | null; otros_tlfs?: string[] | null; otros_emails?: string[] | null; lat?: number | null; lng?: number | null; direccion: { direccion?: string; calle?: string; cp?: string; ciudad?: string; provincia?: string } | null; crm_contactos?: { id: string; nombre: string; cargo: string | null; telefono: string | null; email: string | null; metadatos?: { estrategia?: string; horarios?: string; poder_decision?: string; movil?: string; antiguedad?: string; desde?: string; anios_experiencia?: string } | null }[] } | null;
  crm_campanas_estados: { id: string; nombre: string; color: string; es_ganado: boolean; es_final: boolean } | null;
  crm_contactos: { nombre: string; cargo: string | null } | null;
  estados_campanas_anteriores?: { nombre: string; color: string; descripcion: string | null; campana: string | null; estrategia: string | null; campanaCreatedAt?: string | null }[];
  ultima_nota_log?: string | null;
  fecha_ultimo_cambio_estado?: string | null;
  mig_notas?: { observaciones?: string; por_que_no_viajaron?: string; viajaran_con_doncel?: string; fecha_cierre?: string } | null;
  expediente_id?: string | null;
};

type AgenteObjetivo = {
  agente_id: string;
  rol: string;
  objetivo_num: number | null;
  objetivo_valor: number | null;
  crm_agentes: { id: string; nombre: string; apellidos: string; avatar_url: string | null } | null;
};

type Campana = {
  id: string;
  nombre: string;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  crm_campanas_estados: Estado[];
  crm_campanas_agentes: AgenteObjetivo[];
};

type AgenteSelector = { id: string; nombre: string; apellidos: string };
type EntidadSelector = { id: string; nombre: string; tipo_entidad: string };
type ContactoSelector = { id: string; nombre: string; cargo: string | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Error de red");
  return json;
}

function initials(nombre: string, apellidos?: string | null) {
  return ((nombre[0] ?? "") + ((apellidos ?? "")[0] ?? "")).toUpperCase() || "??";
}

function formatFecha(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Modal Nueva Oportunidad ─────────────────────────────────────────────────

function NuevaOportunidadModal({
  campanaId,
  estados,
  onClose,
  onCreated,
}: {
  campanaId: string;
  estados: Estado[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estadoId, setEstadoId] = useState(estados[0]?.id ?? "");
  const [valorEstimado, setValorEstimado] = useState("");
  const [fechaCierre, setFechaCierre] = useState("");
  const [entidadSearch, setEntidadSearch] = useState("");
  const [entidades, setEntidades] = useState<EntidadSelector[]>([]);
  const [entidadId, setEntidadId] = useState<string | null>(null);
  const [contactos, setContactos] = useState<ContactoSelector[]>([]);
  const [contactoId, setContactoId] = useState<string | null>(null);
  const [agentes, setAgentes] = useState<AgenteSelector[]>([]);
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/crm/agentes").then(r => setAgentes(r.data ?? []));
  }, []);

  useEffect(() => {
    if (entidadSearch.length < 2) { setEntidades([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contabilidad/entidades?q=${encodeURIComponent(entidadSearch)}&limit=8`);
        const json = await res.json();
        setEntidades(json.data ?? json ?? []);
      } catch { setEntidades([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [entidadSearch]);

  useEffect(() => {
    if (!entidadId) { setContactos([]); setContactoId(null); return; }
    apiFetch(`/api/crm/contactos?entidad_id=${entidadId}`)
      .then(r => setContactos(r.data ?? []))
      .catch(() => setContactos([]));
  }, [entidadId]);

  async function handleGuardar() {
    if (!titulo.trim() || !estadoId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/crm/oportunidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion || null,
          campana_id: campanaId,
          estado_id: estadoId,
          entidad_id: entidadId || null,
          contacto_id: contactoId || null,
          agente_id: agenteId || null,
          valor_estimado: parseFloat(valorEstimado) || 0,
          fecha_cierre_est: fechaCierre || null,
        }),
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const entidadSeleccionada = entidades.find(e => e.id === entidadId);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Nueva oportunidad</span>
          <button className={styles.btnClose} onClick={onClose}><X size={15} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}>Título *</label>
            <input className={styles.input} placeholder="Ej. Viaje de fin de curso 2026" value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Estado inicial *</label>
              <select className={styles.input} value={estadoId} onChange={e => setEstadoId(e.target.value)}>
                {estados.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Valor estimado (€)</label>
              <input className={styles.input} type="number" min="0" placeholder="0" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Fecha cierre est.</label>
              <input className={styles.input} type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Agente responsable</label>
              <select className={styles.input} value={agenteId ?? ""} onChange={e => setAgenteId(e.target.value || null)}>
                <option value="">Sin asignar</option>
                {agentes.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} {a.apellidos}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Entidad (cliente / colegio)</label>
            {entidadSeleccionada ? (
              <div className={styles.entidadChip}>
                <Building2 size={13} />
                <span>{entidadSeleccionada.nombre}</span>
                <button type="button" className={styles.chipRemove} onClick={() => { setEntidadId(null); setEntidadSearch(""); }}>
                  <X size={11} />
                </button>
              </div>
            ) : (
              <div className={styles.searchBox}>
                <Search size={13} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  placeholder="Buscar entidad por nombre…"
                  value={entidadSearch}
                  onChange={e => setEntidadSearch(e.target.value)}
                />
                {entidades.length > 0 && (
                  <div className={styles.dropdown}>
                    {entidades.map(e => (
                      <button key={e.id} type="button" className={styles.dropdownItem} onClick={() => { setEntidadId(e.id); setEntidadSearch(""); }}>
                        <Building2 size={12} style={{ opacity: 0.5 }} />
                        <span>{e.nombre}</span>
                        <span className={styles.tipoBadge}>{e.tipo_entidad}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {entidadId && contactos.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Contacto</label>
              <select className={styles.input} value={contactoId ?? ""} onChange={e => setContactoId(e.target.value || null)}>
                <option value="">Sin contacto</option>
                {contactos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.cargo ? ` · ${c.cargo}` : ""}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Descripción</label>
            <textarea className={styles.textarea} rows={2} placeholder="Notas adicionales…" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving || !titulo.trim() || !estadoId}>
            {saving ? "Guardando…" : "Crear oportunidad"}
          </button>
        </div>
      </div>
    </div>
  );
}

const calcularMesVisitaRecomendado = (periodoDecision: string): string => {
  if (!periodoDecision) return "";
  const mapeo: Record<string, string> = {
    '1q-sept': 'Finales de Agosto (Pre-campaña)',
    '2q-sept': '1ª Quincena de Septiembre',
    '1q-oct': '2ª Quincena de Septiembre 🚀',
    '2q-oct': '1ª Quincena de Octubre 🚀',
    '1q-nov': '2ª Quincena de Octubre',
    '2q-nov': '1ª Quincena de Noviembre',
    '1q-dic': '2ª Quincena de Noviembre',
    '2q-dic': '1ª Quincena de Diciembre',
  };
  return mapeo[periodoDecision] || "";
};

const P = "var(--primary-color, #475569)";
const PL = "color-mix(in srgb, var(--primary-color, #475569) 12%, white)";
const PB = "color-mix(in srgb, var(--primary-color, #475569) 18%, white)";
const PBG = "color-mix(in srgb, var(--primary-color, #475569) 5%, white)";

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '0.28rem 0.65rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: 99,
      border: `1.5px solid ${active ? P : '#cbd5e1'}`,
      background: active ? PL : '#fff',
      color: active ? P : '#64748b',
      cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

function ChipGroup({ label, options, value, onChange, multi = false }: {
  label: string;
  options: { value: string; label: string }[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (v: string) => {
    if (multi) {
      onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
    } else {
      onChange(selected.includes(v) ? '' : v);
    }
  };
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {options.map(o => <Chip key={o.value} label={o.label} active={selected.includes(o.value)} onClick={() => toggle(o.value)} />)}
      </div>
    </div>
  );
}

function AuditoriaSubform({ motivo, state, update }: { motivo: string; state: Record<string, string | string[]>; update: (patch: Record<string, string | string[]>) => void }) {
  const s = (k: string) => (state[k] as string) ?? '';
  const wrapper = (title: string, children: React.ReactNode) => (
    <div style={{ marginTop: '0.25rem', padding: '0.85rem 1rem', background: PBG, borderRadius: 8, border: `1px solid ${PB}` }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: P, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{children}</div>
    </div>
  );

  if (motivo === 'otra-agencia') return wrapper('Análisis de Competencia', <>
    <ChipGroup label="¿Con qué agencia cerraron?" value={s('competidor')} onChange={v => update({ competidor: v as string })} options={[
      { value: 'azul-marino', label: 'Azul Marino' },
      { value: 'bthetravel', label: 'B the Travel' },
      { value: 'corte-ingles', label: 'Viajes El Corte Inglés' },
      { value: 'halcon', label: 'Halcón Viajes' },
      { value: 'agencia-local', label: 'Agencia local' },
      { value: 'campamento-directo', label: 'Campamento directo' },
      { value: 'otros', label: 'Otros' },
    ]} />
    {s('competidor') === 'otros' && (
      <input
        type="text"
        placeholder="Nombre de la agencia…"
        value={s('competidor_otros')}
        onChange={e => update({ competidor_otros: e.target.value })}
        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', borderRadius: 6, border: '1.5px solid #cbd5e1', outline: 'none', width: '100%' }}
      />
    )}
    <ChipGroup label="Palanca clave de la competencia" value={s('factor_competencia')} onChange={v => update({ factor_competencia: v as string })} options={[
      { value: 'precio', label: 'Precio más bajo' },
      { value: 'gratuidades', label: 'Más gratuidades' },
      { value: 'confianza', label: 'Confianza histórica' },
      { value: 'itinerario', label: 'Mejor itinerario' },
      { value: 'otro', label: 'Otro' },
    ]} />
    {s('factor_competencia') === 'otro' && (
      <input
        placeholder="Especifica la palanca clave..."
        value={s('factor_competencia_otro')}
        onChange={e => update({ factor_competencia_otro: e.target.value })}
        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', borderRadius: 6, border: '1.5px solid #cbd5e1', outline: 'none', width: '100%' }}
      />
    )}
    <ChipGroup label="¿Se presentó contrapropuesta?" value={s('contrapropuesta')} onChange={v => update({ contrapropuesta: v as string })} options={[
      { value: 'si', label: 'Sí' },
      { value: 'no', label: 'No' },
    ]} />
  </>);

  if (motivo === 'imposible-contacto') return wrapper('Auditoría del Bloqueo de Cuenta', <>
    <ChipGroup label="Canales intentados" value={(state['canal_intentado'] as string[]) ?? []} onChange={v => update({ canal_intentado: v as string[] })} multi options={[
      { value: 'email', label: 'Email' },
      { value: 'telefono', label: 'Teléfono' },
      { value: 'puerta_fria', label: 'Puerta fría' },
      { value: 'formulario_web', label: 'Web / RRSS' },
    ]} />
    <ChipGroup label="Número de intentos" value={s('numero_intentos')} onChange={v => update({ numero_intentos: v as string })} options={[
      { value: '1-3', label: '1 – 3' },
      { value: '4-6', label: '4 – 6' },
      { value: '+6', label: '+6' },
    ]} />
    <ChipGroup label="Barrera detectada" value={s('tactica_fallida')} onChange={v => update({ tactica_fallida: v as string })} options={[
      { value: 'filtro_recepcion', label: 'Filtro en recepción' },
      { value: 'silencio_absoluto', label: 'Silencio total' },
      { value: 'datos_erroneos', label: 'Datos erróneos' },
      { value: 'negativa_directa', label: 'Veto dirección' },
    ]} />
  </>);

  if (motivo === 'sin-respuesta') return wrapper('Auditoría de Desconexión', <>
    <ChipGroup label="Último hito de feedback" value={s('ultimo_hito')} onChange={v => update({ ultimo_hito: v as string })} options={[
      { value: 'reunion_profes', label: 'Pendiente reunión profes' },
      { value: 'ghosting_total', label: 'Ghosting total' },
      { value: 'itinerario_frio', label: 'Frío tras propuesta' },
    ]} />
    <ChipGroup label="Seguimientos realizados" value={s('num_seguimientos')} onChange={v => update({ num_seguimientos: v as string })} options={[
      { value: '1', label: '1' },
      { value: '2-3', label: '2 – 3' },
      { value: '+3', label: '+3' },
    ]} />
    <ChipGroup label="Vía del último intento" value={s('via_ultimo_intento')} onChange={v => update({ via_ultimo_intento: v as string })} options={[
      { value: 'llamada', label: 'Llamada' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'email', label: 'Email' },
      { value: 'puerta_fria', label: 'Puerta fría' },
    ]} />
  </>);

  if (motivo === 'cancelado-colegio') return wrapper('Diagnóstico de Cancelación', <>
    <ChipGroup label="Causa real de la cancelación" value={s('causa_cancelacion')} onChange={v => update({ causa_cancelacion: v as string })} options={[
      { value: 'sin_profes', label: 'Sin profesores voluntarios' },
      { value: 'sin_alumnos', label: 'Sin cupo mínimo' },
      { value: 'veto_direccion', label: 'Veto dirección / AMPA' },
      { value: 'problemas_economicos', label: 'Problemas económicos' },
    ]} />
    <ChipGroup label="¿Intención de recuperar el viaje el próximo año?" value={s('intencion_recuperar')} onChange={v => update({ intencion_recuperar: v as string })} options={[
      { value: 'si', label: 'Sí' },
      { value: 'dudoso', label: 'Dudoso' },
      { value: 'no', label: 'No' },
    ]} />
  </>);

  if (motivo === 'precio') return wrapper('Análisis de Desviación Presupuestaria', <>
    <ChipGroup label="Brecha económica estimada" value={s('brecha_precio')} onChange={v => update({ brecha_precio: v as string })} options={[
      { value: 'menor_50', label: '< 50 € / alumno' },
      { value: '50_125', label: '50 – 125 € / alumno' },
      { value: 'mayor_125', label: '> 125 € / alumno' },
    ]} />
    <ChipGroup label="Elemento que encareció el viaje (multiselección)" value={(state['elementos_caros'] as string[]) ?? []} onChange={v => update({ elementos_caros: v as string[] })} multi options={[
      { value: 'transporte', label: 'Transporte' },
      { value: 'alojamiento', label: 'Alojamiento' },
      { value: 'fechas', label: 'Fechas (temp. alta)' },
      { value: 'actividades', label: 'Actividades / Entradas' },
    ]} />
  </>);

  return null;
}

function ModalCierreOportunidad({
  onClose,
  onSave,
  saving = false,
  oportunidad,
}: {
  onClose: () => void;
  onSave: (data: {
    motivo: string;
    competidor: string;
    periodoDecision: string;
    visitaSugerida: string;
    interesFuturo: string;
    observaciones: string;
    estrategiaCampana: string;
    auditoria: Record<string, string | string[]>;
    prioridad: number | null;
    valorEstimado: number;
  }) => void;
  saving?: boolean;
  oportunidad?: { nombre_centro: string; valor_estimado: number; prioridad?: number | null; destino_interesado?: string; notas_agente?: string; mig_notas?: { observaciones?: string; por_que_no_viajaron?: string; viajaran_con_doncel?: string; fecha_cierre?: string } };
}) {
  function inferirMotivo(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('otra agencia') || r.includes('confianza')) return 'otra-agencia';
    if (r.includes('imposible') || r.includes('contacto')) return 'imposible-contacto';
    if (r.includes('respuesta') || r.includes('presupuesto')) return 'sin-respuesta';
    if (r.includes('canceló') || r.includes('cancelo')) return 'cancelado-colegio';
    if (r.includes('caro') || r.includes('precio')) return 'precio';
    return '';
  }

  function inferirInteres(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('0-25') || r.includes('poco probable') || r.includes('no')) return 'bajo';
    if (r.includes('75') || r.includes('probable') || r.includes('sí')) return 'alto';
    return 'medio';
  }

  function inferirPeriodo(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('1q sept') || r.includes('1q-sept')) return '1q-sept';
    if (r.includes('2q sept') || r.includes('2q-sept')) return '2q-sept';
    if (r.includes('1q oct') || r.includes('1q-oct')) return '1q-oct';
    if (r.includes('2q oct') || r.includes('2q-oct')) return '2q-oct';
    if (r.includes('1q nov') || r.includes('1q-nov')) return '1q-nov';
    if (r.includes('2q nov') || r.includes('2q-nov')) return '2q-nov';
    return '';
  }

  // Parsear notas_agente como JSON si viene del modal de cierre
  const cd = (() => {
    const raw = oportunidad?.notas_agente;
    if (!raw) return null;
    try { const p = JSON.parse(raw); return typeof p === 'object' && p !== null ? p : null; } catch { return null; }
  })() ?? null;
  const mig = oportunidad?.mig_notas;

  // cd (JSON guardado) tiene precedencia; mig_notas como fallback legacy
  const motivoInicial = cd?.motivo || (mig?.por_que_no_viajaron ? inferirMotivo(mig.por_que_no_viajaron) : '');
  const interesInicial = cd?.interesFuturo || (mig?.viajaran_con_doncel ? inferirInteres(mig.viajaran_con_doncel) : 'medio');
  const periodoInicial = cd?.periodoDecision || (mig?.fecha_cierre ? inferirPeriodo(mig.fecha_cierre) : '');
  const obsInicial = cd?.observaciones || mig?.observaciones || '';
  const visitaInicial = cd?.visitaSugerida || '';
  const estrategiaInicial = cd?.estrategiaCampana || '';
  const auditoriaInicial: Record<string, string | string[]> = cd?.auditoria ?? {};

  const [motivo, setMotivo] = useState<string>(motivoInicial);
  const [periodoDecision, setPeriodoDecision] = useState<string>(periodoInicial);
  const [visitaSugerida, setVisitaSugerida] = useState<string>(visitaInicial);
  const [interesFuturo, setInteresFuturo] = useState<string>(interesInicial);
  const [observaciones, setObservaciones] = useState<string>(obsInicial);
  const [estrategiaCampana, setEstrategiaCampana] = useState<string>(estrategiaInicial);
  const [generandoIA, setGenerandoIA] = useState(false);
  const [auditoria, setAuditoria] = useState<Record<string, string | string[]>>(auditoriaInicial);
  const [prioridad, setPrioridad] = useState<number | null>(cd?.prioridad !== undefined ? cd.prioridad : (oportunidad?.prioridad ?? null));
  const [valorEstimado, setValorEstimado] = useState<number>(cd?.valorEstimado ?? oportunidad?.valor_estimado ?? 0);

  const periodoDecisionPrevRef = useRef<string | null>(null);
  useEffect(() => {
    // Solo recalcular si el usuario cambia el periodo (no en el montaje inicial)
    if (periodoDecisionPrevRef.current === null) { periodoDecisionPrevRef.current = periodoDecision; return; }
    if (periodoDecision !== periodoDecisionPrevRef.current) {
      periodoDecisionPrevRef.current = periodoDecision;
      setVisitaSugerida(calcularMesVisitaRecomendado(periodoDecision));
    }
  }, [periodoDecision]);

  const motivoPrevRef = useRef(motivoInicial);
  useEffect(() => {
    if (motivo !== motivoPrevRef.current) {
      motivoPrevRef.current = motivo;
      setAuditoria({});
    }
  }, [motivo]);


  async function sugerirEstrategiaIA() {
    setGenerandoIA(true);
    try {
      const res = await fetch("/api/crm/estrategia-cierre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oportunidad: {
            nombre_centro: oportunidad?.nombre_centro || "",
            valor_estimado: oportunidad?.valor_estimado || 0,
            destino_interesado: oportunidad?.destino_interesado || "",
          },
          datos_modal_actual: {
            motivo_no_viaje: motivo,
            cuando_deciden: periodoDecision,
            cuando_visitar: visitaSugerida,
            interes_profesor: interesFuturo,
            observaciones_objeciones: observaciones,
            auditoria: Object.keys(auditoria).length > 0 ? auditoria : undefined,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.estrategia) setEstrategiaCampana(json.estrategia);
    } catch { }
    finally { setGenerandoIA(false); }
  }

  const handleGuardar = () => {
    if (!motivo) return;
    onSave({
      motivo,
      competidor: (auditoria.competidor as string) ?? '',
      periodoDecision,
      visitaSugerida,
      interesFuturo,
      observaciones,
      estrategiaCampana,
      auditoria,
      prioridad,
      valorEstimado,
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        
        {/* HEADER DEL MODAL */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className={styles.modalHeaderIcon}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <span className={styles.modalTitle} style={{ display: 'block' }}>Cierre de Oportunidad (No viajaron)</span>
              {oportunidad?.nombre_centro && (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'block', marginTop: 1 }}>
                  {oportunidad.nombre_centro}
                </span>
              )}
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                Captura los motivos para asegurar la estrategia de captación el próximo año.
              </span>
            </div>
          </div>
          <button className={styles.btnClose} onClick={onClose}><X size={15} /></button>
        </div>

        {/* CUERPO DEL MODAL */}
        <div className={styles.modalBody}>
          {/* BLOQUE 0: PRIORIDAD Y ESTIMACIÓN */}
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Prioridad</label>
              <select
                value={prioridad ?? ''}
                onChange={e => setPrioridad(e.target.value === '' ? null : Number(e.target.value))}
                className={styles.input}
              >
                <option value="">Sin prioridad</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Estimación (€)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={valorEstimado}
                onChange={e => setValorEstimado(parseFloat(e.target.value) || 0)}
                className={styles.input}
              />
            </div>
          </div>

          {/* BLOQUE 1: CLASIFICACIÓN MACRO */}
          <div className={styles.field}>
            <label className={styles.label}>¿Por qué NO viajaron con Doncel? *</label>
            <select 
              value={motivo} 
              onChange={(e) => setMotivo(e.target.value)}
              className={styles.input}
            >
              <option value="" disabled>Selecciona el motivo principal...</option>
              <option value="otra-agencia">Viajan con otra agencia (Competencia)</option>
              <option value="imposible-contacto">Imposible conseguir contacto inicial</option>
              <option value="sin-respuesta">No contestaron tras enviar presupuesto</option>
              <option value="cancelado-colegio">El colegio canceló el viaje este año</option>
              <option value="precio">Presupuesto fuera de su presupuesto (Caro)</option>
            </select>
          </div>

          {/* SUBFORMULARIOS DINÁMICOS POR MOTIVO */}
          {motivo && <AuditoriaSubform motivo={motivo} state={auditoria} update={(patch) => setAuditoria(p => ({ ...p, ...patch }))} />}

          {/* BLOQUE 3: ESTRATEGIA TEMPORAL (QUINCENAS) */}
          <div className={styles.fieldRow}>
            {/* Selector de Quincena de Decisión */}
            <div className={styles.field}>
              <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CalendarDays size={13} style={{ opacity: 0.6 }} />
                ¿Cuándo deciden el viaje?
              </label>
              <select 
                value={periodoDecision} 
                onChange={(e) => setPeriodoDecision(e.target.value)}
                className={styles.input}
              >
                <option value="">Seleccionar quincena...</option>
                <optgroup label="Septiembre">
                  <option value="1q-sept">1ª Quincena Septiembre</option>
                  <option value="2q-sept">2ª Quincena Septiembre</option>
                </optgroup>
                <optgroup label="Octubre">
                  <option value="1q-oct">1ª Quincena Octubre</option>
                  <option value="2q-oct">2ª Quincena Octubre</option>
                </optgroup>
                <optgroup label="Noviembre">
                  <option value="1q-nov">1ª Quincena Noviembre</option>
                  <option value="2q-nov">2ª Quincena Noviembre</option>
                </optgroup>
              </select>
            </div>

            {/* OUTPUT INTELIGENTE: CUÁNDO VISITAR EL CENTRO */}
            <div className={styles.field}>
              <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={13} style={{ color: '#d97706' }} />
                Cuándo visitar el centro
              </label>
              <div className={visitaSugerida ? styles.visitaBox : styles.visitaBoxEmpty}>
                {visitaSugerida ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={13} style={{ color: '#b45309' }} />
                    Planificar en: <strong>{visitaSugerida}</strong>
                  </span>
                ) : (
                  <span>Sujeto a la quincena</span>
                )}
              </div>
            </div>
          </div>

          {/* BLOQUE 4: INTERÉS DE CARA AL FUTURO */}
          <div className={styles.field}>
            <label className={styles.label}>Interés real del contacto para la campaña que viene</label>
            <div className={styles.interesRow}>
              {['bajo', 'medio', 'alto'].map((nivel) => {
                const isActive = interesFuturo === nivel;
                const activeClass = 
                  nivel === 'alto' ? styles.interesBtnAltoActive :
                  nivel === 'medio' ? styles.interesBtnMedioActive :
                  styles.interesBtnBajoActive;

                return (
                  <button
                    key={nivel}
                    type="button"
                    onClick={() => setInteresFuturo(nivel)}
                    className={`${styles.interesBtn} ${isActive ? activeClass : ''}`}
                  >
                    {nivel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BLOQUE 5: OBSERVACIONES */}
          <div className={styles.field}>
            <label className={styles.label}>Observaciones / Tratamiento de objeciones</label>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: El profesor se mostró muy receptivo pero la directiva impuso la otra agencia por recomendación histórica..."
              className={styles.textarea}
            />
          </div>

          {/* BLOQUE 6: ESTRATEGIA CAMPAÑA PRÓXIMA */}
          <div className={styles.field}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                <Rocket size={13} style={{ color: '#d97706' }} />
                Estrategia campaña próxima
              </label>
              <button
                type="button"
                onClick={sugerirEstrategiaIA}
                disabled={generandoIA}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 600,
                  border: 'none', background: 'none',
                  color: 'var(--primary-color, #475569)',
                  cursor: generandoIA ? 'not-allowed' : 'pointer',
                  opacity: generandoIA ? 0.5 : 1, transition: 'opacity 0.15s',
                }}
              >
                {generandoIA
                  ? <><span style={{ display: 'inline-block', width: 9, height: 9, border: '1.5px solid var(--primary-color, #475569)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Generando…</>
                  : <><Sparkles size={10} /> Sugerir con IA</>
                }
              </button>
            </div>
            <textarea
              rows={3}
              value={generandoIA ? '' : estrategiaCampana}
              onChange={(e) => setEstrategiaCampana(e.target.value)}
              placeholder={generandoIA ? 'Generando enfoque comercial...' : 'Ej: Contactar directamente con el jefe de estudios en octubre, proponer visita personalizada con destino nuevo...'}
              className={styles.textarea}
              style={{ opacity: generandoIA ? 0.5 : 1, transition: 'opacity 0.2s' }}
            />
          </div>
        </div>

        {/* BOTONES ACCIÓN */}
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
          <button 
            className={styles.btnPrimary} 
            onClick={handleGuardar} 
            disabled={saving || !motivo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#4f46e5' }}
          >
            <CheckCircle2 size={14} />
            {saving ? "Guardando…" : "Guardar Histórico"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Barra de progreso agente ─────────────────────────────────────────────────

function AgenteObjetivoRow({ agente, oportunidades }: { agente: AgenteObjetivo; oportunidades: Oportunidad[] }) {
  const misOps = oportunidades.filter(o => o.agente_id === agente.agente_id);
  const valorActual = misOps.reduce((s, o) => s + o.valor_estimado, 0);
  const pct = agente.objetivo_valor ? Math.min(Math.round((valorActual / agente.objetivo_valor) * 100), 100) : null;
  const ag = agente.crm_agentes;
  if (!ag) return null;

  return (
    <div className={styles.agenteRow}>
      <div className={styles.agenteAvatarLg}>{initials(ag.nombre, ag.apellidos)}</div>
      <div className={styles.agenteInfo}>
        <span className={styles.agenteNombre}>{ag.nombre} {ag.apellidos}</span>
        <div className={styles.agenteProgress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${pct ?? 0}%` }} />
          </div>
          <span className={styles.progressLabel}>
            {valorActual.toLocaleString("es-ES")} €
            {agente.objetivo_valor ? ` / ${agente.objetivo_valor.toLocaleString("es-ES")} €` : ""}
            {pct !== null ? ` · ${pct}%` : ""}
          </span>
        </div>
      </div>
      <span className={styles.agenteCount}>{misOps.length} oport.</span>
    </div>
  );
}

// ─── Responsables tooltip ────────────────────────────────────────────────────

function ResponsablesTooltip({ contactos }: { contactos: { id: string; nombre: string; cargo: string | null; telefono: string | null; email: string | null; metadatos?: { estrategia?: string; horarios?: string; poder_decision?: string; movil?: string } | null }[] }) {
  const [tooltip, setTooltip] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const TOOLTIP_H = contactos.length * 72;
  const TOOLTIP_W = 300;

  function handleEnter() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const above = r.top > window.innerHeight / 2;
    setTooltip({
      top: above ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - TOOLTIP_W - 8)),
      above,
    });
  }

  if (!contactos.length) return <span style={{ color: "#e2e8f0", fontSize: "0.7rem" }}>—</span>;

  const sinContacto = contactos.some(c => !c.nombre || !c.telefono && !c.metadatos?.movil || !c.email);

  return (
    <div ref={ref} style={{ display: "inline-flex" }} onMouseEnter={handleEnter} onMouseLeave={() => setTooltip(null)}>
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.75rem", fontWeight: 600, color: "#475569", cursor: "default" }}>
        <span style={{ position: "relative", display: "inline-flex", paddingTop: sinContacto ? 4 : 0 }}>
          <User size={12} style={{ opacity: 0.5 }} />
          {sinContacto && (
            <span style={{
              position: "absolute", top: -3, right: -4,
              width: 7, height: 7, borderRadius: "50%",
              background: "#eab308", border: "1.5px solid #fff",
            }} />
          )}
        </span>
        {contactos.length}
      </span>
      {tooltip && (
        <div style={{
          position: "fixed",
          top: tooltip.above ? undefined : tooltip.top,
          bottom: tooltip.above ? window.innerHeight - tooltip.top : undefined,
          left: tooltip.left,
          zIndex: 99999,
          background: "#1e293b", borderRadius: 8, padding: "0.5rem 0",
          boxShadow: "0 8px 24px rgba(15,23,42,0.22)", width: "max-content", maxWidth: TOOLTIP_W,
          pointerEvents: "none",
        }}>
          {contactos.map((c, i) => {
            const sinNombre = !c.nombre;
            const sinTlf = !c.telefono && !c.metadatos?.movil;
            const sinEmail = !c.email;
            return (
              <div key={c.id} style={{
                padding: "0.35rem 0.75rem",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.07)" : undefined,
              }}>
                {sinNombre
                  ? <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#eab308", lineHeight: 1.3 }}>⚠ Nombre no registrado</div>
                  : <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#f1f5f9", lineHeight: 1.3 }}>{c.nombre}</div>
                }
                {c.cargo && <div style={{ fontSize: "0.68rem", color: "#94a3b8", lineHeight: 1.3 }}>{c.cargo}</div>}
                {sinTlf
                  ? <div style={{ fontSize: "0.68rem", color: "#eab308", lineHeight: 1.3 }}>⚠ Teléfono no registrado</div>
                  : <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.3 }}>{c.telefono || c.metadatos?.movil}</div>
                }
                {sinEmail
                  ? <div style={{ fontSize: "0.68rem", color: "#eab308", lineHeight: 1.3 }}>⚠ Email no registrado</div>
                  : <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.3 }}>{c.email}</div>
                }
                {c.metadatos?.estrategia && (
                  <div style={{ fontSize: "0.67rem", color: "#7dd3a8", lineHeight: 1.4, marginTop: 2, fontStyle: "italic", maxWidth: 260, whiteSpace: "pre-wrap" }}>
                    {c.metadatos.estrategia}
                  </div>
                )}
                {c.metadatos?.horarios && (
                  <div style={{ fontSize: "0.66rem", color: "#94a3b8", lineHeight: 1.3, marginTop: 1 }}>⏰ {c.metadatos.horarios}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Bubbles estado campañas anteriores ──────────────────────────────────────

function EstadoBubble({ est, idx, offset, mono }: {
  est: { nombre: string; color: string; descripcion: string | null; campana: string | null; estrategia?: string | null; campanaCreatedAt?: string | null };
  idx: number;
  offset: number;
  mono: boolean;
}) {
  const [tooltip, setTooltip] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const SIZE = 22;
  const TOOLTIP_MAX_H = 220;
  const TOOLTIP_W = 380;
  const bg = mono ? "color-mix(in srgb, var(--primary-color, #475569) 60%, white)" : est.color;
  const iniciales = est.nombre.split(/[\s.]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  function handleEnter() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const above = r.top > window.innerHeight / 2;
    const left = Math.min(r.left, window.innerWidth - TOOLTIP_W - 8);
    setTooltip({
      top: above ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, left),
      above,
    });
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setTooltip(null)}
        style={{
          position: "absolute",
          left: offset,
          zIndex: tooltip ? 10 : idx + 1,
          width: SIZE, height: SIZE,
          borderRadius: 99,
          background: bg,
          color: "#fff",
          border: "1.5px solid #fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.6rem", fontWeight: 700,
          cursor: "default", whiteSpace: "nowrap",
        }}
      >
        {iniciales}
      </div>
      {tooltip && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            top: tooltip.above ? undefined : tooltip.top,
            bottom: tooltip.above ? window.innerHeight - tooltip.top : undefined,
            left: tooltip.left,
            zIndex: 99999,
            background: "#1e293b", borderRadius: 8, padding: "0.5rem 0.75rem",
            boxShadow: "0 8px 24px rgba(15,23,42,0.22)", maxWidth: TOOLTIP_W, minWidth: 280,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: (est.descripcion || est.estrategia) ? 6 : 0 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: est.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f1f5f9" }}>{est.nombre}</span>
            {est.campana && <span style={{ fontSize: "0.65rem", color: "#64748b", marginLeft: 2 }}>· {est.campana}</span>}
          </div>
          {est.descripcion && (
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {est.descripcion}
            </div>
          )}
          {est.estrategia && (
            <div style={{ fontSize: "0.71rem", color: "#7dd3a8", lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: est.descripcion ? 4 : 0, fontStyle: "italic" }}>
              {est.estrategia}
            </div>
          )}
          {!est.descripcion && !est.estrategia && (
            <div style={{ fontSize: "0.7rem", color: "#475569", fontStyle: "italic" }}>Sin notas</div>
          )}
        </div>
      )}
    </>
  );
}

function EstadosBubbles({ estados, mono = false }: { estados: { nombre: string; color: string; descripcion: string | null; campana: string | null; estrategia?: string | null; campanaCreatedAt?: string | null }[]; mono?: boolean }) {
  if (!estados.length) return <span style={{ color: "#e2e8f0", fontSize: "0.7rem" }}>—</span>;
  // Ordenar por fecha de campaña ASC: más antiguo a la izquierda, más reciente a la derecha
  const ordered = [...estados].sort((a, b) => {
    if (!a.campanaCreatedAt && !b.campanaCreatedAt) return 0;
    if (!a.campanaCreatedAt) return 1;
    if (!b.campanaCreatedAt) return -1;
    return a.campanaCreatedAt < b.campanaCreatedAt ? -1 : 1;
  });
  const SIZE = 22;
  const OVERLAP = 8;
  const totalW = ordered.length * SIZE - (ordered.length - 1) * OVERLAP;
  return (
    <div style={{ position: "relative", width: totalW, height: SIZE, display: "inline-flex" }}>
      {ordered.map((est, i) => (
        <EstadoBubble key={i} est={est} idx={i} offset={i * (SIZE - OVERLAP)} mono={mono} />
      ))}
    </div>
  );
}

// ─── Date pill ───────────────────────────────────────────────────────────────

function formatNotasTooltip(notas: string | null | undefined): string {
  if (!notas) return "";
  try {
    const d = JSON.parse(notas);
    if (typeof d !== "object" || d === null) return notas;
    const lines: string[] = [];
    if (d.motivo) lines.push(`Motivo: ${d.motivo}`);
    // competidor puede estar en raíz o dentro de auditoria
    const competidor = d.competidor || d.auditoria?.competidor;
    if (competidor) lines.push(`Agencia: ${competidor}`);
    if (d.periodoDecision) lines.push(`Decisión: ${d.periodoDecision}`);
    if (d.interesFuturo) lines.push(`Interés: ${d.interesFuturo}`);
    if (d.visitaSugerida) lines.push(`Visita: ${d.visitaSugerida}`);
    if (d.observaciones) lines.push(`Obs: ${d.observaciones}`);
    if (d.estrategiaCampana) lines.push(`Estrategia: ${d.estrategiaCampana}`);
    // nunca mostrar el JSON crudo como fallback
    return lines.join("\n");
  } catch {
    // Si no es JSON válido, mostrar como texto plano
    return notas;
  }
}

function StatePill({ color, mono = false, fecha, notas }: { color: string; mono?: boolean; fecha?: string | null; notas?: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const notasTexto = formatNotasTooltip(notas);
  const [tooltip, setTooltip] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const bg = mono ? "color-mix(in srgb, var(--primary-color, #475569) 55%, white)" : color;
  const label = fecha
    ? new Date(fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "✓";

  function handleEnter() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const TOOLTIP_W = 280;
    const above = r.top > window.innerHeight / 2;
    setTooltip({
      top: above ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - TOOLTIP_W - 8)),
      above,
    });
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setTooltip(null)}
        style={{
          display: "inline-flex", alignItems: "center", height: 18, borderRadius: 99,
          background: bg, color: "#fff", fontSize: "0.65rem", fontWeight: 600,
          padding: "0 7px", whiteSpace: "nowrap",
          cursor: "default",
          outline: tooltip ? "2px solid rgba(255,255,255,0.4)" : undefined,
        }}
      >
        {label}
      </span>
      {tooltip && (
        <div style={{
          position: "fixed",
          top: tooltip.above ? undefined : tooltip.top,
          bottom: tooltip.above ? window.innerHeight - tooltip.top : undefined,
          left: tooltip.left,
          zIndex: 99999,
          background: "#1e293b", borderRadius: 8, padding: "0.5rem 0.75rem",
          boxShadow: "0 8px 24px rgba(15,23,42,0.22)", maxWidth: 280,
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: "0.72rem", color: notasTexto ? "#94a3b8" : "#475569", lineHeight: 1.5, whiteSpace: "pre-wrap", fontStyle: notasTexto ? "normal" : "italic" }}>{notasTexto || "Sin datos"}</div>
        </div>
      )}
    </>
  );
}

function capitalizarCiudad(c: string): string {
  return c.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

// ─── Panel lateral entidad ───────────────────────────────────────────────────

const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" };
const inp: React.CSSProperties = { width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.55rem", borderRadius: 6, border: "1.5px solid #e2e8f0", outline: "none", boxSizing: "border-box" };
const th: React.CSSProperties = { textAlign: "left", padding: "0.3rem 0.5rem 0.3rem 0", fontWeight: 600, color: "#94a3b8", fontSize: "0.65rem", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "0.4rem 0.5rem 0.4rem 0", color: "#1e293b", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const EMPTY_CONTACTO_FORM = { nombre: "", apellido: "", cargo: "", telefono: "", movil: "", email: "", antiguedad: "", desde: "", anios_experiencia: "", poder_decision: "", estrategia: "", horarios: "" };

type EntidadDetalle = {
  entidad: Oportunidad["contabilidad_entidades"];
};

type CampanaHistorialRow = {
  id: string;
  titulo: string;
  valor_estimado: number;
  prioridad: number | null;
  crm_campanas: { id: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null } | null;
  crm_campanas_estados: { nombre: string; color: string; es_ganado: boolean; es_final: boolean } | null;
  crm_agentes: { nombre: string; apellidos: string } | null;
};

function PanelEntidad({ data, onClose, onEntidadUpdated }: { data: EntidadDetalle; onClose: () => void; onEntidadUpdated?: (entidad: any) => void }) {
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

  // Edición de entidad
  const [hoveredEntidad, setHoveredEntidad] = useState(false);
  const [editingEntidad, setEditingEntidad] = useState(false);
  const [savingEntidad, setSavingEntidad] = useState(false);
  const [entidadLocal, setEntidadLocal] = useState<any>(entidad);
  const [entidadForm, setEntidadForm] = useState({
    nombre: entidad?.nombre ?? "",
    telefono: entidad?.telefono ?? "",
    email: entidad?.email ?? "",
    direccion: entidad?.direccion?.direccion ?? entidad?.direccion?.calle ?? "",
    ciudad: entidad?.direccion?.ciudad ?? "",
    provincia: entidad?.direccion?.provincia ?? "",
    cp: entidad?.direccion?.cp ?? "",
  });
  const setEF = (k: keyof typeof entidadForm) => (e: React.ChangeEvent<HTMLInputElement>) => setEntidadForm(p => ({ ...p, [k]: e.target.value }));

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
        ...(entidadLocal.direccion ?? {}),
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
          email: entidadForm.email || null,
          direccion: {
            ...(entidadLocal.direccion ?? {}),
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
        email: entidadForm.email || null,
        direccion: { ...(entidadLocal.direccion ?? {}), direccion: entidadForm.direccion || null, ciudad: entidadForm.ciudad || null, provincia: entidadForm.provincia || null, cp: entidadForm.cp || null },
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
        setContactos(prev => [...prev, json.data]);
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
        setContactos(prev => prev.map(c => c.id === editingContactoId ? json.data : c));
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
              {entidadLocal.tipo_entidad ?? "Entidad"}
            </div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.3, margin: 0, wordBreak: "break-word" }}>
              {entidadLocal.nombre}
            </h2>
          </div>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "#f1f5f9", borderRadius: "0.4rem", cursor: "pointer", color: "#64748b", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

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
                      email: entidadLocal.email ?? "",
                      direccion: entidadLocal.direccion?.direccion ?? entidadLocal.direccion?.calle ?? "",
                      ciudad: entidadLocal.direccion?.ciudad ?? "",
                      provincia: entidadLocal.direccion?.provincia ?? "",
                      cp: entidadLocal.direccion?.cp ?? "",
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
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Teléfono</label>
                    <input value={entidadForm.telefono} onChange={setEF("telefono")} style={inp} placeholder="Ej: 957123456" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Email</label>
                    <input value={entidadForm.email} onChange={setEF("email")} style={inp} placeholder="centro@ejemplo.com" />
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
                  {dir && Object.entries(dir).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k}><span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>{k}: </span>{String(v)}</div>
                  ))}
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

          {/* Contactos */}
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
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Poder de Decisión</label>
                      <input placeholder="Ej: Alto, Medio, Bajo" value={form.poder_decision} onChange={setF("poder_decision")} style={inp} />
                    </div>
                  </div>
                </div>

                {/* Información Adicional */}
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 5 }}>
                    <Info size={13} /> Información Adicional
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Estrategia</label>
                      <textarea placeholder="Estrategia o enfoque del responsable..." value={form.estrategia} onChange={setF("estrategia")} rows={3} style={{ ...inp, resize: "vertical" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Horarios</label>
                      <textarea placeholder="Horarios de disponibilidad..." value={form.horarios} onChange={setF("horarios")} rows={3} style={{ ...inp, resize: "vertical" }} />
                    </div>
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
                            {c.email && (
                              <a href={`mailto:${c.email}`} style={{ fontSize: "0.75rem", color: "var(--primary-color, #475569)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                                <Mail size={11} /> {c.email}
                              </a>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="contacto-edit-btn"
                          onClick={() => isEditing ? (setEditingContactoId(null), setForm(EMPTY_CONTACTO_FORM)) : openEditContacto(c)}
                          title={isEditing ? "Cancelar edición" : "Editar contacto"}
                          style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, border: "none", borderRadius: 5, background: isEditing ? "var(--primary-color, #475569)" : "#e2e8f0", color: isEditing ? "#fff" : "#64748b", cursor: "pointer", opacity: (isEditing || hoveredContactoId === c.id) ? 1 : 0, transition: "opacity 0.12s" }}
                        >
                          {isEditing ? <X size={12} /> : <Pencil size={12} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

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
                    <th style={th}>Campaña</th>
                    <th style={th}>Estado</th>
                    <th style={{ ...th, textAlign: "center" }}>P</th>
                    <th style={{ ...th, textAlign: "right" }}>Est.</th>
                    <th style={{ ...th, textAlign: "right" }}>Agente</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h, i) => {
                    const estado = h.crm_campanas_estados;
                    const ag = h.crm_agentes;
                    return (
                      <tr key={h.id} style={{ borderBottom: i < historial.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                        <td style={td} title={h.crm_campanas?.nombre ?? ""}>{h.crm_campanas?.nombre ?? "—"}</td>
                        <td style={{ ...td, paddingLeft: "0.5rem" }}>
                          {estado ? <span style={{ display: "inline-flex", alignItems: "center", height: 18, borderRadius: 99, background: estado.color, color: "#fff", fontSize: "0.62rem", fontWeight: 600, padding: "0 7px", whiteSpace: "nowrap" }}>{estado.nombre}</span> : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "center", paddingLeft: "0.5rem" }}>{h.prioridad ?? "—"}</td>
                        <td style={{ ...td, textAlign: "right", paddingLeft: "0.5rem" }}>{h.valor_estimado ? `${h.valor_estimado.toLocaleString("es-ES")} €` : "—"}</td>
                        <td style={{ ...td, textAlign: "right", paddingLeft: "0.5rem", color: "#64748b", fontSize: "0.72rem", maxWidth: 110 }}>{ag ? `${ag.nombre} ${ag.apellidos}`.trim() : "—"}</td>
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
                    <th style={th}>Referencia</th>
                    <th style={{ ...th, textAlign: "left" }}>Estado</th>
                    <th style={{ ...th, textAlign: "right" }}>Fechas</th>
                    <th style={{ ...th, textAlign: "right" }}>PVP</th>
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
                      <td style={{ ...td, color: "var(--primary-color, #475569)", fontWeight: 600 }}>{e.numero ? `#${e.numero}` : e.referencia?.slice(0, 22) ?? "—"}</td>
                      <td style={{ ...td }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 600, color: e.estado === "confirmado" ? "#16a34a" : e.estado === "anulado" ? "#dc2626" : "#475569" }}>
                          {e.estado ?? "—"}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "#64748b", fontSize: "0.72rem" }}>
                        {e.fecha_inicio ? new Date(e.fecha_inicio).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}
                        {e.fecha_fin ? ` → ${new Date(e.fecha_fin).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })}` : ""}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{e.pvp_total ? `${Number(e.pvp_total).toLocaleString("es-ES")} €` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
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
    </>
  );
}

// ─── Tabla de oportunidades ───────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function TablaOportunidades({ oportunidades, estados, monocromo, isOwner, campanaId, objetivoTotal, agentes, onNuevaOportunidad, onNuevaOportunidadPlaces, onEstadoChange, onPresupuestoClick, onCierreClick, onAgenteChange, onEliminarOportunidad, onEntidadClick, onOportunidadUpdate }: {
  oportunidades: Oportunidad[];
  estados: Estado[];
  monocromo: boolean;
  isOwner: boolean;
  campanaId: string;
  objetivoTotal: number;
  agentes: AgenteObjetivo[];
  onNuevaOportunidad: () => void;
  onNuevaOportunidadPlaces: () => void;
  onEstadoChange: (id: string, estadoId: string) => void;
  onPresupuestoClick: (oportunidadId: string) => void;
  onCierreClick: (oportunidadId: string, estadoId: string) => void;
  onAgenteChange?: (oportunidadId: string, agenteId: string | null) => void;
  onEliminarOportunidad?: (oportunidadId: string) => void;
  onEntidadClick?: (data: EntidadDetalle) => void;
  onOportunidadUpdate?: (id: string, patch: Partial<Oportunidad>) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAddMenu) return;
    function handleClick(e: MouseEvent) {
      if (addBtnRef.current && addBtnRef.current.contains(e.target as Node)) return;
      setShowAddMenu(false);
    }
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [showAddMenu]);
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [estadoFilter, setEstadoFilter] = useState<string[]>([]);
  const [ciudadFilter, setCiudadFilter] = useState<string[]>([]);
  const [prioridadFilter, setPrioridadFilter] = useState<number[]>([]);
  const [sortCol, setSortCol] = useState<string | null>("oportunidad");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const filterRowRef = useRef<HTMLDivElement>(null);

  const [estrategiaModal, setEstrategiaModal] = useState<{ op: Oportunidad } | null>(null);
  const [draggedOpId, setDraggedOpId] = useState<string | null>(null);
  const [agentePickerOpId, setAgentePickerOpId] = useState<string | null>(null);
  const [agentePickerPos, setAgentePickerPos] = useState<{ top: number; left: number } | null>(null);
  const agentePickerRef = useRef<HTMLDivElement | null>(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ opId: string; estadoId: string } | null>(null);
  const [showMapa, setShowMapa] = useState(false);
  const [sinCoordsFilter, setSinCoordsFilter] = useState(false);
  const [editingCell, setEditingCell] = useState<{ opId: string; field: "prioridad" | "valor_estimado" } | null>(null);
  const [editingVal, setEditingVal] = useState("");
  const editingCellRef = useRef<{ opId: string; field: "prioridad" | "valor_estimado" } | null>(null);
  const editingValRef = useRef("");
  const savedRef = useRef(false);

  useEffect(() => {
    if (!agentePickerOpId) return;
    function handleClick(e: MouseEvent) {
      if (agentePickerRef.current && agentePickerRef.current.contains(e.target as Node)) return;
      setAgentePickerOpId(null);
      setAgentePickerPos(null);
    }
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [agentePickerOpId]);

  useEffect(() => {
    if (!openDropdown) return;
    function handleClick(e: MouseEvent) {
      if (filterRowRef.current && !filterRowRef.current.contains(e.target as Node)) setOpenDropdown(null);
    }
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [openDropdown]);

  const agentesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    oportunidades.forEach(o => {
      if (o.agente_id && o.crm_agentes)
        map.set(o.agente_id, `${o.crm_agentes.nombre} ${o.crm_agentes.apellidos}`);
    });
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [oportunidades]);

  function normalizarCiudad(c: string): string {
    return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  const prioridadesUnicas = useMemo(() => {
    const set = new Set<number>();
    oportunidades.forEach(o => { if (o.prioridad != null) set.add(o.prioridad); });
    return [...set].sort((a, b) => a - b);
  }, [oportunidades]);

  const ciudadesUnicas = useMemo(() => {
    const map = new Map<string, string>(); // normalizada → capitalizada
    oportunidades.forEach(o => {
      const c = o.contabilidad_entidades?.direccion?.ciudad;
      if (c?.trim()) {
        const key = normalizarCiudad(c);
        if (!map.has(key)) map.set(key, capitalizarCiudad(c));
      }
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([norm, display]) => ({ norm, display }));
  }, [oportunidades]);

  // filtrado completo (listado)
  const filtered = useMemo(() => {
    return oportunidades.filter(o => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = [
          o.titulo,
          o.contabilidad_entidades?.nombre ?? "",
          o.crm_contactos?.nombre ?? "",
          o.crm_agentes ? `${o.crm_agentes.nombre} ${o.crm_agentes.apellidos}` : "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (agenteFilter.length > 0 && !agenteFilter.includes(o.agente_id ?? "")) return false;
      if (estadoFilter.length > 0 && !estadoFilter.includes(o.estado_id)) return false;
      if (ciudadFilter.length > 0) {
        const ciudad = o.contabilidad_entidades?.direccion?.ciudad ?? "";
        if (!ciudadFilter.includes(normalizarCiudad(ciudad))) return false;
      }
      if (prioridadFilter.length > 0 && !prioridadFilter.includes(o.prioridad ?? -1)) return false;
      if (sinCoordsFilter && o.contabilidad_entidades?.lat != null) return false;
      return true;
    });
  }, [oportunidades, search, agenteFilter, estadoFilter, ciudadFilter, prioridadFilter, sinCoordsFilter]);

  // filtrado para KPIs y gráficos (sin filtro de estado ni búsqueda)
  const filteredKpi = useMemo(() => {
    return oportunidades.filter(o => {
      if (agenteFilter.length > 0 && !agenteFilter.includes(o.agente_id ?? "")) return false;
      if (ciudadFilter.length > 0) {
        const ciudad = o.contabilidad_entidades?.direccion?.ciudad ?? "";
        if (!ciudadFilter.includes(normalizarCiudad(ciudad))) return false;
      }
      if (prioridadFilter.length > 0 && !prioridadFilter.includes(o.prioridad ?? -1)) return false;
      return true;
    });
  }, [oportunidades, agenteFilter, ciudadFilter, prioridadFilter]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let va: any, vb: any;
      if (sortCol === "agente") {
        va = a.crm_agentes ? `${a.crm_agentes.nombre} ${a.crm_agentes.apellidos}` : "";
        vb = b.crm_agentes ? `${b.crm_agentes.nombre} ${b.crm_agentes.apellidos}` : "";
      } else if (sortCol === "prioridad") {
        va = a.prioridad ?? 99999; vb = b.prioridad ?? 99999;
      } else if (sortCol === "oportunidad") {
        va = a.contabilidad_entidades?.nombre ?? a.titulo ?? "";
        vb = b.contabilidad_entidades?.nombre ?? b.titulo ?? "";
      } else if (sortCol === "resp") {
        va = a.contabilidad_entidades?.crm_contactos?.length ?? 0;
        vb = b.contabilidad_entidades?.crm_contactos?.length ?? 0;
      } else if (sortCol === "estimacion") {
        va = a.valor_estimado; vb = b.valor_estimado;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb, "es") : vb.localeCompare(va, "es");
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totalFiltrosActivos = agenteFilter.length + estadoFilter.length + ciudadFilter.length + prioridadFilter.length + (sinCoordsFilter ? 1 : 0);

  useEffect(() => { setPage(1); }, [search, agenteFilter, estadoFilter, ciudadFilter, prioridadFilter, sinCoordsFilter, pageSize, sortCol, sortDir]);

  async function saveEditingCell() {
    if (savedRef.current) return;
    const cell = editingCellRef.current;
    if (!cell) return;
    savedRef.current = true;
    const raw = editingValRef.current.trim().replace(/\./g, "").replace(",", ".");
    const val = cell.field === "prioridad" ? parseInt(raw) : parseFloat(raw);
    setEditingCell(null);
    editingCellRef.current = null;
    if (isNaN(val)) return;
    try {
      await fetch(`/api/crm/oportunidades/${cell.opId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cell.field]: val }),
      });
      onOportunidadUpdate?.(cell.opId, { [cell.field]: val });
    } catch { }
  }

  function startEditingCell(opId: string, field: "prioridad" | "valor_estimado", val: string) {
    savedRef.current = false;
    editingCellRef.current = { opId, field };
    editingValRef.current = val;
    setEditingCell({ opId, field });
    setEditingVal(val);
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }
  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronUp size={10} style={{ opacity: 0.3, marginLeft: 2 }} />;
    return sortDir === "asc" ? <ChevronUp size={10} style={{ marginLeft: 2 }} /> : <ChevronDown size={10} style={{ marginLeft: 2 }} />;
  }

  const valorPotencial = filteredKpi.reduce((s, o) => s + o.valor_estimado, 0);

  const objetivoFiltrado = useMemo(() => {
    if (agenteFilter.length === 0) return objetivoTotal;
    return agentes
      .filter(a => agenteFilter.includes(a.agente_id))
      .reduce((s, a) => s + (a.objetivo_valor ?? 0), 0);
  }, [agentes, agenteFilter, objetivoTotal]);

  const estadosNormales = estados.filter(e => !e.es_final || e.es_ganado);
  const estadosFinalesNegativos = estados.filter(e => e.es_final && !e.es_ganado);
  const conSeparador = estadosFinalesNegativos.length > 0;
  const totalCols = 3 + (isOwner ? 1 : 0) + estados.length + (conSeparador ? 1 : 0) + 2;

  return (
    <>
      {/* KPIs */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard} style={{ background: monocromo ? "color-mix(in srgb, var(--primary-color,#475569) 80%, white)" : "#3d9183" }}>
          <span className={styles.kpiCardLabel}>POTENCIAL</span>
          <span className={styles.kpiCardValue}>{valorPotencial.toLocaleString("es-ES")} € ({filteredKpi.length})</span>
          {(() => {
            const p1 = filteredKpi.filter(o => o.prioridad === 1);
            const p2 = filteredKpi.filter(o => o.prioridad === 2);
            const p1val = p1.reduce((s, o) => s + o.valor_estimado, 0);
            const p2val = p2.reduce((s, o) => s + o.valor_estimado, 0);
            return (
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", display: "flex", justifyContent: "space-between", width: "100%" }}><span>P1</span><span>{p1val.toLocaleString("es-ES")} € ({p1.length})</span></span>
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", display: "flex", justifyContent: "space-between", width: "100%" }}><span>P2</span><span>{p2val.toLocaleString("es-ES")} € ({p2.length})</span></span>
              </div>
            );
          })()}
        </div>
        {estados.map((e, i) => {
          const ops = filteredKpi.filter(o => o.estado_id === e.id);
          const valor = ops.reduce((s, o) => s + o.valor_estimado, 0);
          const p1 = ops.filter(o => o.prioridad === 1);
          const p2 = ops.filter(o => o.prioridad === 2);
          const p1val = p1.reduce((s, o) => s + o.valor_estimado, 0);
          const p2val = p2.reduce((s, o) => s + o.valor_estimado, 0);
          const MONO_ALPHAS = [70, 58, 46, 36, 27, 20, 15, 10];
          const bg = monocromo ? `color-mix(in srgb, var(--primary-color,#475569) ${MONO_ALPHAS[i % MONO_ALPHAS.length]}%, white)` : e.color;
          return (
            <div key={e.id} className={styles.kpiCard} style={{ background: bg }}>
              <span className={styles.kpiCardLabel}>{e.nombre.toUpperCase()}</span>
              <span className={styles.kpiCardValue}>
                {valor > 0 ? `${valor.toLocaleString("es-ES")} € (${ops.length})` : ops.length}
              </span>
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", display: "flex", justifyContent: "space-between", width: "100%" }}><span>P1</span><span>{p1val > 0 ? `${p1val.toLocaleString("es-ES")} € ` : "0 € "}({p1.length})</span></span>
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.85)", display: "flex", justifyContent: "space-between", width: "100%" }}><span>P2</span><span>{p2val > 0 ? `${p2val.toLocaleString("es-ES")} € ` : "0 € "}({p2.length})</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráficos */}
      <CampanaCharts campanaId={campanaId} estados={estados} oportunidades={filteredKpi} objetivoTotal={objetivoFiltrado} monocromo={monocromo} />

    <div className={styles.tableWrapper}>
      <div className={styles.tableHeader}>
        <span className={styles.tableTitle}>Listado de oportunidades ({filtered.length})</span>
        <div className={styles.tableActions}>
          <div className={styles.searchWrapperTbl}>
            <Search size={13} className={styles.searchIconTbl} />
            <input
              className={styles.searchInputTbl}
              placeholder="Buscar contacto…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`${styles.filterIconBtn}${showFilters || totalFiltrosActivos > 0 ? " " + styles.filterIconBtnActive : ""}`}
            onClick={() => { setShowFilters(v => !v); setOpenDropdown(null); }}
          >
            <SlidersHorizontal size={15} />
            {totalFiltrosActivos > 0 && <span className={styles.filterBadge}>{totalFiltrosActivos}</span>}
          </button>
          <button
            className={styles.filterIconBtn}
            onClick={() => setShowMapa(v => !v)}
            title={showMapa ? "Ver listado" : "Ver mapa"}
            style={{ color: showMapa ? "var(--primary-color,#475569)" : undefined }}
          >
            <MapPin size={15} />
          </button>
          {isOwner && <div ref={addBtnRef} style={{ position: "relative" }}>
            <button className={styles.addBtn} onClick={() => setShowAddMenu(v => !v)} title="Nueva oportunidad">
              <Plus size={15} />
            </button>
            {showAddMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", minWidth: 210, zIndex: 999, overflow: "hidden" }}>
                <button
                  onClick={() => { setShowAddMenu(false); onNuevaOportunidad(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.65rem 1rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "#1e293b", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <Pencil size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Añadir manualmente</div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Introduce los datos a mano</div>
                  </div>
                </button>
                <div style={{ height: 1, background: "#f1f5f9" }} />
                <button
                  onClick={() => { setShowAddMenu(false); onNuevaOportunidadPlaces(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.65rem 1rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "#1e293b", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <MapPin size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Buscar en Google Places</div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Negocios por zona y tipo</div>
                  </div>
                </button>
              </div>
            )}
          </div>}
        </div>
      </div>

      {showFilters && (
        <div className={styles.filterRow} ref={filterRowRef}>
          {/* Filtro por estado */}
          <div className={styles.filterDropdownGroup}>
            <button
              className={`${styles.filterDropdownTrigger}${estadoFilter.length > 0 ? " " + styles.filterDropdownTriggerActive : ""}`}
              onClick={() => setOpenDropdown(v => v === "estado" ? null : "estado")}
            >
              Estado {estadoFilter.length > 0 && <span className={styles.filterDropdownBadge}>{estadoFilter.length}</span>}
              <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "estado" ? "rotate(180deg)" : undefined }}>▾</span>
            </button>
            {openDropdown === "estado" && (
              <div className={styles.filterDropdownMenu}>
                {estados.map(e => (
                  <label key={e.id} className={styles.filterDropdownItem}>
                    <input type="checkbox" checked={estadoFilter.includes(e.id)} onChange={() => {
                      setEstadoFilter(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id]);
                    }} style={{ accentColor: e.color }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0, display: "inline-block" }} />
                    <span>{e.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Filtro por agente (solo owners) */}
          {isOwner && agentesUnicos.length > 0 && (
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger}${agenteFilter.length > 0 ? " " + styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "agente" ? null : "agente")}
              >
                Agente {agenteFilter.length > 0 && <span className={styles.filterDropdownBadge}>{agenteFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "agente" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "agente" && (
                <div className={styles.filterDropdownMenu}>
                  {agentesUnicos.map(a => (
                    <label key={a.id} className={styles.filterDropdownItem}>
                      <input type="checkbox" checked={agenteFilter.includes(a.id)} onChange={() => {
                        setAgenteFilter(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]);
                      }} />
                      <span>{a.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filtro por ciudad */}
          {ciudadesUnicas.length > 0 && (
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger}${ciudadFilter.length > 0 ? " " + styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "ciudad" ? null : "ciudad")}
              >
                Ciudad {ciudadFilter.length > 0 && <span className={styles.filterDropdownBadge}>{ciudadFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "ciudad" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "ciudad" && (
                <div className={styles.filterDropdownMenu} style={{ maxHeight: 240, overflowY: "auto" }}>
                  {ciudadesUnicas.map(({ norm, display }) => (
                    <label key={norm} className={styles.filterDropdownItem}>
                      <input type="checkbox" checked={ciudadFilter.includes(norm)} onChange={() => {
                        setCiudadFilter(prev => prev.includes(norm) ? prev.filter(x => x !== norm) : [...prev, norm]);
                      }} />
                      <span>{display}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filtro por prioridad */}
          {prioridadesUnicas.length > 0 && (
            <div className={styles.filterDropdownGroup}>
              <button
                className={`${styles.filterDropdownTrigger}${prioridadFilter.length > 0 ? " " + styles.filterDropdownTriggerActive : ""}`}
                onClick={() => setOpenDropdown(v => v === "prioridad" ? null : "prioridad")}
              >
                Prioridad {prioridadFilter.length > 0 && <span className={styles.filterDropdownBadge}>{prioridadFilter.length}</span>}
                <span className={styles.filterDropdownChevron} style={{ transform: openDropdown === "prioridad" ? "rotate(180deg)" : undefined }}>▾</span>
              </button>
              {openDropdown === "prioridad" && (
                <div className={styles.filterDropdownMenu} style={{ maxHeight: 200, overflowY: "auto" }}>
                  {prioridadesUnicas.map(p => (
                    <label key={p} className={styles.filterDropdownItem}>
                      <input type="checkbox" checked={prioridadFilter.includes(p)} onChange={() => {
                        setPrioridadFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
                      }} />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setSinCoordsFilter(v => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0.25rem 0.65rem", fontSize: "0.72rem", fontWeight: 600, borderRadius: 6, border: `1.5px solid ${sinCoordsFilter ? "var(--primary-color,#475569)" : "#e2e8f0"}`, background: sinCoordsFilter ? "var(--primary-color,#475569)" : "#fff", color: sinCoordsFilter ? "#fff" : "#64748b", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <MapPin size={11} /> Sin coords
          </button>

          {totalFiltrosActivos > 0 && (
            <button className={styles.filterClear} onClick={() => { setAgenteFilter([]); setEstadoFilter([]); setCiudadFilter([]); setPrioridadFilter([]); setSinCoordsFilter(false); }}>Limpiar todo</button>
          )}
        </div>
      )}

      {showMapa ? (
        <div style={{ height: 520, padding: "0 0 0.5rem" }}>
          <MapaOportunidadesDynamic
            puntos={filtered.flatMap(o => {
              const e = o.contabilidad_entidades;
              if (!e?.lat || !e?.lng) return [];
              return [{
                id: e.id,
                nombre: e.nombre ?? "",
                lat: e.lat,
                lng: e.lng,
                estadoNombre: o.crm_campanas_estados?.nombre ?? "",
                estadoColor: o.crm_campanas_estados?.color ?? "#94a3b8",
                agente: o.crm_agentes ? `${o.crm_agentes.nombre} ${o.crm_agentes.apellidos}` : undefined,
              }];
            })}
            onEntidadClick={id => {
              const op = filtered.find(o => o.contabilidad_entidades?.id === id);
              if (op?.contabilidad_entidades) onEntidadClick?.({ entidad: op.contabilidad_entidades });
            }}
          />
        </div>
      ) : (
      <table className={styles.table}>
        <thead>
          <tr>
            {isOwner && <th className={styles.th} style={{ width: 46, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("agente")}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2 }}>AG<SortIcon col="agente" /></span></th>}
            <th className={styles.th} style={{ width: 46, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("prioridad")}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2 }}>P<SortIcon col="prioridad" /></span></th>
            <th className={styles.th} style={{ textAlign: "left", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("oportunidad")}><span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>Oportunidad<SortIcon col="oportunidad" /></span></th>
            <th className={styles.th} style={{ width: 58, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("resp")}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2 }}>Resp.<SortIcon col="resp" /></span></th>
            <th className={styles.th} style={{ textAlign: "left", whiteSpace: "nowrap" }}>Camp. ant.</th>
            {estadosNormales.map(e => (
              <th key={e.id} className={`${styles.th} ${styles.thEstado}`} style={{ textAlign: "center" }}>{e.nombre}</th>
            ))}
            {conSeparador && <th className={`${styles.thSep} ${styles.thSepEstado}`} />}
            {estadosFinalesNegativos.map(e => (
              <th key={e.id} className={`${styles.th} ${styles.thGray} ${styles.thEstado}`} style={{ textAlign: "center" }}>{e.nombre}</th>
            ))}
            <th className={`${styles.th} ${styles.thEstadoCol}`} style={{ textAlign: "center" }}>Estado</th>
            <th className={styles.th} style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("estimacion")}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 2, width: "100%" }}>Estimación<SortIcon col="estimacion" /></span></th>
            <th className={styles.th} style={{ textAlign: "center", width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((o, i) => (
            <tr key={o.id} className={styles.tr}>
              {isOwner && (
                <td className={styles.tdCenter}>
                  <span
                    className={styles.agenteCircle}
                    title={o.crm_agentes ? `${o.crm_agentes.nombre} ${o.crm_agentes.apellidos}` : "Sin agente"}
                    style={{ cursor: "pointer", opacity: o.crm_agentes ? 1 : 0.35, outline: agentePickerOpId === o.id ? "2px solid var(--primary-color, #475569)" : undefined, outlineOffset: 2 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (agentePickerOpId === o.id) { setAgentePickerOpId(null); setAgentePickerPos(null); return; }
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setAgentePickerPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                      setAgentePickerOpId(o.id);
                    }}
                  >
                    {o.crm_agentes ? initials(o.crm_agentes.nombre, o.crm_agentes.apellidos) : "—"}
                  </span>
                </td>
              )}
              <td className={styles.tdCenter} onClick={e => e.stopPropagation()}>
                {editingCell?.opId === o.id && editingCell.field === "prioridad" ? (
                  <input
                    autoFocus
                    type="number"
                    value={editingVal}
                    onChange={e => { setEditingVal(e.target.value); editingValRef.current = e.target.value; }}
                    onBlur={saveEditingCell}
                    onKeyDown={e => { if (e.key === "Enter") saveEditingCell(); if (e.key === "Escape") { setEditingCell(null); editingCellRef.current = null; } }}
                    style={{ width: 44, fontSize: "0.75rem", textAlign: "center", border: "1.5px solid var(--primary-color,#475569)", borderRadius: 4, padding: "1px 2px", outline: "none" }}
                  />
                ) : (
                  <span
                    className={styles.prioridad}
                    title="Click para editar prioridad"
                    style={{ cursor: "pointer" }}
                    onClick={() => startEditingCell(o.id, "prioridad", String(o.prioridad ?? ""))}
                  >
                    {o.prioridad ?? (safePage - 1) * pageSize + i + 1}
                  </span>
                )}
              </td>
              <td className={styles.td} style={{ maxWidth: 260 }}>
                <span
                  style={{ fontWeight: 600, color: "#1e293b", display: "block", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase", fontSize: "0.75rem", cursor: o.contabilidad_entidades ? "pointer" : "default" }}
                  title={o.contabilidad_entidades?.nombre ?? o.titulo}
                  onClick={e => {
                    e.stopPropagation();
                    if (!o.contabilidad_entidades) return;
                    onEntidadClick?.({ entidad: o.contabilidad_entidades });
                  }}
                >
                  {o.contabilidad_entidades?.nombre ?? o.titulo}
                </span>
                {o.contabilidad_entidades?.direccion?.ciudad && (
                  <span style={{ display: "block", fontSize: "0.68rem", color: "#94a3b8", lineHeight: 1.2 }}>
                    {capitalizarCiudad(o.contabilidad_entidades.direccion.ciudad)}
                  </span>
                )}
              </td>
              <td className={styles.tdCenter}>
                <ResponsablesTooltip contactos={o.contabilidad_entidades?.crm_contactos ?? []} />
              </td>
              <td className={styles.td}>
                <EstadosBubbles estados={o.estados_campanas_anteriores ?? []} mono={monocromo} />
              </td>
              {estadosNormales.map(e => {
                const isVisitando = e.nombre?.toLowerCase() === "visitando";
                return (
                <td
                  key={e.id}
                  className={`${styles.tdCenter} ${styles.dropZone} ${styles.tdEstado} ${
                    dragOverCell?.opId === o.id && dragOverCell?.estadoId === e.id
                      ? styles.dropZoneActive
                      : ""
                  }`}
                  onDragOver={(ev) => {
                    if (draggedOpId === o.id) {
                      ev.preventDefault();
                    }
                  }}
                  onDragEnter={() => {
                    if (draggedOpId === o.id) {
                      setDragOverCell({ opId: o.id, estadoId: e.id });
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverCell(null);
                  }}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setDragOverCell(null);
                    const opId = ev.dataTransfer.getData("text/plain");
                    if (opId === o.id && o.estado_id !== e.id) {
                      onEstadoChange(opId, e.id);
                    }
                  }}
                >
                  {o.estado_id === e.id ? (
                    <div
                      draggable
                      onDragStart={(ev) => {
                        setDraggedOpId(o.id);
                        ev.dataTransfer.setData("text/plain", o.id);
                      }}
                      onDragEnd={() => {
                        setDraggedOpId(null);
                      }}
                      onClick={isVisitando ? () => onPresupuestoClick(o.id) : undefined}
                      className={`${styles.draggablePill} ${
                        draggedOpId === o.id ? styles.draggedSource : ""
                      } ${isVisitando ? styles.pillClickable : ""}`}
                    >
                      <StatePill color={e.color} mono={monocromo} fecha={o.fecha_ultimo_cambio_estado ?? o.fecha_cierre_est} notas={o.ultima_nota_log ?? o.mig_notas?.observaciones ?? null} />
                    </div>
                  ) : (
                    <span style={{ display: "block", height: 18 }} />
                  )}
                </td>
              );
              })}
              {conSeparador && <td className={`${styles.tdSep} ${styles.tdSepEstado}`} />}
              {estadosFinalesNegativos.map(e => (
                <td
                  key={e.id}
                  className={`${styles.tdCenter} ${styles.tdGray} ${styles.dropZone} ${styles.tdEstado} ${
                    dragOverCell?.opId === o.id && dragOverCell?.estadoId === e.id
                      ? styles.dropZoneActive
                      : ""
                  }`}
                  onDragOver={(ev) => {
                    if (draggedOpId === o.id) {
                      ev.preventDefault();
                    }
                  }}
                  onDragEnter={() => {
                    if (draggedOpId === o.id) {
                      setDragOverCell({ opId: o.id, estadoId: e.id });
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverCell(null);
                  }}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setDragOverCell(null);
                    const opId = ev.dataTransfer.getData("text/plain");
                    if (opId === o.id && o.estado_id !== e.id) {
                      onEstadoChange(opId, e.id);
                    }
                  }}
                >
                  {o.estado_id === e.id ? (
                    <div
                      draggable
                      onDragStart={(ev) => {
                        setDraggedOpId(o.id);
                        ev.dataTransfer.setData("text/plain", o.id);
                      }}
                      onDragEnd={() => {
                        setDraggedOpId(null);
                      }}
                      onClick={() => onCierreClick(o.id, o.estado_id)}
                      className={`${styles.draggablePill} ${styles.pillClickable} ${
                        draggedOpId === o.id ? styles.draggedSource : ""
                      }`}
                    >
                      <StatePill color={e.color} mono={monocromo} fecha={o.fecha_cierre_est} notas={o.ultima_nota_log ?? o.mig_notas?.observaciones ?? null} />
                    </div>
                  ) : (
                    <span style={{ display: "block", height: 18 }} />
                  )}
                </td>
              ))}
              <td className={`${styles.tdCenter} ${styles.tdEstadoCol}`}>
                {o.crm_campanas_estados && (
                  <StatePill color={o.crm_campanas_estados.color} mono={monocromo} fecha={o.fecha_ultimo_cambio_estado ?? o.fecha_cierre_est} notas={o.ultima_nota_log ?? o.mig_notas?.observaciones ?? null} />
                )}
              </td>
              <td className={styles.tdRight} style={{ fontWeight: 600, color: "#1e293b" }} onClick={e => e.stopPropagation()}>
                {editingCell?.opId === o.id && editingCell.field === "valor_estimado" ? (
                  <input
                    autoFocus
                    type="number"
                    value={editingVal}
                    onChange={e => { setEditingVal(e.target.value); editingValRef.current = e.target.value; }}
                    onBlur={saveEditingCell}
                    onKeyDown={e => { if (e.key === "Enter") saveEditingCell(); if (e.key === "Escape") { setEditingCell(null); editingCellRef.current = null; } }}
                    style={{ width: 80, fontSize: "0.78rem", textAlign: "right", border: "1.5px solid var(--primary-color,#475569)", borderRadius: 4, padding: "1px 4px", outline: "none" }}
                  />
                ) : (
                  <span
                    style={{ cursor: "pointer" }}
                    title="Click para editar estimación"
                    onClick={() => startEditingCell(o.id, "valor_estimado", String(o.valor_estimado || ""))}
                  >
                    {o.valor_estimado > 0 ? `${o.valor_estimado.toLocaleString("es-ES")} €` : <span style={{ color: "#e2e8f0" }}>—</span>}
                  </span>
                )}
              </td>
              <td className={styles.tdCenter}>
                <div className={styles.acciones}>
                  {!o.expediente_id && (
                    <button
                      className={styles.accionBtn}
                      title="Estrategia de captación"
                      style={{ color: o.descripcion ? "var(--primary-color,#475569)" : "#cbd5e1" }}
                      onClick={e => { e.stopPropagation(); setEstrategiaModal({ op: o }); }}
                    >
                      <Rocket size={14} />
                    </button>
                  )}
                  <button
                    className={`${styles.accionBtn} ${styles.accionBtnDanger}`}
                    title="Eliminar oportunidad"
                    onClick={e => { e.stopPropagation(); setConfirmarEliminarId(o.id); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {paginated.length === 0 && (
            <tr>
              <td colSpan={totalCols} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.82rem" }}>
                {search || agenteFilter.length > 0 ? "No hay resultados." : "Esta campaña aún no tiene oportunidades."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      )}

      {/* Paginación */}
      {!showMapa && <div className={styles.pagination}>
        <div className={styles.pageSizeRow}>
          <span className={styles.pageSizeLabel}>Filas por página:</span>
          {PAGE_SIZE_OPTIONS.map(n => (
            <button
              key={n}
              className={`${styles.pageSizeBtn}${pageSize === n ? " " + styles.pageSizeBtnActive : ""}`}
              onClick={() => setPageSize(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className={styles.pageNav}>
          <span className={styles.pageInfo}>
            {filtered.length === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)}`} de {filtered.length}
          </span>
          <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>
            <ChevronLeft size={14} />
          </button>
          <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>}
    </div>

    {/* Modal confirmar eliminación */}
    {confirmarEliminarId && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}
        onClick={() => setConfirmarEliminarId(null)}>
        <div style={{ background: "#fff", borderRadius: "1rem", padding: "1.75rem", maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          onClick={e => e.stopPropagation()}>
          <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: "0.5rem" }}>¿Eliminar oportunidad?</p>
          <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            Esta acción no se puede deshacer. Se eliminará la oportunidad y todo su historial de estados.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              style={{ padding: "0.5rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", fontSize: "0.82rem", color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => setConfirmarEliminarId(null)}
            >Cancelar</button>
            <button
              style={{ padding: "0.5rem 1rem", border: "none", borderRadius: "0.5rem", background: "#ef4444", fontSize: "0.82rem", fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => { onEliminarOportunidad?.(confirmarEliminarId); setConfirmarEliminarId(null); }}
            >Eliminar</button>
          </div>
        </div>
      </div>
    )}

    {/* Agente picker — fuera del tableWrapper para evitar overflow:hidden */}
    {agentePickerOpId && agentePickerPos && (() => {
      const op = paginated.find(o => o.id === agentePickerOpId);
      if (!op) return null;
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
          {agentes.map(a => {
            const ag = a.crm_agentes;
            if (!ag) return null;
            const isSelected = op.agente_id === a.agente_id;
            return (
              <div
                key={a.agente_id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0.4rem 0.85rem", cursor: "pointer",
                  background: isSelected ? "color-mix(in srgb, var(--primary-color, #475569) 10%, white)" : undefined,
                  fontWeight: isSelected ? 600 : 400, color: "#1e293b",
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = ""; }}
                onClick={() => { onAgenteChange?.(op.id, a.agente_id); setAgentePickerOpId(null); setAgentePickerPos(null); }}
              >
                <span className={styles.agenteCircle} style={{ width: 24, height: 24, fontSize: "0.62rem", flexShrink: 0 }}>
                  {initials(ag.nombre, ag.apellidos)}
                </span>
                {ag.nombre} {ag.apellidos}
              </div>
            );
          })}
          {op.agente_id && (
            <div
              style={{ padding: "0.3rem 0.85rem", cursor: "pointer", color: "#ef4444", fontSize: "0.74rem", borderTop: "1px solid #f1f5f9", marginTop: 2 }}
              onClick={() => { onAgenteChange?.(op.id, null); setAgentePickerOpId(null); setAgentePickerPos(null); }}
            >
              Quitar agente
            </div>
          )}
        </div>
      );
    })()}

    {/* Modal estrategia / campañas anteriores */}
    {estrategiaModal && (
      <ModalEstrategia
        op={estrategiaModal.op}
        onClose={() => setEstrategiaModal(null)}
        onSave={async (descripcion) => {
          onOportunidadUpdate?.(estrategiaModal.op.id, { descripcion });
          setEstrategiaModal(null);
          try {
            await fetch(`/api/crm/oportunidades/${estrategiaModal.op.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ descripcion }),
            });
          } catch { }
        }}
      />
    )}
    </>
  );
}

// ─── Modal Estrategia ────────────────────────────────────────────────────────

function ModalEstrategia({ op, onClose, onSave }: {
  op: Oportunidad;
  onClose: () => void;
  onSave: (descripcion: string) => void;
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
                          { icon: <Heart size={12} />, value: contacto.metadatos?.estrategia, text: contacto.metadatos?.estrategia || "—" },
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
                  { key: "preferencias", label: "Preferencias", icon: <Heart size={14} /> },
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
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <div style={{ flex: 1 }}><label style={lbl}>Horarios</label><textarea value={f.horarios} onChange={setF("horarios")} rows={3} style={{ ...inp, resize: "vertical" }} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Preferencias</label><textarea value={f.estrategia} onChange={setF("estrategia")} rows={3} style={{ ...inp, resize: "vertical" }} /></div>
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CampanaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campana, setCampana] = useState<Campana | null>(null);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPlacesNearby, setShowPlacesNearby] = useState(false);
  const [monocromo, setMonocromo] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [currentAgenteId, setCurrentAgenteId] = useState<string | null>(null);
  const [entidadPanel, setEntidadPanel] = useState<EntidadDetalle | null>(null);

  const [pendingClosure, setPendingClosure] = useState<{
    oportunidadId: string;
    estadoId: string;
  } | null>(null);
  const [savingClosure, setSavingClosure] = useState(false);

  // Modal presupuesto vinculado a oportunidad
  const [presupuestoModal, setPresupuestoModal] = useState<{
    oportunidadId: string;
    campanaId: string;
    oportunidadNombre: string;
    presupuesto: any | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, { data: ops }] = await Promise.all([
        apiFetch(`/api/crm/campanas/${id}`),
        apiFetch(`/api/crm/oportunidades?campana_id=${id}`),
      ]);
      const owner = ["Owner", "SuperAdmin", "Admin"].includes(campRes.rol ?? "");
      setCampana(campRes.data);
      setIsOwner(owner);
      setCurrentAgenteId(campRes.agenteId ?? null);
      const allOps: Oportunidad[] = ops ?? [];
      setOportunidades(owner ? allOps : allOps.filter(o => o.agente_id === campRes.agenteId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function executeEstadoChange(oportunidadId: string, estadoId: string, closureData?: any) {
    const notas = closureData ? JSON.stringify(closureData) : undefined;

    // Actualizar prioridad/valor si vienen del modal de cierre
    if (closureData) {
      try {
        await apiFetch(`/api/crm/oportunidades/${oportunidadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prioridad: closureData.prioridad ?? null,
            valor_estimado: closureData.valorEstimado,
          }),
        });
      } catch (e) {
        console.error("Error al actualizar prioridad/valor:", e);
      }
    }

    setOportunidades(prev => prev.map(o => o.id === oportunidadId ? {
      ...o,
      estado_id: estadoId,
      ultima_nota_log: notas ?? o.ultima_nota_log,
      ...(closureData ? { prioridad: closureData.prioridad ?? null, valor_estimado: closureData.valorEstimado } : {}),
    } : o));

    try {
      await apiFetch(`/api/crm/oportunidades/${oportunidadId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_id: estadoId, notas }),
      });
    } catch (e) {
      console.error(e);
      loadData();
    }
  }

  async function handleEliminarOportunidad(oportunidadId: string) {
    setOportunidades(prev => prev.filter(o => o.id !== oportunidadId));
    try {
      await apiFetch(`/api/crm/oportunidades/${oportunidadId}`, { method: "DELETE" });
    } catch (e) {
      console.error(e);
      loadData();
    }
  }

  async function handleAgenteChange(oportunidadId: string, agenteId: string | null) {
    const agEntry = campana?.crm_campanas_agentes?.find(a => a.agente_id === agenteId);
    const ag = agEntry?.crm_agentes ?? null;
    // Optimistic update inmediato
    setOportunidades(prev => prev.map(o => o.id !== oportunidadId ? o : {
      ...o,
      agente_id: agenteId,
      crm_agentes: ag ? { id: ag.id, nombre: ag.nombre, apellidos: ag.apellidos, avatar_url: ag.avatar_url } : null,
    }));
    try {
      await apiFetch(`/api/crm/oportunidades/${oportunidadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agente_id: agenteId }),
      });
    } catch (e) {
      console.error("Error al cambiar agente:", e);
      loadData();
    }
  }

  async function abrirPresupuestoParaOportunidad(oportunidadId: string) {
    const op = oportunidades.find(o => o.id === oportunidadId);
    const nombre = op?.contabilidad_entidades?.nombre || op?.titulo || oportunidadId;
    try {
      const res = await fetch(`/api/presupuestos?oportunidad_id=${oportunidadId}`);
      const json = await res.json();
      const existente = json?.data?.[0] ?? null;
      setPresupuestoModal({ oportunidadId, campanaId: id, oportunidadNombre: nombre, presupuesto: existente });
    } catch {
      setPresupuestoModal({ oportunidadId, campanaId: id, oportunidadNombre: nombre, presupuesto: null });
    }
  }

  async function handleEstadoChange(oportunidadId: string, estadoId: string) {
    const targetEstado = campana?.crm_campanas_estados?.find(e => e.id === estadoId);
    const isClosureState = targetEstado?.es_final && !targetEstado?.es_ganado;

    if (isClosureState) {
      setPendingClosure({ oportunidadId, estadoId });
      return;
    }

    // Si el estado destino se llama "Visitando", cambiar estado Y abrir modal de presupuesto
    if (targetEstado?.nombre?.toLowerCase() === "visitando") {
      await executeEstadoChange(oportunidadId, estadoId);
      await abrirPresupuestoParaOportunidad(oportunidadId);
      return;
    }

    await executeEstadoChange(oportunidadId, estadoId);
  }


  if (loading) {
    return (
      <div className={styles.container}>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "2rem" }}>Cargando campaña…</p>
      </div>
    );
  }

  if (!campana) {
    return (
      <div className={styles.container}>
        <p style={{ color: "#dc2626", fontSize: "0.85rem", padding: "2rem" }}>Campaña no encontrada.</p>
      </div>
    );
  }

  const estados = campana.crm_campanas_estados ?? [];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => router.push("/campanas")}>
          <ArrowLeft size={14} />
        </button>
        <div className={styles.headerInfo}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 className={styles.title}>{campana.nombre}</h1>
          </div>
          <div className={styles.headerMeta}>
            {campana.fecha_inicio && <span><Calendar size={11} /> {formatFecha(campana.fecha_inicio)}</span>}
            {campana.fecha_fin && <span>→ {formatFecha(campana.fecha_fin)}</span>}
          </div>
        </div>
        <button className={styles.monoSwitch} onClick={() => setMonocromo(v => !v)} title={monocromo ? "Color" : "Monocromo"}>
          {monocromo ? (
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="12" fill="color-mix(in srgb, var(--primary-color, #475569) 20%, white)" stroke="color-mix(in srgb, var(--primary-color, #475569) 40%, white)" strokeWidth="1"/>
              <path d="M13 1 A12 12 0 0 1 13 25 Z" fill="color-mix(in srgb, var(--primary-color, #475569) 60%, white)"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="12" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
              {[{color:"#ef4444",r:0},{color:"#f97316",r:60},{color:"#eab308",r:120},{color:"#22c55e",r:180},{color:"#3b82f6",r:240},{color:"#a855f7",r:300}].map(({color,r},i)=>{
                const s=(r-30)*Math.PI/180,en=(r+30)*Math.PI/180;
                return <path key={i} d={`M13,13 L${(13+12*Math.cos(s)).toFixed(2)},${(13+12*Math.sin(s)).toFixed(2)} A12,12 0 0,1 ${(13+12*Math.cos(en)).toFixed(2)},${(13+12*Math.sin(en)).toFixed(2)} Z`} fill={color}/>;
              })}
              <circle cx="13" cy="13" r="5" fill="white"/>
            </svg>
          )}
        </button>
      </div>

      {/* Listado + KPIs + Gráficos */}
      <TablaOportunidades
        oportunidades={oportunidades}
        estados={estados}
        monocromo={monocromo}
        isOwner={isOwner}
        campanaId={campana.id}

        objetivoTotal={campana.crm_campanas_agentes?.reduce((s, a) => s + (a.objetivo_valor ?? 0), 0) ?? 0}
        agentes={campana.crm_campanas_agentes ?? []}
        onNuevaOportunidad={() => setShowModal(true)}
        onNuevaOportunidadPlaces={() => setShowPlacesNearby(true)}
        onEstadoChange={handleEstadoChange}
        onPresupuestoClick={abrirPresupuestoParaOportunidad}
        onCierreClick={(oportunidadId, estadoId) => setPendingClosure({ oportunidadId, estadoId })}
        onAgenteChange={handleAgenteChange}
        onEliminarOportunidad={handleEliminarOportunidad}
        onEntidadClick={e => setEntidadPanel(e)}
        onOportunidadUpdate={(id, patch) => setOportunidades(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))}
      />

      {showModal && campana && (
        <NuevaOportunidadModal
          campanaId={campana.id}
          estados={estados}
          onClose={() => setShowModal(false)}
          onCreated={loadData}
        />
      )}

      {showPlacesNearby && campana && (
        <ModalPlacesNearby
          campanaId={campana.id}
          estados={estados}
          onClose={() => setShowPlacesNearby(false)}
          onCreated={loadData}
        />
      )}

      {presupuestoModal && (
        <NuevoPresupuestoModal
          oportunidadId={presupuestoModal.oportunidadId}
          oportunidadNombre={presupuestoModal.oportunidadNombre}
          campanaId={presupuestoModal.campanaId}
          presupuesto={presupuestoModal.presupuesto}
          onClose={() => setPresupuestoModal(null)}
          onCreated={() => setPresupuestoModal(null)}
        />
      )}

      {entidadPanel && (
        <PanelEntidad
          data={entidadPanel}
          onClose={() => setEntidadPanel(null)}
          onEntidadUpdated={(entidadActualizada) => {
            setEntidadPanel(p => p ? { ...p, entidad: entidadActualizada } : p);
            setOportunidades(prev => prev.map(o =>
              o.contabilidad_entidades?.id === entidadActualizada.id
                ? { ...o, contabilidad_entidades: entidadActualizada }
                : o
            ));
          }}
        />
      )}

      {pendingClosure && (
        <ModalCierreOportunidad
          onClose={() => setPendingClosure(null)}
          saving={savingClosure}
          oportunidad={(() => {
            const op = oportunidades.find(o => o.id === pendingClosure.oportunidadId);
            return op ? {
              nombre_centro: op.titulo,
              valor_estimado: op.valor_estimado,
              prioridad: op.prioridad,
              destino_interesado: op.descripcion ?? undefined,
              mig_notas: op.mig_notas ?? undefined,
              notas_agente: op.ultima_nota_log ?? undefined,
            } : undefined;
          })()}
          onSave={async (data) => {
            setSavingClosure(true);
            try {
              await executeEstadoChange(pendingClosure.oportunidadId, pendingClosure.estadoId, data);
              await loadData();
            } catch (err) {
              console.error(err);
            } finally {
              setSavingClosure(false);
              setPendingClosure(null);
            }
          }}
        />
      )}

    </div>
  );
}
