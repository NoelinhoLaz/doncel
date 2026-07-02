"use client";

import { useEffect, useState } from "react";
import { renderSeccion } from "@/app/propuestas/PreviewComponents";

export default function PreviewNuevaPage() {
  const [secciones, setSecciones] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("momo_preview_secciones");
    if (raw) {
      try {
        setSecciones(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const seccionesVisibles = secciones.filter(s => !s.oculta);
  const menuFijo = seccionesVisibles.find(s => s.tipo === "menu" && s.menuFijo);

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", containerType: "inline-size" }}>
      {menuFijo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }}>
          {renderSeccion(menuFijo, "100vh", "desktop", secciones)}
        </div>
      )}
      {seccionesVisibles.map(s => (
        <div key={s.uid} style={s.tipo === "menu" && s.menuFijo ? { visibility: "hidden" } : undefined}>
          {renderSeccion(s, "100vh", "desktop", secciones)}
        </div>
      ))}
    </div>
  );
}
