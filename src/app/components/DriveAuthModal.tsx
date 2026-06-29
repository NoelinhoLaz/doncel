"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Check, AlertCircle, ChevronRight, Folder, FolderOpen, ArrowLeft, HardDrive } from "lucide-react";
import { getCurrentUserDriveConfig, clearDriveConfiguration } from "@/actions/usuarios";

interface DriveAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type DriveFolder = { id: string; name: string };

export default function DriveAuthModal({ isOpen, onClose, onSuccess }: DriveAuthModalProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(false);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(false);
  const [currentDriveFolder, setCurrentDriveFolder] = useState<DriveFolder | null>(null);

  // Folder browser state
  const [folderLoading, setFolderLoading] = useState<boolean>(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderItems, setFolderItems] = useState<DriveFolder[]>([]);
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([{ id: "root", name: "Mi unidad" }]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadDriveFolders = useCallback(async (parentId: string = "root") => {
    try {
      setFolderLoading(true);
      setFolderError(null);
      const url = new URL("/api/auth/google-drive-folders", window.location.origin);
      url.searchParams.set("parentId", parentId);
      const response = await fetch(url.toString(), { method: "GET" });
      if (!response.ok) throw new Error("No se pudieron cargar las carpetas.");
      const { folders } = await response.json();
      setFolderItems(folders || []);
    } catch (err: any) {
      setFolderError(err.message || "Error al cargar carpetas.");
    } finally {
      setFolderLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    async function checkDriveStatus() {
      try {
        setLoadingConfig(true);
        setErrorMsg(null);
        const res = await getCurrentUserDriveConfig();
        if (res.success && (res.data?.drive_access_token || res.data?.drive_refresh_token)) {
          setIsDriveConnected(true);
          setCurrentDriveFolder(res.data.drive_folder || null);
          // Auto-open folder browser when already connected
          setFolderPath([{ id: "root", name: "Mi unidad" }]);
          await loadDriveFolders("root");
        } else {
          setIsDriveConnected(false);
          setCurrentDriveFolder(null);
        }
      } catch (err) {
        console.error("Error checking Drive status:", err);
        setIsDriveConnected(false);
        setCurrentDriveFolder(null);
      } finally {
        setLoadingConfig(false);
      }
    }

    checkDriveStatus();
  }, [isOpen, loadDriveFolders]);

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const response = await fetch("/api/auth/google-drive-auth-url", { method: "GET" });
      if (!response.ok) throw new Error("Error al obtener la URL de autenticación.");
      const { authUrl } = await response.json();

      const width = 500, height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const googleWindow = window.open(authUrl, "google_auth", `width=${width},height=${height},left=${left},top=${top}`);

      if (!googleWindow) throw new Error("No se pudo abrir la ventana de Google. Revisa el bloqueador de popups.");

      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const checkRes = await fetch("/api/auth/google-drive-check", { method: "GET" });
          if (checkRes.ok) {
            const { connected } = await checkRes.json();
            if (connected) {
              clearInterval(pollInterval);
              setIsDriveConnected(true);
              setSuccessMsg("¡Drive conectado!");
              googleWindow.close();
              // Auto-open folder browser after auth
              setFolderPath([{ id: "root", name: "Mi unidad" }]);
              await loadDriveFolders("root");
              onSuccess?.();
              return;
            }
          }
        } catch {}
        if (pollCount >= 60) {
          clearInterval(pollInterval);
          setErrorMsg("Tiempo de espera agotado. Inténtalo de nuevo.");
          googleWindow.close();
        }
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con Google Drive");
    } finally {
      setLoading(false);
    }
  };

  const openSubfolder = async (folder: DriveFolder) => {
    setFolderPath((prev) => [...prev, folder]);
    await loadDriveFolders(folder.id);
  };

  const navigateToBreadcrumb = async (index: number) => {
    const next = folderPath.slice(0, index + 1);
    setFolderPath(next);
    await loadDriveFolders(next[next.length - 1].id);
  };

  const goBackFolder = async () => {
    if (folderPath.length <= 1) return;
    const next = folderPath.slice(0, -1);
    setFolderPath(next);
    await loadDriveFolders(next[next.length - 1].id);
  };

  const selectCurrentFolder = async () => {
    try {
      setFolderLoading(true);
      setFolderError(null);
      const current = folderPath[folderPath.length - 1];
      const response = await fetch("/api/auth/google-drive-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: current.id, folderName: current.name }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Error al guardar la carpeta.");
      }
      const { data } = await response.json();
      setCurrentDriveFolder(data.drive_folder || current);
      setSuccessMsg(`✓ Carpeta guardada: "${current.name}"`);
      setTimeout(() => { setSuccessMsg(null); onClose(); }, 1800);
    } catch (err: any) {
      setFolderError(err.message || "Error al guardar la carpeta seleccionada.");
    } finally {
      setFolderLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const res = await clearDriveConfiguration();
      if (res.success) {
        setIsDriveConnected(false);
        setCurrentDriveFolder(null);
        setFolderItems([]);
      } else {
        setErrorMsg(res.error || "Error al desconectar");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al desconectar Drive");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentFolder = folderPath[folderPath.length - 1];
  const isAtRoot = folderPath.length <= 1;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          width: "90%",
          maxWidth: isDriveConnected ? "520px" : "440px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* ── HEADER ── */}
        <div style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "0.5rem",
              backgroundColor: isDriveConnected ? "#ecfdf5" : "#eff6ff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <HardDrive size={18} style={{ color: isDriveConnected ? "#10b981" : "#3b82f6" }} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                {isDriveConnected ? "Seleccionar carpeta de Drive" : "Conectar Google Drive"}
              </h2>
              {isDriveConnected && currentDriveFolder && (
                <p style={{ fontSize: "0.72rem", color: "#64748b", margin: "0.1rem 0 0 0" }}>
                  Carpeta actual: <strong>{currentDriveFolder.name}</strong>
                </p>
              )}
              {isDriveConnected && !currentDriveFolder && (
                <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "0.1rem 0 0 0" }}>
                  Ninguna carpeta seleccionada
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.4rem", borderRadius: "0.375rem", color: "#94a3b8",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem" }}>

          {/* Mensajes */}
          {errorMsg && (
            <div style={{
              backgroundColor: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: "0.5rem", padding: "0.75rem 1rem",
              marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
              <p style={{ fontSize: "0.8rem", color: "#7f1d1d", margin: 0 }}>{errorMsg}</p>
            </div>
          )}
          {successMsg && (
            <div style={{
              backgroundColor: "#ecfdf5", border: "1px solid #d1fae5",
              borderRadius: "0.5rem", padding: "0.75rem 1rem",
              marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <Check size={16} style={{ color: "#10b981", flexShrink: 0 }} />
              <p style={{ fontSize: "0.8rem", color: "#065f46", margin: 0, fontWeight: "600" }}>{successMsg}</p>
            </div>
          )}

          {loadingConfig ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "0.75rem" }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#475569" }} />
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Verificando conexión...</span>
            </div>
          ) : !isDriveConnected ? (
            /* ── NO CONECTADO ── */
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <div style={{
                width: "64px", height: "64px", borderRadius: "1rem",
                backgroundColor: "#eff6ff", margin: "0 auto 1rem",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <HardDrive size={28} style={{ color: "#3b82f6" }} />
              </div>
              <p style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "1.5rem" }}>
                Conecta tu cuenta de Google Drive para gestionar documentos de expedientes directamente desde Momo.
              </p>
              <button
                onClick={handleGoogleAuth}
                disabled={loading}
                style={{
                  backgroundColor: "#4285f4", color: "#ffffff",
                  border: "none", borderRadius: "0.625rem",
                  padding: "0.75rem 1.5rem", fontSize: "0.875rem", fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer", width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  opacity: loading ? 0.7 : 1, transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = "#3367d6")}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = "#4285f4")}
              >
                {loading ? (
                  <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Conectando...</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.4 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.5 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.5 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.3 26.8 36 24 36c-5.2 0-9.6-3.4-11.2-8.1l-6.6 5.1C9.8 39.6 16.4 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C41.1 35.3 44 30 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
                  Conectar con Google</>
                )}
              </button>
            </div>
          ) : (
            /* ── CONECTADO: FOLDER BROWSER ── */
            <div>
              {/* Breadcrumb */}
              <div style={{
                display: "flex", alignItems: "center", gap: "0.25rem",
                padding: "0.5rem 0.75rem", backgroundColor: "#f8fafc",
                borderRadius: "0.5rem", marginBottom: "0.75rem",
                flexWrap: "wrap", border: "1px solid #e2e8f0",
              }}>
                {folderPath.map((segment, i) => (
                  <span key={segment.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    {i > 0 && <ChevronRight size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />}
                    <button
                      onClick={() => navigateToBreadcrumb(i)}
                      disabled={i === folderPath.length - 1}
                      style={{
                        background: "none", border: "none", padding: "0.1rem 0.25rem",
                        fontSize: "0.75rem", fontWeight: i === folderPath.length - 1 ? "700" : "500",
                        color: i === folderPath.length - 1 ? "#0f172a" : "#475569",
                        cursor: i === folderPath.length - 1 ? "default" : "pointer",
                        borderRadius: "0.25rem",
                        transition: "background-color 0.15s",
                      }}
                      onMouseEnter={(e) => { if (i < folderPath.length - 1) e.currentTarget.style.backgroundColor = "#e2e8f0"; }}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {segment.name}
                    </button>
                  </span>
                ))}
              </div>

              {/* Folder Error */}
              {folderError && (
                <div style={{
                  backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: "0.5rem", padding: "0.75rem",
                  marginBottom: "0.75rem", fontSize: "0.8rem", color: "#991b1b",
                }}>
                  {folderError}
                </div>
              )}

              {/* Folder list */}
              <div style={{ minHeight: "160px", maxHeight: "300px", overflowY: "auto" }}>
                {folderLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem", gap: "0.5rem" }}>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "#475569" }} />
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Cargando...</span>
                  </div>
                ) : folderItems.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem", color: "#94a3b8", gap: "0.5rem" }}>
                    <FolderOpen size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: "0.8rem" }}>No hay subcarpetas aquí</span>
                    <span style={{ fontSize: "0.72rem" }}>Puedes seleccionar esta carpeta directamente</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {folderItems.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => openSubfolder(folder)}
                        style={{
                          display: "flex", alignItems: "center",
                          width: "100%", gap: "0.625rem",
                          backgroundColor: "transparent",
                          border: "1px solid transparent",
                          borderRadius: "0.5rem",
                          padding: "0.6rem 0.75rem",
                          cursor: "pointer", textAlign: "left",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f1f5f9";
                          e.currentTarget.style.borderColor = "#e2e8f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.borderColor = "transparent";
                        }}
                      >
                        <Folder size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.85rem", color: "#1e293b", fontWeight: "500", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {folder.name}
                        </span>
                        <ChevronRight size={14} style={{ color: "#cbd5e1", flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ACTIONS ── */}
        {isDriveConnected && !loadingConfig && (
          <div style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #f1f5f9",
            display: "flex", gap: "0.5rem", flexShrink: 0,
            backgroundColor: "#fafafa",
          }}>
            {/* Back button */}
            <button
              onClick={goBackFolder}
              disabled={isAtRoot || folderLoading}
              style={{
                display: "flex", alignItems: "center", gap: "0.35rem",
                backgroundColor: isAtRoot ? "#f8fafc" : "#f1f5f9",
                color: isAtRoot ? "#cbd5e1" : "#475569",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem", padding: "0.6rem 0.875rem",
                fontSize: "0.8rem", fontWeight: "600",
                cursor: isAtRoot ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isAtRoot) e.currentTarget.style.backgroundColor = "#e2e8f0"; }}
              onMouseLeave={(e) => { if (!isAtRoot) e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
            >
              <ArrowLeft size={14} /> Atrás
            </button>

            {/* Select current folder */}
            <button
              onClick={selectCurrentFolder}
              disabled={folderLoading}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem",
                backgroundColor: "#10b981", color: "#ffffff",
                border: "none", borderRadius: "0.5rem",
                padding: "0.6rem 1rem", fontSize: "0.85rem", fontWeight: "700",
                cursor: folderLoading ? "not-allowed" : "pointer",
                opacity: folderLoading ? 0.7 : 1, transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => { if (!folderLoading) e.currentTarget.style.backgroundColor = "#059669"; }}
              onMouseLeave={(e) => { if (!folderLoading) e.currentTarget.style.backgroundColor = "#10b981"; }}
            >
              {folderLoading ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
              ) : (
                <><Check size={14} /> Seleccionar &ldquo;{currentFolder.name}&rdquo;</>
              )}
            </button>

            {/* Disconnect button */}
            <button
              onClick={handleDisconnect}
              disabled={loading}
              title="Desconectar Drive"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "#fef2f2", color: "#ef4444",
                border: "1px solid #fecaca", borderRadius: "0.5rem",
                padding: "0.6rem 0.75rem", fontSize: "0.75rem",
                cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#fee2e2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#fef2f2"; }}
            >
              {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "Desconectar"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
