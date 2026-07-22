import { getAgencyDbClientByDomain, getDominioActualPublico } from "@/lib/agencyDb";
import { getPaginaWebLandingPublica } from "@/actions/paginaWeb";
import { obtenerDetalleNegoPlanet } from "@/actions/negoplanet";
import { notFound } from "next/navigation";
import Link from "next/link";
import SeccionRenderer from "../../../o/[slug]/SeccionRenderer";

async function getMenuLanding(dominio: string) {
  const { landing } = await getPaginaWebLandingPublica(dominio);
  if (!landing) return null;

  const editorContent: any[] = Array.isArray(landing.editor_content) ? landing.editor_content : [];
  const designTokens: any[] = Array.isArray(landing.design_tokens) ? landing.design_tokens : [];
  const designMap = new Map(designTokens.map((d: any) => [d.uid, d]));
  const secciones = editorContent.map((s: any) => ({ ...s, ...(designMap.get(s.uid) ?? {}) }));

  return { menu: secciones.find((s: any) => s.tipo === "menu" && !s.oculta) ?? null, secciones, landingSlug: landing.slug as string };
}

export default async function NegoDetallePage({ params }: { params: Promise<{ origen: string; slug: string }> }) {
  const { origen, slug } = await params;
  if (origen !== "destino" && origen !== "programa") return notFound();

  const dominio = await getDominioActualPublico();
  if (!dominio) return notFound();

  const resolved = await getAgencyDbClientByDomain(dominio);
  if (!resolved) return notFound();

  const [{ ok, data: detalle }, menuLanding] = await Promise.all([
    obtenerDetalleNegoPlanet(resolved.agenciaId, origen, slug),
    getMenuLanding(dominio),
  ]);

  if (!ok || !detalle) return notFound();

  const menu = menuLanding?.menu;
  const menuEsFijo = !!menu?.menuFijo;

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      {menu && (
        <div style={menuEsFijo ? { position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 } : undefined}>
          <SeccionRenderer seccion={menu} canvasHeight="100vh" dispositivo="desktop" allSecciones={menuLanding?.secciones} landingHref={menuLanding?.landingSlug ? `/web/o/${menuLanding.landingSlug}` : undefined} />
        </div>
      )}

      {detalle.imagen && (
        <div style={{ width: "100%", aspectRatio: "16/7", backgroundImage: `url(${detalle.imagen})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      )}

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: detalle.imagen ? "1.5rem 2rem 4rem 2rem" : "3rem 2rem 4rem 2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#1e293b", margin: "0 0 0.5rem 0" }}>{detalle.post_title}</h1>

        {detalle.origen === "destino" && detalle.location && (
          <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 1.5rem 0" }}>{detalle.location}</p>
        )}

        {detalle.origen === "programa" && (detalle.precio || detalle.dias) && (
          <div style={{ display: "flex", gap: "12px", fontSize: "0.9rem", color: "#334155", margin: "0 0 1.5rem 0", fontWeight: 600 }}>
            {detalle.dias && <span>{detalle.dias} días</span>}
            {detalle.precio && <span>{detalle.precio} € / persona</span>}
          </div>
        )}

        {detalle.contenido && (
          <div
            style={{ fontSize: "1rem", lineHeight: 1.7, color: "#334155", marginBottom: "1.5rem" }}
            className="momo-rich-content"
            dangerouslySetInnerHTML={{ __html: detalle.contenido }}
          />
        )}

        {detalle.origen === "programa" && detalle.itinerario && (
          <>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "2rem 0 0.75rem 0" }}>Itinerario</h2>
            <div
              style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#334155" }}
              className="momo-rich-content"
              dangerouslySetInnerHTML={{ __html: detalle.itinerario }}
            />
          </>
        )}

        {detalle.origen === "programa" && detalle.incluye && (
          <>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "2rem 0 0.75rem 0" }}>Incluye</h2>
            <div
              style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#334155" }}
              className="momo-rich-content"
              dangerouslySetInnerHTML={{ __html: detalle.incluye }}
            />
          </>
        )}

        {detalle.origen === "destino" && detalle.programas.length > 0 && (
          <>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "2rem 0 0.75rem 0" }}>Programas en {detalle.post_title}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
              {detalle.programas.map(p => (
                <Link
                  key={p.post_name}
                  href={`/web/nego/programa/${p.post_name}`}
                  style={{ textDecoration: "none", color: "inherit", border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden" }}
                >
                  <div style={{ width: "100%", aspectRatio: "4/3", backgroundImage: p.imagen ? `url(${p.imagen})` : undefined, backgroundSize: "cover", backgroundPosition: "center", background: p.imagen ? undefined : "#f1f5f9" }} />
                  <div style={{ padding: "0.65rem 0.75rem" }}>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e293b", margin: "0 0 4px 0" }}>{p.post_title}</h4>
                    <div style={{ display: "flex", gap: "8px", fontSize: "0.75rem", color: "#94a3b8" }}>
                      {p.dias && <span>{p.dias} días</span>}
                      {p.precio && <span>{p.precio} €</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
