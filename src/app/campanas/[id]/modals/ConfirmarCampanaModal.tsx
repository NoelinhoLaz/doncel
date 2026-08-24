"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { apiFetch } from "../utils";
import styles from "../page.module.css";
import type { Campana } from "../types";
import { getCurrentAgentePublic, getAgentes } from "@/actions/crm";

type AgenteOption = { agente_id: string; crm_agentes: { id: string; nombre: string; apellidos: string } | null };
export type ClienteParaOportunidad = { id: string; nombre: string };

export function ConfirmarCampanaModal({
  clienteNombre,
  entidadId,
  clientes: clientesProp,
  defaultCampanaId,
  esClienteNuevo = false,
  isOwner: isOwnerProp,
  currentAgenteId: currentAgenteIdProp,
  agentes: agentesProp,
  onClose,
  onCreated,
}: {
  // Modo un-solo-cliente (uso original, ej. desde NuevoClientePanel): clienteNombre + entidadId.
  clienteNombre?: string;
  entidadId?: string;
  // Modo multi-cliente (selección desde AnadirOportunidadModal): lista de clientes,
  // se crea una oportunidad por cada uno con los mismos datos del formulario.
  clientes?: ClienteParaOportunidad[];
  defaultCampanaId?: string;
  esClienteNuevo?: boolean;
  isOwner?: boolean;
  currentAgenteId?: string | null;
  agentes?: AgenteOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const clientes: ClienteParaOportunidad[] =
    clientesProp ?? (entidadId && clienteNombre ? [{ id: entidadId, nombre: clienteNombre }] : []);
  const etiquetaClientes =
    clientes.length === 1 ? clientes[0].nombre : `${clientes.length} clientes`;
  // El paso "preguntar" solo aplica cuando se acaba de crear un cliente nuevo
  // (confirma si además de crearlo se quiere añadir a una campaña ahora mismo).
  // Si el cliente ya existía, se va directo al formulario.
  const [step, setStep] = useState<"preguntar" | "form">(esClienteNuevo ? "preguntar" : "form");
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [campanaId, setCampanaId] = useState(defaultCampanaId ?? "");
  const [estadoId, setEstadoId] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [agenteId, setAgenteId] = useState(currentAgenteIdProp ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si el padre no pasa isOwner/agentes (p.ej. desde PanelEntidad, fuera del contexto de
  // una campaña concreta), se resuelven aquí mismo: rol del usuario actual + listado de
  // agentes de la agencia, para poder mostrar el selector si es Admin/Owner.
  const [isOwnerAuto, setIsOwnerAuto] = useState(false);
  const [agentesAuto, setAgentesAuto] = useState<AgenteOption[]>([]);
  const isOwner = isOwnerProp ?? isOwnerAuto;
  const agentes = agentesProp ?? agentesAuto;

  useEffect(() => {
    if (isOwnerProp !== undefined) return;
    getCurrentAgentePublic().then(({ usuarioId, rol }) => {
      setIsOwnerAuto(["Admin", "SuperAdmin", "Owner"].includes(rol));
      if (currentAgenteIdProp === undefined) setAgenteId(usuarioId);
    }).catch(() => {});
  }, [isOwnerProp, currentAgenteIdProp]);

  useEffect(() => {
    if (agentesProp !== undefined || !isOwner) return;
    getAgentes().then((data: any[]) => {
      setAgentesAuto(data.map(a => ({ agente_id: a.id, crm_agentes: { id: a.id, nombre: a.nombre, apellidos: a.apellidos } })));
    }).catch(() => {});
  }, [agentesProp, isOwner]);

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
    if (!campanaId || !estadoId || clientes.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const cliente of clientes) {
        await apiFetch("/api/crm/oportunidades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: cliente.nombre,
            campana_id: campanaId,
            estado_id: estadoId,
            entidad_id: cliente.id,
            prioridad: prioridad ? Number(prioridad) : null,
            valor_estimado: parseFloat(valorEstimado) || 0,
            // Solo un admin puede elegir agente manualmente; para un agente normal el
            // backend (createOportunidad) ignora este campo y asigna siempre al usuario actual.
            agente_id: isOwner ? (agenteId || null) : undefined,
          }),
        });
      }
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
              <strong>{etiquetaClientes}</strong> se ha creado correctamente. ¿Deseas añadirlo a una campaña?
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
          {clientes.length > 1 && (
            <div className={styles.field}>
              <label className={styles.label}>Clientes ({clientes.length})</label>
              <div style={{
                maxHeight: "90px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem",
                padding: "0.5rem 0.65rem", fontSize: "0.8rem", color: "#334155", lineHeight: 1.6,
              }}>
                {clientes.map(c => c.nombre).join(", ")}
              </div>
            </div>
          )}

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
          <button className={styles.btnPrimary} onClick={handleCrear} disabled={saving || !campanaId || !estadoId || clientes.length === 0}>
            {saving
              ? "Guardando…"
              : clientes.length > 1
                ? `Añadir ${clientes.length} oportunidades`
                : "Añadir a campaña"}
          </button>
        </div>
      </div>
    </div>
  );
}
