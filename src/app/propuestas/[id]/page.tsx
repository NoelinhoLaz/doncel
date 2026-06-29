import { getPropuesta } from "@/actions/propuestas";
import { PropuestaEditor } from "@/app/propuestas/nueva/page";
import { notFound } from "next/navigation";

export default async function EditarPropuestaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propuesta = await getPropuesta(id);

  if (!propuesta) return notFound();

  const landing = (propuesta as any).landing;

  // Reconstruct secciones merging editor_content (contenido) + design_tokens (diseño)
  const editorContent: any[] = Array.isArray(landing?.editor_content) ? landing.editor_content : [];
  const designTokens: any[] = Array.isArray(landing?.design_tokens) ? landing.design_tokens : [];

  const designMap = new Map(designTokens.map((d: any) => [d.uid, d]));

  const initialSecciones = editorContent.map((s: any) => {
    const d = designMap.get(s.uid) ?? {};
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
    };
  });

  return (
    <PropuestaEditor
      initialPropuestaId={id}
      initialSecciones={initialSecciones}
    />
  );
}
