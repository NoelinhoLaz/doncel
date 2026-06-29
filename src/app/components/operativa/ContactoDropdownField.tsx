"use client";

import { Icons } from "@/lib/icons";
import s from "@/components/modals/nuevoExpediente.module.css";

interface Props {
  entidades: any[];
  contactoId: string;
  onContactoChange: (id: string) => void;
  searchContacto: string;
  onSearchChange: (v: string) => void;
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onCreateContacto: () => void;
  disabled?: boolean;
}

const triggerStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1",
  fontSize: "0.85rem", backgroundColor: "#ffffff", display: "flex",
  justifyContent: "space-between", alignItems: "center", minHeight: "38px",
};

export default function ContactoDropdownField({ entidades, contactoId, onContactoChange, searchContacto, onSearchChange, isOpen, onOpenChange, searchRef, onCreateContacto, disabled }: Props) {
  const selected = entidades.find(e => e.id === contactoId);
  const q = searchContacto.toLowerCase();
  const filtered = entidades.filter(ent =>
    ent.nombre?.toLowerCase().includes(q) ||
    ent.documento?.toLowerCase().includes(q) ||
    ent.email?.toLowerCase().includes(q)
  );

  return (
    <div className={s.fieldWrap}>
      <label className={s.fieldLabel}>Contacto Principal</label>

      <div onClick={() => !disabled && onOpenChange(!isOpen)} style={{ ...triggerStyle, cursor: disabled ? "not-allowed" : "pointer" }}>
        <span style={{ color: contactoId ? "#0f172a" : "#94a3b8" }}>
          {selected ? `${selected.nombre}${selected.documento ? ` · ${selected.documento}` : ""}` : "Seleccionar contacto"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          {contactoId && (
            <span onClick={(e) => { e.stopPropagation(); onContactoChange(""); onSearchChange(""); }} style={{ color: "#94a3b8", cursor: "pointer", lineHeight: 1 }} title="Quitar contacto">
              <Icons.Close size={12} />
            </span>
          )}
          <Icons.ChevronDown size={14} style={{ color: "#64748b", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </div>

      {isOpen && <div onClick={() => onOpenChange(false)} style={{ position: "fixed", inset: 0, zIndex: 2050 }} />}

      {isOpen && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem", marginTop: "4px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 2100, display: "flex", flexDirection: "column", maxHeight: "280px" }}>
          <div style={{ display: "flex", padding: "0.5rem", gap: "0.5rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Icons.Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar por nombre, NIF, email..."
                value={searchContacto}
                onChange={(e) => onSearchChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className={s.inp}
                style={{ paddingLeft: "1.75rem" }}
              />
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onCreateContacto(); }} style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap" }}>
              <Icons.Add size={12} /><span>Nuevo</span>
            </button>
          </div>
          <div style={{ overflowY: "auto", padding: "0.25rem" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                {searchContacto.trim() ? (
                  <>No se encontró "{searchContacto}"<br />
                    <span onClick={onCreateContacto} style={{ color: "var(--primary-color, #475569)", fontWeight: 600, cursor: "pointer", textDecoration: "underline", marginTop: "4px", display: "inline-block" }}>
                      Crear "{searchContacto}"
                    </span>
                  </>
                ) : "No hay contactos disponibles"}
              </div>
            ) : filtered.map((ent) => (
              <div
                key={ent.id}
                onClick={() => { onContactoChange(ent.id); onOpenChange(false); onSearchChange(""); }}
                style={{ padding: "0.5rem 0.75rem", borderRadius: "0.25rem", fontSize: "0.8rem", cursor: "pointer", backgroundColor: contactoId === ent.id ? "var(--primary-color, #475569)" : "transparent", color: contactoId === ent.id ? "#fff" : "#334155", transition: "background-color 0.15s" }}
                onMouseEnter={(e) => { if (contactoId !== ent.id) e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                onMouseLeave={(e) => { if (contactoId !== ent.id) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div style={{ fontWeight: 500 }}>{ent.nombre}</div>
                {(ent.documento || ent.email) && <div style={{ fontSize: "0.7rem", opacity: 0.7, marginTop: "1px" }}>{[ent.documento, ent.email].filter(Boolean).join(" · ")}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
