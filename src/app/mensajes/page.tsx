"use client";

import React, { useMemo, useState, useEffect } from "react";
import styles from "./mensajes.module.css";
import EmailThread from "./components/EmailThread";
import EmailComposer from "./components/EmailComposer";
import WhatsAppChannel from "./components/WhatsAppChannel";
import initialEmails from "./mocks/initialEmails";
import { Mail, Folder, Inbox, Send, Trash2, FileText, AlertCircle, Loader2, Paperclip, Briefcase } from "lucide-react";
import { getImapMailboxes, downloadRealInboxEmails } from "@/actions/email";
import { getExpedientes } from "@/actions/expedientes";
import { assignEmailToExpediente, getAllSavedCommunications } from "@/actions/comunicaciones";

function renderFolderIcon(folder: any) {
  const use = String(folder.specialUse || folder.name || "").toLowerCase();
  if (use.includes("inbox")) return <Inbox size={16} />;
  if (use.includes("sent") || use.includes("enviado")) return <Send size={16} />;
  if (use.includes("draft") || use.includes("borrador")) return <FileText size={16} />;
  if (use.includes("trash") || use.includes("papelera") || use.includes("elim")) return <Trash2 size={16} />;
  if (use.includes("junk") || use.includes("spam")) return <AlertCircle size={16} />;
  return <Folder size={16} />;
}

const cleanSubjectForMatch = (sub: string) => {
  if (!sub) return "";
  return sub
    .replace(/^\[Recibido\]\s*/i, "")
    .replace(/^\[Enviado\]\s*/i, "")
    .replace(/^re:\s*/i, "")
    .replace(/^fwd:\s*/i, "")
    .replace(/^\*\*\*spam\*\*\*\s*/i, "")
    .trim()
    .toLowerCase();
};

