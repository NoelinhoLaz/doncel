"use client";
import React from "react";
import { PropuestaEditor } from "./PropuestaEditor";

export { PropuestaEditor } from "./PropuestaEditor";
export { renderSeccion } from "./utils/section-render";

export default function NuevaPropuestaPage({ searchParams }: { searchParams: Promise<{ cotizacion_id?: string; contacto_id?: string; contacto_nombre?: string; cliente_id?: string; cliente_nombre?: string; clienteId?: string; clienteNombre?: string }> }) {
  const [cotizacionId, setCotizacionId] = React.useState<string | null>(null);
  const [contactoId, setContactoId] = React.useState<string | null>(null);
  const [contactoNombre, setContactoNombre] = React.useState<string | null>(null);

  React.useEffect(() => {
    searchParams.then(p => {
      if (p.cotizacion_id) setCotizacionId(p.cotizacion_id);
      const cId = p.contacto_id || p.cliente_id || p.clienteId;
      const cNom = p.contacto_nombre || p.cliente_nombre || p.clienteNombre;
      if (cId) setContactoId(cId);
      if (cNom) setContactoNombre(cNom);
    });
  }, [searchParams]);

  return (
    <PropuestaEditor
      initialCotizacionId={cotizacionId}
      initialContactoId={contactoId}
      initialContactoNombre={contactoNombre}
    />
  );
}
