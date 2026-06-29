"use client";

import React, { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";

const MapaLeaflet = dynamic(() => import("./nueva/MapaLeaflet"), { ssr: false, loading: () => <div style={{ width: "100%", height: "100%", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Cargando mapa…</div> });
const RutaLeaflet = dynamic(() => import("./nueva/RutaLeaflet"), { ssr: false, loading: () => <div style={{ width: "100%", height: "100%", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Cargando ruta…</div> });
import {
  LayoutTemplate, Type, Map as MapPinIcon, Route, DollarSign, Calendar, PanelBottom, Image, Menu, X,
  ChevronRight, ChevronLeft, Backpack, ShoppingBag, Compass, Sailboat, TreePine, Caravan, Tent, Utensils, Anchor, Volleyball, Plane, Sun, Umbrella,
  Camera, Map as MapIcon, Mountain, Coffee, Wine, Bike, Train, Bus, Ship, Fish, Palmtree, Flower2, Globe, Star, Heart, Ticket, Luggage,
} from "lucide-react";
import styles from "./nueva/page.module.css";

export type MediaItem = { tipo: "unsplash" | "link" | "upload" | "video"; url: string };

export interface TextoEstilo {
  fuente?: string;
  tamano?: string;
  grosor?: string;
  alineacionH?: string;
  color?: string;
  colorDestacado?: string;
  grosorDestacado?: string;
}

export interface Seccion {
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
  mapas?: { uid: string; titulo?: string; ubicaciones?: { uid: string; placeId?: string; nombre?: string; direccion?: string; descripcion?: string; lat?: number; lng?: number; medias?: MediaItem[] }[] }[];
  rutas?: { uid: string; titulo?: string; ubicaciones?: { uid: string; placeId?: string; nombre?: string; direccion?: string; descripcion?: string; lat?: number; lng?: number; medias?: MediaItem[] }[]; segmentos?: { uid: string; modo: "foot-walking" | "driving-car"; polyline?: [number, number][] }[] }[];
  dias?: {
    dia: number;
    titulo?: string;
    desc?: string;
    media?: MediaItem;
    medias?: MediaItem[];
  }[];
}

export type Dispositivo = "desktop" | "tablet" | "mobile";

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function youtubeEmbed(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0` : null;
}

function VideoBg({ url, className, style }: { url: string; className?: string; style?: React.CSSProperties }) {
  const embed = youtubeEmbed(url);
  if (embed) {
    return (
      <div className={className} style={{ ...style, overflow: "hidden", position: "relative", containerType: "size" }}>
        <iframe
          src={embed}
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
  return <video src={url} className={className} style={{ ...style, objectFit: "cover" }} autoPlay muted loop playsInline />;
}

const FUENTE_FAMILY: Record<string, string> = {
  "Raleway":       "var(--font-raleway), sans-serif",
  "Montserrat":    "var(--font-montserrat), sans-serif",
  "Roboto":        "var(--font-roboto), sans-serif",
  "Special Elite": "var(--font-special-elite), cursive",
  "Serif":         "Georgia, serif",
};

export function estiloTextoCSS(e?: TextoEstilo): React.CSSProperties {
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

export function renderConDestacado(texto: string, colorDestacado?: string, grosorDestacado?: string): React.ReactNode {
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

export function Ph({ children }: { children: React.ReactNode }) {
  return <div className={styles.ph}>{children}</div>;
}
export function Bar({ w }: { w: string }) {
  return <div className={styles.phBar} style={{ width: w }} />;
}
export function Title({ w }: { w: string }) {
  return <div className={styles.phTitle} style={{ width: w }} />;
}
export function Bloque({ h, dashed }: { h?: string; dashed?: boolean }) {
  return <div className={styles.phBloque} style={{ height: h ?? "60px", borderStyle: dashed ? "dashed" : "solid" }} />;
}

export function PortadaTexto({ titulo, subtitulo, estiloTitulo, estiloSubtitulo, wrapStyle }: {
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

export type PillsBgIcon = { Icon: React.ElementType; x: number; y: number; rot: number; sz: number; speed: number };

export function PillsPortada({ height, titulo, subtitulo, estiloTitulo, estiloSubtitulo, pillImgs, pillsBgIcons }: {
  height: string; titulo?: string; subtitulo?: string;
  estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo;
  pillImgs: MediaItem[]; pillsBgIcons: PillsBgIcon[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
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

export function PolaroidPortada({ height, colorFondo, cards, titulo, subtitulo, estiloTitulo, estiloSubtitulo }: {
  height: string; colorFondo?: string;
  cards: { w: string; r: string; left: string; top: string; url: string; tipo?: string }[];
  titulo?: string; subtitulo?: string;
  estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className={styles.phPortada} style={{ height, background: colorFondo ?? "linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4)), url('/map.png') center/140% no-repeat", padding: 0, overflow: "hidden" }}>
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
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 6 -3" in="scratchNoise" result="scratchMask" />
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

export function PHPortada({ height, layout, titulo, subtitulo, medias, estiloTitulo, estiloSubtitulo, colorFondo }: { height: string; layout?: string; titulo?: string; subtitulo?: string; medias?: MediaItem[]; estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo; colorFondo?: string }) {
  const allImgs = medias ?? [];

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (allImgs.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % allImgs.length), 3000);
    return () => clearInterval(t);
  }, [allImgs.length]);
  useEffect(() => { setIdx(0); }, [allImgs.length]);

  const currentImg = allImgs[idx] ?? null;

  if (layout === "wave") {
    return (
      <div className={styles.phPortada} style={{ height, background: colorFondo ?? "white", padding: 0 }}>
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
                    <VideoBg url={m.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
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

  return (
    <div className={styles.phPortada} style={{ height, background: allImgs.length === 0 ? "#e2e8f0" : undefined }}>
      {allImgs.map((m, i) => (
        m.tipo === "video"
          ? <div key={m.url} className={`${styles.phSlideImg} ${styles.phSlideFade}`} style={{ opacity: i === idx ? 1 : 0 }}>
              <VideoBg url={m.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
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

export function PHMenu({ mobile }: { mobile?: boolean }) {
  return (
    <div className={styles.phMenu}>
      <div className={styles.phMenuRow}>
        <div className={styles.phLogo} />
        {!mobile && (
          <div className={styles.phNavLinks}>
            <Bar w="40px" /><Bar w="40px" /><Bar w="40px" /><Bar w="40px" />
          </div>
        )}
        <div className={styles.phNavBtn} />
      </div>
    </div>
  );
}

export function PHTextoImagenes({
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

export function PHItinerarioMediaCarousel({ medias, showArrows, autoplay = true }: { medias: MediaItem[]; showArrows?: boolean; autoplay?: boolean }) {
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

export function renderTextWithBold(text?: string, estilo?: TextoEstilo) {
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

export function PHItinerario({ mobile, layout, colorFondo, fechaDesde, fechaHasta, dias, titulo, estiloTitulo, estiloTituloDia, estiloDescDia, anchoMax }: { mobile?: boolean; layout?: string; colorFondo?: string; fechaDesde?: string; fechaHasta?: string; dias?: { dia: number; titulo?: string; desc?: string; media?: MediaItem; medias?: MediaItem[] }[]; titulo?: string; estiloTitulo?: TextoEstilo; estiloTituloDia?: TextoEstilo; estiloDescDia?: TextoEstilo; anchoMax?: string }) {
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
              <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 4px 0" }}>{titulo}</h3>
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
                        <div style={{ width: "20px", height: "20px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: "bold", color: "#ffffff" }}>
                          {d.dia}
                        </div>
                        {diaData.titulo ? (
                          <span className={styles.phAcordeonTitleV} style={{ fontSize: "1.1rem", color: "#ffffff", whiteSpace: "nowrap", marginTop: "auto", ...estiloTextoCSS(estiloTituloDia) }}>{diaData.titulo}</span>
                        ) : (
                          <div style={{ width: "6px", height: "100px", borderRadius: "3px", background: "rgba(255, 255, 255, 0.2)", marginTop: "auto" }} />
                        )}
                      </div>
                    ) : (
                      <div className={styles.phAcordeonExpandido} style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "1.5rem 1.25rem", gap: "8px", zIndex: 2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexShrink: 0 }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.07em", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                            Día {d.dia}
                          </span>
                        </div>

                        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {diaData.titulo ? (
                            <h4 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff", margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.4)", ...estiloTextoCSS(estiloTituloDia) }}>{diaData.titulo}</h4>
                          ) : (
                            <div style={{ width: "50%", height: "14px", borderRadius: "7px", background: "#ffffff", marginTop: "4px" }} />
                          )}
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

export function PHMapa({ titulo, mapas, layout, anchoMax, colorFondo }: {
  titulo?: string;
  mapas?: Seccion["mapas"];
  layout?: string;
  anchoMax?: string;
  colorFondo?: string;
}) {
  const customMaxWidth = anchoMax === "900px" ? "min(900px, 46.875cqw)" : anchoMax === "1200px" ? "min(1200px, 62.5cqw)" : "min(1920px, 100cqw)";
  const mapasList = mapas ?? [];
  const allUbicaciones = mapasList.flatMap(m => m.ubicaciones ?? []);
  const [activeMapaIdx, setActiveMapaIdx] = useState<number>(-1);
  const [showList, setShowList] = useState(false);
  const isAll = activeMapaIdx === -1;
  const activeMapa = isAll ? null : mapasList[Math.min(activeMapaIdx, mapasList.length - 1)];
  const ubicaciones = isAll ? allUbicaciones : (activeMapa?.ubicaciones ?? []);
  const tabKey = isAll ? "todos" : (activeMapa?.uid ?? "none");
  const showTabs = mapasList.length > 0;

  const tabBar = (mb: string) => showTabs ? (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", marginBottom: mb, flexWrap: "wrap" }}>
      {mapasList.length > 1 && (
        <button onClick={() => setActiveMapaIdx(-1)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem", fontWeight: isAll ? 700 : 500, color: isAll ? "#6366f1" : "#64748b", background: "none", border: "none", borderBottom: `2px solid ${isAll ? "#6366f1" : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
          Todos
        </button>
      )}
      {mapasList.map((m, i) => {
        const active = !isAll && activeMapaIdx === i;
        return (
          <button key={m.uid} onClick={() => setActiveMapaIdx(i)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem", fontWeight: active ? 700 : 500, color: active ? "#6366f1" : "#64748b", background: "none", border: "none", borderBottom: `2px solid ${active ? "#6366f1" : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
            {m.titulo || `Mapa ${i + 1}`}
          </button>
        );
      })}
    </div>
  ) : null;

  const [openUbUid, setOpenUbUid] = useState<string | null>(null);
  const [modalImg, setModalImg] = useState<string | null>(null);

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
      }) : null}
    </div>
  );

  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div style={{ maxWidth: customMaxWidth, margin: "0 auto", padding: "1.5rem" }}>
          {titulo ? (
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 12px 0" }}>{titulo}</h3>
          ) : null}
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
                {/* Botón menú */}
                <button
                  onClick={() => setShowList(v => !v)}
                  style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, width: 34, height: 34, borderRadius: "0.4rem", background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  {showList ? <X size={16} color="#475569" /> : <Menu size={16} color="#475569" />}
                </button>
                {/* Panel listado superpuesto */}
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

export function PHRuta({ titulo, rutas, layout, anchoMax, colorFondo }: {
  titulo?: string;
  rutas?: Seccion["rutas"];
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
      }) : null}
    </div>
  );

  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div style={{ maxWidth: customMaxWidth, margin: "0 auto", padding: "1.5rem" }}>
          {titulo ? (
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 12px 0" }}>{titulo}</h3>
          ) : null}
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

export function PHPrecio({ mobile, tablet }: { mobile?: boolean; tablet?: boolean }) {
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

export function PHFormulario({ mobile }: { mobile?: boolean }) {
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

export function PHFooter({ mobile }: { mobile?: boolean }) {
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

export function PHTextoColumnas({
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

export function renderSeccion(s: Seccion, canvasHeight: string, dispositivo: Dispositivo) {
  const mobile = dispositivo === "mobile";
  const tablet = dispositivo === "tablet";
  switch (s.tipo) {
    case "menu":           return <PHMenu key={s.uid} mobile={mobile} />;
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
