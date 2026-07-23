import { getPaginaWebLandingPublica } from "@/actions/paginaWeb";
import { getDominioActualPublico } from "@/lib/agencyDb";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { renderPaginaWeb } from "@/app/web/o/[slug]/renderPaginaWeb";

export async function generateMetadata(): Promise<Metadata> {
  const dominio = await getDominioActualPublico();
  if (!dominio) return {};

  const { landing } = await getPaginaWebLandingPublica(dominio);
  if (!landing?.titulo) return {};

  return { title: landing.titulo };
}

export default async function LandingPublicaPage() {
  const dominio = await getDominioActualPublico();
  if (!dominio) return notFound();

  const { landing, agenciaId } = await getPaginaWebLandingPublica(dominio);

  if (!landing || !landing.publicada || !agenciaId) return notFound();

  return renderPaginaWeb(landing, agenciaId, dominio);
}
