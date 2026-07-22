import React from "react";
import {
  Monitor, Tablet, Smartphone,
  LayoutTemplate, Type, Map as MapPinIcon, Route, DollarSign, Calendar, PanelBottom, Image, Menu, Columns,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Tag, Globe2, Plane, LayoutGrid, GalleryHorizontal,
} from "lucide-react";
import type { Dispositivo } from "./types";

export const DISPOSITIVOS: { id: Dispositivo; label: string; Icon: React.ElementType; width: string; height: string }[] = [
  { id: "desktop", label: "Escritorio", Icon: Monitor,    width: "1056px", height: "594px" },
  { id: "tablet",  label: "Tablet",     Icon: Tablet,     width: "492px",  height: "708px" },
  { id: "mobile",  label: "Móvil",      Icon: Smartphone, width: "314px",  height: "682px" },
];

export const OPCIONES_SECCION = [
  { id: "menu",           label: "Menú",             Icon: Menu },
  { id: "portada",        label: "Portada",          Icon: LayoutTemplate },
  { id: "texto-imagenes", label: "Texto + Imágenes", Icon: Image },
  { id: "texto-columnas", label: "Texto Columnas",   Icon: Columns },
  { id: "itinerario",     label: "Itinerario",       Icon: Calendar },
  { id: "mapa",           label: "Mapa",             Icon: MapPinIcon },
  { id: "ruta",           label: "Ruta",             Icon: Route },
  { id: "precio",         label: "Precio",           Icon: DollarSign },
  { id: "formulario",     label: "Formulario",       Icon: Type },
  { id: "cards",          label: "Cards",            Icon: LayoutGrid },
  { id: "galeria",        label: "Galería",          Icon: GalleryHorizontal },
  { id: "ofertas",        label: "Categorías",       Icon: Tag },
  { id: "footer",         label: "Footer",           Icon: PanelBottom },
];

// Secciones exclusivas de la web de la agencia (NO usar en el editor de propuestas)
export const OPCIONES_SECCION_WEB = [
  ...OPCIONES_SECCION,
  { id: "nego-planet-programas", label: "Programas NegoPlanet", Icon: Plane },
  { id: "nego-planet-destinos",  label: "Destinos NegoPlanet",  Icon: Globe2 },
];

export const FUENTE_FAMILY: Record<string, string> = {
  "Raleway":       "var(--font-raleway), sans-serif",
  "Montserrat":    "var(--font-montserrat), sans-serif",
  "Roboto":        "var(--font-roboto), sans-serif",
  "Special Elite": "var(--font-special-elite), cursive",
  "Serif":         "Georgia, serif",
};

export const FUENTES = ["Raleway", "Montserrat", "Roboto", "Special Elite", "Serif"];
export const TAMANIOS = ["12px","14px","16px","18px","20px","24px","28px","32px","40px","48px","56px","64px","72px"];
export const GROSORES = ["300","400","500","600","700","800"];

export const ALIGN_H_OPTS = [
  { val: "left",    Icon: AlignLeft },
  { val: "center",  Icon: AlignCenter },
  { val: "right",   Icon: AlignRight },
  { val: "justify", Icon: AlignJustify },
];

export const FAV_KEY = "propuestas_secciones_favoritas";
