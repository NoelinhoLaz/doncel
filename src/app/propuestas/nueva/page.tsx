"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Monitor, Tablet, Smartphone,
  LayoutTemplate, Type, Map as MapPinIcon, Route, DollarSign, Calendar, PanelBottom, Image, GripVertical, Menu, Columns,
  Trash2, Eye, EyeOff, ChevronRight, ChevronLeft, X, Palette, TableOfContents, Sparkles,
  ALargeSmall, Bold, AlignLeft, AlignCenter, AlignRight, AlignJustify, ExternalLink, Video,
  Backpack, ShoppingBag, Compass, Sailboat, TreePine, Caravan, Tent, Utensils, Anchor, Volleyball, Plane, Sun, Umbrella,
  Camera, Map as MapIcon, Mountain, Coffee, Wine, Bike, Train, Bus, Ship, Fish, Palmtree, Flower2, Globe, Star, Heart, Ticket, Luggage,
  Footprints,
} from "lucide-react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import { guardarPropuesta } from "@/actions/propuestas";

const MapaLeaflet = dynamic(() => import("./MapaLeaflet"), { ssr: false, loading: () => <div style={{ width: "100%", height: "100%", background: "#f0f4ff", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Cargando mapa…</div> });
const RutaLeaflet = dynamic(() => import("./RutaLeaflet"), { ssr: false, loading: () => <div style={{ width: "100%", height: "100%", background: "#f0f4ff", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Cargando ruta…</div> });
import { searchPlaces, getPlaceDetails } from "@/actions/places";

type Dispositivo = "desktop" | "tablet" | "mobile";

interface TextoEstilo {
  fuente?: string;
  tamano?: string;
  grosor?: string;
  alineacionH?: string;
  color?: string;
  colorDestacado?: string;
  grosorDestacado?: string;
}

type MediaItem = { tipo: "unsplash" | "link" | "upload" | "video"; url: string };

interface UbicacionMapa {
  uid: string;
  placeId?: string;
  nombre?: string;
  direccion?: string;
  descripcion?: string;
  lat?: number;
  lng?: number;
  medias?: MediaItem[];
}

interface MapaItem {
  uid: string;
  titulo?: string;
  ubicaciones?: UbicacionMapa[];
}

interface SegmentoRuta {
  uid: string;
  modo: "foot-walking" | "driving-car";
  polyline?: [number, number][];
}

interface RutaItem {
  uid: string;
  titulo?: string;
  ubicaciones?: UbicacionMapa[];
  segmentos?: SegmentoRuta[];
}

interface MenuItemConfig {
  uid: string;    // uid de la sección referenciada
  etiqueta: string;
  ocultaEnMenu?: boolean;
}

interface MenuBoton {
  etiqueta: string;
  tipo: "externo" | "seccion";
  href?: string;       // URL externa
  seccionUid?: string; // uid de sección destino
}

interface Seccion {
  uid: string;
  tipo: string;
  label: string;
  oculta?: boolean;
  layout?: string;
  titulo?: string;
  subtitulo?: string;
  media?: MediaItem;
  medias?: MediaItem[];
  estiloTitulo?: TextoEstilo;
  estiloSubtitulo?: TextoEstilo;
  estiloTituloDia?: TextoEstilo;
  estiloDescDia?: TextoEstilo;
  colorFondo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  anchoMax?: string;
  columnas?: { titulo?: string; texto?: string }[];
  mapas?: MapaItem[];
  rutas?: RutaItem[];
  dias?: {
    dia: number;
    titulo?: string;
    desc?: string;
    media?: MediaItem;
    medias?: MediaItem[];
  }[];
  // Campos específicos de sección menú
  menuLogo?: string;          // URL del logo
  menuItems?: MenuItemConfig[];
  menuBoton?: MenuBoton | null;
  menuColorFondo?: string;    // hex + alpha soportado (rgba o hex8)
  menuColorTexto?: string;
  menuColorBoton?: string;
  menuFijo?: boolean;
}

const DISPOSITIVOS: { id: Dispositivo; label: string; Icon: React.ElementType; width: string; height: string }[] = [
  { id: "desktop", label: "Escritorio", Icon: Monitor,    width: "1056px", height: "594px" },
  { id: "tablet",  label: "Tablet",     Icon: Tablet,     width: "492px",  height: "708px" },
  { id: "mobile",  label: "Móvil",      Icon: Smartphone, width: "314px",  height: "682px" },
];

const OPCIONES_SECCION = [
  { id: "menu",           label: "Menú",             Icon: Menu },
  { id: "portada",        label: "Portada",          Icon: LayoutTemplate },
  { id: "texto-imagenes", label: "Texto + Imágenes", Icon: Image },
  { id: "texto-columnas", label: "Texto Columnas",   Icon: Columns },
  { id: "itinerario",     label: "Itinerario",       Icon: Calendar },
  { id: "mapa",           label: "Mapa",             Icon: MapPinIcon },
  { id: "ruta",           label: "Ruta",             Icon: Route },
  { id: "precio",         label: "Precio",           Icon: DollarSign },
  { id: "formulario",     label: "Formulario",       Icon: Type },
  { id: "footer",         label: "Footer",           Icon: PanelBottom },
];

function Ph({ children }: { children: React.ReactNode }) {
  return <div className={styles.ph}>{children}</div>;
}
function Bar({ w }: { w: string }) {
  return <div className={styles.phBar} style={{ width: w }} />;
}
function Title({ w }: { w: string }) {
  return <div className={styles.phTitle} style={{ width: w }} />;
}
function Bloque({ h, dashed }: { h?: string; dashed?: boolean }) {
  return <div className={styles.phBloque} style={{ height: h ?? "60px", borderStyle: dashed ? "dashed" : "solid" }} />;
}

function PHMenu({ mobile, seccion, secciones }: { mobile?: boolean; seccion?: Seccion; secciones?: Seccion[] }) {
  const bg = seccion?.menuColorFondo ?? "rgba(255,255,255,0.95)";
  const colorTexto = seccion?.menuColorTexto ?? "#1e293b";
  const colorBoton = seccion?.menuColorBoton ?? "var(--primary-color, #475569)";
  const fijo = seccion?.menuFijo ?? false;
  const logo = seccion?.menuLogo;

  // Items visibles en el menú
  const items: { etiqueta: string; uid: string }[] = seccion?.menuItems
    ? seccion.menuItems.filter(i => !i.ocultaEnMenu)
    : (secciones ?? []).filter(s => s.tipo !== "menu" && !s.oculta).slice(0, 4).map(s => ({ etiqueta: s.label, uid: s.uid }));

  const boton = seccion?.menuBoton;

  return (
    <div className={styles.phMenu} style={{ background: bg, ...(fijo ? { position: "sticky", top: 0, zIndex: 100 } : {}) }}>
      <div className={styles.phMenuRow}>
        {logo
          ? <img src={logo} alt="Logo" style={{ height: 32, maxWidth: 120, objectFit: "contain" }} />
          : <div className={styles.phLogo} />
        }
        {!mobile && (
          <div className={styles.phNavLinks}>
            {items.length > 0
              ? items.map(item => (
                  <span key={item.uid} style={{ fontSize: "0.78rem", fontWeight: 600, color: colorTexto, padding: "0 8px", cursor: "pointer" }}>
                    {item.etiqueta}
                  </span>
                ))
              : <><Bar w="40px" /><Bar w="40px" /><Bar w="40px" /><Bar w="40px" /></>
            }
          </div>
        )}
        {boton?.etiqueta
          ? <div style={{ padding: "0.3rem 0.85rem", borderRadius: "0.4rem", background: colorBoton, color: "#fff", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
              {boton.etiqueta}
            </div>
          : <div className={styles.phNavBtn} style={{ background: colorBoton }} />
        }
      </div>
    </div>
  );
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function youtubeEmbed(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&enablejsapi=1` : null;
}

function VideoBg({ url, className, style, onEnded }: { url: string; className?: string; style?: React.CSSProperties; onEnded?: () => void }) {
  const embed = youtubeEmbed(url);
  // YouTube: cuando hay onEnded no queremos loop (para que dispare el evento ended)
  const embedUrl = onEnded && embed
    ? embed.replace("&loop=1", "").replace(`&playlist=${youtubeId(url)}`, "")
    : embed;
  if (embedUrl) {
    return (
      <div className={className} style={{ ...style, overflow: "hidden", position: "relative", containerType: "size" }}>
        <iframe
          src={embedUrl}
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "max(100cqw, 177.78cqh)",
            height: "max(100cqh, 56.25cqw)",
            transform: "translate(-50%, -50%)",
            border: "none",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }
  return (
    <video
      src={url}
      className={className}
      style={{ ...style, objectFit: "cover" }}
      autoPlay
      muted
      loop={!onEnded}
      playsInline
      onEnded={onEnded}
    />
  );
}

function PortadaBg({ media, className, style }: { media?: Seccion["media"]; className?: string; style?: React.CSSProperties }) {
  if (media?.url) {
    const isVideo = media.tipo === "video";
    return isVideo
      ? <VideoBg url={media.url} className={className} style={style} />
      : <div className={className} style={{ ...style, backgroundImage: `url(${media.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />;
  }
  return <div className={className} style={style} />;
}

const FUENTE_FAMILY: Record<string, string> = {
  "Raleway":       "var(--font-raleway), sans-serif",
  "Montserrat":    "var(--font-montserrat), sans-serif",
  "Roboto":        "var(--font-roboto), sans-serif",
  "Special Elite": "var(--font-special-elite), cursive",
  "Serif":         "Georgia, serif",
};

function estiloTextoCSS(e?: TextoEstilo): React.CSSProperties {
  if (!e) return {};
  const tamanoNum = e.tamano ? parseInt(e.tamano) : 0;
  return {
    ...(e.fuente      ? { fontFamily: FUENTE_FAMILY[e.fuente] ?? e.fuente } : {}),
    ...(e.tamano      ? { fontSize: e.tamano.endsWith("px") && tamanoNum > 0 ? `min(${e.tamano}, calc(${tamanoNum / 1920} * 100cqw))` : e.tamano }   : {}),
    ...(e.grosor      ? { fontWeight: e.grosor } : {}),
    ...(e.alineacionH ? { textAlign: e.alineacionH as React.CSSProperties["textAlign"] } : {}),
    ...(e.color       ? { color: e.color }       : {}),
  };
}

function renderConDestacado(texto: string, colorDestacado?: string, grosorDestacado?: string): React.ReactNode {
  if (!texto) return null;
  const lineas = texto.split("\n");
  return lineas.map((linea, index) => {
    const trimmed = linea.trim();
    const esVineta = trimmed.startsWith(".-");
    const contenidoLinea = esVineta ? trimmed.slice(2).trim() : linea;

    const partes = contenidoLinea.split(/(\*\*.*?\*\*)/g);
    const lineContent = partes.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color: colorDestacado ?? "#6366f1", fontWeight: grosorDestacado ?? "bold" }}>{p.slice(2, -2)}</strong>
        : p
    );

    if (esVineta) {
      return (
        <span key={index} style={{ display: "flex", gap: "8px", alignItems: "flex-start", paddingLeft: "8px", marginTop: "4px", marginBottom: "4px", textAlign: "left" }}>
          <span style={{ color: colorDestacado ?? "#6366f1", fontWeight: "bold" }}>•</span>
          <span style={{ flex: 1 }}>{lineContent}</span>
        </span>
      );
    } else {
      return (
        <span key={index} style={{ display: "block", minHeight: linea === "" ? "0.75em" : undefined }}>
          {lineContent}
        </span>
      );
    }
  });
}

function PortadaTexto({ titulo, subtitulo, estiloTitulo, estiloSubtitulo, wrapStyle }: {
  titulo?: string; subtitulo?: string;
  estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo;
  wrapStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", ...wrapStyle }}>
      {titulo
        ? <p className={styles.phPortadaTitulo} style={{ whiteSpace: "pre-wrap", ...estiloTextoCSS(estiloTitulo) }}>
            {renderConDestacado(titulo, estiloTitulo?.colorDestacado, estiloTitulo?.grosorDestacado)}
          </p>
        : <Title w="55%" />}
      {subtitulo
        ? <p className={styles.phPortadaSubtitulo} style={{ whiteSpace: "pre-wrap", ...estiloTextoCSS(estiloSubtitulo) }}>
            {renderConDestacado(subtitulo, estiloSubtitulo?.colorDestacado, estiloSubtitulo?.grosorDestacado)}
          </p>
        : <><Bar w="40%" /><Bar w="30%" /></>}
    </div>
  );
}

type PillsBgIcon = { Icon: React.ElementType; x: number; y: number; rot: number; sz: number; speed: number };

function PillsPortada({ height, titulo, subtitulo, estiloTitulo, estiloSubtitulo, pillImgs, pillsBgIcons }: {
  height: string; titulo?: string; subtitulo?: string;
  estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo;
  pillImgs: MediaItem[]; pillsBgIcons: PillsBgIcon[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    // Find the nearest scrollable ancestor at runtime
    function getScrollParent(el: HTMLElement | null): HTMLElement {
      while (el && el !== document.documentElement) {
        const { overflowY } = window.getComputedStyle(el);
        if (overflowY === "auto" || overflowY === "scroll") return el;
        el = el.parentElement;
      }
      return document.documentElement;
    }

    const scrollEl = getScrollParent(containerRef.current);

    const onScroll = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const parentRect = scrollEl.getBoundingClientRect?.() ?? { top: 0 };
      if (rect) setScrollY((parentRect.top - rect.top) * 0.2);
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={containerRef} className={`${styles.phPortada} ${styles.phPortadaPills}`} style={{ height, padding: 0, overflow: "hidden" }}>
      <div className={styles.phPillsBgIcons}>
        {pillsBgIcons.map(({ Icon, x, y, rot, sz, speed }, i) => (
          <span key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`,
            transform: `rotate(${rot}deg) translateY(${scrollY * speed}px)`,
            opacity: 0.13, color: "#4f46e5", lineHeight: 0,
            transition: "transform 0.1s linear",
          }}>
            <Icon size={sz} strokeWidth={1.5} />
          </span>
        ))}
      </div>
      <div className={styles.phPillsLayout}>
        <div className={styles.phPillsTexto}>
          <PortadaTexto titulo={titulo} subtitulo={subtitulo} estiloTitulo={estiloTitulo} estiloSubtitulo={estiloSubtitulo} />
        </div>
        <div className={styles.phPillsGroup}>
          {[0, 1, 2, 3].map((_, i) => {
            const m = pillImgs[i];
            return (
              <div key={i} className={styles.phPill}
                style={{
                  ...(m?.url && m.tipo !== "video" ? { backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
                  overflow: "hidden",
                  position: "relative",
                  marginTop: i % 2 === 0 ? "-240px" : "-48px",
                  transform: `translateY(${i % 2 === 0 ? scrollY * 0.8 : scrollY * -0.8}px)`
                }}>
                {!m?.url && <Image size={18} className={styles.phImagenIcon} />}
                {m?.url && m.tipo === "video" && <VideoBg url={m.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 999 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PolaroidPortada({ height, colorFondo, cards, titulo, subtitulo, estiloTitulo, estiloSubtitulo }: {
  height: string; colorFondo?: string;
  cards: { w: string; r: string; left: string; top: string; url: string; tipo?: string }[];
  titulo?: string; subtitulo?: string;
  estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className={styles.phPortada} style={{ height, background: colorFondo ?? "linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4)), url('/map.png') center/140% no-repeat", padding: 0, overflow: "hidden" }}>
      {/* Textura desgastada */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} xmlns="http://www.w3.org/2000/svg">
        <filter id="grunge">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blended" />
          <feComponentTransfer in="blended">
            <feFuncA type="linear" slope="1" />
          </feComponentTransfer>
        </filter>
        <filter id="scratches">
          <feTurbulence type="turbulence" baseFrequency="0.4 0.015" numOctaves="2" seed="7" stitchTiles="stitch" result="scratchNoise" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 6 -3" in="scratchNoise" result="scratchMask" />
          <feComposite in="SourceGraphic" in2="scratchMask" operator="in" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grunge)" opacity="0.08" />
        <rect width="141%" height="141%" filter="url(#scratches)" opacity="0.07" fill="#000000" transform="rotate(45) translate(-20%, -60%)" />
      </svg>
      <div className={styles.phPolaroidLayout}>
        <div className={styles.phPolaroidGroup}>
          {cards.map((c, i) => (
            <div
              key={i}
              className={styles.phPolaroidCard}
              style={{
                position: "absolute", width: c.w, left: c.left, top: c.top,
                transform: hovered === i ? `rotate(0deg) scale(1.12)` : `rotate(${c.r}) scale(1)`,
                zIndex: hovered === i ? 99 : i,
                transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease",
                boxShadow: hovered === i ? "0 20px 50px rgba(0,0,0,0.25)" : undefined,
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {c.url && c.tipo === "video"
                ? <div className={styles.phPolaroidImg} style={{ overflow: "hidden", position: "relative" }}><VideoBg url={c.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} /></div>
                : <div className={styles.phPolaroidImg} style={c.url ? { backgroundImage: `url(${c.url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}} />
              }
              <div className={styles.phPolaroidCaption} />
            </div>
          ))}
        </div>
        <div className={styles.phPolaroidTexto}>
          <PortadaTexto titulo={titulo} subtitulo={subtitulo} estiloTitulo={estiloTitulo} estiloSubtitulo={estiloSubtitulo} />
        </div>
      </div>
    </div>
  );
}

function PHPortada({ height, layout, titulo, subtitulo, medias, estiloTitulo, estiloSubtitulo, colorFondo }: { height: string; layout?: string; titulo?: string; subtitulo?: string; medias?: MediaItem[]; estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo; colorFondo?: string }) {
  const allImgs = medias ?? [];

  const [idx, setIdx] = useState(0);
  const advanceRef = useRef<() => void>(() => {});

  // Avanza al siguiente slide
  advanceRef.current = () => setIdx(i => (i + 1) % allImgs.length);

  useEffect(() => { setIdx(0); }, [allImgs.length]);

  const currentTipo = allImgs[idx]?.tipo;
  useEffect(() => {
    if (allImgs.length < 2) return;
    // Si el slide actual es video, no ponemos timer — la señal llega por onEnded / postMessage
    if (currentTipo === "video") return;
    const t = setTimeout(() => advanceRef.current(), 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, allImgs.length, currentTipo]);

  // YouTube IFrame API: escucha el evento de fin de video via postMessage
  useEffect(() => {
    if (allImgs.length < 2) return;
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        // YT state 0 = ended
        if (data?.event === "onStateChange" && data?.info === 0) {
          advanceRef.current();
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [allImgs.length]);

  const currentImg = allImgs[idx] ?? null;

  if (layout === "wave") {
    return (
      <div className={styles.phPortada} style={{ height, background: colorFondo ?? "white", padding: 0 }}>
        {/* SVG invisible que define la máscara responsive */}
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <clipPath id="waveHeroMask" clipPathUnits="objectBoundingBox">
              <path d="M 0.42,0 C 0.36,0.25 0.58,0.5 0.40,0.75 C 0.33,0.88 0.38,0.95 0.42,1 L 1,1 L 1,0 Z" />
            </clipPath>
          </defs>
        </svg>
        <div className={styles.phWave}>
          <div className={styles.phWaveLeft}>
            <PortadaTexto titulo={titulo} subtitulo={subtitulo} estiloTitulo={estiloTitulo} estiloSubtitulo={estiloSubtitulo} />
          </div>
          <div className={styles.phWaveRight} style={{ clipPath: "url(#waveHeroMask)" }}>
            {allImgs.map((m, i) => (
              m.tipo === "video"
                ? <div key={m.url} className={`${styles.phWaveImgFill} ${styles.phSlideFade}`} style={{ opacity: i === idx ? 1 : 0 }}>
                    <VideoBg
                      url={m.url}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                      onEnded={allImgs.length > 1 && i === idx ? advanceRef.current : undefined}
                    />
                  </div>
                : <div key={m.url} className={`${styles.phWaveImgFill} ${styles.phSlideFade}`}
                    style={{ backgroundImage: `url(${m.url})`, opacity: i === idx ? 1 : 0 }} />
            ))}
            {allImgs.length === 0 && <div className={styles.phWaveImgFill} />}
          </div>
        </div>
      </div>
    );
  }

  if (layout === "polaroid") {
    const CONFIGS = [
      { w: "52%", r: "-9deg",  left: "5%",  top:  "2%" },
      { w: "48%", r:  "7deg",  left: "44%", top:  "4%" },
      { w: "50%", r: "-4deg",  left: "2%",  top: "36%" },
      { w: "46%", r: "11deg",  left: "48%", top: "38%" },
      { w: "49%", r: "-6deg",  left: "22%", top: "66%" },
    ];
    const cards = allImgs.length > 0
      ? allImgs.map((m, i) => ({ ...CONFIGS[i % CONFIGS.length], url: m.url, tipo: m.tipo }))
      : CONFIGS.slice(0, 3).map(c => ({ ...c, url: "", tipo: undefined }));

    return <PolaroidPortada height={height} colorFondo={colorFondo} cards={cards} titulo={titulo} subtitulo={subtitulo} estiloTitulo={estiloTitulo} estiloSubtitulo={estiloSubtitulo} />;
  }

  if (layout === "pills") {
    const pillImgs = allImgs.slice(0, 4);
    const pillsBgIcons = [
      { Icon: Backpack,    x: 4,  y: 5,  rot: -15, sz: 28, speed: 0.3 },
      { Icon: ShoppingBag, x: 18, y: 20, rot: 10,  sz: 22, speed: 0.5 },
      { Icon: Compass,     x: 32, y: 8,  rot: 0,   sz: 26, speed: 0.2 },
      { Icon: Sailboat,    x: 55, y: 12, rot: 8,   sz: 30, speed: 0.4 },
      { Icon: TreePine,    x: 72, y: 6,  rot: -5,  sz: 24, speed: 0.6 },
      { Icon: Caravan,     x: 85, y: 18, rot: 5,   sz: 28, speed: 0.3 },
      { Icon: Tent,        x: 10, y: 45, rot: -8,  sz: 26, speed: 0.5 },
      { Icon: Utensils,    x: 40, y: 55, rot: 20,  sz: 20, speed: 0.2 },
      { Icon: Anchor,      x: 62, y: 48, rot: -10, sz: 24, speed: 0.4 },
      { Icon: Volleyball,  x: 78, y: 60, rot: 0,   sz: 22, speed: 0.6 },
      { Icon: Plane,       x: 25, y: 72, rot: -30, sz: 30, speed: 0.3 },
      { Icon: Sun,         x: 50, y: 80, rot: 0,   sz: 26, speed: 0.5 },
      { Icon: Umbrella,    x: 88, y: 75, rot: 15,  sz: 24, speed: 0.2 },
      { Icon: Compass,     x: 6,  y: 85, rot: 25,  sz: 20, speed: 0.4 },
      { Icon: Backpack,    x: 48, y: 35, rot: 12,  sz: 18, speed: 0.6 },
      { Icon: Sailboat,    x: 90, y: 40, rot: -5,  sz: 20, speed: 0.3 },
      { Icon: Tent,        x: 70, y: 85, rot: 5,   sz: 22, speed: 0.5 },
      { Icon: Plane,       x: 15, y: 30, rot: 15,  sz: 18, speed: 0.2 },
      { Icon: Camera,      x: 38, y: 88, rot: -8,  sz: 26, speed: 0.4 },
      { Icon: MapIcon,     x: 60, y: 70, rot: 5,   sz: 22, speed: 0.6 },
      { Icon: Mountain,    x: 20, y: 58, rot: 0,   sz: 28, speed: 0.3 },
      { Icon: Coffee,      x: 93, y: 55, rot: 10,  sz: 20, speed: 0.5 },
      { Icon: Wine,        x: 3,  y: 65, rot: -12, sz: 22, speed: 0.2 },
      { Icon: Bike,        x: 44, y: 15, rot: 0,   sz: 24, speed: 0.4 },
      { Icon: Train,       x: 66, y: 30, rot: 5,   sz: 26, speed: 0.6 },
      { Icon: Bus,         x: 82, y: 92, rot: -5,  sz: 22, speed: 0.3 },
      { Icon: Ship,        x: 12, y: 92, rot: 8,   sz: 28, speed: 0.5 },
      { Icon: Fish,        x: 57, y: 95, rot: -15, sz: 20, speed: 0.2 },
      { Icon: Palmtree,    x: 75, y: 22, rot: 5,   sz: 26, speed: 0.4 },
      { Icon: Flower2,     x: 30, y: 42, rot: 20,  sz: 18, speed: 0.6 },
      { Icon: Globe,       x: 95, y: 8,  rot: 0,   sz: 24, speed: 0.3 },
      { Icon: Star,        x: 8,  y: 15, rot: 15,  sz: 18, speed: 0.5 },
      { Icon: Heart,       x: 52, y: 48, rot: -10, sz: 16, speed: 0.2 },
      { Icon: Ticket,      x: 35, y: 25, rot: -20, sz: 22, speed: 0.4 },
      { Icon: Luggage,     x: 80, y: 48, rot: 8,   sz: 26, speed: 0.6 },
    ];

    return <PillsPortada height={height} titulo={titulo} subtitulo={subtitulo} estiloTitulo={estiloTitulo} estiloSubtitulo={estiloSubtitulo} pillImgs={pillImgs} pillsBgIcons={pillsBgIcons} />;
  }

  // slide (default)
  const hasMultiple = allImgs.length > 1;
  return (
    <div className={styles.phPortada} style={{ height, background: allImgs.length === 0 ? "#e2e8f0" : undefined }}>
      {allImgs.map((m, i) => (
        m.tipo === "video"
          ? <div key={m.url} className={`${styles.phSlideImg} ${styles.phSlideFade}`} style={{ opacity: i === idx ? 1 : 0 }}>
              <VideoBg
                url={m.url}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                onEnded={hasMultiple && i === idx ? advanceRef.current : undefined}
              />
            </div>
          : <div key={m.url} className={`${styles.phSlideImg} ${styles.phSlideFade}`}
              style={{ backgroundImage: `url(${m.url})`, opacity: i === idx ? 1 : 0 }} />
      ))}
      <div className={styles.phSlideArrowL}>‹</div>
      <div className={styles.phPortadaOverlay}>
        <PortadaTexto titulo={titulo} subtitulo={subtitulo} estiloTitulo={estiloTitulo} estiloSubtitulo={estiloSubtitulo} />
      </div>
      <div className={styles.phSlideArrowR}>›</div>
      <div className={styles.phSlideDots}>
        {allImgs.map((_, i) => <div key={i} className={`${styles.phSlideDot} ${i === idx ? styles.phSlideDotActive : ""}`} />)}
      </div>
    </div>
  );
}

function PHTextoImagenes({
  mobile,
  layout,
  titulo,
  subtitulo,
  medias,
  colorFondo,
  estiloTitulo,
  estiloSubtitulo,
  anchoMax
}: {
  mobile?: boolean;
  layout?: string;
  titulo?: string;
  subtitulo?: string;
  medias?: MediaItem[];
  colorFondo?: string;
  estiloTitulo?: TextoEstilo;
  estiloSubtitulo?: TextoEstilo;
  anchoMax?: string;
}) {
  const imgIzq = layout === "img-texto";
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if ((medias ?? []).length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % medias!.length), 5000);
    return () => clearInterval(t);
  }, [medias?.length]);

  useEffect(() => {
    setIdx(0);
  }, [medias?.length]);

  const texto = (
    <div className={styles.phTexto} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {titulo ? (
        <h3 className={styles.phPortadaTitulo} style={{ margin: 0, whiteSpace: "pre-wrap", textShadow: "none", ...estiloTextoCSS(estiloTitulo) }}>
          {renderConDestacado(titulo, estiloTitulo?.colorDestacado, estiloTitulo?.grosorDestacado)}
        </h3>
      ) : (
        <Title w="65%" />
      )}
      {subtitulo ? (
        <p className={styles.phPortadaSubtitulo} style={{ margin: 0, whiteSpace: "pre-wrap", textShadow: "none", ...estiloTextoCSS(estiloSubtitulo) }}>
          {renderConDestacado(subtitulo, estiloSubtitulo?.colorDestacado, estiloSubtitulo?.grosorDestacado)}
        </p>
      ) : (
        <><Bar w="100%" /><Bar w="92%" /><Bar w="88%" /><Bar w="95%" /><Bar w="78%" /><Bar w="83%" /><Bar w="60%" /></>
      )}
    </div>
  );

  const img = (
    <div className={styles.phImagen} style={{ position: "relative", overflow: "hidden" }}>
      {(medias ?? []).map((m, i) => {
        const isVideo = m.tipo === "video";
        return (
          <div
            key={m.url}
            className={styles.phSlideFade}
            style={{
              position: "absolute",
              inset: 0,
              opacity: i === idx ? 1 : 0,
              pointerEvents: i === idx ? "auto" : "none",
              transition: "opacity 0.8s ease"
            }}
          >
            {isVideo ? (
              <VideoBg url={m.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            ) : (
              <div style={{ backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center", position: "absolute", inset: 0 }} />
            )}
          </div>
        );
      })}
      {(medias ?? []).length === 0 && (
        <Image size={28} className={styles.phImagenIcon} />
      )}
    </div>
  );

  const customMaxWidth = anchoMax === "900px" ? "min(900px, 46.875cqw)" : anchoMax === "1200px" ? "min(1200px, 62.5cqw)" : "min(1920px, 100cqw)";
  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div className={`${styles.phTextoImagenes} ${mobile ? styles.phCol1 : ""}`} style={{ maxWidth: customMaxWidth }}>
          {imgIzq ? <>{img}{texto}</> : <>{texto}{img}</>}
        </div>
      </Ph>
    </div>
  );
}

function PHItinerarioMediaCarousel({ medias, showArrows, autoplay = true }: { medias: MediaItem[]; showArrows?: boolean; autoplay?: boolean }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!medias || medias.length < 2 || !autoplay) return;
    const t = setInterval(() => {
      setIdx(prev => (prev + 1) % medias.length);
    }, 5000);
    return () => clearInterval(t);
  }, [medias, autoplay]);

  useEffect(() => {
    setIdx(0);
  }, [medias.length]);

  if (!medias || medias.length === 0) return null;

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx(prev => (prev + 1) % medias.length);
  };
  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx(prev => (prev - 1 + medias.length) % medias.length);
  };

  const currentMedia = medias[idx];

  return (
    <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <div
        style={{
          backgroundImage: `url(${currentMedia.url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "absolute",
          inset: 0,
          transition: "background-image 0.4s ease"
        }}
      />
      {medias.length > 1 && showArrows && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            padding: "4px 8px",
            borderRadius: "16px",
            color: "#ffffff",
            zIndex: 10,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            fontSize: "0.72rem",
            fontWeight: 700,
            fontFamily: "monospace"
          }}
        >
          <button
            type="button"
            onClick={prev}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px",
              opacity: 0.8,
              transition: "opacity 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}
          >
            <ChevronLeft size={12} />
          </button>
          <span style={{ letterSpacing: "0.05em", padding: "0 2px" }}>
            {`<${idx + 1}/${medias.length}>`}
          </span>
          <button
            type="button"
            onClick={next}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px",
              opacity: 0.8,
              transition: "opacity 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}
          >
            <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function renderTextWithBold(text?: string, estilo?: TextoEstilo) {
  if (!text) return null;
  const lineas = text.split("\n");
  return lineas.map((linea, index) => {
    const trimmed = linea.trim();
    const esVineta = trimmed.startsWith(".-");
    const contenidoLinea = esVineta ? trimmed.slice(2).trim() : linea;

    const parts = contenidoLinea.split("**");
    const lineContent = parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} style={{ color: estilo?.colorDestacado ?? undefined, fontWeight: estilo?.grosorDestacado ?? "800" }}>{part}</strong>;
      }
      return part;
    });

    if (esVineta) {
      return (
        <span key={index} style={{ display: "flex", gap: "8px", alignItems: "flex-start", paddingLeft: "8px", marginTop: "4px", marginBottom: "4px", textAlign: "left" }}>
          <span style={{ color: estilo?.colorDestacado ?? undefined, fontWeight: "bold" }}>•</span>
          <span style={{ flex: 1 }}>{lineContent}</span>
        </span>
      );
    } else {
      return (
        <span key={index} style={{ display: "block", minHeight: linea === "" ? "0.75em" : undefined }}>
          {lineContent}
        </span>
      );
    }
  });
}

function PHItinerario({ mobile, layout, colorFondo, fechaDesde, fechaHasta, dias, titulo, estiloTitulo, estiloTituloDia, estiloDescDia, anchoMax }: { mobile?: boolean; layout?: string; colorFondo?: string; fechaDesde?: string; fechaHasta?: string; dias?: { dia: number; titulo?: string; desc?: string; media?: MediaItem; medias?: MediaItem[] }[]; titulo?: string; estiloTitulo?: TextoEstilo; estiloTituloDia?: TextoEstilo; estiloDescDia?: TextoEstilo; anchoMax?: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const esAcordeon = layout === "acordeon";

  let daysCount = 5;
  if (fechaDesde && fechaHasta) {
    const start = new Date(fechaDesde);
    const end = new Date(fechaHasta);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      daysCount = diffDays > 0 ? diffDays : 1;
    }
  }

  const days = Array.from({ length: daysCount }, (_, i) => ({ dia: i + 1 }));

  // Adjust active index if it exceeds the new days list
  useEffect(() => {
    if (activeIdx >= daysCount) {
      setActiveIdx(0);
    }
  }, [daysCount, activeIdx]);

  const getDayMedias = (diaData: any) => {
    if (diaData.medias && diaData.medias.length > 0) return diaData.medias;
    if (diaData.media) return [diaData.media];
    return [];
  };

  const customMaxWidth = anchoMax === "900px" ? "min(900px, 46.875cqw)" : anchoMax === "1200px" ? "min(1200px, 62.5cqw)" : "min(1920px, 100cqw)";

  if (esAcordeon && !mobile) {
    return (
      <div style={{ background: colorFondo ?? "#ffffff" }}>
        <Ph>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: customMaxWidth, margin: "0 auto" }}>
            {titulo ? (
              <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 4px 0", ...estiloTextoCSS(estiloTitulo) }}>{titulo}</h3>
            ) : (
              <div style={{ width: "35%", height: "18px", borderRadius: "9px", background: "#cbd5e1", margin: "0 0 4px 0" }} />
            )}
            <div className={styles.phItinerarioAcordeon}>
              {days.map((d, i) => {
                const active = activeIdx === i;
                const diaData: { dia?: number; titulo?: string; desc?: string; media?: MediaItem; medias?: MediaItem[] } = (dias ?? []).find(x => x.dia === d.dia) ?? {};
                const dayMedias = getDayMedias(diaData);
                return (
                  <div
                    key={d.dia}
                    className={`${styles.phAcordeonCard} ${active ? styles.phAcordeonCardActive : ""}`}
                    onClick={() => setActiveIdx(i)}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    {/* Background placeholder image */}
                    <div className={styles.phAcordeonBg} style={dayMedias.length > 0 ? { border: "none" } : undefined}>
                      {dayMedias.length > 0 ? (
                        <PHItinerarioMediaCarousel medias={dayMedias} showArrows={active} autoplay={active} />
                      ) : (
                        <Image size={24} className={styles.phAcordeonBgIcon} />
                      )}
                    </div>
                    <div className={styles.phAcordeonOverlay} />

                    {!active ? (
                      <div className={styles.phAcordeonColapsado} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", zIndex: 2, height: "100%" }}>
                        {/* Placeholder day indicator line/box */}
                        <div style={{ width: "20px", height: "20px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: "bold", color: "#ffffff" }}>
                          {d.dia}
                        </div>
                        {/* Vertical text / line representing vertical text/title placeholder */}
                        {diaData.titulo ? (
                          <span className={styles.phAcordeonTitleV} style={{ fontSize: "1.1rem", color: "#ffffff", whiteSpace: "nowrap", marginTop: "auto", ...estiloTextoCSS(estiloTituloDia) }}>{diaData.titulo}</span>
                        ) : (
                          <div style={{ width: "6px", height: "100px", borderRadius: "3px", background: "rgba(255, 255, 255, 0.2)", marginTop: "auto" }} />
                        )}
                      </div>
                    ) : (
                      <div className={styles.phAcordeonExpandido} style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "1.5rem 1.25rem", gap: "8px", zIndex: 2 }}>
                        {/* Top row showing Día X */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexShrink: 0 }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.07em", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                            Día {d.dia}
                          </span>
                        </div>

                        {/* Bottom aligned content */}
                        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {/* Title or white skeleton line */}
                          {diaData.titulo ? (
                            <h4 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff", margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.4)", ...estiloTextoCSS(estiloTituloDia) }}>{diaData.titulo}</h4>
                          ) : (
                            <div style={{ width: "50%", height: "14px", borderRadius: "7px", background: "#ffffff", marginTop: "4px" }} />
                          )}
                          {/* Description or skeleton lines inside scrollable container */}
                          <div className={styles.phAcordeonScroll} style={{ overflowY: "auto", maxHeight: "300px", paddingRight: "4px" }}>
                            {diaData.desc ? (
                              <p style={{ fontSize: "0.82rem", color: "rgba(255, 255, 255, 0.95)", margin: 0, textShadow: "0 1px 2px rgba(0,0,0,0.4)", lineHeight: 1.4, whiteSpace: "pre-wrap", ...estiloTextoCSS(estiloDescDia) }}>{renderTextWithBold(diaData.desc, estiloDescDia)}</p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ width: "85%", height: "8px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.7)" }} />
                                <div style={{ width: "80%", height: "8px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.7)" }} />
                                <div style={{ width: "55%", height: "8px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.7)" }} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Ph>
      </div>
    );
  }

  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", maxWidth: customMaxWidth, margin: "0 auto" }}>
          {titulo ? (
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 4px 0", ...estiloTextoCSS(estiloTitulo) }}>{titulo}</h3>
          ) : (
            <div style={{ width: "35%", height: "18px", borderRadius: "9px", background: "#cbd5e1", margin: "0 0 4px 0" }} />
          )}
          <div className={styles.phItinerario}>
            {days.map((d, i) => {
              const par = i % 2 === 0;
              const diaData: { dia?: number; titulo?: string; desc?: string; media?: MediaItem; medias?: MediaItem[] } = (dias ?? []).find(x => x.dia === d.dia) ?? {};
              const dayMedias = getDayMedias(diaData);
              const texto = (
                <div className={styles.phItinerarioTexto} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: "bold", color: "#ffffff" }}>
                      {d.dia}
                    </div>
                    <div style={{ width: "35px", height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
                  </div>
                  {diaData.titulo ? (
                    <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", margin: 0, ...estiloTextoCSS(estiloTituloDia) }}>{diaData.titulo}</h4>
                  ) : (
                    <Title w="60%" />
                  )}
                  {diaData.desc ? (
                    <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", ...estiloTextoCSS(estiloDescDia) }}>{renderTextWithBold(diaData.desc, estiloDescDia)}</p>
                  ) : (
                    <>
                      <Bar w="95%" />
                      <Bar w="90%" />
                      <Bar w="55%" />
                    </>
                  )}
                </div>
              );
              const img = (
                <div className={styles.phImagen} style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden", borderRadius: "0.5rem", border: dayMedias.length > 0 ? "none" : undefined }}>
                  {dayMedias.length > 0 ? (
                    <PHItinerarioMediaCarousel medias={dayMedias} showArrows={true} />
                  ) : (
                    <Image size={24} className={styles.phImagenIcon} />
                  )}
                </div>
              );
              return (
                <div key={d.dia} className={`${styles.phItinerarioRow} ${mobile ? styles.phCol1 : ""}`} style={{ gap: "1.5rem" }}>
                  {mobile ? <>{img}{texto}</> : par ? <>{texto}{img}</> : <>{img}{texto}</>}
                </div>
              );
            })}
          </div>
        </div>
      </Ph>
    </div>
  );
}

function PHMapa({ titulo, mapas, layout, anchoMax, colorFondo }: {
  titulo?: string;
  mapas?: MapaItem[];
  layout?: string;
  anchoMax?: string;
  colorFondo?: string;
}) {
  const customMaxWidth = anchoMax === "900px" ? "min(900px, 46.875cqw)" : anchoMax === "1200px" ? "min(1200px, 62.5cqw)" : "min(1920px, 100cqw)";
  const mapasList = mapas ?? [];
  const allUbicaciones = mapasList.flatMap(m => m.ubicaciones ?? []);
  // -1 = tab "Todos"
  const [activeMapaIdx, setActiveMapaIdx] = useState<number>(-1);
  const [showList, setShowList] = useState(false);
  const isAll = activeMapaIdx === -1;
  const activeMapa = isAll ? null : mapasList[Math.min(activeMapaIdx, mapasList.length - 1)];
  const ubicaciones = isAll ? allUbicaciones : (activeMapa?.ubicaciones ?? []);
  const tabKey = isAll ? "todos" : (activeMapa?.uid ?? "none");
  const showTabs = mapasList.length > 0;
  const [openUbUid, setOpenUbUid] = useState<string | null>(null);
  const [modalImg, setModalImg] = useState<string | null>(null);

  const tabBar = (mb: string) => showTabs ? (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", marginBottom: mb, flexWrap: "wrap" }}>
      {/* Tab "Todos" — solo si hay más de un mapa */}
      {mapasList.length > 1 && (
        <button
          onClick={() => setActiveMapaIdx(-1)}
          style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem", fontWeight: isAll ? 700 : 500, color: isAll ? "#6366f1" : "#64748b", background: "none", border: "none", borderBottom: `2px solid ${isAll ? "#6366f1" : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}
        >
          Todos
        </button>
      )}
      {mapasList.map((m, i) => {
        const active = !isAll && activeMapaIdx === i;
        return (
          <button key={m.uid} onClick={() => setActiveMapaIdx(i)}
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem", fontWeight: active ? 700 : 500, color: active ? "#6366f1" : "#64748b", background: "none", border: "none", borderBottom: `2px solid ${active ? "#6366f1" : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}
          >
            {m.titulo || `Mapa ${i + 1}`}
          </button>
        );
      })}
    </div>
  ) : null;

  const locationList = (
    <div className={styles.phMapaLocationList}>
      {modalImg && (
        <div
          onClick={() => setModalImg(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <img
            src={modalImg}
            alt=""
            style={{ width: 600, maxWidth: "90vw", height: "auto", borderRadius: "0.6rem", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
      {ubicaciones.length > 0 ? ubicaciones.map((u, i) => {
        const isOpen = openUbUid === u.uid;
        const hasThumbs = (u.medias ?? []).length > 0;
        const hasContent = u.descripcion || hasThumbs;
        return (
          <div key={u.uid} style={{ borderRadius: "0.4rem", background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem", cursor: hasContent ? "pointer" : "default" }}
              onClick={() => hasContent && setOpenUbUid(isOpen ? null : u.uid)}
            >
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(71,85,105,0.9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.65rem", fontWeight: 800, color: "#fff" }}>{i + 1}</div>
              <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 700, color: "#1e293b" }}>{u.nombre ?? `Ubicación ${i + 1}`}</span>
              {hasContent && (
                <ChevronRight size={13} style={{ color: "#94a3b8", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
              )}
            </div>
            {isOpen && hasContent && (
              <div style={{ padding: "0 0.5rem 0.5rem 2.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {u.descripcion && (
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#475569", lineHeight: 1.5 }}>{u.descripcion}</p>
                )}
                {hasThumbs && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {(u.medias ?? []).map((m, mi) => (
                      <div
                        key={mi}
                        onClick={() => setModalImg(m.url)}
                        style={{ width: 52, height: 40, borderRadius: "0.3rem", backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer", border: "1px solid #e2e8f0" }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }) : (
        [1,2,3].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#e2e8f0", flexShrink: 0 }} />
            <div style={{ width: `${50 + i * 20}px`, height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div style={{ maxWidth: customMaxWidth, margin: "0 auto", padding: "1.5rem" }}>
          {titulo ? (
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 12px 0" }}>{titulo}</h3>
          ) : (
            <div style={{ width: "30%", height: "18px", borderRadius: "9px", background: "#cbd5e1", margin: "0 0 12px 0" }} />
          )}
          {layout === "mapa-listado" ? (
            <div className={styles.phMapaListado}>
              <div className={styles.phMapaContainer}>
                <MapaLeaflet ubicaciones={ubicaciones} key={tabKey} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {tabBar("0.75rem")}
                {locationList}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {tabBar("0.5rem")}
              <div className={styles.phMapaContainer} style={{ position: "relative" }}>
                <MapaLeaflet ubicaciones={ubicaciones} key={tabKey} />
                <button
                  onClick={() => setShowList(v => !v)}
                  style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, width: 34, height: 34, borderRadius: "0.4rem", background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  {showList ? <X size={16} color="#475569" /> : <Menu size={16} color="#475569" />}
                </button>
                {showList && (
                  <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(280px, 70%)", zIndex: 999, background: "rgba(255,255,255,0.97)", borderLeft: "1px solid #e2e8f0", boxShadow: "-4px 0 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <div style={{ padding: "0.5rem 0.75rem 0" }}>
                      {tabBar("0.5rem")}
                    </div>
                    <div style={{ padding: "0 0.5rem 0.5rem", flex: 1, overflowY: "auto" }}>
                      {locationList}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Ph>
    </div>
  );
}

function PHRuta({ titulo, rutas, layout, anchoMax, colorFondo }: {
  titulo?: string;
  rutas?: RutaItem[];
  layout?: string;
  anchoMax?: string;
  colorFondo?: string;
}) {
  const customMaxWidth = anchoMax === "900px" ? "min(900px, 46.875cqw)" : anchoMax === "1200px" ? "min(1200px, 62.5cqw)" : "min(1920px, 100cqw)";
  const rutasList = rutas ?? [];
  const allUbicaciones = rutasList.flatMap(r => r.ubicaciones ?? []);
  const [activeRutaIdx, setActiveRutaIdx] = useState<number>(-1);
  const [showList, setShowList] = useState(false);
  const [openUbUid, setOpenUbUid] = useState<string | null>(null);
  const [modalImg, setModalImg] = useState<string | null>(null);
  const isAll = activeRutaIdx === -1;
  const activeRuta = isAll ? null : rutasList[Math.min(activeRutaIdx, rutasList.length - 1)];
  const ubicaciones = isAll ? allUbicaciones : (activeRuta?.ubicaciones ?? []);
  const tabKey = isAll ? "todos" : (activeRuta?.uid ?? "none");
  const showTabs = rutasList.length > 0;

  const tabBar = (mb: string) => showTabs ? (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", marginBottom: mb, flexWrap: "wrap" }}>
      {rutasList.length > 1 && (
        <button onClick={() => setActiveRutaIdx(-1)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem", fontWeight: isAll ? 700 : 500, color: isAll ? "#6366f1" : "#64748b", background: "none", border: "none", borderBottom: `2px solid ${isAll ? "#6366f1" : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
          Todos
        </button>
      )}
      {rutasList.map((r, i) => {
        const active = !isAll && activeRutaIdx === i;
        return (
          <button key={r.uid} onClick={() => setActiveRutaIdx(i)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem", fontWeight: active ? 700 : 500, color: active ? "#6366f1" : "#64748b", background: "none", border: "none", borderBottom: `2px solid ${active ? "#6366f1" : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
            {r.titulo || `Ruta ${i + 1}`}
          </button>
        );
      })}
    </div>
  ) : null;

  const locationList = (
    <div className={styles.phMapaLocationList}>
      {modalImg && (
        <div onClick={() => setModalImg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={modalImg} alt="" style={{ width: 600, maxWidth: "90vw", height: "auto", borderRadius: "0.6rem", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }} onClick={e => e.stopPropagation()} />
        </div>
      )}
      {ubicaciones.length > 0 ? ubicaciones.map((u, i) => {
        const isOpen = openUbUid === u.uid;
        const hasThumbs = (u.medias ?? []).length > 0;
        const hasContent = u.descripcion || hasThumbs;
        return (
          <div key={u.uid} style={{ borderRadius: "0.4rem", background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem", cursor: hasContent ? "pointer" : "default" }} onClick={() => hasContent && setOpenUbUid(isOpen ? null : u.uid)}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(71,85,105,0.9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.65rem", fontWeight: 800, color: "#fff" }}>{i + 1}</div>
              <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 700, color: "#1e293b" }}>{u.nombre ?? `Destino ${i + 1}`}</span>
              {hasContent && <ChevronRight size={13} style={{ color: "#94a3b8", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />}
            </div>
            {isOpen && hasContent && (
              <div style={{ padding: "0 0.5rem 0.5rem 2.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {u.descripcion && <p style={{ margin: 0, fontSize: "0.74rem", color: "#475569", lineHeight: 1.5 }}>{u.descripcion}</p>}
                {hasThumbs && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {(u.medias ?? []).map((m, mi) => (
                      <div key={mi} onClick={() => setModalImg(m.url)} style={{ width: 52, height: 40, borderRadius: "0.3rem", backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer", border: "1px solid #e2e8f0" }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }) : (
        [1,2,3].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#e2e8f0", flexShrink: 0 }} />
            <div style={{ width: `${50 + i * 20}px`, height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div style={{ maxWidth: customMaxWidth, margin: "0 auto", padding: "1.5rem" }}>
          {titulo ? (
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 12px 0" }}>{titulo}</h3>
          ) : (
            <div style={{ width: "30%", height: "18px", borderRadius: "9px", background: "#cbd5e1", margin: "0 0 12px 0" }} />
          )}
          {layout === "mapa-listado" ? (
            <div className={styles.phMapaListado}>
              <div className={styles.phMapaContainer}>
                <RutaLeaflet rutas={rutasList} activeRutaIdx={activeRutaIdx} key={tabKey} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {tabBar("0.75rem")}
                {locationList}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {tabBar("0.5rem")}
              <div className={styles.phMapaContainer} style={{ position: "relative" }}>
                <RutaLeaflet rutas={rutasList} activeRutaIdx={activeRutaIdx} key={tabKey} />
                <button onClick={() => setShowList(v => !v)} style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, width: 34, height: 34, borderRadius: "0.4rem", background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {showList ? <X size={16} color="#475569" /> : <Menu size={16} color="#475569" />}
                </button>
                {showList && (
                  <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(280px, 70%)", zIndex: 999, background: "rgba(255,255,255,0.97)", borderLeft: "1px solid #e2e8f0", boxShadow: "-4px 0 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <div style={{ padding: "0.5rem 0.75rem 0" }}>{tabBar("0.5rem")}</div>
                    <div style={{ padding: "0 0.5rem 0.5rem", flex: 1, overflowY: "auto" }}>{locationList}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Ph>
    </div>
  );
}

function PHPrecio({ mobile, tablet }: { mobile?: boolean; tablet?: boolean }) {
  const cols = mobile ? 1 : tablet ? 2 : 3;
  return (
    <Ph>
      <div className={styles.phPrecioRow} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, n) => (
          <div key={n} className={styles.phPrecioCard}>
            <Bar w="60%" /><Bar w="40%" /><Bar w="80%" /><Bar w="80%" /><Bar w="80%" />
            <div className={styles.phPrecioBtn} />
          </div>
        ))}
      </div>
    </Ph>
  );
}

function PHFormulario({ mobile }: { mobile?: boolean }) {
  return (
    <Ph>
      <div className={styles.phFormulario}>
        {mobile
          ? <><Bloque h="28px" /><Bloque h="28px" /></>
          : <div className={styles.phFormRow}><Bloque h="28px" /><Bloque h="28px" /></div>
        }
        <Bloque h="28px" />
        <Bloque h="52px" />
        <div className={styles.phFormBtn} />
      </div>
    </Ph>
  );
}

function PHFooter({ mobile }: { mobile?: boolean }) {
  return (
    <Ph>
      <div className={`${styles.phFooter} ${mobile ? styles.phCol1 : ""}`}>
        <div className={styles.phFooterCol}><Bar w="50%" /><Bar w="80%" /><Bar w="70%" /></div>
        {!mobile && <div className={styles.phFooterCol}><Bar w="50%" /><Bar w="60%" /><Bar w="60%" /></div>}
        {!mobile && <div className={styles.phFooterCol}><Bar w="50%" /><Bar w="70%" /><Bar w="40%" /></div>}
      </div>
    </Ph>
  );
}

function PHTextoColumnas({
  mobile,
  layout,
  titulo,
  colorFondo,
  estiloTitulo,
  estiloTituloDia,
  estiloDescDia,
  columnas,
  anchoMax
}: {
  mobile?: boolean;
  layout?: string;
  titulo?: string;
  colorFondo?: string;
  estiloTitulo?: TextoEstilo;
  estiloTituloDia?: TextoEstilo;
  estiloDescDia?: TextoEstilo;
  columnas?: { titulo?: string; texto?: string }[];
  anchoMax?: string;
}) {
  const colCount = layout === "2-cols" ? 2 : layout === "4-cols" ? 4 : 3;
  const gridClass = mobile
    ? styles.phCol1
    : layout === "2-cols"
    ? styles.phCol2
    : layout === "4-cols"
    ? styles.phCol4
    : styles.phCol3;

  const defaultCols = [
    { titulo: "Columna 1", texto: ".- Elemento de ejemplo." },
    { titulo: "Columna 2", texto: ".- Elemento de ejemplo." },
    { titulo: "Columna 3", texto: ".- Elemento de ejemplo." },
    { titulo: "Columna 4", texto: ".- Elemento de ejemplo." }
  ];

  const displayCols = Array.from({ length: colCount }).map((_, idx) => {
    return (columnas ?? [])[idx] || defaultCols[idx % defaultCols.length];
  });

  const customMaxWidth = anchoMax === "900px" ? "min(900px, 46.875cqw)" : anchoMax === "1200px" ? "min(1200px, 62.5cqw)" : "min(1920px, 100cqw)";

  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div className={styles.phTextoColumnas} style={{ maxWidth: customMaxWidth }}>
          {titulo ? (
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 4px 0", ...estiloTextoCSS(estiloTitulo) }}>{titulo}</h3>
          ) : (
            <div style={{ width: "35%", height: "18px", borderRadius: "9px", background: "#cbd5e1", margin: "0 0 4px 0" }} />
          )}
          <div className={`${styles.phColumnasGrid} ${gridClass}`}>
            {displayCols.map((c, i) => (
              <div key={i} className={styles.phColumnaCard}>
                {c.titulo ? (
                  <h4 className={styles.phColumnaTitulo} style={estiloTextoCSS(estiloTituloDia)}>{c.titulo}</h4>
                ) : (
                  <div style={{ width: "60%", height: "12px", borderRadius: "6px", background: "#cbd5e1" }} />
                )}
                {c.texto ? (
                  <p className={styles.phColumnaTexto} style={estiloTextoCSS(estiloDescDia)}>{renderTextWithBold(c.texto, estiloDescDia)}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ width: "90%", height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
                    <div style={{ width: "85%", height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
                    <div style={{ width: "60%", height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Ph>
    </div>
  );
}

export function renderSeccion(s: Seccion, canvasHeight: string, dispositivo: Dispositivo, allSecciones?: Seccion[]) {
  const mobile = dispositivo === "mobile";
  const tablet = dispositivo === "tablet";
  switch (s.tipo) {
    case "menu":           return <PHMenu key={s.uid} mobile={mobile} seccion={s} secciones={allSecciones} />;
    case "portada":        return <PHPortada key={s.uid} height={canvasHeight} layout={s.layout} titulo={s.titulo} subtitulo={s.subtitulo} medias={s.medias} estiloTitulo={s.estiloTitulo} estiloSubtitulo={s.estiloSubtitulo} colorFondo={s.colorFondo} />;
    case "texto-imagenes": return <PHTextoImagenes key={s.uid} mobile={mobile} layout={s.layout} titulo={s.titulo} subtitulo={s.subtitulo} medias={s.medias} colorFondo={s.colorFondo} estiloTitulo={s.estiloTitulo} estiloSubtitulo={s.estiloSubtitulo} anchoMax={s.anchoMax} />;
    case "texto-columnas": return <PHTextoColumnas key={s.uid} mobile={mobile} layout={s.layout} titulo={s.titulo} colorFondo={s.colorFondo} estiloTitulo={s.estiloTitulo} estiloTituloDia={s.estiloTituloDia} estiloDescDia={s.estiloDescDia} columnas={s.columnas} anchoMax={s.anchoMax} />;
    case "itinerario":     return <PHItinerario key={s.uid} mobile={mobile} layout={s.layout} colorFondo={s.colorFondo} fechaDesde={s.fechaDesde} fechaHasta={s.fechaHasta} dias={s.dias} titulo={s.titulo} estiloTitulo={s.estiloTitulo} estiloTituloDia={s.estiloTituloDia} estiloDescDia={s.estiloDescDia} anchoMax={s.anchoMax} />;
    case "mapa":           return <PHMapa key={s.uid} titulo={s.titulo} mapas={s.mapas} layout={s.layout} anchoMax={s.anchoMax} colorFondo={s.colorFondo} />;
    case "ruta":           return <PHRuta key={s.uid} titulo={s.titulo} rutas={s.rutas} layout={s.layout} anchoMax={s.anchoMax} colorFondo={s.colorFondo} />;
    case "precio":         return <PHPrecio key={s.uid} mobile={mobile} tablet={tablet} />;
    case "formulario":     return <PHFormulario key={s.uid} mobile={mobile} />;
    case "footer":         return <PHFooter key={s.uid} mobile={mobile} />;
    default: return <Ph key={s.uid}><span className={styles.phLabel}>{s.label}</span></Ph>;
  }
}

type MediaTab = "unsplash" | "link" | "upload" | "video";

interface UnsplashPhoto { id: string; thumb: string; full: string; alt: string; author: string; authorUrl: string; }

function MediaSelector({ value, onChange }: { value?: Seccion["media"]; onChange: (m: Seccion["media"]) => void }) {
  const [mediaTab, setMediaTab] = useState<MediaTab>("unsplash");
  const [inputVal, setInputVal] = useState(value?.url ?? "");
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const buscar = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setPhotos(data.results ?? []);
    } finally {
      setLoading(false);
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

const FUENTES = ["Raleway", "Montserrat", "Roboto", "Special Elite", "Serif"];
const TAMANIOS = ["12px","14px","16px","18px","20px","24px","28px","32px","40px","48px","56px","64px","72px"];
const GROSORES = ["300","400","500","600","700","800"];
const ALIGN_H_OPTS = [
  { val: "left",    Icon: AlignLeft },
  { val: "center",  Icon: AlignCenter },
  { val: "right",   Icon: AlignRight },
  { val: "justify", Icon: AlignJustify },
];

function IconDropdown({ opts, value, onChange }: {
  opts: { val: string; Icon: React.ElementType }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = opts.find(o => o.val === value) ?? opts[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className={styles.iconDropdown}>
      <button className={styles.iconDropdownTrigger} onClick={() => setOpen(o => !o)}>
        <active.Icon size={13} />
      </button>
      {open && (
        <div className={styles.iconDropdownMenu}>
          {opts.map(({ val, Icon }) => (
            <button
              key={val}
              className={`${styles.iconDropdownItem} ${value === val ? styles.iconDropdownItemActive : ""}`}
              onClick={() => { onChange(val); setOpen(false); }}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TextoEstiloEditor({ label, value, onChange }: {
  label: string;
  value?: TextoEstilo;
  onChange: (v: TextoEstilo) => void;
}) {
  const v = value ?? {};
  const set = (k: keyof TextoEstilo, val: string) => onChange({ ...v, [k]: val });

  return (
    <div className={styles.textoEstiloEditor}>
      <p className={styles.textoEstiloLabel}>{label}</p>
      <div className={styles.textoEstiloRow}>
        <div className={`${styles.textoEstiloField} ${styles.textoEstiloFieldFuente}`}>
          <ALargeSmall size={13} className={styles.textoEstiloIcon} />
          <select value={v.fuente ?? "Montserrat"} onChange={e => set("fuente", e.target.value)}>
            {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className={`${styles.textoEstiloField} ${styles.textoEstiloFieldTamano}`}>
          <select value={v.tamano ?? "32px"} onChange={e => set("tamano", e.target.value)}>
            {TAMANIOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className={`${styles.textoEstiloField} ${styles.textoEstiloFieldGrosor}`}>
          <Bold size={13} className={styles.textoEstiloIcon} />
          <select value={v.grosor ?? "600"} onChange={e => set("grosor", e.target.value)}>
            {GROSORES.map(g => (
              <option key={g} value={g}>
                {g === "300" ? "L" : g === "400" ? "R" : g === "500" ? "M" : g === "600" ? "SB" : g === "700" ? "B" : "EB"}
              </option>
            ))}
          </select>
        </div>
        <IconDropdown
          opts={ALIGN_H_OPTS}
          value={v.alineacionH ?? "left"}
          onChange={val => set("alineacionH", val)}
        />
        <label className={styles.colorPickerBtn} title="Color texto" style={{ background: v.color ?? "#1e293b" }}>
          <input type="color" value={v.color ?? "#1e293b"} onChange={e => set("color", e.target.value)} />
        </label>
        <label className={styles.colorPickerBtn} title="Color destacado" style={{ background: v.colorDestacado ?? "#6366f1", outline: "2px dashed #94a3b8", outlineOffset: 2 }}>
          <input type="color" value={v.colorDestacado ?? "#6366f1"} onChange={e => set("colorDestacado", e.target.value)} />
        </label>
      </div>
    </div>
  );
}

function HighlightTextarea({
  value,
  onChange,
  placeholder,
  rows = 3
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backingRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const handleScroll = () => {
    if (textareaRef.current && backingRef.current) {
      backingRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    // Get text as plain text
    const text = e.clipboardData.getData("text/plain");

    // Get current cursor selection
    const start = e.currentTarget.selectionStart;
    const end = e.currentTarget.selectionEnd;
    const currentValue = e.currentTarget.value;

    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);

    const mockEvent = {
      target: { value: newValue }
    } as React.ChangeEvent<HTMLTextAreaElement>;

    onChange(mockEvent);

    // Set cursor position after the state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length;
      }
    }, 0);
  };

  const renderConDestacadoConAsteriscos = (texto: string) => {
    const partes = texto.split(/(\*\*.*?\*\*)/g);
    return partes.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color: "#6366f1", fontWeight: "bold" }}>{p}</strong>
        : p
    );
  };

  // Adjust height to content dynamically
  useEffect(() => {
    if (textareaRef.current && backingRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${nextHeight}px`;
      backingRef.current.style.height = `${nextHeight}px`;
    }
  }, [value]);

  return (
    <div style={{ position: "relative", width: "100%", height: "auto" }}>
      <div
        ref={backingRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          color: "#1e293b",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowY: "hidden",
          zIndex: 1,
          border: focused ? "1px solid #6366f1" : "1px solid #e2e8f0",
          borderRadius: "0.5rem",
          background: focused ? "#ffffff" : "#f8fafc",
          fontFamily: "inherit",
          fontSize: "0.83rem",
          lineHeight: "1.5",
          padding: "0.45rem 0.65rem",
          boxSizing: "border-box"
        }}
      >
        {renderConDestacadoConAsteriscos(value || " ")}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={rows}
        style={{
          position: "relative",
          width: "100%",
          display: "block",
          background: "transparent",
          border: "1px solid transparent",
          color: "transparent",
          caretColor: "#1e293b",
          zIndex: 2,
          resize: "none",
          fontFamily: "inherit",
          fontSize: "0.83rem",
          lineHeight: "1.5",
          padding: "0.45rem 0.65rem",
          outline: "none",
          boxSizing: "border-box",
          overflowY: "hidden"
        }}
      />
    </div>
  );
}

function PlacesSearchField({ ubicacionUid, mapaUid, currentNombre, seccion, onUpdate }: {
  ubicacionUid: string;
  mapaUid: string;
  currentNombre?: string;
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [q, setQ] = useState(currentNombre ?? "");
  const [suggestions, setSuggestions] = useState<import("@/actions/places").PlaceSuggestion[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const res = await searchPlaces(val);
        setSuggestions(res);
      } finally {
        setLoadingSugg(false);
      }
    }, 300);
  };

  const handleSelect = async (s: import("@/actions/places").PlaceSuggestion) => {
    setQ(s.fullText);
    setSuggestions([]);
    const details = await getPlaceDetails(s.placeId);
    if (!details) return;
    const newMedias: MediaItem[] = details.photos.map(p => ({
      tipo: "link" as const,
      url: `/api/places/photo?name=${encodeURIComponent(p.name)}`,
    }));
    const updatedMapas = (seccion.mapas ?? []).map(m => {
      if (m.uid !== mapaUid) return m;
      return {
        ...m,
        ubicaciones: (m.ubicaciones ?? []).map(u => {
          if (u.uid !== ubicacionUid) return u;
          return {
            ...u,
            placeId: details.placeId,
            nombre: details.displayName,
            direccion: details.formattedAddress,
            lat: details.lat ?? undefined,
            lng: details.lng ?? undefined,
            medias: newMedias,
          };
        }),
      };
    });
    onUpdate(seccion.uid, { mapas: updatedMapas });
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={q}
        onChange={e => handleChange(e.target.value)}
        placeholder="Buscar lugar..."
        className={styles.editorInput}
        style={{ width: "100%", background: "#ffffff" }}
      />
      {loadingSugg && <span style={{ fontSize: "0.72rem", color: "#94a3b8", paddingLeft: 4 }}>Buscando...</span>}
      {suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.4rem", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
          {suggestions.map(s => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => handleSelect(s)}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}
            >
              <span style={{ fontWeight: 600 }}>{s.mainText}</span>
              {s.secondaryText && <span style={{ color: "#64748b" }}> · {s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UbicacionEditor({ ub, mapaUid, seccion, onUpdate }: {
  ub: UbicacionMapa;
  mapaUid: string;
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [showMediaSelector, setShowMediaSelector] = useState(false);

  const patchUb = (patch: Partial<UbicacionMapa>) => {
    const updatedMapas = (seccion.mapas ?? []).map(m => {
      if (m.uid !== mapaUid) return m;
      return { ...m, ubicaciones: (m.ubicaciones ?? []).map(u => u.uid !== ub.uid ? u : { ...u, ...patch }) };
    });
    onUpdate(seccion.uid, { mapas: updatedMapas });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingTop: "0.3rem" }}>
      <PlacesSearchField
        ubicacionUid={ub.uid}
        mapaUid={mapaUid}
        currentNombre={ub.nombre}
        seccion={seccion}
        onUpdate={onUpdate}
      />
      {ub.direccion && (
        <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{ub.direccion}</div>
      )}
      <textarea
        value={ub.descripcion ?? ""}
        onChange={e => patchUb({ descripcion: e.target.value })}
        placeholder="Descripción de la ubicación..."
        rows={2}
        className={styles.editorInput}
        style={{ width: "100%", resize: "vertical", fontSize: "0.78rem", lineHeight: 1.4, background: "#ffffff" }}
      />
      {(ub.medias ?? []).length > 0 && (
        <div className={styles.placesPhotoGrid}>
          {(ub.medias ?? []).map((media, pIdx) => (
            <div key={pIdx} className={styles.placesPhotoThumb} style={{ backgroundImage: `url(${media.url})` }}>
              <button
                className={styles.placesPhotoRemove}
                type="button"
                onClick={() => patchUb({ medias: (ub.medias ?? []).filter((_, i) => i !== pIdx) })}
              ><X size={8} /></button>
            </div>
          ))}
        </div>
      )}
      {showMediaSelector ? (
        <MediaSelector
          value={undefined}
          onChange={m => {
            if (!m) return;
            patchUb({ medias: [...(ub.medias ?? []), m] });
            setShowMediaSelector(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowMediaSelector(true)}
          style={{ alignSelf: "flex-start", background: "none", border: "1px dashed #cbd5e1", borderRadius: "0.4rem", padding: "3px 10px", fontSize: "0.72rem", color: "#94a3b8", cursor: "pointer" }}
        >
          + Añadir imagen
        </button>
      )}
    </div>
  );
}

async function calcularSegmento(
  seccionUid: string,
  rutaUid: string,
  segIdx: number,
  modo: "foot-walking" | "driving-car",
  ub1: UbicacionMapa,
  ub2: UbicacionMapa,
  seccion: Seccion,
  onUpdate: (uid: string, patch: Partial<Seccion>) => void
) {
  if (ub1.lat == null || ub1.lng == null || ub2.lat == null || ub2.lng == null) return;
  try {
    const res = await fetch("/api/ors/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: modo, coordinates: [[ub1.lng, ub1.lat], [ub2.lng, ub2.lat]] }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const updatedRutas = (seccion.rutas ?? []).map(r => {
      if (r.uid !== rutaUid) return r;
      const segs = [...(r.segmentos ?? [])];
      segs[segIdx] = { ...segs[segIdx], uid: segs[segIdx]?.uid ?? crypto.randomUUID(), modo, polyline: data.polyline };
      return { ...r, segmentos: segs };
    });
    onUpdate(seccionUid, { rutas: updatedRutas });
  } catch {}
}

function PlacesSearchFieldRuta({ ubicacionUid, rutaUid, currentNombre, seccion, onUpdate }: {
  ubicacionUid: string;
  rutaUid: string;
  currentNombre?: string;
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [q, setQ] = useState(currentNombre ?? "");
  const [suggestions, setSuggestions] = useState<import("@/actions/places").PlaceSuggestion[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const res = await searchPlaces(val);
        setSuggestions(res);
      } finally {
        setLoadingSugg(false);
      }
    }, 300);
  };

  const handleSelect = async (s: import("@/actions/places").PlaceSuggestion) => {
    setQ(s.fullText);
    setSuggestions([]);
    const details = await getPlaceDetails(s.placeId);
    if (!details) return;
    const newMedias: MediaItem[] = details.photos.map(p => ({
      tipo: "link" as const,
      url: `/api/places/photo?name=${encodeURIComponent(p.name)}`,
    }));
    const updatedRutas = (seccion.rutas ?? []).map(r => {
      if (r.uid !== rutaUid) return r;
      return {
        ...r,
        ubicaciones: (r.ubicaciones ?? []).map(u => {
          if (u.uid !== ubicacionUid) return u;
          return {
            ...u,
            placeId: details.placeId,
            nombre: details.displayName,
            direccion: details.formattedAddress,
            lat: details.lat ?? undefined,
            lng: details.lng ?? undefined,
            medias: newMedias,
          };
        }),
      };
    });
    const nextSeccion = { ...seccion, rutas: updatedRutas };
    onUpdate(seccion.uid, { rutas: updatedRutas });
    const ruta = updatedRutas.find(r => r.uid === rutaUid);
    if (!ruta) return;
    const ubs = ruta.ubicaciones ?? [];
    const uIdx = ubs.findIndex(u => u.uid === ubicacionUid);
    if (uIdx > 0) {
      const prev = ubs[uIdx - 1];
      const curr = ubs[uIdx];
      const modo = (ruta.segmentos ?? [])[uIdx - 1]?.modo ?? "driving-car";
      await calcularSegmento(seccion.uid, rutaUid, uIdx - 1, modo, prev, { ...curr, lat: details.lat ?? undefined, lng: details.lng ?? undefined }, nextSeccion, onUpdate);
    }
    if (uIdx < ubs.length - 1) {
      const curr = ubs[uIdx];
      const next = ubs[uIdx + 1];
      const modo = (ruta.segmentos ?? [])[uIdx]?.modo ?? "driving-car";
      await calcularSegmento(seccion.uid, rutaUid, uIdx, modo, { ...curr, lat: details.lat ?? undefined, lng: details.lng ?? undefined }, next, nextSeccion, onUpdate);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={q}
        onChange={e => handleChange(e.target.value)}
        placeholder="Buscar lugar..."
        className={styles.editorInput}
        style={{ width: "100%", background: "#ffffff" }}
      />
      {loadingSugg && <span style={{ fontSize: "0.72rem", color: "#94a3b8", paddingLeft: 4 }}>Buscando...</span>}
      {suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.4rem", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
          {suggestions.map(s => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => handleSelect(s)}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}
            >
              <span style={{ fontWeight: 600 }}>{s.mainText}</span>
              {s.secondaryText && <span style={{ color: "#64748b" }}> · {s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UbicacionEditorRuta({ ub, rutaUid, seccion, onUpdate }: {
  ub: UbicacionMapa;
  rutaUid: string;
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [showMediaSelector, setShowMediaSelector] = useState(false);

  const patchUb = (patch: Partial<UbicacionMapa>) => {
    const updatedRutas = (seccion.rutas ?? []).map(r => {
      if (r.uid !== rutaUid) return r;
      return { ...r, ubicaciones: (r.ubicaciones ?? []).map(u => u.uid !== ub.uid ? u : { ...u, ...patch }) };
    });
    onUpdate(seccion.uid, { rutas: updatedRutas });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingTop: "0.3rem" }}>
      <PlacesSearchFieldRuta
        ubicacionUid={ub.uid}
        rutaUid={rutaUid}
        currentNombre={ub.nombre}
        seccion={seccion}
        onUpdate={onUpdate}
      />
      {ub.direccion && (
        <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{ub.direccion}</div>
      )}
      <textarea
        value={ub.descripcion ?? ""}
        onChange={e => patchUb({ descripcion: e.target.value })}
        placeholder="Descripción del destino..."
        rows={2}
        className={styles.editorInput}
        style={{ width: "100%", resize: "vertical", fontSize: "0.78rem", lineHeight: 1.4, background: "#ffffff" }}
      />
      {(ub.medias ?? []).length > 0 && (
        <div className={styles.placesPhotoGrid}>
          {(ub.medias ?? []).map((media, pIdx) => (
            <div key={pIdx} className={styles.placesPhotoThumb} style={{ backgroundImage: `url(${media.url})` }}>
              <button
                className={styles.placesPhotoRemove}
                type="button"
                onClick={() => patchUb({ medias: (ub.medias ?? []).filter((_, i) => i !== pIdx) })}
              ><X size={8} /></button>
            </div>
          ))}
        </div>
      )}
      {showMediaSelector ? (
        <MediaSelector
          value={undefined}
          onChange={m => {
            if (!m) return;
            patchUb({ medias: [...(ub.medias ?? []), m] });
            setShowMediaSelector(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowMediaSelector(true)}
          style={{ alignSelf: "flex-start", background: "none", border: "1px dashed #cbd5e1", borderRadius: "0.4rem", padding: "3px 10px", fontSize: "0.72rem", color: "#94a3b8", cursor: "pointer" }}
        >
          + Añadir imagen
        </button>
      )}
    </div>
  );
}

function MenuEditorContenido({ seccion, onUpdate, todasSecciones }: { seccion: Seccion; onUpdate: (uid: string, patch: Partial<Seccion>) => void; todasSecciones?: Seccion[] }) {
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

function EditorPanel({ seccion, onClose, onRename, onUpdate, isFav, onToggleFav, todasSecciones }: { seccion: Seccion; onClose: () => void; onRename: (uid: string, label: string) => void; onUpdate: (uid: string, patch: Partial<Seccion>) => void; isFav: boolean; onToggleFav: () => void; todasSecciones?: Seccion[] }) {
  const [tab, setTab] = useState<"contenido" | "diseño">("contenido");
  const [mediaAbierto, setMediaAbierto] = useState<boolean | number | "new" | string>(false);
  const [expandedDayIdx, setExpandedDayIdx] = useState<number | null>(null);

  useEffect(() => {
    setMediaAbierto(false);
    setExpandedDayIdx(null);
  }, [seccion.uid]);

  const updateDia = (dayNum: number, patch: Partial<any>) => {
    const currentDias = [...(seccion.dias ?? [])];
    const index = currentDias.findIndex(d => d.dia === dayNum);
    if (index >= 0) {
      currentDias[index] = { ...currentDias[index], ...patch };
    } else {
      currentDias.push({ dia: dayNum, ...patch });
    }
    onUpdate(seccion.uid, { dias: currentDias });
  };

  const [optimizandoIA, setOptimizandoIA] = useState<string | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState<string | null>(null);
  const [ubAbierta, setUbAbierta] = useState<string | null>(null);
  const [rutaAbierta, setRutaAbierta] = useState<string | null>(null);
  const [ubRutaAbierta, setUbRutaAbierta] = useState<string | null>(null);

  useEffect(() => {
    setMapaAbierto((seccion.mapas ?? [])[0]?.uid ?? null);
    setUbAbierta(null);
    setRutaAbierta((seccion.rutas ?? [])[0]?.uid ?? null);
    setUbRutaAbierta(null);
  }, [seccion.uid]);

  const mejorarConIA = async (campo: "titulo" | "subtitulo") => {
    const valorActual = seccion[campo] ?? "";
    if (!valorActual.trim()) return;

    setOptimizandoIA(campo);
    await new Promise(resolve => setTimeout(resolve, 1200));

    let nuevoValor = valorActual;

    // Analizador de texto inteligente para viajes en español
    const palabras = valorActual.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/);
    
    // Buscar números + "días" o "semanas" o "noches"
    let duracion = "";
    const duracionMatch = valorActual.match(/(\d+)\s*(días|dias|noches|semanas|d)/i);
    if (duracionMatch) {
      duracion = duracionMatch[0]; // ej: "6 días"
    }

    // Extraer nombres propios o términos importantes (capitalizados)
    // O palabras de más de 4 letras que no sean preposiciones/artículos comunes
    const stopWords = new Set(["para", "como", "pero", "este", "esta", "unos", "unas", "todo", "toda", "desde", "hasta", "entre", "sobre", "viaje", "ruta", "magia", "cumbres", "aventura"]);
    const terminosClave: string[] = [];
    palabras.forEach(p => {
      if (p.length > 3 && !stopWords.has(p.toLowerCase())) {
        // Si empieza por mayúscula o es una palabra importante
        if (p[0] === p[0].toUpperCase() || p.toLowerCase() === "portaventura" || p.toLowerCase() === "pirenaicas" || p.toLowerCase() === "pirineos" || p.toLowerCase() === "barcelona" || p.toLowerCase() === "salou") {
          terminosClave.push(p.replace(/\*\*/g, ""));
        }
      }
    });

    const destino1 = terminosClave[0] ?? "tu destino";
    const destino2 = terminosClave[1] ?? (terminosClave[0] ? "" : "la aventura");

    if (campo === "titulo") {
      // Crear títulos de alto impacto inspirados en agencias de viaje premium
      const plantillas = [
        `De las cumbres de **${destino1}** a la magia de **${destino2 || "PortAventura"}**${duracion ? ` en ${duracion}` : ""}`,
        `Aventura exclusiva: Explora **${destino1}** y **${destino2 || "sus secretos"}**`,
        `Ruta de contraste: Del encanto de **${destino1}** a **${destino2 || "un destino de ensueño"}**`,
        `El viaje definitivo: **${destino1}** y **${destino2 || "alrededores"}** al descubierto`,
        `Experiencia única: Descubre **${destino1}** y siente la adrenalina de **${destino2 || "PortAventura"}**`
      ];
      // Seleccionamos uno al azar o diferente al actual
      const filtradas = plantillas.filter(p => p.replace(/\*\*/g, "").toLowerCase() !== valorActual.replace(/\*\*/g, "").toLowerCase());
      nuevoValor = filtradas[Math.floor(Math.random() * filtradas.length)] ?? plantillas[0];
    } else {
      // Subtítulo: Crear un párrafo de alto impacto comercial/emocional
      const parrafos = [
        `Un recorrido diseñado con mimo para conectar con la naturaleza de **${destino1}** y disfrutar al máximo de **${destino2 || "PortAventura"}**. Disfruta de alojamientos seleccionados en régimen de media pensión, traslados privados de confort superior y accesos prioritarios para exprimir cada segundo del viaje sin colas ni preocupaciones.`,
        `Adéntrate en una experiencia irrepetible que combina la serenidad de **${destino1}** con las mejores actividades de **${destino2 || "aventura y diversión"}**. Una escapada perfecta pensada para viajeros exigentes que buscan el equilibrio perfecto entre desconexión, paisajes memorables y momentos inolvidables en privado.`,
        `Prepara las maletas para una ruta inolvidable que te llevará desde el corazón de **${destino1}** hasta los rincones más mágicos de **${destino2 || "nuestro itinerario"}**. Incluye guías locales certificados en destino, traslados de alta gama y atención personalizada 24/7 para garantizar un viaje totalmente seguro y confortable.`
      ];
      const filtrados = parrafos.filter(p => p.toLowerCase() !== valorActual.toLowerCase());
      nuevoValor = filtrados[Math.floor(Math.random() * filtrados.length)] ?? parrafos[0];
    }

    onUpdate(seccion.uid, { [campo]: nuevoValor });
    setOptimizandoIA(null);
  };

  return (
    <div className={styles.editorPanel}>
      <div className={styles.editorHeader}>
        <button className={styles.editorBack} onClick={onClose}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} />
        </button>
        <input
          className={styles.editorTitleInput}
          value={seccion.label}
          onChange={e => onRename(seccion.uid, e.target.value)}
          placeholder="Nombre…"
        />
        <button
          type="button"
          onClick={onToggleFav}
          title={isFav ? "Quitar de favoritos" : "Guardar en favoritos"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", flexShrink: 0, display: "flex", alignItems: "center", lineHeight: 1 }}
        >
          <Heart size={16} fill={isFav ? "#f472b6" : "none"} color={isFav ? "#f472b6" : "#94a3b8"} style={{ transition: "all 0.15s" }} />
        </button>
      </div>

      <div className={styles.editorTabs}>
        <button
          className={`${styles.editorTab} ${tab === "contenido" ? styles.editorTabActive : ""}`}
          onClick={() => setTab("contenido")}
        >
          <TableOfContents size={13} />
          Contenido
        </button>
        <button
          className={`${styles.editorTab} ${tab === "diseño" ? styles.editorTabActive : ""}`}
          onClick={() => setTab("diseño")}
        >
          <Palette size={13} />
          Diseño
        </button>
      </div>

      <div className={styles.editorBody}>
        {tab === "contenido" && seccion.tipo === "portada" && (
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
                placeholder="Título principal…"
                rows={2}
              />
            </div>
            <div className={styles.editorSection}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0px" }}>
                <label className={styles.editorFieldLabel} style={{ margin: 0 }}>Subtítulo</label>
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
                placeholder="Subtítulo o descripción…"
                rows={3}
              />
            </div>
          </>
        )}
        {tab === "contenido" && seccion.tipo === "texto-imagenes" && (
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
        )}
        {tab === "contenido" && seccion.tipo === "itinerario" && (() => {
          let daysCount = 5;
          if (seccion.fechaDesde && seccion.fechaHasta) {
            const start = new Date(seccion.fechaDesde);
            const end = new Date(seccion.fechaHasta);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const diffTime = end.getTime() - start.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
              daysCount = diffDays > 0 ? diffDays : 1;
            }
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div className={styles.editorSection}>
                <label className={styles.editorFieldLabel}>Título del itinerario</label>
                <input
                  type="text"
                  placeholder="Ej. Plan de ruta y actividades..."
                  value={seccion.titulo ?? ""}
                  onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
                  className={styles.editorInput}
                  style={{ width: "100%", background: "#ffffff" }}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                <div className={styles.editorSection} style={{ flex: 1 }}>
                  <label className={styles.editorFieldLabel}>Fecha desde</label>
                  <input
                    type="date"
                    value={seccion.fechaDesde ?? ""}
                    onChange={e => onUpdate(seccion.uid, { fechaDesde: e.target.value })}
                    className={styles.editorInput}
                    style={{ width: "100%" }}
                  />
                </div>
                <div className={styles.editorSection} style={{ flex: 1 }}>
                  <label className={styles.editorFieldLabel}>Fecha hasta</label>
                  <input
                    type="date"
                    value={seccion.fechaHasta ?? ""}
                    onChange={e => onUpdate(seccion.uid, { fechaHasta: e.target.value })}
                    className={styles.editorInput}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {daysCount > 0 && (() => {
                const fullDaysArray = Array.from({ length: daysCount }).map((_, idx) => {
                  const dayNum = idx + 1;
                  return (seccion.dias ?? []).find(d => d.dia === dayNum) || { dia: dayNum };
                });
                return (
                  <>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>
                      Días del itinerario
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {fullDaysArray.map((diaData, idx) => {
                        const dayNum = diaData.dia;
                        const isOpen = expandedDayIdx === dayNum;
                        return (
                          <div
                            key={dayNum}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData("text/plain", idx.toString());
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={e => {
                              e.preventDefault();
                            }}
                            onDrop={e => {
                              e.preventDefault();
                              const dragIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                              if (isNaN(dragIdx) || dragIdx === idx) return;
                              const newArray = [...fullDaysArray];
                              const [movedItem] = newArray.splice(dragIdx, 1);
                              newArray.splice(idx, 0, movedItem);
                              const updated = newArray.map((item, i) => ({ ...item, dia: i + 1 }));
                              onUpdate(seccion.uid, { dias: updated });
                            }}
                            style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden", background: "#f8fafc" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", background: "#ffffff" }}>
                              <div style={{ cursor: "grab", padding: "10px 0 10px 12px", display: "flex", alignItems: "center", color: "#94a3b8" }}>
                                <GripVertical size={14} />
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedDayIdx(isOpen ? null : dayNum)}
                                style={{ flex: 1, padding: "10px 12px 10px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                              >
                                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                                  Día {dayNum}: <span style={{ fontWeight: 400, color: "#64748b", marginLeft: "4px" }}>{diaData.titulo || "Sin título"}</span>
                                </span>
                                <ChevronRight size={14} style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: "#94a3b8" }} />
                              </button>
                            </div>

                            {isOpen && (
                              <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc" }}>
                                <div>
                                  <label className={styles.editorFieldLabel}>Imágenes del día</label>
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px", marginBottom: "8px" }}>
                                    {(diaData.medias ?? []).map((m, imgIdx) => {
                                      const thumbBg = `url(${m.url})`;
                                      const isSelecting = mediaAbierto === `day-${dayNum}-${imgIdx}`;
                                      return (
                                        <div
                                          key={imgIdx}
                                          style={{
                                            position: "relative",
                                            width: "50px",
                                            height: "50px",
                                            borderRadius: "4px",
                                            backgroundImage: thumbBg,
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                            border: "1px solid #cbd5e1",
                                            cursor: "pointer"
                                          }}
                                          onClick={() => setMediaAbierto(isSelecting ? false : `day-${dayNum}-${imgIdx}`)}
                                        >
                                          <button
                                            type="button"
                                            onClick={e => {
                                              e.stopPropagation();
                                              const arr = [...(diaData.medias ?? [])];
                                              arr.splice(imgIdx, 1);
                                              updateDia(dayNum, { medias: arr });
                                              setMediaAbierto(false);
                                            }}
                                            style={{
                                              position: "absolute",
                                              top: "-4px",
                                              right: "-4px",
                                              background: "#ef4444",
                                              color: "#ffffff",
                                              border: "none",
                                              borderRadius: "50%",
                                              width: "14px",
                                              height: "14px",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              cursor: "pointer",
                                              fontSize: "8px",
                                              padding: 0
                                            }}
                                          >
                                            <X size={8} />
                                          </button>
                                        </div>
                                      );
                                    })}
                                    {(diaData.medias ?? []).length < 5 && (
                                      <button
                                        type="button"
                                        onClick={() => setMediaAbierto(mediaAbierto === `day-${dayNum}-new` ? false : `day-${dayNum}-new`)}
                                        style={{ width: "50px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #cbd5e1", borderRadius: "4px", background: "#ffffff", cursor: "pointer" }}
                                      >
                                        <span style={{ fontSize: "1.2rem", color: "#64748b" }}>+</span>
                                      </button>
                                    )}
                                  </div>

                                  {mediaAbierto === `day-${dayNum}-new` && (
                                    <div style={{ marginTop: "8px" }}>
                                      <MediaSelector
                                        value={undefined}
                                        onChange={m => {
                                          if (!m) return;
                                          const arr = [...(diaData.medias ?? []), m];
                                          updateDia(dayNum, { medias: arr });
                                          setMediaAbierto(false);
                                        }}
                                      />
                                    </div>
                                  )}

                                  {typeof mediaAbierto === "string" && mediaAbierto.startsWith(`day-${dayNum}-`) && !mediaAbierto.endsWith("-new") && (() => {
                                    const parts = mediaAbierto.split("-");
                                    const imgIdx = parseInt(parts[parts.length - 1] ?? "", 10);
                                    if (isNaN(imgIdx)) return null;
                                    return (
                                      <div style={{ marginTop: "8px" }}>
                                        <MediaSelector
                                          value={diaData.medias?.[imgIdx]}
                                          onChange={m => {
                                            if (!m) return;
                                            const arr = [...(diaData.medias ?? [])];
                                            arr[imgIdx] = m;
                                            updateDia(dayNum, { medias: arr });
                                            setMediaAbierto(false);
                                          }}
                                        />
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div>
                                  <label className={styles.editorFieldLabel}>Título</label>
                                  <input
                                    type="text"
                                    placeholder="Título del día..."
                                    value={diaData.titulo ?? ""}
                                    onChange={e => updateDia(dayNum, { titulo: e.target.value })}
                                    className={styles.editorInput}
                                    style={{ width: "100%", background: "#ffffff" }}
                                  />
                                </div>

                                <div>
                                  <label className={styles.editorFieldLabel}>Descripción</label>
                                  <textarea
                                    placeholder="Descripción del día..."
                                    value={diaData.desc ?? ""}
                                    onChange={e => updateDia(dayNum, { desc: e.target.value })}
                                    className={styles.editorInput}
                                    rows={3}
                                    style={{ width: "100%", background: "#ffffff", resize: "vertical" }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          );
        })()}
        {tab === "contenido" && seccion.tipo === "texto-columnas" && (() => {
          const colCount = seccion.layout === "2-cols" ? 2 : seccion.layout === "4-cols" ? 4 : 3;
          const cols = Array.from({ length: colCount }).map((_, idx) => {
            return (seccion.columnas ?? [])[idx] || { titulo: `Columna ${idx + 1}`, texto: "" };
          });
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div className={styles.editorSection}>
                <label className={styles.editorFieldLabel}>Título de la sección</label>
                <input
                  type="text"
                  placeholder="Ej. Qué ofrecemos..."
                  value={seccion.titulo ?? ""}
                  onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
                  className={styles.editorInput}
                  style={{ width: "100%", background: "#ffffff" }}
                />
              </div>
              {cols.map((col, idx) => (
                <div key={idx} className={styles.editorSection} style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                  <label className={styles.editorFieldLabel} style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                    <span>Columna {idx + 1}</span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                    <input
                      type="text"
                      placeholder="Título de la columna"
                      value={col.titulo ?? ""}
                      onChange={e => {
                        const nextCols = [...(seccion.columnas ?? [])];
                        while (nextCols.length <= idx) nextCols.push({ titulo: "", texto: "" });
                        nextCols[idx] = { ...nextCols[idx], titulo: e.target.value };
                        onUpdate(seccion.uid, { columnas: nextCols });
                      }}
                      className={styles.editorInput}
                      style={{ width: "100%", background: "#ffffff" }}
                    />
                    <textarea
                      placeholder="Contenido (puedes usar .- para viñetas y ** para negrita)"
                      value={col.texto ?? ""}
                      onChange={e => {
                        const nextCols = [...(seccion.columnas ?? [])];
                        while (nextCols.length <= idx) nextCols.push({ titulo: "", texto: "" });
                        nextCols[idx] = { ...nextCols[idx], texto: e.target.value };
                        onUpdate(seccion.uid, { columnas: nextCols });
                      }}
                      className={styles.editorInput}
                      style={{ width: "100%", minHeight: "80px", fontFamily: "inherit", resize: "vertical" }}
                      rows={3}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        {tab === "contenido" && seccion.tipo === "mapa" && (() => {
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div className={styles.editorSection}>
                <label className={styles.editorFieldLabel}>Título del mapa</label>
                <input
                  type="text"
                  placeholder="Ej. Mapa de destinos..."
                  value={seccion.titulo ?? ""}
                  onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
                  className={styles.editorInput}
                  style={{ width: "100%", background: "#ffffff" }}
                />
              </div>
              <>
                {(seccion.mapas ?? []).map((mapaItem, mIdx) => {
                      const isMapaOpen = mapaAbierto === mapaItem.uid;
                      return (
                        <div key={mapaItem.uid} className={styles.mapaEditorBloque}>
                          {/* Cabecera del mapa — colapsable */}
                          <div
                            style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                            onClick={() => setMapaAbierto(isMapaOpen ? null : mapaItem.uid)}
                          >
                            <ChevronRight size={14} style={{ color: "#94a3b8", transform: isMapaOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                            <input
                              type="text"
                              placeholder={`Mapa ${mIdx + 1}`}
                              value={mapaItem.titulo ?? ""}
                              onChange={e => {
                                e.stopPropagation();
                                const updatedMapas = (seccion.mapas ?? []).map(m =>
                                  m.uid === mapaItem.uid ? { ...m, titulo: e.target.value } : m
                                );
                                onUpdate(seccion.uid, { mapas: updatedMapas });
                              }}
                              onClick={e => e.stopPropagation()}
                              className={styles.editorInput}
                              style={{ flex: 1, background: "#ffffff" }}
                            />
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                const updatedMapas = (seccion.mapas ?? []).filter(m => m.uid !== mapaItem.uid);
                                onUpdate(seccion.uid, { mapas: updatedMapas });
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px", flexShrink: 0 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Cuerpo colapsable del mapa */}
                          {isMapaOpen && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingLeft: "1rem" }}>
                              {(mapaItem.ubicaciones ?? []).map((ub, uIdx) => {
                                const isUbOpen = ubAbierta === ub.uid;
                                return (
                                  <div key={ub.uid} className={styles.ubicacionCard}>
                                    {/* Cabecera ubicación — colapsable */}
                                    <div
                                      style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                                      onClick={() => setUbAbierta(isUbOpen ? null : ub.uid)}
                                    >
                                      <ChevronRight size={12} style={{ color: "#94a3b8", transform: isUbOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                                      <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 600, color: ub.nombre ? "#1e293b" : "#94a3b8" }}>
                                        {ub.nombre ?? `Ubicación ${uIdx + 1}`}
                                      </span>
                                      {ub.direccion && !isUbOpen && (
                                        <span style={{ fontSize: "0.65rem", color: "#94a3b8", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ub.direccion}</span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          const updatedMapas = (seccion.mapas ?? []).map(m => {
                                            if (m.uid !== mapaItem.uid) return m;
                                            return { ...m, ubicaciones: (m.ubicaciones ?? []).filter(u => u.uid !== ub.uid) };
                                          });
                                          onUpdate(seccion.uid, { mapas: updatedMapas });
                                        }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "2px", flexShrink: 0 }}
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>

                                    {/* Cuerpo colapsable de la ubicación */}
                                    {isUbOpen && (
                                      <UbicacionEditor
                                        ub={ub}
                                        mapaUid={mapaItem.uid}
                                        seccion={seccion}
                                        onUpdate={onUpdate}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => {
                                  const newUb: UbicacionMapa = { uid: crypto.randomUUID() };
                                  const updatedMapas = (seccion.mapas ?? []).map(m => {
                                    if (m.uid !== mapaItem.uid) return m;
                                    return { ...m, ubicaciones: [...(m.ubicaciones ?? []), newUb] };
                                  });
                                  onUpdate(seccion.uid, { mapas: updatedMapas });
                                  setUbAbierta(newUb.uid);
                                }}
                                className={styles.previewBtn}
                                style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: "0.4rem" }}
                              >
                                + Añadir ubicación
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const newMapa: MapaItem = { uid: crypto.randomUUID(), ubicaciones: [] };
                        onUpdate(seccion.uid, { mapas: [...(seccion.mapas ?? []), newMapa] });
                        setMapaAbierto(newMapa.uid);
                      }}
                      className={styles.previewBtn}
                      style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "0.4rem" }}
                    >
                      + Añadir mapa
                    </button>
              </>
            </div>
          );
        })()}
        {tab === "contenido" && seccion.tipo === "ruta" && (() => {
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div className={styles.editorSection}>
                <label className={styles.editorFieldLabel}>Título de la ruta</label>
                <input
                  type="text"
                  placeholder="Ej. Ruta por los Alpes..."
                  value={seccion.titulo ?? ""}
                  onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
                  className={styles.editorInput}
                  style={{ width: "100%", background: "#ffffff" }}
                />
              </div>
              <>
                {(seccion.rutas ?? []).map((rutaItem, rIdx) => {
                  const isRutaOpen = rutaAbierta === rutaItem.uid;
                  return (
                    <div key={rutaItem.uid} className={styles.mapaEditorBloque}>
                      <div
                        style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                        onClick={() => setRutaAbierta(isRutaOpen ? null : rutaItem.uid)}
                      >
                        <ChevronRight size={14} style={{ color: "#94a3b8", transform: isRutaOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                        <input
                          type="text"
                          placeholder={`Ruta ${rIdx + 1}`}
                          value={rutaItem.titulo ?? ""}
                          onChange={e => {
                            e.stopPropagation();
                            const updatedRutas = (seccion.rutas ?? []).map(r =>
                              r.uid === rutaItem.uid ? { ...r, titulo: e.target.value } : r
                            );
                            onUpdate(seccion.uid, { rutas: updatedRutas });
                          }}
                          onClick={e => e.stopPropagation()}
                          className={styles.editorInput}
                          style={{ flex: 1, background: "#ffffff" }}
                        />
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            const updatedRutas = (seccion.rutas ?? []).filter(r => r.uid !== rutaItem.uid);
                            onUpdate(seccion.uid, { rutas: updatedRutas });
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px", flexShrink: 0 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {isRutaOpen && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingLeft: "1rem" }}>
                          {(rutaItem.ubicaciones ?? []).map((ub, uIdx) => {
                            const isUbOpen = ubRutaAbierta === ub.uid;
                            const seg = (rutaItem.segmentos ?? [])[uIdx - 1];
                            return (
                              <React.Fragment key={ub.uid}>
                                {uIdx > 0 && (
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0 4px 0" }}>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const newModo: "foot-walking" | "driving-car" = "foot-walking";
                                        const segs = [...(rutaItem.segmentos ?? [])];
                                        segs[uIdx - 1] = { ...segs[uIdx - 1], uid: segs[uIdx - 1]?.uid ?? crypto.randomUUID(), modo: newModo, polyline: undefined };
                                        const updatedRutas = (seccion.rutas ?? []).map(r => r.uid === rutaItem.uid ? { ...r, segmentos: segs } : r);
                                        onUpdate(seccion.uid, { rutas: updatedRutas });
                                        const prev = (rutaItem.ubicaciones ?? [])[uIdx - 1];
                                        const curr = ub;
                                        await calcularSegmento(seccion.uid, rutaItem.uid, uIdx - 1, newModo, prev, curr, { ...seccion, rutas: updatedRutas }, onUpdate);
                                      }}
                                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "0.4rem", border: `1px solid ${seg?.modo === "foot-walking" ? "#22c55e" : "#e2e8f0"}`, background: seg?.modo === "foot-walking" ? "#f0fdf4" : "#ffffff", cursor: "pointer", fontSize: "0.72rem", color: seg?.modo === "foot-walking" ? "#15803d" : "#94a3b8" }}
                                      title="A pie"
                                    >
                                      <Footprints size={12} />
                                      <span>A pie</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const newModo: "foot-walking" | "driving-car" = "driving-car";
                                        const segs = [...(rutaItem.segmentos ?? [])];
                                        segs[uIdx - 1] = { ...segs[uIdx - 1], uid: segs[uIdx - 1]?.uid ?? crypto.randomUUID(), modo: newModo, polyline: undefined };
                                        const updatedRutas = (seccion.rutas ?? []).map(r => r.uid === rutaItem.uid ? { ...r, segmentos: segs } : r);
                                        onUpdate(seccion.uid, { rutas: updatedRutas });
                                        const prev = (rutaItem.ubicaciones ?? [])[uIdx - 1];
                                        const curr = ub;
                                        await calcularSegmento(seccion.uid, rutaItem.uid, uIdx - 1, newModo, prev, curr, { ...seccion, rutas: updatedRutas }, onUpdate);
                                      }}
                                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "0.4rem", border: `1px solid ${(!seg?.modo || seg?.modo === "driving-car") ? "#3b82f6" : "#e2e8f0"}`, background: (!seg?.modo || seg?.modo === "driving-car") ? "#eff6ff" : "#ffffff", cursor: "pointer", fontSize: "0.72rem", color: (!seg?.modo || seg?.modo === "driving-car") ? "#1d4ed8" : "#94a3b8" }}
                                      title="En bus"
                                    >
                                      <Bus size={12} />
                                      <span>Bus</span>
                                    </button>
                                    {!seg?.polyline && seg?.modo && (
                                      <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Calculando…</span>
                                    )}
                                  </div>
                                )}
                                <div className={styles.ubicacionCard}>
                                  <div
                                    style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                                    onClick={() => setUbRutaAbierta(isUbOpen ? null : ub.uid)}
                                  >
                                    <ChevronRight size={12} style={{ color: "#94a3b8", transform: isUbOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 600, color: ub.nombre ? "#1e293b" : "#94a3b8" }}>
                                      {ub.nombre ?? `Destino ${uIdx + 1}`}
                                    </span>
                                    {ub.direccion && !isUbOpen && (
                                      <span style={{ fontSize: "0.65rem", color: "#94a3b8", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ub.direccion}</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        const updatedRutas = (seccion.rutas ?? []).map(r => {
                                          if (r.uid !== rutaItem.uid) return r;
                                          const newUbs = (r.ubicaciones ?? []).filter(u => u.uid !== ub.uid);
                                          const newSegs = (r.segmentos ?? []).filter((_, i) => i !== uIdx && i !== uIdx - 1);
                                          return { ...r, ubicaciones: newUbs, segmentos: newSegs };
                                        });
                                        onUpdate(seccion.uid, { rutas: updatedRutas });
                                      }}
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "2px", flexShrink: 0 }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                  {isUbOpen && (
                                    <UbicacionEditorRuta
                                      ub={ub}
                                      rutaUid={rutaItem.uid}
                                      seccion={seccion}
                                      onUpdate={onUpdate}
                                    />
                                  )}
                                </div>
                              </React.Fragment>
                            );
                          })}
                          <button
                            type="button"
                            onClick={async () => {
                              const newUb: UbicacionMapa = { uid: crypto.randomUUID() };
                              const existingUbs = rutaItem.ubicaciones ?? [];
                              const updatedRutas = (seccion.rutas ?? []).map(r => {
                                if (r.uid !== rutaItem.uid) return r;
                                const newSegs: SegmentoRuta[] = [...(r.segmentos ?? [])];
                                if (existingUbs.length > 0) {
                                  newSegs[existingUbs.length - 1] = { uid: crypto.randomUUID(), modo: "driving-car" };
                                }
                                return { ...r, ubicaciones: [...existingUbs, newUb], segmentos: newSegs };
                              });
                              onUpdate(seccion.uid, { rutas: updatedRutas });
                              setUbRutaAbierta(newUb.uid);
                            }}
                            className={styles.previewBtn}
                            style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: "0.4rem" }}
                          >
                            + Añadir destino
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const newRuta: RutaItem = { uid: crypto.randomUUID(), ubicaciones: [], segmentos: [] };
                    onUpdate(seccion.uid, { rutas: [...(seccion.rutas ?? []), newRuta] });
                    setRutaAbierta(newRuta.uid);
                  }}
                  className={styles.previewBtn}
                  style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "0.4rem" }}
                >
                  + Añadir ruta
                </button>
              </>
            </div>
          );
        })()}
        {tab === "contenido" && seccion.tipo === "menu" && (
          <MenuEditorContenido seccion={seccion} onUpdate={onUpdate} todasSecciones={todasSecciones} />
        )}
        {tab === "contenido" && seccion.tipo !== "portada" && seccion.tipo !== "texto-imagenes" && seccion.tipo !== "itinerario" && seccion.tipo !== "texto-columnas" && seccion.tipo !== "mapa" && seccion.tipo !== "ruta" && seccion.tipo !== "menu" && (
          <p className={styles.editorEmpty}>Opciones de contenido próximamente.</p>
        )}
        {tab === "diseño" && (
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label className={styles.colorPickerBtn} style={{ background: seccion.menuColorFondo ?? "rgba(255,255,255,0.95)", width: 34, height: 34, borderRadius: "0.5rem", border: "1px solid #e2e8f0", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
                      <input type="color" value={seccion.menuColorFondo?.replace(/rgba?\([^)]+\)/, "#ffffff") ?? "#ffffff"}
                        onChange={e => onUpdate(seccion.uid, { menuColorFondo: e.target.value })} style={{ opacity: 0, position: "absolute" }} />
                    </label>
                    <input
                      value={seccion.menuColorFondo ?? "rgba(255,255,255,0.95)"}
                      onChange={e => onUpdate(seccion.uid, { menuColorFondo: e.target.value })}
                      style={{ flex: 1, padding: "0.35rem 0.55rem", border: "1.5px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#1e293b", outline: "none", fontFamily: "monospace" }}
                      placeholder="rgba(255,255,255,0.95) o #fff"
                    />
                    {seccion.menuColorFondo && (
                      <button onClick={() => onUpdate(seccion.uid, { menuColorFondo: undefined })}
                        style={{ fontSize: "0.73rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>
                        Restablecer
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: "0.3rem 0 0" }}>Admite <code>rgba(r,g,b,a)</code> para transparencia</p>
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
            {seccion.tipo !== "texto-imagenes" && seccion.tipo !== "portada" && seccion.tipo !== "texto-columnas" && seccion.tipo !== "itinerario" && seccion.tipo !== "mapa" && seccion.tipo !== "ruta" && seccion.tipo !== "menu" && (
              <p className={styles.editorEmpty}>Opciones de diseño próximamente.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type SeccionFavorita = Seccion & { favId: string; savedAt: number };

const FAV_KEY = "propuestas_secciones_favoritas";

function useFavoritos() {
  const [favs, setFavs] = useState<SeccionFavorita[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"); } catch { return []; }
  });

  const toggleFav = useCallback((seccion: Seccion) => {
    setFavs(prev => {
      const exists = prev.find(f => f.favId === seccion.uid);
      const next = exists
        ? prev.filter(f => f.favId !== seccion.uid)
        : [...prev, { ...seccion, favId: seccion.uid, savedAt: Date.now() }];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFav = useCallback((uid: string) => favs.some(f => f.favId === uid), [favs]);

  return { favs, toggleFav, isFav };
}

export function PropuestaEditor({ initialPropuestaId, initialSecciones, initialCotizacionId }: { initialPropuestaId?: string; initialSecciones?: Seccion[]; initialCotizacionId?: string | null } = {}) {
  const [secciones, setSecciones] = useState<Seccion[]>(initialSecciones ?? []);
  const [dispositivo, setDispositivo] = useState<Dispositivo>("desktop");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [editorUid, setEditorUid] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [propuestaId, setPropuestaId] = useState<string | null>(initialPropuestaId ?? null);
  const [cotizacionId] = useState<string | null>(initialCotizacionId ?? null);
  const { favs, toggleFav, isFav } = useFavoritos();

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
    }));
    const designTokens = secciones.map(s => ({
      uid: s.uid, layout: s.layout,
      estiloTitulo: s.estiloTitulo, estiloSubtitulo: s.estiloSubtitulo,
      estiloTituloDia: s.estiloTituloDia, estiloDescDia: s.estiloDescDia,
      colorFondo: s.colorFondo,
      anchoMax: s.anchoMax,
    }));

    try {
      const result = await guardarPropuesta({
        propuestaId: propuestaId ?? undefined,
        editorContent,
        designTokens,
        cotizacionId: propuestaId ? undefined : (cotizacionId ?? undefined),
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
  }, [secciones, propuestaId]);
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
      <h1 className={styles.title}>Creador de propuestas</h1>

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
                  <EditorPanel seccion={editorSeccion} onClose={() => setEditorUid(null)} onRename={renombrarSeccion} onUpdate={actualizarSeccion} isFav={isFav(editorSeccion.uid)} onToggleFav={() => toggleFav(editorSeccion)} todasSecciones={secciones} />
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
              ) : (
                <div className={styles.canvasContent} ref={canvasContentRef}>
                  {secciones.filter(s => !s.oculta).map(s => (
                    <div key={s.uid} ref={el => { seccionRefs.current[s.uid] = el; }}>
                      {renderSeccion(s, current.height, dispositivo, secciones)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal confirmación borrar */}
    </div>
  );
}

export default function NuevaPropuestaPage({ searchParams }: { searchParams: Promise<{ cotizacion_id?: string }> }) {
  const [cotizacionId, setCotizacionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    searchParams.then(p => { if (p.cotizacion_id) setCotizacionId(p.cotizacion_id); });
  }, []);

  return <PropuestaEditor initialCotizacionId={cotizacionId} />;
}
