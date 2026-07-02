"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight, X, Menu } from "lucide-react";
import styles from "../../page.module.css";
import type { MapaItem } from "../../types";
import { Ph } from "./PHPlaceholders";

const MapaLeaflet = dynamic(() => import("../../MapaLeaflet"), { ssr: false, loading: () => <div style={{ width: "100%", height: "100%", background: "#f0f4ff", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Cargando mapa…</div> });

export default function PHMapa({ titulo, mapas, layout, anchoMax, colorFondo }: {
  titulo?: string;
  mapas?: MapaItem[];
  layout?: string;
  anchoMax?: string;
  colorFondo?: string;
}) {
  const customMaxWidth = anchoMax === "900px" ? "min(900px, 46.875cqw)" : anchoMax === "1200px" ? "min(1200px, 62.5cqw)" : "min(1920px, 100cqw)";
  const mapasList = mapas ?? [];
  const allUbicaciones = mapasList.flatMap(m => m.ubicaciones ?? []);
  // -1 = tab "Todos"
  const [activeMapaIdx, setActiveMapaIdx] = useState<number>(-1);
  const [showList, setShowList] = useState(false);
  const isAll = activeMapaIdx === -1;
  const activeMapa = isAll ? null : mapasList[Math.min(activeMapaIdx, mapasList.length - 1)];
  const ubicaciones = isAll ? allUbicaciones : (activeMapa?.ubicaciones ?? []);
  const tabKey = isAll ? "todos" : (activeMapa?.uid ?? "none");
  const showTabs = mapasList.length > 0;
  const [openUbUid, setOpenUbUid] = useState<string | null>(null);
  const [modalImg, setModalImg] = useState<string | null>(null);

  const tabBar = (mb: string) => showTabs ? (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", marginBottom: mb, flexWrap: "wrap" }}>
      {/* Tab "Todos" — solo si hay más de un mapa */}
      {mapasList.length > 1 && (
        <button
          onClick={() => setActiveMapaIdx(-1)}
          style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem", fontWeight: isAll ? 700 : 500, color: isAll ? "#6366f1" : "#64748b", background: "none", border: "none", borderBottom: `2px solid ${isAll ? "#6366f1" : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}
        >
          Todos
        </button>
      )}
      {mapasList.map((m, i) => {
        const active = !isAll && activeMapaIdx === i;
        return (
          <button key={m.uid} onClick={() => setActiveMapaIdx(i)}
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem", fontWeight: active ? 700 : 500, color: active ? "#6366f1" : "#64748b", background: "none", border: "none", borderBottom: `2px solid ${active ? "#6366f1" : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}
          >
            {m.titulo || `Mapa ${i + 1}`}
          </button>
        );
      })}
    </div>
  ) : null;

  const locationList = (
    <div className={styles.phMapaLocationList}>
      {modalImg && (
        <div
          onClick={() => setModalImg(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <img
            src={modalImg}
            alt=""
            style={{ width: 600, maxWidth: "90vw", height: "auto", borderRadius: "0.6rem", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
      {ubicaciones.length > 0 ? ubicaciones.map((u, i) => {
        const isOpen = openUbUid === u.uid;
        const hasThumbs = (u.medias ?? []).length > 0;
        const hasContent = u.descripcion || hasThumbs;
        return (
          <div key={u.uid} style={{ borderRadius: "0.4rem", background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem", cursor: hasContent ? "pointer" : "default" }}
              onClick={() => hasContent && setOpenUbUid(isOpen ? null : u.uid)}
            >
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(71,85,105,0.9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.65rem", fontWeight: 800, color: "#fff" }}>{i + 1}</div>
              <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 700, color: "#1e293b" }}>{u.nombre ?? `Ubicación ${i + 1}`}</span>
              {hasContent && (
                <ChevronRight size={13} style={{ color: "#94a3b8", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
              )}
            </div>
            {isOpen && hasContent && (
              <div style={{ padding: "0 0.5rem 0.5rem 2.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {u.descripcion && (
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#475569", lineHeight: 1.5 }}>{u.descripcion}</p>
                )}
                {hasThumbs && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {(u.medias ?? []).map((m, mi) => (
                      <div
                        key={mi}
                        onClick={() => setModalImg(m.url)}
                        style={{ width: 52, height: 40, borderRadius: "0.3rem", backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer", border: "1px solid #e2e8f0" }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }) : (
        [1,2,3].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#e2e8f0", flexShrink: 0 }} />
            <div style={{ width: `${50 + i * 20}px`, height: "8px", borderRadius: "4px", background: "#e2e8f0" }} />
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={{ background: colorFondo ?? "#ffffff" }}>
      <Ph>
        <div style={{ maxWidth: customMaxWidth, margin: "0 auto", padding: "1.5rem" }}>
          {titulo ? (
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", margin: "0 0 12px 0" }}>{titulo}</h3>
          ) : (
            <div style={{ width: "30%", height: "18px", borderRadius: "9px", background: "#cbd5e1", margin: "0 0 12px 0" }} />
          )}
          {layout === "mapa-listado" ? (
            <div className={styles.phMapaListado}>
              <div className={styles.phMapaContainer}>
                <MapaLeaflet ubicaciones={ubicaciones} key={tabKey} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {tabBar("0.75rem")}
                {locationList}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {tabBar("0.5rem")}
              <div className={styles.phMapaContainer} style={{ position: "relative" }}>
                <MapaLeaflet ubicaciones={ubicaciones} key={tabKey} />
                <button
                  onClick={() => setShowList(v => !v)}
                  style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, width: 34, height: 34, borderRadius: "0.4rem", background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  {showList ? <X size={16} color="#475569" /> : <Menu size={16} color="#475569" />}
                </button>
                {showList && (
                  <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(280px, 70%)", zIndex: 999, background: "rgba(255,255,255,0.97)", borderLeft: "1px solid #e2e8f0", boxShadow: "-4px 0 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <div style={{ padding: "0.5rem 0.75rem 0" }}>
                      {tabBar("0.5rem")}
                    </div>
                    <div style={{ padding: "0 0.5rem 0.5rem", flex: 1, overflowY: "auto" }}>
                      {locationList}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Ph>
    </div>
  );
}
