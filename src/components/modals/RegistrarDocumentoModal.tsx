"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { FileText, Plus, Trash2, Loader2, ArrowLeft, Sparkles, PenLine } from "lucide-react";
import { crearDocumentoManual, procesarDocumentoPago, vincularDocumentoAPagos, getPagosDelExpedienteParaAsignar, buscarProveedorPorNombre } from "@/actions/documentosPago";

interface RegistrarDocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  onSuccess: () => void;
}

type Step = "modo" | "manual" | "automatico" | "resultadoAutomatico";

const DOC_TIPOS = ["FACTURA", "PROFORMA", "BORDERO_SEGUROS", "ALBARAN"] as const;

export default function RegistrarDocumentoModal({ isOpen, onClose, expedienteId, onSuccess }: RegistrarDocumentoModalProps) {
  const [step, setStep] = useState<Step>("modo");
  const [pagos, setPagos] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [documentoTipo, setDocumentoTipo] = useState<typeof DOC_TIPOS[number]>("FACTURA");
  const [documentoNumero, setDocumentoNumero] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [lineas, setLineas] = useState<{ concepto: string; total_linea: string }[]>([{ concepto: "", total_linea: "" }]);
  const [movimientosSeleccionados, setMovimientosSeleccionados] = useState<Set<string>>(new Set());

  // Automático
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [pdfResult, setPdfResult] = useState<any | null>(null);
  const [proveedorEncontrado, setProveedorEncontrado] = useState<any | null>(null);
  const [buscandoProveedor, setBuscandoProveedor] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep("modo");
      setError(null);
      setProveedorNombre("");
      setDocumentoTipo("FACTURA");
      setDocumentoNumero("");
      setFechaEmision("");
      setLineas([{ concepto: "", total_linea: "" }]);
      setMovimientosSeleccionados(new Set());
      setPdfFile(null);
      setPdfResult(null);
      setProveedorEncontrado(null);
    } else {
      getPagosDelExpedienteParaAsignar(expedienteId).then(setPagos);
    }
  }, [isOpen, expedienteId]);

  if (!isOpen) return null;

  const toggleMovimiento = (id: string) => setMovimientosSeleccionados((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const totalLineas = lineas.reduce((sum, l) => sum + (parseFloat(l.total_linea) || 0), 0);

  const handleGuardarManual = async () => {
    if (movimientosSeleccionados.size === 0) {
      setError("Selecciona al menos un pago al que asignar este documento.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await crearDocumentoManual({
        expediente_id: expedienteId,
        proveedor_nombre: proveedorNombre || null,
        documento_tipo: documentoTipo,
        documento_numero: documentoNumero || null,
        fecha_emision: fechaEmision || null,
        total_documento: totalLineas,
        movimiento_ids: Array.from(movimientosSeleccionados),
        lineas: lineas.filter((l) => l.concepto.trim()).map((l) => ({ concepto: l.concepto, total_linea: parseFloat(l.total_linea) || 0 })),
      });
      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar el documento");
    } finally {
      setSaving(false);
    }
  };

  const handleProcesarAutomatico = async () => {
    if (!pdfFile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await procesarDocumentoPago(pdfFile);
      if (!res.success) throw new Error(res.error);
      setPdfResult(res.data);
      // Preselecciona los pagos cuyo importe coincide (con tolerancia de céntimos) con el
      // total del documento extraído, para no obligar a buscarlo a mano en la lista.
      const totalDocumento = Number(res.data?.cabecera?.total_documento || 0);
      if (totalDocumento > 0) {
        const coincidentes = pagos.filter((p) => Math.abs(Number(p.importe_total) - totalDocumento) < 0.01);
        if (coincidentes.length > 0) {
          setMovimientosSeleccionados(new Set(coincidentes.map((p) => p.id)));
        }
      }
      setStep("resultadoAutomatico");

      setBuscandoProveedor(true);
      buscarProveedorPorNombre(res.data?.cabecera?.proveedor_nombre, res.data?.cabecera?.proveedor_nif)
        .then(setProveedorEncontrado)
        .finally(() => setBuscandoProveedor(false));
    } catch (err: any) {
      setError(err.message || "Error al procesar el documento");
    } finally {
      setSaving(false);
    }
  };

  const handleVincularResultado = async () => {
    if (!pdfResult) return;
    if (movimientosSeleccionados.size === 0) {
      setError("Selecciona al menos un pago al que asignar este documento.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await vincularDocumentoAPagos(pdfResult.documento_id, Array.from(movimientosSeleccionados), expedienteId);
      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al vincular el documento");
    } finally {
      setSaving(false);
    }
  };

  const renderSelectorPagos = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "180px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.5rem" }}>
      {pagos.length === 0 ? (
        <div style={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "center", padding: "0.75rem 0" }}>No hay pagos registrados en este expediente.</div>
      ) : (
        pagos.map((p) => {
          const checked = movimientosSeleccionados.has(p.id);
          return (
            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.4rem", borderRadius: "0.375rem", cursor: "pointer", backgroundColor: checked ? "#f0f9ff" : "transparent" }}>
              <input type="checkbox" checked={checked} onChange={() => toggleMovimiento(p.id)} style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.concepto || "Pago"}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{p.estado === "pendiente_conciliar" ? "Pdt. Conciliar" : p.fecha}</div>
              </div>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>{Number(p.importe_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
            </label>
          );
        })
      )}
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(12px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "560px", maxHeight: "85vh", overflowY: "auto", backgroundColor: "rgba(255, 255, 255, 0.98)", borderRadius: "1.5rem", padding: "1.5rem", boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)", border: "1px solid rgba(255, 255, 255, 0.8)" }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
        >
          <Icons.Close size={16} />
        </button>

        {step !== "modo" && step !== "resultadoAutomatico" && (
          <button
            onClick={() => setStep("modo")}
            style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", color: "#64748b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: "0.75rem" }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
        )}

        {step === "modo" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Registrar documento</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Adjunta una factura o proforma a uno o varios pagos.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button
                onClick={() => setStep("automatico")}
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
              >
                <Sparkles size={18} color="var(--primary-color, #475569)" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>Automático</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Adjunta el PDF y extrae los datos con IA</div>
                </div>
              </button>
              <button
                onClick={() => setStep("manual")}
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
              >
                <PenLine size={18} color="var(--primary-color, #475569)" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>Manual</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Introduce los datos del documento a mano</div>
                </div>
              </button>
            </div>
          </>
        )}

        {step === "manual" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 1rem 0" }}>Documento manual</h3>
            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569" }}>Proveedor</span>
                <input type="text" value={proveedorNombre} onChange={(e) => setProveedorNombre(e.target.value)} style={{ padding: "0.45rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.82rem" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569" }}>Tipo</span>
                <select value={documentoTipo} onChange={(e) => setDocumentoTipo(e.target.value as any)} style={{ padding: "0.45rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.82rem" }}>
                  {DOC_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569" }}>Número de documento</span>
                <input type="text" value={documentoNumero} onChange={(e) => setDocumentoNumero(e.target.value)} style={{ padding: "0.45rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.82rem" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569" }}>Fecha</span>
                <input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} style={{ padding: "0.45rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.82rem" }} />
              </label>
            </div>

            <div style={{ marginBottom: "0.4rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>Líneas</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>Total: {totalLineas.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem" }}>
              {lineas.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Concepto"
                    value={l.concepto}
                    onChange={(e) => setLineas((prev) => prev.map((x, j) => j === i ? { ...x, concepto: e.target.value } : x))}
                    style={{ flex: 1, padding: "0.4rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.8rem" }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Importe"
                    value={l.total_linea}
                    onChange={(e) => setLineas((prev) => prev.map((x, j) => j === i ? { ...x, total_linea: e.target.value } : x))}
                    style={{ width: "100px", padding: "0.4rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", fontSize: "0.8rem", textAlign: "right" }}
                  />
                  <button
                    type="button"
                    onClick={() => setLineas((prev) => prev.filter((_, j) => j !== i))}
                    disabled={lineas.length === 1}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: lineas.length === 1 ? "not-allowed" : "pointer", padding: "0.2rem" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLineas((prev) => [...prev, { concepto: "", total_linea: "" }])}
                style={{ display: "flex", alignItems: "center", gap: "0.3rem", alignSelf: "flex-start", fontSize: "0.75rem", color: "var(--primary-color, #475569)", background: "none", border: "1px dashed #cbd5e1", borderRadius: "0.375rem", padding: "0.35rem 0.6rem", cursor: "pointer" }}
              >
                <Plus size={13} /> Añadir línea
              </button>
            </div>

            <div style={{ marginBottom: "0.4rem" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>Asignar a pagos</span>
            </div>
            {renderSelectorPagos()}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1rem" }}>
              <button
                onClick={handleGuardarManual}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Guardar documento
              </button>
            </div>
          </>
        )}

        {step === "automatico" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 1rem 0" }}>Procesar con IA</h3>
            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div
              style={{
                border: `2px dashed ${pdfDragOver ? "var(--primary-color, #475569)" : pdfFile ? "#22c55e" : "#cbd5e1"}`,
                borderRadius: "0.5rem", padding: "1.75rem 1.5rem", textAlign: "center", cursor: "pointer",
                backgroundColor: pdfDragOver ? "#f8fafc" : "transparent", marginBottom: "0.9rem",
              }}
              onDragOver={(e) => { e.preventDefault(); setPdfDragOver(true); }}
              onDragLeave={() => setPdfDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setPdfDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f && f.type === "application/pdf") setPdfFile(f);
                else setError("Solo se admiten archivos PDF.");
              }}
              onClick={() => document.getElementById("doc-pago-pdf-input")?.click()}
            >
              <FileText size={30} style={{ color: pdfFile ? "#22c55e" : "#94a3b8", marginBottom: "0.5rem" }} />
              <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155", margin: "0 0 0.2rem" }}>{pdfFile ? pdfFile.name : "Selecciona un archivo PDF"}</p>
              <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0 }}>{pdfFile ? "Haz clic para cambiar" : "Arrastra aquí o haz clic para buscar"}</p>
            </div>
            <input id="doc-pago-pdf-input" type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1rem" }}>
              <button
                onClick={handleProcesarAutomatico}
                disabled={saving || !pdfFile}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: !pdfFile ? 0.5 : 1 }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Procesando..." : "Procesar con IA"}
              </button>
            </div>
          </>
        )}

        {step === "resultadoAutomatico" && pdfResult && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.75rem 0" }}>Resultado de la extracción</h3>
            {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

            <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.5rem", padding: "0.875rem 1rem", marginBottom: "0.9rem" }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 0.5rem" }}>✓ Extracción completada</p>
              <p style={{ fontSize: "0.82rem", color: "#166534", margin: "0 0 0.2rem" }}>
                <strong>{pdfResult.cabecera?.documento_tipo}</strong> · {pdfResult.cabecera?.documento_numero ?? "Sin número"}
              </p>
              <p style={{ fontSize: "0.78rem", color: "#166534", margin: 0 }}>
                {pdfResult.cabecera?.proveedor_nombre} · Total: {Number(pdfResult.cabecera?.total_documento || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </p>
              <p style={{ fontSize: "0.74rem", margin: "0.4rem 0 0" }}>
                {buscandoProveedor ? (
                  <span style={{ color: "#94a3b8" }}>Comprobando proveedor en el sistema...</span>
                ) : proveedorEncontrado ? (
                  <span style={{ color: "#15803d" }}>✓ Proveedor encontrado en el sistema: <strong>{proveedorEncontrado.nombre || proveedorEncontrado.razon_social}</strong></span>
                ) : (
                  <span style={{ color: "#b45309" }}>⚠ Proveedor no encontrado en el catálogo — puede que haya que darlo de alta</span>
                )}
              </p>
            </div>

            <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", margin: "0 0 0.4rem" }}>
              {pdfResult.lineas?.length ?? 0} líneas extraídas:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "180px", overflowY: "auto", marginBottom: "0.9rem" }}>
              {pdfResult.lineas?.map((linea: any, idx: number) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.5rem 0.65rem", backgroundColor: "#f8fafc", borderRadius: "0.375rem", border: "1px solid #e2e8f0", fontSize: "0.76rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linea.concepto}</div>
                    {linea.pasajero && <div style={{ color: "#94a3b8", fontSize: "0.7rem" }}>{linea.pasajero}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", marginLeft: "0.75rem" }}>
                    {Number(linea.total_linea || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "0.4rem" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>Asignar a pagos</span>
            </div>
            {renderSelectorPagos()}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1rem" }}>
              <button
                onClick={handleVincularResultado}
                disabled={saving || movimientosSeleccionados.size === 0}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: movimientosSeleccionados.size === 0 ? 0.5 : 1 }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Vincular a pagos seleccionados
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
