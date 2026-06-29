import * as LucideIcons from "lucide-react";

const normalize = (value: string) => (value || "").replace(/[-_\s]+/g, "").toLowerCase();

export function resolveLucideIconComponent(iconName?: string) {
  const raw = String(iconName || "").trim();
  if (!raw) return null;

  const direct = (LucideIcons as any)[raw];
  if (direct) return direct;

  const normalized = normalize(raw);
  const key = Object.keys(LucideIcons).find((candidate) => normalize(candidate) === normalized);
  if (!key) return null;

  return (LucideIcons as any)[key] || null;
}
