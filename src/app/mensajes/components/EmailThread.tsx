"use client";

import React from "react";
import DOMPurify from "dompurify";
import styles from "./emailThread.module.css";
import { Paperclip, FileText, Star, Mail, CornerUpLeft, CornerUpRight } from "lucide-react";
import type { Email } from "@/types/mensajes";

interface EmailThreadProps {
  email: Email | null;
  onReply: () => void;
  onToggleStar: (id: string) => void;
  onAction?: (type: string, id: string) => void;
  onSetLightboxUrl?: (url: string | null) => void;
}

export default function EmailThread({ email, onReply, onToggleStar, onAction, onSetLightboxUrl }: EmailThreadProps) {
  if (!email) return null;

  return (
    <div className={styles.threadContent}>
      <div className={styles.threadHeader}>
        <div className={styles.senderDetails}>
          <div className={styles.senderAvatarLarge} style={{ backgroundColor: email.color }}>{email.avatarText}</div>
          <div className={styles.senderMeta}>
            <span className={styles.senderTitle}>{email.contactName}</span>
            <span className={styles.senderEmail}>{email.contactEmail}</span>
          </div>
        </div>
        <div className={styles.actionColumn}>
          <div className={styles.actionIcons}>
            <button onClick={() => onToggleStar(email.id)} className={`${styles.actionIconButton} ${email.starred ? styles.actionIconActive : ""}`} title="Marcar contacto">
              <Star size={18} />
            </button>
            <button className={styles.actionIconButton} title="Archivar chat"><Mail size={18} /></button>
          </div>
          <span className={styles.messageDate}>{email.thread[0]?.date || email.time}</span>
        </div>
      </div>

      <div className={styles.emailBodyContainer}>
        <h1 className={styles.emailSubject}>{email.subject}</h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
          {email.thread.map((msg) => {
            const isOut = msg.direction === "outbound";
            const initials = msg.senderName.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase();
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", justifyContent: isOut ? "flex-end" : "flex-start" }}>
                  {!isOut && (
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", backgroundColor: msg.avatarColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                  )}
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>{isOut ? "Tú" : msg.senderName}</span>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{msg.date}</span>
                  {isOut && (
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", backgroundColor: "var(--primary-color, #475569)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0 }}>TÚ</div>
                  )}
                </div>
                <div style={{ alignSelf: isOut ? "flex-end" : "flex-start", maxWidth: "80%", backgroundColor: isOut ? "var(--primary-color, #475569)" : "#f1f5f9", color: isOut ? "#fff" : "#1e293b", borderRadius: isOut ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem", padding: "0.75rem 1rem", fontSize: "0.85rem", lineHeight: 1.6 }}>
                  {msg.bodyHtml ? <div style={{ all: "revert", fontSize: "0.85rem", lineHeight: 1.6, color: isOut ? "#fff" : "#1e293b" }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.bodyHtml) }} /> : <span style={{ whiteSpace: "pre-wrap" }}>{msg.body}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {email.attachments && email.attachments.length > 0 && (
          <div className={styles.attachmentsSection} style={{ marginTop: "1.25rem" }}>
            <div style={{ width: "100%", fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Paperclip size={13} />
              <span>Adjuntos ({email.attachments.length})</span>
            </div>
            {email.attachments.map((file: any, idx: number) => {
              const label = typeof file === "string" && file.trim() ? file.trim() : `Archivo adjunto ${idx + 1}`;
              return (
                <div key={idx} className={styles.attachmentCard}>
                  <FileText size={16} className={styles.attachmentIcon} />
                  <span className={styles.attachmentName}>{label}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.bottomActions}>
          <button className={styles.btnReply} onClick={onReply}><CornerUpLeft size={16} /><span>Responder</span></button>
          <button className={styles.btnForward}><CornerUpRight size={16} /><span>Reenviar</span></button>
        </div>
      </div>

    </div>
  );
}
