"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { getTipoSchema } from "@/lib/utils/cotizaciones";
import { getFixedFields } from "@/lib/serviceFormSchemas";
import ProviderSelector from "@/app/expedientes/[id]/components/ProviderSelector";
import DestinationSelector from "@/app/expedientes/[id]/components/DestinationSelector";
import PlacesAutocompleteField from "@/app/expedientes/[id]/components/PlacesAutocompleteField";
import styles from "./infoServicio.module.css";

interface Props {
  item: any | null;
  tiposMap: Record<string, any>;
  onClose: () => void;
  onSave: (id: string, nativeValues: Record<string, any>, formValues: Record<string, any>, pendingPlace: any | null) => Promise<void>;
}

function buildDescription(etiqueta: string, formValues: Record<string, any>, fallback: string): string {
  let parts: string[] = [];
  const etiquetaLower = (etiqueta || '').toLowerCase();
  if (etiquetaLower === 'entradas' || etiquetaLower === 'entrada') {
    parts = [formValues.nombre_evento, formValues.tipo_entrada, formValues.fecha_prevista].filter(Boolean);
  } else if (etiquetaLower === 'seguro' || etiquetaLower === 'seguros') {
    parts = [formValues.tipo_seguro, formValues.forma_aplicacion].filter(Boolean);
  } else if (etiquetaLower === 'guías' || etiquetaLower === 'guía' || etiquetaLower === 'guias' || etiquetaLower === 'guia') {
    parts = [formValues.nombre_guia, formValues.tipo_guia, formValues.idioma].filter(Boolean);
  } else if (etiquetaLower === 'actividades' || etiquetaLower === 'actividad' || etiquetaLower === 'actividades y excursiones') {
    parts = [formValues.nombre_actividad, formValues.tipo_actividad, formValues.fecha_actividad].filter(Boolean);
  } else if (etiquetaLower === 'vuelos' || etiquetaLower === 'vuelo') {
    const route = (formValues.origen_vuelo && formValues.destino_vuelo) ? `${formValues.origen_vuelo}-${formValues.destino_vuelo}` : (formValues.origen_vuelo || formValues.destino_vuelo || null);
    parts = [formValues.compania_aerea, formValues.numero_vuelo, route].filter(Boolean);
  } else if (etiquetaLower === 'crucero' || etiquetaLower === 'cruceros') {
    parts = [formValues.nombre_barco, formValues.tipo_cabina, formValues.regimen_bordo].filter(Boolean);
  } else if (['restauración', 'restauracion', 'restaurante', 'restaurantes'].includes(etiquetaLower)) {
    parts = [formValues.nombre_alojamiento, formValues.tipo_servicio, formValues.tipo_menu].filter(Boolean);
  } else if (etiquetaLower === 'tren' || etiquetaLower === 'trenes') {
    const route = (formValues.origen_tren && formValues.destino_tren) ? `${formValues.origen_tren}-${formValues.destino_tren}` : (formValues.origen_tren || formValues.destino_tren || null);
    parts = [formValues.compania_tren, formValues.numero_tren, route].filter(Boolean);
  } else if (['traslados', 'traslado', 'transfer', 'transfers'].includes(etiquetaLower)) {
    const route = (formValues.origen_traslado && formValues.destino_traslado) ? `${formValues.origen_traslado} → ${formValues.destino_traslado}` : (formValues.origen_traslado || formValues.destino_traslado || null);
    parts = [formValues.tipo_vehiculo, route, formValues.tipo_trayecto].filter(Boolean);
  } else if (etiquetaLower === 'packs' || etiquetaLower === 'pack') {
    const monitor = formValues.monitor_24h === 'Sí' ? 'Monitor 24h' : null;
    const acomp = formValues.acompanamiento === 'Sí' ? 'Acompañamiento' : null;
    const ratio = formValues.ratio && formValues.ratio !== 'Sin ratio' ? formValues.ratio : null;
    const ambito = formValues.ambito_frecuencia || null;
    const idioma = formValues.idioma || null;
    const incl = formValues.incluye ? `Incluye: ${formValues.incluye}` : null;
    parts = [monitor, acomp, ratio, ambito, idioma, incl].filter(Boolean);
  } else {
    parts = [formValues.nombre_alojamiento, formValues.tipo_alojamiento, formValues.uso, formValues.regimen].filter(Boolean);
  }
  return parts.length > 0 ? parts.map((p: string) => p.toUpperCase()).join(' - ') : (fallback || '').toUpperCase();
}

