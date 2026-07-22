"use server";

import { XMLParser } from "fast-xml-parser";
import { obtenerApiKeyDesencriptada } from "@/actions/apikeys";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

const BASE_URL = "https://www.negoplanet.com/nego-xml";
const NOMBRE_API_KEY = "NegoPlanet";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

const NEGOPLANET_TIMEOUT_MS = 8000;

async function fetchConTimeout(url: string, ms = NEGOPLANET_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { next: { revalidate: 3600 }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function agenciaIdDesdeSesion(): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const adminServiceSupabase = createAdminServiceClient();
  const { data: usuario } = await adminServiceSupabase
    .from("usuarios")
    .select("agencia_id")
    .eq("auth_user_id", user.id)
    .single();
  if (!usuario?.agencia_id) throw new Error("Agencia no encontrada");
  return usuario.agencia_id;
}

async function credencialesPorAgencia(agenciaId: string) {
  const raw = await obtenerApiKeyDesencriptada(NOMBRE_API_KEY, agenciaId);
  const { usuario, pass } = JSON.parse(raw);
  if (!usuario || !pass) throw new Error("Credenciales de NegoPlanet incompletas");
  return { usuario, pass };
}

async function credenciales() {
  const agenciaId = await agenciaIdDesdeSesion();
  return credencialesPorAgencia(agenciaId);
}

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export interface NegoPlanetDestino {
  id?: string;
  post_title: string;
  post_name: string;
  post_excerpt?: string;
  location?: string;
  imagen?: string;
}

export interface NegoPlanetPrograma {
  id?: string;
  post_title: string;
  post_name: string;
  post_excerpt?: string;
  precio?: string;
  dias?: string;
  imagen?: string;
}

function extraerImagen(imagenes: any): string | undefined {
  if (!imagenes) return undefined;
  if (typeof imagenes === "string") return imagenes;
  if (imagenes.medium || imagenes.large || imagenes.thumbnail) {
    return imagenes.medium || imagenes.large || imagenes.thumbnail;
  }
  if (imagenes.item) {
    const items = asArray(imagenes.item);
    const first = items[0];
    if (typeof first === "string") return first;
    return first?.medium || first?.large || first?.thumbnail || undefined;
  }
  return undefined;
}

async function fetchProgramaTipo(usuario: string, pass: string, tipo: "destacado" | "mas-vendidos"): Promise<NegoPlanetPrograma[]> {
  const url = `${BASE_URL}/programa-tipo/?tipo=${tipo}&usuario=${encodeURIComponent(usuario)}&pass=${encodeURIComponent(pass)}`;
  const res = await fetchConTimeout(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml);
  const root = data?.rss ?? data;
  const programas = asArray(root?.programa);
  return programas.map((p: any) => ({
    id: p.ID != null ? String(p.ID) : undefined,
    post_title: p.post_title,
    post_name: p.post_name,
    post_excerpt: p.post_excerpt,
    precio: p.preciosimple != null ? String(p.preciosimple) : p.precio,
    dias: p["días"] != null ? String(p["días"]) : undefined,
    imagen: extraerImagen(p.imagenes),
  }));
}

async function fetchProgramasPorPais(usuario: string, pass: string, pais: string): Promise<NegoPlanetPrograma[]> {
  const url = `${BASE_URL}/buscar-programas/?pais=${encodeURIComponent(pais)}&usuario=${encodeURIComponent(usuario)}&pass=${encodeURIComponent(pass)}`;
  const res = await fetchConTimeout(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml);
  const root = data?.rss ?? data;
  const programas = asArray(root?.programas?.item ?? root?.programa);
  return programas.map((p: any) => ({
    id: p.ID != null ? String(p.ID) : undefined,
    post_title: p.post_title,
    post_name: p.post_name,
    post_excerpt: p.post_excerpt,
    precio: p.preciosimple != null ? String(p.preciosimple) : p.precio,
    dias: p["días"] != null ? String(p["días"]) : undefined,
    imagen: extraerImagen(p.imagenes),
  }));
}

async function fetchDestinos(usuario: string, pass: string): Promise<NegoPlanetDestino[]> {
  const url = `${BASE_URL}/destinos/?tipo=destino&usuario=${encodeURIComponent(usuario)}&pass=${encodeURIComponent(pass)}`;
  const res = await fetchConTimeout(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml);
  const root = data?.rss ?? data;
  const destinos = asArray(root?.destinos?.destino);
  return destinos.map((d: any) => ({
    id: d.ID != null ? String(d.ID) : undefined,
    post_title: d.post_title,
    post_name: d.post_name,
    location: d.location,
  }));
}

async function fetchDestinoPorNombre(usuario: string, pass: string, nombre: string): Promise<NegoPlanetDestino[]> {
  const url = `${BASE_URL}/?tipo=destino&busca=${encodeURIComponent(nombre)}&usuario=${encodeURIComponent(usuario)}&pass=${encodeURIComponent(pass)}`;
  const res = await fetchConTimeout(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml);
  const root = data?.rss ?? data;
  const destinos = asArray(root?.destinos?.destino);
  return destinos.map((d: any) => ({
    id: d.ID != null ? String(d.ID) : undefined,
    post_title: d.post_title,
    post_name: d.post_name,
    post_excerpt: d.post_excerpt,
    location: d.location,
    imagen: extraerImagen(d.imagenes),
  }));
}

// ─── Server actions usadas desde el editor (requieren sesión) ───────────────

export async function listarProgramasDestacadosNegoPlanet() {
  try {
    const { usuario, pass } = await credenciales();
    return { ok: true, data: await fetchProgramaTipo(usuario, pass, "destacado") };
  } catch (e: any) {
    console.error("listarProgramasDestacadosNegoPlanet:", e?.message);
    return { ok: false, error: e?.message, data: [] };
  }
}

export async function listarProgramasMasVendidosNegoPlanet() {
  try {
    const { usuario, pass } = await credenciales();
    return { ok: true, data: await fetchProgramaTipo(usuario, pass, "mas-vendidos") };
  } catch (e: any) {
    console.error("listarProgramasMasVendidosNegoPlanet:", e?.message);
    return { ok: false, error: e?.message, data: [] };
  }
}

export async function buscarProgramasPorPaisNegoPlanet(nombre: string) {
  try {
    const { usuario, pass } = await credenciales();
    return { ok: true, data: await fetchProgramasPorPais(usuario, pass, nombre) };
  } catch (e: any) {
    console.error("buscarProgramasPorPaisNegoPlanet:", e?.message);
    return { ok: false, error: e?.message, data: [] };
  }
}

export async function listarDestinosNegoPlanet() {
  try {
    const { usuario, pass } = await credenciales();
    return { ok: true, data: await fetchDestinos(usuario, pass) };
  } catch (e: any) {
    console.error("listarDestinosNegoPlanet:", e?.message);
    return { ok: false, error: e?.message, data: [] };
  }
}

export async function buscarDestinoPorNombreNegoPlanet(nombre: string) {
  try {
    const { usuario, pass } = await credenciales();
    return { ok: true, data: await fetchDestinoPorNombre(usuario, pass, nombre) };
  } catch (e: any) {
    console.error("buscarDestinoPorNombreNegoPlanet:", e?.message);
    return { ok: false, error: e?.message, data: [] };
  }
}

// ─── Resolución en vivo para el modo "automático" de la sección ─────────────
// Usable tanto con sesión (editor/preview) como sin sesión, pasando agenciaId
// resuelto por dominio (página pública para visitantes anónimos).

export interface NegoPlanetItemResuelto {
  uid: string;
  origen: "destino" | "programa";
  externalId?: string;
  slug: string;
  titulo: string;
  descripcion?: string;
  precio?: string;
  dias?: string;
  imagen?: string;
}

function normalizarPrograma(p: NegoPlanetPrograma, idx: number): NegoPlanetItemResuelto {
  return {
    uid: `auto-programa-${p.id ?? p.post_name ?? idx}`,
    origen: "programa",
    externalId: p.id,
    slug: p.post_name,
    titulo: p.post_title,
    descripcion: p.post_excerpt,
    precio: p.precio,
    dias: p.dias,
    imagen: p.imagen,
  };
}

function normalizarDestino(d: NegoPlanetDestino, idx: number): NegoPlanetItemResuelto {
  return {
    uid: `auto-destino-${d.id ?? d.post_name ?? idx}`,
    origen: "destino",
    externalId: d.id,
    slug: d.post_name,
    titulo: d.post_title,
    descripcion: d.post_excerpt || d.location,
    imagen: d.imagen,
  };
}

export async function resolverItemsAutoNegoPlanet(
  agenciaId: string,
  tipo: "destinos" | "programas-destacados" | "programas-mas-vendidos" | "programas-pais",
  query?: string
): Promise<{ ok: boolean; data: NegoPlanetItemResuelto[]; error?: string }> {
  try {
    const { usuario, pass } = await credencialesPorAgencia(agenciaId);
    if (tipo === "destinos") {
      const data = await fetchDestinos(usuario, pass);
      return { ok: true, data: data.map(normalizarDestino) };
    }
    if (tipo === "programas-pais" && query?.trim()) {
      const data = await fetchProgramasPorPais(usuario, pass, query.trim());
      return { ok: true, data: data.map(normalizarPrograma) };
    }
    if (tipo === "programas-mas-vendidos") {
      const data = await fetchProgramaTipo(usuario, pass, "mas-vendidos");
      return { ok: true, data: data.map(normalizarPrograma) };
    }
    const data = await fetchProgramaTipo(usuario, pass, "destacado");
    return { ok: true, data: data.map(normalizarPrograma) };
  } catch (e: any) {
    console.error("resolverItemsAutoNegoPlanet:", e?.message);
    return { ok: false, error: e?.message, data: [] };
  }
}

/** Variante para uso desde el editor/preview, resolviendo la agencia por la sesión actual. */
export async function resolverItemsAutoNegoPlanetSesion(
  tipo: "destinos" | "programas-destacados" | "programas-mas-vendidos" | "programas-pais",
  query?: string
) {
  try {
    const agenciaId = await agenciaIdDesdeSesion();
    return await resolverItemsAutoNegoPlanet(agenciaId, tipo, query);
  } catch (e: any) {
    console.error("resolverItemsAutoNegoPlanetSesion:", e?.message);
    return { ok: false, error: e?.message, data: [] };
  }
}

// ─── Árbol de destinos: Categoría (continente) → Subcategoría (región) → Destino ──

interface NegoPlanetLocalizacion {
  id: string;
  post_title: string;
  post_name: string;
  parent: string;
}

async function fetchLocalizaciones(usuario: string, pass: string): Promise<NegoPlanetLocalizacion[]> {
  const url = `${BASE_URL}/destinos/?tipo=localizacion&usuario=${encodeURIComponent(usuario)}&pass=${encodeURIComponent(pass)}`;
  const res = await fetchConTimeout(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml);
  const root = data?.rss ?? data;
  const locs = asArray(root?.localizaciones?.localizacion);
  return locs.map((l: any) => ({
    id: String(l.id),
    post_title: l.post_title,
    post_name: l.post_name,
    parent: String(l.parent),
  }));
}

export interface NegoPlanetCategoria {
  post_name: string;
  post_title: string;
  totalDestinos: number;
  imagen?: string;
  oculto?: boolean;
}

export interface NegoPlanetOverride {
  oculto?: boolean;
  imagen?: string;
}

export interface NegoPlanetArbolDestino {
  post_name: string;
  post_title: string;
  location?: string;
  imagen?: string;
  oculto?: boolean;
}

export interface NegoPlanetArbolSubcategoria {
  post_name: string;
  post_title: string;
  imagen?: string;
  oculto?: boolean;
  destinos: NegoPlanetArbolDestino[];
}

export interface NegoPlanetArbolCategoria {
  post_name: string;
  post_title: string;
  imagen?: string;
  oculto?: boolean;
  totalDestinos: number;
  subcategorias: NegoPlanetArbolSubcategoria[];
  /** Destinos que cuelgan directamente de la categoría (sin subcategoría intermedia, ej. Islas Exóticas / Oceanía). */
  destinosDirectos: NegoPlanetArbolDestino[];
}

// "Islas Exóticas" se reparte entre otros continentes: cada destino de esa categoría
// se reasigna manualmente a la raíz que le corresponde geográficamente, dejando solo 5 categorías.
const REASIGNACION_ISLAS_EXOTICAS: Record<string, string> = {
  "maldivas": "asia",
  "polinesia": "oceania",
};

/** Determina a qué categoría raíz (y opcionalmente subcategoría) pertenece un destino, cruzando `location` con la jerarquía. */
function ubicarDestino(
  destino: { post_name: string; location?: string },
  raices: NegoPlanetLocalizacion[],
  hijosPorRaiz: Map<string, NegoPlanetLocalizacion[]>
): { raiz: NegoPlanetLocalizacion; sub: NegoPlanetLocalizacion | null } | null {
  const reasignada = REASIGNACION_ISLAS_EXOTICAS[destino.post_name];
  if (reasignada) {
    const raizReasignada = raices.find(r => r.post_name === reasignada);
    if (raizReasignada) return { raiz: raizReasignada, sub: null };
  }

  const location = destino.location;
  if (!location) return null;
  const partes = location.split(",").map(p => p.trim().toLowerCase());

  for (const raiz of raices) {
    const hijos = hijosPorRaiz.get(raiz.id) ?? [];
    const sub = hijos.find(h => partes.includes(h.post_title.toLowerCase()));
    if (sub) return { raiz, sub };
  }
  for (const raiz of raices) {
    if (partes.includes(raiz.post_title.toLowerCase())) return { raiz, sub: null };
  }
  return null;
}

function aplicarOverride<T extends { post_name: string }>(nodo: T, overrides?: Record<string, NegoPlanetOverride>): T & { oculto?: boolean; imagen?: string } {
  const ov = overrides?.[nodo.post_name];
  if (!ov) return nodo;
  return { ...nodo, oculto: ov.oculto, imagen: ov.imagen ?? (nodo as any).imagen };
}

async function construirArbolDestinos(
  usuario: string,
  pass: string,
  overrides?: Record<string, NegoPlanetOverride>
): Promise<NegoPlanetArbolCategoria[]> {
  const [locs, destinos] = await Promise.all([
    fetchLocalizaciones(usuario, pass),
    fetchDestinos(usuario, pass),
  ]);

  // "Islas Exóticas" se elimina como categoría propia: sus destinos se reasignan a otras raíces.
  const raices = locs.filter(l => l.parent === "0" && l.post_name !== "islas-exoticas");
  const hijosPorRaiz = new Map<string, NegoPlanetLocalizacion[]>();
  raices.forEach(r => hijosPorRaiz.set(r.id, locs.filter(l => l.parent === r.id)));

  const destinosPorSub = new Map<string, NegoPlanetDestino[]>();
  const destinosDirectosPorRaiz = new Map<string, NegoPlanetDestino[]>();
  const conteoPorRaiz = new Map<string, number>();
  const primerDestinoPorRaiz = new Map<string, NegoPlanetDestino>();

  destinos.forEach(d => {
    const ubicacion = ubicarDestino(d, raices, hijosPorRaiz);
    if (!ubicacion) return;
    const { raiz, sub } = ubicacion;
    conteoPorRaiz.set(raiz.id, (conteoPorRaiz.get(raiz.id) ?? 0) + 1);
    if (!primerDestinoPorRaiz.has(raiz.id)) primerDestinoPorRaiz.set(raiz.id, d);
    if (sub) {
      const key = sub.id;
      destinosPorSub.set(key, [...(destinosPorSub.get(key) ?? []), d]);
    } else {
      destinosDirectosPorRaiz.set(raiz.id, [...(destinosDirectosPorRaiz.get(raiz.id) ?? []), d]);
    }
  });

  // Imagen representativa: 1 llamada extra por categoría (máx. 6), usando el primer destino encontrado.
  const arbol = await Promise.all(raices.map(async raiz => {
    const ejemplo = primerDestinoPorRaiz.get(raiz.id);
    let imagenCategoria: string | undefined;
    if (ejemplo) {
      try {
        const detalle = await fetchDestinoPorNombre(usuario, pass, ejemplo.post_name);
        imagenCategoria = detalle[0]?.imagen;
      } catch {
        imagenCategoria = undefined;
      }
    }

    const hijos = hijosPorRaiz.get(raiz.id) ?? [];
    const subcategorias: NegoPlanetArbolSubcategoria[] = hijos.map(sub => {
      const destinosSub = destinosPorSub.get(sub.id) ?? [];
      return aplicarOverride({
        post_name: sub.post_name,
        post_title: sub.post_title,
        imagen: destinosSub[0]?.imagen,
        destinos: destinosSub.map(d => aplicarOverride({
          post_name: d.post_name,
          post_title: d.post_title,
          location: d.location,
          imagen: d.imagen,
        }, overrides)),
      }, overrides);
    });

    const destinosDirectos = (destinosDirectosPorRaiz.get(raiz.id) ?? []).map(d => aplicarOverride({
      post_name: d.post_name,
      post_title: d.post_title,
      location: d.location,
      imagen: d.imagen,
    }, overrides));

    return aplicarOverride({
      post_name: raiz.post_name,
      post_title: raiz.post_title,
      imagen: imagenCategoria,
      totalDestinos: conteoPorRaiz.get(raiz.id) ?? 0,
      subcategorias,
      destinosDirectos,
    }, overrides);
  }));

  return arbol;
}

/** Árbol completo (para el editor, con sesión). */
export async function obtenerArbolDestinosNegoPlanet(overrides?: Record<string, NegoPlanetOverride>) {
  try {
    const { usuario, pass } = await credenciales();
    const data = await construirArbolDestinos(usuario, pass, overrides);
    return { ok: true, data };
  } catch (e: any) {
    console.error("obtenerArbolDestinosNegoPlanet:", e?.message);
    return { ok: false, error: e?.message, data: [] as NegoPlanetArbolCategoria[] };
  }
}

/** Árbol completo, filtrando nodos ocultos (para el render público). */
export async function obtenerArbolDestinosNegoPlanetPublico(agenciaId: string, overrides?: Record<string, NegoPlanetOverride>) {
  try {
    const { usuario, pass } = await credencialesPorAgencia(agenciaId);
    const arbol = await construirArbolDestinos(usuario, pass, overrides);

    const filtrado = arbol
      .filter(cat => !cat.oculto)
      .map(cat => ({
        ...cat,
        subcategorias: cat.subcategorias
          .filter(sub => !sub.oculto)
          .map(sub => ({ ...sub, destinos: sub.destinos.filter(d => !d.oculto) })),
        destinosDirectos: cat.destinosDirectos.filter(d => !d.oculto),
      }));

    return { ok: true, data: filtrado };
  } catch (e: any) {
    console.error("obtenerArbolDestinosNegoPlanetPublico:", e?.message);
    return { ok: false, error: e?.message, data: [] as NegoPlanetArbolCategoria[] };
  }
}

/** Lista simple de categorías (compatibilidad con la vista previa de tarjetas). */
export async function listarCategoriasDestinoNegoPlanet(): Promise<{ ok: boolean; data: NegoPlanetCategoria[]; error?: string }> {
  const res = await obtenerArbolDestinosNegoPlanet();
  return {
    ok: res.ok,
    error: res.error,
    data: res.data.map(cat => ({ post_name: cat.post_name, post_title: cat.post_title, totalDestinos: cat.totalDestinos, imagen: cat.imagen, oculto: cat.oculto })),
  };
}

/** Variante pública (sin sesión) para la web de agencia. */
export async function listarCategoriasDestinoNegoPlanetPublica(agenciaId: string, overrides?: Record<string, NegoPlanetOverride>) {
  const res = await obtenerArbolDestinosNegoPlanetPublico(agenciaId, overrides);
  return {
    ok: res.ok,
    error: res.error,
    data: res.data.map(cat => ({ post_name: cat.post_name, post_title: cat.post_title, totalDestinos: cat.totalDestinos, imagen: cat.imagen })) as NegoPlanetCategoria[],
  };
}

// ─── Página de detalle (destino o programa) ─────────────────────────────────

export interface NegoPlanetDestinoDetalle {
  origen: "destino";
  post_title: string;
  post_name: string;
  contenido?: string;
  location?: string;
  imagen?: string;
  programas: { post_title: string; post_name: string; precio?: string; dias?: string; imagen?: string }[];
}

export interface NegoPlanetProgramaDetalle {
  origen: "programa";
  post_title: string;
  post_name: string;
  contenido?: string;
  itinerario?: string;
  incluye?: string;
  precio?: string;
  dias?: string;
  imagen?: string;
}

export type NegoPlanetDetalle = NegoPlanetDestinoDetalle | NegoPlanetProgramaDetalle;

async function fetchDestinoDetalle(usuario: string, pass: string, slug: string): Promise<NegoPlanetDestinoDetalle | null> {
  const url = `${BASE_URL}/?tipo=destino&busca=${encodeURIComponent(slug)}&usuario=${encodeURIComponent(usuario)}&pass=${encodeURIComponent(pass)}`;
  const res = await fetchConTimeout(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml);
  const root = data?.rss ?? data;
  const destinos = asArray(root?.destinos?.destino);
  const d = destinos.find((x: any) => x.post_name === slug) ?? destinos[0];
  if (!d) return null;

  const programas = asArray(d.programas?.item).map((p: any) => ({
    post_title: p.post_title,
    post_name: p.post_name,
    precio: p.preciosimple != null ? String(p.preciosimple) : p.precio,
    dias: p["días"] != null ? String(p["días"]) : undefined,
    imagen: extraerImagen(p.imagenes),
  }));

  return {
    origen: "destino",
    post_title: d.post_title,
    post_name: d.post_name,
    contenido: d.post_content,
    location: d.location,
    imagen: extraerImagen(d.imagenes),
    programas,
  };
}

async function fetchProgramaDetalle(usuario: string, pass: string, slug: string): Promise<NegoPlanetProgramaDetalle | null> {
  const url = `${BASE_URL}/programa/?busca=${encodeURIComponent(slug)}&usuario=${encodeURIComponent(usuario)}&pass=${encodeURIComponent(pass)}`;
  const res = await fetchConTimeout(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const xml = await res.text();
  const data = parser.parse(xml);
  const root = data?.rss ?? data;
  const p = root?.programa;
  if (!p) return null;

  return {
    origen: "programa",
    post_title: p.post_title,
    post_name: p.post_name,
    contenido: p.post_content,
    itinerario: p.itinerario,
    incluye: p.incluye,
    precio: p.preciosimple != null ? String(p.preciosimple) : p.precio,
    dias: p["días"] != null ? String(p["días"]) : undefined,
    imagen: extraerImagen(p.imagenes),
  };
}

export async function obtenerDetalleNegoPlanet(
  agenciaId: string,
  origen: "destino" | "programa",
  slug: string
): Promise<{ ok: boolean; data: NegoPlanetDetalle | null; error?: string }> {
  try {
    const { usuario, pass } = await credencialesPorAgencia(agenciaId);
    const data = origen === "destino"
      ? await fetchDestinoDetalle(usuario, pass, slug)
      : await fetchProgramaDetalle(usuario, pass, slug);
    if (!data) return { ok: false, error: "No encontrado", data: null };
    return { ok: true, data };
  } catch (e: any) {
    console.error("obtenerDetalleNegoPlanet:", e?.message);
    return { ok: false, error: e?.message, data: null };
  }
}

/** Variante con sesión de usuario, para previsualizar el detalle desde el editor. */
export async function obtenerDetalleNegoPlanetSesion(origen: "destino" | "programa", slug: string) {
  try {
    const agenciaId = await agenciaIdDesdeSesion();
    return await obtenerDetalleNegoPlanet(agenciaId, origen, slug);
  } catch (e: any) {
    console.error("obtenerDetalleNegoPlanetSesion:", e?.message);
    return { ok: false, error: e?.message, data: null };
  }
}
