"use client";
import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Image } from "lucide-react";
import styles from "../../page.module.css";
import type { TextoEstilo, MediaItem } from "../../types";
import { estiloTextoCSS } from "../../utils/style-utils";
import { Ph, Bar, Title } from "./PHPlaceholders";
import { parseFormattedText } from "../../utils/text-formatting";

const renderTextWithBold = (text?: string, estilo?: TextoEstilo) =>
  parseFormattedText(text ?? "", estilo?.colorDestacado, estilo?.grosorDestacado, estilo);

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

export default function PHItinerario({ mobile, layout, colorFondo, fechaDesde, fechaHasta, dias, titulo, estiloTitulo, estiloTituloDia, estiloDescDia, anchoMax }: { mobile?: boolean; layout?: string; colorFondo?: string; fechaDesde?: string; fechaHasta?: string; dias?: { dia: number; titulo?: string; desc?: string; media?: MediaItem; medias?: MediaItem[] }[]; titulo?: string; estiloTitulo?: TextoEstilo; estiloTituloDia?: TextoEstilo; estiloDescDia?: TextoEstilo; anchoMax?: string }) {
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
              <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 4px 0", ...estiloTextoCSS(estiloTitulo, "titulo") }}>{titulo}</h3>
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
                          <span className={styles.phAcordeonTitleV} style={{ fontSize: "1.1rem", color: "#ffffff", whiteSpace: "nowrap", marginTop: "auto", ...estiloTextoCSS(estiloTituloDia, "subtitulo") }}>{diaData.titulo}</span>
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
                            <h4 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff", margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.4)", ...estiloTextoCSS(estiloTituloDia, "subtitulo") }}>{diaData.titulo}</h4>
                          ) : (
                            <div style={{ width: "50%", height: "14px", borderRadius: "7px", background: "#ffffff", marginTop: "4px" }} />
                          )}
                          {/* Description or skeleton lines inside scrollable container */}
                          <div className={styles.phAcordeonScroll} style={{ overflowY: "auto", maxHeight: "300px", paddingRight: "4px" }}>
                            {diaData.desc ? (
                              <p style={{ fontSize: "0.82rem", color: "rgba(255, 255, 255, 0.95)", margin: 0, textShadow: "0 1px 2px rgba(0,0,0,0.4)", lineHeight: 1.4, whiteSpace: "pre-wrap", ...estiloTextoCSS(estiloDescDia, "parrafo") }}>{renderTextWithBold(diaData.desc, estiloDescDia)}</p>
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
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 4px 0", ...estiloTextoCSS(estiloTitulo, "titulo") }}>{titulo}</h3>
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
                    <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", margin: 0, ...estiloTextoCSS(estiloTituloDia, "subtitulo") }}>{diaData.titulo}</h4>
                  ) : (
                    <Title w="60%" />
                  )}
                  {diaData.desc ? (
                    <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", ...estiloTextoCSS(estiloDescDia, "parrafo") }}>{renderTextWithBold(diaData.desc, estiloDescDia)}</p>
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
