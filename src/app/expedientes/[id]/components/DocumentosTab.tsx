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
      {/* Google Drive Banner */}
      {!loadingDrive && expediente && (
        <div className={styles.driveBanner}>
          {hasLinkedFolder ? (
            <>
              <div className={styles.driveInfo}>
                <HardDrive size={18} style={{ color: "#10b981" }} />
                <span>
                  Carpeta de Drive vinculada:{" "}
                  <a
                    href={`https://drive.google.com/drive/folders/${expediente.metadata.drive_folder.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontWeight: "700",
                      color: "var(--primary-color, #475569)",
                      textDecoration: "underline",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    {expediente.metadata.drive_folder.name}
                    <ExternalLink size={14} />
                  </a>
                </span>
              </div>
              <div className={styles.driveActions}>
                <button className={styles.driveButton} onClick={() => setIsPickerOpen(true)}>
                  <FolderOpen size={14} /> Cambiar carpeta
                </button>
                <button
                  className={styles.driveButton}
                  onClick={handleUnlink}
                  style={{ color: "#ef4444", borderColor: "#fecaca" }}
                >
                  <Unlink size={14} /> Desvincular
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.driveInfo}>
                <HardDrive size={18} style={{ color: "#94a3b8" }} />
                <span style={{ color: "#64748b" }}>
                  Este expediente no tiene ninguna carpeta de Google Drive vinculada.
                </span>
              </div>
              <div className={styles.driveActions}>
                <button
                  className={`${styles.driveButton} ${styles.driveButtonPrimary}`}
                  onClick={() => setIsPickerOpen(true)}
                >
                  <FolderOpen size={14} /> Vincular carpeta
                </button>
                <button className={styles.driveButton} onClick={handleCreateFolder} disabled={creatingFolder}>
                  {creatingFolder ? (
                    <>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Creando carpeta...
                    </>
                  ) : (
                    <>
                      <FolderPlus size={14} /> Crear carpeta
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {loadingDrive && (
        <div className={styles.driveBanner} style={{ justifyContent: "center", height: "46px" }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "#64748b", marginRight: "0.5rem" }} />
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Cargando datos de Google Drive...</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Icons.Documentos size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Documentos de Proveedor ({d.filteredData.length})</h2>
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

