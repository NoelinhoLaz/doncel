import { getPaginaWebPorSlugPublica } from "@/actions/paginaWeb";
import { getDominioActualPublico } from "@/lib/agencyDb";
import { notFound } from "next/navigation";
import { renderPaginaWeb } from "./renderPaginaWeb";

export default async function OfertaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dominio = await getDominioActualPublico();
  if (!dominio) return notFound();

  const { pagina, agenciaId } = await getPaginaWebPorSlugPublica(slug, dominio);

  if (!pagina || !pagina.publicada || !agenciaId) return notFound();

  return renderPaginaWeb(pagina, agenciaId, dominio);
}
