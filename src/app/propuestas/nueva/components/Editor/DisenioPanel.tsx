"use client";

import React from "react";
import { Map as MapPinIcon, Route } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import TextoEstiloEditor from "./TextoEstiloEditor";
import FondoSeccionEditor from "./FondoSeccionEditor";
import AltoSeccionEditor from "./AltoSeccionEditor";

export default function DisenioPanel({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  return (
    <>
      {seccion.tipo === "texto-imagenes" && (
        <>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Layout</label>
            <div className={styles.layoutPicker}>
              <button
                className={`${styles.layoutOption} ${(seccion.layout ?? "texto-img") === "texto-img" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "texto-img" })}
                title="Texto izquierda, imagen derecha"
              >
                <div className={styles.layoutPreview}>
                  <div className={styles.lpText}><div className={styles.lpLine} /></div>
                  <div className={styles.lpImg} />
                </div>
                <span className={styles.layoutLabel}>Texto · Img</span>
              </button>
              <button
                className={`${styles.layoutOption} ${seccion.layout === "img-texto" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "img-texto" })}
                title="Imagen izquierda, texto derecha"
              >
                <div className={styles.layoutPreview}>
                  <div className={styles.lpImg} />
                  <div className={styles.lpText}><div className={styles.lpLine} /></div>
                </div>
                <span className={styles.layoutLabel}>Img · Texto</span>
              </button>
            </div>
          </div>
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "completo") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "completo") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "completo") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
          <TextoEstiloEditor
            label="Título"
            value={seccion.estiloTitulo}
            onChange={v => onUpdate(seccion.uid, { estiloTitulo: v })}
          />
          <TextoEstiloEditor
            label="Texto Libre"
            value={seccion.estiloSubtitulo}
            onChange={v => onUpdate(seccion.uid, { estiloSubtitulo: v })}
          />
        </>
      )}
      {seccion.tipo === "texto-columnas" && (
        <>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Layout</label>
            <div className={styles.layoutPicker}>
              {[
                {
                  id: "2-cols",
                  label: "2 Columnas",
                  preview: (
                    <div className={styles.layoutPreview} style={{ gap: 4, padding: "6px" }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "80%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                        <div style={{ width: "60%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "80%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                        <div style={{ width: "60%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                    </div>
                  )
                },
                {
                  id: "3-cols",
                  label: "3 Columnas",
                  preview: (
                    <div className={styles.layoutPreview} style={{ gap: 3, padding: "6px" }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "70%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "70%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "70%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                    </div>
                  )
                },
                {
                  id: "4-cols",
                  label: "4 Columnas",
                  preview: (
                    <div className={styles.layoutPreview} style={{ gap: 2, padding: "6px" }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "60%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "60%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "60%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ width: "60%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                    </div>
                  )
                },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.layoutOption} ${(seccion.layout ?? "3-cols") === opt.id ? styles.layoutOptionActive : ""}`}
                  onClick={() => onUpdate(seccion.uid, { layout: opt.id })}
                >
                  {opt.preview}
                  <span className={styles.layoutLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "1200px") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "1200px") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "1200px") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
          <TextoEstiloEditor
            label="Título de la sección"
            value={seccion.estiloTitulo}
            onChange={v => onUpdate(seccion.uid, { estiloTitulo: v })}
          />
          <TextoEstiloEditor
            label="Título de columnas"
            value={seccion.estiloTituloDia}
            onChange={v => onUpdate(seccion.uid, { estiloTituloDia: v })}
          />
          <TextoEstiloEditor
            label="Texto de columnas"
            value={seccion.estiloDescDia}
            onChange={v => onUpdate(seccion.uid, { estiloDescDia: v })}
          />
        </>
      )}
      {(seccion.tipo === "ofertas" || seccion.tipo === "cards") && (
        <>
          {seccion.tipo === "ofertas" && (
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
                    className={`${styles.previewBtn} ${(seccion.listadoEstiloTarjeta ?? "simple") === opt.id ? styles.saveBtn : ""}`}
                    style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.listadoEstiloTarjeta ?? "simple") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.listadoEstiloTarjeta ?? "simple") === opt.id ? "#ffffff" : "#475569" }}
                    onClick={() => onUpdate(seccion.uid, { listadoEstiloTarjeta: opt.id as "simple" | "articulo" })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {seccion.tipo === "ofertas" && (
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
                    className={`${styles.previewBtn} ${(seccion.layout ?? "3-cols") === opt.id ? styles.saveBtn : ""}`}
                    style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.layout ?? "3-cols") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.layout ?? "3-cols") === opt.id ? "#ffffff" : "#475569" }}
                    onClick={() => onUpdate(seccion.uid, { layout: opt.id })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "1200px") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "1200px") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "1200px") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
          <TextoEstiloEditor
            label="Título de la sección"
            value={seccion.estiloTitulo}
            onChange={v => onUpdate(seccion.uid, { estiloTitulo: v })}
          />
          <TextoEstiloEditor
            label={seccion.tipo === "cards" ? "Título de la card" : "Título de la tarjeta"}
            value={seccion.estiloTituloDia}
            onChange={v => onUpdate(seccion.uid, { estiloTituloDia: v })}
          />
          {seccion.tipo === "cards" && (
            <TextoEstiloEditor
              label="Subtítulo"
              value={seccion.estiloDescDia}
              onChange={v => onUpdate(seccion.uid, { estiloDescDia: v })}
            />
          )}
        </>
      )}
      {seccion.tipo === "galeria" && (
        <>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Columnas</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "2-cols", label: "2" },
                { id: "3-cols", label: "3" },
                { id: "4-cols", label: "4" },
                { id: "5-cols", label: "5" },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.previewBtn} ${(seccion.layout ?? "3-cols") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.layout ?? "3-cols") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.layout ?? "3-cols") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { layout: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "1200px") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "1200px") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "1200px") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
          <TextoEstiloEditor
            label="Título de la sección"
            value={seccion.estiloTitulo}
            onChange={v => onUpdate(seccion.uid, { estiloTitulo: v })}
          />
        </>
      )}
      {seccion.tipo === "itinerario" && (
        <>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Layout</label>
            <div className={styles.layoutPicker}>
              <button
                className={`${styles.layoutOption} ${(seccion.layout ?? "vertical") === "vertical" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "vertical" })}
                title="Vertical Alternado"
              >
                <div className={styles.layoutPreview} style={{ flexDirection: "column", gap: 3, padding: 4 }}>
                  <div style={{ display: "flex", gap: 3, width: "100%", height: 8 }}>
                    <div className={styles.lpText} style={{ flex: 1 }}><div className={styles.lpLine} style={{ height: 3, background: "#cbd5e1" }} /></div>
                    <div className={styles.lpImg} style={{ width: 12, height: "100%", background: "#cbd5e1" }} />
                  </div>
                  <div style={{ display: "flex", gap: 3, width: "100%", height: 8 }}>
                    <div className={styles.lpImg} style={{ width: 12, height: "100%", background: "#cbd5e1" }} />
                    <div className={styles.lpText} style={{ flex: 1 }}><div className={styles.lpLine} style={{ height: 3, background: "#cbd5e1" }} /></div>
                  </div>
                </div>
                <span className={styles.layoutLabel}>Vertical</span>
              </button>
              <button
                className={`${styles.layoutOption} ${seccion.layout === "acordeon" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "acordeon" })}
                title="Acordeón Horizontal"
              >
                <div className={styles.layoutPreview} style={{ gap: 2, padding: "4px 6px" }}>
                  <div style={{ flex: 2, background: "#6366f1", borderRadius: 2 }} />
                  <div style={{ flex: 1, background: "#cbd5e1", borderRadius: 2 }} />
                  <div style={{ flex: 1, background: "#cbd5e1", borderRadius: 2 }} />
                  <div style={{ flex: 1, background: "#cbd5e1", borderRadius: 2 }} />
                </div>
                <span className={styles.layoutLabel}>Acordeón</span>
              </button>
            </div>
          </div>
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "completo") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "completo") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "completo") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
          <TextoEstiloEditor
            label="Título del itinerario"
            value={seccion.estiloTitulo}
            onChange={v => onUpdate(seccion.uid, { estiloTitulo: v })}
          />
          <TextoEstiloEditor
            label="Título de día"
            value={seccion.estiloTituloDia}
            onChange={v => onUpdate(seccion.uid, { estiloTituloDia: v })}
          />
          <TextoEstiloEditor
            label="Texto de día"
            value={seccion.estiloDescDia}
            onChange={v => onUpdate(seccion.uid, { estiloDescDia: v })}
          />
        </>
      )}
      {seccion.tipo === "portada" && (
        <div className={styles.editorSection}>
          <label className={styles.editorFieldLabel}>Layout</label>
          <div className={styles.layoutPicker}>
            {[
              { id: "slide",    label: "Slide",    preview: (
                <div className={styles.layoutPreview} style={{ position: "relative", background: "#e2e8f0", borderRadius: 3 }}>
                  <div style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#94a3b8" }}>‹</div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "6px 12px", justifyContent: "center" }}>
                    <div className={styles.lpLine} style={{ width: "60%", background: "rgba(255,255,255,0.7)" }} />
                    <div className={styles.lpLine} style={{ width: "40%", background: "rgba(255,255,255,0.5)" }} />
                  </div>
                  <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#94a3b8" }}>›</div>
                </div>
              )},
              { id: "wave",     label: "Wave",     preview: (
                <div className={styles.layoutPreview} style={{ background: "#f8fafc", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "6px 6px", justifyContent: "center", zIndex: 1 }}>
                    <div className={styles.lpLine} style={{ width: "70%" }} />
                    <div className={styles.lpLine} style={{ width: "50%" }} />
                  </div>
                  <svg viewBox="0 0 60 36" style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "45%" }} preserveAspectRatio="none">
                    <path d="M15,0 Q0,18 15,36 L60,36 L60,0 Z" fill="#e2e8f0" />
                  </svg>
                </div>
              )},
              { id: "polaroid", label: "Polaroid",  preview: (
                <div className={styles.layoutPreview} style={{ background: "#f8fafc", borderRadius: 3, overflow: "hidden", gap: 4 }}>
                  <div style={{ flex: 1, position: "relative", height: "100%" }}>
                    {[{r:"-8deg",l:"0px",t:"2px"},{r:"5deg",l:"8px",t:"6px"},{r:"-3deg",l:"4px",t:"12px"}].map((s,i)=>(
                      <div key={i} style={{ position:"absolute", left:s.l, top:s.t, width:16, height:20, background:"#fff", border:"1px solid #e2e8f0", borderRadius:1, transform:`rotate(${s.r})`, boxShadow:"0 1px 3px rgba(0,0,0,0.1)", zIndex:i }}>
                        <div style={{ margin:2, height:12, background:"#e2e8f0", borderRadius:1 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "6px 4px", justifyContent: "center" }}>
                    <div className={styles.lpLine} style={{ width: "80%" }} />
                    <div className={styles.lpLine} style={{ width: "60%" }} />
                  </div>
                </div>
              )},
              { id: "pills",    label: "Pills",    preview: (
                <div className={styles.layoutPreview} style={{ background: "#f8fafc", borderRadius: 3, gap: 6, padding: "4px 6px" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, justifyContent: "center" }}>
                    <div className={styles.lpLine} style={{ width: "80%" }} />
                    <div className={styles.lpLine} style={{ width: "60%" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "row", gap: 3, alignItems: "center", height: "100%" }}>
                    {[{ h: "70%", w: 8 }, { h: "100%", w: 8 }, { h: "70%", w: 8 }].map((s, i) => (
                      <div key={i} style={{ width: s.w, height: s.h, background: "#e2e8f0", borderRadius: 20 }} />
                    ))}
                  </div>
                </div>
              )},
            ].map(({ id, label, preview }) => (
              <button
                key={id}
                className={`${styles.layoutOption} ${(seccion.layout ?? "slide") === id ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: id })}
              >
                {preview}
                <span className={styles.layoutLabel}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {seccion.tipo === "portada" && ["wave", "polaroid"].includes(seccion.layout ?? "slide") && (
        <div className={styles.editorSection}>
          <label className={styles.editorFieldLabel}>Color de fondo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label className={styles.colorPickerBtn} style={{ background: seccion.colorFondo ?? "#ffffff", width: 34, height: 34, borderRadius: "0.5rem" }}>
              <input type="color" value={seccion.colorFondo ?? "#ffffff"} onChange={e => onUpdate(seccion.uid, { colorFondo: e.target.value })} />
            </label>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>{seccion.colorFondo ?? "#ffffff"}</span>
            {seccion.colorFondo && (
              <button onClick={() => onUpdate(seccion.uid, { colorFondo: undefined })} style={{ fontSize: "0.75rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Restablecer</button>
            )}
          </div>
        </div>
      )}
      {seccion.tipo === "portada" && (
        <>
          <TextoEstiloEditor
            label="Título"
            value={seccion.estiloTitulo}
            onChange={v => onUpdate(seccion.uid, { estiloTitulo: v })}
          />
          <TextoEstiloEditor
            label="Subtítulo"
            value={seccion.estiloSubtitulo}
            onChange={v => onUpdate(seccion.uid, { estiloSubtitulo: v })}
          />
        </>
      )}
      {seccion.tipo === "mapa" && (
        <>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Layout</label>
            <div className={styles.layoutPicker}>
              <button
                className={`${styles.layoutOption} ${(seccion.layout ?? "mapa") === "mapa" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "mapa" })}
                title="Solo mapa"
              >
                <div className={styles.layoutPreview} style={{ background: "#e8f0fe", borderRadius: 3, position: "relative" }}>
                  <MapPinIcon size={14} color="#6366f1" style={{ margin: "auto" }} />
                </div>
                <span className={styles.layoutLabel}>Solo mapa</span>
              </button>
              <button
                className={`${styles.layoutOption} ${seccion.layout === "mapa-listado" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "mapa-listado" })}
                title="Mapa + listado"
              >
                <div className={styles.layoutPreview} style={{ background: "#f8fafc", borderRadius: 3, gap: 4, padding: "4px 6px" }}>
                  <div style={{ flex: 1, background: "#e8f0fe", borderRadius: 2 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, justifyContent: "center" }}>
                    <div className={styles.lpLine} style={{ width: "80%" }} />
                    <div className={styles.lpLine} style={{ width: "60%" }} />
                    <div className={styles.lpLine} style={{ width: "70%" }} />
                  </div>
                </div>
                <span className={styles.layoutLabel}>Mapa · Listado</span>
              </button>
            </div>
          </div>
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "completo") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "completo") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "completo") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
        </>
      )}
      {seccion.tipo === "ruta" && (
        <>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Layout</label>
            <div className={styles.layoutPicker}>
              <button
                className={`${styles.layoutOption} ${(seccion.layout ?? "mapa") === "mapa" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "mapa" })}
                title="Solo mapa"
              >
                <div className={styles.layoutPreview} style={{ background: "#e8f0fe", borderRadius: 3, position: "relative" }}>
                  <Route size={14} color="#6366f1" style={{ margin: "auto" }} />
                </div>
                <span className={styles.layoutLabel}>Solo mapa</span>
              </button>
              <button
                className={`${styles.layoutOption} ${seccion.layout === "mapa-listado" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "mapa-listado" })}
                title="Mapa + listado"
              >
                <div className={styles.layoutPreview} style={{ background: "#f8fafc", borderRadius: 3, gap: 4, padding: "4px 6px" }}>
                  <div style={{ flex: 1, background: "#e8f0fe", borderRadius: 2 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, justifyContent: "center" }}>
                    <div className={styles.lpLine} style={{ width: "80%" }} />
                    <div className={styles.lpLine} style={{ width: "60%" }} />
                    <div className={styles.lpLine} style={{ width: "70%" }} />
                  </div>
                </div>
                <span className={styles.layoutLabel}>Mapa · Listado</span>
              </button>
            </div>
          </div>
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "completo") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "completo") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "completo") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
        </>
      )}
      {seccion.tipo === "menu" && (
        <>
          <div className={styles.editorSection}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={seccion.menuFijo ?? false}
                onChange={e => onUpdate(seccion.uid, { menuFijo: e.target.checked })}
                style={{ width: 15, height: 15, accentColor: "var(--primary-color,#475569)", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>Menú fijo (sticky)</span>
            </label>
            <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: "0.25rem 0 0 23px" }}>El menú permanece visible al hacer scroll</p>
          </div>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Color de fondo del menú</label>
            {(() => {
              // Parsear el color actual para separar hex y alpha
              const raw = seccion.menuColorFondo ?? "rgba(255,255,255,0.95)";
              const rgbaMatch = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
              let hexVal = "#ffffff";
              let alphaVal = 0.95;
              if (rgbaMatch) {
                const r = parseInt(rgbaMatch[1]), g = parseInt(rgbaMatch[2]), b = parseInt(rgbaMatch[3]);
                hexVal = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
                alphaVal = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
              } else if (raw.startsWith("#")) {
                hexVal = raw.slice(0, 7);
                alphaVal = 1;
              }
              const hexToRgba = (hex: string, a: number) => {
                const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r},${g},${b},${a})`;
              };
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ width: 34, height: 34, borderRadius: "0.5rem", border: "1px solid #e2e8f0", background: hexVal, flexShrink: 0, cursor: "pointer", overflow: "hidden" }}>
                      <input type="color" value={hexVal}
                        onChange={e => onUpdate(seccion.uid, { menuColorFondo: hexToRgba(e.target.value, alphaVal) })}
                        style={{ opacity: 0, position: "absolute" }} />
                    </label>
                    <div style={{ flex: 1, height: 34, borderRadius: "0.5rem", border: "1px solid #e2e8f0", overflow: "hidden",
                      background: `linear-gradient(to right, rgba(0,0,0,0), ${hexVal})` }}>
                      <input type="range" min={0} max={1} step={0.01} value={alphaVal}
                        onChange={e => onUpdate(seccion.uid, { menuColorFondo: hexToRgba(hexVal, parseFloat(e.target.value)) })}
                        style={{ width: "100%", height: "100%", cursor: "pointer", accentColor: hexVal }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace", minWidth: 32, textAlign: "right" }}>
                      {Math.round(alphaVal * 100)}%
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontFamily: "monospace", flex: 1 }}>{raw}</span>
                    {seccion.menuColorFondo && (
                      <button onClick={() => onUpdate(seccion.uid, { menuColorFondo: undefined })}
                        style={{ fontSize: "0.73rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>
                        Restablecer
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Color del texto</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ width: 34, height: 34, borderRadius: "0.5rem", border: "1px solid #e2e8f0", background: seccion.menuColorTexto ?? "#1e293b", flexShrink: 0, cursor: "pointer", overflow: "hidden" }}>
                <input type="color" value={seccion.menuColorTexto ?? "#1e293b"} onChange={e => onUpdate(seccion.uid, { menuColorTexto: e.target.value })} style={{ opacity: 0, position: "absolute" }} />
              </label>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>{seccion.menuColorTexto ?? "#1e293b"}</span>
              {seccion.menuColorTexto && (
                <button onClick={() => onUpdate(seccion.uid, { menuColorTexto: undefined })}
                  style={{ fontSize: "0.73rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Restablecer
                </button>
              )}
            </div>
          </div>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Color del botón</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ width: 34, height: 34, borderRadius: "0.5rem", border: "1px solid #e2e8f0", background: seccion.menuColorBoton ?? "var(--primary-color,#475569)", flexShrink: 0, cursor: "pointer", overflow: "hidden" }}>
                <input type="color" value={seccion.menuColorBoton ?? "#475569"} onChange={e => onUpdate(seccion.uid, { menuColorBoton: e.target.value })} style={{ opacity: 0, position: "absolute" }} />
              </label>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>{seccion.menuColorBoton ?? "color principal"}</span>
              {seccion.menuColorBoton && (
                <button onClick={() => onUpdate(seccion.uid, { menuColorBoton: undefined })}
                  style={{ fontSize: "0.73rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Restablecer
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {seccion.tipo === "precio" && (
        <>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Layout</label>
            <div className={styles.layoutPicker}>
              {[
                {
                  id: "destacado-grande",
                  label: "Destacado Grande",
                  preview: (
                    <div className={styles.layoutPreview} style={{ flexDirection: "column", gap: 3, padding: 6, alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "50%", height: 6, background: "#8b5cf6", borderRadius: 2 }} />
                      <div style={{ width: "80%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      <div style={{ width: "70%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                    </div>
                  )
                },
                {
                  id: "card-premium",
                  label: "Card Premium",
                  preview: (
                    <div className={styles.layoutPreview} style={{ gap: 4, padding: "6px", alignItems: "center" }}>
                      <div style={{ width: "40%", height: 16, background: "#fbbf24", borderRadius: 3 }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ width: "100%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                        <div style={{ width: "80%", height: 3, background: "#cbd5e1", borderRadius: 1 }} />
                      </div>
                    </div>
                  )
                },
                {
                  id: "split-horizontal",
                  label: "Split Horizontal",
                  preview: (
                    <div className={styles.layoutPreview} style={{ flexDirection: "column", gap: 3, padding: 6 }}>
                      <div style={{ width: "90%", height: 8, background: "#6366f1", borderRadius: 2 }} />
                      <div style={{ display: "flex", gap: 3, width: "100%" }}>
                        <div style={{ flex: 1, height: 8, background: "#cbd5e1", borderRadius: 2 }} />
                        <div style={{ flex: 1, height: 8, background: "#cbd5e1", borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.layoutOption} ${(seccion.layout ?? "destacado-grande") === opt.id ? styles.layoutOptionActive : ""}`}
                  onClick={() => onUpdate(seccion.uid, { layout: opt.id })}
                >
                  {opt.preview}
                  <span className={styles.layoutLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "1200px") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "1200px") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "1200px") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
          <TextoEstiloEditor
            label="Estilo PVP"
            value={seccion.estiloPvp}
            onChange={v => onUpdate(seccion.uid, { estiloPvp: v })}
          />
          <TextoEstiloEditor
            label="Estilo Condiciones"
            value={seccion.estiloCondiciones}
            onChange={v => onUpdate(seccion.uid, { estiloCondiciones: v })}
          />
        </>
      )}
      {seccion.tipo === "formulario" && (
        <>
          <div className={styles.editorSection}>
            <label className={styles.editorFieldLabel}>Layout</label>
            <div className={styles.layoutPicker}>
              <button
                className={`${styles.layoutOption} ${(seccion.layout ?? "solo-form") === "solo-form" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "solo-form" })}
                title="Solo Formulario"
              >
                <div className={styles.layoutPreview} style={{ flexDirection: "column", gap: 3, padding: 6 }}>
                  <div style={{ width: "100%", height: 6, background: "#cbd5e1", borderRadius: 1 }} />
                  <div style={{ width: "100%", height: 6, background: "#cbd5e1", borderRadius: 1 }} />
                  <div style={{ width: "40%", height: 8, background: "#6366f1", borderRadius: 2 }} />
                </div>
                <span className={styles.layoutLabel}>Solo Form</span>
              </button>
              <button
                className={`${styles.layoutOption} ${seccion.layout === "form-contacto" ? styles.layoutOptionActive : ""}`}
                onClick={() => onUpdate(seccion.uid, { layout: "form-contacto" })}
                title="Formulario + Contacto Agente"
              >
                <div className={styles.layoutPreview} style={{ gap: 4, padding: 6 }}>
                  <div style={{ width: "30%", height: "100%", background: "#e2e8f0", borderRadius: 2, display: "flex", flexDirection: "column", gap: 2, padding: 2 }}>
                    <div style={{ width: 6, height: 6, background: "#cbd5e1", borderRadius: "50%" }} />
                    <div style={{ width: "100%", height: 2, background: "#cbd5e1" }} />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 1 }} />
                    <div style={{ width: "100%", height: 4, background: "#cbd5e1", borderRadius: 1 }} />
                    <div style={{ width: "50%", height: 6, background: "#6366f1", borderRadius: 2 }} />
                  </div>
                </div>
                <span className={styles.layoutLabel}>Form + Contacto</span>
              </button>
            </div>
          </div>
          <AltoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
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
                  className={`${styles.previewBtn} ${(seccion.anchoMax ?? "1200px") === opt.id ? styles.saveBtn : ""}`}
                  style={{ flex: 1, height: 32, padding: "0 8px", fontSize: "0.75rem", borderRadius: "0.4rem", background: (seccion.anchoMax ?? "1200px") === opt.id ? "#1e293b" : "#ffffff", color: (seccion.anchoMax ?? "1200px") === opt.id ? "#ffffff" : "#475569" }}
                  onClick={() => onUpdate(seccion.uid, { anchoMax: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
        </>
      )}
      {(seccion.tipo === "nego-planet-programas" || seccion.tipo === "nego-planet-destinos") && (
        <FondoSeccionEditor seccion={seccion} onUpdate={onUpdate} />
      )}
      {seccion.tipo !== "texto-imagenes" && seccion.tipo !== "portada" && seccion.tipo !== "texto-columnas" && seccion.tipo !== "itinerario" && seccion.tipo !== "mapa" && seccion.tipo !== "ruta" && seccion.tipo !== "menu" && seccion.tipo !== "precio" && seccion.tipo !== "formulario" && seccion.tipo !== "ofertas" && seccion.tipo !== "cards" && seccion.tipo !== "galeria" && seccion.tipo !== "nego-planet-programas" && seccion.tipo !== "nego-planet-destinos" && (
        <p className={styles.editorEmpty}>Opciones de diseño próximamente.</p>
      )}
    </>
  );
}
