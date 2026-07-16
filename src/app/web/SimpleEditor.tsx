"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import styles from "../propuestas/nueva/page.module.css";
import { RichContentEditor } from "./RichContentEditor";
import { guardarPaginaWebSimple } from "@/actions/paginaWeb";

export function SimpleEditor({
  paginaId,
  paginaTitulo,
  paginaSlug,
  initialContenido,
}: {
  paginaId: string;
  paginaTitulo?: string;
  paginaSlug?: string;
  initialContenido?: string;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(paginaTitulo ?? "");
  const [slug, setSlug] = useState(paginaSlug ?? "");
  const [contenido, setContenido] = useState(initialContenido ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const guardar = useCallback(async () => {
    setGuardando(true);
    setGuardadoOk(false);
    try {
      const result = await guardarPaginaWebSimple({ id: paginaId, titulo: titulo || "Sin título", contenido, slug });
      if (!result.ok) throw new Error(result.error);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    } catch (e) {
      console.error("Error guardando página:", e);
    } finally {
      setGuardando(false);
    }
  }, [paginaId, titulo, contenido, slug]);

  return (
    <div className={styles.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => router.push("/web")}
            title="Volver a Páginas"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", color: "#64748b" }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className={styles.title} style={{ margin: 0 }}>{titulo || "Página web"}</h1>
        </div>
        <button
          type="button"
          className={`${styles.saveBtn} ${guardadoOk ? styles.saveBtnOk : ""}`}
          onClick={guardar}
          disabled={guardando}
          title="Guardar página"
        >
          {guardando ? <span className={styles.saveBtnSpinner} /> : guardadoOk ? <span>✓ Guardado</span> : <span>Guardar</span>}
        </button>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <input
          type="text"
          placeholder="Título de la página..."
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          style={{ width: "100%", border: "none", outline: "none", fontSize: "2rem", fontWeight: 800, color: "#1e293b", padding: 0, background: "transparent" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#94a3b8" }}>
          <span style={{ fontFamily: "monospace" }}>/web/o/</span>
          <input
            type="text"
            placeholder="slug-de-la-pagina"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: "0.375rem", padding: "0.3rem 0.5rem", fontSize: "0.8rem", fontFamily: "monospace", color: "#475569", background: "#f8fafc" }}
          />
        </div>
        <RichContentEditor value={contenido} onChange={setContenido} />
      </div>
    </div>
  );
}
