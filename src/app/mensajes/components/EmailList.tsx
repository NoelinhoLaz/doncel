"use client";

import React from "react";
import styles from "./emailList.module.css";
import type { Email } from "@/types/mensajes";

interface EmailListProps {
  filteredEmails: Email[];
  activeTab: "email" | "whatsapp";
  selectedId: string;
  waPhone: string;
  handleSelectConversation: (id: string) => void;
}

export default function EmailList({ filteredEmails, activeTab, selectedId, waPhone, handleSelectConversation }: EmailListProps) {
  return (
    <div className={styles.emailList}>
      {filteredEmails.map((email) => {
        const isActive = activeTab === "email" ? selectedId === email.id : waPhone === email.contactPhone;

        const previewText = activeTab === "whatsapp"
          ? email.whatsappThread[email.whatsappThread.length - 1]?.body || email.body
          : email.body;

        // Group senders and count messages like Gmail
        const threadMsgs = email.thread || [];
        const threadCount = threadMsgs.length;
        const uniqueSenders = Array.from(new Set(threadMsgs.map((m) => m.senderName || "Tú")));
        const sendersDisplay = uniqueSenders.length > 0 ? uniqueSenders.join(", ") : email.senderName;

        return (
          <div
            key={email.id}
            className={isActive ? styles.emailCardActive : styles.emailCard}
            onClick={() => handleSelectConversation(email.id)}
          >
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar} style={{ backgroundColor: email.color }}>
                {email.avatarText}
              </div>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardHeader}>
                <span className={styles.senderName} style={{ display: "inline-flex", alignItems: "center", gap: "4px", width: "100%", overflow: "hidden" }}>
                  <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1 }}>{sendersDisplay}</span>
                  {threadCount > 1 && (
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px", fontWeight: 700, flexShrink: 0 }}>
                      {threadCount}
                    </span>
                  )}
                </span>
                <span className={styles.cardTime}>{email.time}</span>
              </div>
              <div className={styles.subjectText}>
                {activeTab === "whatsapp" ? email.contactPhone : email.subject}
              </div>
              <div className={styles.bodyPreview}>{previewText}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
