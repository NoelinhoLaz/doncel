"use client";

import { useEffect, useState } from "react";
import { renderSeccion } from "@/app/propuestas/PreviewComponents";
import { getStyleVars } from "@/app/propuestas/nueva/utils/style-utils";

export default function PreviewNuevaPage() {
  const [secciones, setSecciones] = useState<any[]>([]);
  const [estilosGlobales, setEstilosGlobales] = useState<any>(null);
  const [agente, setAgente] = useState<any>(null);

  useEffect(() => {
    const rawGlobal = localStorage.getItem("momo_preview_estilos_globales");
    if (rawGlobal) {
      try {
        const parsedGlobal = JSON.parse(rawGlobal);
        setEstilosGlobales(parsedGlobal);
        (window as any).momoGlobalStyles = parsedGlobal;
      } catch (e) {
        console.error(e);
      }
    }
    const raw = localStorage.getItem("momo_preview_secciones");
    if (raw) {
      try {
        setSecciones(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    }

    import("@/actions/usuarios").then(({ getCurrentUsuario }) => {
      getCurrentUsuario().then(res => {
        if (res) setAgente(res);
      });
    });
  }, []);

  const seccionesVisibles = secciones.filter(s => !s.oculta);
  const menuFijo = seccionesVisibles.find(s => s.tipo === "menu" && s.menuFijo);

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", containerType: "inline-size", ...getStyleVars(estilosGlobales) }}>
      {menuFijo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }}>
          {renderSeccion(menuFijo, "100vh", "desktop", secciones, agente)}
        </div>
      )}
      {seccionesVisibles.map(s => (
        <div key={s.uid} style={s.tipo === "menu" && s.menuFijo ? { visibility: "hidden" } : undefined}>
          {renderSeccion(s, "100vh", "desktop", secciones, agente)}
        </div>
      ))}
    </div>
  );
}
