"use client";

import { useState, useEffect } from "react";
import { X, Building2, Search } from "lucide-react";
import { Estado, EntidadSelector, ContactoSelector, AgenteSelector } from "../types";
import { apiFetch } from "../utils";
import styles from "../page.module.css";

export function NuevaOportunidadModal({
  campanaId,
  estados,
  onClose,
  onCreated,
}: {
  campanaId: string;
  estados: Estado[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estadoId, setEstadoId] = useState(estados[0]?.id ?? "");
  const [valorEstimado, setValorEstimado] = useState("");
  const [fechaCierre, setFechaCierre] = useState("");
  const [entidadSearch, setEntidadSearch] = useState("");
  const [entidades, setEntidades] = useState<EntidadSelector[]>([]);
  const [entidadId, setEntidadId] = useState<string | null>(null);
  const [contactos, setContactos] = useState<ContactoSelector[]>([]);
  const [contactoId, setContactoId] = useState<string | null>(null);
  const [agentes, setAgentes] = useState<AgenteSelector[]>([]);
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/crm/agentes").then(r => setAgentes(r.data ?? []));
  }, []);

  useEffect(() => {
    if (entidadSearch.length < 2) { setEntidades([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contabilidad/entidades?q=${encodeURIComponent(entidadSearch)}&limit=8`);
        const json = await res.json();
        setEntidades(json.data ?? json ?? []);
      } catch { setEntidades([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [entidadSearch]);

  useEffect(() => {
    if (!entidadId) { setContactos([]); setContactoId(null); return; }
    apiFetch(`/api/crm/contactos?entidad_id=${entidadId}`)
      .then(r => setContactos(r.data ?? []))
      .catch(() => setContactos([]));
  }, [entidadId]);

  async function handleGuardar() {
    if (!titulo.trim() || !estadoId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/crm/oportunidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion || null,
          campana_id: campanaId,
          estado_id: estadoId,
          entidad_id: entidadId || null,
          contacto_id: contactoId || null,
          agente_id: agenteId || null,
          valor_estimado: parseFloat(valorEstimado) || 0,
          fecha_cierre_est: fechaCierre || null,
        }),
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const entidadSeleccionada = entidades.find(e => e.id === entidadId);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Nueva oportunidad</span>
          <button className={styles.btnClose} onClick={onClose}><X size={15} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}>Título *</label>
            <input className={styles.input} placeholder="Ej. Viaje de fin de curso 2026" value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Estado inicial *</label>
              <select className={styles.input} value={estadoId} onChange={e => setEstadoId(e.target.value)}>
                {estados.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Valor estimado (€)</label>
              <input className={styles.input} type="number" min="0" placeholder="0" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Fecha cierre est.</label>
              <input className={styles.input} type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Agente responsable</label>
              <select className={styles.input} value={agenteId ?? ""} onChange={e => setAgenteId(e.target.value || null)}>
                <option value="">Sin asignar</option>
                {agentes.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} {a.apellidos}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Entidad (cliente / colegio)</label>
            {entidadSeleccionada ? (
              <div className={styles.entidadChip}>
                <Building2 size={13} />
                <span>{entidadSeleccionada.nombre}</span>
                <button type="button" className={styles.chipRemove} onClick={() => { setEntidadId(null); setEntidadSearch(""); }}>
                  <X size={11} />
                </button>
              </div>
            ) : (
              <div className={styles.searchBox}>
                <Search size={13} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  placeholder="Buscar entidad por nombre…"
                  value={entidadSearch}
                  onChange={e => setEntidadSearch(e.target.value)}
                />
                {entidades.length > 0 && (
                  <div className={styles.dropdown}>
                    {entidades.map(e => (
                      <button key={e.id} type="button" className={styles.dropdownItem} onClick={() => { setEntidadId(e.id); setEntidadSearch(""); }}>
                        <Building2 size={12} style={{ opacity: 0.5 }} />
                        <span>{e.nombre}</span>
                        <span className={styles.tipoBadge}>{e.tipo_entidad}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {entidadId && contactos.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Contacto</label>
              <select className={styles.input} value={contactoId ?? ""} onChange={e => setContactoId(e.target.value || null)}>
                <option value="">Sin contacto</option>
                {contactos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.cargo ? ` · ${c.cargo}` : ""}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Descripción</label>
            <textarea className={styles.textarea} rows={2} placeholder="Notas adicionales…" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving || !titulo.trim() || !estadoId}>
            {saving ? "Guardando…" : "Crear oportunidad"}
          </button>
        </div>
      </div>
    </div>
  );
}
