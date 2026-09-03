"use client";

import styles from "./nuevaDifusion.module.css";
import { X, Send, Paperclip } from "lucide-react";
import { useState, useRef } from "react";
import { crearDifusion, type EntidadDestinatarios } from "@/actions/difusiones";
import SelectorDestinatarios, { ARBOL_GENERAL, ARBOL_CAMPANA, ARBOL_EXPEDIENTE, type NodoDestinatario } from "./SelectorDestinatarios";

type Destinatario = { entidad_id: string; nombre: string; email: string };
type AdjuntoFile = { nombre: string; tamanio: number; contenido: string; tipo: string };

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type NuevaDifusionModalProps = {
  onClose: () => void;
  onCreated: () => void;
  /** Árbol de categorías de destinatarios a mostrar; por defecto el árbol general (Clientes/Viajeros/Grupos-Empresas). */
  arbolDestinatarios?: NodoDestinatario[];
  /** Fija la campaña de origen (contexto Campaña) — usa ARBOL_CAMPANA. */
  campanaId?: string;
  /** Fija el expediente de origen (contexto Expediente) — usa ARBOL_EXPEDIENTE. */
  expedienteId?: string;
  /** Entidades ya resueltas por el llamador (p.ej. filas filtradas en una tabla) — se precargan en el paso 1, junto al selector. */
  initialEntidades?: EntidadDestinatarios[];
  /** Si true, todos los emails de initialEntidades quedan marcados al abrir el modal. Por defecto false (el usuario elige). */
  preseleccionar?: boolean;
};

