"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pagina";
}

async function slugUnicoEnTabla(agencyDb: any, tabla: string, base: string, excludeId?: string) {
  let slug = base;
  let i = 1;
  while (true) {
    let query = agencyDb.from(tabla).select("id").eq("slug", slug);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

// ─── Formatos ───────────────────────────────────────────────────────────────

export async function getFormatosWeb() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("paginas_web_formatos")
      .select("id, nombre, slug, color, icono")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e: any) {
    console.error("getFormatosWeb:", e?.message);
    return [];
  }
}

export async function crearFormatoWeb({ nombre, color }: { nombre: string; color?: string }) {
  try {
    const agencyDb = await getAgencyDbClient();
    const slug = await slugUnicoEnTabla(agencyDb, "paginas_web_formatos", slugify(nombre));
    const { data, error } = await agencyDb
      .from("paginas_web_formatos")
      .insert({ nombre, slug, color: color || null })
      .select("id, nombre, slug, color, icono")
      .single();
    if (error || !data) throw error;
    revalidatePath("/web");
    return { ok: true, formato: data };
  } catch (e: any) {
    console.error("crearFormatoWeb:", e?.message);
    return { ok: false, error: e?.message };
  }
}

export async function eliminarFormatoWeb(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb.from("paginas_web_formatos").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/web");
    return { ok: true };
  } catch (e: any) {
    console.error("eliminarFormatoWeb:", e?.message);
    return { ok: false, error: e?.message };
  }
}

// ─── Páginas ────────────────────────────────────────────────────────────────

export async function getPaginasWeb() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("paginas_web")
      .select("id, es_landing, formato_id, modo, titulo, slug, publicada, created_at, updated_at, paginas_web_formatos(id, nombre, slug, color)")
      .order("es_landing", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p: any) => ({ ...p, formato: p.paginas_web_formatos ?? null, paginas_web_formatos: undefined }));
  } catch (e: any) {
    console.error("getPaginasWeb:", e?.message);
    return [];
  }
}

export async function getPaginasWebPorFormato(formatoId: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("paginas_web")
      .select("id, modo, titulo, slug, publicada, editor_content, created_at")
      .eq("formato_id", formatoId)
      .eq("publicada", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p: any) => {
      let media = null;
      let extracto = "";
      if (p.modo === "simple") {
        const html: string = p.editor_content?.contenido ?? "";
        const imgMatch = html.match(/<img[^>]+src="([^"]+)"/);
        media = imgMatch ? { tipo: "upload", url: imgMatch[1] } : null;
        const textoPlano = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        extracto = textoPlano.slice(0, 140);
      } else {
        const editorContent: any[] = Array.isArray(p.editor_content) ? p.editor_content : [];
        const portada = editorContent.find((s: any) => s.tipo === "portada");
        media = portada?.medias?.[0] ?? null;
        extracto = (portada?.subtitulo ?? "").slice(0, 140);
      }
      return { id: p.id, titulo: p.titulo, slug: p.slug, media, createdAt: p.created_at, extracto };
    });
  } catch (e: any) {
    console.error("getPaginasWebPorFormato:", e?.message);
    return [];
  }
}

export async function getPaginaWebLanding() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("paginas_web")
      .select("id, es_landing, titulo, slug, editor_content, design_tokens")
      .eq("es_landing", true)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e: any) {
    console.error("getPaginaWebLanding:", e?.message);
    return null;
  }
}

export async function getPaginaWeb(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("paginas_web")
      .select("id, es_landing, formato_id, modo, titulo, slug, publicada, editor_content, design_tokens")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e: any) {
    console.error("getPaginaWeb:", e?.message);
    return null;
  }
}

export async function getPaginaWebPorSlug(slug: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("paginas_web")
      .select("id, es_landing, formato_id, modo, titulo, slug, publicada, editor_content, design_tokens")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e: any) {
    console.error("getPaginaWebPorSlug:", e?.message);
    return null;
  }
}

