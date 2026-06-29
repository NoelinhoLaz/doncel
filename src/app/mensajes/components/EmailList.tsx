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
                <span className={styles.senderName}>{email.senderName}</span>
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
