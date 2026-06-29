"use client";

import { useState, useEffect, useRef } from "react";
import { Info } from "lucide-react";
import * as LucideIcons from "lucide-react";
import SafeDateInput from "./SafeDateInput";
import s from "./ajustes.module.css";

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={s.fieldWrap}>
      <span className={s.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function DisplayValue({ value }: { value: any }) {
  const has = value != null && value !== "" && value !== "—";
  return <span className={has ? s.displayVal : s.displayValEmpty}>{has ? value : "—"}</span>;
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <span className={s.fieldLabel}>{label}</span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={s.inp}
        style={{ textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.25rem" }}
      >
        <span style={{ fontSize: "0.82rem", color: selected.length > 0 ? "#0f172a" : "#94a3b8" }}>
          {selected.length > 0 ? selected.join(", ") : "Seleccionar..."}
        </span>
        <LucideIcons.ChevronDown size={14} style={{ color: "#94a3b8", transform: open ? "rotate(180deg)" : "none", transition: ".2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: "2px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.375rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", padding: "0.25rem" }}>
          {options.map(opt => (
            <label
              key={opt}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.5rem", fontSize: "0.8rem", cursor: "pointer", borderRadius: "0.25rem", color: "#334155", fontWeight: selected.includes(opt) ? 600 : 400 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ cursor: "pointer", accentColor: "#475569" }} />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  form: any;
  setField: (field: string, value: any) => void;
  expediente: any;
  formasPagoAceptadas: string[];
  setFormasPagoAceptadas: (vals: string[]) => void;
}

export default function InfoExpedienteSection({ form, setField, expediente, formasPagoAceptadas, setFormasPagoAceptadas }: Props) {
  return (
    <div style={{ padding: "0 1.5rem 1.25rem 1.5rem" }}>
      <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a", margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <Info size={16} />
        Información del Expediente
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1rem" }}>
        {/* Línea 1: read-only */}
        <Field label="Oficina"><DisplayValue value={expediente?.config_oficinas?.nombre} /></Field>
        <Field label="Destino"><DisplayValue value={expediente?.maestro_destinos?.nombre} /></Field>
        <Field label="Contacto"><DisplayValue value={expediente?.contabilidad_entidades?.nombre} /></Field>
        <Field label="Agente"><DisplayValue value={expediente?.agente?.nombre} /></Field>
        <Field label="Creado"><DisplayValue value={expediente?.created_at ? new Date(expediente.created_at).toLocaleDateString("es-ES") : null} /></Field>
        <Field label="Número"><DisplayValue value={expediente?.numero} /></Field>

        {/* Línea 2: editable */}
        <Field label="Referencia">
          <input value={form.referencia} onChange={e => setField("referencia", e.target.value)} className={s.inp} />
        </Field>
        <Field label="Fecha inicio">
          <SafeDateInput value={form.fecha_inicio} onChange={val => setField("fecha_inicio", val)} className={s.inp} />
        </Field>
        <Field label="Fecha fin">
          <SafeDateInput value={form.fecha_fin} onChange={val => setField("fecha_fin", val)} className={s.inp} />
        </Field>
        <Field label="Tipo">
          <select value={form.tipo_expediente} onChange={e => setField("tipo_expediente", e.target.value)} className={s.inp}>
            <option value="grupo">Grupo</option>
            <option value="vacacional">Vacacional</option>
            <option value="p2p">P2P</option>
          </select>
        </Field>
        <Field label="Plazas máx">
          <input type="number" value={form.plazas_max} onChange={e => setField("plazas_max", e.target.value)} className={s.inp} />
        </Field>
        <Field label="Fecha tope registro">
          <SafeDateInput value={form.fecha_tope_registro} onChange={val => setField("fecha_tope_registro", val)} className={s.inp} />
        </Field>

        {/* Línea 3: slug + pago + apunte + formas */}
        <Field label={
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            Slug (registro viajeros)
            {form.slug && (
              <a href={`/registro/${form.slug}`} target="_blank" rel="noopener noreferrer" title="Abrir página de registro" style={{ display: "flex", color: "#94a3b8", lineHeight: 1 }}>
                <LucideIcons.SquareArrowOutUpRight size={11} />
              </a>
            )}
          </span>
        }>
          <input value={form.slug ?? ""} onChange={e => setField("slug", e.target.value)} className={s.inp} placeholder="ej: viaje-roma-2026" />
        </Field>
        <Field label="Forma de pago">
          <select value={form.forma_pago} onChange={e => setField("forma_pago", e.target.value)} className={s.inp}>
            <option value="un_pagador">Un pagador</option>
            <option value="varios_pagadores">Varios pagadores</option>
          </select>
        </Field>
        {form.forma_pago === "varios_pagadores" ? (
          <Field label="PVP viajero">
            <input type="number" step="0.01" value={form.pvp_viajero} onChange={e => setField("pvp_viajero", e.target.value)} className={s.inp} />
          </Field>
        ) : (
          <Field label="Importe total">
            <input type="number" step="0.01" value={form.pvp_total} onChange={e => setField("pvp_total", e.target.value)} className={s.inp} />
          </Field>
        )}

        {/* Apunte contable toggle */}
        <div className={s.fieldWrap}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className={s.fieldLabel} style={{ marginBottom: 0 }}>
              {form.genera_apunte ? "Apunte contable desde" : "Apunte contable"}
            </span>
            <label className={s.toggleWrapSm} style={{ marginLeft: "auto" }}>
              <input type="checkbox" checked={form.genera_apunte} onChange={e => setField("genera_apunte", e.target.checked)} className={s.toggleInput} />
              <span className={`${s.toggleTrack} ${form.genera_apunte ? s.toggleTrackOn : ""}`}>
                <span className={`${s.toggleKnobSm} ${form.genera_apunte ? s.toggleKnobSmOn : ""}`} />
              </span>
            </label>
          </div>
          {form.genera_apunte ? (
            <SafeDateInput value={form.apuntes_desde} onChange={val => setField("apuntes_desde", val)} className={s.inp} />
          ) : (
            <span style={{ fontSize: "0.82rem", color: "#cbd5e1", fontStyle: "italic", padding: "0.4rem 0" }}>NO GENERA</span>
          )}
        </div>

        <div style={{ gridColumn: "5 / span 2" }}>
          <MultiSelect
            label="Formas de pago aceptadas"
            options={["Transferencia", "TPV virtual", "TPV fisico", "Efectivo", "Organizador"]}
            selected={formasPagoAceptadas}
            onChange={setFormasPagoAceptadas}
          />
        </div>
      </div>
    </div>
  );
}
