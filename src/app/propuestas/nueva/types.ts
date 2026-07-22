export type Dispositivo = "desktop" | "tablet" | "mobile";

export interface TextoEstilo {
  fuente?: string;
  tamano?: string;
  grosor?: string;
  alineacionH?: string;
  color?: string;
  colorDestacado?: string;
  grosorDestacado?: string;
}

export type MediaItem = { tipo: "unsplash" | "link" | "upload" | "video"; url: string };

export interface UbicacionMapa {
  uid: string;
  placeId?: string;
  nombre?: string;
  direccion?: string;
  descripcion?: string;
  lat?: number;
  lng?: number;
  medias?: MediaItem[];
}

export interface MapaItem {
  uid: string;
  titulo?: string;
  ubicaciones?: UbicacionMapa[];
}

export interface SegmentoRuta {
  uid: string;
  modo: "foot-walking" | "driving-car";
  polyline?: [number, number][];
}

export interface RutaItem {
  uid: string;
  titulo?: string;
  ubicaciones?: UbicacionMapa[];
  segmentos?: SegmentoRuta[];
}

/** @deprecated Sustituido por menuOverrides — se mantiene solo para migrar datos antiguos. */
export interface MenuItemConfig {
  uid: string;
  etiqueta: string;
  ocultaEnMenu?: boolean;
}

/** Ajuste editorial por sección (indexado por uid de sección) para el menú dinámico. */
export interface MenuOverride {
  etiqueta?: string;
  ocultaEnMenu?: boolean;
}

export interface MenuBoton {
  etiqueta: string;
  tipo: "externo" | "seccion";
  href?: string;
  seccionUid?: string;
}

export interface CardItem {
  uid: string;
  titulo?: string;
  subtitulo?: string;
  media?: MediaItem;
  enlaceTipo?: "externo" | "pagina";
  enlaceHref?: string;
  enlacePaginaSlug?: string;
}

export interface GaleriaItem {
  uid: string;
  media?: MediaItem;
}

export interface ListadoConfig {
  formatoId?: string | null;
}

export interface NegoPlanetItem {
  uid: string;
  origen: "destino" | "programa";
  externalId?: string;
  slug?: string;
  titulo: string;
  descripcion?: string;
  precio?: string;
  dias?: string;
  imagen?: string;
}

export type NegoPlanetModo = "fijo" | "auto";
export type NegoPlanetAutoTipo = "destinos" | "programas-destacados" | "programas-mas-vendidos" | "programas-pais";

export interface NegoPlanetCategoriaDestino {
  post_name: string;
  post_title: string;
  totalDestinos: number;
  imagen?: string;
}

/** Override editorial por nodo (categoría, subcategoría o destino), indexado por su post_name/slug. */
export interface NegoPlanetOverride {
  oculto?: boolean;
  imagen?: string;
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
  imagenFondo?: MediaItem;
  imagenFondoOverlay?: number;
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
  menuLogo?: string;
  /** @deprecated usar menuOverrides — se conserva solo para migrar páginas/propuestas antiguas. */
  menuItems?: MenuItemConfig[];
  menuOverrides?: Record<string, MenuOverride>;
  menuBoton?: MenuBoton | null;
  menuColorFondo?: string;
  menuColorTexto?: string;
  menuColorBoton?: string;
  menuFijo?: boolean;
  pvp?: string;
  condiciones?: string;
  otrasConsideraciones?: string;
  estiloPvp?: TextoEstilo;
  estiloCondiciones?: TextoEstilo;
  estiloOtrasConsideraciones?: TextoEstilo;
  formularioCampos?: { uid: string; key: string; label: string; lineas: number; activo: boolean }[];
  formularioEmail?: string;
  formularioBoton?: string;
  cards?: CardItem[];
  galeria?: GaleriaItem[];
  listadoFormatoId?: string | null;
  listadoEstiloTarjeta?: "simple" | "articulo";
  negoPlanetItems?: NegoPlanetItem[];
  negoPlanetModo?: NegoPlanetModo;
  negoPlanetAutoTipo?: NegoPlanetAutoTipo;
  negoPlanetAutoQuery?: string;
  negoPlanetOverrides?: Record<string, NegoPlanetOverride>;
}

export type SeccionFavorita = Seccion & { favId: string; savedAt: number };

export type MediaTab = "unsplash" | "link" | "upload" | "video";

export interface UnsplashPhoto {
  id: string;
  urls: { regular: string; thumb: string };
  alt_description: string | null;
  user: { name: string };
}

export type PillsBgIcon = {
  Icon: React.ElementType;
  top: string;
  left: string;
  size: number;
  opacity: number;
  rotate: number;
};
