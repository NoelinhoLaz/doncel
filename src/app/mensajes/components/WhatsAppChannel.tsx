"use client";

import { type ChangeEvent, type RefObject } from "react";
import { Mail, Send, X, Loader2, Paperclip, FileText, User } from "lucide-react";
import type { Email, WhatsAppMessage } from "@/types/mensajes";
import styles from "./whatsappChannel.module.css";

interface WhatsAppChannelProps {
  activeEmail: Email | null;
  waPhone: string;
  waThread: WhatsAppMessage[];
  waError: string;
  waSending: boolean;
  waUploading: boolean;
  pendingAttachments: File[];
  whatsappInput: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  waBubbleRef: React.RefObject<HTMLDivElement | null>;
  onFileAttach: (event: ChangeEvent<HTMLInputElement>) => void;
  onSendWhatsapp: () => void;
  onRemoveAttachment: (index: number) => void;
  onWhatsappInputChange: (value: string) => void;
  onSetLightboxUrl: (url: string | null) => void;
}

export default function WhatsAppChannel({
  activeEmail,
  waPhone,
  waThread,
  waError,
  waSending,
  waUploading,
  pendingAttachments,
  whatsappInput,
  fileInputRef,
  waBubbleRef,
  onFileAttach,
  onSendWhatsapp,
  onRemoveAttachment,
  onWhatsappInputChange,
  onSetLightboxUrl,
}: WhatsAppChannelProps) {
  return (
    <>
      <div className={styles.chatHeader}>
        <div className={styles.senderDetails}>
          <div
            className={styles.senderAvatarLarge}
            style={{ backgroundColor: waPhone ? "#22c55e" : (activeEmail?.color ?? "#94a3b8") }}
          >
            {waPhone ? <User size={18} /> : (activeEmail?.avatarText ?? "")}
          </div>
          <div className={styles.senderMeta}>
            <span className={styles.senderTitle}>{waPhone ? waPhone : (activeEmail?.contactName ?? "")}</span>
            <span className={styles.senderEmail} style={{ color: waPhone ? "#22c55e" : "#94a3b8", fontWeight: waPhone ? 700 : 500 }}>
              {waPhone ? "● En línea (WhatsApp)" : (activeEmail?.contactEmail ?? "")}
            </span>
          </div>
        </div>
        <div className={styles.actionColumn}>
          <div className={styles.actionIcons}>
            <button className={styles.actionIconButton} title="Archivar chat">
              <Mail size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.chatBubbleArea} ref={waBubbleRef}>
        <div className={styles.chatDaySeparator}>
          {waPhone ? waPhone : "Sin conversación seleccionada"}
        </div>

        {waThread.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem", fontSize: "0.85rem" }}>
            {waPhone ? "No hay mensajes con este número." : "Introduce un número para empezar."}
          </div>
        ) : (
          waThread.map((msg) => {
            const isAgent = msg.senderRole === "agent";
            const time = msg.time;
            return (
              <div key={msg.id} className={styles.chatBubbleWrapper}>
                <div className={isAgent ? styles.bubbleOutgoing : styles.bubbleIncoming}>
                  {msg.media && msg.media.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: msg.body ? "0.4rem" : 0 }}>
                      {msg.media.map((m: any) => {
                        if (typeof m === "string") return null;
                        const isImage = m.contentType?.startsWith("image/");
                        return isImage ? (
                          <img
                            key={m.sid || Math.random()}
                            src={`/api/whatsapp/media/${msg.twilioSid || msg.id}/${m.sid}`}
                            alt=""
                            onClick={() => onSetLightboxUrl(`/api/whatsapp/media/${msg.twilioSid || msg.id}/${m.sid}`)}
                            style={{
                              maxWidth: "200px",
                              maxHeight: "200px",
                              borderRadius: "0.5rem",
                              display: "block",
                              cursor: "pointer",
                            }}
                            loading="lazy"
                          />
                        ) : (
                          <a
                            key={m.sid || Math.random()}
                            href={`/api/whatsapp/media/${msg.twilioSid || msg.id}/${m.sid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              padding: "0.35rem 0.75rem",
                              backgroundColor: isAgent ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                              borderRadius: "0.5rem",
                              fontSize: "0.78rem",
                              fontWeight: "600",
                              color: isAgent ? "#fff" : "#334155",
                              textDecoration: "none",
                            }}
                          >
                            <FileText size={14} /> {m.contentType?.split("/").pop()?.toUpperCase() || "FILE"}
                          </a>
                        );
                      })}
                    </div>
                  )}
                  {msg.body}
                  <div className={`${styles.bubbleMeta} ${isAgent ? styles.outgoingMeta : styles.incomingMeta}`}>
                    <span>{time}</span>
                    {isAgent && <span className={styles.statusTicks}>✓✓</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.composerCard} style={{ borderTop: "1px solid #e2e8f0", padding: "1rem 1.75rem" }}>
        {waError && (
          <div style={{ color: "#dc2626", fontSize: "0.78rem", marginBottom: "0.5rem" }}>{waError}</div>
        )}
        {pendingAttachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem" }}>
            {pendingAttachments.map((att, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  padding: "0.2rem 0.6rem",
                  backgroundColor: "#e2e8f0",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                }}
              >
                <FileText size={12} />
                {att.name}
                <X
                  size={12}
                  style={{ cursor: "pointer", color: "#64748b" }}
                  onClick={() => onRemoveAttachment(i)}
                />
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={onFileAttach}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={waSending || waUploading}
            className={styles.btnSend}
            style={{
              width: "45px",
              height: "45px",
              borderRadius: "50%",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: waSending || waUploading ? 0.6 : 1,
              cursor: waSending || waUploading ? "not-allowed" : "pointer",
            }}
            title="Adjuntar archivo"
          >
            {waUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          </button>
          <input
            type="text"
            className={styles.textareaComposer}
            style={{ height: "45px", borderRadius: "24px", padding: "0 1.25rem", margin: 0 }}
            placeholder="Escribe un mensaje de WhatsApp..."
            value={whatsappInput}
            onChange={(e) => onWhatsappInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !waSending) {
                onSendWhatsapp();
              }
            }}
            disabled={waSending}
          />
          <button
            onClick={onSendWhatsapp}
            disabled={waSending}
            className={styles.btnSend}
            style={{
              width: "45px",
              height: "45px",
              borderRadius: "50%",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: waSending ? 0.6 : 1,
              cursor: waSending ? "not-allowed" : "pointer",
            }}
            title="Enviar WhatsApp"
          >
            {waSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}
