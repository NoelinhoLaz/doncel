"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./AgentBar.module.css";
import { Icons } from "@/lib/icons";
import { useRouter } from "next/navigation";
import { getCurrentAgencyDetails } from "@/actions/agencias";
import { getCurrentUsuario, getCurrentUserEmailConfig, getCurrentUserDriveConfig } from "@/actions/usuarios";
import EmailConfigModal from "./EmailConfigModal";
import DriveAuthModal from "./DriveAuthModal";
import { Link2, Link2Off } from "lucide-react";

interface AgencyDetails {
  logo_url: string | null;
  nombre_comercial: string;
  color_corporativo?: string | null;
}

export default function AgentBar() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [agencyDetails, setAgencyDetails] = useState<AgencyDetails | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isEmailConnected, setIsEmailConnected] = useState<boolean>(false);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    async function loadAgencyDetails() {
      const details = await getCurrentAgencyDetails();
      setAgencyDetails(details);
      if (details?.color_corporativo) {
        document.documentElement.style.setProperty("--header-bg", details.color_corporativo);
        document.documentElement.style.setProperty("--primary-color", details.color_corporativo);
        if (typeof window !== "undefined") {
          localStorage.setItem("momo_primary_color", details.color_corporativo);
        }
      }
    }

    async function loadCurrentUser() {
      try {
        const u = await getCurrentUsuario();
        setCurrentUser(u);
      } catch (e) {
        console.error("Error loading user profile:", e);
      }
    }

    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
        await loadAgencyDetails();
        await loadCurrentUser();
        // Check email connection status
        try {
          const emailRes = await getCurrentUserEmailConfig();
          setIsEmailConnected(!!(emailRes.success && emailRes.data?.email_address));
        } catch {
          setIsEmailConnected(false);
        }
        // Check Drive connection status
        try {
          const driveRes = await getCurrentUserDriveConfig();
          setIsDriveConnected(!!(driveRes.success && (driveRes.data?.drive_access_token || driveRes.data?.drive_refresh_token)));
        } catch {
          setIsDriveConnected(false);
        }
      }
    }
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user) {
        await loadAgencyDetails();
        await loadCurrentUser();
      } else {
        setAgencyDetails(null);
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Close logout tooltip when clicking anywhere outside
  useEffect(() => {
    if (!isLogoutOpen) return;
    const handleOutsideClick = () => {
      setIsLogoutOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [isLogoutOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const getInitials = (user: any) => {
    if (!user) return "";
    const n = (user.nombre || "").trim().charAt(0).toUpperCase();
    const a = (user.apellidos || "").trim().charAt(0).toUpperCase();
    if (!n && !a) return (userEmail || "").substring(0, 2).toUpperCase();
    return `${n}${a}`;
  };

  return (
    <header className={styles.agentBar}>
      <div className={styles.content}>
        <div className={styles.left}>
          {agencyDetails?.logo_url ? (
            <img 
              src={agencyDetails.logo_url} 
              alt={agencyDetails.nombre_comercial} 
              className={styles.logo}
            />
          ) : agencyDetails?.nombre_comercial ? (
            <span className={styles.agencyName}>{agencyDetails.nombre_comercial}</span>
          ) : (
            <span className={styles.agencyName}>Momo</span>
          )}
        </div>
        <div className={styles.right}>
          {userEmail ? (
            <div className={styles.userInfo} style={{ position: "relative" }}>
              {currentUser ? (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLogoutOpen(!isLogoutOpen);
                  }}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "0.75rem", 
                    cursor: "pointer",
                    userSelect: "none",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.5rem",
                    transition: "background-color 0.2s ease"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: "#ffffff" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "600", opacity: 0.95, lineHeight: "1.2" }}>
                      {currentUser.nombre} {currentUser.apellidos}
                    </span>
                    <span style={{ fontSize: "0.7rem", opacity: 0.75, textTransform: "capitalize", lineHeight: "1.2" }}>
                      {currentUser.rol}
                    </span>
                  </div>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "color-mix(in srgb, var(--primary-color, #475569) 25%, white)",
                    color: "var(--primary-color, #475569)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                    fontWeight: "700",
                    border: "2px solid color-mix(in srgb, var(--primary-color, #475569) 40%, white)",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
                    flexShrink: 0
                  }}>
                    {getInitials(currentUser)}
                  </div>
                </div>
              ) : (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLogoutOpen(!isLogoutOpen);
                  }}
                  className={styles.userBadge} 
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <Icons.Users size={14} className={styles.userIcon} />
                  <span className={styles.email}>{userEmail}</span>
                </div>
              )}

                  {/* POPUP / TOOLTIP DROPDOWN DE CERRAR SESIÓN */}
                  {isLogoutOpen && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        width: "160px",
                        backgroundColor: "#ffffff",
                        borderRadius: "0.5rem",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                        border: "1px solid #e2e8f0",
                        padding: "0.35rem",
                        zIndex: 1010,
                        display: "flex",
                        flexDirection: "column",
                        animation: "fadeIn 0.15s ease-out"
                      }}
                    >
                      {/* CONFIGURAR EMAIL */}
                      <button 
                        onClick={() => {
                          setIsLogoutOpen(false);
                          setIsEmailModalOpen(true);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.85rem",
                          fontWeight: "500",
                          color: "#334155",
                          background: "none",
                          border: "none",
                          borderRadius: "0.375rem",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "background-color 0.15s ease",
                          marginBottom: "0.25rem"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <Icons.Mensajes size={16} />
                        <span style={{ flex: 1 }}>Email</span>
                        {isEmailConnected ? (
                          <Link2 size={13} style={{ color: "var(--primary-color, #475569)", flexShrink: 0 }} />
                        ) : (
                          <Link2Off size={13} style={{ color: "#cbd5e1", flexShrink: 0 }} />
                        )}
                      </button>

                      {/* CONFIGURAR DRIVE */}
                      <button 
                        onClick={() => {
                          setIsLogoutOpen(false);
                          setIsDriveModalOpen(true);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.85rem",
                          fontWeight: "500",
                          color: "#334155",
                          background: "none",
                          border: "none",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "background-color 0.15s ease",
                          marginBottom: "0.25rem",
                          borderBottom: "1px solid #f1f5f9",
                          paddingBottom: "0.5rem",
                          borderRadius: "0.375rem 0.375rem 0 0"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <Icons.Expedientes size={16} />
                        <span style={{ flex: 1 }}>Drive</span>
                        {isDriveConnected ? (
                          <Link2 size={13} style={{ color: "var(--primary-color, #475569)", flexShrink: 0 }} />
                        ) : (
                          <Link2Off size={13} style={{ color: "#cbd5e1", flexShrink: 0 }} />
                        )}
                      </button>

                      <button 
                        onClick={handleLogout}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.85rem",
                          fontWeight: "500",
                          color: "#ef4444",
                          background: "none",
                          border: "none",
                          borderRadius: "0.375rem",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "background-color 0.15s ease",
                          marginTop: "0.25rem"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#fef2f2"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <Icons.Logout size={16} />
                        <span>Cerrar sesión</span>
                      </button>
                    </div>
                  )}

                  {/* RENDER EMAIL CONFIGURATION MODAL */}
                  <EmailConfigModal 
                    isOpen={isEmailModalOpen} 
                    onClose={() => setIsEmailModalOpen(false)} 
                  />

                  {/* RENDER DRIVE AUTHENTICATION MODAL */}
                  <DriveAuthModal 
                    isOpen={isDriveModalOpen} 
                    onClose={() => setIsDriveModalOpen(false)}
                    onSuccess={() => setIsDriveConnected(true)}
                  />
                </div>
              ) : (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLogoutOpen(!isLogoutOpen);
                  }}
                  className={styles.userBadge} 
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <Icons.Users size={14} className={styles.userIcon} />
                  <span className={styles.email}>{userEmail}</span>
                </div>
              )}
            </div>
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}

