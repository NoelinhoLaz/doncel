import { getPaginaWebPorSlug, getPaginasWebPorFormato, getPaginaWebLanding } from "@/actions/paginaWeb";
import { getStyleVars } from "@/app/propuestas/PreviewComponents";
import { notFound } from "next/navigation";
import SeccionRenderer from "./SeccionRenderer";

async function getMenuFijoLanding() {
  const landing = await getPaginaWebLanding();
  if (!landing) return null;

  const editorContent: any[] = Array.isArray(landing.editor_content) ? landing.editor_content : [];
  const designTokens: any[] = Array.isArray(landing.design_tokens) ? landing.design_tokens : [];
  const designMap = new Map(designTokens.map((d: any) => [d.uid, d]));
  const secciones = editorContent.map((s: any) => ({ ...s, ...(designMap.get(s.uid) ?? {}) }));

  return secciones.find((s: any) => s.tipo === "menu" && s.menuFijo && !s.oculta) ?? null;
}

export default async function OfertaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pagina = await getPaginaWebPorSlug(slug);

  if (!pagina || !pagina.publicada) return notFound();

  if (pagina.modo === "simple") {
    const content = pagina.editor_content && !Array.isArray(pagina.editor_content) ? pagina.editor_content : {};
    const contenido: string = content.contenido ?? "";
    const menuFijo = await getMenuFijoLanding();
    return (
      <div style={{ background: "#ffffff", minHeight: "100vh" }}>
        {menuFijo && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }}>
            <SeccionRenderer seccion={menuFijo} canvasHeight="100vh" dispositivo="desktop" />
          </div>
        )}
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: menuFijo ? "6rem 2rem 3rem 2rem" : "3rem 2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#1e293b", margin: "0 0 1.5rem 0" }}>{pagina.titulo}</h1>
          <div
            style={{ fontSize: "1rem", lineHeight: 1.7, color: "#334155" }}
            className="momo-rich-content"
            dangerouslySetInnerHTML={{ __html: contenido }}
          />
        </div>
      </div>
    );
  }

  const editorContent: any[] = Array.isArray(pagina.editor_content) ? pagina.editor_content : [];
  const designTokens: any[] = Array.isArray(pagina.design_tokens) ? pagina.design_tokens : [];
  const globalToken = designTokens.find((d: any) => d.uid === "global");
  const estilosGlobales = globalToken?.estilosGlobales ?? null;
  const designMap = new Map(designTokens.map((d: any) => [d.uid, d]));

  const secciones = editorContent.map((s: any) => ({ ...s, ...(designMap.get(s.uid) ?? {}) }));
  const seccionesVisibles = secciones.filter((s: any) => !s.oculta);
  const menuFijo = seccionesVisibles.find((s: any) => s.tipo === "menu" && s.menuFijo);

  const listadoSecciones = secciones.filter((s: any) => s.tipo === "ofertas" && s.listadoFormatoId);
  const listadoItemsPorSeccion: Record<string, any[]> = {};
  await Promise.all(listadoSecciones.map(async (s: any) => {
    listadoItemsPorSeccion[s.uid] = await getPaginasWebPorFormato(s.listadoFormatoId);
  }));

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", containerType: "inline-size", ...getStyleVars(estilosGlobales) }}>
      {menuFijo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }}>
          <SeccionRenderer seccion={menuFijo} canvasHeight="100vh" dispositivo="desktop" allSecciones={secciones} listadoItemsPorSeccion={listadoItemsPorSeccion} />
        </div>
      )}
      {seccionesVisibles.map((s: any) => (
        <div key={s.uid} style={s.tipo === "menu" && s.menuFijo ? { visibility: "hidden" } : undefined}>
          <SeccionRenderer seccion={s} canvasHeight="100vh" dispositivo="desktop" allSecciones={secciones} listadoItemsPorSeccion={listadoItemsPorSeccion} />
        </div>
      ))}
    </div>
  );
}
