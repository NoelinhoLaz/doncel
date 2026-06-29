"use client";

import { getPaymentPlazos, getPlazoDetail } from "@/lib/utils/cobrosUtils";
import type { Pagador } from "@/lib/types/cobros";

interface Props {
  pagador: Pagador;
  globalPlazos: any[];
}

export default function PlazoDots({ pagador, globalPlazos }: Props) {
  const plazos = getPaymentPlazos(pagador, globalPlazos);
  const n = plazos.length || 3;
  const dots = Array.from({ length: n }, (_, i) => getPlazoDetail(pagador, globalPlazos, i));

  return (
    <div style={{ display: "flex", gap: "3px", justifyContent: "flex-end", alignItems: "center" }}>
      {dots.map((d, i) => {
        const fill = d.color === "green" ? "#22c55e" : d.color === "orange" ? "#f97316" : "#d1d5db";
        return (
          <div
            key={i}
            title={d.tooltip}
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: fill,
              transition: "background-color 0.2s",
              cursor: "pointer",
            }}
          />
        );
      })}
    </div>
  );
}
