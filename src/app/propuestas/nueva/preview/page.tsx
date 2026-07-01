"use client";

import { useEffect, useState } from "react";
import { renderSeccion } from "@/app/propuestas/PreviewComponents";

export default function PreviewNuevaPage() {
  const [secciones, setSecciones] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("momo_preview_secciones");
    if (raw) {
      try {
        setSecciones(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", containerType: "inline-size" }}>
      {secciones.filter(s => !s.oculta).map(s => (
        <div key={s.uid}>
          {renderSeccion(s, "100vh", "desktop", secciones)}
        </div>
      ))}
    </div>
  );
}
