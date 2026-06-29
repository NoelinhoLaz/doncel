"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";

const AVATAR_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function hashColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function lookupContactAvatars(
  phones: string[]
): Promise<Record<string, { initials: string; color: string } | null>> {
  if (!phones.length) return {};
  const supabase = await getAgencyDbClient();

  // Normalize: remove + prefix for matching, and also try with/without
  const cleanPhones = phones.map((p) => p.replace(/^\+/, ""));

  const result: Record<string, { initials: string; color: string } | null> = {};
  phones.forEach((p) => (result[p] = null));

  // Look up entidades
  const { data: entidades } = await supabase
    .from("contabilidad_entidades")
    .select("nombre, telefono")
    .in("telefono", cleanPhones);

  if (entidades) {
    for (const e of entidades) {
      const key = phones.find((p) => p.replace(/^\+/, "") === e.telefono);
      if (key && e.nombre) {
        result[key] = { initials: initials(e.nombre), color: hashColor(e.nombre) };
      }
    }
  }

  // Look up proveedores (for unmatched phones)
  const unmatched = phones.filter((p) => !result[p]);
  if (!unmatched.length) return result;
  const cleanUnmatched = unmatched.map((p) => p.replace(/^\+/, ""));

  const { data: proveedores } = await supabase
    .from("contabilidad_proveedores")
    .select("nombre, razon_social, telefono")
    .in("telefono", cleanUnmatched);

  if (proveedores) {
    for (const p of proveedores) {
      const key = unmatched.find((u) => u.replace(/^\+/, "") === p.telefono);
      if (key) {
        const name = p.nombre || p.razon_social || "";
        if (name) {
          result[key] = { initials: initials(name), color: hashColor(name) };
        }
      }
    }
  }

  return result;
}
