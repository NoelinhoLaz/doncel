"use client";
import React, { useState, useEffect } from "react";
import { Image } from "lucide-react";
import styles from "../../page.module.css";
import type { TextoEstilo, MediaItem } from "../../types";
import { estiloTextoCSS } from "../../utils/style-utils";
import { VideoBg } from "../../utils/video-utils";
import { Ph, Bar, Title } from "./PHPlaceholders";
import { parseFormattedText } from "../../utils/text-formatting";

const renderConDestacado = (texto: string, colorDestacado?: string, grosorDestacado?: string, defaultTipo?: "titulo" | "subtitulo" | "parrafo" | "negrita") =>
  parseFormattedText(texto, colorDestacado, grosorDestacado, undefined, defaultTipo);

export default function PHTextoImagenes({
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
        <h3 className={styles.phPortadaTitulo} style={{ margin: 0, whiteSpace: "pre-wrap", textShadow: "none", ...estiloTextoCSS(estiloTitulo, "titulo") }}>
          {renderConDestacado(titulo, estiloTitulo?.colorDestacado, estiloTitulo?.grosorDestacado, "titulo")}
        </h3>
      ) : (
        <Title w="65%" />
      )}
      {subtitulo ? (
        <p className={styles.phPortadaSubtitulo} style={{ margin: 0, whiteSpace: "pre-wrap", textShadow: "none", ...estiloTextoCSS(estiloSubtitulo, "parrafo") }}>
          {renderConDestacado(subtitulo, estiloSubtitulo?.colorDestacado, estiloSubtitulo?.grosorDestacado, "parrafo")}
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
