"use client";

import React, { useState, useTransition, useEffect } from "react";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, NegoPlanetOverride } from "../../types";
import { obtenerArbolDestinosNegoPlanet } from "@/actions/negoplanet";
import MediaSelector from "./MediaSelector";

interface NodoArbol {
  post_name: string;
  post_title: string;
  imagen?: string;
  oculto?: boolean;
  totalDestinos?: number;
  subcategorias?: NodoArbol[];
  destinos?: NodoArbol[];
  destinosDirectos?: NodoArbol[];
}

export default function EditorNegoPlanetDestinos({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [arbol, setArbol] = useState<NodoArbol[]>([]);
  const [cargando, startCarga] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [mediaAbierto, setMediaAbierto] = useState<string | null>(null);

  const overrides = seccion.negoPlanetOverrides ?? {};

  const cargar = () => {
    setError(null);
    startCarga(async () => {
      const res = await obtenerArbolDestinosNegoPlanet(overrides);
      if (!res.ok) {
        setError(res.error || "Error al consultar NegoPlanet");
        setArbol([]);
        return;
      }
      setArbol(res.data as any);
    });
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setOverride = (slug: string, patch: Partial<NegoPlanetOverride>) => {
    const actual = overrides[slug] ?? {};
    const nuevo = { ...actual, ...patch };
    onUpdate(seccion.uid, { negoPlanetOverrides: { ...overrides, [slug]: nuevo } });
  };

  const toggleOculto = (slug: string, ocultoActual: boolean | undefined) => {
    setOverride(slug, { oculto: !ocultoActual });
  };

  const setImagen = (slug: string, url: string | undefined) => {
    setOverride(slug, { imagen: url });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <input
          type="text"
          placeholder="Ej. Nuestros destinos"
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Categorías de destinos</label>
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "0 0 8px 0" }}>
          Estructura consultada en vivo desde NegoPlanet (continente → región → destino). Oculta lo que no quieras mostrar y personaliza las imágenes.
        </p>

        {cargando && <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Cargando árbol de destinos…</p>}
        {error && <p style={{ fontSize: "0.75rem", color: "#dc2626", margin: 0 }}>{error}</p>}

        {!cargando && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {arbol.map(cat => {
              const catOverride = overrides[cat.post_name];
              const catOculto = catOverride?.oculto ?? false;
              const catImagen = catOverride?.imagen ?? cat.imagen;
              const catAbierta = abierto === cat.post_name;
              const hijos = [...(cat.subcategorias ?? []), ...(cat.destinosDirectos ?? [])];

              return (
                <NodoEditor
                  key={cat.post_name}
                  nivel={0}
                  nodo={{ post_name: cat.post_name, post_title: cat.post_title, subtitulo: `${cat.totalDestinos ?? 0} destinos` }}
                  imagen={catImagen}
                  oculto={catOculto}
                  abierto={catAbierta}
                  onToggleAbierto={() => setAbierto(catAbierta ? null : cat.post_name)}
                  onToggleOculto={() => toggleOculto(cat.post_name, catOculto)}
                  mediaKey={`cat-${cat.post_name}`}
                  mediaAbierto={mediaAbierto}
                  setMediaAbierto={setMediaAbierto}
                  onSetImagen={url => setImagen(cat.post_name, url)}
                >
                  {catAbierta && hijos.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "6px 0 6px 16px", borderLeft: "2px solid #e2e8f0", marginLeft: "10px" }}>
                      {(cat.subcategorias ?? []).map(sub => {
                        const subOverride = overrides[sub.post_name];
                        const subOculto = subOverride?.oculto ?? false;
                        const subImagen = subOverride?.imagen ?? sub.imagen;
                        const subAbierta = abierto === sub.post_name;
                        return (
                          <NodoEditor
                            key={sub.post_name}
                            nivel={1}
                            nodo={{ post_name: sub.post_name, post_title: sub.post_title, subtitulo: `${(sub.destinos ?? []).length} destinos` }}
                            imagen={subImagen}
                            oculto={subOculto}
                            abierto={subAbierta}
                            onToggleAbierto={() => setAbierto(subAbierta ? null : sub.post_name)}
                            onToggleOculto={() => toggleOculto(sub.post_name, subOculto)}
                            mediaKey={`sub-${sub.post_name}`}
                            mediaAbierto={mediaAbierto}
                            setMediaAbierto={setMediaAbierto}
                            onSetImagen={url => setImagen(sub.post_name, url)}
                          >
                            {subAbierta && (sub.destinos ?? []).length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "6px 0 6px 16px", borderLeft: "2px solid #e2e8f0", marginLeft: "10px" }}>
                                {(sub.destinos ?? []).map(d => {
                                  const dOverride = overrides[d.post_name];
                                  const dOculto = dOverride?.oculto ?? false;
                                  const dImagen = dOverride?.imagen ?? d.imagen;
                                  return (
                                    <NodoEditor
                                      key={d.post_name}
                                      nivel={2}
                                      nodo={{ post_name: d.post_name, post_title: d.post_title }}
                                      imagen={dImagen}
                                      oculto={dOculto}
                                      abierto={false}
                                      onToggleAbierto={() => {}}
                                      onToggleOculto={() => toggleOculto(d.post_name, dOculto)}
                                      mediaKey={`dest-${d.post_name}`}
                                      mediaAbierto={mediaAbierto}
                                      setMediaAbierto={setMediaAbierto}
                                      onSetImagen={url => setImagen(d.post_name, url)}
                                      expandible={false}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </NodoEditor>
                        );
                      })}

                      {(cat.destinosDirectos ?? []).map(d => {
                        const dOverride = overrides[d.post_name];
                        const dOculto = dOverride?.oculto ?? false;
                        const dImagen = dOverride?.imagen ?? d.imagen;
                        return (
                          <NodoEditor
                            key={d.post_name}
                            nivel={1}
                            nodo={{ post_name: d.post_name, post_title: d.post_title }}
                            imagen={dImagen}
                            oculto={dOculto}
                            abierto={false}
                            onToggleAbierto={() => {}}
                            onToggleOculto={() => toggleOculto(d.post_name, dOculto)}
                            mediaKey={`dest-${d.post_name}`}
                            mediaAbierto={mediaAbierto}
                            setMediaAbierto={setMediaAbierto}
                            onSetImagen={url => setImagen(d.post_name, url)}
                            expandible={false}
                          />
                        );
                      })}
                    </div>
                  )}
                </NodoEditor>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NodoEditor({
  nivel,
  nodo,
  imagen,
  oculto,
  abierto,
  onToggleAbierto,
  onToggleOculto,
  mediaKey,
  mediaAbierto,
  setMediaAbierto,
  onSetImagen,
  expandible = true,
  children,
}: {
  nivel: number;
  nodo: { post_name: string; post_title: string; subtitulo?: string };
  imagen?: string;
  oculto: boolean;
  abierto: boolean;
  onToggleAbierto: () => void;
  onToggleOculto: () => void;
  mediaKey: string;
  mediaAbierto: string | null;
  setMediaAbierto: (v: string | null) => void;
  onSetImagen: (url: string | undefined) => void;
  expandible?: boolean;
  children?: React.ReactNode;
}) {
  const mediaPickerAbierto = mediaAbierto === mediaKey;

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", background: nivel === 0 ? "#ffffff" : "#f8fafc", opacity: oculto ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px" }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: "0.35rem", flexShrink: 0, cursor: "pointer",
            backgroundImage: imagen ? `url(${imagen})` : undefined,
            backgroundColor: imagen ? undefined : "#e2e8f0",
            backgroundSize: "cover", backgroundPosition: "center",
            border: "1px solid #cbd5e1",
          }}
          onClick={() => setMediaAbierto(mediaPickerAbierto ? null : mediaKey)}
          title="Cambiar imagen"
        />

        <button
          type="button"
          onClick={expandible ? onToggleAbierto : undefined}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: expandible ? "pointer" : "default", textAlign: "left", padding: 0 }}
        >
          <span>
            <span style={{ fontSize: nivel === 0 ? "0.85rem" : "0.8rem", fontWeight: nivel === 0 ? 700 : 600, color: "#1e293b" }}>{nodo.post_title}</span>
            {nodo.subtitulo && <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: "6px" }}>{nodo.subtitulo}</span>}
          </span>
          {expandible && <ChevronRight size={14} style={{ transform: abierto ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "#94a3b8" }} />}
        </button>

        <button
          type="button"
          onClick={onToggleOculto}
          title={oculto ? "Mostrar" : "Ocultar"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", color: oculto ? "#cbd5e1" : "#475569" }}
        >
          {oculto ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>

      {mediaPickerAbierto && (
        <div style={{ padding: "0 10px 10px 10px" }}>
          <MediaSelector
            value={imagen ? { tipo: "link", url: imagen } : undefined}
            onChange={m => { onSetImagen(m?.url); setMediaAbierto(null); }}
          />
        </div>
      )}

      {children}
    </div>
  );
}
