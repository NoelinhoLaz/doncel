"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  GripVertical, Eye, EyeOff, Trash2, ChevronRight, Heart, ExternalLink, Palette, X, MapPin, Calendar,
} from "lucide-react";
import styles from "./page.module.css";
import type { Seccion, SeccionFavorita, Dispositivo } from "./types";
import { DISPOSITIVOS, OPCIONES_SECCION, FUENTES, TAMANIOS, GROSORES } from "./constants";
import { useFavoritos } from "./hooks/useFavoritos";
import { EditorPanel } from "./components/Editor/EditorPanel";
import TextoColorBoton from "./components/Editor/TextoColorBoton";
import { renderSeccion } from "./utils/section-render";
import { getStyleVars } from "./utils/style-utils";
import { guardarPropuesta, getDatosRealesPropuesta, updatePropuestaMeta, updatePropuestaSlug } from "@/actions/propuestas";
import { buscarEntidades } from "@/actions/entidades";
import { getPaginasWebPorFormato } from "@/actions/paginaWeb";
import ExpedienteActionsToolbar from "@/app/components/ExpedienteActionsToolbar";

export function PropuestaEditor({
  initialPropuestaId,
  initialSecciones,
  initialCotizacionId,
  initialContactoId,
  initialContactoNombre,
  initialTitle,
  initialDestination,
  initialFechaSalida,
  initialFechaRegreso,
  initialSlug,
  initialEstilosGlobales,
  initialAgente,
}: {
  initialPropuestaId?: string;
  initialSecciones?: Seccion[];
  initialCotizacionId?: string | null;
  initialContactoId?: string | null;
  initialContactoNombre?: string | null;
  initialTitle?: string | null;
  initialDestination?: string | null;
  initialFechaSalida?: string | null;
  initialFechaRegreso?: string | null;
  initialSlug?: string | null;
  initialEstilosGlobales?: any;
  initialAgente?: any;
} = {}) {
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
  const [propuestaId, setPropuestaId] = useState<string | null>(initialPropuestaId ?? null);
  const [cotizacionId] = useState<string | null>(initialCotizacionId ?? null);
  const [contactoId, setContactoId] = useState<string | null>(initialContactoId ?? null);
  const [contactoNombre, setContactoNombre] = useState<string | null>(initialContactoNombre ?? null);
  const [title, setTitle] = useState(initialTitle ?? "Nueva propuesta");
  const [destination, setDestination] = useState(initialDestination ?? "");
  const [fechaSalida, setFechaSalida] = useState(initialFechaSalida ?? "");
  const [fechaRegreso, setFechaRegreso] = useState(initialFechaRegreso ?? "");
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [guardandoSlug, setGuardandoSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isContactoModalOpen, setIsContactoModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"contenido" | "diseño">("contenido");
  const [estilosGlobales, setEstilosGlobales] = useState<any>(initialEstilosGlobales ?? {
    titulo: { fuente: "Raleway", grosor: "800", tamano: "32px", color: "#1e293b", colorDestacado: "#6366f1" },
    subtitulo: { fuente: "Montserrat", grosor: "400", tamano: "16px", color: "#64748b", colorDestacado: "#6366f1" },
    parrafo: { fuente: "Montserrat", grosor: "400", tamano: "14px", color: "#334155", colorDestacado: "#6366f1" },
  });
  const { favs, toggleFav, isFav, deleteFav } = useFavoritos();
  const [colorPickerAbierto, setColorPickerAbierto] = useState<string | null>(null);
  const esAdmin = ["Admin", "SuperAdmin", "Owner"].includes(agente?.rol ?? "");

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).momoGlobalStyles = estilosGlobales;
    }
  }, [estilosGlobales]);

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

    // Save to local storage as well for previewing
    localStorage.setItem("momo_preview_estilos_globales", JSON.stringify(estilosGlobales));

    const editorContent = secciones.map(s => ({
      uid: s.uid, tipo: s.tipo, label: s.label, oculta: s.oculta,
      titulo: s.titulo, subtitulo: s.subtitulo, textoLibre: s.textoLibre, media: s.media, medias: s.medias,
      fechaDesde: s.fechaDesde,
      fechaHasta: s.fechaHasta,
      dias: s.dias,
      columnas: s.columnas,
      faqs: s.faqs,
      mapas: s.mapas,
      rutas: s.rutas,
      // Campos de sección menú
      menuLogo: s.menuLogo,
      menuItems: s.menuItems,
      menuOverrides: s.menuOverrides,
      menuBoton: s.menuBoton,
      menuHamburguesa: s.menuHamburguesa,
      // Precio fields
      pvp: s.pvp,
      pvpVinculado: s.pvpVinculado,
      condiciones: s.condiciones,
      otrasConsideraciones: s.otrasConsideraciones,
      // Extras fields
      extrasFilas: s.extrasFilas,
      // Formulario fields
      formularioCampos: s.formularioCampos,
      formularioTitulo: s.formularioTitulo,
      formularioSubtitulo: s.formularioSubtitulo,
      formularioEmail: s.formularioEmail,
      formularioBoton: s.formularioBoton,
      formularioAvatar: s.formularioAvatar,
      formularioAvatarForma: s.formularioAvatarForma,
      formularioNota: s.formularioNota,
      // Ofertas fields
      cards: s.cards,
      galeria: s.galeria,
      listadoFormatoId: s.listadoFormatoId,
      // NegoPlanet fields
      negoPlanetItems: s.negoPlanetItems,
      negoPlanetModo: s.negoPlanetModo,
      negoPlanetAutoTipo: s.negoPlanetAutoTipo,
      negoPlanetAutoQuery: s.negoPlanetAutoQuery,
      negoPlanetOverrides: s.negoPlanetOverrides,
    }));
    const designTokens = [
      { uid: "global", estilosGlobales },
      ...secciones.map(s => ({
        uid: s.uid, layout: s.layout,
        estiloTitulo: s.estiloTitulo, estiloSubtitulo: s.estiloSubtitulo, estiloTextoLibre: s.estiloTextoLibre,
        estiloTituloDia: s.estiloTituloDia, estiloDescDia: s.estiloDescDia,
        colorFondo: s.colorFondo,
        imagenFondo: s.imagenFondo,
        imagenFondoOverlay: s.imagenFondoOverlay,
        altoSeccion: s.altoSeccion,
        anchoMax: s.anchoMax,
        // Diseño del menú
        menuColorFondo: s.menuColorFondo,
        menuColorTexto: s.menuColorTexto,
        menuColorBoton: s.menuColorBoton,
        menuFijo: s.menuFijo,
        // Precio styling
        estiloPvp: s.estiloPvp,
        estiloCondiciones: s.estiloCondiciones,
        estiloOtrasConsideraciones: s.estiloOtrasConsideraciones,
        colorFondoCard: s.colorFondoCard,
        colorFondoCardPrecio: s.colorFondoCardPrecio,
        // Extras styling
        estiloExtraTexto: s.estiloExtraTexto,
        estiloExtraImporte: s.estiloExtraImporte,
        // FAQs styling
        estiloFaqPregunta: s.estiloFaqPregunta,
        estiloFaqRespuesta: s.estiloFaqRespuesta,
        // Formulario styling
        estiloFormularioTitulo: s.estiloFormularioTitulo,
        estiloFormularioSubtitulo: s.estiloFormularioSubtitulo,
        estiloFormularioNota: s.estiloFormularioNota,
        // Listado styling
        listadoEstiloTarjeta: s.listadoEstiloTarjeta,
      }))
    ];

    try {
      const result = await guardarPropuesta({
        propuestaId: propuestaId ?? undefined,
        editorContent,
        designTokens,
        cotizacionId: propuestaId ? undefined : (cotizacionId ?? undefined),
        contactoId: contactoId,
        title,
        destination: destination || null,
        fechaSalida: fechaSalida || null,
        fechaRegreso: fechaRegreso || null,
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
  }, [secciones, propuestaId, contactoId, estilosGlobales, title, destination, fechaSalida, fechaRegreso]);

  function guardarMeta(cambios: { title?: string; destination?: string | null; contacto_id?: string | null; fecha_salida?: string | null; fecha_regreso?: string | null }) {
    if (!propuestaId) return;
    updatePropuestaMeta(propuestaId, cambios).catch((e) => console.error("Error guardando datos de la propuesta:", e));
  }

  async function guardarSlug() {
    if (!propuestaId) return;
    setGuardandoSlug(true);
    setSlugError(null);
    try {
      const res = await updatePropuestaSlug(propuestaId, slug || null);
      if (res.success) {
        setSlug(res.slug ?? "");
      } else {
        setSlugError(res.error ?? "No se pudo guardar el slug");
      }
    } catch (e: any) {
      setSlugError(e?.message ?? "No se pudo guardar el slug");
    } finally {
      setGuardandoSlug(false);
    }
  }

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
    const offset = el.offsetTop - (container.clientHeight - el.clientHeight) / 2;
    container.scrollTo({ top: offset, behavior: "smooth" });
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
        { uid: `col-${Date.now()}-1`, titulo: "Aventura", texto: ".- Actividades al aire libre.\n.- Senderismo por rutas únicas.\n.- Guías profesionales." },
        { uid: `col-${Date.now()}-2`, titulo: "Gastronomía", texto: ".- Platos tradicionales locales.\n.- Catas de vinos exclusivas.\n.- Cenas bajo las estrellas." },
        { uid: `col-${Date.now()}-3`, titulo: "Cultura", texto: ".- Visitas guiadas a monumentos.\n.- Talleres de artesanía local.\n.- Festivales tradicionales." },
      ];
      base.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
    }
    if (tipo === "faqs") {
      base.anchoMax = "900px";
      base.titulo = "Preguntas frecuentes";
      base.subtitulo = "Resolvemos tus dudas antes de reservar.";
      base.faqs = [
        { uid: `faq-${Date.now()}-1`, pregunta: "¿Cuál es la política de cancelación?", respuesta: "Puedes cancelar hasta 30 días antes de la salida sin coste alguno." },
        { uid: `faq-${Date.now()}-2`, pregunta: "¿Qué incluye el precio?", respuesta: "El precio incluye alojamiento, traslados y guía durante todo el itinerario." },
        { uid: `faq-${Date.now()}-3`, pregunta: "¿Cómo puedo contactar con vosotros?", respuesta: "Puedes escribirnos a través del formulario de contacto o llamarnos directamente." },
      ];
      base.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
      base.estiloSubtitulo = { fuente: "Montserrat", grosor: "400", tamano: "15px", color: "#475569" };
      base.estiloFaqPregunta = { fuente: "Raleway", grosor: "700", tamano: "16px", color: "#1e293b" };
      base.estiloFaqRespuesta = { fuente: "Montserrat", grosor: "400", tamano: "14px", color: "#475569" };
    }
    if (tipo === "precio") {
      base.layout = "destacado-grande";
      base.anchoMax = "1200px";
      base.pvp = "1.600 € / persona";
      base.condiciones = "- Pago del 30% al confirmar la reserva.\n- Pago del 70% restante 30 días antes de la salida.";
      base.estiloPvp = { fuente: "Raleway", grosor: "800", tamano: "48px", color: "#1e293b" };
      base.estiloCondiciones = { fuente: "Montserrat", grosor: "400", tamano: "14px", color: "#475569" };
    }
    if (tipo === "extras") {
      base.layout = "lista-simple";
      base.anchoMax = "1200px";
      base.titulo = "Extras opcionales";
      base.extrasFilas = [
        { uid: `extra-${Date.now()}-1`, texto: "Seguro de viaje premium", importe: "35 €" },
        { uid: `extra-${Date.now()}-2`, texto: "Traslado privado aeropuerto", importe: "60 €" },
      ];
      base.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
      base.estiloExtraTexto = { fuente: "Montserrat", grosor: "500", tamano: "15px", color: "#1e293b" };
      base.estiloExtraImporte = { fuente: "Raleway", grosor: "700", tamano: "15px", color: "#6366f1" };
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
    if (tipo === "cards") {
      base.anchoMax = "1200px";
      base.titulo = "Por qué elegirnos";
      base.cards = [];
      base.estiloTitulo = { fuente: "Raleway", grosor: "800", tamano: "22px", color: "#1e293b" };
    }
    if (tipo === "galeria") {
      base.anchoMax = "1200px";
      base.titulo = "Galería de fotos";
      base.galeria = [];
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <a href="/propuestas" className={styles.backIconButton} title="Volver a propuestas">
            <ChevronRight size={24} style={{ transform: "rotate(180deg)" }} />
          </a>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <button
              onClick={() => setIsContactoModalOpen(true)}
              className={styles.title}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                color: contactoNombre ? "inherit" : "#94a3b8",
                fontWeight: contactoNombre ? undefined : 400,
              }}
            >
              {contactoNombre || "Sin contacto"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.15rem" }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => guardarMeta({ title })}
                aria-label="Nombre de la propuesta"
                placeholder="Nombre de la propuesta"
                style={{ border: "none", background: "transparent", outline: "none", padding: 0, width: "320px", maxWidth: "40vw", fontSize: "0.85rem", color: "#334155" }}
              />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onBlur={() => guardarMeta({ destination: destination || null })}
                aria-label="Destino"
                placeholder="Destino"
                style={{
                  padding: "0.25rem 0.75rem", fontSize: "0.75rem", background: "#f8fafc", color: destination ? "#475569" : "#94a3b8",
                  borderRadius: "999px", border: "1px solid #cbd5e1", outline: "none", width: "140px",
                }}
              />
              <DateChipPropuesta
                label="Salida"
                value={fechaSalida}
                onChange={(v) => { setFechaSalida(v); guardarMeta({ fecha_salida: v || null }); }}
              />
              <DateChipPropuesta
                label="Regreso"
                value={fechaRegreso}
                onChange={(v) => { setFechaRegreso(v); guardarMeta({ fecha_regreso: v || null }); }}
              />
            </div>
          </div>
        </div>
        {propuestaId && <ExpedienteActionsToolbar propuestaId={propuestaId} />}
      </div>

      {isContactoModalOpen && (
        <ContactoModalPropuesta
          contactoId={contactoId}
          onClose={() => setIsContactoModalOpen(false)}
          onSelect={(id, nombre) => {
            setContactoId(id);
            setContactoNombre(nombre);
            guardarMeta({ contacto_id: id });
            setIsContactoModalOpen(false);
          }}
          onClear={() => {
            setContactoId(null);
            setContactoNombre(null);
            guardarMeta({ contacto_id: null });
            setIsContactoModalOpen(false);
          }}
        />
      )}

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
                <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", margin: "0 0 0.75rem 0" }}>Secciones</h2>

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
                                  <div key={fav.favId} style={{ display: "flex", alignItems: "center" }}>
                                    <button className={styles.menuItem} style={{ flex: 1 }} onClick={() => añadirDesdeFav(fav)}>
                                      <Heart size={13} fill="#f472b6" color="#f472b6" className={styles.menuItemIcon} />
                                      {fav.label}
                                    </button>
                                    {esAdmin && (
                                      <button
                                        type="button"
                                        title="Eliminar favorito"
                                        onClick={e => { e.stopPropagation(); deleteFav(fav.favId); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", color: "#94a3b8", display: "flex", alignItems: "center" }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
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
                    {/* Text categories */}
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
                          
                          {/* Selectores en la misma fila */}
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

                          {/* Colores (Texto y Destacado). El subrayado se configura por sección, no aquí. */}
                          <div style={{ display: "flex", gap: "0.6rem", marginTop: "4px" }}>
                            <TextoColorBoton
                              tipo="texto"
                              label="Color texto"
                              color={item.color ?? "#1e293b"}
                              abierto={colorPickerAbierto === `${key}-texto`}
                              onAbrir={() => setColorPickerAbierto(colorPickerAbierto === `${key}-texto` ? null : `${key}-texto`)}
                              onCerrar={() => setColorPickerAbierto(null)}
                              onChangeColor={v => updateField("color", v)}
                            />
                            <TextoColorBoton
                              tipo="negrita"
                              label="Color dest."
                              color={item.colorDestacado ?? "#6366f1"}
                              abierto={colorPickerAbierto === `${key}-destacado`}
                              onAbrir={() => setColorPickerAbierto(colorPickerAbierto === `${key}-destacado` ? null : `${key}-destacado`)}
                              onCerrar={() => setColorPickerAbierto(null)}
                              onChangeColor={v => updateField("colorDestacado", v)}
                            />
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
            {propuestaId && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0, padding: "0 10px", height: 32, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.78rem" }}>
                  <span style={{ color: "#94a3b8", flexShrink: 0, whiteSpace: "nowrap" }}>
                    /propuestas/p/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    onBlur={guardarSlug}
                    placeholder="url-de-la-propuesta"
                    style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontSize: "0.78rem", color: "#1e293b", fontWeight: 600 }}
                  />
                  {guardandoSlug && <span className={styles.saveBtnSpinner} style={{ flexShrink: 0 }} />}
                  {slugError && <span style={{ color: "#ef4444", fontSize: "0.68rem", flexShrink: 0 }}>{slugError}</span>}
                </div>
                <div className={styles.deviceBarSep} />
              </>
            )}
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
                localStorage.setItem("momo_preview_propuesta_id", propuestaId || "nueva");
                if (slug) {
                  window.open(`/propuestas/p/${slug}`, "_blank");
                } else {
                  window.open(`/propuestas/${propuestaId || "nueva"}/preview`, "_blank");
                }
              }}
            >
              <ExternalLink size={15} />
              <span>Previsualizar</span>
            </button>
            <div className={styles.deviceBarSep} />
            <button
              type="button"
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
              style={{ width: current.width, height: current.height, ...getStyleVars(estilosGlobales) }}
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
                        {renderSeccion(menuFijo, current.height, dispositivo, secciones, agente, listadoItemsPorSeccion)}
                      </div>
                    )}
                    <div className={styles.canvasContent} ref={canvasContentRef}>
                      {seccionesVisibles.map(s => (
                        <div key={s.uid} id={s.uid} ref={el => { seccionRefs.current[s.uid] = el; }}
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


      {/* Modal confirmación borrar */}
    </div>
  );
}

function DateChipPropuesta({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formatted = value ? new Date(value + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : null;
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => inputRef.current?.showPicker?.()}
        style={{
          padding: "0.25rem 0.75rem", fontSize: "0.75rem", background: "#f8fafc",
          color: value ? "#475569" : "#94a3b8", borderRadius: "999px",
          border: "1px solid #cbd5e1", cursor: "pointer", fontWeight: value ? 600 : 400,
          display: "flex", alignItems: "center", gap: "0.35rem", whiteSpace: "nowrap",
        }}
      >
        <Calendar size={12} />
        {formatted ? `${label}: ${formatted}` : label}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0, top: 0, left: 0 }}
      />
    </div>
  );
}

