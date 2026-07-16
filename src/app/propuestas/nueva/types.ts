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

export interface MenuItemConfig {
  uid: string;
  etiqueta: string;
  ocultaEnMenu?: boolean;
}

export interface MenuBoton {
  etiqueta: string;
  tipo: "externo" | "seccion";
  href?: string;
  seccionUid?: string;
}

export interface PersonaEquipo {
  uid: string;
  nombre?: string;
  cargo?: string;
  texto?: string;
  media?: MediaItem;
}

export interface ListadoConfig {
  formatoId?: string | null;
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
  menuItems?: MenuItemConfig[];
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
  personas?: PersonaEquipo[];
  equipoEstiloTarjeta?: "circular" | "tarjeta";
  listadoFormatoId?: string | null;
  listadoEstiloTarjeta?: "simple" | "articulo";
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
