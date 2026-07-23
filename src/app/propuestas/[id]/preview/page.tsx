"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPropuesta } from "@/actions/propuestas";
import { renderSeccion } from "@/app/propuestas/PreviewComponents";
import { getStyleVars } from "@/app/propuestas/nueva/utils/style-utils";

export default function PreviewIdPage() {
  const { id } = useParams() as { id: string };
  const [secciones, setSecciones] = useState<any[]>([]);
  const [estilosGlobales, setEstilosGlobales] = useState<any>(null);
  const [agente, setAgente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function load() {
      // Load global styles from local storage
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

      // 1. Try local storage first (for unsaved preview from editor)
      const raw = localStorage.getItem("momo_preview_secciones");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setSecciones(parsed);
          // Try to get agent if stored in localStorage or fetch from auth
          const { getCurrentUsuario } = await import("@/actions/usuarios");
          const usr = await getCurrentUsuario();
          if (usr) setAgente(usr);
          setLoading(false);
          return;
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Fetch from DB
      if (id) {
        const propuesta = await getPropuesta(id);
        if (propuesta) {
          if ((propuesta as any).agente) {
            setAgente((propuesta as any).agente);
          }
          if ((propuesta as any).landing) {
            const landing = (propuesta as any).landing;
            const editorContent = Array.isArray(landing.editor_content) ? landing.editor_content : [];
            const designTokens = Array.isArray(landing.design_tokens) ? landing.design_tokens : [];
            const globalToken = designTokens.find((d: any) => d.uid === "global");
            if (globalToken?.estilosGlobales) {
              setEstilosGlobales(globalToken.estilosGlobales);
              (window as any).momoGlobalStyles = globalToken.estilosGlobales;
            }
            const designMap = new Map(designTokens.map((d: any) => [d.uid, d]));

            const mapped = editorContent.map((s: any) => {
              const d: any = designMap.get(s.uid) ?? {};
              return {
                uid: s.uid,
                tipo: s.tipo,
                label: s.label,
                oculta: s.oculta,
                titulo: s.titulo,
                subtitulo: s.subtitulo,
                medias: s.medias,
                fechaDesde: s.fechaDesde,
                fechaHasta: s.fechaHasta,
                dias: s.dias,
                columnas: s.columnas,
                mapas: s.mapas,
                rutas: s.rutas,
                layout: d.layout,
                estiloTitulo: d.estiloTitulo,
                estiloSubtitulo: d.estiloSubtitulo,
                estiloTituloDia: d.estiloTituloDia,
                estiloDescDia: d.estiloDescDia,
                colorFondo: d.colorFondo,
                imagenFondo: d.imagenFondo,
                imagenFondoOverlay: d.imagenFondoOverlay,
                altoSeccion: d.altoSeccion,
                anchoMax: d.anchoMax,
                menuLogo: s.menuLogo,
                menuItems: s.menuItems,
                menuOverrides: s.menuOverrides,
                menuBoton: s.menuBoton,
                menuColorFondo: d.menuColorFondo,
                menuColorTexto: d.menuColorTexto,
                menuColorBoton: d.menuColorBoton,
                menuFijo: d.menuFijo,
                // Precio fields
                pvp: s.pvp,
                condiciones: s.condiciones,
                estiloPvp: d.estiloPvp,
                estiloCondiciones: d.estiloCondiciones,
                // Formulario fields
                formularioCampos: s.formularioCampos,
                formularioTitulo: s.formularioTitulo,
                formularioSubtitulo: s.formularioSubtitulo,
                formularioEmail: s.formularioEmail,
                cards: s.cards,
                galeria: s.galeria,
              };
            });
            setSecciones(mapped);
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (!mounted || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        {mounted ? "Cargando previsualización..." : null}
      </div>
    );
  }

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
        <div key={s.uid} id={s.uid} style={s.tipo === "menu" && s.menuFijo ? { display: "none" } : undefined}>
          {renderSeccion(s, "100vh", "desktop", secciones, agente)}
        </div>
      ))}
    </div>
  );
}
