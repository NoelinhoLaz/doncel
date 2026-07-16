"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical, Eye, EyeOff, Trash2, ChevronRight, Heart, ExternalLink, ArrowLeft,
} from "lucide-react";
import styles from "../propuestas/nueva/page.module.css";
import type { Seccion, SeccionFavorita, Dispositivo } from "../propuestas/nueva/types";
import { DISPOSITIVOS, OPCIONES_SECCION, FUENTES, TAMANIOS, GROSORES } from "../propuestas/nueva/constants";
import { useFavoritos } from "../propuestas/nueva/hooks/useFavoritos";
import { EditorPanel } from "../propuestas/nueva/components/Editor/EditorPanel";
import { renderSeccion } from "../propuestas/nueva/utils/section-render";
import { getStyleVars } from "../propuestas/nueva/utils/style-utils";
import { guardarPaginaWeb, getPaginasWebPorFormato } from "@/actions/paginaWeb";

export function WebEditor({
  paginaId,
  paginaTitulo,
  initialSecciones,
  initialEstilosGlobales,
  initialAgente,
}: {
  paginaId: string;
  paginaTitulo?: string;
  initialSecciones?: Seccion[];
  initialEstilosGlobales?: any;
  initialAgente?: any;
}) {
  const router = useRouter();
  const [secciones, setSecciones] = useState<Seccion[]>(initialSecciones ?? []);
  const [agente, setAgente] = useState<any>(initialAgente ?? null);
  const [listadoItemsPorSeccion, setListadoItemsPorSeccion] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const listadoSecciones = secciones.filter(s => s.tipo === "ofertas" && s.listadoFormatoId);
    listadoSecciones.forEach(s => {
      getPaginasWebPorFormato(s.listadoFormatoId as string).then(items => {
        setListadoItemsPorSeccion(prev => ({ ...prev, [s.uid]: items }));
      });
    });
  }, [secciones.map(s => `${s.uid}:${s.listadoFormatoId}`).join(",")]);

  useEffect(() => {
    if (!agente) {
      import("@/actions/usuarios").then(({ getCurrentUsuario }) => {
        getCurrentUsuario().then(res => {
          if (res) setAgente(res);
        });
      });
    }
  }, [agente]);
  const [dispositivo, setDispositivo] = useState<Dispositivo>("desktop");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [editorUid, setEditorUid] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [activeTab, setActiveTab] = useState<"contenido" | "diseño">("contenido");
  const [estilosGlobales, setEstilosGlobales] = useState<any>(initialEstilosGlobales ?? {
    titulo: { fuente: "Raleway", grosor: "800", tamano: "32px", color: "#1e293b", colorDestacado: "#6366f1" },
    subtitulo: { fuente: "Montserrat", grosor: "400", tamano: "16px", color: "#64748b", colorDestacado: "#6366f1" },
    parrafo: { fuente: "Montserrat", grosor: "400", tamano: "14px", color: "#334155", colorDestacado: "#6366f1" },
  });
  const { favs, toggleFav, isFav } = useFavoritos();

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).momoGlobalStyles = estilosGlobales;
    }
  }, [estilosGlobales]);

  const guardar = useCallback(async () => {
    setGuardando(true);
    setGuardadoOk(false);

    localStorage.setItem("momo_preview_estilos_globales", JSON.stringify(estilosGlobales));

    const editorContent = secciones.map(s => ({
      uid: s.uid, tipo: s.tipo, label: s.label, oculta: s.oculta,
      titulo: s.titulo, subtitulo: s.subtitulo, medias: s.medias,
      fechaDesde: s.fechaDesde,
      fechaHasta: s.fechaHasta,
      dias: s.dias,
      columnas: s.columnas,
      mapas: s.mapas,
      rutas: s.rutas,
      menuLogo: s.menuLogo,
      menuItems: s.menuItems,
      menuBoton: s.menuBoton,
      pvp: s.pvp,
      condiciones: s.condiciones,
      formularioCampos: s.formularioCampos,
      formularioEmail: s.formularioEmail,
      formularioBoton: s.formularioBoton,
      personas: s.personas,
      listadoFormatoId: s.listadoFormatoId,
    }));
    const designTokens = [
      { uid: "global", estilosGlobales },
      ...secciones.map(s => ({
        uid: s.uid, layout: s.layout,
        estiloTitulo: s.estiloTitulo, estiloSubtitulo: s.estiloSubtitulo,
        estiloTituloDia: s.estiloTituloDia, estiloDescDia: s.estiloDescDia,
        colorFondo: s.colorFondo,
        anchoMax: s.anchoMax,
        menuColorFondo: s.menuColorFondo,
        menuColorTexto: s.menuColorTexto,
        menuColorBoton: s.menuColorBoton,
        menuFijo: s.menuFijo,
        estiloPvp: s.estiloPvp,
        estiloCondiciones: s.estiloCondiciones,
        listadoEstiloTarjeta: s.listadoEstiloTarjeta,
        equipoEstiloTarjeta: s.equipoEstiloTarjeta,
      }))
    ];

    const portada = secciones.find(s => s.tipo === "portada");

    try {
      const result = await guardarPaginaWeb({ id: paginaId, titulo: portada?.titulo, editorContent, designTokens });
      if (!result.ok) throw new Error(result.error);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    } catch (e) {
      console.error("Error guardando página web:", e);
    } finally {
      setGuardando(false);
    }
  }, [secciones, estilosGlobales, paginaId]);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleOcultar = (uid: string) => {
    setSecciones(prev => prev.map(s => s.uid === uid ? { ...s, oculta: !s.oculta } : s));
  };

  const borrarSeccion = (uid: string) => {
    setSecciones(prev => prev.filter(s => s.uid !== uid));
    setConfirmarBorrar(null);
    if (editorUid === uid) setEditorUid(null);
  };

  const renombrarSeccion = (uid: string, label: string) => {
    setSecciones(prev => prev.map(s => s.uid === uid ? { ...s, label } : s));
  };

  const actualizarSeccion = (uid: string, patch: Partial<Seccion>) => {
    setSecciones(prev => prev.map(s => s.uid === uid ? { ...s, ...patch } : s));
  };

  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const seccionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToSeccion = (uid: string) => {
    const el = seccionRefs.current[uid];
    const container = canvasContentRef.current;
    if (!el || !container) return;
    container.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  };

  const añadirSeccion = (tipo: string, label: string) => {
    const base: Seccion = { uid: `${tipo}-${Date.now()}`, tipo, label };
    if (tipo === "portada") {
      base.estiloTitulo    = { fuente: "Raleway",    grosor: "400", tamano: "40px", color: "#ffffff", grosorDestacado: "700" };
      base.estiloSubtitulo = { fuente: "Montserrat", grosor: "300", color: "#ffffff", grosorDestacado: "700" };
      base.layout = "slide";
    }
    if (tipo === "itinerario") {
      base.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
      base.estiloTituloDia = { fuente: "Raleway", grosor: "700", tamano: "18px", color: "#1e293b" };
      base.estiloDescDia = { fuente: "Montserrat", grosor: "400", tamano: "13px", color: "#64748b" };
    }
    if (tipo === "texto-columnas") {
      base.layout = "3-cols";
      base.anchoMax = "1200px";
      base.titulo = "Nuestros Servicios / Destacados";
      base.columnas = [
        { titulo: "Aventura", texto: ".- Actividades al aire libre.\n.- Senderismo por rutas únicas.\n.- Guías profesionales." },
        { titulo: "Gastronomía", texto: ".- Platos tradicionales locales.\n.- Catas de vinos exclusivas.\n.- Cenas bajo las estrellas." },
        { titulo: "Cultura", texto: ".- Visitas guiadas a monumentos.\n.- Talleres de artesanía local.\n.- Festivales tradicionales." },
        { titulo: "Relax", texto: ".- Alojamientos con encanto.\n.- Zonas de spa y bienestar.\n.- Tiempo libre para desconectar." }
      ];
      base.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
    }
    if (tipo === "precio") {
      base.layout = "destacado-grande";
      base.pvp = "1.600 € / persona";
      base.condiciones = "- Pago del 30% al confirmar la reserva.\n- Pago del 70% restante 30 días antes de la salida.";
      base.estiloPvp = { fuente: "Raleway", grosor: "800", tamano: "48px", color: "#1e293b" };
      base.estiloCondiciones = { fuente: "Montserrat", grosor: "400", tamano: "14px", color: "#475569" };
    }
    if (tipo === "formulario") {
      base.layout = "solo-form";
      base.formularioEmail = agente?.email || "";
      base.formularioBoton = "Enviar";
      base.formularioCampos = [
        { uid: "nombre", key: "nombre", label: "Nombre", lineas: 1, activo: true },
        { uid: "email", key: "email", label: "Email", lineas: 1, activo: true },
        { uid: "observaciones", key: "observaciones", label: "Observaciones", lineas: 10, activo: true }
      ];
    }
    if (tipo === "equipo") {
      base.layout = "3-cols";
      base.anchoMax = "1200px";
      base.titulo = "Nuestro equipo";
      base.personas = [];
      base.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
    }
    if (tipo === "ofertas") {
      base.layout = "3-cols";
      base.anchoMax = "1200px";
      base.titulo = "Nuestras ofertas";
      base.listadoFormatoId = null;
      base.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
    }
    setSecciones(prev => [...prev, base]);
    setMenuAbierto(false);
  };

  const añadirDesdeFav = (fav: SeccionFavorita) => {
    const clon: Seccion = JSON.parse(JSON.stringify(fav));
    clon.uid = `${clon.tipo}-${Date.now()}`;
    setSecciones(prev => [...prev, clon]);
    setMenuAbierto(false);
  };

  const onDragStart = (i: number) => { dragIndex.current = i; };
  const onDragEnter = (i: number) => { dragOverIndex.current = i; };
  const onDragEnd = () => {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) return;
    setSecciones(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragIndex.current = null;
    dragOverIndex.current = null;
  };

  useEffect(() => {
    if (!menuAbierto) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuAbierto]);

  const current = DISPOSITIVOS.find(d => d.id === dispositivo)!;
  const editorSeccion = secciones.find(s => s.uid === editorUid) ?? null;

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
        <h1 className={styles.title} style={{ margin: 0 }}>{paginaTitulo || "Página web"}</h1>
      </div>

      <div className={styles.columns}>
        {/* Columna izquierda */}
        <div className={styles.sidebar}>
          <div className={styles.sectionesPanel}>

            {confirmarBorrar && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.92)", zIndex: 20, borderRadius: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setConfirmarBorrar(null)}>
                <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
                  <p className={styles.modalText}>¿Eliminar esta sección?</p>
                  <p className={styles.modalSub}>Esta acción no se puede deshacer.</p>
                  <div className={styles.modalActions}>
                    <button className={styles.modalCancel} onClick={() => setConfirmarBorrar(null)}>Cancelar</button>
                    <button className={styles.modalConfirm} onClick={() => borrarSeccion(confirmarBorrar)}>Eliminar</button>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.panelSlider}>

              <div className={`${styles.panelView} ${editorSeccion ? styles.panelViewHidden : ""}`}>
                <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: "1rem" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("contenido")}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      border: "none",
                      background: "none",
                      borderBottom: activeTab === "contenido" ? "2px solid #1e293b" : "2px solid transparent",
                      color: activeTab === "contenido" ? "#1e293b" : "#94a3b8",
                      cursor: "pointer",
                      textAlign: "center"
                    }}
                  >
                    Contenido
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("diseño")}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      border: "none",
                      background: "none",
                      borderBottom: activeTab === "diseño" ? "2px solid #1e293b" : "2px solid transparent",
                      color: activeTab === "diseño" ? "#1e293b" : "#94a3b8",
                      cursor: "pointer",
                      textAlign: "center"
                    }}
                  >
                    Diseño
                  </button>
                </div>

                {activeTab === "contenido" ? (
                  <ul className={styles.seccionesList}>
                    {secciones.map((s, i) => (
                      <li
                        key={s.uid}
                        className={`${styles.seccionItem} ${s.oculta ? styles.seccionOculta : ""}`}
                        draggable
                        onDragStart={() => onDragStart(i)}
                        onDragEnter={() => onDragEnter(i)}
                        onDragEnd={onDragEnd}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => scrollToSeccion(s.uid)}
                      >
                        <GripVertical size={13} className={styles.gripIcon} />
                        <span className={styles.seccionLabel}>{s.label}</span>
                        <div className={styles.seccionActions}>
                          <button
                            className={styles.seccionActionBtn}
                            title={s.oculta ? "Mostrar" : "Ocultar"}
                            onClick={e => { e.stopPropagation(); toggleOcultar(s.uid); }}
                          >
                            {s.oculta ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            className={`${styles.seccionActionBtn} ${styles.seccionActionBtnDelete}`}
                            title="Eliminar"
                            onClick={e => { e.stopPropagation(); setConfirmarBorrar(s.uid); }}
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            className={styles.seccionActionBtn}
                            title="Editar"
                            onClick={e => { e.stopPropagation(); setEditorUid(s.uid); }}
                          >
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </li>
                    ))}
                    <li style={{ listStyle: "none", marginTop: "0.25rem" }}>
                      <div className={styles.addWrapper} ref={menuRef}>
                        <button className={styles.addButton} onClick={() => setMenuAbierto(v => !v)}>
                          + Añadir sección
                        </button>
                        {menuAbierto && (
                          <div className={styles.seccionMenu}>
                            <p className={styles.menuLabel}>Selecciona un tipo</p>
                            {OPCIONES_SECCION.map(({ id, label, Icon }) => (
                              <button key={id} className={styles.menuItem} onClick={() => añadirSeccion(id, label)}>
                                <Icon size={15} className={styles.menuItemIcon} />
                                {label}
                              </button>
                            ))}
                            {favs.length > 0 && (
                              <>
                                <p className={styles.menuLabel} style={{ marginTop: "0.5rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" }}>
                                  <Heart size={11} fill="#f472b6" color="#f472b6" style={{ verticalAlign: "middle", marginRight: 4 }} />
                                  Favoritas
                                </p>
                                {favs.map(fav => (
                                  <button key={fav.favId} className={styles.menuItem} onClick={() => añadirDesdeFav(fav)}>
                                    <Heart size={13} fill="#f472b6" color="#f472b6" className={styles.menuItemIcon} />
                                    {fav.label}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  </ul>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "calc(100vh - 200px)", overflowY: "auto", paddingRight: "4px" }}>
                    {[
                      { key: "titulo", label: "Título" },
                      { key: "subtitulo", label: "Subtítulo" },
                      { key: "parrafo", label: "Párrafo" }
                    ].map(({ key, label }) => {
                      const item = estilosGlobales[key] || {};
                      const updateField = (field: string, val: string) => {
                        setEstilosGlobales((prev: any) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            [field]: val
                          }
                        }));
                      };
                      return (
                        <div key={key} style={{ padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>

                          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr", gap: "0.35rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <label style={{ fontSize: "0.68rem", fontWeight: 500, color: "#64748b" }}>Tipografía</label>
                              <select
                                value={item.fuente ?? "Raleway"}
                                onChange={e => updateField("fuente", e.target.value)}
                                style={{ width: "100%", padding: "0.05rem 0.25rem", fontSize: "0.72rem", lineHeight: 1, border: "1px solid #cbd5e1", borderRadius: "0.375rem", background: "#ffffff" }}
                              >
                                {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <label style={{ fontSize: "0.68rem", fontWeight: 500, color: "#64748b" }}>Tamaño</label>
                              <select
                                value={item.tamano ?? "16px"}
                                onChange={e => updateField("tamano", e.target.value)}
                                style={{ width: "100%", padding: "0.05rem 0.25rem", fontSize: "0.72rem", lineHeight: 1, border: "1px solid #cbd5e1", borderRadius: "0.375rem", background: "#ffffff" }}
                              >
                                {TAMANIOS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <label style={{ fontSize: "0.68rem", fontWeight: 500, color: "#64748b" }}>Grosor</label>
                              <select
                                value={item.grosor ?? "400"}
                                onChange={e => updateField("grosor", e.target.value)}
                                style={{ width: "100%", padding: "0.05rem 0.25rem", fontSize: "0.72rem", lineHeight: 1, border: "1px solid #cbd5e1", borderRadius: "0.375rem", background: "#ffffff" }}
                              >
                                {GROSORES.map(g => (
                                  <option key={g} value={g}>
                                    {g === "300" ? "L" : g === "400" ? "R" : g === "500" ? "M" : g === "600" ? "SB" : g === "700" ? "B" : "EB"}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginTop: "4px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <label style={{ fontSize: "0.68rem", fontWeight: 500, color: "#64748b" }}>Color texto</label>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <label className={styles.colorPickerBtn} style={{ background: item.color ?? "#1e293b", width: 22, height: 22, borderRadius: "0.375rem" }}>
                                  <input type="color" value={item.color ?? "#1e293b"} onChange={e => updateField("color", e.target.value)} />
                                </label>
                                <span style={{ fontSize: "0.65rem", color: "#94a3b8", fontFamily: "monospace" }}>{item.color ?? "#1e293b"}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <label style={{ fontSize: "0.68rem", fontWeight: 500, color: "#64748b" }}>Color dest.</label>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <label className={styles.colorPickerBtn} style={{ background: item.colorDestacado ?? "#6366f1", width: 22, height: 22, borderRadius: "0.375rem" }}>
                                  <input type="color" value={item.colorDestacado ?? "#6366f1"} onChange={e => updateField("colorDestacado", e.target.value)} />
                                </label>
                                <span style={{ fontSize: "0.65rem", color: "#94a3b8", fontFamily: "monospace" }}>{item.colorDestacado ?? "#6366f1"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setEstilosGlobales({
                          titulo: { fuente: "Raleway", grosor: "800", tamano: "32px", color: "#1e293b", colorDestacado: "#6366f1" },
                          subtitulo: { fuente: "Montserrat", grosor: "400", tamano: "16px", color: "#64748b", colorDestacado: "#6366f1" },
                          parrafo: { fuente: "Montserrat", grosor: "400", tamano: "14px", color: "#334155", colorDestacado: "#6366f1" },
                        });
                      }}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: "0.375rem",
                        background: "#ffffff",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#64748b",
                        cursor: "pointer",
                        marginTop: "0.5rem",
                        textAlign: "center"
                      }}
                    >
                      Restablecer Estilos
                    </button>
                  </div>
                )}
              </div>

              <div className={`${styles.panelView} ${styles.panelViewEditor} ${editorSeccion ? styles.panelViewEditorOpen : ""}`}>
                {editorSeccion && (
                  <EditorPanel
                    seccion={editorSeccion}
                    onClose={() => setEditorUid(null)}
                    onRename={renombrarSeccion}
                    onUpdate={actualizarSeccion}
                    isFav={isFav(editorSeccion.uid)}
                    onToggleFav={() => toggleFav(editorSeccion)}
                    todasSecciones={secciones}
                    cotizacionId={null}
                    propuestaId={null}
                  />
                )}
              </div>

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
              className={styles.previewBtn}
              title="Previsualizar en nueva pestaña"
              onClick={() => {
                localStorage.setItem("momo_preview_secciones", JSON.stringify(secciones));
                localStorage.setItem("momo_preview_estilos_globales", JSON.stringify(estilosGlobales));
                window.open(`/web/preview`, "_blank");
              }}
            >
              <ExternalLink size={15} />
              <span>Previsualizar</span>
            </button>
            <div className={styles.deviceBarSep} />
            <button
              className={`${styles.saveBtn} ${guardadoOk ? styles.saveBtnOk : ""}`}
              onClick={guardar}
              disabled={guardando || secciones.length === 0}
              title="Guardar página web"
            >
              {guardando ? <span className={styles.saveBtnSpinner} /> : guardadoOk ? <span>✓ Guardado</span> : <span>Guardar</span>}
            </button>
          </div>

          <div className={styles.canvasWrapper}>
            <div
              className={`${styles.canvas} ${dispositivo === "tablet" ? styles.canvasTablet : ""} ${dispositivo === "mobile" ? styles.canvasMobile : ""}`}
              style={{ width: current.width, height: current.height, ...getStyleVars(estilosGlobales) }}
            >
              {secciones.length === 0 ? (
                <p className={styles.emptyHint}>Añade una sección para empezar a construir tu página web.</p>
              ) : (() => {
                const seccionesVisibles = secciones.filter(s => !s.oculta);
                const menuFijo = seccionesVisibles.find(s => s.tipo === "menu" && s.menuFijo);
                return (
                  <>
                    {menuFijo && (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}>
                        {renderSeccion(menuFijo, current.height, dispositivo, secciones, agente, listadoItemsPorSeccion)}
                      </div>
                    )}
                    <div className={styles.canvasContent} ref={canvasContentRef}>
                      {seccionesVisibles.map(s => (
                        <div key={s.uid} ref={el => { seccionRefs.current[s.uid] = el; }}
                          style={s.tipo === "menu" && s.menuFijo ? { visibility: "hidden" } : undefined}>
                          {renderSeccion(s, current.height, dispositivo, secciones, agente, listadoItemsPorSeccion)}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
