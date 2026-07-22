import { getPaginaWebLandingPublica } from "@/actions/paginaWeb";
import { getDominioActualPublico } from "@/lib/agencyDb";
import { notFound } from "next/navigation";
import { renderPaginaWeb } from "@/app/web/o/[slug]/renderPaginaWeb";

export default async function LandingPublicaPage() {
  const dominio = await getDominioActualPublico();
  if (!dominio) return notFound();

  const { landing, agenciaId } = await getPaginaWebLandingPublica(dominio);

  if (!landing || !landing.publicada || !agenciaId) return notFound();

  return renderPaginaWeb(landing, agenciaId, dominio);
}
