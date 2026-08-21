"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./enviarEncuesta.module.css";
import { X, Send, Plus } from "lucide-react";
import { enviarEncuesta, getPlantillas } from "@/actions/encuestas";
import { type EntidadDestinatarios } from "@/actions/difusiones";
import ModalNuevaEncuesta from "./ModalNuevaEncuesta";
import SelectorDestinatarios, { ARBOL_EXPEDIENTE, ARBOL_GENERAL } from "./SelectorDestinatarios";

type PlantillaOption = { id: string; nombre: string; activa: boolean };

const ASUNTO_DEFECTO = "Nos encantaría conocer tu opinión";
const MENSAJE_DEFECTO = "Tenemos una breve encuesta para ti. Solo te llevará un minuto y nos ayuda a mejorar.";

interface Props {
  plantillaId?: string;
  expedienteId?: string;
  onClose: () => void;
  onSent?: () => void;
}

export default function ModalEnviarEncuesta({ plantillaId, expedienteId, onClose, onSent }: Props) {
  const skipStep1 = !!plantillaId;
  const [step, setStep] = useState<1 | 2 | 3>(skipStep1 ? 2 : 1);

  // Paso 1: plantilla
  const [plantillas, setPlantillas] = useState<PlantillaOption[]>([]);
  const [selectedPlantillaId, setSelectedPlantillaId] = useState(plantillaId || "");
  const [loadingPlantillas, setLoadingPlantillas] = useState(!skipStep1);
  const [showNuevaEncuesta, setShowNuevaEncuesta] = useState(false);

  // Paso 2: destinatarios
  const [entidades, setEntidades] = useState<EntidadDestinatarios[]>([]);
  const [loadingDest, setLoadingDest] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const [emailsManual, setEmailsManual] = useState("");
  const [manualEntidades, setManualEntidades] = useState<EntidadDestinatarios[]>([]);

  // Paso 3: mensaje
  const [asunto, setAsunto] = useState(ASUNTO_DEFECTO);
  const [mensaje, setMensaje] = useState(MENSAJE_DEFECTO);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (skipStep1) return;
    getPlantillas()
      .then((data) => setPlantillas((data as PlantillaOption[]).filter((p) => p.activa)))
      .finally(() => setLoadingPlantillas(false));
  }, [skipStep1]);

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

  function addEmailsManual() {
    const emails = emailsManual.split(",").map((e) => e.trim()).filter((e) => e.includes("@"));
    if (emails.length === 0) return;
    const existentes = new Set(manualEntidades.map((e) => e.entidad_id));
    const nuevas: EntidadDestinatarios[] = emails
      .filter((e) => !existentes.has(`manual::${e}`))
      .map((e) => ({ entidad_id: `manual::${e}`, nombre: e, emails: [{ email: e, etiqueta: "Manual", principal: false, tipo: "institucional" as const }] }));

    setManualEntidades((prev) => [...prev, ...nuevas]);
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      nuevas.forEach((ent) => ent.emails.forEach((em) => next.add(emailKey(ent.entidad_id, em.email))));
      return next;
    });
    setEmailsManual("");
  }

  const todasLasEntidades = useMemo(() => [...entidades, ...manualEntidades], [entidades, manualEntidades]);

  const emailsSeleccionados = useMemo(() => {
    const vistos = new Set<string>();
    const out: { entidadId: string; nombre: string; email: string }[] = [];
    for (const ent of todasLasEntidades) {
      for (const em of ent.emails) {
        if (!selectedEmails.has(emailKey(ent.entidad_id, em.email))) continue;
        const emailNorm = em.email.trim().toLowerCase();
        if (vistos.has(emailNorm)) continue;
        vistos.add(emailNorm);
        const idReal = ent.entidad_id.includes("::") ? ent.entidad_id.split("::")[1] : ent.entidad_id;
        out.push({ entidadId: ent.entidad_id.startsWith("manual::") ? "" : idReal, nombre: ent.nombre, email: em.email });
      }
    }
    return out;
  }, [todasLasEntidades, selectedEmails]);

  const step1Valid = !!selectedPlantillaId;
  const step2Valid = emailsSeleccionados.length > 0;
  const puedeEnviar = asunto.trim() && mensaje.trim() && step2Valid && !sending;

  const handleSend = async () => {
    if (!puedeEnviar) return;
    setSending(true);
    setResult(null);

    let okCount = 0;
    const errores: string[] = [];

    for (const d of emailsSeleccionados) {
      const res = await enviarEncuesta({
        plantillaId: selectedPlantillaId,
        entidadId: d.entidadId || undefined,
        expedienteId,
        emailDestino: d.email,
        appBaseUrl: window.location.origin,
        asunto,
        mensaje,
      });
      if (res.success) okCount++;
      else errores.push(`${d.nombre}: ${res.error || "error"}`);
    }

    setSending(false);

    if (errores.length === 0) {
      setResult({ ok: true, msg: `Encuesta enviada a ${okCount} destinatario${okCount === 1 ? "" : "s"}.` });
      onSent?.();
      onClose();
    } else {
      setResult({ ok: false, msg: `${okCount} enviada${okCount === 1 ? "" : "s"}, ${errores.length} con error: ${errores.join("; ")}` });
      if (okCount > 0) onSent?.();
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className={styles.modalTitle}>Enviar encuesta</span>
            <div className={styles.stepIndicator}>
              {!skipStep1 && (
                <>
                  <span className={step === 1 ? styles.stepActive : styles.stepDone}>1. Encuesta</span>
                  <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>→</span>
                </>
              )}
              <span className={step === 2 ? styles.stepActive : step > 2 ? styles.stepDone : styles.stepPending}>2. Destinatarios</span>
              <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>→</span>
              <span className={step === 3 ? styles.stepActive : styles.stepPending}>3. Mensaje</span>
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>

        {step === 1 && (
          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label className={styles.label}>Encuesta</label>
              <select
                className={styles.select}
                value={selectedPlantillaId}
                onChange={(e) => setSelectedPlantillaId(e.target.value)}
                disabled={loadingPlantillas}
              >
                <option value="">Selecciona una encuesta...</option>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {!loadingPlantillas && plantillas.length === 0 && (
                <span className={styles.hint}>No hay encuestas activas todavía.</span>
              )}
            </div>
            <button type="button" className={styles.btnLink} style={{ alignSelf: "flex-start" }} onClick={() => setShowNuevaEncuesta(true)}>
              <Plus size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
              Crear nueva encuesta
            </button>
          </div>
        )}

        {step === 2 && (
          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label className={styles.label}>Destinatarios</label>
              <div className={styles.field}>
                <label className={styles.label}>O introduce emails a mano (separados por comas)</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className={styles.input}
                    style={{ flex: 1 }}
                    value={emailsManual}
                    onChange={(e) => setEmailsManual(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmailsManual(); } }}
                    placeholder="ana@email.com, luis@email.com"
                  />
                  <button type="button" className={styles.btnSecondary} onClick={addEmailsManual} disabled={!emailsManual.trim()}>
                    Añadir
                  </button>
                </div>
                {manualEntidades.length > 0 && (
                  <div className={styles.destinatariosChips}>
                    {manualEntidades.map((ent) => (
                      <span key={ent.entidad_id} className={styles.destinatarioChip}>{ent.nombre}</span>
                    ))}
                  </div>
                )}
              </div>

              <SelectorDestinatarios
                arbol={expedienteId ? ARBOL_EXPEDIENTE : ARBOL_GENERAL}
                expedienteId={expedienteId}
                entidades={entidades}
                onEntidadesChange={setEntidades}
                selectedEmails={selectedEmails}
                onToggleEmail={toggleEmail}
                loading={loadingDest}
                onLoadingChange={setLoadingDest}
                emailKey={emailKey}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label className={styles.label}>Destinatarios ({emailsSeleccionados.length})</label>
              <div className={styles.destinatariosChips}>
                {emailsSeleccionados.slice(0, 5).map((d) => (
                  <span key={d.email} className={styles.destinatarioChip}>{d.email}</span>
                ))}
                {emailsSeleccionados.length > 5 && (
                  <span className={styles.destinatarioChipMas}>+{emailsSeleccionados.length - 5}</span>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Asunto</label>
              <input className={styles.input} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto del mensaje" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Mensaje</label>
              <textarea className={styles.textarea} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Escribe el mensaje introductorio..." />
              <span className={styles.hint}>El email incluirá automáticamente el botón "Responder encuesta" con el enlace.</span>
            </div>

            {result && !result.ok && <span className={styles.errorText}>{result.msg}</span>}
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
              <button className={styles.btnSecondary} onClick={skipStep1 ? onClose : () => setStep(1)}>
                {skipStep1 ? "Cancelar" : "Atrás"}
              </button>
              <button className={styles.btnPrimary} onClick={() => setStep(3)} disabled={!step2Valid}>Siguiente</button>
            </>
          )}
          {step === 3 && (
            <>
              <button className={styles.btnSecondary} onClick={() => setStep(2)}>Atrás</button>
              <button className={styles.btnPrimary} onClick={handleSend} disabled={!puedeEnviar}>
                <Send size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                {sending ? "Enviando..." : `Enviar a ${emailsSeleccionados.length}`}
              </button>
            </>
          )}
        </div>
      </div>

      {showNuevaEncuesta && (
        <ModalNuevaEncuesta
          onClose={() => setShowNuevaEncuesta(false)}
          onCreated={() => {
            getPlantillas().then((data) => {
              const activas = (data as any[]).filter((p) => p.activa);
              setPlantillas(activas);
              const nueva = activas[0];
              if (nueva) setSelectedPlantillaId(nueva.id);
            });
          }}
        />
      )}
    </div>
  );
}