function renderField(
  field: any,
  isNative: boolean,
  currentVal: any,
  nativeVal: any,
  onChange: (val: any) => void,
  formValues: Record<string, any>,
  pendingPlace: any | null,
) {
  const t = field.tipo;
  const props = field.propiedades || field;
  const nativeProvider = ['db_select', 'db_select_proveedores'];
  const nativeDest = ['db_destination', 'db_select_destinos'];

  if (nativeProvider.includes(t)) return (
    <ProviderSelector value={isNative ? (nativeVal || '') : currentVal} onChange={onChange} compact />
  );

  if (nativeDest.includes(t)) {
    if (pendingPlace && field.campo === 'destino') {
      return <input type="text" disabled value={pendingPlace.displayName || (formValues?.nombre_alojamiento || '')} className={styles.inpReadonly} />;
    }
    return <DestinationSelector value={isNative ? (nativeVal || '') : currentVal} onChange={onChange} compact />;
  }

  if (t === 'db_number') return (
    <input type="number" value={isNative ? (nativeVal ?? '') : currentVal} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={styles.inp} />
  );

  if (t === 'select') return (
    <select value={currentVal} onChange={(e) => onChange(e.target.value)} className={styles.sel}>
      <option value="">{props.placeholder || 'Seleccionar...'}</option>
      {(props.opciones || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );

  if (['number', 'number_decimal'].includes(t)) return (
    <input type="number" step={t === 'number_decimal' ? '0.01' : '1'} value={isNative ? (nativeVal ?? '') : currentVal} placeholder={props.placeholder || '0'} onChange={(e) => onChange(e.target.value === '' ? null : (isNative ? Number(e.target.value) : e.target.value))} className={styles.inp} />
  );

  if (t === 'number_readonly') return (
    <input type="number" readOnly disabled value={isNative ? (nativeVal ?? '') : currentVal} placeholder="0" className={styles.inpReadonly} />
  );

  if (t === 'textarea') return (
    <textarea value={isNative ? (nativeVal ?? '') : currentVal} placeholder={props.placeholder || ''} onChange={(e) => onChange(e.target.value)} className={styles.textarea} style={{ minHeight: Number(props.rows_textarea || 4) * 20 }} />
  );

  if (t === 'date' || t === 'time') return (
    <input type={t} value={currentVal} placeholder={props.placeholder || ''} onChange={(e) => onChange(e.target.value)} className={styles.inp} />
  );

  if (t === 'radio_group') return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: 2 }}>
      {(props.opciones || []).map((opt: string) => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
          <input type="radio" name={field.campo} checked={currentVal === opt} onChange={() => onChange(opt)} style={{ accentColor: 'var(--primary-color, #475569)', margin: 0, colorScheme: 'light' }} />
          {opt}
        </label>
      ))}
    </div>
  );

  if (t === 'boolean') return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#334155' }}>
      <input type="checkbox" checked={Boolean(currentVal)} onChange={(e) => onChange(e.target.checked)} />
      {props.placeholder || 'Activado'}
    </label>
  );

  if (t === 'links') {
    const links: { label: string; url: string }[] = Array.isArray(currentVal) ? currentVal : [];
    const update = (next: { label: string; url: string }[]) => onChange(next);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {links.map((lnk, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={lnk.label}
              placeholder="Etiqueta"
              onChange={(e) => { const n = [...links]; n[i] = { ...n[i], label: e.target.value }; update(n); }}
              className={styles.inp}
              style={{ flex: '0 0 140px' }}
            />
            <input
              type="url"
              value={lnk.url}
              placeholder="https://..."
              onChange={(e) => { const n = [...links]; n[i] = { ...n[i], url: e.target.value }; update(n); }}
              className={styles.inp}
              style={{ flex: 1 }}
            />
            {lnk.url && (
              <a href={lnk.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color,#475569)', fontSize: '0.75rem', flexShrink: 0 }}>↗</a>
            )}
            <button
              type="button"
              onClick={() => update(links.filter((_, j) => j !== i))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', lineHeight: 1, flexShrink: 0, padding: '0 2px' }}
            >×</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update([...links, { label: '', url: '' }])}
          style={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: 'var(--primary-color,#475569)', background: 'none', border: '1px dashed currentColor', borderRadius: 5, padding: '0.25rem 0.6rem', cursor: 'pointer' }}
        >
          + Añadir enlace
        </button>
      </div>
    );
  }

  return (
    <input type="text" value={currentVal} placeholder={props.placeholder || ''} onChange={(e) => onChange(e.target.value)} className={styles.inp} />
  );
}

export default function ModalInfoServicio({ item, tiposMap, onClose, onSave }: Props) {
  const [infoFormValues, setInfoFormValues] = useState<Record<string, any>>({});
  const [infoNativeValues, setInfoNativeValues] = useState<Record<string, any>>({});
  const [pendingPlace, setPendingPlace] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [liveRating, setLiveRating] = useState<{ rating: number; count: number } | null>(null);
  const [clientRating, setClientRating] = useState<{ avg: number; count: number } | null>(null);

  const [expandedSubIds, setExpandedSubIds] = useState<Record<string, boolean>>({});
  const [autoCalculate, setAutoCalculate] = useState(true);

  useEffect(() => {
    if (!item) return;
    const det = typeof item?.detalles === 'string' ? (() => { try { return JSON.parse(item.detalles); } catch { return {}; } })() : (item?.detalles && typeof item.detalles === 'object' ? item.detalles : {});
    setInfoFormValues(det);
    setPendingPlace(null);
    setLiveRating(null);
    setClientRating(null);
    if (item?.id) {
      fetch(`/api/valoraciones/linea?linea_id=${encodeURIComponent(item.id)}`)
        .then(r => r.json())
        .then(d => { if (d.avg != null) setClientRating({ avg: d.avg, count: d.count }); })
        .catch(() => {});
    }
    const fotos: string[] = Array.isArray(det?.fotos_google) ? det.fotos_google : [];
    if (det?.rating_google == null && fotos.length > 0) {
      const match = fotos[0].match(/^places\/([^/]+)\/photos\//);
      if (match) {
        const placeId = match[1];
        fetch(`/api/places/rating?place_id=${encodeURIComponent(placeId)}`)
          .then(r => r.json())
          .then(d => { if (d.rating != null) setLiveRating({ rating: d.rating, count: d.userRatingCount ?? 0 }); })
          .catch(() => {});
      }
    }
    setInfoNativeValues({
      descripcion: item?.descripcion || "",
      // item.proveedor_id existe solo en servicios de expediente (donde item.proveedor puede
      // ser el nombre ya resuelto, no un id); en cotización item.proveedor ya es el id crudo.
      proveedor: item?.proveedor_id ?? item?.proveedor ?? "",
      destino: item?.destino || "",
      ubicacion: item?.destino || "",
      plazas: item?.plazas ?? null,
      cantidad: item?.plazas ?? null,
      noches: item?.noches ?? null,
      neto: !item?.neto || Number(item?.neto) === 0 ? "" : item.neto,
      precio_persona: !item?.neto || Number(item?.neto) === 0 ? "" : item.neto,
      pvp: !item?.pvp || Number(item?.pvp) === 0 ? "" : item.pvp,
      total_neto: !item?.total_neto || Number(item?.total_neto) === 0 ? "" : item.total_neto,
      total_pvp: !item?.total_pvp || Number(item?.total_pvp) === 0 ? "" : item.total_pvp,
    });
  }, [item?.id]);

  const etiqueta = item?.config_tipos_servicios?.etiqueta || (item?.tipo && tiposMap[item?.tipo]?.etiqueta) || '';
  const etiquetaLower = etiqueta.toLowerCase();
  const isPack = etiquetaLower === 'packs' || etiquetaLower === 'pack';

  // Sync auto-calculated values
  useEffect(() => {
    if (!isPack || !autoCalculate) return;
    const servicios = infoFormValues.servicios || [];
    let totalNeto = 0;
    let totalPvp = 0;
    servicios.forEach((s: any) => {
      totalNeto += Number(s.neto || 0);
      totalPvp += Number(s.pvp || 0);
    });
    setInfoNativeValues(prev => ({
      ...prev,
      neto: totalNeto > 0 ? String(totalNeto) : "",
      pvp: totalPvp > 0 ? String(totalPvp) : ""
    }));
  }, [infoFormValues.servicios, autoCalculate, isPack]);

  if (!item) return null;

  const schema = getTipoSchema(item, tiposMap);

  const photoNames: string[] = pendingPlace?.photos?.length > 0
    ? pendingPlace.photos.map((ph: any) => ph.name)
    : (Array.isArray(infoFormValues?.fotos_google) ? infoFormValues.fotos_google : []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(item.id, infoNativeValues, infoFormValues, pendingPlace);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(650px, 100%)', maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.16)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Formulario del servicio: {etiqueta}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#64748b', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '1rem', display: 'grid', gap: '0.8rem' }}>
          {isPack ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {/* Native fields for Pack */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '0.75rem' }}>
                <label style={{ gridColumn: 'span 12', display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Descripción del Pack</span>
                  <textarea
                    value={infoNativeValues.descripcion || ''}
                    onChange={(e) => setInfoNativeValues(prev => ({ ...prev, descripcion: e.target.value }))}
                    className={styles.textarea}
                    style={{ minHeight: 45, marginTop: 4 }}
                    placeholder="Ej: Pack de bienvenida, Excursiones incluidas..."
                  />
                </label>

                <label style={{ gridColumn: 'span 6', display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Destino</span>
                  <div style={{ marginTop: 4 }}>
                    <DestinationSelector
                      value={infoNativeValues.destino || ''}
                      onChange={(val) => setInfoNativeValues(prev => ({ ...prev, destino: val }))}
                      compact
                    />
                  </div>
                </label>

                <label style={{ gridColumn: 'span 6', display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Proveedor</span>
                  <div style={{ marginTop: 4 }}>
                    <ProviderSelector
                      value={infoNativeValues.proveedor || ''}
                      onChange={(val) => setInfoNativeValues(prev => ({ ...prev, proveedor: val }))}
                      compact
                    />
                  </div>
                </label>

                <label style={{ gridColumn: 'span 3', display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Personas</span>
                  <input
                    type="number"
                    value={infoNativeValues.plazas ?? ''}
                    onChange={(e) => setInfoNativeValues(prev => ({ ...prev, plazas: e.target.value === '' ? null : Number(e.target.value), cantidad: e.target.value === '' ? null : Number(e.target.value) }))}
                    className={styles.inp}
                    style={{ marginTop: 4 }}
                  />
                </label>

                <label style={{ gridColumn: 'span 3', display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Noches / Días</span>
                  <input
                    type="number"
                    value={infoNativeValues.noches ?? ''}
                    onChange={(e) => setInfoNativeValues(prev => ({ ...prev, noches: e.target.value === '' ? null : Number(e.target.value) }))}
                    className={styles.inp}
                    style={{ marginTop: 4 }}
                  />
                </label>

                <label style={{ gridColumn: 'span 3', display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Precio Coste</span>
                  <input
                    type="number"
                    step="0.01"
                    value={infoNativeValues.neto ?? ''}
                    disabled={autoCalculate}
                    onChange={(e) => {
                      setAutoCalculate(false);
                      setInfoNativeValues(prev => ({ ...prev, neto: e.target.value, precio_persona: e.target.value }));
                    }}
                    className={autoCalculate ? styles.inpReadonly : styles.inp}
                    style={{ marginTop: 4 }}
                  />
                </label>

                <label style={{ gridColumn: 'span 3', display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>PVP</span>
                  <input
                    type="number"
                    step="0.01"
                    value={infoNativeValues.pvp ?? ''}
                    disabled={autoCalculate}
                    onChange={(e) => {
                      setAutoCalculate(false);
                      setInfoNativeValues(prev => ({ ...prev, pvp: e.target.value }));
                    }}
                    className={autoCalculate ? styles.inpReadonly : styles.inp}
                    style={{ marginTop: 4 }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoCalculate}
                    onChange={(e) => setAutoCalculate(e.target.checked)}
                  />
                  Calcular importes automáticamente (suma de servicios)
                </label>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#0f172a', fontWeight: 600 }}>Servicios incluidos en el Pack</h4>
                  
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const newSub = {
                          id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          tipo: e.target.value,
                          neto: null,
                          pvp: null,
                          plazas: null,
                          noches: null,
                          descripcion: '',
                          proveedor: '',
                          destino: '',
                          detalles: {}
                        };
                        setInfoFormValues(prev => ({
                          ...prev,
                          servicios: [...(prev.servicios || []), newSub]
                        }));
                        setExpandedSubIds(prev => ({ ...prev, [newSub.id]: true }));
                        e.target.value = '';
                      }
                    }}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer', background: '#fff', color: '#334155' }}
                  >
                    <option value="">+ Añadir servicio...</option>
                    <option value="Alojamiento">Alojamiento</option>
                    <option value="Guías">Guías</option>
                    <option value="Excursión">Excursión / Actividad</option>
                    <option value="Traslado">Traslado / Transporte</option>
                    <option value="Entradas">Entradas</option>
                    <option value="Seguros">Seguros</option>
                    <option value="Vuelo">Vuelo</option>
                    <option value="Crucero">Crucero</option>
                    <option value="Restauración">Restauración</option>
                    <option value="Tren">Tren</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {(!infoFormValues.servicios || infoFormValues.servicios.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', border: '2px dashed #e2e8f0', borderRadius: 8, fontSize: '0.8rem', color: '#64748b' }}>
                      No hay servicios añadidos a este pack.
                    </div>
                  ) : (
                    infoFormValues.servicios.map((sub: any, idx: number) => {
                      const isExpanded = !!expandedSubIds[sub.id];
                      const subSchema = getFixedFields(sub.tipo);
                      return (
                        <div key={sub.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#f8fafc' }}>
                          <div
                            onClick={() => setExpandedSubIds(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f1f5f9', cursor: 'pointer', userSelect: 'none' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary-color, #475569)', background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>
                                {sub.tipo}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 500 }}>
                                {sub.descripcion || `Servicio ${idx + 1}`}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {sub.neto ? `${sub.neto}€ cost` : ''} {sub.pvp ? ` / ${sub.pvp}€ PVP` : ''}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInfoFormValues(prev => ({
                                    ...prev,
                                    servicios: (prev.servicios || []).filter((s: any) => s.id !== sub.id)
                                  }));
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '0.8rem', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'grid', gap: '0.8rem' }}>
                              {subSchema.map((fila: any) => {
                                if (fila.fila_id && fila.fila_id.includes('_vuelta') && sub.detalles?.tipo_trayecto !== 'Ida y vuelta') {
                                  return null;
                                }
                                return (
                                  <div key={fila.fila_id || JSON.stringify(fila)} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '0.75rem', width: '100%' }}>
                                    {(fila.columnas || []).map((field: any) => {
                                      const key = field.campo;
                                      const props = field.propiedades || field;
                                      const isNative = field.origen === 'tabla_nativa';
                                      const currentVal = isNative ? (sub[key] ?? '') : (sub.detalles?.[key] ?? props.default ?? '');
                                      const nativeVal = isNative ? (sub[key] ?? '') : '';
                                      const span = Math.max(1, Math.min(12, Number(field.ancho || 12)));
                                      
                                      const onChange = (val: any) => {
                                        const updatedSub = {
                                          ...sub,
                                          ...(isNative ? {
                                            [key]: val,
                                            ...(key === 'ubicacion'      ? { destino: val }        : {}),
                                            ...(key === 'destino'        ? { ubicacion: val }      : {}),
                                            ...(key === 'cantidad'       ? { plazas: val }         : {}),
                                            ...(key === 'plazas'         ? { cantidad: val }       : {}),
                                            ...(key === 'precio_persona' ? { neto: val }           : {}),
                                            ...(key === 'neto'           ? { precio_persona: val } : {}),
                                          } : {
                                            detalles: {
                                              ...(sub.detalles || {}),
                                              [key]: val
                                            }
                                          })
                                        };
                                        setInfoFormValues(prev => ({
                                          ...prev,
                                          servicios: (prev.servicios || []).map((s: any) => s.id === sub.id ? updatedSub : s)
                                        }));
                                      };

                                      return (
                                        <label key={key} style={{ display: 'grid', gap: 4, gridColumn: `span ${span} / span ${span}` }}>
                                          <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                                            {field.label || key}{props.required ? ' *' : ''}
                                            {key === 'descripcion' && (
                                              <button
                                                type="button"
                                                className={styles.genBtn}
                                                style={{ marginLeft: 6 }}
                                                onClick={() => {
                                                  const label = sub.tipo;
                                                  const details = sub.detalles || {};
                                                  const desc = buildDescription(label, details, sub[key] || '');
                                                  onChange(desc);
                                                }}
                                              >
                                                Generar
                                              </button>
                                            )}
                                          </span>
                                          <div style={{ marginTop: 4 }}>
                                            {field.tipo === 'places_autocomplete' ? (
                                              <PlacesAutocompleteField
                                                value={currentVal}
                                                placeholder={props.placeholder || ''}
                                                onChange={onChange}
                                                onPlaceSelected={(place) => {
                                                  onChange(place.displayName || place.formattedAddress || '');
                                                }}
                                              />
                                            ) : (
                                              renderField(field, isNative, currentVal, nativeVal, onChange, sub.detalles || {}, null)
                                            )}
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {schema.length === 0 && (
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Este tipo de servicio no tiene formulario personalizado configurado en Ajustes.
                </div>
              )}
              {schema.map((fila: any) => {
                if (fila.fila_id && fila.fila_id.includes('_vuelta') && infoFormValues.tipo_trayecto !== 'Ida y vuelta') {
                  return null;
                }
                return (
                  <div key={fila.fila_id || JSON.stringify(fila)} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '0.75rem', width: '100%' }}>
                    {(fila.columnas || []).map((field: any) => {
                    const key = field.campo;
                    const props = field.propiedades || field;
                    const isNative = field.origen === 'tabla_nativa';
                    const currentVal = infoFormValues?.[key] ?? props.default ?? '';
                    const nativeVal = infoNativeValues?.[key] ?? '';
                    const span = Math.max(1, Math.min(12, Number(field.ancho || 12)));
                    const onChange = isNative
                      ? (val: any) => setInfoNativeValues(prev => ({
                          ...prev,
                          [key]: val,
                          ...(key === 'ubicacion'     ? { destino: val }        : {}),
                          ...(key === 'destino'       ? { ubicacion: val }      : {}),
                          ...(key === 'cantidad'      ? { plazas: val }         : {}),
                          ...(key === 'plazas'        ? { cantidad: val }       : {}),
                          ...(key === 'precio_persona'? { neto: val }           : {}),
                          ...(key === 'neto'          ? { precio_persona: val } : {}),
                        }))
                      : (val: any) => setInfoFormValues(prev => ({ ...prev, [key]: val }));

                    return (
                      <label key={key} style={{ display: 'grid', gap: 4, gridColumn: `span ${span} / span ${span}` }}>
                        <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          {field.label || key}{props.required ? ' *' : ''}
                          {key === 'descripcion' && (
                            <button
                              type="button"
                              className={styles.genBtn}
                              title="Generar descripción automática"
                              onClick={() => setInfoNativeValues(prev => ({ ...prev, descripcion: buildDescription(etiqueta, infoFormValues, nativeVal) }))}
                            >
                              <Sparkles size={11} />
                              Generar
                            </button>
                          )}
                        </span>
                        <div style={{ marginTop: 4 }}>
                          {field.tipo === 'places_autocomplete' ? (
                            <>
                              <PlacesAutocompleteField
                                value={currentVal}
                                placeholder={props.placeholder || ''}
                                onChange={(val) => setInfoFormValues(prev => ({ ...prev, [key]: val }))}
                                onPlaceSelected={(place) => setPendingPlace(place)}
                              />
                              {(() => {
                                const rating = pendingPlace?.rating ?? infoFormValues?.rating_google ?? liveRating?.rating ?? null;
                                const count = pendingPlace?.userRatingCount ?? infoFormValues?.user_rating_count ?? liveRating?.count ?? null;
                                if (rating == null && clientRating == null) return null;
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                                    {rating != null && (() => {
                                      const stars = Math.round(rating);
                                      return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b' }}>
                                          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                                            <path d="M21.805 10.023H12v3.977h5.617C17.086 16.18 15.068 17.5 12 17.5c-3.59 0-6.5-2.91-6.5-6.5s2.91-6.5 6.5-6.5c1.655 0 3.155.625 4.3 1.645l2.95-2.95C17.41 1.64 14.86.5 12 .5 5.648.5.5 5.648.5 12S5.648 23.5 12 23.5c6.627 0 11-4.664 11-11.25 0-.756-.077-1.49-.195-2.227z"/>
                                          </svg>
                                          <span style={{ color: '#f59e0b', fontSize: '0.85rem', letterSpacing: 1 }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>{rating.toFixed(1)}</span>
                                          {count != null && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({count.toLocaleString('es-ES')} reseñas)</span>}
                                        </div>
                                      );
                                    })()}
                                    {clientRating != null && (() => {
                                      const stars = Math.round(clientRating.avg);
                                      return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b' }}>
                                          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                                            <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 3a7 7 0 1 1 0 14A7 7 0 0 1 12 5zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z"/>
                                          </svg>
                                          <span style={{ color: '#f59e0b', fontSize: '0.85rem', letterSpacing: 1 }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>{clientRating.avg.toFixed(1)}</span>
                                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({clientRating.count} {clientRating.count === 1 ? 'cliente' : 'clientes'})</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}
                            </>
                          ) : renderField(field, isNative, currentVal, nativeVal, onChange, infoFormValues, key === 'destino' ? pendingPlace : null)}
                        </div>
                      </label>
                    );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {photoNames.length > 0 && !isPack && (
          <div style={{ padding: '0 1rem 0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {photoNames.slice(0, 4).map((name: string, i: number) => (
                <img key={i} src={`/api/places/photo?name=${encodeURIComponent(name)}&idx=${i}`} alt={`Foto ${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc' }} />
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0.9rem 1rem', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onClose} style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 6, padding: '0.45rem 0.8rem', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ border: 'none', background: 'var(--primary-color, #475569)', color: '#fff', borderRadius: 6, padding: '0.45rem 0.8rem', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
