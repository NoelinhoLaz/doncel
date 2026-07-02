"use client";
import React, { useState, useRef } from "react";
import { Eye, EyeOff, Image } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, MenuItemConfig, MenuBoton } from "../../types";

export default function MenuEditorContenido({ seccion, onUpdate, todasSecciones }: { seccion: Seccion; onUpdate: (uid: string, patch: Partial<Seccion>) => void; todasSecciones?: Seccion[] }) {
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const otrasSecciones = (todasSecciones ?? []).filter(s => s.tipo !== "menu");
  const itemsActuales: MenuItemConfig[] = seccion.menuItems
    ?? otrasSecciones.map(s => ({ uid: s.uid, etiqueta: s.label }));
  const boton: MenuBoton = seccion.menuBoton ?? { etiqueta: "", tipo: "externo", href: "" };

  return (
    <>
      {/* Logo */}
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Logo</label>
        {seccion.menuLogo ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={seccion.menuLogo} alt="Logo" style={{ height: 40, maxWidth: 140, objectFit: "contain", borderRadius: 6, border: "1px solid #e2e8f0" }} />
            <button type="button" onClick={() => onUpdate(seccion.uid, { menuLogo: undefined })}
              style={{ fontSize: "0.75rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Quitar
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => logoFileRef.current?.click()} disabled={uploadingLogo}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.55rem 0.9rem", borderRadius: "0.5rem", border: "1.5px dashed #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: "0.78rem", cursor: "pointer", width: "100%", boxSizing: "border-box" }}>
            <Image size={14} />{uploadingLogo ? "Subiendo…" : "Subir imagen de logo"}
          </button>
        )}
        <input ref={logoFileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            setUploadingLogo(true);
            try {
              const fd = new FormData(); fd.append("file", f);
              const res = await fetch("/api/propuestas/upload-image", { method: "POST", body: fd });
              const data = await res.json();
              if (data.url) onUpdate(seccion.uid, { menuLogo: data.url });
            } catch {} finally { setUploadingLogo(false); e.target.value = ""; }
          }}
        />
      </div>

      {/* Items del menú */}
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Secciones en el menú</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {itemsActuales.length === 0 && (
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Añade secciones a la propuesta para que aparezcan aquí.</p>
          )}
          {itemsActuales.map((item, i) => (
            <div key={item.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.45rem 0.65rem", borderRadius: "0.5rem", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <input
                value={item.etiqueta}
                onChange={e => {
                  const next = itemsActuales.map((it, j) => j === i ? { ...it, etiqueta: e.target.value } : it);
                  onUpdate(seccion.uid, { menuItems: next });
                }}
                style={{ flex: 1, border: "none", background: "transparent", fontSize: "0.82rem", color: "#1e293b", outline: "none" }}
                placeholder="Etiqueta"
              />
              <button type="button" title={item.ocultaEnMenu ? "Mostrar en menú" : "Ocultar en menú"}
                onClick={() => {
                  const next = itemsActuales.map((it, j) => j === i ? { ...it, ocultaEnMenu: !it.ocultaEnMenu } : it);
                  onUpdate(seccion.uid, { menuItems: next });
                }}
                style={{ background: "none", border: "none", cursor: "pointer", color: item.ocultaEnMenu ? "#cbd5e1" : "#64748b", display: "flex", padding: 2 }}>
                {item.ocultaEnMenu ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Botón CTA */}
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Botón CTA</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={boton.etiqueta}
            onChange={e => onUpdate(seccion.uid, { menuBoton: { ...boton, etiqueta: e.target.value } })}
            style={{ width: "100%", boxSizing: "border-box", padding: "0.45rem 0.65rem", border: "1.5px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.82rem", color: "#1e293b", outline: "none" }}
            placeholder="Etiqueta del botón (ej: Solicitar info)"
          />
          <div style={{ display: "flex", gap: 6 }}>
            {(["externo", "seccion"] as const).map(t => (
              <button key={t} type="button"
                onClick={() => onUpdate(seccion.uid, { menuBoton: { ...boton, tipo: t } })}
                style={{ flex: 1, padding: "0.35rem 0.5rem", borderRadius: "0.4rem", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer",
                  border: boton.tipo === t ? "2px solid var(--primary-color,#475569)" : "1.5px solid #e2e8f0",
                  background: boton.tipo === t ? "color-mix(in srgb,var(--primary-color,#475569) 10%,white)" : "#fff",
                  color: boton.tipo === t ? "var(--primary-color,#475569)" : "#64748b" }}>
                {t === "externo" ? "URL externa" : "A sección"}
              </button>
            ))}
          </div>
          {boton.tipo === "externo" && (
            <input value={boton.href ?? ""} onChange={e => onUpdate(seccion.uid, { menuBoton: { ...boton, href: e.target.value } })}
              style={{ width: "100%", boxSizing: "border-box", padding: "0.45rem 0.65rem", border: "1.5px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.82rem", color: "#1e293b", outline: "none" }}
              placeholder="https://..." />
          )}
          {boton.tipo === "seccion" && (
            <select value={boton.seccionUid ?? ""} onChange={e => onUpdate(seccion.uid, { menuBoton: { ...boton, seccionUid: e.target.value } })}
              style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1.5px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.82rem", color: "#1e293b", outline: "none", background: "#fff" }}>
              <option value="">— Selecciona sección —</option>
              {itemsActuales.map(it => <option key={it.uid} value={it.uid}>{it.etiqueta}</option>)}
            </select>
          )}
          {boton.etiqueta && (
            <button type="button" onClick={() => onUpdate(seccion.uid, { menuBoton: null })}
              style={{ fontSize: "0.73rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0, alignSelf: "flex-start" }}>
              Quitar botón
            </button>
          )}
        </div>
      </div>
    </>
  );
}
