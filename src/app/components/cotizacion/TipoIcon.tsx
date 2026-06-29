"use client";
import { Bed, Plane, Compass, MapPin } from "lucide-react";
import { Icons } from "@/lib/icons";
import { resolveLucideIconComponent } from "@/lib/lucideIconResolver";

export default function TipoIcon({ iconName, size = 14 }: { iconName?: string; size?: number }) {
  const IconComponent = resolveLucideIconComponent(iconName);
  if (IconComponent) return <IconComponent size={size} />;
  const n = String(iconName || '').replace(/[-_\s]+/g, '').toLowerCase();
  if (n === 'mappin') return <MapPin size={size} />;
  if (n === 'bed') return <Bed size={size} />;
  if (n === 'plane') return <Plane size={size} />;
  if (n === 'compass') return <Compass size={size} />;
  return <Icons.Servicios size={size} />;
}
