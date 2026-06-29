"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, X, ChevronDown } from "lucide-react";
import { Icons } from "@/lib/icons";
import { getAllCotizaciones, getCotizacionLineasToCopy } from "@/actions/cotizaciones";
import { createGroupedExpedienteServicio } from "@/actions/servicios";

interface ImportarCotizacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  onImportSuccess: () => void;
}

export default function ImportarCotizacionModal({
  isOpen,
  onClose,
  expedienteId,
  onImportSuccess,
}: ImportarCotizacionModalProps) {
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [cotizacionesOpen, setCotizacionesOpen] = useState(false);
  const [cotizacionesSearch, setCotizacionesSearch] = useState("");
  const [selectedCotizacion, setSelectedCotizacion] = useState<any | null>(null);
  const [cotizacionLineas, setCotizacionLineas] = useState<any[]>([]);
  const [selectedLineas, setSelectedLineas] = useState<Set<string>>(new Set());
  const [lineasLoading, setLineasLoading] = useState(false);
  const [copyingLineas, setCopyingLineas] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importTotal, setImportTotal] = useState("");
  const [importCondiciones, setImportCondiciones] = useState("");

  useEffect(() => {
    if (isOpen) {
      getAllCotizaciones().then(setCotizaciones);
      setSelectedCotizacion(null);
      setCotizacionLineas([]);
      setSelectedLineas(new Set());
      setImportStep(1);
      setImportTotal("");
      setImportCondiciones("");
    }
  }, [isOpen]);

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
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "500px",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
          overflow: "hidden"
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
            <ArrowLeft size={16} style={{ transform: "rotate(180deg)" }} />
            <h2 style={{ fontSize: "1.05rem", fontWeight: "600", margin: 0 }}>
              Importar servicios de cotización
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
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <Icons.Close size={16} />
          </button>
        </header>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
          {/* Cotización selector */}
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase", marginBottom: "0.35rem", display: "block" }}>
              Seleccionar cotización
            </label>
            <div
              onClick={() => {
                if (!cotizaciones.length) getAllCotizaciones().then(setCotizaciones);
                setCotizacionesOpen(!cotizacionesOpen);
                setCotizacionesSearch("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.45rem 0.7rem",
                borderRadius: "0.375rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.8rem",
                backgroundColor: "#ffffff",
                color: selectedCotizacion ? "#0f172a" : "#94a3b8",
                cursor: "pointer",
                height: "36px",
                boxSizing: "border-box",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedCotizacion ? (selectedCotizacion.titulo || `Cotización ${selectedCotizacion.id.slice(0, 8)}`) : "Seleccionar cotización..."}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {selectedCotizacion && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCotizacion(null);
                      setCotizacionLineas([]);
                      setSelectedLineas(new Set());
                    }}
                    style={{ cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", padding: "2px", borderRadius: "50%" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <X size={12} />
                  </span>
                )}
                <ChevronDown size={14} style={{ color: "#64748b", flexShrink: 0, transform: cotizacionesOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </div>
            </div>

            {cotizacionesOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 2px)",
                left: 0,
                right: 0,
                backgroundColor: "#ffffff",
                borderRadius: "0.375rem",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                border: "1px solid #e2e8f0",
                zIndex: 999,
                overflow: "hidden",
              }}>
                <div style={{ padding: "0.3rem", borderBottom: "1px solid #f1f5f9" }}>
                  <input
                    type="text"
                    placeholder="Buscar cotización..."
                    value={cotizacionesSearch}
                    onChange={(e) => setCotizacionesSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "0.3rem 0.4rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.75rem",
                      outline: "none",
                      color: "#0f172a",
                      backgroundColor: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                  {cotizaciones
                    .filter((c: any) => (c.titulo || c.id).toLowerCase().includes(cotizacionesSearch.toLowerCase()))
                    .map((c: any) => (
                      <div
                        key={c.id}
                        onClick={(e) => {
                          if (selectedCotizacion && selectedCotizacion.id !== c.id) return;
                          e.stopPropagation();
                          if (selectedCotizacion?.id === c.id) {
                            setSelectedCotizacion(null);
                            setCotizacionLineas([]);
                            setSelectedLineas(new Set());
                          } else {
                            setSelectedCotizacion(c);
                            setLineasLoading(true);
                            setSelectedLineas(new Set());
                            getCotizacionLineasToCopy(c.id).then((lineas) => {
                              setCotizacionLineas(lineas);
                              setLineasLoading(false);
                            });
                          }
                          setCotizacionesOpen(false);
                        }}
                        style={{
                          padding: "0.4rem 0.6rem",
                          fontSize: "0.75rem",
                          cursor: selectedCotizacion && selectedCotizacion.id !== c.id ? "not-allowed" : "pointer",
                          color: selectedCotizacion && selectedCotizacion.id !== c.id ? "#cbd5e1" : selectedCotizacion?.id === c.id ? "#6366f1" : "#334155",
                          fontWeight: selectedCotizacion?.id === c.id ? "600" : "400",
                          backgroundColor: selectedCotizacion?.id === c.id ? "#eef2ff" : "transparent",
                          opacity: selectedCotizacion && selectedCotizacion.id !== c.id ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => { if (!selectedCotizacion || selectedCotizacion.id === c.id) e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                        onMouseLeave={(e) => { if (!selectedCotizacion || selectedCotizacion.id === c.id) e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        {c.titulo || `Cotización ${c.id.slice(0, 8)}`}
                      </div>
                    ))}
                  {cotizaciones.length === 0 && (
                    <div style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>
                      No hay cotizaciones disponibles
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Líneas de la cotización / Resumen */}
          {selectedCotizacion && importStep === 1 && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.375rem", overflow: "hidden" }}>
              <div style={{ padding: "0.45rem 0.6rem", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                Servicios de la cotización
              </div>
              {lineasLoading ? (
                <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Cargando servicios...</div>
              ) : cotizacionLineas.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Sin servicios en esta cotización</div>
              ) : (
                <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                  {cotizacionLineas.map((linea: any) => {
                    const isChecked = selectedLineas.has(linea.id);
                    const anyChecked = selectedLineas.size > 0;
                    const firstChecked = cotizacionLineas.find((l: any) => selectedLineas.has(l.id));
                    const activeProvider = firstChecked?.proveedor || null;
                    const isDisabled = anyChecked && linea.proveedor && activeProvider && linea.proveedor !== activeProvider;
                    return (
                      <label
                        key={linea.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.4rem 0.6rem",
                          cursor: isDisabled ? "not-allowed" : "pointer",
                          fontSize: "0.78rem",
                          backgroundColor: isChecked ? "#eef2ff" : "transparent",
                          borderBottom: "1px solid #f8fafc",
                          opacity: isDisabled ? 0.4 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => {
                            if (isDisabled) return;
                            const next = new Set(selectedLineas);
                            if (isChecked) next.delete(linea.id); else next.add(linea.id);
                            setSelectedLineas(next);
                          }}
                          style={{ accentColor: "#6366f1" }}
                        />
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={{ fontWeight: 500, color: isDisabled ? "#cbd5e1" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {linea.descripcion}
                          </div>
                          <div style={{ color: isDisabled ? "#cbd5e1" : "#64748b", fontSize: "0.7rem" }}>
                            {linea.proveedor_nombre || linea.proveedor || "Sin proveedor"}
                          </div>
                        </div>
                        <span style={{ color: isDisabled ? "#cbd5e1" : "#475569", fontWeight: 600, whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                          {Number(linea.pvp || 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selectedCotizacion && importStep === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.375rem", overflow: "hidden" }}>
                <div style={{ padding: "0.45rem 0.6rem", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                  Servicios a agrupar ({selectedLineas.size})
                </div>
                <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                  {cotizacionLineas.filter((l: any) => selectedLineas.has(l.id)).map((linea: any) => (
                    <div key={linea.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0.6rem", fontSize: "0.72rem", borderBottom: "1px solid #f8fafc" }}>
                      <span style={{ color: "#334155" }}>{linea.descripcion}</span>
                      <span style={{ color: "#475569", fontWeight: 600 }}>{Number(linea.pvp || 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: "600", color: "#475569" }}>Importe total</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "0.8rem", color: "#64748b" }}>€</span>
                  <input
                    type="number"
                    step="0.01"
                    value={importTotal}
                    onChange={(e) => setImportTotal(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.75rem 0.45rem 1.75rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                      outline: "none",
                      color: "#0f172a",
                      fontWeight: 600,
                      backgroundColor: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: "600", color: "#475569" }}>Condiciones / Forma de pago</label>
                <input
                  type="text"
                  placeholder="Ej: Pago único a 30 días, transferencia..."
                  value={importCondiciones}
                  onChange={(e) => setImportCondiciones(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.8rem",
                    outline: "none",
                    color: "#0f172a",
                    backgroundColor: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          )}

          {selectedCotizacion && selectedLineas.size > 0 && importStep === 1 && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  const totalSum = cotizacionLineas
                    .filter((l: any) => selectedLineas.has(l.id))
                    .reduce((s: number, l: any) => s + Number(l.pvp || 0), 0);
                  setImportTotal(totalSum.toFixed(2));
                  setImportStep(2);
                }}
                style={{
                  padding: "0.45rem 1rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: "#6366f1",
                  color: "#ffffff",
                }}
              >
                Continuar ({selectedLineas.size} servicio{selectedLineas.size > 1 ? "s" : ""})
              </button>
            </div>
          )}
        </div>

        {selectedCotizacion && selectedLineas.size > 0 && importStep === 2 && (
          <footer style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            backgroundColor: "#f8fafc"
          }}>
            <button
              type="button"
              onClick={() => setImportStep(1)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "0.8rem",
                fontWeight: "600",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Volver
            </button>
            <button
              type="button"
              onClick={async () => {
                setCopyingLineas(true);
                try {
                  const selected = cotizacionLineas.filter((l: any) => selectedLineas.has(l.id));
                  const first = selected[0];
                  const totalVal = parseFloat(importTotal) || selected.reduce((s: number, l: any) => s + Number(l.pvp || 0), 0);
                  const condiciones = importCondiciones.trim() ? [{ forma_pago: importCondiciones.trim() }] : [];
                  await createGroupedExpedienteServicio({
                    expediente_id: expedienteId,
                    tipo: first.tipo || "transporte",
                    proveedor: first.proveedor_nombre || first.proveedor || "",
                    descripcion: `${selected.length} servicio${selected.length > 1 ? "s" : ""} de ${first.proveedor_nombre || first.proveedor || "proveedor"}`,
                    neto: selected.reduce((s: number, l: any) => s + Number(l.neto || 0), 0),
                    pvp: totalVal,
                    total: totalVal,
                    opcional: false,
                    condiciones,
                    origenes: selected.map((l: any) => ({
                      cotizacion_linea_id: l.id,
                      tipo: l.tipo || "transporte",
                      descripcion: l.descripcion || "",
                      neto: Number(l.neto || 0),
                      pvp: Number(l.pvp || 0),
                    })),
                  });
                  onImportSuccess();
                  onClose();
                } catch (err: any) {
                  alert("Error al importar servicios: " + err.message);
                } finally {
                  setCopyingLineas(false);
                }
              }}
              disabled={copyingLineas}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: copyingLineas ? "wait" : "pointer",
                backgroundColor: "#6366f1",
                color: "#ffffff",
              }}
            >
              {copyingLineas ? "Guardando..." : "Confirmar importación"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
