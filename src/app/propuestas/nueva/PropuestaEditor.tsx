"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  GripVertical, Eye, EyeOff, Trash2, ChevronRight, Heart, ExternalLink,
} from "lucide-react";
import styles from "./page.module.css";
import type { Seccion, SeccionFavorita, Dispositivo } from "./types";
import { DISPOSITIVOS, OPCIONES_SECCION } from "./constants";
import { useFavoritos } from "./hooks/useFavoritos";
import { EditorPanel } from "./components/Editor/EditorPanel";
import { renderSeccion } from "./utils/section-render";
import { guardarPropuesta, getDatosRealesPropuesta } from "@/actions/propuestas";
import { buscarEntidades } from "@/actions/entidades";
import ExpedienteActionsToolbar from "@/app/components/ExpedienteActionsToolbar";

export function PropuestaEditor({
  initialPropuestaId,
  initialSecciones,
  initialCotizacionId,
  initialContactoId,
  initialContactoNombre,
}: {
  initialPropuestaId?: string;
  initialSecciones?: Seccion[];
  initialCotizacionId?: string | null;
  initialContactoId?: string | null;
  initialContactoNombre?: string | null;
} = {}) {
  const [secciones, setSecciones] = useState<Seccion[]>(initialSecciones ?? []);
  const [dispositivo, setDispositivo] = useState<Dispositivo>("desktop");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [editorUid, setEditorUid] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [propuestaId, setPropuestaId] = useState<string | null>(initialPropuestaId ?? null);
  const [cotizacionId] = useState<string | null>(initialCotizacionId ?? null);
  const [contactoId, setContactoId] = useState<string | null>(initialContactoId ?? null);
  const [contactoNombre, setContactoNombre] = useState<string | null>(initialContactoNombre ?? null);
  const [contactos, setContactos] = useState<{ id: string; nombre: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { favs, toggleFav, isFav } = useFavoritos();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setContactos([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setBuscando(true);
      try {
        const results = await buscarEntidades(searchQuery);
        setContactos(results.map((r: any) => ({ id: r.id, nombre: r.nombre || "Sin nombre" })));
      } catch (err) {
        console.error("Error buscando contactos:", err);
      } finally {
        setBuscando(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    async function updateRealVariables() {
      try {
        const res = await getDatosRealesPropuesta({
          propuestaId: propuestaId || undefined,
          cotizacionId: cotizacionId || undefined,
          contactoId: contactoId || undefined,
        });
        if (res.ok && res.data) {
          const { VARIABLES_PROPUESTA } = await import("./utils/text-formatting");
          Object.assign(VARIABLES_PROPUESTA, res.data);
          // Force visual re-render of canvas preview
          setSecciones(prev => [...prev]);
        }
      } catch (e) {
        console.error("Error updating real variables:", e);
      }
    }
    updateRealVariables();
  }, [contactoId, cotizacionId, propuestaId]);

  const guardar = useCallback(async () => {
    setGuardando(true);
    setGuardadoOk(false);

    const editorContent = secciones.map(s => ({
      uid: s.uid, tipo: s.tipo, label: s.label, oculta: s.oculta,
      titulo: s.titulo, subtitulo: s.subtitulo, medias: s.medias,
      fechaDesde: s.fechaDesde,
      fechaHasta: s.fechaHasta,
      dias: s.dias,
      columnas: s.columnas,
      mapas: s.mapas,
      rutas: s.rutas,
      // Campos de sección menú
      menuLogo: s.menuLogo,
      menuItems: s.menuItems,
      menuBoton: s.menuBoton,
    }));
    const designTokens = secciones.map(s => ({
      uid: s.uid, layout: s.layout,
      estiloTitulo: s.estiloTitulo, estiloSubtitulo: s.estiloSubtitulo,
      estiloTituloDia: s.estiloTituloDia, estiloDescDia: s.estiloDescDia,
      colorFondo: s.colorFondo,
      anchoMax: s.anchoMax,
      // Diseño del menú
      menuColorFondo: s.menuColorFondo,
      menuColorTexto: s.menuColorTexto,
      menuColorBoton: s.menuColorBoton,
      menuFijo: s.menuFijo,
    }));

    try {
      const result = await guardarPropuesta({
        propuestaId: propuestaId ?? undefined,
        editorContent,
        designTokens,
        cotizacionId: propuestaId ? undefined : (cotizacionId ?? undefined),
        contactoId: contactoId,
      });
      if (!result.ok) throw new Error(result.error);
      if (!propuestaId && result.id) setPropuestaId(result.id);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    } catch (e) {
      console.error("Error guardando propuesta:", e);
    } finally {
      setGuardando(false);
    }
  }, [secciones, propuestaId, contactoId]);
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
      base.estiloTitulo    = { fuente: "Raleway",    grosor: "400", tamano: "40px", color: "#ffffff", colorDestacado: "#ffffff", grosorDestacado: "700" };
      base.estiloSubtitulo = { fuente: "Montserrat", grosor: "300", color: "#ffffff", colorDestacado: "#ffffff", grosorDestacado: "700" };
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <h1 className={styles.title} style={{ margin: 0 }}>Creador de propuestas</h1>
        {propuestaId && <ExpedienteActionsToolbar propuestaId={propuestaId} />}
      </div>

      <div className={styles.columns}>
        {/* Columna izquierda */}
        <div className={styles.sidebar}>
          <div className={styles.sectionesPanel}>

            {/* Confirmación eliminar — superpuesto sobre el panel */}
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

            {/* Slider: lista ↔ editor dentro del mismo contenedor */}
            <div className={styles.panelSlider}>

              {/* Vista lista */}
              <div className={`${styles.panelView} ${editorSeccion ? styles.panelViewHidden : ""}`}>
                <div ref={dropdownRef} style={{ marginBottom: "1rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", position: "relative" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.35rem" }}>
                    Contacto Vinculado
                  </label>
                  
                  {(() => {
                    const selectedContactoName = contactoNombre || (contactoId ? contactos.find(c => c.id === contactoId)?.nombre : null);
                    if (selectedContactoName) {
                      return (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.6rem", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.375rem" }}>
                          <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: 500 }}>
                            👤 {selectedContactoName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setContactoId(null);
                              setContactoNombre(null);
                              setSearchQuery("");
                              setShowDropdown(true);
                            }}
                            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}
                          >
                            Cambiar
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div>
                        <input
                          type="text"
                          placeholder="Buscar contacto..."
                          value={searchQuery}
                          onChange={e => {
                            setSearchQuery(e.target.value);
                            setShowDropdown(true);
                          }}
                          onFocus={() => setShowDropdown(true)}
                          style={{
                            width: "100%",
                            padding: "0.4rem 0.6rem",
                            fontSize: "0.85rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            backgroundColor: "#ffffff",
                            color: "#334155",
                            outline: "none",
                            fontFamily: "inherit"
                          }}
                        />
                        
                        {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                            Escribe al menos 3 letras para buscar...
                          </div>
                        )}

                        {showDropdown && searchQuery.trim().length >= 3 && (
                          <div style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            backgroundColor: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                            zIndex: 50,
                            maxHeight: "150px",
                            overflowY: "auto",
                            marginTop: "0.25rem"
                          }}>
                            {buscando ? (
                              <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#94a3b8" }}>Buscando...</div>
                            ) : contactos.length === 0 ? (
                              <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#94a3b8" }}>Sin resultados</div>
                            ) : (
                              contactos.map(c => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setContactoId(c.id);
                                    setContactoNombre(c.nombre);
                                    setShowDropdown(false);
                                  }}
                                  style={{
                                    padding: "0.5rem 0.75rem",
                                    fontSize: "0.8rem",
                                    color: "#334155",
                                    cursor: "pointer",
                                    borderBottom: "1px solid #f1f5f9"
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                                >
                                  {c.nombre}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <span className={styles.sectionesTitle}>SECCIONES</span>
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
              </div>

              {/* Vista editor */}
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
                    cotizacionId={cotizacionId}
                    propuestaId={propuestaId}
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
                window.open(`/propuestas/${propuestaId || "nueva"}/preview`, "_blank");
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
              title="Guardar propuesta"
            >
              {guardando ? <span className={styles.saveBtnSpinner} /> : guardadoOk ? <span>✓ Guardado</span> : <span>Guardar</span>}
            </button>
          </div>

          <div className={styles.canvasWrapper}>
            <div
              className={`${styles.canvas} ${dispositivo === "tablet" ? styles.canvasTablet : ""} ${dispositivo === "mobile" ? styles.canvasMobile : ""}`}
              style={{ width: current.width, height: current.height }}
            >
              {secciones.length === 0 ? (
                <p className={styles.emptyHint}>Añade una sección para empezar a construir tu propuesta.</p>
              ) : (() => {
                const seccionesVisibles = secciones.filter(s => !s.oculta);
                const menuFijo = seccionesVisibles.find(s => s.tipo === "menu" && s.menuFijo);
                return (
                  <>
                    {menuFijo && (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}>
                        {renderSeccion(menuFijo, current.height, dispositivo, secciones)}
                      </div>
                    )}
                    <div className={styles.canvasContent} ref={canvasContentRef}>
                      {seccionesVisibles.map(s => (
                        <div key={s.uid} ref={el => { seccionRefs.current[s.uid] = el; }}
                          style={s.tipo === "menu" && s.menuFijo ? { visibility: "hidden" } : undefined}>
                          {renderSeccion(s, current.height, dispositivo, secciones)}
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

      {/* Modal confirmación borrar */}
    </div>
  );
}
