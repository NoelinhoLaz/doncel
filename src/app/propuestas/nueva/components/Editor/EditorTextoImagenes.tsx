"use client";

import React from "react";
import { Video, X, Sparkles } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import MediaSelector from "./MediaSelector";
import HighlightTextarea from "./HighlightTextarea";
import { youtubeId } from "../../utils/video-utils";

export default function EditorTextoImagenes({
  seccion,
  onUpdate,
  mediaAbierto,
  setMediaAbierto,
  optimizandoIA,
  mejorarConIA,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
  mediaAbierto: boolean | number | "new" | string;
  setMediaAbierto: (v: any) => void;
  optimizandoIA: string | null;
  mejorarConIA: (campo: "titulo" | "subtitulo") => void;
}) {
  return (
    <>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Imágenes (máx. 5)</label>
        <div className={styles.mediaThumbRow} style={{ flexWrap: "wrap" }}>
          {(seccion.medias ?? []).filter(Boolean).map((m, i) => {
            const ytId = m.tipo === "video" ? youtubeId(m.url) : null;
            const thumbBg = m.tipo === "video"
              ? (ytId ? `url(https://img.youtube.com/vi/${ytId}/mqdefault.jpg)` : undefined)
              : `url(${m.url})`;
            return (
              <button
                key={i}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData("text/plain", i.toString());
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={e => {
                  e.preventDefault();
                }}
                onDrop={e => {
                  e.preventDefault();
                  const dragIndexStr = e.dataTransfer.getData("text/plain");
                  if (dragIndexStr !== "") {
                    const dragIndex = parseInt(dragIndexStr, 10);
                    if (dragIndex !== i) {
                      const arr = [...(seccion.medias ?? [])];
                      const [removed] = arr.splice(dragIndex, 1);
                      arr.splice(i, 0, removed);
                      onUpdate(seccion.uid, { medias: arr });
                      setMediaAbierto(false);
                    }
                  }
                }}
                className={styles.mediaThumb}
                style={{ backgroundImage: thumbBg, backgroundColor: m.tipo === "video" && !ytId ? "#1e293b" : undefined, cursor: "grab" }}
                onClick={() => setMediaAbierto(mediaAbierto === i ? false : i)}
              >
                {m.tipo === "video" && !ytId && <Video size={16} style={{ color: "#94a3b8" }} />}
                {mediaAbierto === i
                  ? <span className={styles.mediaThumbOverlay}><X size={16} /></span>
                  : <span className={styles.mediaThumbOverlay} style={{ background: "rgba(0,0,0,0)" }}>
                      {m.tipo === "video" && <Video size={11} style={{ color: "white", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))", position: "absolute", bottom: 4, left: 4 }} />}
                      <span className={styles.mediaThumbDel} onClick={e => { e.stopPropagation(); const arr = [...(seccion.medias ?? [])]; arr.splice(i, 1); onUpdate(seccion.uid, { medias: arr }); setMediaAbierto(false); }}>
                        <X size={10} />
                      </span>
                    </span>
                }
              </button>
            );
          })}
          {(seccion.medias ?? []).length < 5 && (
            <button
              className={`${styles.mediaThumbEmpty} ${mediaAbierto === "new" ? styles.mediaThumbEmptyActive : ""}`}
              onClick={() => setMediaAbierto(mediaAbierto === "new" ? false : "new")}
            >
              <span className={styles.mediaThumbPlus}>+</span>
            </button>
          )}
        </div>
        {mediaAbierto === "new" && (
          <MediaSelector
            value={undefined}
            onChange={m => { if (m) { onUpdate(seccion.uid, { medias: [...(seccion.medias ?? []), m] }); } setMediaAbierto(false); }}
          />
        )}
        {typeof mediaAbierto === "number" && (
          <MediaSelector
            value={seccion.medias?.[mediaAbierto]}
            onChange={m => { if (m) { const arr = [...(seccion.medias ?? [])]; arr[mediaAbierto as number] = m; onUpdate(seccion.uid, { medias: arr }); } setMediaAbierto(false); }}
          />
        )}
      </div>
      <div className={styles.editorSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0px" }}>
          <label className={styles.editorFieldLabel} style={{ margin: 0 }}>Título</label>
          <button
            type="button"
            className={`${styles.aiAssistBtn} ${optimizandoIA === "titulo" ? styles.aiAssistBtnLoading : ""}`}
            onClick={() => mejorarConIA("titulo")}
            disabled={optimizandoIA !== null || !(seccion.titulo?.trim())}
            title="Optimizar con IA"
          >
            <Sparkles size={10} className={optimizandoIA === "titulo" ? styles.aiSparkleSpin : ""} />
            <span className={styles.aiAssistText}>Generar</span>
          </button>
        </div>
        <HighlightTextarea
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          placeholder="Título de la sección…"
          rows={2}
        />
      </div>
      <div className={styles.editorSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0px" }}>
          <label className={styles.editorFieldLabel} style={{ margin: 0 }}>Texto Libre</label>
          <button
            type="button"
            className={`${styles.aiAssistBtn} ${optimizandoIA === "subtitulo" ? styles.aiAssistBtnLoading : ""}`}
            onClick={() => mejorarConIA("subtitulo")}
            disabled={optimizandoIA !== null || !(seccion.subtitulo?.trim())}
            title="Optimizar con IA"
          >
            <Sparkles size={10} className={optimizandoIA === "subtitulo" ? styles.aiSparkleSpin : ""} />
            <span className={styles.aiAssistText}>Generar</span>
          </button>
        </div>
        <HighlightTextarea
          value={seccion.subtitulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { subtitulo: e.target.value })}
          placeholder="Contenido de la sección…"
          rows={5}
        />
      </div>
    </>
  );
}