function ContactoModalPropuesta({ contactoId, onClose, onSelect, onClear }: {
  contactoId: string | null;
  onClose: () => void;
  onSelect: (id: string, nombre: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<{ id: string; nombre: string; localidad: string | null }[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResultados([]); return; }
    const timeout = setTimeout(async () => {
      setBuscando(true);
      try {
        const results = await buscarEntidades(query);
        setResultados(results.map((r: any) => ({ id: r.id, nombre: r.nombre || "Sin nombre", localidad: r.localidad || null })));
      } catch (err) {
        console.error("Error buscando contactos:", err);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "0.9rem", width: "420px", maxWidth: "92vw", maxHeight: "70vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(15,23,42,0.18)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>Contacto principal</span>
          <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#64748b" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", overflowY: "auto" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente por nombre..."
            style={{ padding: "0.55rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.6rem", fontSize: "0.85rem", outline: "none" }}
          />
          {contactoId && (
            <button
              onClick={onClear}
              style={{ alignSelf: "flex-start", border: "none", background: "none", color: "#dc2626", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              Quitar contacto actual
            </button>
          )}
          {buscando && <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Buscando...</span>}
          {!buscando && query.trim().length >= 2 && resultados.length === 0 && (
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Sin resultados</span>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {resultados.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect(r.id, r.nombre)}
                style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left", padding: "0.55rem 0.4rem", border: "none", background: "none", borderBottom: "1px solid #f8fafc", cursor: "pointer", fontSize: "0.85rem", color: "#1e293b" }}
              >
                <span>{r.nombre}</span>
                {r.localidad && <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{r.localidad}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
