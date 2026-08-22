"use client";

import PlazoDots from "./PlazoDots";

interface PagadorDetalle {
  entidadId: string;
  nombre: string;
  dots: { color: string; tooltip: string }[];
}

interface Props {
  pagadoresDetalle: PagadorDetalle[];
}

function inicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase() || "?";
}

export default function PlazoDotsMultiPagador({ pagadoresDetalle }: Props) {
  if (pagadoresDetalle.length === 0) {
    return <PlazoDots dots={[]} />;
  }

  if (pagadoresDetalle.length === 1) {
    return <PlazoDots dots={pagadoresDetalle[0].dots} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-end" }}>
      {pagadoresDetalle.map((p) => (
        <div key={p.entidadId} style={{ display: "flex", alignItems: "center", gap: "4px" }} title={p.nombre}>
          <span style={{ fontSize: "9px", fontWeight: 700, color: "#94a3b8", minWidth: "10px", textAlign: "right" }}>
            {inicial(p.nombre)}.
          </span>
          <PlazoDots dots={p.dots} />
        </div>
      ))}
    </div>
  );
}
