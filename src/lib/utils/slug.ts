export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pagina";
}

export async function slugUnicoEnTabla(agencyDb: any, tabla: string, base: string, excludeId?: string) {
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
