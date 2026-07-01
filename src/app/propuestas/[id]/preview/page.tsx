"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPropuesta } from "@/actions/propuestas";
import { renderSeccion } from "@/app/propuestas/PreviewComponents";

export default function PreviewIdPage() {
  const { id } = useParams() as { id: string };
  const [secciones, setSecciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1. Try local storage first (for unsaved preview from editor)
      const raw = localStorage.getItem("momo_preview_secciones");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setSecciones(parsed);
          setLoading(false);
          return;
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Fetch from DB
      if (id) {
        const propuesta = await getPropuesta(id);
        if (propuesta && (propuesta as any).landing) {
          const landing = (propuesta as any).landing;
          const editorContent = Array.isArray(landing.editor_content) ? landing.editor_content : [];
          const designTokens = Array.isArray(landing.design_tokens) ? landing.design_tokens : [];
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
              anchoMax: d.anchoMax,
              menuLogo: s.menuLogo,
              menuItems: s.menuItems,
              menuBoton: s.menuBoton,
              menuColorFondo: d.menuColorFondo,
              menuColorTexto: d.menuColorTexto,
              menuColorBoton: d.menuColorBoton,
              menuFijo: d.menuFijo,
            };
          });
          setSecciones(mapped);
        }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        Cargando previsualización...
      </div>
    );
  }

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", containerType: "inline-size" }}>
      {secciones.filter(s => !s.oculta).map(s => (
        <div key={s.uid}>
          {renderSeccion(s, "100vh", "desktop", secciones)}
        </div>
      ))}
    </div>
  );
}
