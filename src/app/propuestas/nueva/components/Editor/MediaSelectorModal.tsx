"use client";
import React from "react";
import { X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion } from "../../types";
import MediaSelector from "./MediaSelector";

export default function MediaSelectorModal({
  value,
  onChange,
  onClose,
}: {
  value?: Seccion["media"];
  onChange: (m: Seccion["media"]) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.mediaModalBox} onClick={e => e.stopPropagation()}>
        <div className={styles.mediaModalHeader}>
          <span className={styles.mediaModalTitle}>Añadir imagen</span>
          <button type="button" className={styles.guiaClose} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <MediaSelector value={value} onChange={onChange} />
      </div>
    </div>
  );
}
