"use client";

import React, { useState } from "react";
import styles from "./emailComposer.module.css";
import { X } from "lucide-react";
import type { Email, SendEmailPayload } from "@/types/mensajes";

interface EmailComposerProps {
  onCancel: () => void;
  onSend: (data: SendEmailPayload) => Promise<any> | any;
  initialData?: Email | null;
}

export default function EmailComposer({ onCancel, onSend, initialData }: EmailComposerProps) {
  const [body, setBody] = useState(initialData?.thread?.slice(-1)[0]?.body || "");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const payload: SendEmailPayload = {
        to: [initialData?.contactEmail || ""],
        subject: initialData?.subject || "",
        body,
        attachments: [],
      };
      await onSend(payload);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.composerCard}>
      <div className={styles.composerHeader}>
        <span className={styles.composerTitle}>Reply to {initialData?.contactName || "contact"}</span>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
          <X size={16} />
        </button>
      </div>

      <textarea className={styles.textareaComposer} placeholder="Escribe tu mensaje aquí..." value={body} onChange={(e) => setBody(e.target.value)} />

      <div className={styles.composerActions}>
        <button className={styles.btnDiscard} onClick={onCancel}>Cancelar</button>
        <button className={styles.btnSend} onClick={handleSend} disabled={sending}>{sending ? "Enviando..." : "Enviar"}</button>
      </div>
    </div>
  );
}
