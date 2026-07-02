"use client";
import React from "react";
import { PropuestaEditor } from "./PropuestaEditor";

export { PropuestaEditor } from "./PropuestaEditor";
export { renderSeccion } from "./utils/section-render";

export default function NuevaPropuestaPage({ searchParams }: { searchParams: Promise<{ cotizacion_id?: string }> }) {
  const [cotizacionId, setCotizacionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    searchParams.then(p => { if (p.cotizacion_id) setCotizacionId(p.cotizacion_id); });
  }, []);

  return <PropuestaEditor initialCotizacionId={cotizacionId} />;
}
