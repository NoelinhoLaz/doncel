"use client";

import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { getOptionalServicesFromLinkedQuote, importOptionalServicesToExpediente } from "@/actions/servicios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  onSuccess: () => void;
}

export default function ImportarServiciosModal({ isOpen, onClose, expedienteId, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [servicios, setServicios] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(true);
      setSelectedIds(new Set());
      getOptionalServicesFromLinkedQuote(expedienteId)
        .then((data) => {
          setServicios(data || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError("Error al cargar los servicios de la cotización");
          setLoading(false);
        });
    }
  }, [isOpen, expedienteId]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    try {
      setImporting(true);
      setError(null);
      const res = await importOptionalServicesToExpediente(expedienteId, Array.from(selectedIds));
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || "Error al importar servicios");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al importar servicios");
    } finally {
      setImporting(false);
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
      backgroundColor: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "1rem"
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: "12px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        width: "100%",
        maxWidth: "500px",
        display: "flex",
        flexDirection: "column",
        maxHeight: "85vh"
      }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <LucideIcons.Download size={18} style={{ color: "var(--primary-color, #475569)" }} />
            Importar Servicios de Cotización
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <LucideIcons.X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {error && (
            <div style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fee2e2",
              color: "#b91c1c",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              fontSize: "0.85rem"
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 0", gap: "0.75rem", color: "#64748b" }}>
              <LucideIcons.Loader className="animate-spin" size={24} />
              <span style={{ fontSize: "0.85rem" }}>Cargando servicios de cotización...</span>
            </div>
          ) : servicios.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 0", gap: "0.75rem", textAlign: "center", color: "#64748b" }}>
              <LucideIcons.PackagePlus size={32} style={{ color: "#94a3b8" }} />
              <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#475569", margin: 0 }}>No hay servicios opcionales</h4>
              <p style={{ fontSize: "0.8rem", margin: 0, maxWidth: "300px" }}>
                No se encontraron servicios marcados como opcionales en las cotizaciones vinculadas a este expediente.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
                Selecciona los servicios opcionales que deseas añadir a este expediente:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {servicios.map((s: any) => (
                  <div
                    key={s.id}
                    onClick={() => handleToggleSelect(s.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: selectedIds.has(s.id) ? "1px solid var(--primary-color, #475569)" : "1px solid #e2e8f0",
                      backgroundColor: selectedIds.has(s.id) ? "rgba(71, 85, 105, 0.04)" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => {}} // Controlled by wrapper click
                      style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--primary-color, #475569)" }}
                    />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>{s.descripcion}</span>
                      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Origen: {s.cotizacion_titulo}</span>
                    </div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                      {parseFloat(s.pvp) > 0 ? `${parseFloat(s.pvp).toFixed(2)} €` : "Gratis"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "1rem 1.5rem",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem"
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || importing}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "6px",
              border: "none",
              background: selectedIds.size === 0 ? "#cbd5e1" : "var(--primary-color, #475569)",
              color: "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: selectedIds.size === 0 ? "not-allowed" : "pointer"
            }}
          >
            {importing ? "Importando..." : `Importar (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
