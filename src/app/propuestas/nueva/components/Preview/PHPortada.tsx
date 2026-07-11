"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Backpack, ShoppingBag, Compass, Sailboat, TreePine, Caravan, Tent, Utensils, Anchor, Volleyball, Plane, Sun, Umbrella,
  Camera, Map as MapIcon, Mountain, Coffee, Wine, Bike, Train, Bus, Ship, Fish, Palmtree, Flower2, Globe, Star, Heart, Ticket, Luggage,
  Image,
} from "lucide-react";
import styles from "../../page.module.css";
import type { TextoEstilo, MediaItem, Seccion } from "../../types";
import { VideoBg, PortadaBg } from "../../utils/video-utils";
import { estiloTextoCSS } from "../../utils/style-utils";
import { Bar, Title } from "./PHPlaceholders";
import { parseFormattedText } from "../../utils/text-formatting";

const renderConDestacado = (texto: string, colorDestacado?: string, grosorDestacado?: string, defaultTipo?: "titulo" | "subtitulo" | "parrafo" | "negrita") =>
  parseFormattedText(texto, colorDestacado, grosorDestacado, undefined, defaultTipo);

function PortadaTexto({ titulo, subtitulo, estiloTitulo, estiloSubtitulo, wrapStyle }: {
  titulo?: string; subtitulo?: string;
  estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo;
  wrapStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", ...wrapStyle }}>
      {titulo
        ? <p className={styles.phPortadaTitulo} style={{ whiteSpace: "pre-wrap", ...estiloTextoCSS(estiloTitulo, "titulo") }}>
            {renderConDestacado(titulo, estiloTitulo?.colorDestacado, estiloTitulo?.grosorDestacado, "titulo")}
          </p>
        : <Title w="55%" />}
      {subtitulo
        ? <p className={styles.phPortadaSubtitulo} style={{ whiteSpace: "pre-wrap", ...estiloTextoCSS(estiloSubtitulo, "subtitulo") }}>
            {renderConDestacado(subtitulo, estiloSubtitulo?.colorDestacado, estiloSubtitulo?.grosorDestacado, "subtitulo")}
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

export default function PHPortada({ height, layout, titulo, subtitulo, medias, estiloTitulo, estiloSubtitulo, colorFondo }: { height: string; layout?: string; titulo?: string; subtitulo?: string; medias?: MediaItem[]; estiloTitulo?: TextoEstilo; estiloSubtitulo?: TextoEstilo; colorFondo?: string }) {
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
