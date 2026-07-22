"use client";

import { useEffect, useState } from "react";
import { renderSeccion } from "@/app/propuestas/PreviewComponents";
import { getStyleVars } from "@/app/propuestas/nueva/utils/style-utils";
import { getPaginasWebPorFormato } from "@/actions/paginaWeb";
import { resolverItemsAutoNegoPlanetSesion, obtenerArbolDestinosNegoPlanet } from "@/actions/negoplanet";

export default function PreviewWebPage() {
  const [secciones, setSecciones] = useState<any[]>([]);
  const [estilosGlobales, setEstilosGlobales] = useState<any>(null);
  const [agente, setAgente] = useState<any>(null);
  const [listadoItemsPorSeccion, setListadoItemsPorSeccion] = useState<Record<string, any[]>>({});

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
        const parsed = JSON.parse(raw);
        setSecciones(parsed);
        parsed.filter((s: any) => s.tipo === "ofertas" && s.listadoFormatoId).forEach((s: any) => {
          getPaginasWebPorFormato(s.listadoFormatoId).then(items => {
            setListadoItemsPorSeccion(prev => ({ ...prev, [s.uid]: items }));
          });
        });
        parsed.filter((s: any) => s.tipo === "nego-planet-programas" && s.negoPlanetModo === "auto").forEach((s: any) => {
          resolverItemsAutoNegoPlanetSesion(s.negoPlanetAutoTipo ?? "programas-destacados", s.negoPlanetAutoQuery).then(res => {
            if (res.ok) setListadoItemsPorSeccion(prev => ({ ...prev, [s.uid]: res.data }));
          });
        });
        parsed.filter((s: any) => s.tipo === "nego-planet-destinos").forEach((s: any) => {
          obtenerArbolDestinosNegoPlanet(s.negoPlanetOverrides).then(res => {
            if (res.ok) setListadoItemsPorSeccion(prev => ({ ...prev, [s.uid]: res.data }));
          });
        });
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
          {renderSeccion(menuFijo, "100vh", "desktop", secciones, agente, listadoItemsPorSeccion)}
        </div>
      )}
      {seccionesVisibles.map(s => (
        <div key={s.uid} id={s.uid} style={s.tipo === "menu" && s.menuFijo ? { display: "none" } : undefined}>
          {renderSeccion(s, "100vh", "desktop", secciones, agente, listadoItemsPorSeccion)}
        </div>
      ))}
    </div>
  );
}
