"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight, Heart, TableOfContents, Palette } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import MenuEditorContenido from "./MenuEditorContenido";
import EditorPortada from "./EditorPortada";
import EditorTextoImagenes from "./EditorTextoImagenes";
import EditorItinerario from "./EditorItinerario";
import EditorTextoColumnas from "./EditorTextoColumnas";
import EditorMapa from "./EditorMapa";
import EditorRuta from "./EditorRuta";
import EditorPrecio from "./EditorPrecio";
import EditorFormulario from "./EditorFormulario";
import DisenioPanel from "./DisenioPanel";
import { GuiaFormato } from "./GuiaFormato";

export function EditorPanel({ seccion, onClose, onRename, onUpdate, isFav, onToggleFav, todasSecciones, cotizacionId, propuestaId }: { seccion: Seccion; onClose: () => void; onRename: (uid: string, label: string) => void; onUpdate: (uid: string, patch: Partial<Seccion>) => void; isFav: boolean; onToggleFav: () => void; todasSecciones?: Seccion[]; cotizacionId?: string | null; propuestaId?: string | null }) {
  const [tab, setTab] = useState<"contenido" | "diseño">("contenido");
  const [mediaAbierto, setMediaAbierto] = useState<boolean | number | "new" | string>(false);
  const [expandedDayIdx, setExpandedDayIdx] = useState<number | null>(null);

  useEffect(() => {
    setMediaAbierto(false);
    setExpandedDayIdx(null);
  }, [seccion.uid]);

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
          <EditorPortada
            seccion={seccion}
            onUpdate={onUpdate}
            mediaAbierto={mediaAbierto}
            setMediaAbierto={setMediaAbierto}
            optimizandoIA={optimizandoIA}
            mejorarConIA={mejorarConIA}
          />
        )}
        {tab === "contenido" && seccion.tipo === "texto-imagenes" && (
          <EditorTextoImagenes
            seccion={seccion}
            onUpdate={onUpdate}
            mediaAbierto={mediaAbierto}
            setMediaAbierto={setMediaAbierto}
            optimizandoIA={optimizandoIA}
            mejorarConIA={mejorarConIA}
          />
        )}
        {tab === "contenido" && seccion.tipo === "itinerario" && (
          <EditorItinerario
            seccion={seccion}
            onUpdate={onUpdate}
            mediaAbierto={mediaAbierto}
            setMediaAbierto={setMediaAbierto}
            expandedDayIdx={expandedDayIdx}
            setExpandedDayIdx={setExpandedDayIdx}
          />
        )}
        {tab === "contenido" && seccion.tipo === "texto-columnas" && (
          <EditorTextoColumnas
            seccion={seccion}
            onUpdate={onUpdate}
          />
        )}
        {tab === "contenido" && seccion.tipo === "mapa" && (
          <EditorMapa
            seccion={seccion}
            onUpdate={onUpdate}
            mapaAbierto={mapaAbierto}
            setMapaAbierto={setMapaAbierto}
            ubAbierta={ubAbierta}
            setUbAbierta={setUbAbierta}
          />
        )}
        {tab === "contenido" && seccion.tipo === "ruta" && (
          <EditorRuta
            seccion={seccion}
            onUpdate={onUpdate}
            rutaAbierta={rutaAbierta}
            setRutaAbierta={setRutaAbierta}
            ubRutaAbierta={ubRutaAbierta}
            setUbRutaAbierta={setUbRutaAbierta}
          />
        )}
        {tab === "contenido" && seccion.tipo === "menu" && (
          <MenuEditorContenido seccion={seccion} onUpdate={onUpdate} todasSecciones={todasSecciones} />
        )}
        {tab === "contenido" && seccion.tipo === "precio" && (
          <EditorPrecio seccion={seccion} onUpdate={onUpdate} />
        )}
        {tab === "contenido" && seccion.tipo === "formulario" && (
          <EditorFormulario seccion={seccion} onUpdate={onUpdate} />
        )}
        {tab === "contenido" && seccion.tipo !== "portada" && seccion.tipo !== "texto-imagenes" && seccion.tipo !== "itinerario" && seccion.tipo !== "texto-columnas" && seccion.tipo !== "mapa" && seccion.tipo !== "ruta" && seccion.tipo !== "menu" && seccion.tipo !== "precio" && seccion.tipo !== "formulario" && (
          <p className={styles.editorEmpty}>Opciones de contenido próximamente.</p>
        )}
        {tab === "diseño" && (
          <DisenioPanel seccion={seccion} onUpdate={onUpdate} />
        )}
        {tab === "contenido" && <GuiaFormato cotizacionId={cotizacionId} propuestaId={propuestaId} />}
      </div>
    </div>
  );
}
