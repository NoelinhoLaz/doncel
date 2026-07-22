import { getPaginaWeb } from "@/actions/paginaWeb";
import { WebEditor } from "../WebEditor";
import { SimpleEditor } from "../SimpleEditor";
import { FormatoIndexEditor } from "../FormatoIndexEditor";
import { notFound } from "next/navigation";

export default async function EditarPaginaWebPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pagina = await getPaginaWeb(id);

  if (!pagina) return notFound();

  if (pagina.modo === "formato-index") {
    const designTokens: any[] = Array.isArray(pagina.design_tokens) ? pagina.design_tokens : [];
    const disenio = designTokens.find((d: any) => d.uid === "formato-index") ?? {};
    return (
      <FormatoIndexEditor
        paginaId={pagina.id}
        paginaTitulo={pagina.titulo}
        paginaSlug={pagina.slug}
        formatoId={pagina.formato_id}
        initialDisenio={disenio}
      />
    );
  }

  if (!pagina.es_landing && pagina.modo === "simple") {
    const content = pagina.editor_content && !Array.isArray(pagina.editor_content) ? pagina.editor_content : {};
    return (
      <SimpleEditor
        paginaId={pagina.id}
        paginaTitulo={pagina.titulo}
        paginaSlug={pagina.slug}
        initialContenido={content.contenido ?? ""}
      />
    );
  }

  const editorContent: any[] = Array.isArray(pagina.editor_content) ? pagina.editor_content : [];
  const designTokens: any[] = Array.isArray(pagina.design_tokens) ? pagina.design_tokens : [];
  const globalToken = designTokens.find((d: any) => d.uid === "global");
  const initialEstilosGlobales = globalToken?.estilosGlobales ?? null;

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
      imagenFondo: d.imagenFondo,
      imagenFondoOverlay: d.imagenFondoOverlay,
      anchoMax: d.anchoMax,
      menuLogo: s.menuLogo,
      menuItems: s.menuItems,
      menuOverrides: s.menuOverrides,
      menuBoton: s.menuBoton,
      menuColorFondo: d.menuColorFondo,
      menuColorTexto: d.menuColorTexto,
      menuColorBoton: d.menuColorBoton,
      menuFijo: d.menuFijo,
      pvp: s.pvp,
      condiciones: s.condiciones,
      estiloPvp: d.estiloPvp,
      estiloCondiciones: d.estiloCondiciones,
      formularioCampos: s.formularioCampos,
      formularioEmail: s.formularioEmail,
      formularioBoton: s.formularioBoton,
      cards: s.cards,
      galeria: s.galeria,
      listadoFormatoId: s.listadoFormatoId,
      listadoEstiloTarjeta: d.listadoEstiloTarjeta,
      negoPlanetItems: s.negoPlanetItems,
      negoPlanetModo: s.negoPlanetModo,
      negoPlanetAutoTipo: s.negoPlanetAutoTipo,
      negoPlanetAutoQuery: s.negoPlanetAutoQuery,
      negoPlanetOverrides: s.negoPlanetOverrides,
    };
  });

  return (
    <WebEditor
      paginaId={pagina.id}
      paginaTitulo={pagina.titulo}
      initialSecciones={initialSecciones}
      initialEstilosGlobales={initialEstilosGlobales}
    />
  );
}
