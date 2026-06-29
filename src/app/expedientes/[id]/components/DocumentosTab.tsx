"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import { useDocumentos } from "@/hooks/useDocumentos";
import DocumentosGrid from "@/app/components/documentos/DocumentosGrid";
import DocumentosList from "@/app/components/documentos/DocumentosList";
import ModalDetalleDocumento from "@/components/modals/ModalDetalleDocumento";
import styles from "../page.module.css";

// Google Drive integration imports
import { HardDrive, FolderOpen, ExternalLink, Unlink, FolderPlus, Loader2 } from "lucide-react";
import { getExpedienteById, linkExpedienteDriveFolder, createExpedienteDriveFolder } from "@/actions/expedientes";
import DriveFolderPickerModal from "./DriveFolderPickerModal";

interface DocumentosTabProps {
  expedienteId: string;
}

interface DriveFolderInfo {
  id: string;
  name: string;
}

interface ExpedienteData {
  id: string;
  numero?: string | null;
  referencia: string;
  metadata?: {
    drive_folder?: DriveFolderInfo | null;
  } | null;
}

export default function DocumentosTab({ expedienteId }: DocumentosTabProps) {
  const d = useDocumentos(expedienteId);

  // Drive integration state
  const [expediente, setExpediente] = useState<ExpedienteData | null>(null);
  const [loadingDrive, setLoadingDrive] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoadingDrive(true);
        const data = await getExpedienteById(expedienteId);
        setExpediente(data as ExpedienteData | null);
      } catch (err) {
        console.error("Error loading expediente for documents tab:", err);
      } finally {
        setLoadingDrive(false);
      }
    }
    load();
  }, [expedienteId]);

  const handleFolderLinked = (folder: DriveFolderInfo) => {
    setExpediente((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          drive_folder: folder,
        },
      };
    });
  };

  const handleCreateFolder = async () => {
    if (!expediente) return;
    try {
      setCreatingFolder(true);
      const name = expediente.numero
        ? `${expediente.numero} - ${expediente.referencia}`
        : expediente.referencia || `Expediente ${expedienteId.substring(0, 8)}`;
      
      const res = await createExpedienteDriveFolder(expedienteId, name);
      if (res.success && res.folder) {
        handleFolderLinked(res.folder);
      } else {
        alert(`Error al crear la carpeta: ${res.error || "Desconocido"}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`Error al crear la carpeta: ${errorMsg}`);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm("¿Estás seguro de que quieres desvincular la carpeta de Google Drive de este expediente?")) {
      return;
    }
    try {
      setLoadingDrive(true);
      const res = await linkExpedienteDriveFolder(expedienteId, null);
      if (res.success) {
        setExpediente((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            metadata: {
              ...prev.metadata,
              drive_folder: null,
            },
          };
        });
      } else {
        alert(`Error al desvincular la carpeta: ${res.error || "Desconocido"}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`Error al desvincular la carpeta: ${errorMsg}`);
    } finally {
      setLoadingDrive(false);
    }
  };

  const hasLinkedFolder = !!expediente?.metadata?.drive_folder?.id;

  return (
    <div className={styles.tabContainer}>
      {/* Header */}
      <div className={styles.listHeaderTop} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.5rem" }}>
        <div className={styles.listTitleWrapper} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Icons.Documentos size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Documentos de Proveedor ({d.filteredData.length})</h2>
          </div>

          {/* Google Drive Status/Actions under the Title */}
          {!loadingDrive && expediente && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.72rem", color: "rgba(255, 255, 255, 0.9)", marginTop: "0.2rem" }}>
              {hasLinkedFolder ? (
                <>
                  <HardDrive size={13} style={{ color: "#4ade80", flexShrink: 0 }} />
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    Carpeta Drive:{" "}
                    <a
                      href={`https://drive.google.com/drive/folders/${expediente?.metadata?.drive_folder?.id ?? ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontWeight: "700",
                        color: "#ffffff",
                        textDecoration: "underline",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.15rem",
                      }}
                    >
                      {expediente?.metadata?.drive_folder?.name ?? ""}
                      <ExternalLink size={11} />
                    </a>
                  </span>
                  <div style={{ display: "flex", gap: "0.35rem", marginLeft: "0.5rem" }}>
                    <button
                      onClick={() => setIsPickerOpen(true)}
                      style={{
                        background: "rgba(255, 255, 255, 0.2)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        borderRadius: "0.25rem",
                        padding: "0.15rem 0.4rem",
                        fontSize: "0.68rem",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                    >
                      Cambiar
                    </button>
                    <button
                      onClick={handleUnlink}
                      style={{
                        background: "rgba(239, 68, 68, 0.2)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "0.25rem",
                        padding: "0.15rem 0.4rem",
                        fontSize: "0.68rem",
                        color: "#fca5a5",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.3)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
                    >
                      Desvincular
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <HardDrive size={13} style={{ color: "rgba(255, 255, 255, 0.6)", flexShrink: 0 }} />
                  <span>Este expediente no tiene ninguna carpeta de Google Drive vinculada.</span>
                  <div style={{ display: "flex", gap: "0.35rem", marginLeft: "0.5rem" }}>
                    <button
                      onClick={() => setIsPickerOpen(true)}
                      style={{
                        background: "#ffffff",
                        border: "none",
                        borderRadius: "0.25rem",
                        padding: "0.15rem 0.5rem",
                        fontSize: "0.68rem",
                        color: "var(--primary-color, #475569)",
                        fontWeight: "700",
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      Vincular
                    </button>
                    <button
                      onClick={handleCreateFolder}
                      disabled={creatingFolder}
                      style={{
                        background: "rgba(255, 255, 255, 0.2)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        borderRadius: "0.25rem",
                        padding: "0.15rem 0.4rem",
                        fontSize: "0.68rem",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => { if (!creatingFolder) e.currentTarget.style.background = "rgba(255,255,255,0.3)"; }}
                      onMouseLeave={(e) => { if (!creatingFolder) e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                    >
                      {creatingFolder ? "Creando..." : "Crear carpeta"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {loadingDrive && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.7rem", color: "rgba(255, 255, 255, 0.7)", marginTop: "0.2rem" }}>
              <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
              <span>Cargando datos de Drive...</span>
            </div>
          )}
        </div>
        <div className={styles.actionsWrapper}>
          <div className={styles.searchWrapper}>
            <Icons.Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por emisor o nº documento..."
              className={styles.searchInput}
              value={d.search}
              onChange={(e) => d.setSearch(e.target.value)}
            />
          </div>
          <button
            className={styles.actionIconButton}
            onClick={() => d.setViewMode(d.viewMode === "grid" ? "list" : "grid")}
            title={d.viewMode === "grid" ? "Ver como lista" : "Ver como cuadrícula"}
          >
            <Icons.List size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      {d.loading ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: "4rem" }}>
          <div
            style={{
              display: "inline-block",
              width: 28,
              height: 28,
              border: "3px solid #e2e8f0",
              borderTopColor: "#6366f1",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              marginBottom: "0.5rem",
            }}
          />
          <div>Cargando documentos de proveedor asociados...</div>
        </div>
      ) : (
        <>
          {d.viewMode === "grid" ? (
            <div className={styles.docGrid}>
              <DocumentosGrid docs={d.paginatedData} onOpen={d.openDocDetails} />
            </div>
          ) : (
            <DocumentosList docs={d.paginatedData} onOpen={d.openDocDetails} />
          )}

          {d.filteredData.length > 0 && (
            <div style={{ padding: "0 0.5rem" }}>
              <Pagination
                currentPage={d.currentPage}
                totalItems={d.filteredData.length}
                itemsPerPage={d.rowsPerPage}
                onPageChange={d.setCurrentPage}
                onItemsPerPageChange={d.setRowsPerPage}
              />
            </div>
          )}
        </>
      )}

      {/* Modal Detalle Documento */}
      {d.selectedDoc && (
        <ModalDetalleDocumento
          doc={d.selectedDoc}
          payments={d.payments}
          loadingPayments={d.loadingPayments}
          reconcilingPago={d.reconcilingPago}
          bankMovements={d.bankMovements}
          loadingBank={d.loadingBank}
          selectedBankMovId={d.selectedBankMovId}
          onSelectBankMov={d.setSelectedBankMovId}
          reconcileLoading={d.reconcileLoading}
          successMessage={d.successMessage}
          errorMessage={d.errorMessage}
          onReconcile={d.handleReconcile}
          onStartReconcile={d.startReconcile}
          onCancelReconcile={d.cancelReconcile}
          onClose={d.closeDetails}
        />
      )}

      {/* Google Drive Folder Picker Modal */}
      <DriveFolderPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onFolderLinked={handleFolderLinked}
        expedienteId={expedienteId}
      />

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
