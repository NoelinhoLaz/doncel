"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPropuestaPublica } from "@/actions/propuestas";
import { renderSeccion } from "@/app/propuestas/PreviewComponents";
import { getStyleVars } from "@/app/propuestas/nueva/utils/style-utils";
import type { Dispositivo } from "@/app/propuestas/nueva/types";

function useDispositivoReal(): Dispositivo {
  const [dispositivo, setDispositivo] = useState<Dispositivo>("desktop");
  useEffect(() => {
    const calcular = () => {
      const w = window.innerWidth;
      setDispositivo(w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop");
    };
    calcular();
    window.addEventListener("resize", calcular);
    return () => window.removeEventListener("resize", calcular);
  }, []);
  return dispositivo;
}

export default function PreviewIdPage({ forcedId }: { forcedId?: string } = {}) {
  const params = useParams() as { id: string };
  const id = forcedId ?? params.id;
  const [secciones, setSecciones] = useState<any[]>([]);
  const [estilosGlobales, setEstilosGlobales] = useState<any>(null);
  const [agente, setAgente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [notFoundError, setNotFoundError] = useState(false);
  const dispositivo = useDispositivoReal();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function load() {
      // Load global styles from local storage
      const rawGlobal = localStorage.getItem("momo_preview_estilos_globales");
      if (rawGlobal) {
        try {
          const parsedGlobal = JSON.parse(rawGlobal);
          setEstilosGlobales(parsedGlobal);
          (window as any).momoGlobalStyles = parsedGlobal;
        } catch (e) {
          console.error(e);
        }
      }

      // 1. Try local storage first (for unsaved preview from editor), but only if it
      // was stored for this exact propuesta — otherwise a stale preview from editing
      // a different propuesta would leak into this one.
      const storedId = localStorage.getItem("momo_preview_propuesta_id");
      const raw = storedId === id ? localStorage.getItem("momo_preview_secciones") : null;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setSecciones(parsed);
          // Try to get agent if stored in localStorage or fetch from auth
          const { getCurrentUsuario } = await import("@/actions/usuarios");
          const usr = await getCurrentUsuario();
          if (usr) setAgente(usr);
          setLoading(false);
          return;
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Fetch from DB (public route, no session required)
      if (id) {
        const dominio = window.location.hostname;
        const propuesta = await getPropuestaPublica(id, dominio);
        if (propuesta) {
          if ((propuesta as any).agente) {
            setAgente((propuesta as any).agente);
          }
          if ((propuesta as any).landing) {
            const landing = (propuesta as any).landing;
            const editorContent = Array.isArray(landing.editor_content) ? landing.editor_content : [];
            const designTokens = Array.isArray(landing.design_tokens) ? landing.design_tokens : [];
            const globalToken = designTokens.find((d: any) => d.uid === "global");
            if (globalToken?.estilosGlobales) {
              setEstilosGlobales(globalToken.estilosGlobales);
              (window as any).momoGlobalStyles = globalToken.estilosGlobales;
            }
            const designMap = new Map(designTokens.map((d: any) => [d.uid, d]));

            // `s` (editor_content) trae el contenido de cada sección y `d` (design_tokens)
            // trae su diseño; no comparten nombres de campo, así que combinarlos con
            // spread evita tener que mantener a mano una whitelist que se desincroniza
            // cada vez que se añade un campo nuevo al tipo Seccion (bug real: extrasFilas
            // llevaba tiempo sin propagarse aquí porque no estaba en esta lista).
            const mapped = editorContent.map((s: any) => {
              const d: any = designMap.get(s.uid) ?? {};
              return { ...s, ...d, uid: s.uid, tipo: s.tipo };
            });
            setSecciones(mapped);
          }
        } else {
          setNotFoundError(true);
        }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (!mounted || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        {mounted ? "Cargando previsualización..." : null}
      </div>
    );
  }

  if (notFoundError && secciones.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", gap: "0.5rem", color: "#64748b" }}>
        <p>No se ha podido cargar esta propuesta.</p>
        <p style={{ fontSize: "0.85rem" }}>Es posible que el enlace ya no esté disponible.</p>
      </div>
    );
  }

  const seccionesVisibles = secciones.filter(s => !s.oculta);
  const menuFijo = seccionesVisibles.find(s => s.tipo === "menu" && s.menuFijo);

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", containerType: "inline-size", ...getStyleVars(estilosGlobales) }}>
      {menuFijo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }}>
          {renderSeccion(menuFijo, "100vh", dispositivo, secciones, agente)}
        </div>
      )}
      {seccionesVisibles.map(s => (
        <div key={s.uid} id={s.uid} style={s.tipo === "menu" && s.menuFijo ? { display: "none" } : undefined}>
          {renderSeccion(s, "100vh", dispositivo, secciones, agente)}
        </div>
      ))}
    </div>
  );
}
