"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { apiFetch } from "../utils";
import styles from "../page.module.css";
import type { Campana } from "../types";

export function ConfirmarCampanaModal({
  clienteNombre,
  entidadId,
  defaultCampanaId,
  esClienteNuevo = false,
  isOwner = false,
  currentAgenteId = null,
  agentes = [],
  onClose,
  onCreated,
}: {
  clienteNombre: string;
  entidadId: string;
  defaultCampanaId?: string;
  esClienteNuevo?: boolean;
  isOwner?: boolean;
  currentAgenteId?: string | null;
  agentes?: { agente_id: string; crm_agentes: { id: string; nombre: string; apellidos: string } | null }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  // El paso "preguntar" solo aplica cuando se acaba de crear un cliente nuevo
  // (confirma si además de crearlo se quiere añadir a una campaña ahora mismo).
  // Si el cliente ya existía, se va directo al formulario.
  const [step, setStep] = useState<"preguntar" | "form">(esClienteNuevo ? "preguntar" : "form");
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [campanaId, setCampanaId] = useState(defaultCampanaId ?? "");
  const [estadoId, setEstadoId] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [agenteId, setAgenteId] = useState(currentAgenteId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "form") return;
    apiFetch("/api/crm/campanas").then(r => {
      const data: Campana[] = r.data ?? [];
      setCampanas(data);
      const inicial = data.find(c => c.id === defaultCampanaId) ?? data[0];
      if (inicial) {
        setCampanaId(inicial.id);
        setEstadoId(inicial.crm_campanas_estados?.[0]?.id ?? "");
      }
    });
  }, [step, defaultCampanaId]);

  const campanaSeleccionada = campanas.find(c => c.id === campanaId);

  function handleCampanaChange(id: string) {
    setCampanaId(id);
    const c = campanas.find(c => c.id === id);
    setEstadoId(c?.crm_campanas_estados?.[0]?.id ?? "");
  }

  async function handleCrear() {
    if (!campanaId || !estadoId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/crm/oportunidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: clienteNombre,
          campana_id: campanaId,
          estado_id: estadoId,
          entidad_id: entidadId,
          prioridad: prioridad ? Number(prioridad) : null,
          valor_estimado: parseFloat(valorEstimado) || 0,
          // Solo un admin puede elegir agente manualmente; para un agente normal el
          // backend (createOportunidad) ignora este campo y asigna siempre al usuario actual.
          agente_id: isOwner ? (agenteId || null) : undefined,
        }),
      });
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (step === "preguntar") {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} style={{ width: 420 }} onClick={e => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <span className={styles.modalTitle}>Cliente creado</span>
            <button className={styles.btnClose} onClick={onClose}><X size={15} /></button>
          </div>
          <div className={styles.modalBody}>
            <p style={{ fontSize: "0.85rem", color: "#334155", margin: 0 }}>
              <strong>{clienteNombre}</strong> se ha creado correctamente. ¿Deseas añadirlo a una campaña?
            </p>
          </div>
          <div className={styles.modalFooter}>
            <button className={styles.btnSecondary} onClick={onClose}>No, gracias</button>
            <button className={styles.btnPrimary} onClick={() => setStep("form")}>Sí, añadir</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Añadir a campaña</span>
          <button className={styles.btnClose} onClick={onClose}><X size={15} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}>Campaña *</label>
            <select className={styles.input} value={campanaId} onChange={e => handleCampanaChange(e.target.value)}>
              {campanas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Estado inicial *</label>
            <select className={styles.input} value={estadoId} onChange={e => setEstadoId(e.target.value)}>
              {campanaSeleccionada?.crm_campanas_estados?.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          {isOwner && (
            <div className={styles.field}>
              <label className={styles.label}>Agente asignado</label>
              <select className={styles.input} value={agenteId} onChange={e => setAgenteId(e.target.value)}>
                <option value="">A mí mismo</option>
                {agentes.map(a => a.crm_agentes && (
                  <option key={a.agente_id} value={a.agente_id}>{a.crm_agentes.nombre} {a.crm_agentes.apellidos}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Prioridad</label>
              <input className={styles.input} type="number" min="1" placeholder="Ej. 1" value={prioridad} onChange={e => setPrioridad(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Valor estimado (€)</label>
              <input className={styles.input} type="number" min="0" placeholder="0" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} />
            </div>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleCrear} disabled={saving || !campanaId || !estadoId}>
            {saving ? "Guardando…" : "Añadir a campaña"}
          </button>
        </div>
      </div>
    </div>
  );
}