export default function NuevaDifusionModal({ onClose, onCreated, arbolDestinatarios, campanaId, expedienteId, initialEntidades, preseleccionar = false }: NuevaDifusionModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  const arbol = arbolDestinatarios ?? (campanaId ? ARBOL_CAMPANA : expedienteId ? ARBOL_EXPEDIENTE : ARBOL_GENERAL);

  // Selección de destinatarios (por entidad, cada una con 1+ emails posibles)
  const [entidades, setEntidades] = useState<EntidadDestinatarios[]>(initialEntidades ?? []);
  const [loadingDest, setLoadingDest] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(() => {
    if (!preseleccionar) return new Set<string>();
    const preseleccion = new Set<string>();
    for (const ent of initialEntidades ?? []) {
      for (const em of ent.emails) preseleccion.add(`${ent.entidad_id}::${em.email}`);
    }
    return preseleccion;
  });

  // Paso 2: mensaje
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function emailKey(entidadId: string, email: string) {
    return `${entidadId}::${email}`;
  }

  function toggleEmail(entidadId: string, email: string) {
    const key = emailKey(entidadId, email);
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const step1Valid = selectedEmails.size > 0;
  const puedeEnviar = asunto.trim() && cuerpo.trim() && step1Valid && !sending;

  const emailsSeleccionados: string[] = [];
  {
    const vistos = new Set<string>();
    for (const ent of entidades) {
      for (const em of ent.emails) {
        if (!selectedEmails.has(emailKey(ent.entidad_id, em.email))) continue;
        const emailNorm = em.email.trim().toLowerCase();
        if (vistos.has(emailNorm)) continue;
        vistos.add(emailNorm);
        emailsSeleccionados.push(em.email);
      }
    }
  }
  const EMAILS_VISIBLES = 5;
  const emailsVisibles = emailsSeleccionados.slice(0, EMAILS_VISIBLES);
  const emailsRestantes = emailsSeleccionados.length - emailsVisibles.length;

  async function handleEnviar() {
    setSending(true);
    setError(null);
    try {
      const adjuntosB64: AdjuntoFile[] = await Promise.all(
        adjuntos.map((f) => new Promise<AdjuntoFile>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ nombre: f.name, tamanio: f.size, contenido: (reader.result as string).split(",")[1] || "", tipo: f.type });
          reader.onerror = reject;
          reader.readAsDataURL(f);
        }))
      );

      const seleccionados: Destinatario[] = [];
      const vistosEnvio = new Set<string>();
      for (const ent of entidades) {
        for (const em of ent.emails) {
          if (!selectedEmails.has(emailKey(ent.entidad_id, em.email))) continue;
          const emailNorm = em.email.trim().toLowerCase();
          if (vistosEnvio.has(emailNorm)) continue;
          vistosEnvio.add(emailNorm);
          const idReal = ent.entidad_id.includes("::") ? ent.entidad_id.split("::")[1] : ent.entidad_id;
          seleccionados.push({ entidad_id: idReal, nombre: ent.nombre, email: em.email });
        }
      }
      const res = await crearDifusion({
        asunto: asunto.trim(),
        cuerpo: cuerpo.trim(),
        origen: campanaId ? "campana" : "selector",
        campanaId: campanaId ?? null,
        etiquetaId: null,
        destinatarios: seleccionados,
        adjuntos: adjuntosB64,
      });
      if (!res.success) {
        setError(res.error ?? "Error al enviar la difusión.");
        setSending(false);
        return;
      }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Error al enviar la difusión.");
      setSending(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className={styles.modalTitle}>Nueva difusión</span>
            <div className={styles.stepIndicator}>
              <span className={step === 1 ? styles.stepActive : styles.stepDone}>1. Destinatarios</span>
              <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>→</span>
              <span className={step === 2 ? styles.stepActive : styles.stepPending}>2. Mensaje</span>
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>

        {step === 1 && (
          <div className={styles.modalBody}>
            <SelectorDestinatarios
              arbol={arbol}
              expedienteId={expedienteId}
              campanaId={campanaId}
              entidades={entidades}
              onEntidadesChange={setEntidades}
              selectedEmails={selectedEmails}
              onToggleEmail={toggleEmail}
              loading={loadingDest}
              onLoadingChange={setLoadingDest}
              emailKey={emailKey}
            />
          </div>
        )}

        {step === 2 && (
          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label className={styles.label}>Destinatarios ({emailsSeleccionados.length})</label>
              <div className={styles.destinatariosChips}>
                {emailsVisibles.map((email) => (
                  <span key={email} className={styles.destinatarioChip}>{email}</span>
                ))}
                {emailsRestantes > 0 && (
                  <span className={styles.destinatarioChipMas}>+{emailsRestantes}</span>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Asunto</label>
              <input className={styles.input} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto del mensaje" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Mensaje</label>
              <textarea className={styles.textarea} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="Escribe el contenido de la difusión…" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Adjuntos</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => { setAdjuntos((prev) => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ""; }}
              />
              <button type="button" className={styles.btnSecondary} style={{ alignSelf: "flex-start" }} onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={14} style={{ marginRight: 4 }} /> Añadir archivo
              </button>
              {adjuntos.length > 0 && (
                <div className={styles.adjuntosList}>
                  {adjuntos.map((f, i) => (
                    <div key={i} className={styles.adjuntoRow}>
                      <span className={styles.adjuntoNombre}>{f.name}</span>
                      <span className={styles.adjuntoTamanio}>{formatBytes(f.size)}</span>
                      <button type="button" className={styles.adjuntoRemove} onClick={() => setAdjuntos((prev) => prev.filter((_, j) => j !== i))}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className={styles.hint}>Se enviará a {selectedEmails.size} email{selectedEmails.size === 1 ? "" : "s"}.</p>

            {error && <span className={styles.errorText}>{error}</span>}
          </div>
        )}

        <div className={styles.modalFooter}>
          {step === 1 && (
            <>
              <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={() => setStep(2)} disabled={!step1Valid}>Siguiente</button>
            </>
          )}
          {step === 2 && (
            <>
              <button className={styles.btnSecondary} onClick={() => setStep(1)}>Atrás</button>
              <button className={styles.btnPrimary} onClick={handleEnviar} disabled={!puedeEnviar}>
                <Send size={14} style={{ marginRight: 4 }} />
                {sending ? "Enviando…" : `Enviar a ${selectedEmails.size}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
