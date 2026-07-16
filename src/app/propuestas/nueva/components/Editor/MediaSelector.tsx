"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Video, Image } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, MediaItem } from "../../types";

type MediaTab = "unsplash" | "link" | "upload" | "video";
interface UnsplashPhoto { id: string; thumb: string; full: string; alt: string; author: string; authorUrl: string; }

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function MediaSelector({ value, onChange }: { value?: Seccion["media"]; onChange: (m: Seccion["media"]) => void }) {
  const [mediaTab, setMediaTab] = useState<MediaTab>("unsplash");
  const [inputVal, setInputVal] = useState(value?.url ?? "");
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [totalUnsplash, setTotalUnsplash] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const buscar = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(q)}&page=1`);
      const data = await res.json();
      setPhotos(data.results ?? []);
      setTotalUnsplash(data.total ?? 0);
      setPage(1);
    } finally {
      setLoading(false);
    }
  };

  const cargarMas = async () => {
    if (!query.trim()) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(query)}&page=${nextPage}`);
      const data = await res.json();
      setPhotos(prev => [...prev, ...(data.results ?? [])]);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const apply = (tipo: MediaTab, url: string) => {
    if (url) onChange({ tipo, url });
  };

  return (
    <div className={styles.mediaSelector}>
      <div className={styles.mediaTabs}>
        {(["unsplash","link","upload","video"] as MediaTab[]).map(t => (
          <button key={t} className={`${styles.mediaTab} ${mediaTab === t ? styles.mediaTabActive : ""}`} onClick={() => setMediaTab(t)}>
            {t === "unsplash" && "Unsplash"}
            {t === "link"     && "URL"}
            {t === "upload"   && "Subir"}
            {t === "video"    && "Video"}
          </button>
        ))}
      </div>

      {mediaTab === "unsplash" && (
        <div className={styles.mediaUnsplash}>
          <div className={styles.mediaRow}>
            <input
              className={styles.editorInput}
              placeholder="Buscar…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") buscar(query); }}
            />
            <button className={styles.mediaApply} onClick={() => buscar(query)}>Buscar</button>
          </div>
          {loading && <p className={styles.mediaHint}>Buscando…</p>}
          {!loading && (
            <>
              <div className={styles.unsplashGrid}>
                {photos.map(p => (
                  <button
                    key={p.id}
                    className={`${styles.unsplashThumb} ${value?.url === p.full ? styles.unsplashThumbActive : ""}`}
                    onClick={() => apply("unsplash", p.full)}
                    title={p.alt || p.author}
                  >
                    <img src={p.thumb} alt={p.alt} loading="lazy" />
                    <span className={styles.unsplashAuthor}>{p.author}</span>
                  </button>
                ))}
              </div>
              {photos.length > 0 && photos.length < totalUnsplash && (
                <button
                  type="button"
                  onClick={cargarMas}
                  disabled={loadingMore}
                  style={{ width: "100%", marginTop: "0.5rem", padding: "0.45rem", fontSize: "0.78rem", fontWeight: 600, color: "#475569", background: "#f1f5f9", border: "none", borderRadius: "0.375rem", cursor: loadingMore ? "wait" : "pointer" }}
                >
                  {loadingMore ? "Cargando…" : "Mostrar más"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {mediaTab === "video" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className={styles.mediaRow}>
            <input
              className={styles.editorInput}
              placeholder="URL de YouTube o video…"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
            />
            <button className={styles.mediaApply} onClick={() => apply("video", inputVal)}>Aplicar</button>
          </div>
          {youtubeId(inputVal) && (
            <img
              src={`https://img.youtube.com/vi/${youtubeId(inputVal)}/mqdefault.jpg`}
              alt="preview"
              style={{ width: "100%", borderRadius: 6, aspectRatio: "16/9", objectFit: "cover" }}
            />
          )}
        </div>
      )}
      {mediaTab === "link" && (
        <div className={styles.mediaRow}>
          <input
            className={styles.editorInput}
            placeholder="https://…"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
          />
          <button className={styles.mediaApply} onClick={() => apply("link", inputVal)}>Aplicar</button>
        </div>
      )}

      {mediaTab === "upload" && (
        <div className={styles.mediaUpload} onClick={() => !uploading && fileRef.current?.click()}
          style={{ opacity: uploading ? 0.6 : 1, cursor: uploading ? "wait" : "pointer" }}>
          <Image size={20} className={styles.phImagenIcon} />
          <span>{uploading ? "Subiendo…" : "Haz clic para subir"}</span>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                const fd = new FormData();
                fd.append("file", f);
                const res = await fetch("/api/propuestas/upload-image", { method: "POST", body: fd });
                const data = await res.json();
                if (data.url) apply("upload", data.url);
                else console.error("upload error:", data.error);
              } catch (err) {
                console.error("upload failed:", err);
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />
        </div>
      )}

      {value?.url && (
        <div className={styles.mediaPreviewRow}>
          <div className={styles.mediaPreviewThumb} style={{ backgroundImage: `url(${value.url})` }} />
          <button className={styles.mediaRemove} onClick={() => onChange(undefined as any)}>Quitar</button>
        </div>
      )}
    </div>
  );
}
