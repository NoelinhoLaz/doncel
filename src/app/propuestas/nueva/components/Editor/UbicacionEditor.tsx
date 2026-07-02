"use client";
import React, { useState } from "react";
import { X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, UbicacionMapa } from "../../types";
import MediaSelector from "./MediaSelector";
import { PlacesSearchField, PlacesSearchFieldRuta } from "./PlacesSearch";

export function UbicacionEditor({ ub, mapaUid, seccion, onUpdate }: {
  ub: UbicacionMapa;
  mapaUid: string;
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [showMediaSelector, setShowMediaSelector] = useState(false);

  const patchUb = (patch: Partial<UbicacionMapa>) => {
    const updatedMapas = (seccion.mapas ?? []).map(m => {
      if (m.uid !== mapaUid) return m;
      return { ...m, ubicaciones: (m.ubicaciones ?? []).map(u => u.uid !== ub.uid ? u : { ...u, ...patch }) };
    });
    onUpdate(seccion.uid, { mapas: updatedMapas });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingTop: "0.3rem" }}>
      <PlacesSearchField
        ubicacionUid={ub.uid}
        mapaUid={mapaUid}
        currentNombre={ub.nombre}
        seccion={seccion}
        onUpdate={onUpdate}
      />
      {ub.direccion && (
        <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{ub.direccion}</div>
      )}
      <textarea
        value={ub.descripcion ?? ""}
        onChange={e => patchUb({ descripcion: e.target.value })}
        placeholder="Descripción de la ubicación..."
        rows={2}
        className={styles.editorInput}
        style={{ width: "100%", resize: "vertical", fontSize: "0.78rem", lineHeight: 1.4, background: "#ffffff" }}
      />
      {(ub.medias ?? []).length > 0 && (
        <div className={styles.placesPhotoGrid}>
          {(ub.medias ?? []).map((media, pIdx) => (
            <div key={pIdx} className={styles.placesPhotoThumb} style={{ backgroundImage: `url(${media.url})` }}>
              <button
                className={styles.placesPhotoRemove}
                type="button"
                onClick={() => patchUb({ medias: (ub.medias ?? []).filter((_, i) => i !== pIdx) })}
              ><X size={8} /></button>
            </div>
          ))}
        </div>
      )}
      {showMediaSelector ? (
        <MediaSelector
          value={undefined}
          onChange={m => {
            if (!m) return;
            patchUb({ medias: [...(ub.medias ?? []), m] });
            setShowMediaSelector(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowMediaSelector(true)}
          style={{ alignSelf: "flex-start", background: "none", border: "1px dashed #cbd5e1", borderRadius: "0.4rem", padding: "3px 10px", fontSize: "0.72rem", color: "#94a3b8", cursor: "pointer" }}
        >
          + Añadir imagen
        </button>
      )}
    </div>
  );
}

export function UbicacionEditorRuta({ ub, rutaUid, seccion, onUpdate }: {
  ub: UbicacionMapa;
  rutaUid: string;
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [showMediaSelector, setShowMediaSelector] = useState(false);

  const patchUb = (patch: Partial<UbicacionMapa>) => {
    const updatedRutas = (seccion.rutas ?? []).map(r => {
      if (r.uid !== rutaUid) return r;
      return { ...r, ubicaciones: (r.ubicaciones ?? []).map(u => u.uid !== ub.uid ? u : { ...u, ...patch }) };
    });
    onUpdate(seccion.uid, { rutas: updatedRutas });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingTop: "0.3rem" }}>
      <PlacesSearchFieldRuta
        ubicacionUid={ub.uid}
        rutaUid={rutaUid}
        currentNombre={ub.nombre}
        seccion={seccion}
        onUpdate={onUpdate}
      />
      {ub.direccion && (
        <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{ub.direccion}</div>
      )}
      <textarea
        value={ub.descripcion ?? ""}
        onChange={e => patchUb({ descripcion: e.target.value })}
        placeholder="Descripción del destino..."
        rows={2}
        className={styles.editorInput}
        style={{ width: "100%", resize: "vertical", fontSize: "0.78rem", lineHeight: 1.4, background: "#ffffff" }}
      />
      {(ub.medias ?? []).length > 0 && (
        <div className={styles.placesPhotoGrid}>
          {(ub.medias ?? []).map((media, pIdx) => (
            <div key={pIdx} className={styles.placesPhotoThumb} style={{ backgroundImage: `url(${media.url})` }}>
              <button
                className={styles.placesPhotoRemove}
                type="button"
                onClick={() => patchUb({ medias: (ub.medias ?? []).filter((_, i) => i !== pIdx) })}
              ><X size={8} /></button>
            </div>
          ))}
        </div>
      )}
      {showMediaSelector ? (
        <MediaSelector
          value={undefined}
          onChange={m => {
            if (!m) return;
            patchUb({ medias: [...(ub.medias ?? []), m] });
            setShowMediaSelector(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowMediaSelector(true)}
          style={{ alignSelf: "flex-start", background: "none", border: "1px dashed #cbd5e1", borderRadius: "0.4rem", padding: "3px 10px", fontSize: "0.72rem", color: "#94a3b8", cursor: "pointer" }}
        >
          + Añadir imagen
        </button>
      )}
    </div>
  );
}
