"use client";

import styles from "./nuevaDifusion.module.css";
import { X, Send, Megaphone, Tag, Users, Paperclip, Pencil, Search } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { crearDifusion, getDestinatariosPorCampana, getDestinatariosPorEtiqueta, getDestinatariosClientesAgente, getEmailsDeEntidad, getEntidadCompleta, type EntidadDestinatarios } from "@/actions/difusiones";
import { getCampanas } from "@/actions/crm";
import { getEtiquetas } from "@/actions/etiquetas";
import { PanelEntidad } from "@/app/campanas/[id]/panels/PanelEntidad";

type Destinatario = { entidad_id: string; nombre: string; email: string };
type AdjuntoFile = { nombre: string; tamanio: number; contenido: string; tipo: string };
type Origen = "campana" | "etiqueta" | "clientes_agente";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type NuevaDifusionModalProps = {
  onClose: () => void;
  onCreated: () => void;
  /** Si se pasa, se salta el paso 1 y se cargan directamente los destinatarios de esta campaña. */
  initialCampanaId?: string;
  /** Si se pasa, se salta el paso 1 y se usan estas entidades/emails ya resueltos (p.ej. contactos filtrados). */
  initialEntidades?: EntidadDestinatarios[];
};

export default function NuevaDifusionModal({ onClose, onCreated, initialCampanaId, initialEntidades }: NuevaDifusionModalProps) {
  const skipStep1 = !!initialCampanaId || !!initialEntidades;

  const [step, setStep] = useState<1 | 2 | 3>(skipStep1 ? 2 : 1);

  // Paso 1: tipo de búsqueda
  const [origen, setOrigen] = useState<Origen | null>(initialCampanaId ? "campana" : skipStep1 ? "clientes_agente" : null);
  const [campanas, setCampanas] = useState<{ id: string; nombre: string }[]>([]);
  const [etiquetas, setEtiquetas] = useState<{ id: string; nombre: string }[]>([]);
  const [campanaId, setCampanaId] = useState(initialCampanaId ?? "");
  const [etiquetaId, setEtiquetaId] = useState("");
  const [loadingOpciones, setLoadingOpciones] = useState(false);

  // Paso 2: selección de destinatarios (por entidad, cada una con 1+ emails posibles)
  const [entidades, setEntidades] = useState<EntidadDestinatarios[]>([]);
  const [loadingDest, setLoadingDest] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set()); // claves "entidadId::email"
  const [entidadEditandoId, setEntidadEditandoId] = useState<string | null>(null);
  const [entidadEditandoData, setEntidadEditandoData] = useState<any>(null);
  const [busquedaDest, setBusquedaDest] = useState("");

  // Paso 3: mensaje
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingOpciones(true);
    Promise.all([getCampanas(), getEtiquetas("agente")])
      .then(([camps, etqs]) => {
        setCampanas((camps as any[]).map((c) => ({ id: c.id, nombre: c.nombre })));
        setEtiquetas((etqs as any[]).map((e) => ({ id: e.id, nombre: e.nombre })));
      })
      .finally(() => setLoadingOpciones(false));
  }, []);

  useEffect(() => {
    if (initialEntidades) {
      aplicarEntidadesCargadas(initialEntidades);
    } else if (initialCampanaId) {
      cargarDestinatarios("campana", initialCampanaId, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emailKey(entidadId: string, email: string) {
    return `${entidadId}::${email}`;
  }

  function aplicarEntidadesCargadas(data: EntidadDestinatarios[]) {
    setEntidades(data);
    const preseleccion = new Set<string>();
    for (const ent of data) {
      const principal = ent.emails.find((e) => e.principal) ?? ent.emails[0];
      if (principal) preseleccion.add(emailKey(ent.entidad_id, principal.email));
    }
    setSelectedEmails(preseleccion);
  }

  function cargarDestinatarios(origenSel: Origen, campId: string, etqId: string) {
    setError(null);
    setLoadingDest(true);
    setEntidades([]);
    setSelectedEmails(new Set());

    const promise =
      origenSel === "clientes_agente" ? getDestinatariosClientesAgente() :
      origenSel === "campana" ? getDestinatariosPorCampana(campId) :
      getDestinatariosPorEtiqueta(etqId);

    promise
      .then(aplicarEntidadesCargadas)
      .finally(() => setLoadingDest(false));
  }

  function goToStep2() {
    if (!origen) return;
    setStep(2);
    cargarDestinatarios(origen, campanaId, etiquetaId);
  }

  function toggleEmail(entidadId: string, email: string) {
    const key = emailKey(entidadId, email);
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleTodosEmailsEntidad(ent: EntidadDestinatarios) {
    const keys = ent.emails.map((e) => emailKey(ent.entidad_id, e.email));
    const todosSeleccionados = keys.every((k) => selectedEmails.has(k));
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (todosSeleccionados ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  async function recargarEntidad(entidadId: string) {
    const actualizada = await getEmailsDeEntidad(entidadId);
    if (!actualizada) return;
    setEntidades((prev) => prev.map((e) => (e.entidad_id === entidadId ? actualizada : e)));
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      const emailsPrevios = new Set(entidades.find((e) => e.entidad_id === entidadId)?.emails.map((e) => e.email) ?? []);
      for (const em of actualizada.emails) {
        const key = emailKey(entidadId, em.email);
        // Selecciona automáticamente los emails nuevos (no existían antes de editar)
        if (!emailsPrevios.has(em.email)) next.add(key);
      }
      return next;
    });
  }

  async function abrirEditorEntidad(entidadId: string) {
    setEntidadEditandoId(entidadId);
    setEntidadEditandoData(null);
    const completa = await getEntidadCompleta(entidadId);
    setEntidadEditandoData(completa);
  }

  const totalEmails = entidades.reduce((s, e) => s + e.emails.length, 0);

  const entidadesOrdenadasFiltradas = useMemo(() => {
    const term = busquedaDest.trim().toLowerCase();
    const filtradas = term
      ? entidades.filter((ent) =>
          (ent.nombre || "").toLowerCase().includes(term) ||
          ent.emails.some((em) => em.email.toLowerCase().includes(term))
        )
      : entidades;
    return [...filtradas].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
  }, [entidades, busquedaDest]);

  function toggleSelectAll() {
    setSelectedEmails((prev) => {
      if (prev.size === totalEmails) return new Set();
      const next = new Set<string>();
      entidades.forEach((ent) => ent.emails.forEach((e) => next.add(emailKey(ent.entidad_id, e.email))));
      return next;
    });
  }

  const step1Valid = !!origen && (origen === "clientes_agente" || (origen === "campana" && campanaId) || (origen === "etiqueta" && etiquetaId));
  const step2Valid = selectedEmails.size > 0;
  const puedeEnviar = asunto.trim() && cuerpo.trim() && step2Valid && !sending;

  const emailsSeleccionados: string[] = [];
  for (const ent of entidades) {
    for (const em of ent.emails) {
      if (selectedEmails.has(emailKey(ent.entidad_id, em.email))) {
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
      for (const ent of entidades) {
        for (const em of ent.emails) {
          if (selectedEmails.has(emailKey(ent.entidad_id, em.email))) {
            seleccionados.push({ entidad_id: ent.entidad_id, nombre: ent.nombre, email: em.email });
          }
        }
      }
      const res = await crearDifusion({
        asunto: asunto.trim(),
        cuerpo: cuerpo.trim(),
        origen: origen!,
        campanaId: origen === "campana" ? campanaId : null,
        etiquetaId: origen === "etiqueta" ? etiquetaId : null,
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
              {!skipStep1 && (
                <>
                  <span className={step === 1 ? styles.stepActive : styles.stepDone}>1. Destinatarios</span>
                  <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>→</span>
                </>
              )}
              <span className={step === 2 ? styles.stepActive : step > 2 ? styles.stepDone : styles.stepPending}>2. Selección</span>
              <span style={{ color: "#cbd5e1", fontSize: "0.7rem" }}>→</span>
              <span className={step === 3 ? styles.stepActive : styles.stepPending}>3. Mensaje</span>
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>

        {step === 1 && (
          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label className={styles.label}>Buscar destinatarios por</label>
              <div className={styles.origenTabs}>
                <button
                  type="button"
                  className={`${styles.origenTab} ${origen === "campana" ? styles.origenTabActive : ""}`}
                  onClick={() => setOrigen("campana")}
                >
                  <Megaphone size={14} /> Campaña
                </button>
                <button
                  type="button"
                  className={`${styles.origenTab} ${origen === "etiqueta" ? styles.origenTabActive : ""}`}
                  onClick={() => setOrigen("etiqueta")}
                >
                  <Tag size={14} /> Etiqueta
                </button>
                <button
                  type="button"
                  className={`${styles.origenTab} ${origen === "clientes_agente" ? styles.origenTabActive : ""}`}
                  onClick={() => setOrigen("clientes_agente")}
                >
                  <Users size={14} /> Todos mis clientes
                </button>
              </div>
            </div>

            {origen === "campana" && (
              <div className={styles.field}>
                <label className={styles.label}>Campaña</label>
                <select className={styles.select} value={campanaId} onChange={(e) => setCampanaId(e.target.value)} disabled={loadingOpciones}>
                  <option value="">Selecciona una campaña…</option>
                  {campanas.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {origen === "etiqueta" && (
              <div className={styles.field}>
                <label className={styles.label}>Etiqueta</label>
                <select className={styles.select} value={etiquetaId} onChange={(e) => setEtiquetaId(e.target.value)} disabled={loadingOpciones}>
                  <option value="">Selecciona una etiqueta…</option>
                  {etiquetas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className={styles.modalBody}>
            <div className={styles.selectAllRow}>
              <span className={styles.label} style={{ textTransform: "none", letterSpacing: 0 }}>
                {loadingDest ? "Cargando…" : `${selectedEmails.size} de ${totalEmails} emails seleccionados`}
              </span>
              {!loadingDest && totalEmails > 0 && (
                <button type="button" className={styles.selectAllBtn} onClick={toggleSelectAll}>
                  {selectedEmails.size === totalEmails ? "Deseleccionar todos" : "Seleccionar todos"}
                </button>
              )}
            </div>

            {!loadingDest && entidades.length > 0 && (
              <div style={{ position: "relative", margin: "0.5rem 0 0.75rem" }}>
                <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Buscar destinatario o email..."
                  value={busquedaDest}
                  onChange={(e) => setBusquedaDest(e.target.value)}
                  className={styles.input}
                  style={{ paddingLeft: "2rem" }}
                />
              </div>
            )}

            {loadingDest ? (
              <p style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center", padding: "1rem 0" }}>Cargando destinatarios…</p>
            ) : entidades.length === 0 ? (
              <p className={styles.hint}>No se han encontrado destinatarios con email para esta selección.</p>
            ) : entidadesOrdenadasFiltradas.length === 0 ? (
              <p className={styles.hint}>Sin resultados para "{busquedaDest}".</p>
            ) : (
              <div className={styles.entidadesGrid}>
                {entidadesOrdenadasFiltradas.map((ent) => {
                  const multiple = ent.emails.length > 1;
                  const keys = ent.emails.map((e) => emailKey(ent.entidad_id, e.email));
                  const todosSeleccionados = keys.every((k) => selectedEmails.has(k));
                  return (
                    <div key={ent.entidad_id} className={styles.entidadCard}>
                      <div className={styles.entidadCardHeader}>
                        <span className={styles.entidadCardNombre}>{ent.nombre || "—"}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className={styles.editEntidadBtn}
                            onClick={() => abrirEditorEntidad(ent.entidad_id)}
                            title="Editar cliente / contactos"
                          >
                            <Pencil size={12} />
                          </button>
                          {multiple && (
                            <button type="button" className={styles.selectAllBtn} onClick={() => toggleTodosEmailsEntidad(ent)}>
                              {todosSeleccionados ? "Deseleccionar todos" : "Seleccionar todos"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={styles.entidadCardBody}>
                        {ent.emails.filter((em) => em.tipo === "institucional").map((em) => {
                          const checked = selectedEmails.has(emailKey(ent.entidad_id, em.email));
                          return (
                            <label key={em.email} className={styles.destinatarioRow}>
                              <input type="checkbox" checked={checked} onChange={() => toggleEmail(ent.entidad_id, em.email)} />
                              <span className={styles.destinatarioLinea}>{em.etiqueta} - {em.email}</span>
                            </label>
                          );
                        })}

                        {ent.emails.some((em) => em.tipo === "institucional") && ent.emails.some((em) => em.tipo === "contacto") && (
                          <div className={styles.destinatarioDivider} />
                        )}

                        {ent.emails.filter((em) => em.tipo === "contacto").map((em) => {
                          const checked = selectedEmails.has(emailKey(ent.entidad_id, em.email));
                          return (
                            <label key={em.email} className={styles.destinatarioRow}>
                              <input type="checkbox" checked={checked} onChange={() => toggleEmail(ent.entidad_id, em.email)} />
                              <span className={styles.destinatarioLinea}>{em.etiqueta} - {em.email}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
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
              <button className={styles.btnPrimary} onClick={goToStep2} disabled={!step1Valid}>Siguiente</button>
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
              <button className={styles.btnPrimary} onClick={handleEnviar} disabled={!puedeEnviar}>
                <Send size={14} style={{ marginRight: 4 }} />
                {sending ? "Enviando…" : `Enviar a ${selectedEmails.size}`}
              </button>
            </>
          )}
        </div>
      </div>

      {entidadEditandoId && !entidadEditandoData && typeof document !== "undefined" && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15,23,42,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <span style={{ background: "#fff", padding: "0.75rem 1.25rem", borderRadius: 10, fontSize: "0.85rem", color: "#64748b" }}>Cargando cliente…</span>
        </div>,
        document.body
      )}

      {entidadEditandoId && entidadEditandoData && typeof document !== "undefined" && createPortal(
        <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", zIndex: 9000 }}>
          <PanelEntidad
            data={{ entidad: entidadEditandoData }}
            onClose={() => {
              const id = entidadEditandoId;
              setEntidadEditandoId(null);
              setEntidadEditandoData(null);
              recargarEntidad(id);
            }}
            onEntidadUpdated={() => recargarEntidad(entidadEditandoId)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
