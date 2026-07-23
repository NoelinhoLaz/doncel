import { getPaginaWebPorSlugPublica } from "@/actions/paginaWeb";
import { getDominioActualPublico } from "@/lib/agencyDb";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { renderPaginaWeb } from "./renderPaginaWeb";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const dominio = await getDominioActualPublico();
  if (!dominio) return {};

  const { pagina } = await getPaginaWebPorSlugPublica(slug, dominio);
  if (!pagina?.titulo) return {};

  return { title: pagina.titulo };
}

export default async function OfertaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dominio = await getDominioActualPublico();
  if (!dominio) return notFound();

  const { pagina, agenciaId } = await getPaginaWebPorSlugPublica(slug, dominio);

  if (!pagina || !pagina.publicada || !agenciaId) return notFound();

  return renderPaginaWeb(pagina, agenciaId, dominio);
}
