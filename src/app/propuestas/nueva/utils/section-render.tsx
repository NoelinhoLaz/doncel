"use client";
import React from "react";
import type { Seccion, Dispositivo } from "../types";
import styles from "../page.module.css";
import PHMenu from "../components/Preview/PHMenu";
import PHPortada from "../components/Preview/PHPortada";
import PHTextoImagenes from "../components/Preview/PHTextoImagenes";
import PHTextoColumnas from "../components/Preview/PHTextoColumnas";
import PHItinerario from "../components/Preview/PHItinerario";
import PHMapa from "../components/Preview/PHMapa";
import PHRuta from "../components/Preview/PHRuta";
import { Ph, PHPrecio, PHFormulario, PHFooter } from "../components/Preview/PHPlaceholders";

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