export async function crearPaginaWeb({ titulo, formatoId, modo }: { titulo: string; formatoId?: string | null; modo?: "secciones" | "simple" }) {
  try {
    const agencyDb = await getAgencyDbClient();
    const slug = await slugUnicoEnTabla(agencyDb, "paginas_web", slugify(titulo));
    const { data, error } = await agencyDb
      .from("paginas_web")
      .insert({ titulo, slug, formato_id: formatoId || null, modo: modo ?? "secciones" })
      .select("id")
      .single();
    if (error || !data) throw error;
    revalidatePath("/web");
    return { ok: true, id: data.id };
  } catch (e: any) {
    console.error("crearPaginaWeb:", e?.message);
    return { ok: false, error: e?.message };
  }
}

export async function eliminarPaginaWeb(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data: pagina } = await agencyDb.from("paginas_web").select("es_landing").eq("id", id).maybeSingle();
    if (pagina?.es_landing) return { ok: false, error: "No se puede eliminar la página principal" };
    const { error } = await agencyDb.from("paginas_web").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/web");
    return { ok: true };
  } catch (e: any) {
    console.error("eliminarPaginaWeb:", e?.message);
    return { ok: false, error: e?.message };
  }
}

export async function togglePublicadaPaginaWeb(id: string, publicada: boolean) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb.from("paginas_web").update({ publicada }).eq("id", id);
    if (error) throw error;
    revalidatePath("/web");
    return { ok: true };
  } catch (e: any) {
    console.error("togglePublicadaPaginaWeb:", e?.message);
    return { ok: false, error: e?.message };
  }
}

export async function guardarPaginaWeb({
  id,
  titulo,
  editorContent,
  designTokens,
}: {
  id: string;
  titulo?: string;
  editorContent: any[];
  designTokens: any[];
}) {
  try {
    const agencyDb = await getAgencyDbClient();

    const updates: any = { editor_content: editorContent, design_tokens: designTokens, updated_at: new Date().toISOString() };

    if (titulo) {
      const { data: actual } = await agencyDb.from("paginas_web").select("titulo, slug, es_landing").eq("id", id).maybeSingle();
      if (actual && actual.titulo !== titulo) {
        updates.titulo = titulo;
        if (!actual.es_landing) {
          updates.slug = await slugUnicoEnTabla(agencyDb, "paginas_web", slugify(titulo), id);
        }
      }
    }

    const { error } = await agencyDb.from("paginas_web").update(updates).eq("id", id);
    if (error) throw error;

    revalidatePath("/web");
    return { ok: true, id };
  } catch (e: any) {
    console.error("guardarPaginaWeb:", e?.message);
    return { ok: false, error: e?.message };
  }
}

export async function guardarPaginaWebSimple({
  id,
  titulo,
  contenido,
  slug,
}: {
  id: string;
  titulo: string;
  contenido: string;
  slug?: string;
}) {
  try {
    const agencyDb = await getAgencyDbClient();

    const updates: any = { editor_content: { contenido }, updated_at: new Date().toISOString() };

    const { data: actual } = await agencyDb.from("paginas_web").select("titulo, slug, es_landing").eq("id", id).maybeSingle();
    if (actual && actual.titulo !== titulo) {
      updates.titulo = titulo;
    }

    if (actual && !actual.es_landing) {
      const slugDeseado = slug?.trim() ? slugify(slug) : (actual.titulo !== titulo ? slugify(titulo) : null);
      if (slugDeseado && slugDeseado !== actual.slug) {
        updates.slug = await slugUnicoEnTabla(agencyDb, "paginas_web", slugDeseado, id);
      }
    }

    const { error } = await agencyDb.from("paginas_web").update(updates).eq("id", id);
    if (error) throw error;

    revalidatePath("/web");
    return { ok: true, id };
  } catch (e: any) {
    console.error("guardarPaginaWebSimple:", e?.message);
    return { ok: false, error: e?.message };
  }
}
