"use client";

import React, { useMemo, useState } from "react";
import styles from "./mensajes.module.css";
import EmailList from "./components/EmailList";
import EmailThread from "./components/EmailThread";
import EmailComposer from "./components/EmailComposer";
import WhatsAppChannel from "./components/WhatsAppChannel";
import initialEmails from "./mocks/initialEmails";
import { Mail } from "lucide-react";

export default function MessagesPage() {
  const [emails, setEmails] = useState(initialEmails);
  const [activeId, setActiveId] = useState<string>(emails[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const waBubbleRef = React.useRef<HTMLDivElement | null>(null);

  const activeEmail = useMemo(() => emails.find((e) => e.id === activeId) ?? null, [emails, activeId]);

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setActiveTab("email");
  };

  const handleToggleStar = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, starred: !e.starred } : e)));
  };

  const handleSendReply = async (data: { body: string }) => {
    if (!data?.body?.trim() || !activeEmail) return;
    const newReply = {
      id: `reply-${Date.now()}`,
      senderName: "Tú",
      senderEmail: "you@example.com",
      avatarColor: "#475569",
      date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      body: data.body,
      direction: "outbound",
    } as any;
    setEmails((prev) => prev.map((e) => (e.id === activeEmail.id ? { ...e, thread: [...e.thread, newReply] } : e)));
    setIsReplyOpen(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftColumn}>
        <div className={styles.headerRow}>
          <h3>Mensajes</h3>
        </div>
        <EmailList filteredEmails={emails} activeTab={activeTab} selectedId={activeId} waPhone={""} handleSelectConversation={handleSelectConversation} />
      </div>

      <section className={styles.threadColumn}>
        {activeTab === "whatsapp" ? (
          <WhatsAppChannel
            activeEmail={activeEmail}
            waPhone={""}
            waThread={[]}
            waError={""}
            waSending={false}
            waUploading={false}
            pendingAttachments={[]}
            whatsappInput={""}
            fileInputRef={fileInputRef}
            waBubbleRef={waBubbleRef}
            onFileAttach={() => {}}
            onSendWhatsapp={() => {}}
            onRemoveAttachment={() => {}}
            onWhatsappInputChange={() => {}}
            onSetLightboxUrl={setLightboxUrl}
          />
        ) : activeEmail ? (
          <>
            <EmailThread email={activeEmail} onReply={() => setIsReplyOpen(true)} onToggleStar={(id: string) => handleToggleStar(id)} onSetLightboxUrl={setLightboxUrl} />
            {isReplyOpen && <EmailComposer initialData={activeEmail} onCancel={() => setIsReplyOpen(false)} onSend={handleSendReply} />}
          </>
        ) : (
          <div className={styles.emptyState}>
            <Mail size={48} />
            <h2 className={styles.emptyStateTitle}>Sin conversación seleccionada</h2>
            <p className={styles.emptyStateDesc}>Selecciona un contacto de la lista para empezar.</p>
          </div>
        )}
      </section>

      <aside className={styles.profileColumn}>
        {activeEmail ? (
          <div style={{ padding: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 26, background: activeEmail.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{activeEmail.avatarText}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{activeEmail.contactName}</div>
                <div style={{ color: "#64748b" }}>{activeEmail.contactEmail}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "1.5rem" }} />
        )}
      </aside>

      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <img src={lightboxUrl} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "0.5rem" }} />
        </div>
      )}
    </div>
  );
}
