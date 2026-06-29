"use client";

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { Icons } from "@/lib/icons";
import { createGroupedExpedienteServicio } from "@/actions/servicios";

interface ImportarPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  serviceTypes: any[];
  onImportSuccess: () => void;
}

export default function ImportarPdfModal({
  isOpen,
  onClose,
  expedienteId,
  serviceTypes,
  onImportSuccess,
}: ImportarPdfModalProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfResult, setPdfResult] = useState<any | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [importingPdf, setImportingPdf] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPdfFile(null);
      setPdfDragOver(false);
      setPdfProcessing(false);
      setPdfResult(null);
      setPdfError(null);
      setImportingPdf(false);
    }
  }, [isOpen]);

  const handleImportPdfServices = async () => {
    if (!pdfResult || !pdfResult.lineas || pdfResult.lineas.length === 0) return;
    setImportingPdf(true);
    try {
      const lineas = pdfResult.lineas;
      const first = lineas[0];
      const cabecera = pdfResult.cabecera;

      const totalVal = cabecera?.total_documento || lineas.reduce((s: number, l: any) => s + Number(l.total_linea || 0), 0);
      const netoVal = cabecera?.total_base || lineas.reduce((s: number, l: any) => s + Number(l.base_imponible || 0), 0);

      await createGroupedExpedienteServicio({
        expediente_id: expedienteId,
        tipo: first.tipo_servicio_id || serviceTypes[0]?.id || "be9c789c-fd3d-46ab-847c-65ef1ff454f0",
        proveedor: cabecera?.proveedor_nombre || "",
        descripcion: `Doc. ${cabecera?.documento_numero || "Factura"} - ${cabecera?.proveedor_nombre || "Proveedor"}`,
        neto: Number(netoVal),
        pvp: Number(totalVal),
        total: Number(totalVal),
        opcional: false,
        condiciones: [],
        documento_id: pdfResult.documento_id,
        origenes: lineas.map((l: any) => ({
          cotizacion_linea_id: null,
          tipo: l.tipo_servicio_id || serviceTypes[0]?.id || "be9c789c-fd3d-46ab-847c-65ef1ff454f0",
          descripcion: l.pasajero ? `${l.concepto} (Pasajero: ${l.pasajero})` : l.concepto,
          neto: Number(l.base_imponible || 0),
          pvp: Number(l.total_linea || 0),
        })),
      });

      onImportSuccess();
      onClose();
    } catch (err: any) {
      alert("Error al importar servicios desde el PDF: " + err.message);
    } finally {
      setImportingPdf(false);
    }
  };

  const handleCancel = () => {
    if (!pdfProcessing && !importingPdf) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.4)",
      backdropFilter: "blur(8px)",
      zIndex: 2000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem"
    }} onClick={handleCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: pdfResult ? "640px" : "480px",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
          overflow: "hidden",
          transition: "max-width 0.2s"
        }}
      >
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid #f1f5f9",
          backgroundColor: "#f8fafc"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#475569" }}>
            <FileText size={16} />
            <h2 style={{ fontSize: "1.05rem", fontWeight: "600", margin: 0 }}>
              {pdfResult ? "Resultado de la extracción" : "Importar documento PDF"}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            disabled={pdfProcessing}
            style={{
              background: "none",
              border: "none",
              cursor: pdfProcessing ? "not-allowed" : "pointer",
              color: "#64748b",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: pdfProcessing ? 0.4 : 1
            }}
          >
            <Icons.Close size={16} />
          </button>
        </header>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>

          {/* ERROR */}
          {pdfError && (
            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.875rem 1rem", fontSize: "0.82rem", color: "#b91c1c", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1rem" }}>⚠️</span>
              <span>{pdfError}</span>
            </div>
          )}

          {/* PROCESSING */}
          {pdfProcessing && (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{ width: "40px", height: "40px", border: "3px solid #e2e8f0", borderTopColor: "var(--primary-color, #475569)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
              <p style={{ fontSize: "0.9rem", fontWeight: "600", color: "#334155", margin: "0 0 0.25rem" }}>Procesando con IA...</p>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: 0 }}>Esto puede tardar unos segundos</p>
            </div>
          )}

          {/* RESULTADO */}
          {!pdfProcessing && pdfResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Cabecera extraída */}
              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.5rem", padding: "0.875rem 1rem" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: "700", color: "#15803d", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 0.5rem" }}>✓ Extracción completada</p>
                <p style={{ fontSize: "0.82rem", color: "#166534", margin: "0 0 0.2rem" }}>
                  <strong>{pdfResult.cabecera?.documento_tipo}</strong> · {pdfResult.cabecera?.documento_numero ?? "Sin número"}
                </p>
                <p style={{ fontSize: "0.78rem", color: "#166534", margin: 0 }}>
                  {pdfResult.cabecera?.proveedor_nombre} · Total: {pdfResult.cabecera?.total_documento?.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                </p>
                <p style={{ fontSize: "0.72rem", color: "#16a34a", margin: "0.35rem 0 0", opacity: 0.7 }}>
                  {pdfResult.tokens?.input?.toLocaleString()} tokens entrada / {pdfResult.tokens?.output?.toLocaleString()} tokens salida · ${pdfResult.tokens?.coste_usd?.toFixed(4)} USD
                </p>
              </div>

              {/* Líneas extraídas */}
              <p style={{ fontSize: "0.78rem", fontWeight: "600", color: "#475569", margin: 0 }}>
                {pdfResult.lineas?.length ?? 0} líneas extraídas:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "280px", overflowY: "auto" }}>
                {pdfResult.lineas?.map((linea: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.6rem 0.75rem", backgroundColor: "#f8fafc", borderRadius: "0.375rem", border: "1px solid #e2e8f0", fontSize: "0.78rem" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 0.15rem", fontWeight: "600", color: "#1e293b" }}>{linea.concepto}</p>
                      {linea.pasajero && (
                        <p style={{ margin: "0 0 0.15rem", color: "#64748b", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <span style={{ opacity: 0.7 }}>👤</span> {linea.pasajero}
                        </p>
                      )}
                      <p style={{ margin: 0, color: "#64748b", fontSize: "0.72rem" }}>{linea.tipo_servicio_etiqueta}</p>
                    </div>
                    <span style={{ fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", marginLeft: "1rem" }}>
                      {linea.total_linea?.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ZONA DROP / selección */}
          {!pdfProcessing && !pdfResult && (
            <>
              <div
                style={{
                  border: `2px dashed ${pdfDragOver ? "var(--primary-color, #475569)" : pdfFile ? "#22c55e" : "#cbd5e1"}`,
                  borderRadius: "0.5rem",
                  padding: "2.5rem 1.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                  backgroundColor: pdfDragOver ? "#f8fafc" : "transparent"
                }}
                onDragOver={(e) => { e.preventDefault(); setPdfDragOver(true); }}
                onDragLeave={() => setPdfDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setPdfDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.type === "application/pdf") { setPdfFile(f); setPdfError(null); }
                  else { setPdfError("Solo se admiten archivos PDF."); }
                }}
                onClick={() => document.getElementById("pdf-file-input")?.click()}
              >
                <FileText size={36} style={{ color: pdfFile ? "#22c55e" : "#94a3b8", marginBottom: "0.75rem" }} />
                <p style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155", margin: "0 0 0.25rem" }}>
                  {pdfFile ? pdfFile.name : "Selecciona un archivo PDF"}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
                  {pdfFile ? `${(pdfFile.size / 1024).toFixed(0)} KB · Haz clic para cambiar` : "Arrastra aquí o haz clic para buscar"}
                </p>
              </div>
              <input
                id="pdf-file-input"
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setPdfFile(f); setPdfError(null); }
                }}
              />
            </>
          )}
        </div>

        <footer style={{
          padding: "1rem 1.5rem",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.5rem",
          backgroundColor: "#f8fafc"
        }}>
          <button
            onClick={handleCancel}
            disabled={pdfProcessing || importingPdf}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              fontSize: "0.8rem",
              fontWeight: "600",
              color: "#334155",
              cursor: pdfProcessing || importingPdf ? "not-allowed" : "pointer",
              opacity: pdfProcessing || importingPdf ? 0.5 : 1
            }}
          >
            Cancelar
          </button>

          {/* Botón Importar */}
          {pdfResult && (
            <button
              disabled={importingPdf}
              onClick={handleImportPdfServices}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: importingPdf ? "wait" : "pointer",
                backgroundColor: "#6366f1",
                color: "#ffffff",
                opacity: importingPdf ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
            >
              {importingPdf ? "Importando..." : "Importar al expediente"}
            </button>
          )}

          {/* Botón Procesar */}
          {!pdfResult && (
            <button
              disabled={!pdfFile || pdfProcessing}
              onClick={async () => {
                if (!pdfFile) return;
                setPdfProcessing(true);
                setPdfError(null);
                try {
                  const formData = new FormData();
                  formData.append("pdf", pdfFile);
                  const res = await fetch("/api/documentos/procesar", {
                    method: "POST",
                    body: formData
                  });
                  const json = await res.json();
                  if (!res.ok) {
                    setPdfError(json.mensaje ?? "Error al procesar el documento.");
                  } else {
                    setPdfResult(json);
                  }
                } catch (err: any) {
                  setPdfError(err.message ?? "Error de red al procesar el documento.");
                } finally {
                  setPdfProcessing(false);
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: !pdfFile || pdfProcessing ? "not-allowed" : "pointer",
                backgroundColor: "var(--primary-color, #475569)",
                color: "#ffffff",
                opacity: !pdfFile || pdfProcessing ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
            >
              {pdfProcessing ? "Procesando..." : "Procesar con IA"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
