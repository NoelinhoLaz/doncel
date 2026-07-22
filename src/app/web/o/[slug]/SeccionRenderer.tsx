"use client";

import { renderSeccion } from "@/app/propuestas/PreviewComponents";

export default function SeccionRenderer({
  seccion,
  canvasHeight,
  dispositivo,
  allSecciones,
  agente,
  listadoItemsPorSeccion,
  landingHref,
}: {
  seccion: any;
  canvasHeight: string;
  dispositivo: "desktop" | "tablet" | "mobile";
  allSecciones?: any[];
  agente?: any;
  listadoItemsPorSeccion?: Record<string, any[]>;
  landingHref?: string;
}) {
  return <>{renderSeccion(seccion, canvasHeight, dispositivo, allSecciones, agente, listadoItemsPorSeccion, landingHref)}</>;
}
