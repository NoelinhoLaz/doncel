"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import styles from "../propuestas/nueva/page.module.css";
import { DISPOSITIVOS } from "../propuestas/nueva/constants";
import type { Dispositivo, TextoEstilo } from "../propuestas/nueva/types";
import TextoEstiloEditor from "../propuestas/nueva/components/Editor/TextoEstiloEditor";
import { PHListado } from "../propuestas/PreviewComponents";
import { guardarDisenioFormatoIndex, getPaginasWebPorFormato } from "@/actions/paginaWeb";

interface DisenioFormato {
  layout?: string;
  estiloTarjeta?: "simple" | "articulo";
  colorFondo?: string;
  anchoMax?: string;
  estiloTitulo?: TextoEstilo;
  estiloTituloDia?: TextoEstilo;
}

export function FormatoIndexEditor({
  paginaId,
  paginaTitulo,
  paginaSlug,
  formatoId,
  initialDisenio,
}: {
  paginaId: string;
  paginaTitulo?: string;
  paginaSlug?: string;
  formatoId: string | null;
  initialDisenio?: DisenioFormato;
}) {
  const router = useRouter();
  const [disenio, setDisenio] = useState<DisenioFormato>(initialDisenio ?? {});
  const [slug, setSlug] = useState(paginaSlug ?? "");
  const [dispositivo, setDispositivo] = useState<Dispositivo>("desktop");
  const [items, setItems] = useState<any[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    if (!formatoId) return;
    getPaginasWebPorFormato(formatoId).then(setItems);
  }, [formatoId]);

  const update = (patch: Partial<DisenioFormato>) => setDisenio(prev => ({ ...prev, ...patch }));

  const guardar = useCallback(async () => {
    setGuardando(true);
    setGuardadoOk(false);
    try {
      const result = await guardarDisenioFormatoIndex({ id: paginaId, disenio, slug });
      if (!result.ok) throw new Error(result.error);
      if (result.slug) setSlug(result.slug);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    } catch (e) {
      console.error("Error guardando diseño de formato:", e);
    } finally {
      setGuardando(false);
    }
  }, [disenio, paginaId, slug]);

  const current = DISPOSITIVOS.find(d => d.id === dispositivo)!;
  const mobile = dispositivo === "mobile";

  return (
    <div className={styles.container}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <button
          type="button"
          onClick={() => router.push("/web")}
          title="Volver a Páginas"
          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", color: "#64748b" }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className={styles.title} style={{ margin: 0 }}>{paginaTitulo || "Formato"}</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "1.25rem", marginLeft: "30px" }}>
        <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontFamily: "monospace" }}>/web/o/</span>
        <input
          type="text"
          value={slug}
          onChange={e => setSlug(e.target.value)}
          placeholder="slug-de-la-pagina"
          style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: "0.375rem", padding: "0.3rem 0.5rem", width: "220px" }}
        />
      </div>

      <div className={styles.columns}>
        {/* Columna izquierda — solo opciones de formato */}
        <div className={styles.sidebar}>
          <div className={styles.sectionesPanel}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.25rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Formato de listado
              </div>

              <div className={styles.editorSection}>
                <label className={styles.editorFieldLabel}>Columnas</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { id: "2-cols", label: "2" },
                    { id: "3-cols", label: "3" },
                    { id: "4-cols", label: "4" },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.4rem", border: "none", cursor: "pointer", background: (disenio.layout ?? "3-cols") === opt.id ? "#1e293b" : "#ffffff", color: (disenio.layout ?? "3-cols") === opt.id ? "#ffffff" : "#475569" }}
                      onClick={() => update({ layout: opt.id })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.editorSection}>
                <label className={styles.editorFieldLabel}>Estilo de tarjeta</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { id: "simple", label: "Simple" },
                    { id: "articulo", label: "Artículo" },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.4rem", border: "none", cursor: "pointer", background: (disenio.estiloTarjeta ?? "simple") === opt.id ? "#1e293b" : "#ffffff", color: (disenio.estiloTarjeta ?? "simple") === opt.id ? "#ffffff" : "#475569" }}
                      onClick={() => update({ estiloTarjeta: opt.id as "simple" | "articulo" })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.editorSection}>
                <label className={styles.editorFieldLabel}>Ancho de sección</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { id: "900px", label: "Pequeño" },
                    { id: "1200px", label: "Mediano" },
                    { id: "completo", label: "Ancho completo" },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.4rem", border: "none", cursor: "pointer", background: (disenio.anchoMax ?? "1200px") === opt.id ? "#1e293b" : "#ffffff", color: (disenio.anchoMax ?? "1200px") === opt.id ? "#ffffff" : "#475569" }}
                      onClick={() => update({ anchoMax: opt.id })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.editorSection}>
                <label className={styles.editorFieldLabel}>Color de fondo</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label className={styles.colorPickerBtn} style={{ background: disenio.colorFondo ?? "#ffffff", width: 34, height: 34, borderRadius: "0.5rem" }}>
                    <input type="color" value={disenio.colorFondo ?? "#ffffff"} onChange={e => update({ colorFondo: e.target.value })} />
                  </label>
                  <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>{disenio.colorFondo ?? "#ffffff"}</span>
                  {disenio.colorFondo && (
                    <button onClick={() => update({ colorFondo: undefined })} style={{ fontSize: "0.75rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Restablecer</button>
                  )}
                </div>
              </div>

              <TextoEstiloEditor
                label="Título de la página"
                value={disenio.estiloTitulo}
                onChange={v => update({ estiloTitulo: v })}
              />
              <TextoEstiloEditor
                label="Título de artículo"
                value={disenio.estiloTituloDia}
                onChange={v => update({ estiloTituloDia: v })}
              />
            </div>
          </div>
        </div>

        {/* Columna derecha — Canvas */}
        <div className={styles.canvasColumn}>
          <div className={styles.deviceBar}>
            {DISPOSITIVOS.map(d => (
              <button
                key={d.id}
                className={`${styles.deviceBtn} ${dispositivo === d.id ? styles.deviceBtnActive : ""}`}
                onClick={() => setDispositivo(d.id)}
                title={d.label}
              >
                <d.Icon size={16} />
              </button>
            ))}
            <div className={styles.deviceBarSep} />
            <button
              className={`${styles.saveBtn} ${guardadoOk ? styles.saveBtnOk : ""}`}
              onClick={guardar}
              disabled={guardando}
              title="Guardar formato"
            >
              {guardando ? <span className={styles.saveBtnSpinner} /> : guardadoOk ? <span>✓ Guardado</span> : <span>Guardar</span>}
            </button>
          </div>

          <div className={styles.canvasWrapper}>
            <div
              className={`${styles.canvas} ${dispositivo === "tablet" ? styles.canvasTablet : ""} ${dispositivo === "mobile" ? styles.canvasMobile : ""}`}
              style={{ width: current.width, height: current.height }}
            >
              <div className={styles.canvasContent}>
                <PHListado
                  mobile={mobile}
                  layout={disenio.layout}
                  titulo={paginaTitulo}
                  colorFondo={disenio.colorFondo}
                  estiloTitulo={disenio.estiloTitulo}
                  estiloTituloDia={disenio.estiloTituloDia}
                  anchoMax={disenio.anchoMax}
                  formatoId={formatoId ?? undefined}
                  items={items}
                  estiloTarjeta={disenio.estiloTarjeta}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
