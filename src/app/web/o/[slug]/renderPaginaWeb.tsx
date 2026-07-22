import { getPaginaWebLandingPublica, getPaginasWebPorFormatoPublica } from "@/actions/paginaWeb";
import { getAgencyDbClientByDomain } from "@/lib/agencyDb";
import { resolverItemsAutoNegoPlanet, obtenerArbolDestinosNegoPlanetPublico } from "@/actions/negoplanet";
import { PHListado } from "@/app/propuestas/PreviewComponents";
import { getStyleVars } from "@/app/propuestas/nueva/utils/style-utils";
import SeccionRenderer from "./SeccionRenderer";

export async function getMenuLanding(dominio: string) {
  const { landing } = await getPaginaWebLandingPublica(dominio);
  if (!landing) return { menu: null, secciones: [] as any[], landingSlug: null as string | null };

  const editorContent: any[] = Array.isArray(landing.editor_content) ? landing.editor_content : [];
  const designTokens: any[] = Array.isArray(landing.design_tokens) ? landing.design_tokens : [];
  const designMap = new Map(designTokens.map((d: any) => [d.uid, d]));
  const secciones = editorContent.map((s: any) => ({ ...s, ...(designMap.get(s.uid) ?? {}) }));

  const menu = secciones.find((s: any) => s.tipo === "menu" && !s.oculta) ?? null;
  return { menu, secciones, landingSlug: landing.slug as string };
}

export async function renderPaginaWeb(pagina: any, agenciaId: string, dominio: string) {
  if (pagina.modo === "formato-index") {
    const designTokens: any[] = Array.isArray(pagina.design_tokens) ? pagina.design_tokens : [];
    const disenio = designTokens.find((d: any) => d.uid === "formato-index") ?? {};
    const { menu, secciones: seccionesLanding, landingSlug } = await getMenuLanding(dominio);
    const menuEsFijo = !!menu?.menuFijo;

    const resolved = await getAgencyDbClientByDomain(dominio);
    const items = resolved && pagina.formato_id
      ? await getPaginasWebPorFormatoPublica(pagina.formato_id, resolved.db)
      : [];

    return (
      <div style={{ background: "#ffffff", minHeight: "100vh" }}>
        {menu && (
          <div style={menuEsFijo ? { position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 } : undefined}>
            <SeccionRenderer seccion={menu} canvasHeight="100vh" dispositivo="desktop" allSecciones={seccionesLanding} landingHref={landingSlug ? `/public` : undefined} />
          </div>
        )}
        <div style={{ paddingTop: menuEsFijo ? "5rem" : 0 }}>
          <PHListado
            titulo={pagina.titulo}
            layout={disenio.layout}
            colorFondo={disenio.colorFondo}
            imagenFondo={disenio.imagenFondo}
            imagenFondoOverlay={disenio.imagenFondoOverlay}
            estiloTitulo={disenio.estiloTitulo}
            estiloTituloDia={disenio.estiloTituloDia}
            anchoMax={disenio.anchoMax}
            formatoId={pagina.formato_id ?? undefined}
            items={items}
            estiloTarjeta={disenio.estiloTarjeta}
          />
        </div>
      </div>
    );
  }

  if (pagina.modo === "simple") {
    const content = pagina.editor_content && !Array.isArray(pagina.editor_content) ? pagina.editor_content : {};
    const contenido: string = content.contenido ?? "";
    const { menu, secciones: seccionesLanding, landingSlug } = await getMenuLanding(dominio);
    const menuEsFijo = !!menu?.menuFijo;
    return (
      <div style={{ background: "#ffffff", minHeight: "100vh" }}>
        {menu && (
          <div style={menuEsFijo ? { position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 } : undefined}>
            <SeccionRenderer seccion={menu} canvasHeight="100vh" dispositivo="desktop" allSecciones={seccionesLanding} landingHref={landingSlug ? `/public` : undefined} />
          </div>
        )}
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: menuEsFijo ? "6rem 2rem 3rem 2rem" : "3rem 2rem" }}>
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

  const listadoItemsPorSeccion: Record<string, any[]> = {};

  const listadoSecciones = secciones.filter((s: any) => s.tipo === "ofertas" && s.listadoFormatoId);
  if (listadoSecciones.length > 0) {
    const resolved = await getAgencyDbClientByDomain(dominio);
    if (resolved) {
      await Promise.all(listadoSecciones.map(async (s: any) => {
        listadoItemsPorSeccion[s.uid] = await getPaginasWebPorFormatoPublica(s.listadoFormatoId, resolved.db);
      }));
    }
  }

  const negoPlanetProgramasSecciones = secciones.filter((s: any) => s.tipo === "nego-planet-programas" && s.negoPlanetModo === "auto");
  await Promise.all(negoPlanetProgramasSecciones.map(async (s: any) => {
    const res = await resolverItemsAutoNegoPlanet(agenciaId, s.negoPlanetAutoTipo ?? "programas-destacados", s.negoPlanetAutoQuery);
    if (res.ok) listadoItemsPorSeccion[s.uid] = res.data;
  }));

  const negoPlanetDestinosSecciones = secciones.filter((s: any) => s.tipo === "nego-planet-destinos");
  await Promise.all(negoPlanetDestinosSecciones.map(async (s: any) => {
    const res = await obtenerArbolDestinosNegoPlanetPublico(agenciaId, s.negoPlanetOverrides);
    if (res.ok) listadoItemsPorSeccion[s.uid] = res.data;
  }));

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", containerType: "inline-size", ...getStyleVars(estilosGlobales) }}>
      {menuFijo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }}>
          <SeccionRenderer seccion={menuFijo} canvasHeight="100vh" dispositivo="desktop" allSecciones={secciones} listadoItemsPorSeccion={listadoItemsPorSeccion} />
        </div>
      )}
      {seccionesVisibles.map((s: any) => (
        <div key={s.uid} id={s.uid} style={s.tipo === "menu" && s.menuFijo ? { display: "none" } : undefined}>
          <SeccionRenderer seccion={s} canvasHeight="100vh" dispositivo="desktop" allSecciones={secciones} listadoItemsPorSeccion={listadoItemsPorSeccion} />
        </div>
      ))}
    </div>
  );
}
