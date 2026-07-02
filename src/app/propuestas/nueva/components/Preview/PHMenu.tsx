"use client";
import React from "react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import { Bar } from "./PHPlaceholders";

export default function PHMenu({ mobile, seccion, secciones }: { mobile?: boolean; seccion?: Seccion; secciones?: Seccion[] }) {
  const bg = seccion?.menuColorFondo ?? "rgba(255,255,255,0.95)";
  const colorTexto = seccion?.menuColorTexto ?? "#1e293b";
  const colorBoton = seccion?.menuColorBoton ?? "var(--primary-color, #475569)";
  const fijo = seccion?.menuFijo ?? false;
  const logo = seccion?.menuLogo;

  // Items visibles en el menú
  const items: { etiqueta: string; uid: string }[] = seccion?.menuItems
    ? seccion.menuItems.filter(i => !i.ocultaEnMenu)
    : (secciones ?? []).filter(s => s.tipo !== "menu" && !s.oculta).slice(0, 4).map(s => ({ etiqueta: s.label, uid: s.uid }));

  const boton = seccion?.menuBoton;

  return (
    <div className={styles.phMenu} style={{ background: bg, ...(fijo ? { position: "sticky", top: 0, zIndex: 100 } : {}) }}>
      <div className={styles.phMenuRow}>
        {logo
          ? <img src={logo} alt="Logo" style={{ height: 32, maxWidth: 120, objectFit: "contain" }} />
          : <div className={styles.phLogo} />
        }
        {!mobile && (
          <div className={styles.phNavLinks}>
            {items.length > 0
              ? items.map(item => (
                  <span key={item.uid} style={{ fontSize: "0.78rem", fontWeight: 600, color: colorTexto, padding: "0 8px", cursor: "pointer" }}>
                    {item.etiqueta}
                  </span>
                ))
              : <><Bar w="40px" /><Bar w="40px" /><Bar w="40px" /><Bar w="40px" /></>
            }
          </div>
        )}
        {boton?.etiqueta
          ? <div style={{ padding: "0.3rem 0.85rem", borderRadius: "0.4rem", background: colorBoton, color: "#fff", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
              {boton.etiqueta}
            </div>
          : <div className={styles.phNavBtn} style={{ background: colorBoton }} />
        }
      </div>
    </div>
  );
}
