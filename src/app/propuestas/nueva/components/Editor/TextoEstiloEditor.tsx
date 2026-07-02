"use client";
import React, { useState, useEffect, useRef } from "react";
import { ALargeSmall, Bold, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import styles from "../../page.module.css";
import type { TextoEstilo } from "../../types";
import { FUENTES, TAMANIOS, GROSORES, ALIGN_H_OPTS } from "../../constants";

function IconDropdown({ opts, value, onChange }: {
  opts: { val: string; Icon: React.ElementType }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = opts.find(o => o.val === value) ?? opts[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className={styles.iconDropdown}>
      <button className={styles.iconDropdownTrigger} onClick={() => setOpen(o => !o)}>
        <active.Icon size={13} />
      </button>
      {open && (
        <div className={styles.iconDropdownMenu}>
          {opts.map(({ val, Icon }) => (
            <button
              key={val}
              className={`${styles.iconDropdownItem} ${value === val ? styles.iconDropdownItemActive : ""}`}
              onClick={() => { onChange(val); setOpen(false); }}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TextoEstiloEditor({ label, value, onChange }: {
  label: string;
  value?: TextoEstilo;
  onChange: (v: TextoEstilo) => void;
}) {
  const v = value ?? {};
  const set = (k: keyof TextoEstilo, val: string) => onChange({ ...v, [k]: val });

  return (
    <div className={styles.textoEstiloEditor}>
      <p className={styles.textoEstiloLabel}>{label}</p>
      <div className={styles.textoEstiloRow}>
        <div className={`${styles.textoEstiloField} ${styles.textoEstiloFieldFuente}`}>
          <ALargeSmall size={13} className={styles.textoEstiloIcon} />
          <select value={v.fuente ?? "Montserrat"} onChange={e => set("fuente", e.target.value)}>
            {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className={`${styles.textoEstiloField} ${styles.textoEstiloFieldTamano}`}>
          <select value={v.tamano ?? "32px"} onChange={e => set("tamano", e.target.value)}>
            {TAMANIOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className={`${styles.textoEstiloField} ${styles.textoEstiloFieldGrosor}`}>
          <Bold size={13} className={styles.textoEstiloIcon} />
          <select value={v.grosor ?? "600"} onChange={e => set("grosor", e.target.value)}>
            {GROSORES.map(g => (
              <option key={g} value={g}>
                {g === "300" ? "L" : g === "400" ? "R" : g === "500" ? "M" : g === "600" ? "SB" : g === "700" ? "B" : "EB"}
              </option>
            ))}
          </select>
        </div>
        <IconDropdown
          opts={ALIGN_H_OPTS}
          value={v.alineacionH ?? "left"}
          onChange={val => set("alineacionH", val)}
        />
        <label className={styles.colorPickerBtn} title="Color texto" style={{ background: v.color ?? "#1e293b" }}>
          <input type="color" value={v.color ?? "#1e293b"} onChange={e => set("color", e.target.value)} />
        </label>
        <label className={styles.colorPickerBtn} title="Color destacado" style={{ background: v.colorDestacado ?? "#6366f1", outline: "2px dashed #94a3b8", outlineOffset: 2 }}>
          <input type="color" value={v.colorDestacado ?? "#6366f1"} onChange={e => set("colorDestacado", e.target.value)} />
        </label>
      </div>
    </div>
  );
}
