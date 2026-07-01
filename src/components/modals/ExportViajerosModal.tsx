"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { AlertTriangle, Lock, Download, Loader2 } from "lucide-react";
import { getViajerosByExpediente } from "@/actions/viajeros";
import { getExpedienteServicios } from "@/actions/servicios";

interface ExportViajerosModalProps {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  selectedService?: any | null;
}

export default function ExportViajerosModal({
  isOpen,
  onClose,
  expedienteId,
  selectedService,
}: ExportViajerosModalProps) {
  const [loadingData, setLoadingData] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [viajeros, setViajeros] = useState<any[]>([]);
  const [clave, setClave] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "nombre",
    "dni",
    "fecha_nacimiento",
  ]);
  const [formato, setFormato] = useState<"xlsx" | "csv">("xlsx");
  const [errorMessage, setErrorMessage] = useState("");

  const isHealthSelected = selectedColumns.includes("alergias");
  const canExport = !isHealthSelected || clave.trim().length > 0;

  useEffect(() => {
    if (isOpen) {
      setLoadingData(true);
      setErrorMessage("");
      
      Promise.all([
        getViajerosByExpediente(expedienteId),
        getExpedienteServicios(expedienteId),
      ])
        .then(([viajerosData, servicesData]) => {
          setViajeros(viajerosData || []);

          // Pre-fill key/locator
          let prefilledKey = "";
          if (selectedService) {
            const cond = selectedService.condiciones || {};
            prefilledKey =
              selectedService.codigo_reserva_proveedor ||
              cond.codigo_reserva_proveedor ||
              selectedService.localizador ||
              cond.localizador ||
              "";
          } else {
            // Find first accommodation service
            const acc = (servicesData || []).find((s: any) => {
              const label = s.config_tipos_servicios?.etiqueta || s.tipo || "";
              return (
                label.toLowerCase().includes("alojamiento") ||
                s.descripcion?.toLowerCase().includes("hotel") ||
                s.descripcion?.toLowerCase().includes("alojamiento")
              );
            });
            if (acc) {
              const cond = acc.condiciones || {};
              prefilledKey =
                acc.codigo_reserva_proveedor ||
                cond.codigo_reserva_proveedor ||
                acc.localizador ||
                cond.localizador ||
                "";
            }
          }
          setClave(prefilledKey);
        })
        .catch((err) => {
          console.error("Error loading data for export modal:", err);
          setErrorMessage("Error al cargar los datos del expediente.");
        })
        .finally(() => {
          setLoadingData(false);
        });
    }
  }, [isOpen, expedienteId, selectedService]);

  if (!isOpen) return null;

  const handleToggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canExport || viajeros.length === 0 || exporting) return;

    setExporting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/viajeros/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viajeroIds: viajeros.map((v) => v.id),
          columnas: selectedColumns,
          clave: isHealthSelected ? clave : "",
          formato,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al generar la exportación");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      
      const filename = formato === "xlsx"
        ? (isHealthSelected ? "listado_viajeros_protegido.xlsx" : "listado_viajeros.xlsx")
        : (isHealthSelected ? "listado_viajeros_protegido.zip" : "listado_viajeros.csv");
        
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      onClose();
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorMessage(err.message || "Error al realizar la exportación.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(8px)",
        zIndex: 2100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #f1f5f9",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary-color, #475569)" }}>
            <Download size={18} />
            <h2 style={{ fontSize: "1.05rem", fontWeight: "600", margin: 0 }}>
              Exportar Listado de Viajeros
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Icons.Close size={16} />
          </button>
        </header>

        {loadingData ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "0.75rem" }}>
            <Loader2 size={32} className="animate-spin animate-infinite" style={{ color: "var(--primary-color, #475569)" }} />
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Cargando datos del expediente...</span>
          </div>
        ) : (
          <form onSubmit={handleExport} style={{ display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1.25rem" }}>
            {errorMessage && (
              <div style={{ padding: "0.75rem", borderRadius: "0.5rem", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Column selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Columnas a Incluir
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[
                  { id: "nombre", label: "Nombre completo" },
                  { id: "dni", label: "DNI / Documento" },
                  { id: "fecha_nacimiento", label: "Fecha Nacimiento" },
                  { id: "alergias", label: "Alergias / Regímenes (Salud)" },
                ].map((col) => {
                  const isChecked = selectedColumns.includes(col.id);
                  return (
                    <label
                      key={col.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.375rem",
                        border: "1px solid #e2e8f0",
                        backgroundColor: isChecked ? "#f8fafc" : "#ffffff",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: isChecked ? "600" : "normal",
                        transition: "all 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleColumn(col.id)}
                        style={{ accentColor: "var(--primary-color, #475569)" }}
                      />
                      <span style={{ color: isChecked ? "#0f172a" : "#475569" }}>{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Format selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Formato de Salida
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", backgroundColor: "#f8fafc", padding: "0.25rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
                {(["xlsx", "csv"] as const).map((fmt) => {
                  const isActive = formato === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormato(fmt)}
                      style={{
                        padding: "0.45rem",
                        border: "none",
                        borderRadius: "0.375rem",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        backgroundColor: isActive ? "#ffffff" : "transparent",
                        color: isActive ? "var(--primary-color, #475569)" : "#64748b",
                        boxShadow: isActive ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)" : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      {fmt === "xlsx" ? "Microsoft Excel (.xlsx)" : "Valores Separados (.csv)"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Security trigger and key */}
            {isHealthSelected && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem", borderRadius: "0.5rem", backgroundColor: "color-mix(in srgb, var(--primary-color, #475569) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--primary-color, #475569) 15%, transparent)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", color: "#b45309", marginBottom: "0.5rem" }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "0.72rem", lineHeight: 1.4, fontWeight: "600" }}>
                    Cumplimiento RGPD/LOPD: Los datos de salud (alergias/regímenes) se exportarán cifrados.
                    Se requiere el localizador como contraseña.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>
                    Clave de cifrado para el Hotel (Localizador) *
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Lock size={14} style={{ position: "absolute", left: "10px", color: "#94a3b8" }} />
                    <input
                      type="text"
                      placeholder="Introduzca el localizador (ej. PC8G9T)"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.45rem 0.5rem 0.45rem 2rem",
                        borderRadius: "0.375rem",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.8rem",
                        outline: "none",
                        backgroundColor: "#ffffff",
                        color: "#0f172a",
                      }}
                      required
                    />
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                    {formato === "xlsx" 
                      ? "El archivo Excel solicitará esta contraseña nativamente al abrirse."
                      : "Se descargará un ZIP protegido. Descomprímalo usando el localizador."}
                  </span>
                </div>
              </div>
            )}

            {/* Info notice if no travelers */}
            {viajeros.length === 0 && (
              <div style={{ padding: "0.75rem", borderRadius: "0.5rem", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", color: "#d97706", fontSize: "0.78rem", textAlign: "center" }}>
                No hay viajeros registrados en este expediente para exportar.
              </div>
            )}

            {/* Actions footer */}
            <footer
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "0.5rem",
                borderTop: "1px solid #f1f5f9",
                paddingTop: "1rem",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={exporting}
                style={{
                  padding: "0.45rem 1rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canExport || viajeros.length === 0 || exporting}
                style={{
                  padding: "0.45rem 1rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: !canExport || viajeros.length === 0 || exporting ? "not-allowed" : "pointer",
                  backgroundColor: !canExport || viajeros.length === 0 || exporting 
                    ? "#cbd5e1" 
                    : "var(--primary-color, #475569)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                {exporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Exportar</span>
                  </>
                )}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
