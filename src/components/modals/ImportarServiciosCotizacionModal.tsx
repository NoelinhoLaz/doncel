"use client";

import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { getOptionalServicesFromLinkedQuote, getNonOptionalServicesFromLinkedQuote, importOptionalServicesToExpediente, importNonOptionalServicesToExpediente } from "@/actions/servicios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  onSuccess: () => void;
}

export default function ImportarServiciosCotizacionModal({ isOpen, onClose, expedienteId, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [obligatorias, setObligatorias] = useState<any[]>([]);
  const [opcionales, setOpcionales] = useState<any[]>([]);
  const [selectedObligatoriasIds, setSelectedObligatoriasIds] = useState<Set<string>>(new Set());
  const [selectedOpcionalesIds, setSelectedOpcionalesIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(true);
      setSelectedObligatoriasIds(new Set());
      setSelectedOpcionalesIds(new Set());
      Promise.all([
        getNonOptionalServicesFromLinkedQuote(expedienteId),
        getOptionalServicesFromLinkedQuote(expedienteId),
      ])
        .then(([nonOpt, opt]) => {
          setObligatorias(nonOpt || []);
          setOpcionales(opt || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError("Error al cargar los servicios de la cotización");
          setLoading(false);
        });
    }
  }, [isOpen, expedienteId]);

  const toggleSelect = (id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalSelected = selectedObligatoriasIds.size + selectedOpcionalesIds.size;

  const handleImport = async () => {
    if (totalSelected === 0) return;
    try {
      setImporting(true);
      setError(null);
      const results = await Promise.all([
        selectedObligatoriasIds.size > 0 ? importNonOptionalServicesToExpediente(expedienteId, Array.from(selectedObligatoriasIds)) : Promise.resolve({ success: true }),
        selectedOpcionalesIds.size > 0 ? importOptionalServicesToExpediente(expedienteId, Array.from(selectedOpcionalesIds)) : Promise.resolve({ success: true }),
      ]);
      const failed = results.find((r: any) => !r.success);
      if (failed) { setError((failed as any).error || "Error al importar servicios"); return; }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al importar servicios");
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  const f = (v: number) => Number(v || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderLista = (
    lista: any[],
    selectedIds: Set<string>,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {lista.map((s: any) => {
        const isSelected = selectedIds.has(s.id);
        return (
          <div
            key={s.id}
            onClick={() => toggleSelect(s.id, setter)}
            style={{
              display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.9rem", borderRadius: "8px",
              cursor: "pointer", border: `2px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
              backgroundColor: isSelected ? "#eff6ff" : "#f8fafc", transition: "all 0.15s",
            }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `2px solid ${isSelected ? "#3b82f6" : "#cbd5e1"}`, backgroundColor: isSelected ? "#3b82f6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isSelected && <LucideIcons.Check size={11} style={{ color: "#fff" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#0f172a" }}>{s.descripcion}</div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.1rem" }}>{s.cotizacion_titulo}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>
                {parseFloat(s.pvp || 0) > 0 ? `${f(s.pvp)} €` : "Gratis"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Neto: {f(s.neto)} €</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div style={{ background: "#ffffff", borderRadius: "12px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <LucideIcons.Download size={18} style={{ color: "#475569" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Importar de cotización</h3>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>Servicios de la cotización vinculada al expediente</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.25rem", borderRadius: "6px" }}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <LucideIcons.Loader2 size={24} style={{ color: "#94a3b8" }} className="animate-spin" />
            </div>
          ) : error ? (
            <div style={{ padding: "1rem", backgroundColor: "#fef2f2", borderRadius: "8px", color: "#dc2626", fontSize: "0.85rem" }}>{error}</div>
          ) : obligatorias.length === 0 && opcionales.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b", fontSize: "0.85rem" }}>No hay servicios disponibles en la cotización vinculada.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {obligatorias.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                    SERVICIOS
                  </div>
                  {renderLista(obligatorias, selectedObligatoriasIds, setSelectedObligatoriasIds)}
                </div>
              )}
              {opcionales.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>OPCIONALES</span>
                    <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
                  </div>
                  {renderLista(opcionales, selectedOpcionalesIds, setSelectedOpcionalesIds)}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button onClick={onClose} disabled={importing} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}>Cancelar</button>
          <button onClick={handleImport} disabled={importing || totalSelected === 0} style={{ padding: "0.5rem 1.2rem", borderRadius: "8px", border: "none", background: totalSelected > 0 ? "#475569" : "#e2e8f0", color: totalSelected > 0 ? "#fff" : "#94a3b8", fontSize: "0.85rem", fontWeight: 600, cursor: totalSelected > 0 ? "pointer" : "default", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {importing && <LucideIcons.Loader2 size={14} className="animate-spin" />}
            Importar {totalSelected > 0 ? `(${totalSelected})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
