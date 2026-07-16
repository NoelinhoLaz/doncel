"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/lib/icons";
import { Phone, Mail, MapPin, Check } from "lucide-react";
import ExpedienteActionsToolbar from "@/app/components/ExpedienteActionsToolbar";
import styles from "../expedientes/[id]/page.module.css";

// --- Tipos -------------------------------------------------------------------

type TipoPresupuesto = "vacacional" | "P2P" | "grupo";
type TipoEntidad = "particular" | "organizacion";

interface Entidad { id: string; nombre: string; email?: string | null; }
interface Destino { id: string; nombre: string; nombre_comercial?: string | null; country?: string | null; }

interface ContactoForm {
  nombre: string; apellidos: string; cargo: string; email: string; telefono: string;
}

// --- Estilos compartidos -----------------------------------------------------

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem",
  fontSize: "0.85rem", border: "1.5px solid #e2e8f0", borderRadius: "0.5rem",
  outline: "none", color: "#1e293b", background: "#fff",
};

const P = "var(--primary-color, #475569)";
const PL = "color-mix(in srgb, var(--primary-color, #475569) 12%, white)";

const btnPrimary: React.CSSProperties = {
  padding: "0.55rem 1.25rem", fontSize: "0.85rem", fontWeight: 600,
  borderRadius: "0.5rem", border: "none", cursor: "pointer",
  background: P, color: "#fff",
};

const btnSecondary: React.CSSProperties = {
  padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 500,
  borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", cursor: "pointer",
  background: "#fff", color: "#64748b",
};

// --- Sub-componentes UI ------------------------------------------------------

function FL({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.3rem" }}>
      {text}{required && <span style={{ color: "#ef4444", marginLeft: "0.2rem" }}>*</span>}
    </label>
  );
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.5rem",
      boxShadow: "0 8px 24px rgba(0,0,0,0.1)", overflow: "hidden", maxHeight: "220px", overflowY: "auto",
    }}>
      {children}
    </div>
  );
}

