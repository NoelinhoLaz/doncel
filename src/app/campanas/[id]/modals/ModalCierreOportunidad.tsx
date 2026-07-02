"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, X, CalendarDays, Calendar, Sparkles, Rocket, CheckCircle2 } from "lucide-react";
import { Chip, ChipGroup } from "../components/Chip";
import { P, PL, PB, PBG, calcularMesVisitaRecomendado } from "../constants";
import styles from "../page.module.css";

function AuditoriaSubform({ motivo, state, update }: { motivo: string; state: Record<string, string | string[]>; update: (patch: Record<string, string | string[]>) => void }) {
  const s = (k: string) => (state[k] as string) ?? '';
  const wrapper = (title: string, children: React.ReactNode) => (
    <div style={{ marginTop: '0.25rem', padding: '0.85rem 1rem', background: PBG, borderRadius: 8, border: `1px solid ${PB}` }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: P, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{children}</div>
    </div>
  );

  if (motivo === 'otra-agencia') return wrapper('Análisis de Competencia', <>
    <ChipGroup label="¿Con qué agencia cerraron?" value={s('competidor')} onChange={v => update({ competidor: v as string })} options={[
      { value: 'azul-marino', label: 'Azul Marino' },
      { value: 'bthetravel', label: 'B the Travel' },
      { value: 'corte-ingles', label: 'Viajes El Corte Inglés' },
      { value: 'halcon', label: 'Halcón Viajes' },
      { value: 'agencia-local', label: 'Agencia local' },
      { value: 'campamento-directo', label: 'Campamento directo' },
      { value: 'otros', label: 'Otros' },
    ]} />
    {s('competidor') === 'otros' && (
      <input
        type="text"
        placeholder="Nombre de la agencia…"
        value={s('competidor_otros')}
        onChange={e => update({ competidor_otros: e.target.value })}
        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', borderRadius: 6, border: '1.5px solid #cbd5e1', outline: 'none', width: '100%' }}
      />
    )}
    <ChipGroup label="Palanca clave de la competencia" value={s('factor_competencia')} onChange={v => update({ factor_competencia: v as string })} options={[
      { value: 'precio', label: 'Precio más bajo' },
      { value: 'gratuidades', label: 'Más gratuidades' },
      { value: 'confianza', label: 'Confianza histórica' },
      { value: 'itinerario', label: 'Mejor itinerario' },
      { value: 'otro', label: 'Otro' },
    ]} />
    {s('factor_competencia') === 'otro' && (
      <input
        placeholder="Especifica la palanca clave..."
        value={s('factor_competencia_otro')}
        onChange={e => update({ factor_competencia_otro: e.target.value })}
        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', borderRadius: 6, border: '1.5px solid #cbd5e1', outline: 'none', width: '100%' }}
      />
    )}
    <ChipGroup label="¿Se presentó contrapropuesta?" value={s('contrapropuesta')} onChange={v => update({ contrapropuesta: v as string })} options={[
      { value: 'si', label: 'Sí' },
      { value: 'no', label: 'No' },
    ]} />
  </>);

  if (motivo === 'imposible-contacto') return wrapper('Auditoría del Bloqueo de Cuenta', <>
    <ChipGroup label="Canales intentados" value={(state['canal_intentado'] as string[]) ?? []} onChange={v => update({ canal_intentado: v as string[] })} multi options={[
      { value: 'email', label: 'Email' },
      { value: 'telefono', label: 'Teléfono' },
      { value: 'puerta_fria', label: 'Puerta fría' },
      { value: 'formulario_web', label: 'Web / RRSS' },
    ]} />
    <ChipGroup label="Número de intentos" value={s('numero_intentos')} onChange={v => update({ numero_intentos: v as string })} options={[
      { value: '1-3', label: '1 – 3' },
      { value: '4-6', label: '4 – 6' },
      { value: '+6', label: '+6' },
    ]} />
    <ChipGroup label="Barrera detectada" value={s('tactica_fallida')} onChange={v => update({ tactica_fallida: v as string })} options={[
      { value: 'filtro_recepcion', label: 'Filtro en recepción' },
      { value: 'silencio_absoluto', label: 'Silencio total' },
      { value: 'datos_erroneos', label: 'Datos erróneos' },
      { value: 'negativa_directa', label: 'Veto dirección' },
    ]} />
  </>);

  if (motivo === 'sin-respuesta') return wrapper('Auditoría de Desconexión', <>
    <ChipGroup label="Último hito de feedback" value={s('ultimo_hito')} onChange={v => update({ ultimo_hito: v as string })} options={[
      { value: 'reunion_profes', label: 'Pendiente reunión profes' },
      { value: 'ghosting_total', label: 'Ghosting total' },
      { value: 'itinerario_frio', label: 'Frío tras propuesta' },
    ]} />
    <ChipGroup label="Seguimientos realizados" value={s('num_seguimientos')} onChange={v => update({ num_seguimientos: v as string })} options={[
      { value: '1', label: '1' },
      { value: '2-3', label: '2 – 3' },
      { value: '+3', label: '+3' },
    ]} />
    <ChipGroup label="Vía del último intento" value={s('via_ultimo_intento')} onChange={v => update({ via_ultimo_intento: v as string })} options={[
      { value: 'llamada', label: 'Llamada' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'email', label: 'Email' },
      { value: 'puerta_fria', label: 'Puerta fría' },
    ]} />
  </>);

  if (motivo === 'cancelado-colegio') return wrapper('Diagnóstico de Cancelación', <>
    <ChipGroup label="Causa real de la cancelación" value={s('causa_cancelacion')} onChange={v => update({ causa_cancelacion: v as string })} options={[
      { value: 'sin_profes', label: 'Sin profesores voluntarios' },
      { value: 'sin_alumnos', label: 'Sin cupo mínimo' },
      { value: 'veto_direccion', label: 'Veto dirección / AMPA' },
      { value: 'problemas_economicos', label: 'Problemas económicos' },
    ]} />
    <ChipGroup label="¿Intención de recuperar el viaje el próximo año?" value={s('intencion_recuperar')} onChange={v => update({ intencion_recuperar: v as string })} options={[
      { value: 'si', label: 'Sí' },
      { value: 'dudoso', label: 'Dudoso' },
      { value: 'no', label: 'No' },
    ]} />
  </>);

  if (motivo === 'precio') return wrapper('Análisis de Desviación Presupuestaria', <>
    <ChipGroup label="Brecha económica estimada" value={s('brecha_precio')} onChange={v => update({ brecha_precio: v as string })} options={[
      { value: 'menor_50', label: '< 50 € / alumno' },
      { value: '50_125', label: '50 – 125 € / alumno' },
      { value: 'mayor_125', label: '> 125 € / alumno' },
    ]} />
    <ChipGroup label="Elemento que encareció el viaje (multiselección)" value={(state['elementos_caros'] as string[]) ?? []} onChange={v => update({ elementos_caros: v as string[] })} multi options={[
      { value: 'transporte', label: 'Transporte' },
      { value: 'alojamiento', label: 'Alojamiento' },
      { value: 'fechas', label: 'Fechas (temp. alta)' },
      { value: 'actividades', label: 'Actividades / Entradas' },
    ]} />
  </>);

  return null;
}

export function ModalCierreOportunidad({
  onClose,
  onSave,
  saving = false,
  oportunidad,
}: {
  onClose: () => void;
  onSave: (data: {
    motivo: string;
    competidor: string;
    periodoDecision: string;
    visitaSugerida: string;
    interesFuturo: string;
    observaciones: string;
    estrategiaCampana: string;
    auditoria: Record<string, string | string[]>;
    prioridad: number | null;
    valorEstimado: number;
  }) => void;
  saving?: boolean;
  oportunidad?: { nombre_centro: string; valor_estimado: number; prioridad?: number | null; destino_interesado?: string; notas_agente?: string; mig_notas?: { observaciones?: string; por_que_no_viajaron?: string; viajaran_con_doncel?: string; fecha_cierre?: string } };
}) {
  function inferirMotivo(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('otra agencia') || r.includes('confianza')) return 'otra-agencia';
    if (r.includes('imposible') || r.includes('contacto')) return 'imposible-contacto';
    if (r.includes('respuesta') || r.includes('presupuesto')) return 'sin-respuesta';
    if (r.includes('canceló') || r.includes('cancelo')) return 'cancelado-colegio';
    if (r.includes('caro') || r.includes('precio')) return 'precio';
    return '';
  }

  function inferirInteres(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('0-25') || r.includes('poco probable') || r.includes('no')) return 'bajo';
    if (r.includes('75') || r.includes('probable') || r.includes('sí')) return 'alto';
    return 'medio';
  }

  function inferirPeriodo(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('1q sept') || r.includes('1q-sept')) return '1q-sept';
    if (r.includes('2q sept') || r.includes('2q-sept')) return '2q-sept';
    if (r.includes('1q oct') || r.includes('1q-oct')) return '1q-oct';
    if (r.includes('2q oct') || r.includes('2q-oct')) return '2q-oct';
    if (r.includes('1q nov') || r.includes('1q-nov')) return '1q-nov';
    if (r.includes('2q nov') || r.includes('2q-nov')) return '2q-nov';
    return '';
  }

  // Parsear notas_agente como JSON si viene del modal de cierre
  const cd = (() => {
    const raw = oportunidad?.notas_agente;
    if (!raw) return null;
    try { const p = JSON.parse(raw); return typeof p === 'object' && p !== null ? p : null; } catch { return null; }
  })() ?? null;
  const mig = oportunidad?.mig_notas;

  // cd (JSON guardado) tiene precedencia; mig_notas como fallback legacy
  const motivoInicial = cd?.motivo || (mig?.por_que_no_viajaron ? inferirMotivo(mig.por_que_no_viajaron) : '');
  const interesInicial = cd?.interesFuturo || (mig?.viajaran_con_doncel ? inferirInteres(mig.viajaran_con_doncel) : 'medio');
  const periodoInicial = cd?.periodoDecision || (mig?.fecha_cierre ? inferirPeriodo(mig.fecha_cierre) : '');
  const obsInicial = cd?.observaciones || mig?.observaciones || '';
  const visitaInicial = cd?.visitaSugerida || '';
  const estrategiaInicial = cd?.estrategiaCampana || '';
  const auditoriaInicial: Record<string, string | string[]> = cd?.auditoria ?? {};

  const [motivo, setMotivo] = useState<string>(motivoInicial);
  const [periodoDecision, setPeriodoDecision] = useState<string>(periodoInicial);
  const [visitaSugerida, setVisitaSugerida] = useState<string>(visitaInicial);
  const [interesFuturo, setInteresFuturo] = useState<string>(interesInicial);
  const [observaciones, setObservaciones] = useState<string>(obsInicial);
  const [estrategiaCampana, setEstrategiaCampana] = useState<string>(estrategiaInicial);
  const [generandoIA, setGenerandoIA] = useState(false);
  const [auditoria, setAuditoria] = useState<Record<string, string | string[]>>(auditoriaInicial);
  const [prioridad, setPrioridad] = useState<number | null>(cd?.prioridad !== undefined ? cd.prioridad : (oportunidad?.prioridad ?? null));
  const [valorEstimado, setValorEstimado] = useState<number>(cd?.valorEstimado ?? oportunidad?.valor_estimado ?? 0);

  const periodoDecisionPrevRef = useRef<string | null>(null);
  useEffect(() => {
    // Solo recalcular si el usuario cambia el periodo (no en el montaje inicial)
    if (periodoDecisionPrevRef.current === null) { periodoDecisionPrevRef.current = periodoDecision; return; }
    if (periodoDecision !== periodoDecisionPrevRef.current) {
      periodoDecisionPrevRef.current = periodoDecision;
      setVisitaSugerida(calcularMesVisitaRecomendado(periodoDecision));
    }
  }, [periodoDecision]);

  const motivoPrevRef = useRef(motivoInicial);
  useEffect(() => {
    if (motivo !== motivoPrevRef.current) {
      motivoPrevRef.current = motivo;
      setAuditoria({});
    }
  }, [motivo]);


  async function sugerirEstrategiaIA() {
    setGenerandoIA(true);
    try {
      const res = await fetch("/api/crm/estrategia-cierre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oportunidad: {
            nombre_centro: oportunidad?.nombre_centro || "",
            valor_estimado: oportunidad?.valor_estimado || 0,
            destino_interesado: oportunidad?.destino_interesado || "",
          },
          datos_modal_actual: {
            motivo_no_viaje: motivo,
            cuando_deciden: periodoDecision,
            cuando_visitar: visitaSugerida,
            interes_profesor: interesFuturo,
            observaciones_objeciones: observaciones,
            auditoria: Object.keys(auditoria).length > 0 ? auditoria : undefined,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.estrategia) setEstrategiaCampana(json.estrategia);
    } catch { }
    finally { setGenerandoIA(false); }
  }

  const handleGuardar = () => {
    if (!motivo) return;
    onSave({
      motivo,
      competidor: (auditoria.competidor as string) ?? '',
      periodoDecision,
      visitaSugerida,
      interesFuturo,
      observaciones,
      estrategiaCampana,
      auditoria,
      prioridad,
      valorEstimado,
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* HEADER DEL MODAL */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className={styles.modalHeaderIcon}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <span className={styles.modalTitle} style={{ display: 'block' }}>Cierre de Oportunidad (No viajaron)</span>
              {oportunidad?.nombre_centro && (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'block', marginTop: 1 }}>
                  {oportunidad.nombre_centro}
                </span>
              )}
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                Captura los motivos para asegurar la estrategia de captación el próximo año.
              </span>
            </div>
          </div>
          <button className={styles.btnClose} onClick={onClose}><X size={15} /></button>
        </div>

        {/* CUERPO DEL MODAL */}
        <div className={styles.modalBody}>
          {/* BLOQUE 0: PRIORIDAD Y ESTIMACIÓN */}
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Prioridad</label>
              <select
                value={prioridad ?? ''}
                onChange={e => setPrioridad(e.target.value === '' ? null : Number(e.target.value))}
                className={styles.input}
              >
                <option value="">Sin prioridad</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Estimación (€)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={valorEstimado}
                onChange={e => setValorEstimado(parseFloat(e.target.value) || 0)}
                className={styles.input}
              />
            </div>
          </div>

          {/* BLOQUE 1: CLASIFICACIÓN MACRO */}
          <div className={styles.field}>
            <label className={styles.label}>¿Por qué NO viajaron con Doncel? *</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className={styles.input}
            >
              <option value="" disabled>Selecciona el motivo principal...</option>
              <option value="otra-agencia">Viajan con otra agencia (Competencia)</option>
              <option value="imposible-contacto">Imposible conseguir contacto inicial</option>
              <option value="sin-respuesta">No contestaron tras enviar presupuesto</option>
              <option value="cancelado-colegio">El colegio canceló el viaje este año</option>
              <option value="precio">Presupuesto fuera de su presupuesto (Caro)</option>
            </select>
          </div>

          {/* SUBFORMULARIOS DINÁMICOS POR MOTIVO */}
          {motivo && <AuditoriaSubform motivo={motivo} state={auditoria} update={(patch) => setAuditoria(p => ({ ...p, ...patch }))} />}

          {/* BLOQUE 3: ESTRATEGIA TEMPORAL (QUINCENAS) */}
          <div className={styles.fieldRow}>
            {/* Selector de Quincena de Decisión */}
            <div className={styles.field}>
              <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CalendarDays size={13} style={{ opacity: 0.6 }} />
                ¿Cuándo deciden el viaje?
              </label>
              <select
                value={periodoDecision}
                onChange={(e) => setPeriodoDecision(e.target.value)}
                className={styles.input}
              >
                <option value="">Seleccionar quincena...</option>
                <optgroup label="Septiembre">
                  <option value="1q-sept">1ª Quincena Septiembre</option>
                  <option value="2q-sept">2ª Quincena Septiembre</option>
                </optgroup>
                <optgroup label="Octubre">
                  <option value="1q-oct">1ª Quincena Octubre</option>
                  <option value="2q-oct">2ª Quincena Octubre</option>
                </optgroup>
                <optgroup label="Noviembre">
                  <option value="1q-nov">1ª Quincena Noviembre</option>
                  <option value="2q-nov">2ª Quincena Noviembre</option>
                </optgroup>
              </select>
            </div>

            {/* OUTPUT INTELIGENTE: CUÁNDO VISITAR EL CENTRO */}
            <div className={styles.field}>
              <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={13} style={{ color: '#d97706' }} />
                Cuándo visitar el centro
              </label>
              <div className={visitaSugerida ? styles.visitaBox : styles.visitaBoxEmpty}>
                {visitaSugerida ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={13} style={{ color: '#b45309' }} />
                    Planificar en: <strong>{visitaSugerida}</strong>
                  </span>
                ) : (
                  <span>Sujeto a la quincena</span>
                )}
              </div>
            </div>
          </div>

          {/* BLOQUE 4: INTERÉS DE CARA AL FUTURO */}
          <div className={styles.field}>
            <label className={styles.label}>Interés real del contacto para la campaña que viene</label>
            <div className={styles.interesRow}>
              {['bajo', 'medio', 'alto'].map((nivel) => {
                const isActive = interesFuturo === nivel;
                const activeClass =
                  nivel === 'alto' ? styles.interesBtnAltoActive :
                  nivel === 'medio' ? styles.interesBtnMedioActive :
                  styles.interesBtnBajoActive;

                return (
                  <button
                    key={nivel}
                    type="button"
                    onClick={() => setInteresFuturo(nivel)}
                    className={`${styles.interesBtn} ${isActive ? activeClass : ''}`}
                  >
                    {nivel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BLOQUE 5: OBSERVACIONES */}
          <div className={styles.field}>
            <label className={styles.label}>Observaciones / Tratamiento de objeciones</label>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: El profesor se mostró muy receptivo pero la directiva impuso la otra agencia por recomendación histórica..."
              className={styles.textarea}
            />
          </div>

          {/* BLOQUE 6: ESTRATEGIA CAMPAÑA PRÓXIMA */}
          <div className={styles.field}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                <Rocket size={13} style={{ color: '#d97706' }} />
                Estrategia campaña próxima
              </label>
              <button
                type="button"
                onClick={sugerirEstrategiaIA}
                disabled={generandoIA}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 600,
                  border: 'none', background: 'none',
                  color: 'var(--primary-color, #475569)',
                  cursor: generandoIA ? 'not-allowed' : 'pointer',
                  opacity: generandoIA ? 0.5 : 1, transition: 'opacity 0.15s',
                }}
              >
                {generandoIA
                  ? <><span style={{ display: 'inline-block', width: 9, height: 9, border: '1.5px solid var(--primary-color, #475569)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Generando…</>
                  : <><Sparkles size={10} /> Sugerir con IA</>
                }
              </button>
            </div>
            <textarea
              rows={3}
              value={generandoIA ? '' : estrategiaCampana}
              onChange={(e) => setEstrategiaCampana(e.target.value)}
              placeholder={generandoIA ? 'Generando enfoque comercial...' : 'Ej: Contactar directamente con el jefe de estudios en octubre, proponer visita personalizada con destino nuevo...'}
              className={styles.textarea}
              style={{ opacity: generandoIA ? 0.5 : 1, transition: 'opacity 0.2s' }}
            />
          </div>
        </div>

        {/* BOTONES ACCIÓN */}
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className={styles.btnPrimary}
            onClick={handleGuardar}
            disabled={saving || !motivo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#4f46e5' }}
          >
            <CheckCircle2 size={14} />
            {saving ? "Guardando…" : "Guardar Histórico"}
          </button>
        </div>

      </div>
    </div>
  );
}
