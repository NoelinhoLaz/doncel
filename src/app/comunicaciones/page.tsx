"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getComunicacionesByEntity } from "@/actions/comunicaciones";
import { ComunicacionesTabla } from "@/app/expedientes/[id]/components/ComunicacionesTabla";
import { ComunicacionDB } from "@/app/expedientes/[id]/components/comunicaciones.types";
import NuevaComunicacionModal from "@/app/expedientes/[id]/components/NuevaComunicacionModal";
import { Icons } from "@/lib/icons";
import { Plus, ChevronLeft } from "lucide-react";
import listStyles from "@/app/expedientes/page.module.css";
import ExpedienteActionsToolbar from "@/app/components/ExpedienteActionsToolbar";

const CANAL_LABELS: Record<string, string> = {
  email: "Email", whatsapp: "WhatsApp", nota: "Nota",
};

export default function ComunicacionesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const expedienteId  = searchParams.get("expediente_id");
  const cotizacionId  = searchParams.get("cotizacion_id");
  const propuestaId   = searchParams.get("propuesta_id");
  const presupuestoId = searchParams.get("presupuesto_id");
  const backUrl       = searchParams.get("back") || null;

  const [comunicaciones, setComunicaciones] = useState<ComunicacionDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterCanal, setFilterCanal] = useState<string>("todos");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getComunicacionesByEntity({ expedienteId, cotizacionId, propuestaId, presupuestoId });
    if (res.success) setComunicaciones(res.data as ComunicacionDB[]);
    setLoading(false);
  }, [expedienteId, cotizacionId, propuestaId, presupuestoId]);

  useEffect(() => { load(); }, [load]);

  const hasFilter = expedienteId || cotizacionId || propuestaId || presupuestoId;

  const filtered = filterCanal === "todos"
    ? comunicaciones
    : comunicaciones.filter(c => c.canal === filterCanal);

  const contextLabel = (() => {
    if (expedienteId) return `Expediente`;
    if (cotizacionId) return `Cotización`;
    if (propuestaId)  return `Propuesta`;
    if (presupuestoId) return `Presupuesto`;
    return "Todas las comunicaciones";
  })();

  return (
    <div className={listStyles.container}>
      {/* Header */}
      <header className={listStyles.header} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {backUrl && (
              <button
                onClick={() => router.push(backUrl)}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "none", border: "none", cursor: "pointer", color: "var(--primary-color, #475569)", fontSize: "0.82rem", fontWeight: 500 }}
              >
                <ChevronLeft size={16} />
                Volver
              </button>
            )}
            <Icons.Mensajes size={20} style={{ color: "var(--primary-color, #475569)" }} />
            <h1 className={listStyles.title} style={{ margin: 0 }}>Comunicaciones</h1>
            {hasFilter && (
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", background: "#f1f5f9", borderRadius: "99px", padding: "0.2rem 0.65rem" }}>
                {contextLabel}
              </span>
            )}
          </div>
          <ExpedienteActionsToolbar
            expedienteId={expedienteId || undefined}
            cotizacionId={cotizacionId || undefined}
            propuestaId={propuestaId || undefined}
            presupuestoId={presupuestoId || undefined}
          />
        </div>
      </header>

      {/* Filtros canal */}
      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0 0.5rem" }}>
        {["todos", "email", "whatsapp", "nota"].map(c => (
          <button
            key={c}
            onClick={() => setFilterCanal(c)}
            style={{
              padding: "0.3rem 0.85rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", border: "1.5px solid",
              borderColor: filterCanal === c ? "var(--primary-color, #475569)" : "#e2e8f0",
              background: filterCanal === c ? "var(--primary-color, #475569)" : "#fff",
              color: filterCanal === c ? "#fff" : "#64748b",
            }}
          >
            {c === "todos" ? "Todos" : CANAL_LABELS[c] ?? c}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "#94a3b8", alignSelf: "center" }}>
          {filtered.length} comunicación{filtered.length !== 1 ? "es" : ""}
        </span>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.85rem", borderRadius: "99px", border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
        >
          <Plus size={13} /> Nueva
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: "#fff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Cargando comunicaciones...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            <Icons.Mensajes size={32} style={{ opacity: 0.3, marginBottom: "0.75rem", display: "block", margin: "0 auto 0.75rem" }} />
            <div style={{ fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Sin comunicaciones</div>
            <div style={{ fontSize: "0.82rem" }}>Registra emails, WhatsApp o notas con el botón superior.</div>
          </div>
        ) : (
          <ComunicacionesTabla items={filtered} />
        )}
      </div>

      {/* Modal nueva comunicación */}
      {showModal && (
        <NuevaComunicacionModal
          expedienteId={expedienteId || undefined}
          cotizacionId={cotizacionId || undefined}
          propuestaId={propuestaId || undefined}
          presupuestoId={presupuestoId || undefined}
          onClose={() => setShowModal(false)}
          onSent={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