function DI({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", flexDirection: "column", gap: "0.1rem",
      width: "100%", textAlign: "left", padding: "0.55rem 0.85rem",
      border: "none", background: "none", cursor: "pointer", borderBottom: "1px solid #f8fafc",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "#f8faff")}
      onMouseLeave={e => (e.currentTarget.style.background = "none")}
    >
      {children}
    </button>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <button type="button" onClick={() => onChange(!value)} style={{
        width: "2.4rem", height: "1.3rem", borderRadius: "99px", border: "none", cursor: "pointer",
        background: value ? P : "#e2e8f0", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <span style={{
          position: "absolute", top: "0.15rem", left: value ? "1.15rem" : "0.15rem",
          width: "1rem", height: "1rem", borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
      <span style={{ fontSize: "0.82rem", color: "#475569" }}>{label}</span>
    </div>
  );
}

function MultiChip({ options, selected, onToggle }: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
      {options.map(o => {
        const active = selected.includes(o.value);
        return (
          <button key={o.value} type="button" onClick={() => onToggle(o.value)} style={{
            display: "inline-flex", alignItems: "center", gap: "0.2rem",
            padding: "0.18rem 0.5rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: 600,
            border: active ? `2px solid ${P}` : "1.5px solid #e2e8f0",
            background: active ? PL : "#fff",
            color: active ? P : "#64748b",
            cursor: "pointer", transition: "all 0.12s",
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Counter({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        style={{ width: "1.6rem", height: "1.6rem", borderRadius: "50%", border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        -
      </button>
      <span style={{ minWidth: "1.5rem", textAlign: "center", fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        style={{ width: "1.6rem", height: "1.6rem", borderRadius: "50%", border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        +
      </button>
    </div>
  );
}

function CardBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
      padding: "0.65rem 0.4rem", borderRadius: "0.6rem", cursor: "pointer",
      border: active ? `2px solid ${P}` : "1.5px solid #e2e8f0",
      background: active ? PL : "#fafafa",
      color: active ? P : "#64748b",
      transition: "all 0.12s", fontSize: "0.72rem", fontWeight: active ? 700 : 500,
    }}>
      {children}
    </button>
  );
}

function ChipSelect({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
          padding: "0.3rem 0.75rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600,
          border: value === o.value ? "2px solid var(--primary-color, #475569)" : "1.5px solid #e2e8f0",
          background: value === o.value ? "color-mix(in srgb, var(--primary-color, #475569) 12%, white)" : "#fff",
          color: value === o.value ? "var(--primary-color, #475569)" : "#64748b",
          cursor: "pointer", transition: "all 0.12s",
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- Buscador con autocomplete generico -------------------------------------

function AutocompleteInput({
  placeholder, value, onQueryChange, onSelect, onClear, items, renderItem, getLabel,
}: {
  placeholder: string;
  value: string;
  onQueryChange: (q: string) => void;
  onSelect: (item: any) => void;
  onClear: () => void;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
  getLabel: (item: any) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const selected = !!value;

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Icons.Search size={14} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
        <input
          type="text"
          value={selected ? value : q}
          readOnly={selected}
          onChange={e => { setQ(e.target.value); onQueryChange(e.target.value); setOpen(true); }}
          onFocus={() => { if (!selected) setOpen(true); }}
          style={{ ...inp, paddingLeft: "2rem", paddingRight: selected ? "2rem" : "0.75rem", background: selected ? "#f8faff" : "#fff" }}
          placeholder={placeholder}
        />
        {selected && (
          <button type="button" onClick={() => { onClear(); setQ(""); setOpen(false); }}
            style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
            <Icons.Close size={13} />
          </button>
        )}
      </div>
      {open && !selected && items.length > 0 && (
        <Dropdown>
          {items.map((item, i) => (
            <DI key={i} onClick={() => { onSelect(item); setQ(getLabel(item)); setOpen(false); }}>
              {renderItem(item)}
            </DI>
          ))}
        </Dropdown>
      )}
    </div>
  );
}

function FooterActions({ step, step1Valid, step2Valid, saving, modoEdicion, onBack, onNext, onSubmit, pageMode }: {
  step: number; step1Valid: boolean; step2Valid: boolean; saving: boolean; modoEdicion: boolean;
  onBack: () => void; onNext: () => void; onSubmit: () => void; pageMode?: boolean;
}) {
  const nextDisabled = (step === 1 && !step1Valid) || (step === 2 && !step2Valid);
  if (pageMode) {
    const headerActionsEl = typeof document !== "undefined" ? document.getElementById("presupuesto-header-actions") : null;
    const actions = (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
        <button type="button" onClick={onBack} style={btnSecondary}>Cancelar</button>
        <button type="button" disabled={saving} onClick={onSubmit} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Guardando..." : (modoEdicion ? "Guardar cambios" : "Crear solicitud")}
        </button>
      </div>
    );
    return headerActionsEl ? createPortal(actions, headerActionsEl) : actions;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", background: "#fafafa", borderRadius: "0 0 0.875rem 0.875rem" }}>
      <button type="button" onClick={onBack} style={btnSecondary}>
        {step === 1 ? "Cancelar" : "<- Atras"}
      </button>
      {step < 3 ? (
        <button type="button" disabled={nextDisabled} onClick={onNext} style={{ ...btnPrimary, opacity: nextDisabled ? 0.5 : 1, cursor: nextDisabled ? "not-allowed" : "pointer" }}>
          {"Siguiente ->"}
        </button>
      ) : (
        <button type="button" disabled={saving} onClick={onSubmit} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Guardando..." : (modoEdicion ? "Guardar cambios" : "Crear solicitud")}
        </button>
      )}
    </div>
  );
}

function StepsBar({ steps, step }: { steps: string[]; step: number }) {
  return (
    <div style={{ display: "flex", gap: 0, width: "100%" }}>
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", flex: 1 }}>
              <div style={{
                width: "1.8rem", height: "1.8rem", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.72rem", fontWeight: 700,
                background: done ? "var(--primary-color, #475569)" : active ? "color-mix(in srgb, var(--primary-color, #475569) 12%, white)" : "#f1f5f9",
                color: done ? "#fff" : active ? "var(--primary-color, #475569)" : "#94a3b8",
                border: active ? "2px solid var(--primary-color, #475569)" : "2px solid transparent",
              }}>
                {done ? "v" : n}
              </div>
              <span style={{ fontSize: "0.65rem", fontWeight: active ? 700 : 500, color: active ? "var(--primary-color, #475569)" : "#94a3b8" }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ height: "2px", flex: 1, background: done ? "var(--primary-color, #475569)" : "#e2e8f0", marginBottom: "1rem", marginTop: "0.25rem" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===============================================================================
// MODAL PRINCIPAL
// ===============================================================================

interface Props {
  onClose: () => void;
  onCreated: (p: any) => void;
  presupuesto?: any;
  oportunidadId?: string;
  oportunidadNombre?: string;
  campanaId?: string;
  pageMode?: boolean;
}

const ENFOQUE_OPTS = [
  { value: "cultural",      label: "Cultural",      icon: <Icons.Book size={14} /> },
  { value: "deportivo",     label: "Deportivo",     icon: <Icons.Flag size={14} /> },
  { value: "fin_curso",     label: "Fin de curso",  icon: <Icons.Star size={14} /> },
  { value: "idiomas",       label: "Idiomas",       icon: <Icons.Book size={14} /> },
  { value: "naturaleza",    label: "Naturaleza",    icon: <Icons.Mountain size={14} /> },
  { value: "esqui",         label: "Esqui",         icon: <Icons.Mountain size={14} /> },
  { value: "intercambio",   label: "Intercambio",   icon: <Icons.Viajeros size={14} /> },
];

const REGIMEN_OPTS = [
  { value: "sa", label: "Solo alojamiento" },
  { value: "ad", label: "A+D" },
  { value: "mp", label: "Media pension" },
  { value: "pc", label: "Pension completa" },
];

const HORARIO_VUELO_OPTS = [
  { value: "manana",       label: "Manana" },
  { value: "tarde",        label: "Tarde" },
  { value: "noche",        label: "Noche" },
  { value: "indiferente",  label: "Indiferente" },
];

const UBICACION_OPTS = [
  { value: "centrico",   label: "Centrico" },
  { value: "periferia",  label: "Periferia" },
  { value: "5km",        label: "< 5 km" },
  { value: "10km",       label: "< 10 km" },
  { value: "indistinto", label: "Indistinto" },
];

const CATEGORIA_OPTS = [
  { value: "",   label: "Sin especificar" },
  { value: "1",  label: "1 *" },
  { value: "2",  label: "2 **" },
  { value: "3",  label: "3 ***" },
  { value: "4",  label: "4 ****" },
  { value: "5",  label: "5 *****" },
];

const TIPO_ALOJ_OPTS = [
  { value: "hotel",      label: "Hotel" },
  { value: "hostel",     label: "Hostel" },
  { value: "hostal",     label: "Hostal" },
  { value: "albergue",   label: "Albergue" },
  { value: "residencia", label: "Residencia" },
  { value: "camping",    label: "Camping" },
  { value: "indiferente",label: "Indiferente" },
  { value: "otros",      label: "Otros" },
];

const VISITAS_PLACEHOLDER: Record<string, string> = {
  cultural:   "Ej: Entradas al Coliseo y Vaticano con guia oficial...",
  deportivo:  "Ej: Reserva de pabellon 10:00-12:00, partido contra equipo local...",
  fin_curso:  "Ej: Parque tematico, tarde libre en el casco historico...",
  idiomas:    "Ej: Actividades integradas con alumnos nativos, excursion el sabado...",
  naturaleza: "Ej: Senderismo guiado, kayak, visita cueva...",
  esqui:      "Ej: 4 dias de forfait, 2h diarias de clases, alquiler de material...",
  "":         "Ej: Visitas y actividades deseadas en el destino...",
};

const emptyContacto = (): ContactoForm => ({ nombre: "", apellidos: "", cargo: "", email: "", telefono: "" });

export default function NuevoPresupuestoModal({ onClose, onCreated, presupuesto, oportunidadId: oportunidadIdProp, oportunidadNombre: oportunidadNombreProp, campanaId: campanaIdProp, pageMode }: Props) {
  const modoEdicion = !!presupuesto;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- PASO 1: Prospecto ------------------------------------------------------
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [entidadQuery, setEntidadQuery] = useState("");
  const [entidadId, setEntidadId] = useState<string | null>(null);
  const [entidadNombre, setEntidadNombre] = useState("");
  const [entidadDetalle, setEntidadDetalle] = useState<any>(null);
  const [responsableId, setResponsableId] = useState<string | null>(null);
  const [nuevoResponsable, setNuevoResponsable] = useState(false);
  const [nuevoResp, setNuevoResp] = useState<ContactoForm>(emptyContacto());
  const [savingResp, setSavingResp] = useState(false);
  const [crearEntidad, setCrearEntidad] = useState(false);
  const [tipoEntidad, setTipoEntidad] = useState<TipoEntidad>("organizacion");
  const [nuevaEntidadNombre, setNuevaEntidadNombre] = useState("");
  const [emailsOrg, setEmailsOrg] = useState<string[]>([""]);
  const [contactos, setContactos] = useState<ContactoForm[]>([emptyContacto()]);

  // -- PASO 2: Viaje ----------------------------------------------------------
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [destinoQuery, setDestinoQuery] = useState("");
  const [destinosSelected, setDestinosSelected] = useState<Destino[]>([]);
  const [placesResults, setPlacesResults] = useState<any[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [savingDestino, setSavingDestino] = useState(false);
  const placesRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [titulo, setTitulo] = useState("");
  const [tipoPres, setTipoPres] = useState<TipoPresupuesto | "">("");
  const [plazas, setPlazas] = useState("1");

  // -- Vinculacion CRM --------------------------------------------------------
  const origenBloqueado = !!(oportunidadIdProp || campanaIdProp);
  const [campanaId, setCampanaId] = useState<string>(campanaIdProp ?? presupuesto?.campana_id ?? "");
  const [oportunidadId, setOportunidadId] = useState<string>(oportunidadIdProp ?? presupuesto?.oportunidad_id ?? "");
  const [campanas, setCampanas] = useState<any[]>([]);
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [oportunidadQuery, setOportunidadQuery] = useState("");
  const [oportunidadNombre, setOportunidadNombre] = useState(presupuesto?.oportunidad_titulo ?? oportunidadNombreProp ?? "");
  const [prospectoEnCampana, setProspectoEnCampana] = useState<boolean | null>(null); // null=sin buscar, true=encontrado, false=no encontrado
  const [buscandoEnCampana, setBuscandoEnCampana] = useState(false);
  const [fechaSalida, setFechaSalida] = useState("");
  const [margenSalida, setMargenSalida] = useState("0");
  const [fechaRegreso, setFechaRegreso] = useState("");
  const [margenRegreso, setMargenRegreso] = useState("0");
  const [noches, setNoches] = useState("");
  const [pvp, setPvp] = useState("");
  const [notasIniciales, setNotasIniciales] = useState("");

  // -- PASO 3: Preferencias ---------------------------------------------------
  const [enfoques, setEnfoques] = useState<string[]>([]);
  const [tipoAloj, setTipoAloj] = useState<string[]>(["hotel"]);
  const [tipoAlojOtros, setTipoAlojOtros] = useState("");
  const [categoria, setCategoria] = useState<string[]>(["3"]);
  const [ubicacion, setUbicacion] = useState("centro");
  const [prefHab, setPrefHab] = useState<string[]>([]);
  const [vuelo, setVuelo] = useState(false);
  const [tipoAerolinea, setTipoAerolinea] = useState("indiferente");
  const [horarioVuelo, setHorarioVuelo] = useState("indiferente");
  const [tren, setTren] = useState(false);
  const [autocar, setAutocar] = useState(false);
  const [trasladosInt, setTrasladosInt] = useState(false);
  const [conoceDestino, setConoceDestino] = useState(false);
  const [aconsejamosDestino, setAconsejamosDestino] = useState(false);
  const [viajaronAnoPasado, setViajaronAnoPasado] = useState(false);
  const [viajeAnterior, setViajeAnterior] = useState({ destino: "", fechas: "", agencia: "", excursiones: "", valoracion: "" });
  const [regimen, setRegimen] = useState<string[]>(["mp"]);
  const [monitores, setMonitores] = useState(false);
  const [visitas, setVisitas] = useState("");

  // Carga inicial destinos
  useEffect(() => {
    fetch("/api/destinos").then(r => r.json()).then(j => {
      if (j?.success) {
        const todos: Destino[] = j.data || [];
        setDestinos(todos);
        if (presupuesto?.destino_ids?.length) {
          setDestinosSelected(todos.filter((d: Destino) => presupuesto.destino_ids.includes(d.id)));
        }
      }
    }).catch(() => {});
    fetch("/api/entidades").then(r => r.json()).then(j => { if (j?.success) setEntidades(j.data || []); }).catch(() => {});
    if (!origenBloqueado) {
      fetch("/api/campanas").then(r => r.json()).then(j => { if (j?.success) setCampanas(j.data || []); }).catch(() => {});
    }
  }, []);

  // Precarga entidad desde oportunidad cuando se abre desde campana (sin presupuesto existente)
  useEffect(() => {
    if (!oportunidadIdProp || presupuesto) return;
    fetch(`/api/oportunidades/detalle?id=${oportunidadIdProp}`)
      .then(r => r.json())
      .then(j => {
        const op = j?.data;
        if (!op?.entidad_id) return;
        setEntidadId(op.entidad_id);
        setEntidadNombre(op.entidad_nombre || "");
        fetch(`/api/entidades?id=${op.entidad_id}`)
          .then(r => r.json())
          .then(j2 => {
            if (j2?.success) {
              setEntidadDetalle(j2.data);
              // Preseleccionar el contacto principal si existe
              const principal = j2.data.contactos?.find((c: any) => c.es_principal) ?? j2.data.contactos?.[0];
              if (principal) setResponsableId(principal.id);
            }
          }).catch(() => {});
      }).catch(() => {});
  }, [oportunidadIdProp]);

  // Precarga en modo edicion
  useEffect(() => {
    if (!presupuesto) return;
    const p = presupuesto;
    // Paso 1
    if (p.entidad_id) {
      setEntidadId(p.entidad_id);
      setEntidadNombre(p.cliente_nombre || "");
      fetch(`/api/entidades?id=${p.entidad_id}`).then(r => r.json()).then(j => {
        if (j?.success) {
          setEntidadDetalle(j.data);
          const cp = p.contacto_principal;
          if (cp) {
            // Intentar por crm_contacto_id directo
            if (cp.crm_contacto_id) {
              setResponsableId(cp.crm_contacto_id);
            } else {
              // Fallback: buscar por nombre en la lista de contactos CRM
              const match = j.data.contactos?.find((c: any) =>
                c.nombre === cp.nombre && (cp.email ? c.email === cp.email : true)
              );
              if (match) setResponsableId(match.id);
            }
          }
        }
      }).catch(() => {});
    }
    // Paso 2
    setTitulo(p.titulo_viaje || "");
    setTipoPres(p.tipo_presupuesto || "");
    setPlazas(String(p.plazas_estimadas || 1));
    setFechaSalida(p.fecha_salida_estimada?.slice(0, 10) || "");
    setMargenSalida(p.margen_salida_dias ? String(p.margen_salida_dias) : "0");
    setFechaRegreso(p.fecha_regreso_estimada?.slice(0, 10) || "");
    setMargenRegreso(p.margen_regreso_dias ? String(p.margen_regreso_dias) : "0");
    setNoches(p.noches_estimadas ? String(p.noches_estimadas) : "");
    setPvp(p.pvp_estimado ? String(p.pvp_estimado) : "");
    setNotasIniciales(p.notas_iniciales || "");
    // Paso 3
    const pref = p.preferencias ?? {};
    const ef = pref.enfoque_viaje;
    setEnfoques(Array.isArray(ef) ? ef : ef ? [ef] : []);
    const aloj = pref.alojamiento ?? {};
    const ta = aloj.tipo;
    setTipoAloj(Array.isArray(ta) ? ta : ta ? [ta] : ["hotel"]);
    setTipoAlojOtros(aloj.tipo_otros || "");
    const cat = aloj.categoria_minima;
    setCategoria(Array.isArray(cat) ? cat : cat ? [cat] : ["3"]);
    setUbicacion(aloj.ubicacion || "centro");
    const ph = aloj.preferencia_habitaciones;
    setPrefHab(Array.isArray(ph) ? ph : ph ? [ph] : []);
    const transp = pref.transporte ?? {};
    setVuelo(transp.requiere_vuelo || false);
    setTipoAerolinea(transp.tipo_aerolinea || "indiferente");
    setHorarioVuelo(transp.preferencia_horario_vuelos || "indiferente");
    setTren(transp.requiere_tren || false);
    setAutocar(transp.requiere_autocar_origen || false);
    setTrasladosInt(transp.requiere_traslados_destino || false);
    const prog = pref.programa_destino ?? {};
    setConoceDestino(prog.conoce_destino || false);
    setAconsejamosDestino(pref.aconsejamos_destino || false);
    setViajaronAnoPasado(pref.viajaron_ano_pasado || false);
    setViajeAnterior(pref.viaje_anterior || { destino: "", fechas: "", agencia: "", excursiones: "", valoracion: "" });
    const reg = prog.regimen_comidas;
    setRegimen(Array.isArray(reg) ? reg : reg ? [reg] : ["mp"]);
    setMonitores(prog.requiere_monitores_24h || false);
    setVisitas(prog.visitas_imprescindibles || "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar oportunidades cuando cambia la campana seleccionada
  useEffect(() => {
    if (!campanaId || origenBloqueado) return;
    const q = oportunidadQuery.trim();
    const url = q.length >= 2
      ? `/api/oportunidades?campana_id=${campanaId}&q=${encodeURIComponent(q)}`
      : `/api/oportunidades?campana_id=${campanaId}`;
    fetch(url).then(r => r.json()).then(j => { if (j?.success) setOportunidades(j.data || []); }).catch(() => {});
  }, [campanaId, oportunidadQuery]);

  // Busqueda de entidades en servidor con debounce (minimo 3 caracteres)
  useEffect(() => {
    const q = entidadQuery.trim();
    if (q.length > 0 && q.length < 3) return;
    const timer = setTimeout(() => {
      const url = q ? `/api/entidades?q=${encodeURIComponent(q)}` : "/api/entidades";
      fetch(url).then(r => r.json()).then(j => { if (j?.success) setEntidades(j.data || []); }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [entidadQuery]);

  const filteredEntidades = entidades.slice(0, 15);

  const filteredDestinosRaw = destinos.filter(d => {
    if (!destinoQuery) return true;
    const q = destinoQuery.toLowerCase();
    return [d.nombre_comercial, d.nombre, (d as any).locality]
      .some(v => v && v.toLowerCase().includes(q));
  }).filter(d => !destinosSelected.some(s => s.id === d.id)).slice(0, 8);

  // Google Places: buscar solo si no hay resultados en BD y query >= 3 chars
  useEffect(() => {
    const q = destinoQuery.trim();
    if (q.length < 3 || filteredDestinosRaw.length > 0) {
      setPlacesResults([]);
      return;
    }
    if (placesRef.current) clearTimeout(placesRef.current);
    placesRef.current = setTimeout(async () => {
      setSearchingPlaces(true);
      try {
        const { searchPlaces } = await import("@/actions/places");
        const data = await searchPlaces(q);
        setPlacesResults(data);
      } catch { setPlacesResults([]); }
      finally { setSearchingPlaces(false); }
    }, 400);
    return () => { if (placesRef.current) clearTimeout(placesRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinoQuery]);

  const filteredDestinos = filteredDestinosRaw;

  const minPlazas = tipoPres === "grupo" ? 10 : 1;

  // Validaciones por paso
  const step1Valid = !!(entidadId || (crearEntidad && nuevaEntidadNombre.trim()));
  const step2Valid = !!(titulo.trim() && tipoPres && parseInt(plazas) >= minPlazas);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const nuevaEntidad = crearEntidad && !entidadId ? {
        nombre: nuevaEntidadNombre.trim(),
        tipo: tipoEntidad,
        emails_organizacion: tipoEntidad === "organizacion" ? emailsOrg.filter(Boolean) : [],
        contactos: contactos.filter(c => c.nombre.trim()).map((c, i) => ({ ...c, es_principal: i === 0 })),
      } : null;

      const preferencias = {
        enfoque_viaje: enfoques.length > 0 ? enfoques : null,
        aconsejamos_destino: aconsejamosDestino,
        viajaron_ano_pasado: viajaronAnoPasado,
        viaje_anterior: viajaronAnoPasado ? viajeAnterior : null,
        alojamiento: {
          tipo: tipoAloj,
          tipo_otros: tipoAloj.includes("otros") ? (tipoAlojOtros.trim() || null) : null,
          categoria_minima: categoria,
          ubicacion,
          preferencia_habitaciones: prefHab.length > 0 ? prefHab : null,
        },
        transporte: {
          requiere_vuelo: vuelo,
          tipo_aerolinea: vuelo ? tipoAerolinea : null,
          preferencia_horario_vuelos: vuelo ? horarioVuelo : null,
          requiere_tren: tren,
          requiere_autocar_origen: autocar,
          requiere_traslados_destino: trasladosInt,
        },
        programa_destino: {
          conoce_destino: conoceDestino,
          regimen_comidas: regimen.length > 0 ? regimen : null,
          requiere_monitores_24h: monitores,
          visitas_imprescindibles: visitas.trim() || null,
        },
      };

      const payload = {
        entidad_id: entidadId,
        responsable_contacto_id: responsableId || null,
        nueva_entidad: nuevaEntidad,
        oportunidad_id: oportunidadId || null,
        campana_id: campanaId || null,
        titulo_viaje: titulo.trim(),
        tipo_presupuesto: tipoPres,
        plazas_estimadas: parseInt(plazas),
        destino_ids: destinosSelected.map(d => d.id),
        fecha_salida_estimada: fechaSalida || null,
        margen_salida_dias: margenSalida !== "0" ? parseInt(margenSalida) : null,
        fecha_regreso_estimada: fechaRegreso || null,
        margen_regreso_dias: margenRegreso !== "0" ? parseInt(margenRegreso) : null,
        noches_estimadas: noches ? parseInt(noches) : null,
        pvp_estimado: pvp ? parseFloat(pvp) : null,
        notas_iniciales: notasIniciales.trim() || null,
        preferencias,
      };
      const res = await fetch(
        modoEdicion ? `/api/presupuestos/${presupuesto.id}` : "/api/presupuestos",
        { method: modoEdicion ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );

      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Error al guardar");
      const responsable = entidadDetalle?.contactos?.find((c: any) => c.id === responsableId) ?? entidadDetalle?.contactos?.[0] ?? null;
      onCreated({
        ...j.data,
        cliente_nombre: entidadNombre || null,
        contacto_principal: responsable ? {
          nombre: responsable.nombre,
          apellidos: responsable.apellidos ?? null,
          cargo: responsable.cargo ?? null,
          email: responsable.email ?? null,
          telefono: responsable.telefono ?? null,
        } : null,
      });
    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  // --- Render ---------------------------------------------------------------

  const STEPS = ["Prospecto", "Viaje", "Preferencias"];

  function renderContent() {
    return (
    <div style={{
      background: pageMode ? "transparent" : "#fff",
      borderRadius: pageMode ? "0" : "0.875rem",
      width: "100%",
      maxWidth: pageMode ? "none" : "620px",
      boxShadow: pageMode ? "none" : "0 20px 48px -8px rgba(0,0,0,0.25)",
      display: "flex", flexDirection: "column",
      maxHeight: pageMode ? "none" : "92vh",
      overflow: pageMode ? "visible" : "hidden",
    }}>

        {/* Header */}
        {!pageMode && <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Icons.Presupuestos size={18} style={{ color: "var(--primary-color, #475569)" }} />
              <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>{modoEdicion ? "Editar presupuesto" : "Nuevo presupuesto"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              {modoEdicion && presupuesto?.id && (
                <ExpedienteActionsToolbar cotizacionId={presupuesto.id} />
              )}
              <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: "0.2rem" }}>
                <Icons.Close size={18} />
              </button>
            </div>
          </div>
          {/* Steps */}
          <StepsBar steps={STEPS} step={step} />
        </div>}

        {/* Body */}
        <div
          className={pageMode ? styles.formColumnsGrid : undefined}
          style={pageMode ? undefined : { overflowY: "auto", flex: 1, padding: "1.5rem", paddingBottom: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >

          {/* PASO 1 */}
          {(pageMode || step === 1) && (
            <div style={pageMode ? { display: "flex", flexDirection: "column", gap: "1.25rem", background: "#fff", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" } : {}}>
            {pageMode && <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>1. Prospecto</div>}
            <>
              {/* 1A - Selector de campa-a */}
              {!origenBloqueado && (
                <div>
                  <FL text="Campana" />
                  <select value={campanaId} onChange={e => {
                    setCampanaId(e.target.value);
                    setOportunidadId(""); setOportunidadNombre("");
                    setOportunidades([]); setProspectoEnCampana(null);
                    setEntidadId(null); setEntidadNombre(""); setEntidadDetalle(null); setResponsableId(null);
                    setCrearEntidad(false);
                  }} style={inp}>
                    <option value="">- Sin campana -</option>
                    {campanas.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              {origenBloqueado && (
                <div style={{ background: "color-mix(in srgb, var(--primary-color, #475569) 8%, white)", border: "1.5px solid color-mix(in srgb, var(--primary-color, #475569) 30%, white)", borderRadius: "0.6rem", padding: "0.65rem 1rem", display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <Icons.Flag size={14} style={{ color: "var(--primary-color, #475569)", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase" }}>Vinculado a oportunidad CRM</div>
                    <div style={{ fontSize: "0.82rem", color: "#1e293b", fontWeight: 600 }}>{oportunidadNombre || oportunidadIdProp}</div>
                  </div>
                </div>
              )}

              {/* 1B - Buscar prospecto (solo si no viene vinculado a oportunidad) */}
              {origenBloqueado && !entidadId && (
                <div style={{ textAlign: "center", padding: "1rem", color: "#94a3b8", fontSize: "0.8rem" }}>
                  Cargando datos del prospecto...
                </div>
              )}
              {!origenBloqueado && !crearEntidad && (
                <>
                  <div>
                    <FL text={campanaId ? "Buscar prospecto en la campana" : "Buscar cliente / entidad"} required />
                    {campanaId ? (
                      // Buscar dentro de la campana (oportunidades)
                      <AutocompleteInput
                        placeholder="Nombre del colegio, empresa o cliente..."
                        value={entidadNombre}
                        onQueryChange={q => {
                          setOportunidadQuery(q);
                          setProspectoEnCampana(null);
                          if (q.length >= 2) {
                            setBuscandoEnCampana(true);
                            fetch(`/api/oportunidades?campana_id=${campanaId}&q=${encodeURIComponent(q)}`)
                              .then(r => r.json())
                              .then(j => {
                                const ops = j?.data ?? [];
                                setOportunidades(ops);
                                setProspectoEnCampana(ops.length > 0);
                                setBuscandoEnCampana(false);
                              }).catch(() => setBuscandoEnCampana(false));
                          } else {
                            setOportunidades([]); setBuscandoEnCampana(false);
                          }
                        }}
                        onSelect={(o: any) => {
                          setOportunidadId(o.id);
                          setOportunidadNombre(o.titulo);
                          setEntidadId(o.entidad_id);
                          setEntidadNombre(o.entidad_nombre || "");
                          setProspectoEnCampana(true);
                          if (o.entidad_id) {
                            fetch(`/api/entidades?id=${o.entidad_id}`)
                              .then(r => r.json())
                              .then(j => { if (j?.success) setEntidadDetalle(j.data); })
                              .catch(() => {});
                          }
                        }}
                        onClear={() => {
                          setEntidadId(null); setEntidadNombre(""); setEntidadDetalle(null);
                          setResponsableId(null); setOportunidadId(""); setOportunidadNombre("");
                          setOportunidades([]); setProspectoEnCampana(null);
                        }}
                        items={oportunidades}
                        getLabel={(o: any) => o.entidad_nombre || o.titulo}
                        renderItem={(o: any) => (
                          <>
                            <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{o.entidad_nombre || o.titulo}</span>
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{o.titulo}</span>
                              {o.estado_nombre && <span style={{ fontSize: "0.63rem", fontWeight: 700, color: "#fff", background: o.estado_color || "var(--primary-color, #475569)", borderRadius: "99px", padding: "0.05rem 0.4rem" }}>{o.estado_nombre}</span>}
                            </div>
                          </>
                        )}
                      />
                    ) : (
                      // Buscar en todas las entidades
                      <AutocompleteInput
                        placeholder="Nombre del colegio, empresa o cliente..."
                        value={entidadNombre}
                        onQueryChange={setEntidadQuery}
                        onSelect={e => {
                          setEntidadId(e.id); setEntidadNombre(e.nombre); setEntidadDetalle(null);
                          fetch(`/api/entidades?id=${e.id}`).then(r => r.json()).then(j => { if (j?.success) setEntidadDetalle(j.data); }).catch(() => {});
                        }}
                        onClear={() => { setEntidadId(null); setEntidadNombre(""); setEntidadQuery(""); setEntidadDetalle(null); setResponsableId(null); }}
                        items={filteredEntidades}
                        getLabel={e => e.nombre}
                        renderItem={e => {
                          const r = e.roles ?? {};
                          const tipo = r.prospecto ? "Prospecto" : r.organizacion ? "Organizacion" : r.cliente ? "Cliente" : r.viajero ? "Viajero" : null;
                          return (
                            <>
                              <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{e.nombre}</span>
                              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                {tipo && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--primary-color, #475569)", background: "color-mix(in srgb, var(--primary-color, #475569) 12%, white)", borderRadius: "99px", padding: "0.1rem 0.4rem" }}>{tipo}</span>}
                                {e.email && <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{e.email}</span>}
                              </div>
                            </>
                          );
                        }}
                      />
                    )}
                  </div>

                  {/* Aviso: no encontrado en campa-a -> buscar en entidades */}
                  {campanaId && prospectoEnCampana === false && !entidadId && (
                    <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "0.6rem", padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#92400e" }}>
                        ! No encontrado en esta campana
                      </div>
                      <div style={{ fontSize: "0.73rem", color: "#78350f" }}>
                        El prospecto no tiene oportunidades en esta campana. Puedes buscarlo en todas las entidades o crear uno nuevo.
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => { setProspectoEnCampana(null); setCampanaId(""); }}
                          style={{ ...btnSecondary, fontSize: "0.73rem", padding: "0.3rem 0.65rem" }}>
                          Buscar en todas las entidades
                        </button>
                        <button type="button" onClick={() => { setCrearEntidad(true); setProspectoEnCampana(null); }}
                          style={{ ...btnSecondary, fontSize: "0.73rem", padding: "0.3rem 0.65rem", color: "var(--primary-color, #475569)", borderColor: "var(--primary-color, #475569)" }}>
                          + Crear nuevo prospecto
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Ficha del prospecto seleccionado */}
              {entidadId && entidadDetalle && (() => {
                const d = entidadDetalle;
                const dir = d.direccion ?? {};
                const dirTexto = [dir.calle, dir.ciudad, dir.provincia, dir.pais].filter(Boolean).join(", ");
                const tipoCentro = d.metadatos?.tipo_centro;
                const roles = d.roles ?? {};
                const tipoLabel = roles.prospecto ? "Prospecto" : roles.organizacion ? "Organizacion" : roles.cliente ? "Cliente" : null;

                return (
                  <div style={{ border: "1.5px solid color-mix(in srgb, var(--primary-color, #475569) 30%, white)", borderRadius: "0.65rem", overflow: "hidden" }}>

                    {/* -- Cabecera entidad -- */}
                    <div style={{ background: "linear-gradient(135deg,color-mix(in srgb, var(--primary-color, #475569) 12%, white),color-mix(in srgb, var(--primary-color, #475569) 8%, white))", padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#1e293b" }}>{d.nombre}</span>
                          {tipoLabel && (
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--primary-color, #475569)", background: "#fff", borderRadius: "99px", padding: "0.1rem 0.5rem" }}>{tipoLabel}</span>
                          )}
                          {tipoCentro && tipoCentro !== "" && (
                            <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#475569", background: "#e2e8f0", borderRadius: "99px", padding: "0.1rem 0.5rem", textTransform: "capitalize" }}>{tipoCentro}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "0.4rem" }}>
                          {d.telefono && <span style={{ fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.25rem" }}><Phone size={12} />{d.telefono}</span>}
                          {d.email    && <span style={{ fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.25rem" }}><Mail size={12} />{d.email}</span>}
                          {d.documento && <span style={{ fontSize: "0.75rem", color: "#64748b" }}>NIF {d.documento}</span>}
                        </div>
                        {dirTexto && (
                          <div style={{ fontSize: "0.73rem", color: "#64748b", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}><MapPin size={12} />{dirTexto}</div>
                        )}
                      </div>
                      <button type="button"
                        onClick={() => { setEntidadId(null); setEntidadNombre(""); setEntidadQuery(""); setEntidadDetalle(null); setResponsableId(null); }}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: "0.1rem", flexShrink: 0 }}>
                        <Icons.Close size={14} />
                      </button>
                    </div>

                    {/* -- Responsables -- */}
                    <div style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                        Responsable del viaje
                      </div>
                      {d.contactos?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "220px", overflowY: "auto" }}>
                          {d.contactos.map((c: any) => {
                            const selected = responsableId === c.id;
                            return (
                              <button key={c.id} type="button" onClick={() => setResponsableId(selected ? null : c.id)}
                                style={{
                                  display: "flex", alignItems: "flex-start", gap: "0.65rem",
                                  padding: "0.6rem 0.75rem", borderRadius: "0.5rem", cursor: "pointer", textAlign: "left",
                                  border: selected ? "2px solid var(--primary-color, #475569)" : "1.5px solid #e2e8f0",
                                  background: selected ? "color-mix(in srgb, var(--primary-color, #475569) 12%, white)" : "#fff",
                                  transition: "all 0.12s",
                                }}>
                                <div style={{
                                  width: "2rem", height: "2rem", borderRadius: "50%", flexShrink: 0,
                                  background: selected ? "var(--primary-color, #475569)" : c.es_principal ? "var(--primary-color, #475569)" : "#e2e8f0",
                                  color: selected || c.es_principal ? "#fff" : "#64748b",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "0.72rem", fontWeight: 700,
                                }}>
                                  {c.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>{c.nombre}</span>
                                    {c.es_principal && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--primary-color, #475569)", background: "color-mix(in srgb, var(--primary-color, #475569) 12%, white)", borderRadius: "99px", padding: "0.05rem 0.4rem" }}>Principal</span>}
                                    {selected && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#16a34a", background: "#dcfce7", borderRadius: "99px", padding: "0.05rem 0.4rem", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}><Check size={10} />Seleccionado</span>}
                                  </div>
                                  {c.cargo && <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{c.cargo}</div>}
                                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.1rem", flexWrap: "wrap" }}>
                                    {c.email    && <span style={{ fontSize: "0.7rem", color: "#475569", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}><Mail size={11} />{c.email}</span>}
                                    {c.telefono && <span style={{ fontSize: "0.7rem", color: "#475569", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}><Phone size={11} />{c.telefono}</span>}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic", marginBottom: "0.5rem" }}>
                          Sin responsables registrados en CRM
                        </div>
                      )}

                      <button type="button" onClick={() => setNuevoResponsable(true)}
                        style={{ ...btnSecondary, fontSize: "0.75rem", marginTop: "0.5rem", padding: "0.3rem 0.7rem", alignSelf: "flex-start" }}>
                        + Anadir responsable
                      </button>
                    </div>
                  </div>
                );
              })()}

              {!entidadId && !origenBloqueado && (
                <button type="button" onClick={() => setCrearEntidad(v => !v)} style={{
                  ...btnSecondary, fontSize: "0.8rem", alignSelf: "flex-start",
                  background: crearEntidad ? "color-mix(in srgb, var(--primary-color, #475569) 12%, white)" : "#fff",
                  color: crearEntidad ? "var(--primary-color, #475569)" : "#64748b",
                  borderColor: crearEntidad ? "var(--primary-color, #475569)" : "#e2e8f0",
                }}>
                  {crearEntidad ? "<- Buscar existente" : "+ No existe, crear nuevo"}
                </button>
              )}

              {crearEntidad && !entidadId && !origenBloqueado && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "#fafbff", border: "1.5px solid #e0e7ff", borderRadius: "0.6rem", padding: "1rem" }}>

                  {/* Tipo entidad */}
                  <div>
                    <FL text="Tipo de cliente" required />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      {[{ v: "particular" as TipoEntidad, l: "Particular" }, { v: "organizacion" as TipoEntidad, l: "Organizacion" }].map(o => (
                        <CardBtn key={o.v} active={tipoEntidad === o.v} onClick={() => setTipoEntidad(o.v)}>
                          {o.l}
                        </CardBtn>
                      ))}
                    </div>
                  </div>

                  {/* Nombre */}
                  <div>
                    <FL text="Nombre" required />
                    <input value={nuevaEntidadNombre} onChange={e => setNuevaEntidadNombre(e.target.value)} style={inp}
                      placeholder={tipoEntidad === "organizacion" ? "Colegio San Viator" : "Juan Garcia Lopez"} />
                  </div>

                  {/* Emails organizaci-n */}
                  {tipoEntidad === "organizacion" && (
                    <div>
                      <FL text="Emails de la organizacion" />
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {emailsOrg.map((em, i) => (
                          <div key={i} style={{ display: "flex", gap: "0.4rem" }}>
                            <input value={em} onChange={e => setEmailsOrg(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                              style={{ ...inp, flex: 1 }} placeholder={i === 0 ? "secretaria@colegio.com" : "direccion@colegio.com"} type="email" />
                            {emailsOrg.length > 1 && (
                              <button type="button" onClick={() => setEmailsOrg(prev => prev.filter((_, j) => j !== i))}
                                style={{ border: "1.5px solid #fca5a5", background: "#fff", borderRadius: "0.4rem", cursor: "pointer", color: "#dc2626", padding: "0 0.5rem" }}>
                                <Icons.Close size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setEmailsOrg(prev => [...prev, ""])}
                          style={{ ...btnSecondary, fontSize: "0.75rem", alignSelf: "flex-start", padding: "0.3rem 0.7rem" }}>
                          + Anadir email
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Contactos */}
                  <div>
                    <FL text={tipoEntidad === "organizacion" ? "Contactos responsables" : "Datos de contacto"} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {contactos.map((c, i) => (
                        <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {i > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>Contacto {i + 1}</span>
                              <button type="button" onClick={() => setContactos(prev => prev.filter((_, j) => j !== i))}
                                style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}>
                                <Icons.Close size={13} />
                              </button>
                            </div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                            <div><FL text="Nombre" required /><input value={c.nombre} onChange={e => setContactos(p => p.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} style={inp} placeholder="Carlos" /></div>
                            <div><FL text="Apellidos" /><input value={c.apellidos} onChange={e => setContactos(p => p.map((x, j) => j === i ? { ...x, apellidos: e.target.value } : x))} style={inp} placeholder="Garcia Lopez" /></div>
                          </div>
                          <div><FL text="Cargo" /><input value={c.cargo} onChange={e => setContactos(p => p.map((x, j) => j === i ? { ...x, cargo: e.target.value } : x))} style={inp} placeholder="Profesor organizador 4o ESO" /></div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                            <div><FL text="Email" /><input value={c.email} onChange={e => setContactos(p => p.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} style={inp} placeholder="carlos@colegio.com" type="email" /></div>
                            <div><FL text="Telefono" /><input value={c.telefono} onChange={e => setContactos(p => p.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x))} style={inp} placeholder="600 112 233" /></div>
                          </div>
                        </div>
                      ))}
                      {tipoEntidad === "organizacion" && (
                        <button type="button" onClick={() => setContactos(prev => [...prev, emptyContacto()])}
                          style={{ ...btnSecondary, fontSize: "0.75rem", alignSelf: "flex-start", padding: "0.3rem 0.7rem" }}>
                          + Anadir otro contacto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Vinculaci-n CRM - bloque legacy eliminado; ahora gestionado arriba en 1A */}
              {false && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", background: "#fafbff", border: "1px solid #e0e7ff", borderRadius: "0.6rem", padding: "0.9rem 1rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Vinculacion CRM <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></div>
                  <div>
                    <FL text="Campana" />
                    <select value={campanaId} onChange={e => { setCampanaId(e.target.value); setOportunidadId(""); setOportunidadNombre(""); setOportunidades([]); }} style={inp}>
                      <option value="">- Sin campana -</option>
                      {campanas.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  {campanaId && (
                    <div>
                      <FL text="Oportunidad" />
                      {oportunidadId ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "color-mix(in srgb, var(--primary-color, #475569) 12%, white)", border: "1.5px solid color-mix(in srgb, var(--primary-color, #475569) 30%, white)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem" }}>
                          <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>{oportunidadNombre}</span>
                          <button type="button" onClick={() => { setOportunidadId(""); setOportunidadNombre(""); }}
                            style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
                            <Icons.Close size={13} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ position: "relative" }}>
                          <Icons.Search size={13} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                          <input
                            value={oportunidadQuery}
                            onChange={e => setOportunidadQuery(e.target.value)}
                            style={{ ...inp, paddingLeft: "2rem" }}
                            placeholder="Buscar oportunidad..."
                          />
                          {oportunidades.length > 0 && (
                            <div style={{ position: "absolute", zIndex: 50, top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.5rem", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                              {oportunidades.slice(0, 6).map((o: any) => (
                                <DI key={o.id} onClick={() => { setOportunidadId(o.id); setOportunidadNombre(o.titulo); setOportunidadQuery(""); }}>
                                  <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{o.titulo}</span>
                                  {o.estado_nombre && <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{o.estado_nombre}</span>}
                                </DI>
                              ))}
                              <div style={{ borderTop: "1px solid #f1f5f9", padding: "0.45rem 0.75rem" }}>
                                <button type="button"
                                  onClick={() => { setOportunidadId("__nueva__"); setOportunidadNombre("Nueva oportunidad"); }}
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary-color, #475569)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                  <Icons.Add size={13} /> Crear nueva oportunidad
                                </button>
                              </div>
                            </div>
                          )}
                          {campanaId && oportunidades.length === 0 && !oportunidadQuery && (
                            <button type="button"
                              onClick={() => { setOportunidadId("__nueva__"); setOportunidadNombre("Nueva oportunidad"); }}
                              style={{ marginTop: "0.35rem", border: "none", background: "none", cursor: "pointer", color: "var(--primary-color, #475569)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <Icons.Add size={13} /> Crear nueva oportunidad
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
            </div>
          )}

          {/* PASO 2 */}
          {(pageMode || step === 2) && (
            <div style={pageMode ? { display: "flex", flexDirection: "column", gap: "1.25rem", background: "#fff", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" } : {}}>
            {pageMode && <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>2. Viaje</div>}
            <>
              {/* Tipo de presupuesto */}
              <div>
                <FL text="Tipo de presupuesto" required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { v: "vacacional" as TipoPresupuesto, l: "Vacacional", d: "A medida / paquete", icon: <Icons.Plane size={16} /> },
                    { v: "P2P"       as TipoPresupuesto, l: "P2P",        d: "Particular / microgrupo", icon: <Icons.Viajeros size={16} /> },
                    { v: "grupo"     as TipoPresupuesto, l: "Grupo",      d: "Colegio / empresa", icon: <Icons.Building size={16} /> },
                  ].map(o => (
                    <CardBtn key={o.v} active={tipoPres === o.v} onClick={() => { setTipoPres(o.v); if (o.v === "grupo" && parseInt(plazas) < 10) setPlazas("10"); }}>
                      {o.icon}
                      <span style={{ fontWeight: 700 }}>{o.l}</span>
                      <span style={{ fontSize: "0.62rem", textAlign: "center", lineHeight: 1.3 }}>{o.d}</span>
                    </CardBtn>
                  ))}
                </div>
              </div>

              {/* T-tulo + plazas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "0.75rem" }}>
                <div>
                  <FL text="Titulo del viaje" required />
                  <input value={titulo} onChange={e => setTitulo(e.target.value)} style={inp}
                    placeholder={tipoPres === "grupo" ? "Fin de curso Roma 4o ESO - Colegio X" : "Japon a medida primavera 2026"} maxLength={255} />
                </div>
                <div>
                  <FL text="Plazas" required />
                  <input type="number" min={minPlazas} value={plazas} onChange={e => setPlazas(e.target.value)} style={inp} />
                  {tipoPres === "grupo" && <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Min. {minPlazas}</span>}
                </div>
              </div>

              {/* Destinos multiselect con fallback Google Places */}
              <div>
                <FL text="Destinos" />
                {destinosSelected.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem" }}>
                    {destinosSelected.map((d, i) => (
                      <span key={`${d.id}-${i}`} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        padding: "0.2rem 0.6rem", background: "color-mix(in srgb, var(--primary-color, #475569) 12%, white)", color: "var(--primary-color, #475569)",
                        borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600,
                      }}>
                        {d.nombre_comercial || d.nombre}
                        <button type="button" onClick={() => setDestinosSelected(p => p.filter(x => x.id !== d.id))}
                          style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary-color, #475569)", display: "flex", padding: 0 }}>
                          <Icons.Close size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Input buscador */}
                <div style={{ position: "relative" }}>
                  <Icons.Search size={14} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                  <input
                    type="text"
                    value={destinoQuery}
                    onChange={e => { setDestinoQuery(e.target.value); setPlacesResults([]); }}
                    style={{ ...inp, paddingLeft: "2rem" }}
                    placeholder="Buscar destino..."
                  />
                </div>

                {/* Resultados BD */}
                {destinoQuery.length >= 3 && filteredDestinos.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", marginTop: "0.25rem", boxShadow: "0 4px 12px rgba(0,0,0,0.07)" }}>
                    {filteredDestinos.map(d => (
                      <DI key={d.id} onClick={() => { setDestinosSelected(p => p.some(x => x.id === d.id) ? p : [...p, d]); setDestinoQuery(""); setPlacesResults([]); }}>
                        <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{d.nombre_comercial || d.nombre}</span>
                        {(d as any).country && <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{(d as any).country}</span>}
                      </DI>
                    ))}
                  </div>
                )}

                {/* Resultados Google Places (fallback cuando BD no tiene resultados) */}
                {destinoQuery.length >= 3 && filteredDestinos.length === 0 && (
                  <div style={{ marginTop: "0.25rem" }}>
                    {searchingPlaces && (
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.5rem 0" }}>
                        No existe el destino en la Base de datos, buscando con Google Places...
                      </div>
                    )}
                    {!searchingPlaces && placesResults.length > 0 && (
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.07)" }}>
                        <div style={{ padding: "0.35rem 0.75rem", fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", background: "#fafafa" }}>
                          Resultados de Google Places - se anadiran a tu base de datos
                        </div>
                        {placesResults.map((r) => (
                          <DI key={r.placeId} onClick={async () => {
                            if (savingDestino) return;
                            setSavingDestino(true);
                            try {
                              const { getPlaceDetails } = await import("@/actions/places");
                              const { createDestinoFromPlace } = await import("@/actions/destinos");
                              const details = await getPlaceDetails(r.placeId);
                              if (details) {
                                const nuevo = await createDestinoFromPlace(details);
                                if (nuevo) {
                                  setDestinos(p => p.some(x => x.id === nuevo.id) ? p : [...p, nuevo]);
                                  setDestinosSelected(p => p.some(x => x.id === nuevo.id) ? p : [...p, nuevo]);
                                  setDestinoQuery("");
                                  setPlacesResults([]);
                                }
                              }
                            } catch { } finally { setSavingDestino(false); }
                          }}>
                            <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{r.mainText || r.fullText}</span>
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{r.secondaryText}</span>
                          </DI>
                        ))}
                      </div>
                    )}
                    {!searchingPlaces && placesResults.length === 0 && destinoQuery.length >= 3 && (
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.5rem 0" }}>Sin resultados para "{destinoQuery}"</div>
                    )}
                  </div>
                )}
                {savingDestino && <div style={{ fontSize: "0.75rem", color: "var(--primary-color, #475569)", marginTop: "0.25rem" }}>Guardando destino...</div>}
              </div>

              <Toggle value={aconsejamosDestino} onChange={setAconsejamosDestino} label="Aconsejamos destino" />

              {/* Noches + PVP */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <FL text="No de noches" />
                  <select value={noches} onChange={e => setNoches(e.target.value)} style={inp}>
                    <option value="">- sin definir -</option>
                    {[2,3,4,5,6,7,8,9,10,11,12,13,14].map(n => (
                      <option key={n} value={String(n)}>{n} noches</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FL text="Presupuesto max. por viajero (EUR)" />
                  <input type="number" min="0" step="10" value={pvp} onChange={e => setPvp(e.target.value)} style={inp} placeholder="650" />
                </div>
              </div>

              {/* Fechas con margen */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <FL text="Fecha de salida" />
                  <input type="date" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} style={{ ...inp, marginBottom: "0.35rem" }} />
                  <select value={margenSalida} onChange={e => setMargenSalida(e.target.value)} style={{ ...inp, fontSize: "0.72rem", color: "#64748b" }}>
                    <option value="0">Fecha exacta</option>
                    <option value="1">+/- 1 dia</option>
                    <option value="2">+/- 2 dias</option>
                    <option value="5">+/- 5 dias</option>
                  </select>
                </div>
                <div>
                  <FL text="Fecha de regreso" />
                  <input type="date" value={fechaRegreso} onChange={e => setFechaRegreso(e.target.value)} style={{ ...inp, marginBottom: "0.35rem" }} />
                  <select value={margenRegreso} onChange={e => setMargenRegreso(e.target.value)} style={{ ...inp, fontSize: "0.72rem", color: "#64748b" }}>
                    <option value="0">Fecha exacta</option>
                    <option value="1">+/- 1 dia</option>
                    <option value="2">+/- 2 dias</option>
                    <option value="5">+/- 5 dias</option>
                  </select>
                </div>
              </div>

              {/* Notas iniciales */}
              <div>
                <FL text="Notas" />
                <textarea value={notasIniciales} onChange={e => setNotasIniciales(e.target.value)}
                  style={{ ...inp, minHeight: "80px", resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Notas internas sobre esta solicitud..." />
              </div>
            </>
            </div>
          )}

          {/* PASO 3 */}
          {(pageMode || step === 3) && (
            <div style={pageMode ? { display: "flex", flexDirection: "column", gap: "1.25rem", background: "#fff", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" } : {}}>
            {pageMode && <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>3. Preferencias</div>}
            <>
              {/* Enfoque del viaje */}
              <div style={{ background: "#fafbff", border: "1px solid #e0e7ff", borderRadius: "0.6rem", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Enfoque del viaje</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {ENFOQUE_OPTS.map(o => (
                    <button key={o.value} type="button" onClick={() => {
                      setEnfoques(prev => {
                        const next = prev.includes(o.value) ? prev.filter(e => e !== o.value) : [...prev, o.value];
                        if (next.includes("fin_curso") || next.includes("idiomas")) { setTipoAloj(["albergue"]); setRegimen(["pc"]); setMonitores(true); }
                        if (next.includes("cultural") && !next.includes("fin_curso") && !next.includes("idiomas")) { setTipoAloj(["hotel"]); setRegimen(["mp"]); }
                        return next;
                      });
                    }} style={{
                      display: "inline-flex", alignItems: "center", gap: "0.3rem",
                      padding: "0.18rem 0.5rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: 600,
                      border: enfoques.includes(o.value) ? `2px solid ${P}` : "1.5px solid #e2e8f0",
                      background: enfoques.includes(o.value) ? PL : "#fff",
                      color: enfoques.includes(o.value) ? P : "#64748b",
                      cursor: "pointer", transition: "all 0.12s",
                    }}>
                      {o.icon}{o.label}
                    </button>
                  ))}
                </div>
              </div>


              {/* Alojamiento */}
              <div style={{ background: "#fafbff", border: "1px solid #e0e7ff", borderRadius: "0.6rem", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Alojamiento</span>

                <div>
                  <FL text="Tipo de alojamiento" />
                  <MultiChip
                    options={TIPO_ALOJ_OPTS}
                    selected={tipoAloj}
                    onToggle={v => setTipoAloj(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                  />
                  {tipoAloj.includes("otros") && (
                    <input value={tipoAlojOtros} onChange={e => setTipoAlojOtros(e.target.value)} style={{ ...inp, marginTop: "0.5rem" }}
                      placeholder="Especifica el tipo de alojamiento..." />
                  )}
                </div>

                <div>
                  <FL text="Categoria" />
                  <MultiChip
                    options={CATEGORIA_OPTS.filter(o => o.value)}
                    selected={categoria}
                    onToggle={v => setCategoria(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                  />
                </div>

                <div>
                  <FL text="Regimen de comidas" />
                  <MultiChip
                    options={REGIMEN_OPTS}
                    selected={regimen}
                    onToggle={v => setRegimen(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                  />
                </div>

                <div>
                  <FL text="Ubicacion" />
                  <MultiChip
                    options={UBICACION_OPTS}
                    selected={[ubicacion]}
                    onToggle={v => setUbicacion(v)}
                  />
                </div>

                <div>
                  <FL text="Preferencia de habitacion" />
                  <MultiChip
                    options={[
                      { value: "individual", label: "Individual" },
                      { value: "doble", label: "Doble" },
                      { value: "triple", label: "Triple" },
                      { value: "cuadruple", label: "Cuadruple+" },
                    ]}
                    selected={prefHab}
                    onToggle={v => setPrefHab(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                  />
                </div>
              </div>

              {/* Transporte */}
              <div style={{ background: "#fafbff", border: "1px solid #e0e7ff", borderRadius: "0.6rem", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Transporte</span>
                <Toggle value={vuelo} onChange={setVuelo} label="Requiere vuelo" />
                {vuelo && (
                  <div style={{ paddingLeft: "2.8rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <FL text="Tipo de aerolinea" />
                    <ChipSelect
                      options={[
                        { value: "indiferente", label: "Indiferente" },
                        { value: "lowcost", label: "Low cost" },
                        { value: "regular", label: "Regular" },
                        { value: "charter", label: "Charter" },
                      ]}
                      value={tipoAerolinea}
                      onChange={setTipoAerolinea}
                    />
                    <FL text="Preferencia de horario" />
                    <ChipSelect options={HORARIO_VUELO_OPTS} value={horarioVuelo} onChange={setHorarioVuelo} />
                  </div>
                )}
                <Toggle value={tren} onChange={setTren} label="Requiere tren" />
                <Toggle value={autocar} onChange={setAutocar} label="Requiere autocar desde origen" />
                <Toggle value={trasladosInt} onChange={setTrasladosInt} label="Requiere traslados en destino" />
              </div>

              {/* Programa */}
              <div style={{ background: "#fafbff", border: "1px solid #e0e7ff", borderRadius: "0.6rem", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Programa y calificacion</span>

                <Toggle value={conoceDestino} onChange={setConoceDestino} label="El cliente conoce el destino" />

                {(enfoques.includes("fin_curso") || enfoques.includes("idiomas")) && (
                  <Toggle value={monitores} onChange={setMonitores} label="Requiere monitores acompanantes 24h" />
                )}

                <div>
                  <FL text="Visitas e itinerario deseado" />
                  <textarea value={visitas} onChange={e => setVisitas(e.target.value)} rows={3}
                    style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                    placeholder={VISITAS_PLACEHOLDER[enfoques[0]] ?? VISITAS_PLACEHOLDER[""]}></textarea>
                </div>
              </div>

              {/* Viaje a-o pasado */}
              <div style={{ background: "#fafbff", border: "1px solid #e0e7ff", borderRadius: "0.6rem", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-color, #475569)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Historial de viaje</span>
                <Toggle value={viajaronAnoPasado} onChange={setViajaronAnoPasado} label="Viajaron el ano pasado?" />
                {viajaronAnoPasado && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", paddingLeft: "2.8rem" }}>
                    <div>
                      <FL text="Destino" />
                      <input value={viajeAnterior.destino} onChange={e => setViajeAnterior(p => ({ ...p, destino: e.target.value }))} style={inp} placeholder="Ej. Paris, Roma, Londres..." />
                    </div>
                    <div>
                      <FL text="Fechas" />
                      <input value={viajeAnterior.fechas} onChange={e => setViajeAnterior(p => ({ ...p, fechas: e.target.value }))} style={inp} placeholder="Ej. 15-22 marzo 2024" />
                    </div>
                    <div>
                      <FL text="Agencia contratada" />
                      <input value={viajeAnterior.agencia} onChange={e => setViajeAnterior(p => ({ ...p, agencia: e.target.value }))} style={inp} placeholder="Ej. Viajes El Corte Ingles, agencia local..." />
                    </div>
                    <div>
                      <FL text="Excursiones / actividades" />
                      <textarea value={viajeAnterior.excursiones} onChange={e => setViajeAnterior(p => ({ ...p, excursiones: e.target.value }))} rows={2}
                        style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                        placeholder="Ej. Visita Coliseo, tour en barco, noche flamenca..."></textarea>
                    </div>
                    <div>
                      <FL text="Valoracion del viaje anterior" />
                      <ChipSelect
                        options={[
                          { value: "muy_satisfecho", label: "Muy satisfecho" },
                          { value: "satisfecho", label: "Satisfecho" },
                          { value: "regular", label: "Regular" },
                          { value: "insatisfecho", label: "Insatisfecho" },
                        ]}
                        value={viajeAnterior.valoracion}
                        onChange={v => setViajeAnterior(p => ({ ...p, valoracion: v as string }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#dc2626", ...(pageMode ? { gridColumn: "1 / -1" } : {}) }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <FooterActions
          step={step}
          step1Valid={step1Valid}
          step2Valid={step2Valid}
          saving={saving}
          modoEdicion={modoEdicion}
          pageMode={pageMode}
          onBack={() => { if (step > 1) setStep(s => s - 1); else onClose(); }}
          onNext={() => setStep(s => s + 1)}
          onSubmit={handleSubmit}
        />
    </div>
    );
  }

  const innerContent = renderContent();

  return (
    <>
      {pageMode ? (
        <div style={{ width: "100%" }}>
          {innerContent}
        </div>
      ) : (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
          {innerContent}
        </div>
      )}

      {/* -- Modal: Nuevo responsable -- */}
      {nuevoResponsable && (
      <div style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }} onClick={e => { if (e.target === e.currentTarget) { setNuevoResponsable(false); setNuevoResp(emptyContacto()); } }}>
        <div style={{
          background: "#fff", borderRadius: "0.75rem", width: "100%", maxWidth: "480px",
          boxShadow: "0 20px 40px -8px rgba(0,0,0,0.3)", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>Anadir responsable</span>
            <button type="button" onClick={() => { setNuevoResponsable(false); setNuevoResp(emptyContacto()); }}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
              <Icons.Close size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <div><FL text="Nombre" required /><input value={nuevoResp.nombre} onChange={e => setNuevoResp(p => ({ ...p, nombre: e.target.value }))} style={inp} placeholder="Carlos" /></div>
              <div><FL text="Apellidos" /><input value={nuevoResp.apellidos} onChange={e => setNuevoResp(p => ({ ...p, apellidos: e.target.value }))} style={inp} placeholder="Garcia Lopez" /></div>
            </div>
            <div><FL text="Cargo" /><input value={nuevoResp.cargo} onChange={e => setNuevoResp(p => ({ ...p, cargo: e.target.value }))} style={inp} placeholder="Profesor organizador" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <div>
                <FL text="Email directo" />
                <input value={nuevoResp.email} onChange={e => setNuevoResp(p => ({ ...p, email: e.target.value }))} style={inp} placeholder="carlos.garcia@colegio.com" type="email" />
                <span style={{ fontSize: "0.65rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "0.2rem", marginTop: "0.2rem" }}>
                  <Icons.Warning size={11} /> Email personal, no el del centro
                </span>
              </div>
              <div><FL text="Telefono" /><input value={nuevoResp.telefono} onChange={e => setNuevoResp(p => ({ ...p, telefono: e.target.value }))} style={inp} placeholder="600 112 233" /></div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", padding: "0.9rem 1.25rem", borderTop: "1px solid #f1f5f9", background: "#fafafa", borderRadius: "0 0 0.75rem 0.75rem" }}>
            <button type="button" onClick={() => { setNuevoResponsable(false); setNuevoResp(emptyContacto()); }} style={btnSecondary}>Cancelar</button>
            <button type="button" disabled={!nuevoResp.nombre.trim() || savingResp}
              style={{ ...btnPrimary, opacity: !nuevoResp.nombre.trim() || savingResp ? 0.5 : 1, cursor: !nuevoResp.nombre.trim() || savingResp ? "not-allowed" : "pointer" }}
              onClick={async () => {
                if (!nuevoResp.nombre.trim() || !entidadId) return;
                setSavingResp(true);
                try {
                  const res = await fetch("/api/crm/contactos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      entidad_id: entidadId,
                      nombre: `${nuevoResp.nombre.trim()} ${nuevoResp.apellidos.trim()}`.trim(),
                      cargo: nuevoResp.cargo || null,
                      email: nuevoResp.email || null,
                      telefono: nuevoResp.telefono || null,
                      es_principal: (entidadDetalle?.contactos?.length ?? 0) === 0,
                    }),
                  });
                  const j = await res.json();
                  if (j?.success || j?.data?.id) {
                    const nuevo = j.data;
                    setEntidadDetalle((prev: any) => ({ ...prev, contactos: [...(prev.contactos ?? []), nuevo] }));
                    setResponsableId(nuevo.id);
                    setNuevoResponsable(false);
                    setNuevoResp(emptyContacto());
                  }
                } catch { } finally { setSavingResp(false); }
              }}>
              {savingResp ? "Guardando..." : "Guardar responsable"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
