"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPropuestaIdPorSlug } from "@/actions/propuestas";
import PreviewIdPage from "@/app/propuestas/[id]/preview/page";

export default function PreviewSlugPage() {
  const { slug } = useParams() as { slug: string };
  const [id, setId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    async function resolve() {
      const dominio = window.location.hostname;
      const resolvedId = await getPropuestaIdPorSlug(slug, dominio);
      setId(resolvedId);
    }
    if (slug) resolve();
  }, [slug]);

  if (id === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        Cargando previsualización...
      </div>
    );
  }

  if (id === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", gap: "0.5rem", color: "#64748b" }}>
        <p>No se ha podido cargar esta propuesta.</p>
        <p style={{ fontSize: "0.85rem" }}>Es posible que el enlace ya no esté disponible.</p>
      </div>
    );
  }

  return <PreviewIdPage forcedId={id} />;
}
