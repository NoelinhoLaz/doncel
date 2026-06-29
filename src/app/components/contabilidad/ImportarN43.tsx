"use client";

import React, { useState, useRef, useEffect } from "react";
import { useImportN43 } from "@/hooks/useImportN43";
import styles from "./ImportarN43.module.css";
import { 
  FileText, 
  Upload, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  HelpCircle,
  Clock,
  DollarSign,
  TrendingUp,
  UserCheck
} from "lucide-react";

interface ImportarN43Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cuentasBancarias: Array<{
    id: string;
    banco: string;
    iban: string;
    descripcion?: string;
  }>;
}

export default function ImportarN43({
  isOpen,
  onClose,
  onSuccess,
  cuentasBancarias
}: ImportarN43Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCuenta, setSelectedCuenta] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({});

  const { state, importar, aceptarMatch, rechazarMatch, reset } = useImportN43();

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      reset();
      setSelectedFile(null);
      setExpandedMatches({});
      if (cuentasBancarias && cuentasBancarias.length > 0) {
        setSelectedCuenta(cuentasBancarias[0].id);
      } else {
        setSelectedCuenta("");
      }
    }
  }, [isOpen, cuentasBancarias, reset]);

  if (!isOpen) return null;

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toUpperCase().endsWith(".N43")) {
        setSelectedFile(file);
      } else {
        alert("Solo se permiten archivos bancarios con formato .N43");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toUpperCase().endsWith(".N43")) {
        setSelectedFile(file);
      } else {
        alert("Solo se permiten archivos bancarios con formato .N43");
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedCuenta) return;
    await importar(selectedFile, selectedCuenta);
  };

  const handleAccept = async (movId: string) => {
    const ok = await aceptarMatch(movId);
    if (ok) {
      onSuccess(); // Trigger page list refresh
    }
  };

  const handleReject = async (movId: string) => {
    const ok = await rechazarMatch(movId);
    if (ok) {
      onSuccess();
    }
  };

  const toggleExpand = (movId: string) => {
    setExpandedMatches(prev => ({
      ...prev,
      [movId]: !prev[movId]
    }));
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 0.85) return styles.confidenceGreen;
    if (score >= 0.70) return styles.confidenceYellow;
    return styles.confidenceOrange;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.85) return `${Math.round(score * 100)}% Muy probable`;
    if (score >= 0.70) return `${Math.round(score * 100)}% Probable`;
    return `${Math.round(score * 100)}% Revisar`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(val);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER */}
        <header className={styles.header}>
          <div className={styles.titleWrapper}>
            <div className={styles.titleIcon}>
              <FileText size={22} />
            </div>
            <h3 className={styles.title}>Importar Fichero Bancario Norma 43</h3>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        {/* CONTENT */}
        <div className={styles.content}>
          {state.error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{state.error}</div>
            </div>
          )}

          {!state.resultado ? (
            /* PASO 1: SELECCIONAR CUENTA Y SUBIR ARCHIVO */
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>1. Selecciona la Cuenta Bancaria destino</label>
                <select
                  value={selectedCuenta}
                  onChange={(e) => setSelectedCuenta(e.target.value)}
                  className={styles.select}
                  disabled={state.loading}
                >
                  <option value="" disabled>Selecciona una cuenta...</option>
                  {cuentasBancarias.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.banco} — {cuenta.iban} {cuenta.descripcion ? `(${cuenta.descripcion})` : ""}
                    </option>
                  ))}
                </select>
                {cuentasBancarias.length === 0 && (
                  <p style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem" }}>
                    No hay cuentas bancarias registradas en el sistema. Agrégalas en Ajustes.
                  </p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>2. Sube el fichero N43 emitido por tu banco</label>
                
                {selectedFile ? (
                  <div className={styles.selectedFileCard}>
                    <div className={styles.fileInfo}>
                      <div className={styles.fileIcon}>
                        <FileText size={24} />
                      </div>
                      <div>
                        <div className={styles.fileName}>{selectedFile.name}</div>
                        <div className={styles.fileSize}>
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button 
                      className={styles.removeFileBtn} 
                      onClick={() => setSelectedFile(null)}
                      disabled={state.loading}
                      title="Eliminar fichero"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div 
                    className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={onButtonClick}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".N43,.n43"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                    <Upload size={36} className={styles.uploadIcon} />
                    <span className={styles.uploadText}>
                      Arrastra tu fichero .N43 aquí o haz clic para examinar
                    </span>
                    <span className={styles.uploadSubtext}>
                      Formatos compatibles: Norma 43 (UTF-8 sin BOM)
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* PASO 2: VISUALIZAR MATCHES AUTOMÁTICOS */
            <div>
              <div className={styles.summaryContainer}>
                <div className={styles.summaryText}>
                  📄 Fichero importado: <span className={styles.summaryHighlight}>{selectedFile?.name}</span>
                  <br />
                  Se han registrado <span className={styles.summaryHighlight}>{state.resultado.movimientos_importados}</span> movimientos y se detectaron <span className={styles.summaryHighlight}>{state.resultado.matches_encontrados}</span> propuestas de conciliación.
                </div>
                <div className={styles.summaryBadge}>
                  {state.resultado.matches.length} Pendientes
                </div>
              </div>

              {state.resultado.matches.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "#64748b" }}>
                  <Check style={{ color: "#10b981", margin: "0 auto 1rem", height: "48px", width: "48px", background: "#dcfce7", padding: "0.75rem", borderRadius: "50%" }} />
                  <h4 style={{ fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>¡Sin conciliaciones pendientes!</h4>
                  <p style={{ fontSize: "0.85rem" }}>Todos los movimientos importados no tienen una propuesta automática viable. Puedes gestionarlos manualmente en la lista general de movimientos.</p>
                </div>
              ) : (
                <div className={styles.matchesList}>
                  {state.resultado.matches.map((match: any) => {
                    const isExpanded = !!expandedMatches[match.movimiento_id];
                    return (
                      <div key={match.movimiento_id} className={styles.matchCard}>
                        {/* MAIN INFO BAR */}
                        <div className={styles.matchMain}>
                          <div className={styles.matchInfo}>
                            <div className={styles.txnConcept}>{match.concepto}</div>
                            <div className={styles.proposalWrapper}>
                              <span className={styles.pagerName}>👉 {match.pagador_nombre}</span>
                              <span>•</span>
                              <span className={`${styles.confidenceBadge} ${getScoreColorClass(match.score)}`}>
                                {getScoreLabel(match.score)}
                              </span>
                            </div>
                          </div>

                          <div className={styles.actionContainer}>
                            <button 
                              className={styles.expandBtn} 
                              onClick={() => toggleExpand(match.movimiento_id)}
                              title={isExpanded ? "Ocultar detalles" : "Ver por qué coincide"}
                            >
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            <button 
                              className={styles.btnReject} 
                              onClick={() => handleReject(match.movimiento_id)}
                              title="Rechazar propuesta"
                            >
                              <X size={16} />
                            </button>
                            <button 
                              className={styles.btnAccept} 
                              onClick={() => handleAccept(match.movimiento_id)}
                              title="Aceptar y conciliar"
                            >
                              <Check size={16} />
                              <span>Aceptar</span>
                            </button>
                          </div>
                        </div>

                        {/* DETALLES DE SCORING (COLLAPSIBLE) */}
                        {isExpanded && (
                          <div className={styles.matchDetails}>
                            <div style={{ fontWeight: 700, color: "#475569", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                              Desglose de Puntuación (Matching Score)
                            </div>
                            <div className={styles.detailsGrid}>
                              <div className={styles.detailRow}>
                                <UserCheck size={14} className={styles.checkIcon} />
                                <span className={styles.detailLabel}>Palabras Emisor (Pool1):</span>
                                <span className={styles.detailVal}>
                                  {match.detalles?.pool1_coincidencias || 0} coincidencias (50%)
                                </span>
                              </div>
                              <div className={styles.detailRow}>
                                <TrendingUp size={14} className={styles.checkIcon} />
                                <span className={styles.detailLabel}>Palabras Concepto (Pool2):</span>
                                <span className={styles.detailVal}>
                                  {match.detalles?.pool2_coincidencias > 0 ? "Coincide Expediente (20%)" : "Sin coincidencia (0%)"}
                                </span>
                              </div>
                              <div className={styles.detailRow}>
                                <Clock size={14} className={match.detalles?.fecha_plazo_cercana ? styles.checkIcon : styles.xIcon} />
                                <span className={styles.detailLabel}>Plazo Próximo (±5 días):</span>
                                <span className={styles.detailVal}>
                                  {match.detalles?.fecha_plazo_cercana ? "Sí (+15%)" : "No (0%)"}
                                </span>
                              </div>
                              <div className={styles.detailRow}>
                                <DollarSign size={14} className={match.detalles?.importe_cercano ? styles.checkIcon : styles.xIcon} />
                                <span className={styles.detailLabel}>Importe Cercano (±10%):</span>
                                <span className={styles.detailVal}>
                                  {match.detalles?.importe_cercano ? "Sí (+15%)" : "No (0%)"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className={styles.footer}>
          {!state.resultado ? (
            <>
              <button 
                className={styles.btnSecondary} 
                onClick={onClose}
                disabled={state.loading}
              >
                Cancelar
              </button>
              <button 
                className={styles.btnPrimary} 
                onClick={handleImport}
                disabled={state.loading || !selectedFile || !selectedCuenta}
              >
                {state.loading ? (
                  <>
                    <span className="spinner" style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "0.375rem" }} />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>Importar Fichero</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button 
              className={styles.btnPrimary} 
              onClick={onClose}
            >
              Finalizar
            </button>
          )}
        </footer>

        {/* Spinner animation styles */}
        <style jsx global>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
