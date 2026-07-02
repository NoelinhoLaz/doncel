"use client";
import React from "react";
import styles from "../../page.module.css";

export function Ph({ children }: { children: React.ReactNode }) {
  return <div className={styles.ph}>{children}</div>;
}
export function Bar({ w }: { w: string }) {
  return <div className={styles.phBar} style={{ width: w }} />;
}
export function Title({ w }: { w: string }) {
  return <div className={styles.phTitle} style={{ width: w }} />;
}
export function Bloque({ h, dashed }: { h?: string; dashed?: boolean }) {
  return <div className={styles.phBloque} style={{ height: h ?? "60px", borderStyle: dashed ? "dashed" : "solid" }} />;
}

export function PHPrecio({ mobile, tablet }: { mobile?: boolean; tablet?: boolean }) {
  const cols = mobile ? 1 : tablet ? 2 : 3;
  return (
    <Ph>
      <div className={styles.phPrecioRow} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, n) => (
          <div key={n} className={styles.phPrecioCard}>
            <Bar w="60%" /><Bar w="40%" /><Bar w="80%" /><Bar w="80%" /><Bar w="80%" />
            <div className={styles.phPrecioBtn} />
          </div>
        ))}
      </div>
    </Ph>
  );
}

export function PHFormulario({ mobile }: { mobile?: boolean }) {
  return (
    <Ph>
      <div className={styles.phFormulario}>
        {mobile
          ? <><Bloque h="28px" /><Bloque h="28px" /></>
          : <div className={styles.phFormRow}><Bloque h="28px" /><Bloque h="28px" /></div>
        }
        <Bloque h="28px" />
        <Bloque h="52px" />
        <div className={styles.phFormBtn} />
      </div>
    </Ph>
  );
}

export function PHFooter({ mobile }: { mobile?: boolean }) {
  return (
    <Ph>
      <div className={`${styles.phFooter} ${mobile ? styles.phCol1 : ""}`}>
        <div className={styles.phFooterCol}><Bar w="50%" /><Bar w="80%" /><Bar w="70%" /></div>
        {!mobile && <div className={styles.phFooterCol}><Bar w="50%" /><Bar w="60%" /><Bar w="60%" /></div>}
        {!mobile && <div className={styles.phFooterCol}><Bar w="50%" /><Bar w="70%" /><Bar w="40%" /></div>}
      </div>
    </Ph>
  );
}
