"use client";
import React, { useRef } from "react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import { resolverItemsMenu } from "../../utils/menu-utils";
import { Bar } from "./PHPlaceholders";

export default function PHMenu({ mobile, seccion, secciones }: { mobile?: boolean; seccion?: Seccion; secciones?: Seccion[] }) {
  const bg = seccion?.menuColorFondo ?? "rgba(255,255,255,0.95)";
  const colorTexto = seccion?.menuColorTexto ?? "#1e293b";
  const colorBoton = seccion?.menuColorBoton ?? "var(--primary-color, #475569)";
  const fijo = seccion?.menuFijo ?? false;
  const logo = seccion?.menuLogo;

  const items = resolverItemsMenu(seccion, secciones);

  const boton = seccion?.menuBoton;

  const menuRef = useRef<HTMLDivElement>(null);

  const irASeccion = (uid: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(uid);
    if (!el) return;
    const offset = fijo ? (menuRef.current?.offsetHeight ?? 0) : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const onClickBoton = () => {
    if (!boton) return;
    if (boton.tipo === "seccion" && boton.seccionUid) {
      irASeccion(boton.seccionUid);
    } else if (boton.tipo === "externo" && boton.href) {
      if (typeof window !== "undefined") window.open(boton.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div ref={menuRef} className={styles.phMenu} style={{ background: bg, ...(fijo ? { position: "sticky", top: 0, zIndex: 100 } : {}) }}>
      <div className={styles.phMenuRow}>
        {logo
          ? <img src={logo} alt="Logo" style={{ height: 32, maxWidth: 120, objectFit: "contain" }} />
          : <div className={styles.phLogo} />
        }
        {!mobile && (
          <div className={styles.phNavLinks}>
            {items.length > 0
              ? items.map(item => (
                  <span
                    key={item.uid}
                    onClick={() => irASeccion(item.uid)}
                    style={{ fontSize: "0.78rem", fontWeight: 600, color: colorTexto, padding: "0 8px", cursor: "pointer" }}
                  >
                    {item.etiqueta}
                  </span>
                ))
              : <><Bar w="40px" /><Bar w="40px" /><Bar w="40px" /><Bar w="40px" /></>
            }
          </div>
        )}
        {boton?.etiqueta
          ? <div onClick={onClickBoton} style={{ padding: "0.3rem 0.85rem", borderRadius: "0.4rem", background: colorBoton, color: "#fff", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
              {boton.etiqueta}
            </div>
          : <div className={styles.phNavBtn} style={{ background: colorBoton }} />
        }
      </div>
    </div>
  );
}
