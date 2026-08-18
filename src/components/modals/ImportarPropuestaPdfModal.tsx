"use client";

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { Icons } from "@/lib/icons";
import { crearPropuestaDesdeSeccionesImportadas } from "@/actions/propuestas";

interface ImportarPropuestaPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (propuestaId: string) => void;
}

const TIPO_LABEL: Record<string, string> = {
  portada: "Portada",
  itinerario: "Itinerario",
  precio: "Precio y condiciones",
  "texto-columnas": "Texto",
};

export default function ImportarPropuestaPdfModal({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportarPropuestaPdfModalProps) {
  const esWord = (f: File) =>
    f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    f.name.toLowerCase().endsWith(".docx");
  const esPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfResult, setPdfResult] = useState<any | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPdfFile(null);
      setPdfDragOver(false);
      setPdfProcessing(false);
      setPdfResult(null);
      setPdfError(null);
      setImporting(false);
    }
  }, [isOpen]);

  const handleCrearPropuesta = async () => {
    if (!pdfResult?.secciones?.length) return;
    setImporting(true);
    try {
      const result = await crearPropuestaDesdeSeccionesImportadas(pdfResult.secciones);
      if (!result.ok || !result.id) throw new Error(result.error ?? "No se pudo crear la propuesta");
      onImportSuccess(result.id);
      onClose();
    } catch (err: any) {
      setPdfError("Error al crear la propuesta: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    if (!pdfProcessing && !importing) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(8px)",
        zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem",
      }}
      onClick={handleCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: pdfResult ? "640px" : "480px",
          backgroundColor: "#ffffff", borderRadius: "0.75rem",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          display: "flex", flexDirection: "column", maxHeight: "85vh", overflow: "hidden",
          transition: "max-width 0.2s",
        }}
      >
        <header style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#475569" }}>
            <FileText size={16} />
            <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
              {pdfResult ? "Secciones detectadas" : "Importar propuesta desde PDF o Word"}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            disabled={pdfProcessing}
            style={{
              background: "none", border: "none", cursor: pdfProcessing ? "not-allowed" : "pointer",
              color: "#64748b", borderRadius: "50%", width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: pdfProcessing ? 0.4 : 1,
            }}
          >
            <Icons.Close size={16} />
          </button>
        </header>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
          {pdfError && (
            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.875rem 1rem", fontSize: "0.82rem", color: "#b91c1c", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1rem" }}>⚠️</span>
              <span>{pdfError}</span>
            </div>
          )}

          {pdfProcessing && (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{ width: 40, height: 40, border: "3px solid #e2e8f0", borderTopColor: "var(--primary-color, #475569)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
              <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#334155", margin: "0 0 0.25rem" }}>Analizando el documento con IA...</p>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: 0 }}>Esto puede tardar unos segundos</p>
            </div>
          )}

          {!pdfProcessing && pdfResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.5rem", padding: "0.875rem 1rem" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 0.5rem" }}>
                  ✓ {pdfResult.secciones.length} secciones detectadas
                </p>
                <p style={{ fontSize: "0.72rem", color: "#16a34a", margin: 0, opacity: 0.7 }}>
                  {pdfResult.tokens?.input?.toLocaleString()} tokens entrada / {pdfResult.tokens?.output?.toLocaleString()} tokens salida · ${pdfResult.tokens?.coste_usd?.toFixed(4)} USD
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "320px", overflowY: "auto" }}>
                {pdfResult.secciones.map((s: any, idx: number) => (
                  <div key={idx} style={{ padding: "0.6rem 0.75rem", backgroundColor: "#f8fafc", borderRadius: "0.375rem", border: "1px solid #e2e8f0", fontSize: "0.78rem" }}>
                    <p style={{ margin: "0 0 0.15rem", fontWeight: 700, color: "#475569", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {TIPO_LABEL[s.tipo] ?? s.tipo}
                    </p>
                    <p style={{ margin: 0, fontWeight: 600, color: "#1e293b" }}>
                      {s.titulo || (s.tipo === "itinerario" ? `${s.dias?.length ?? 0} días` : s.tipo === "precio" ? s.pvp : "—")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!pdfProcessing && !pdfResult && (
            <>
              <div
                style={{
                  border: `2px dashed ${pdfDragOver ? "var(--primary-color, #475569)" : pdfFile ? "#22c55e" : "#cbd5e1"}`,
                  borderRadius: "0.5rem", padding: "2.5rem 1.5rem", textAlign: "center", cursor: "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                  backgroundColor: pdfDragOver ? "#f8fafc" : "transparent",
                }}
                onDragOver={e => { e.preventDefault(); setPdfDragOver(true); }}
                onDragLeave={() => setPdfDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setPdfDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && (esPdf(f) || esWord(f))) { setPdfFile(f); setPdfError(null); }
                  else { setPdfError("Solo se admiten archivos PDF o Word (.docx)."); }
                }}
                onClick={() => document.getElementById("propuesta-pdf-file-input")?.click()}
              >
                <FileText size={36} style={{ color: pdfFile ? "#22c55e" : "#94a3b8", marginBottom: "0.75rem" }} />
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155", margin: "0 0 0.25rem" }}>
                  {pdfFile ? pdfFile.name : "Selecciona una propuesta en PDF o Word"}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
                  {pdfFile ? `${(pdfFile.size / 1024).toFixed(0)} KB · Haz clic para cambiar` : "Arrastra aquí o haz clic para buscar"}
                </p>
              </div>
              <input
                id="propuesta-pdf-file-input"
                type="file"
                accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: "none" }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setPdfFile(f); setPdfError(null); }
                }}
              />
            </>
          )}
        </div>

        <footer style={{
          padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0",
          display: "flex", justifyContent: "flex-end", gap: "0.5rem", backgroundColor: "#f8fafc",
        }}>
          <button
            onClick={handleCancel}
            disabled={pdfProcessing || importing}
            style={{
              padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff", fontSize: "0.8rem", fontWeight: 600, color: "#334155",
              cursor: pdfProcessing || importing ? "not-allowed" : "pointer",
              opacity: pdfProcessing || importing ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>

          {pdfResult && (
            <button
              disabled={importing}
              onClick={handleCrearPropuesta}
              style={{
                padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none",
                fontSize: "0.8rem", fontWeight: 600, cursor: importing ? "wait" : "pointer",
                backgroundColor: "#6366f1", color: "#ffffff", opacity: importing ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: "0.35rem",
              }}
            >
              {importing ? "Creando propuesta..." : "Crear propuesta"}
            </button>
          )}

          {!pdfResult && (
            <button
              disabled={!pdfFile || pdfProcessing}
              onClick={async () => {
                if (!pdfFile) return;
                setPdfProcessing(true);
                setPdfError(null);
                try {
                  const esArchivoWord = esWord(pdfFile);
                  const formData = new FormData();
                  formData.append(esArchivoWord ? "word" : "pdf", pdfFile);
                  const endpoint = esArchivoWord ? "/api/propuestas/importar-word" : "/api/propuestas/importar-pdf";
                  const res = await fetch(endpoint, { method: "POST", body: formData });
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
                padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none",
                fontSize: "0.8rem", fontWeight: 600, cursor: !pdfFile || pdfProcessing ? "not-allowed" : "pointer",
                backgroundColor: "var(--primary-color, #475569)", color: "#ffffff",
                opacity: !pdfFile || pdfProcessing ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: "0.35rem",
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