export default function MessagesPage() {
  const [emails, setEmails] = useState(initialEmails);
  const [activeId, setActiveId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const waBubbleRef = React.useRef<HTMLDivElement | null>(null);

  // Real IMAP State
  const [folders, setFolders] = useState<any[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("INBOX");
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selection & Actions State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [showExpedienteModal, setShowExpedienteModal] = useState(false);
  const [searchExpedienteQuery, setSearchExpedienteQuery] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [savedCommunications, setSavedCommunications] = useState<any[]>([]);

  // Frontend Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const emailsPerPage = 25;

  const activeEmail = useMemo(() => emails.find((e) => e.id === activeId) ?? null, [emails, activeId]);

  const loadSavedComms = async () => {
    try {
      const data = await getAllSavedCommunications();
      setSavedCommunications(data || []);
    } catch (err) {
      console.error("Error loading saved communications:", err);
    }
  };

  const fetchEmails = async (folder: string) => {
    setLoading(true);
    setErrorMessage(null);
    setCurrentPage(1);
    setSelectedIds([]);
    try {
      const res = await downloadRealInboxEmails(1, folder);
      if (res.success && res.emails) {
        setEmails(res.emails);
        setActiveId("");
      } else {
        // Fallback to mock data with a warning
        setEmails(initialEmails);
        setActiveId("");
        setErrorMessage(res.error || "No se pudieron descargar correos reales.");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Error al descargar los emails.");
      setEmails(initialEmails);
      setActiveId("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadFolders() {
      setLoadingFolders(true);
      const res = await getImapMailboxes();
      if (res.success && res.folders) {
        setFolders(res.folders);
      }
      setLoadingFolders(false);
    }
    async function loadExpedientes() {
      try {
        const data = await getExpedientes();
        setExpedientes(data || []);
      } catch (err) {
        console.error("Error loading expedientes:", err);
      }
    }
    loadFolders();
    loadExpedientes();
    loadSavedComms();
    fetchEmails("INBOX");
  }, []);

  const handleFolderSelect = (folderPath: string) => {
    setActiveFolder(folderPath);
    fetchEmails(folderPath);
  };

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

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const currentPageIds = paginatedEmails.map((e) => e.id);
    const allSelected = currentPageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`¿Estás seguro de que deseas borrar los ${selectedIds.length} correos seleccionados?`)) {
      setEmails((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
      setSelectedIds([]);
    }
  };

  const handleAssignToSelectedExpediente = async (expedienteId: string) => {
    setAssigning(true);
    let successCount = 0;
    try {
      for (const id of selectedIds) {
        const email = emails.find((e) => e.id === id);
        if (!email) continue;

        const attachmentsPayload = email.attachments?.map((a: any) => ({
          nombre: typeof a === "string" ? a : a.nombre || "Adjunto",
          tamanio: typeof a === "string" ? 1024 : a.tamanio || 1024,
        })) || [];

        const isSentFolder = activeFolder.toLowerCase().includes("sent") || activeFolder.toLowerCase().includes("enviad");
        const computedDirection = isSentFolder ? "outbound" : "inbound";
        const computedSubject = isSentFolder ? email.subject : (email.subject.startsWith("[Recibido]") ? email.subject : `[Recibido] ${email.subject}`);

        const res = await assignEmailToExpediente(expedienteId, {
          subject: computedSubject,
          body: email.body,
          senderName: email.senderName,
          senderEmail: email.contactEmail || "unknown@example.com",
          attachments: attachmentsPayload,
        });

        if (res.success) {
          successCount++;
        }
      }
      alert(`Se han guardado y asignado ${successCount} mensaje(s) al expediente correctamente.`);
      await loadSavedComms();
      setSelectedIds([]);
      setShowExpedienteModal(false);
    } catch (err) {
      console.error(err);
      alert("Error al asignar mensajes.");
    } finally {
      setAssigning(false);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(emails.length / emailsPerPage);
  const paginatedEmails = useMemo(() => {
    const start = (currentPage - 1) * emailsPerPage;
    return emails.slice(start, start + emailsPerPage);
  }, [emails, currentPage]);

  const isAllCurrentSelected = paginatedEmails.length > 0 && paginatedEmails.every((e) => selectedIds.includes(e.id));

  // Filtered expedientes list
  const filteredExpedientes = useMemo(() => {
    const q = searchExpedienteQuery.toLowerCase().trim();
    if (!q) return expedientes;
    return expedientes.filter((e) => {
      const idStr = String(e.id || "").toLowerCase();
      const entityName = String(e.contabilidad_entidades?.nombre || "").toLowerCase();
      const destName = String(e.maestro_destinos?.nombre || "").toLowerCase();
      return idStr.includes(q) || entityName.includes(q) || destName.includes(q);
    });
  }, [expedientes, searchExpedienteQuery]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Mensajes</h1>
          {errorMessage && (
            <span style={{ fontSize: "0.72rem", color: "#e11d48", fontWeight: 600, display: "block", marginTop: "2px" }}>
              ⚠️ Modo demo local: {errorMessage}
            </span>
          )}
        </div>
      </header>
      
      <div className={styles.dashboardContainer} style={{ background: "#ffffff" }}>
        {/* Column 1: Server Folders Sidebar */}
        <aside className={styles.profileColumn} style={{ display: "flex", flexDirection: "column", gap: "1rem", borderRight: "1px solid #f1f5f9" }}>
          <h4 style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", margin: 0 }}>
            Carpetas del Servidor
          </h4>
          
          {loadingFolders ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite", color: "var(--primary-color, #4a88b5)" }} />
            </div>
          ) : folders.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", flex: 1 }}>
              {folders.map((f) => {
                const isActive = activeFolder === f.path;
                return (
                  <button
                    key={f.path}
                    onClick={() => handleFolderSelect(f.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: isActive ? "color-mix(in srgb, var(--primary-color, #4a88b5) 10%, white)" : "transparent",
                      color: isActive ? "var(--primary-color, #4a88b5)" : "#475569",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      width: "100%"
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", color: isActive ? "var(--primary-color, #4a88b5)" : "#94a3b8" }}>
                      {renderFolderIcon(f)}
                    </span>
                    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {f.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "1.25rem", borderRadius: "8px", border: "1.5px dashed #e2e8f0", textAlign: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block" }}>
                Sin conexión activa.
              </span>
              <span style={{ fontSize: "0.7rem", color: "#cbd5e1", marginTop: "4px", display: "block" }}>
                Usa el botón de configuración de correo en la cabecera.
              </span>
            </div>
          )}
        </aside>

        {/* Unified Main Area: Swaps between List and Thread Detail (Gmail Style) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          {activeEmail ? (
            /* Thread View */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: "1.25rem" }}>
              {/* Back Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", marginBottom: "10px", flexShrink: 0 }}>
                <button
                  onClick={() => setActiveId("")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--primary-color, #4a88b5)",
                    background: "color-mix(in srgb, var(--primary-color, #4a88b5) 10%, white)",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  ← Volver a Recibidos
                </button>
                <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>
                  Conversación con {activeEmail.contactName}
                </span>
              </div>
              
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <EmailThread email={activeEmail} onReply={() => setIsReplyOpen(true)} onToggleStar={(id: string) => handleToggleStar(id)} onSetLightboxUrl={setLightboxUrl} />
                {isReplyOpen && <EmailComposer initialData={activeEmail} onCancel={() => setIsReplyOpen(false)} onSend={handleSendReply} />}
              </div>
            </div>
          ) : (
            /* Gmail List View */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              {/* List Header / Actions Bar */}
              <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "1.5rem", flexShrink: 0, minHeight: "53px" }}>
                <input
                  type="checkbox"
                  checked={isAllCurrentSelected}
                  onChange={handleToggleSelectAll}
                  style={{
                    width: "13px",
                    height: "13px",
                    cursor: "pointer",
                    accentColor: "var(--primary-color, #4a88b5)",
                    flexShrink: 0
                  }}
                />

                {selectedIds.length > 0 ? (
                  /* Action Buttons when items checked */
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-color, #4a88b5)" }}>
                      {selectedIds.length} seleccionados
                    </span>
                    <button
                      onClick={handleBulkDelete}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "5px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: "#fff1f2",
                        color: "#e11d48",
                        border: "1px solid #ffe4e6",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                      Borrar
                    </button>
                    <button
                      onClick={() => setShowExpedienteModal(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "5px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: "color-mix(in srgb, var(--primary-color, #4a88b5) 10%, white)",
                        color: "var(--primary-color, #4a88b5)",
                        border: "1px solid color-mix(in srgb, var(--primary-color, #4a88b5) 20%, white)",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <Briefcase size={13} />
                      Asignar a Expediente
                    </button>
                  </div>
                ) : (
                  /* Standard Title Header when nothing selected */
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>
                    {activeFolder} ({emails.length})
                  </span>
                )}
              </div>
              
              {/* Emails list table */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "10px" }}>
                    <Loader2 size={24} style={{ animation: "spin 0.8s linear infinite", color: "var(--primary-color, #4a88b5)" }} />
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Descargando emails...</span>
                  </div>
                ) : paginatedEmails.length > 0 ? (
                  <div>
                    {paginatedEmails.map((email) => {
                      const threadMsgs = email.thread || [];
                      const threadCount = threadMsgs.length;
                      const uniqueSenders = Array.from(new Set(threadMsgs.map((m) => m.senderName || "Tú")));
                      const sendersDisplay = uniqueSenders.length > 0 ? uniqueSenders.join(", ") : email.senderName;
                      const isSelected = selectedIds.includes(email.id);
                      
                      return (
                        <div
                          key={email.id}
                          onClick={() => handleSelectConversation(email.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "0.75rem 1.25rem",
                            borderBottom: "1px solid #f1f5f9",
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                            fontSize: "0.82rem",
                            gap: "1.5rem",
                            backgroundColor: isSelected ? "color-mix(in srgb, var(--primary-color, #4a88b5) 5%, white)" : "transparent"
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          {/* Checkbox Column */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, paddingRight: "4px" }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(email.id)}
                              style={{
                                width: "13px",
                                height: "13px",
                                cursor: "pointer",
                                accentColor: "var(--primary-color, #4a88b5)",
                              }}
                            />
                          </div>

                          {/* Senders */}
                          <div style={{ width: "180px", fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            <span style={{ textOverflow: "ellipsis", overflow: "hidden" }}>{sendersDisplay}</span>
                            {threadCount > 1 && (
                              <span style={{ fontSize: "0.7rem", color: "#64748b", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px", fontWeight: 700 }}>
                                {threadCount}
                              </span>
                            )}
                          </div>
                          
                          {/* Subject & Snippet */}
                          <div style={{ flex: 1, display: "flex", gap: "8px", overflow: "hidden", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 600, color: "#334155", flexShrink: 0 }}>{email.subject}</span>
                            <span style={{ color: "#cbd5e1" }}>—</span>
                            <span style={{ color: "#64748b", textOverflow: "ellipsis", overflow: "hidden" }}>{email.body}</span>
                          </div>
                          
                          {/* Column: Attachment (fixed 14px, preserves space) */}
                          <div style={{ width: "14px", minWidth: "14px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: "auto" }}>
                            {email.attachments && email.attachments.length > 0 ? (
                              <div style={{ display: "flex", alignItems: "center", color: "#94a3b8" }} title={`${email.attachments.length} adjunto(s)`}>
                                <Paperclip size={13} />
                              </div>
                            ) : null}
                          </div>

                          {/* Column: Folder Status (fixed 20px, preserves space) */}
                          {(() => {
                            const savedComm = savedCommunications.find((c) => cleanSubjectForMatch(c.asunto) === cleanSubjectForMatch(email.subject));
                            const assignedExpediente = savedComm
                              ? expedientes.find((exp) => exp.id === savedComm.expediente_id)
                              : null;
                            return (
                              <div style={{ width: "20px", minWidth: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: "6px" }}>
                                {assignedExpediente ? (
                                  <div
                                    style={{ display: "flex", alignItems: "center", color: "#f5af3f", cursor: "pointer" }}
                                    title={`Expediente #${assignedExpediente.id} - ${assignedExpediente.contabilidad_entidades?.nombre || "Sin cliente"}`}
                                  >
                                    <Folder size={14} fill="rgba(245, 175, 63, 0.1)" />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                          
                          {/* Column: Time (fixed 60px, justified right) */}
                          <div style={{ width: "60px", minWidth: "60px", display: "flex", justifyContent: "flex-end", alignItems: "center", color: "#94a3b8", fontSize: "0.75rem", fontWeight: 500, flexShrink: 0, whiteSpace: "nowrap" }}>
                            {email.time}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                    No hay correos en esta carpeta.
                  </div>
                )}
              </div>

              {/* Pagination controls */}
              {!loading && totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", padding: "10px 1.25rem", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(1, prev - 1)); }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: currentPage === 1 ? "#f8fafc" : "var(--primary-color, #4a88b5)",
                      color: currentPage === 1 ? "#cbd5e1" : "#ffffff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer"
                    }}
                  >
                    Anterior
                  </button>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(totalPages, prev + 1)); }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: currentPage === totalPages ? "#f8fafc" : "var(--primary-color, #4a88b5)",
                      color: currentPage === totalPages ? "#cbd5e1" : "#ffffff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer"
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expediente Selector Modal */}
      {showExpedienteModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#ffffff", width: "450px", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>Guardar y Asignar a Expediente</h3>
              <button
                disabled={assigning}
                onClick={() => setShowExpedienteModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem", fontWeight: 500 }}
              >
                ×
              </button>
            </div>
            
            <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>
              Se guardarán los {selectedIds.length} correos seleccionados en el historial de comunicaciones del expediente seleccionado.
            </p>

            <input
              type="text"
              placeholder="Buscar por cliente, destino o ID..."
              value={searchExpedienteQuery}
              onChange={(e) => setSearchExpedienteQuery(e.target.value)}
              disabled={assigning}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "0.8rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                outline: "none",
                boxSizing: "border-box"
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "8px", padding: "4px" }}>
              {assigning ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem", gap: "8px" }}>
                  <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite", color: "var(--primary-color, #4a88b5)" }} />
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Guardando y asignando correos...</span>
                </div>
              ) : filteredExpedientes.length > 0 ? (
                filteredExpedientes.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => handleAssignToSelectedExpediente(exp.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: "transparent",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      width: "100%"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                      Exp. #{exp.id} - {exp.contabilidad_entidades?.nombre || "Sin cliente"}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      Destino: {exp.maestro_destinos?.nombre || "No definido"}
                    </span>
                  </button>
                ))
              ) : (
                <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>
                  No se encontraron expedientes.
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button
                disabled={assigning}
                onClick={() => setShowExpedienteModal(false)}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#64748b",
                  cursor: "pointer"
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <img src={lightboxUrl} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "0.5rem" }} />
        </div>
      )}
    </div>
  );
}
