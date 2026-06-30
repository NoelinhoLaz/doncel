"use client";

import { useState, useEffect } from "react";
import {
  X,
  Mail,
  Lock,
  Server,
  HelpCircle,
  Check,
  Loader2,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { saveEmailConfiguration, getCurrentUserEmailConfig } from "@/actions/usuarios";

interface EmailConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EmailConfigModal({ isOpen, onClose }: EmailConfigModalProps) {
  const [activeTab, setActiveTab] = useState<"gmail" | "microsoft" | "imap">("gmail");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [imapHost, setImapHost] = useState<string>("");
  const [imapPort, setImapPort] = useState<string>("993");
  const [smtpHost, setSmtpHost] = useState<string>("");
  const [smtpPort, setSmtpPort] = useState<string>("465");
  const [useSsl, setUseSsl] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    async function loadConfig() {
      try {
        setLoadingConfig(true);
        setErrorMsg(null);
        const res = await getCurrentUserEmailConfig();
        if (res.success && res.data) {
          const config = res.data;
          setActiveTab(config.email_provider || "gmail");
          setEmailAddress(config.email_address || "");
          setPassword(config.email_password_enc || "");
          setImapHost(config.email_imap_host || "");
          setImapPort(config.email_imap_port ? String(config.email_imap_port) : "993");
          setSmtpHost(config.email_smtp_host || "");
          setSmtpPort(config.email_smtp_port ? String(config.email_smtp_port) : "465");
          setUseSsl(config.email_use_ssl !== undefined ? config.email_use_ssl : true);
        }
      } catch (err: any) {
        console.error("Failed to load user email configuration:", err);
      } finally {
        setLoadingConfig(false);
      }
    }

    loadConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  const resolvedSmtpHost = activeTab === "imap" ? smtpHost.trim() : `smtp.${activeTab === "gmail" ? "gmail.com" : "outlook.com"}`;
  const resolvedSmtpPort = activeTab === "imap" ? Number(smtpPort) : 465;

  const handleVerify = async () => {
    if (!emailAddress.trim() || !password) return;
    setVerifyStatus("checking");
    setVerifyError(null);
    try {
      const res = await fetch("/api/email/verify-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: emailAddress.trim(),
          email_password: password,
          smtp_host: resolvedSmtpHost,
          smtp_port: resolvedSmtpPort,
          use_ssl: useSsl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setVerifyStatus("ok");
      } else {
        setVerifyStatus("error");
        setVerifyError(json.error || "Error de conexión desconocido.");
      }
    } catch {
      setVerifyStatus("error");
      setVerifyError("No se pudo contactar con el servidor de verificación.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAddress.trim()) {
      setErrorMsg("El correo electrónico es requerido");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccess(false);

      // Verificar SMTP antes de guardar
      const verifyRes = await fetch("/api/email/verify-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: emailAddress.trim(),
          email_password: password,
          smtp_host: resolvedSmtpHost,
          smtp_port: resolvedSmtpPort,
          use_ssl: useSsl,
        }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyJson.success) {
        setVerifyStatus("error");
        setVerifyError(verifyJson.error || "Error de conexión SMTP.");
        setLoading(false);
        return;
      }
      setVerifyStatus("ok");
      setVerifyError(null);

      const payload = {
        email_provider: activeTab,
        email_address: emailAddress.trim(),
        email_password_enc: password,
        email_imap_host: activeTab === "imap" ? imapHost.trim() : `imap.${activeTab === "gmail" ? "gmail.com" : "outlook.com"}`,
        email_imap_port: activeTab === "imap" ? Number(imapPort) : 993,
        email_smtp_host: resolvedSmtpHost,
        email_smtp_port: resolvedSmtpPort,
        email_use_ssl: useSsl
      };

      const res = await saveEmailConfiguration(payload);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res.error || "Ocurrió un error al guardar la configuración");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.4)",
      backdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      animation: "modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
    }}>
      <div 
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          width: "480px",
          maxWidth: "90%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: '"Montserrat", sans-serif',
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid #f1f5f9",
          backgroundColor: "#fafbfc"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Mail size={20} style={{ color: "var(--primary-color, #475569)" }} />
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "#0f172a" }}>
              Configurar Correo Electrónico
            </h3>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "4px",
              transition: "background-color 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <X size={18} />
          </button>
        </header>

        {loadingConfig ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem", gap: "1rem" }}>
            <Loader2 size={36} className="animate-spin" style={{ color: "var(--primary-color, #475569)", animation: "spin 1.5s linear infinite" }} />
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "600" }}>Cargando configuración...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {/* Tabs Selector */}
            <div style={{
              display: "flex",
              padding: "1rem 1.5rem 0.5rem 1.5rem",
              gap: "0.5rem"
            }}>
              {(["gmail", "microsoft", "imap"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab);
                      setErrorMsg(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.8rem",
                      fontWeight: "700",
                      borderRadius: "8px",
                      border: "1px solid",
                      borderColor: isActive ? "var(--primary-color, #475569)" : "#e2e8f0",
                      backgroundColor: isActive ? "color-mix(in srgb, var(--primary-color, #475569) 8%, white)" : "transparent",
                      color: isActive ? "var(--primary-color, #475569)" : "#64748b",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {tab === "microsoft" ? "Microsoft O365" : tab}
                  </button>
                );
              })}
            </div>

            {/* Provider Guidance Box */}
            <div style={{ padding: "0.5rem 1.5rem" }}>
              <div style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                fontSize: "0.78rem",
                lineHeight: "1.4",
                color: "#475569"
              }}>
                <ShieldAlert size={16} style={{ color: "var(--primary-color, #475569)", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  {activeTab === "gmail" && (
                    <span>
                      <strong>Requisito de Google:</strong> Para Gmail, debes tener activa la verificación en 2 pasos de Google y usar una <strong>Contraseña de Aplicación</strong> de 16 caracteres en lugar de tu clave habitual.
                    </span>
                  )}
                  {activeTab === "microsoft" && (
                    <span>
                      <strong>Requisito de Microsoft:</strong> Para Outlook u Office 365, es obligatorio generar una <strong>Contraseña de Aplicación</strong> en la sección de seguridad de tu cuenta de Microsoft.
                    </span>
                  )}
                  {activeTab === "imap" && (
                    <span>
                      <strong>Configuración Manual:</strong> Introduce los servidores IMAP y SMTP correspondientes a tu proveedor (ej. Yahoo, Zoho, Hostinger, o servidor propio de la empresa).
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div style={{
              padding: "1rem 1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem"
            }}>
              {/* Email Address input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#475569" }}>
                  Dirección de Correo
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Mail size={16} style={{ position: "absolute", left: "0.75rem", color: "#94a3b8" }} />
                  <input 
                    type="email"
                    required
                    placeholder={activeTab === "gmail" ? "tu.usuario@gmail.com" : "correo@ejemplo.com"}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem 0.55rem 2.25rem",
                      fontSize: "0.85rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      outline: "none"
                    }}
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Password / App Password input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#475569" }}>
                  {activeTab === "imap" ? "Contraseña de Correo" : "Contraseña de Aplicación"}
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Lock size={16} style={{ position: "absolute", left: "0.75rem", color: "#94a3b8" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••••••"
                    style={{
                      width: "100%",
                      padding: "0.55rem 2.25rem 0.55rem 2.25rem",
                      fontSize: "0.85rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      outline: "none",
                    }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{ position: "absolute", right: "0.65rem", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* IMAP Manual Server Inputs (Only for IMAP tab) */}
              {activeTab === "imap" && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                  borderTop: "1px dashed #e2e8f0",
                  paddingTop: "0.85rem",
                  marginTop: "0.25rem"
                }}>
                  {/* IMAP server host & port */}
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b" }}>Servidor IMAP (Entrada)</label>
                      <input 
                        type="text"
                        placeholder="imap.ejemplo.com"
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          outline: "none"
                        }}
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                      />
                    </div>
                    <div style={{ width: "100px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b" }}>Puerto IMAP</label>
                      <input 
                        type="number"
                        placeholder="993"
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          outline: "none"
                        }}
                        value={imapPort}
                        onChange={(e) => setImapPort(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* SMTP server host & port */}
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b" }}>Servidor SMTP (Salida)</label>
                      <input 
                        type="text"
                        placeholder="smtp.ejemplo.com"
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          outline: "none"
                        }}
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                      />
                    </div>
                    <div style={{ width: "100px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b" }}>Puerto SMTP</label>
                      <input 
                        type="number"
                        placeholder="465"
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          outline: "none"
                        }}
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* SSL checkbox */}
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", cursor: "pointer", userSelect: "none" }}>
                    <input 
                      type="checkbox"
                      checked={useSsl}
                      onChange={(e) => setUseSsl(e.target.checked)}
                      style={{ accentColor: "var(--primary-color, #475569)" }}
                    />
                    <span>Requerir conexión segura (SSL / TLS)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Test connection */}
            <div style={{ margin: "0 1.5rem 0.75rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifyStatus === "checking" || !emailAddress || !password}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                  padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: "700", borderRadius: "8px",
                  border: `1px solid ${verifyStatus === "ok" ? "#10b981" : verifyStatus === "error" ? "#ef4444" : "#cbd5e1"}`,
                  background: verifyStatus === "ok" ? "#f0fdf4" : verifyStatus === "error" ? "#fef2f2" : "#f8fafc",
                  color: verifyStatus === "ok" ? "#059669" : verifyStatus === "error" ? "#dc2626" : "#475569",
                  cursor: verifyStatus === "checking" ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                {verifyStatus === "checking" ? (
                  <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Probando conexión…</>
                ) : verifyStatus === "ok" ? (
                  <><Check size={13} /> Conexión verificada</>
                ) : verifyStatus === "error" ? (
                  <><ShieldAlert size={13} /> Error de conexión</>
                ) : (
                  <><Server size={13} /> Probar conexión SMTP</>
                )}
              </button>
              {verifyStatus === "error" && verifyError && (
                <div style={{ padding: "0.5rem 0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "0.75rem", color: "#dc2626" }}>
                  {verifyError}
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div style={{
                margin: "0 1.5rem 1rem 1.5rem",
                padding: "0.6rem 0.85rem",
                backgroundColor: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: "8px",
                color: "#ef4444",
                fontSize: "0.78rem",
                fontWeight: "600"
              }}>
                {errorMsg}
              </div>
            )}

            {/* Footer / Submit Buttons */}
            <footer style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "1rem 1.5rem",
              borderTop: "1px solid #f1f5f9",
              backgroundColor: "#fafbfc",
              gap: "0.75rem"
            }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: "0.55rem 1.25rem",
                  fontSize: "0.8rem",
                  fontWeight: "700",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  color: "#64748b",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "0.55rem 1.5rem",
                  fontSize: "0.8rem",
                  fontWeight: "700",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: success ? "#10b981" : "var(--primary-color, #475569)",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  transition: "all 0.2s"
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} style={{ animation: "spin 1.5s linear infinite" }} />
                    <span>Guardando...</span>
                  </>
                ) : success ? (
                  <>
                    <Check size={14} />
                    <span>¡Guardado!</span>
                  </>
                ) : (
                  <span>Guardar Configuración</span>
                )}
              </button>
            </footer>
          </form>
        )}
      </div>

      <style jsx>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
