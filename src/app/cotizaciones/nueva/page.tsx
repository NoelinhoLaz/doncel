"use client";

import { useState, useEffect, useRef } from "react";
import { Icons } from "@/lib/icons";
import { MapPin, X, Search, Loader2, Link2 } from "lucide-react";
import { PresupuestoDetalleDrawer } from "@/components/modals/PresupuestoDetalleDrawer";
import dynamic from "next/dynamic";
import listStyles from "../../expedientes/page.module.css";
import styles from "../../expedientes/[id]/page.module.css";
import CotizacionesTab from "../../expedientes/[id]/components/CotizacionesTab";
import { useSearchParams, useRouter } from "next/navigation";
import { addDestinoCotizacion, removeDestinoCotizacion, updateCotizacionMeta } from "@/actions/cotizaciones";
import { getEntidades } from "@/actions/entidades";
import ExpedienteActionsToolbar from "@/app/components/ExpedienteActionsToolbar";
import { PanelEntidad } from "@/app/campanas/[id]/panels/PanelEntidad";
import { NuevoClientePanel } from "@/components/modals/NuevoClientePanel";
import { Pencil } from "lucide-react";

export default function NuevaCotizacionPage() {
  const [contactoId, setContactoId] = useState<string | null>(null);
  const [contactoNombre, setContactoNombre] = useState<string | null>(null);
  const [contactoPersonaId, setContactoPersonaId] = useState<string | null>(null);
  const [contactoPersonaNombre, setContactoPersonaNombre] = useState<string | null>(null);
  const [title, setTitle] = useState("Nombre de la cotización");
  const [isContactoModalOpen, setIsContactoModalOpen] = useState(false);
  const [fechaSalida, setFechaSalida] = useState<string>("");
  const [fechaRegreso, setFechaRegreso] = useState<string>("");
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState<string | null>(null);

  // Summary Panel States
  const [summaryPlazas, setSummaryPlazas] = useState<number>(30);
  const [summaryFree, setSummaryFree] = useState<number>(2);
  const [suplementos, setSuplementos] = useState<string>("");
  const [totals, setTotals] = useState({ totalCost: 0, totalRevenue: 0 });
  const [summaryPvpViajero, setSummaryPvpViajero] = useState<number>(0);
  const [hasEditedPvp, setHasEditedPvp] = useState<boolean>(false);

  // Destinos State
  const [isDestinoOpen, setIsDestinoOpen] = useState(false);
  const [destinoPopoverPos, setDestinoPopoverPos] = useState({ top: 0, left: 0 });
  const [isUpdating, setIsUpdating] = useState(false);
  const [destinos, setDestinos] = useState<any[]>([]);
  const destinoBtnRef = useRef<HTMLButtonElement>(null);
  

  // Sync summaryPvpViajero automatically if it hasn't been edited manually
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [prevPlazas, setPrevPlazas] = useState(30);
  if (totals.totalRevenue !== prevRevenue || summaryPlazas !== prevPlazas) {
    setPrevRevenue(totals.totalRevenue);
    setPrevPlazas(summaryPlazas);
    if (!hasEditedPvp && summaryPlazas > 0) {
      setSummaryPvpViajero(Math.round(totals.totalRevenue / summaryPlazas));
    }
  }

  // Calculations for Summary
  const totalCost = totals.totalCost;
  const computedRevenue = hasEditedPvp ? (summaryPvpViajero * summaryPlazas) : totals.totalRevenue;
  const totalBenefit = computedRevenue - totalCost;
  const benefitPercentage = computedRevenue > 0 ? (totalBenefit / computedRevenue) * 100 : 0;

  const costViajero = summaryPlazas > 0 ? totalCost / summaryPlazas : 0;

  const [cotizacion, setCotizacion] = useState<any | null>(null);
      const search = useSearchParams();
      const router = useRouter();
      const cotId = search?.get('id') || null;
      const autoOpenSheetsImport = search?.get('importar') === '1';

  // Identidad del agente logueado, para determinar si puede editar esta cotización
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [currentRol, setCurrentRol] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d?.success) {
          setCurrentAuthUserId(d.data.authUserId);
          setCurrentRol(d.data.rol);
        }
      })
      .catch(console.error)
      .finally(() => setAuthLoaded(true));
  }, []);
  const isAdminRol = currentRol ? ["Admin", "SuperAdmin", "Owner"].includes(currentRol) : false;
  // Sin cotId (nueva, aún no guardada) o sin agente_id (legado): siempre editable.
  // Si no ha cargado aún la identidad, se asume editable para no bloquear de más antes de tiempo.
  const isOwner = !cotId || !cotizacion?.agente_id || isAdminRol || !authLoaded || cotizacion.agente_id === currentAuthUserId;

  // Currency formatter
      useEffect(() => {
        if (cotId) {
          fetch(`/api/cotizaciones?id=${cotId}`)
            .then(r => r.json())
            .then(d => {
              if (d?.success && d.data) {
                setCotizacion(d.data);
                setContactoId(d.data.contacto || null);
                setContactoNombre(d.data.contabilidad_entidades?.nombre || null);
                setContactoPersonaId(d.data.contacto_persona_id || null);
                setContactoPersonaNombre(d.data.crm_contactos?.nombre || null);
                setTitle(d.data.titulo || d.data.nombre || 'Nombre de la cotización');
                setDestinos(d.data.destinos || []);
                setFechaSalida(d.data.fecha_salida || "");
                setFechaRegreso(d.data.fecha_regreso || "");
                if (d.data.plazas != null) setSummaryPlazas(d.data.plazas);
                if (d.data.free != null) setSummaryFree(d.data.free);
                if (d.data.pvp_viajero != null) { setSummaryPvpViajero(d.data.pvp_viajero); setHasEditedPvp(true); }
              }
            });
        }
      }, [cotId]);
  const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  const formatCurrency = (v: any) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return currency.format(n);
  };

  // Handlers para gestionar destinos
  const handleAddDestino = async (place: { id: string; nombre: string }) => {
    if (!cotId) return;
    setIsUpdating(true);
    try {
      const result = await addDestinoCotizacion(cotId, place);
      setDestinos(result.destinos);
    } catch (error) {
      console.error('Error al guardar destino:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveDestino = async (destinoId: string) => {
    if (!cotId) return;
    setIsUpdating(true);
    try {
      const result = await removeDestinoCotizacion(cotId, destinoId);
      setDestinos(result.destinos);
    } catch (error) {
      console.error('Error al eliminar destino:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={listStyles.container}>
      <header className={styles.header} style={{ marginBottom: '0px' }}>
        <div className={styles.titleRow} style={{ alignItems: "center", marginBottom: '0px' }}>
          <a href="/cotizaciones" className={styles.backIconButton} title="Volver a cotizaciones">
            <Icons.ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} />
          </a>

          <div className={styles.titleGroup}>
            <button
              onClick={() => isOwner && setIsContactoModalOpen(true)}
              className={styles.entityName}
              disabled={!isOwner}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                padding: 0,
                cursor: isOwner ? "pointer" : "default",
                textAlign: "left",
                color: contactoNombre ? "inherit" : "#94a3b8",
                fontWeight: contactoNombre ? undefined : 400,
              }}
            >
              {contactoNombre || "Sin contacto"}
              {contactoPersonaNombre && (
                <span style={{ fontWeight: 400, color: "#64748b" }}> · {contactoPersonaNombre}</span>
              )}
            </button>

            {!isOwner && (
              <div style={{ fontSize: "0.7rem", color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "0.2rem 0.5rem", display: "inline-flex", width: "fit-content", marginTop: "0.3rem" }}>
                Solo lectura: esta cotización pertenece a otro agente
              </div>
            )}

            <fieldset disabled={!isOwner} style={{ border: "none", padding: 0, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: "0.15rem" }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (cotId) updateCotizacionMeta(cotId, { titulo: title }).catch(console.error); }}
                aria-label="Nombre de la cotización"
                className={styles.reference}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  padding: 0,
                  width: '420px',
                  maxWidth: '50vw'
                }}
              />
              {cotizacion?.presupuesto_id && (
                <button
                  type="button"
                  onClick={() => setSelectedPresupuestoId(cotizacion.presupuesto_id)}
                  style={{ background: "none", border: "none", color: "var(--primary-color, #4f46e5)", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 0 }}
                  title="Ver presupuesto vinculado"
                >
                  <Link2 size={16} />
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <button
                  ref={destinoBtnRef}
                  onClick={() => {
                    if (!isDestinoOpen && destinoBtnRef.current) {
                      const rect = destinoBtnRef.current.getBoundingClientRect();
                      setDestinoPopoverPos({ top: rect.bottom + 4, left: rect.left });
                    }
                    setIsDestinoOpen(!isDestinoOpen);
                  }}
                  title="Añadir destinos"
                  style={{
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    background: '#f8fafc',
                    color: '#475569',
                    borderRadius: '999px',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <MapPin size={12} />
                  {destinos?.length > 0 ? destinos.map((d: any) => d.nombre).join(', ') : 'Sin destino'}
                </button>
                {isDestinoOpen && (
                  <DestinoPopover
                    destinos={destinos}
                    position={destinoPopoverPos}
                    isUpdating={isUpdating}
                    onAdd={handleAddDestino}
                    onRemove={handleRemoveDestino}
                    onClose={() => setIsDestinoOpen(false)}
                  />
                )}
              </div>

              <DateChip
                label="Salida"
                value={fechaSalida}
                onChange={(v) => {
                  setFechaSalida(v);
                  if (cotId) updateCotizacionMeta(cotId, { fecha_salida: v || null }).catch(console.error);
                }}
              />
              <DateChip
                label="Regreso"
                value={fechaRegreso}
                onChange={(v) => {
                  setFechaRegreso(v);
                  if (cotId) updateCotizacionMeta(cotId, { fecha_regreso: v || null }).catch(console.error);
                }}
              />
            </fieldset>
          </div>

          <div style={{ flexGrow: 1 }} />
          {cotId && <ExpedienteActionsToolbar cotizacionId={cotId} />}
        </div>
      </header>

      {/* Main Page Layout - Stacked row structure */}
      <fieldset disabled={!isOwner} style={{ border: "none", margin: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0px 0px 0px', marginTop: '-1rem' }}>

        {/* Full-width Horizontal Summary Card (Dashboard Bar) */}
        <div style={{
          width: '100%',
          background: 'color-mix(in srgb, var(--primary-color, #475569), transparent 90%)',
          border: '2px solid var(--primary-color, #475569)',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap',
          fontFamily: '"Montserrat", sans-serif',
          marginTop: '-0.25rem'
        }}>
          {/* Section 1: Title and Status Badge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '120px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Resumen</h3>
            {benefitPercentage < 15 && (
              <span style={{
                backgroundColor: '#fee2e2',
                color: '#ef4444',
                borderRadius: '9999px',
                padding: '0.15rem 0.5rem',
                fontSize: '0.65rem',
                fontWeight: '700',
                letterSpacing: '0.05em',
                alignSelf: 'flex-start',
                marginTop: '0.1rem'
              }}>
                CRÍTICO
              </span>
            )}
          </div>

          {/* Section 2: Editable PVP Viajero */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', minWidth: '220px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>PVP VIAJERO:</span>
            <input
              type="text"
              value={summaryPvpViajero}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d.]/g, '');
                setSummaryPvpViajero(val ? Number(val) : 0);
                setHasEditedPvp(true);
              }}
              onBlur={() => { if (cotId) updateCotizacionMeta(cotId, { pvp_viajero: summaryPvpViajero }); }}
              style={{
                width: '70px',
                height: '30px',
                textAlign: 'right',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '700',
                color: '#0f172a',
                fontFamily: '"Montserrat", sans-serif',
                outline: 'none',
                background: '#ffffff',
                boxSizing: 'border-box',
                padding: '0.2rem 0.5rem'
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>{benefitPercentage.toFixed(1)}%</span>
          </div>

          {/* Section 3: Plazas & Free */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '180px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#334155' }}>Plazas:</span>
              <input
                type="text"
                value={summaryPlazas}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setSummaryPlazas(val ? Number(val) : 0);
                }}
                onBlur={() => { if (cotId) updateCotizacionMeta(cotId, { plazas: summaryPlazas }); }}
                style={{
                  width: '60px',
                  height: '30px',
                  textAlign: 'right',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: '#0f172a',
                  background: '#ffffff',
                  fontFamily: '"Montserrat", sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                  padding: '0.2rem 0.5rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Free:</span>
              <input
                type="text"
                value={summaryFree}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setSummaryFree(val ? Number(val) : 0);
                }}
                onBlur={() => { if (cotId) updateCotizacionMeta(cotId, { free: summaryFree }); }}
                style={{
                  width: '60px',
                  height: '30px',
                  textAlign: 'right',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: '#475569',
                  background: '#ffffff',
                  fontFamily: '"Montserrat", sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                  padding: '0.2rem 0.5rem'
                }}
              />
            </div>
          </div>

          {/* Section 4: Metrics Row */}
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', minWidth: '280px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Neto Viajero</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>{formatCurrency(costViajero)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Neto Total</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>{formatCurrency(totalCost)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Ingresos Total</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#15803d', textAlign: 'right' }}>{formatCurrency(computedRevenue)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Beneficio Total</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#15803d', textAlign: 'right' }}>{formatCurrency(totalBenefit)}</span>
            </div>
          </div>
          </div>

        {/* Full-width Quote Service List Table (obligatorios + opcionales unidos) */}
        <div style={{ width: '100%' }}>
          <CotizacionesTab
            compactHeader
            hideSummary
            cotizacionId={cotId}
            onTotalsChange={setTotals}
            autoOpenSheetsImport={autoOpenSheetsImport}
            readOnly={!isOwner}
          />
        </div>

      </fieldset>

      {isContactoModalOpen && (
        <ContactoModal
          cotizacionId={cotId}
          currentId={contactoId}
          currentNombre={contactoNombre}
          currentPersonaId={contactoPersonaId}
          currentPersonaNombre={contactoPersonaNombre}
          currentTitulo={title}
          onSave={(id, nombre, titulo, personaId, personaNombre) => {
            setContactoId(id);
            setContactoNombre(nombre);
            setTitle(titulo);
            setContactoPersonaId(personaId);
            setContactoPersonaNombre(personaNombre);
            setIsContactoModalOpen(false);
          }}
          onClose={() => setIsContactoModalOpen(false)}
        />
      )}

      <PresupuestoDetalleDrawer
        isOpen={!!selectedPresupuestoId}
        onClose={() => setSelectedPresupuestoId(null)}
        presupuestoId={selectedPresupuestoId || ""}
      />
    </div>
  );
}

function ContactoModal({ cotizacionId, currentId, currentNombre, currentPersonaId, currentPersonaNombre, currentTitulo, onSave, onClose }: {
  cotizacionId: string | null;
  currentId: string | null;
  currentNombre: string | null;
  currentPersonaId: string | null;
  currentPersonaNombre: string | null;
  currentTitulo: string;
  onSave: (id: string | null, nombre: string | null, titulo: string, personaId: string | null, personaNombre: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [entidades, setEntidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(currentId);
  const [selectedNombre, setSelectedNombre] = useState<string | null>(currentNombre);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(currentPersonaId);
  const [selectedPersonaNombre, setSelectedPersonaNombre] = useState<string | null>(currentPersonaNombre);
  const [showBuscador, setShowBuscador] = useState(!currentId);
  const [showBuscadorPersona, setShowBuscadorPersona] = useState(false);
  const [personasEntidad, setPersonasEntidad] = useState<any[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [titulo, setTitulo] = useState(currentTitulo);
  const [editEntidad, setEditEntidad] = useState<any | null>(null);
  const [loadingEditEntidad, setLoadingEditEntidad] = useState(false);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    getEntidades().then(setEntidades).catch(console.error).finally(() => setLoading(false));
  }, []);

  function recargarPersonasEntidad() {
    if (!selectedId) { setPersonasEntidad([]); return; }
    setLoadingPersonas(true);
    fetch(`/api/entidades/${selectedId}/contactos`)
      .then(r => r.json())
      .then(json => { if (json?.success) setPersonasEntidad(json.data ?? []); else setPersonasEntidad([]); })
      .catch(() => setPersonasEntidad([]))
      .finally(() => setLoadingPersonas(false));
  }

  // Al seleccionar un cliente, comprobar si tiene contactos vinculados (crm_contactos)
  useEffect(() => {
    recargarPersonasEntidad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function abrirEditarCliente() {
    if (!selectedId) return;
    setLoadingEditEntidad(true);
    fetch(`/api/entidades/${selectedId}`)
      .then(r => r.json())
      .then(json => { if (json?.success) setEditEntidad(json.data); })
      .catch(console.error)
      .finally(() => setLoadingEditEntidad(false));
  }

  function abrirBuscadorPersona() {
    setShowBuscadorPersona(v => !v);
  }

  const filtered = entidades.filter(e =>
    e.nombre?.toLowerCase().includes(query.toLowerCase())
  );

  const handleSave = async () => {
    if (!cotizacionId) return;
    setSaving(true);
    try {
      await updateCotizacionMeta(cotizacionId, { contacto: selectedId, contacto_persona_id: selectedPersonaId, titulo });
      onSave(selectedId, selectedNombre, titulo, selectedPersonaId, selectedPersonaNombre);
    } catch (err) {
      console.error("Error al guardar contacto:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: "0.75rem", width: "90%", maxWidth: "480px",
        boxShadow: "0 20px 40px -8px rgba(0,0,0,0.2)", overflow: "hidden",
      }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>Editar cotización</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Título */}
          <div>
            <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.35rem" }}>
              Nombre de la cotización
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              style={{
                width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                border: "1px solid #cbd5e1", fontSize: "0.85rem", color: "#0f172a",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Contacto seleccionado */}
          {selectedNombre && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.75rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.375rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#166534" }}>{selectedNombre}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {loadingEditEntidad && (
                  <span style={{ fontSize: "0.68rem", color: "#166534", fontStyle: "italic" }}>Cargando...</span>
                )}
                <button
                  onClick={abrirEditarCliente}
                  disabled={loadingEditEntidad}
                  title="Editar cliente"
                  style={{ background: "none", border: "none", cursor: loadingEditEntidad ? "default" : "pointer", color: "#166534", display: "flex", opacity: loadingEditEntidad ? 0.5 : 1 }}
                >
                  <Pencil size={13} />
                </button>
                <button onClick={() => setShowBuscador(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontSize: "0.72rem", fontWeight: 600, textDecoration: "underline" }}>
                  {showBuscador ? "Ocultar" : "Cambiar"}
                </button>
                <button onClick={() => { setSelectedId(null); setSelectedNombre(null); setSelectedPersonaId(null); setSelectedPersonaNombre(null); setShowBuscador(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex" }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Responsable/contacto vinculado al cliente seleccionado */}
          {selectedId && (loadingPersonas || personasEntidad.length > 0 || selectedPersonaNombre) && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Responsable / contacto
                </label>
                <button onClick={abrirBuscadorPersona} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary-color,#475569)", fontSize: "0.72rem", fontWeight: 600, textDecoration: "underline" }}>
                  {showBuscadorPersona ? "Ocultar" : selectedPersonaNombre ? "Cambiar" : "Asignar"}
                </button>
              </div>

              {selectedPersonaNombre && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.75rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "0.375rem", marginBottom: showBuscadorPersona ? "0.4rem" : 0 }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e40af" }}>{selectedPersonaNombre}</span>
                  <button onClick={() => { setSelectedPersonaId(null); setSelectedPersonaNombre(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex" }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {showBuscadorPersona && (
                <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "0.375rem" }}>
                  {loadingPersonas ? (
                    <div style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Cargando...</div>
                  ) : personasEntidad.length === 0 ? (
                    <div style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Sin contactos para este cliente</div>
                  ) : personasEntidad.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedPersonaId(p.id); setSelectedPersonaNombre(p.nombre); setShowBuscadorPersona(false); }}
                      style={{
                        padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.78rem",
                        color: selectedPersonaId === p.id ? "#fff" : "#334155",
                        background: selectedPersonaId === p.id ? "var(--primary-color,#475569)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                      onMouseEnter={(el) => { if (selectedPersonaId !== p.id) el.currentTarget.style.background = "#f1f5f9"; }}
                      onMouseLeave={(el) => { if (selectedPersonaId !== p.id) el.currentTarget.style.background = "transparent"; }}
                    >
                      <span>{p.nombre}{p.cargo ? ` · ${p.cargo}` : ""}</span>
                      {p.email && <span style={{ fontSize: "0.65rem", color: selectedPersonaId === p.id ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>{p.email}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Buscador de contactos */}
          {showBuscador && (
            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.35rem" }}>
                {selectedNombre ? "Cambiar contacto" : "Asignar contacto"}
              </label>
              <div style={{ position: "relative", marginBottom: "0.4rem" }}>
                <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar contacto..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{
                    width: "100%", padding: "0.4rem 0.5rem 0.4rem 1.75rem",
                    borderRadius: "0.375rem", border: "1px solid #cbd5e1",
                    fontSize: "0.78rem", outline: "none", color: "#0f172a",
                    backgroundColor: "#ffffff", boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "0.375rem" }}>
                {loading ? (
                  <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>Cargando...</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: "1rem", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.6rem" }}>Sin resultados</div>
                    <button
                      onClick={() => setShowNuevoCliente(true)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "0.4rem 0.8rem", borderRadius: "0.375rem", border: "none",
                        background: "var(--primary-color,#475569)", color: "#fff",
                        fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      + Crear cliente {query.trim() ? `"${query.trim()}"` : ""}
                    </button>
                  </div>
                ) : filtered.map((e: any) => {
                  const ciudad = e.direccion?.ciudad || e.direccion?.localidad || "";
                  return (
                    <div
                      key={e.id}
                      onClick={() => { setSelectedId(e.id); setSelectedNombre(e.nombre); setQuery(""); setSelectedPersonaId(null); setSelectedPersonaNombre(null); setShowBuscador(false); setShowBuscadorPersona(false); setPersonasEntidad([]); }}
                      style={{
                        padding: "0.45rem 0.75rem", cursor: "pointer", fontSize: "0.8rem",
                        color: selectedId === e.id ? "#fff" : "#334155",
                        background: selectedId === e.id ? "var(--primary-color,#475569)" : "transparent",
                        display: "flex", flexDirection: "column", gap: 2,
                      }}
                      onMouseEnter={(el) => { if (selectedId !== e.id) el.currentTarget.style.background = "#f1f5f9"; }}
                      onMouseLeave={(el) => { if (selectedId !== e.id) el.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>{e.nombre}</span>
                        {e.email && <span style={{ fontSize: "0.68rem", color: selectedId === e.id ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>{e.email}</span>}
                      </div>
                      {ciudad && (
                        <span style={{ fontSize: "0.68rem", color: selectedId === e.id ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>{ciudad}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button onClick={onClose} style={{ padding: "0.45rem 1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.82rem", cursor: "pointer", color: "#475569" }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !cotizacionId}
            style={{ padding: "0.45rem 1rem", borderRadius: "0.375rem", border: "none", background: "var(--primary-color,#475569)", color: "#fff", fontSize: "0.82rem", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {editEntidad && (
        <PanelEntidad
          data={{ entidad: editEntidad }}
          onClose={() => setEditEntidad(null)}
          onEntidadUpdated={(actualizada) => {
            setEditEntidad(actualizada);
            if (actualizada?.nombre) setSelectedNombre(actualizada.nombre);
            recargarPersonasEntidad();
          }}
        />
      )}

      {showNuevoCliente && (
        <NuevoClientePanel
          onClose={() => setShowNuevoCliente(false)}
          onCreated={(nuevo) => {
            setShowNuevoCliente(false);
            setSelectedId(nuevo.id);
            setSelectedNombre(nuevo.nombre);
            setSelectedPersonaId(null);
            setSelectedPersonaNombre(null);
            setShowBuscador(false);
            setQuery("");
            getEntidades().then(setEntidades).catch(console.error);
          }}
        />
      )}
    </div>
  );
}

function DateChip({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formatted = value ? new Date(value + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : null;
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => inputRef.current?.showPicker?.()}
        style={{
          padding: "0.25rem 0.75rem", fontSize: "0.75rem", background: "#f8fafc",
          color: value ? "#475569" : "#94a3b8", borderRadius: "999px",
          border: "1px solid #cbd5e1", cursor: "pointer", fontWeight: value ? 600 : 400,
          display: "flex", alignItems: "center", gap: "0.35rem", whiteSpace: "nowrap",
        }}
      >
        <Icons.Calendar size={12} />
        {formatted ? `${label}: ${formatted}` : label}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0, top: 0, left: 0 }}
      />
    </div>
  );
}

function DestinoPopover({ destinos, position, isUpdating, onAdd, onRemove, onClose }: {
  destinos: any[];
  position: { top: number; left: number };
  isUpdating: boolean;
  onAdd: (place: { id: string; nombre: string }) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nominatimDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [query, setQuery] = useState("");
  // Phase 1: maestro_destinos
  const [maestros, setMaestros] = useState<any[]>([]);
  const [loadingMaestros, setLoadingMaestros] = useState(true);
  // Phase 2: Nominatim (solo si no hay resultados en maestro)
  const [showNominatim, setShowNominatim] = useState(false);
  const [nominatimResults, setNominatimResults] = useState<any[]>([]);
  const [searchingNominatim, setSearchingNominatim] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    import("@/actions/destinos").then(({ getDestinos }) =>
      getDestinos().then(setMaestros).catch(console.error).finally(() => setLoadingMaestros(false))
    );
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Búsqueda Nominatim solo cuando estamos en fase 2
  useEffect(() => {
    if (!showNominatim) return;
    if (nominatimDebounceRef.current) clearTimeout(nominatimDebounceRef.current);
    if (query.trim().length < 2) { setNominatimResults([]); return; }
    nominatimDebounceRef.current = setTimeout(async () => {
      setSearchingNominatim(true);
      try {
        const { searchNominatim } = await import("@/actions/nominatim");
        const data = await searchNominatim(query);
        setNominatimResults(data);
      } catch { setNominatimResults([]); }
      finally { setSearchingNominatim(false); }
    }, 300);
    return () => { if (nominatimDebounceRef.current) clearTimeout(nominatimDebounceRef.current); };
  }, [query, showNominatim]);

  const normalizarBusqueda = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filteredMaestros = maestros.filter(d => {
    const q = normalizarBusqueda(query);
    const nombre = normalizarBusqueda(d.nombre_comercial || d.nombre || "");
    return nombre.includes(q);
  });

  const handleSelectMaestro = (d: any) => {
    const nombre = d.nombre_comercial || d.nombre || "";
    onAdd({ id: d.id, nombre });
    setQuery("");
  };

  const handleSelectNominatim = async (item: any) => {
    setSaving(true);
    try {
      const { createDestinoFromNominatim } = await import("@/actions/destinos");
      const destino = await createDestinoFromNominatim(item);
      if (destino) {
        onAdd({ id: destino.id, nombre: destino.nombre_comercial || destino.nombre || item.displayName });
        setQuery("");
        setNominatimResults([]);
        setShowNominatim(false);
      }
    } catch (err) { console.error("Error al crear destino:", err); }
    finally { setSaving(false); }
  };

  const alreadySelectedIds = new Set(destinos.map((d: any) => d.id));

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 99999,
        width: "300px",
        backgroundColor: "#ffffff",
        borderRadius: "0.5rem",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      {/* Destinos ya añadidos */}
      {destinos.length > 0 && (
        <div style={{ padding: "0.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {destinos.map((d: any, idx: number) => (
            <span key={d.id || idx} style={{
              display: "inline-flex", alignItems: "center", gap: "0.3rem",
              padding: "0.2rem 0.5rem", background: "#f1f5f9", color: "#334155",
              borderRadius: "999px", fontSize: "0.72rem", fontWeight: 500
            }}>
              {d.nombre}
              <button onClick={() => onRemove(d.id)} disabled={isUpdating}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0, display: "flex" }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Cabecera con búsqueda y toggle de fase */}
      <div style={{ padding: "0.5rem", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
          {showNominatim ? "Buscar en OpenStreetMap" : "Buscar destino"}
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder={showNominatim ? "Ciudad, país, región..." : "Buscar en mis destinos..."}
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (showNominatim) setNominatimResults([]); }}
              style={{
                width: "100%", padding: "0.4rem 0.5rem 0.4rem 1.75rem",
                borderRadius: "0.375rem", border: "1px solid #cbd5e1",
                fontSize: "0.78rem", outline: "none", color: "#0f172a",
                backgroundColor: "#ffffff", boxSizing: "border-box",
              }}
            />
            {(loadingMaestros || searchingNominatim) && (
              <Loader2 size={14} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", animation: "spin 0.8s linear infinite" }} />
            )}
          </div>
          {showNominatim && (
            <button
              onClick={() => { setShowNominatim(false); setNominatimResults([]); }}
              title="Volver a mis destinos"
              style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: "0.25rem", padding: "0 0.4rem", cursor: "pointer", color: "#64748b", fontSize: "0.7rem" }}
            >
              ← Volver
            </button>
          )}
        </div>
      </div>

      {/* Lista de resultados */}
      <div style={{ maxHeight: "220px", overflowY: "auto", padding: "0.25rem" }}>
        {!showNominatim ? (
          // Fase 1: maestro_destinos
          loadingMaestros ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>Cargando...</div>
          ) : filteredMaestros.length > 0 ? (
            <>
              {filteredMaestros.filter(d => !alreadySelectedIds.has(d.id)).map((d: any) => (
                <div
                  key={d.id}
                  onClick={() => handleSelectMaestro(d)}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.6rem", borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.75rem", color: "#0f172a" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <MapPin size={12} style={{ minWidth: 12, color: "#64748b" }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.nombre_comercial || d.nombre}</div>
                    {d.country && <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{d.country}</div>}
                  </div>
                </div>
              ))}
              {query.trim().length >= 2 && (
                <button
                  onClick={() => setShowNominatim(true)}
                  style={{
                    width: "100%", padding: "0.4rem 0.6rem", borderRadius: "0.375rem",
                    border: "1px dashed #cbd5e1", background: "none", cursor: "pointer",
                    fontSize: "0.72rem", color: "#475569", fontWeight: 600, textAlign: "left",
                    display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem",
                  }}
                >
                  <Search size={12} /> Buscar "{query}" en OpenStreetMap
                </button>
              )}
            </>
          ) : query.trim().length >= 2 ? (
            <div style={{ padding: "0.75rem 0.6rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.5rem" }}>
                No encontrado en tus destinos.
              </div>
              <button
                onClick={() => setShowNominatim(true)}
                style={{
                  width: "100%", padding: "0.4rem 0.6rem", borderRadius: "0.375rem",
                  border: "1px dashed #cbd5e1", background: "none", cursor: "pointer",
                  fontSize: "0.72rem", color: "#475569", fontWeight: 600, textAlign: "left",
                  display: "flex", alignItems: "center", gap: "0.4rem",
                }}
              >
                <Search size={12} /> Buscar "{query}" en OpenStreetMap
              </button>
            </div>
          ) : (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>Escribe para buscar</div>
          )
        ) : (
          // Fase 2: Nominatim
          nominatimResults.length > 0 ? (
            nominatimResults.map((item: any) => (
              <div
                key={`${item.osmType}-${item.osmId}`}
                onClick={() => handleSelectNominatim(item)}
                style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem", padding: "0.4rem 0.6rem", borderRadius: "0.25rem", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <MapPin size={13} style={{ minWidth: 13, color: "#64748b", marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0f172a" }}>
                    {item.city || item.state || item.displayName.split(",")[0].trim()}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{item.displayName}</div>
                  <div style={{ fontSize: "0.6rem", color: "#94a3b8", marginTop: "1px" }}>{item.type} · {item.country || ""}</div>
                </div>
              </div>
            ))
          ) : query.trim().length >= 2 && !searchingNominatim ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>Sin resultados en OpenStreetMap</div>
          ) : query.trim().length < 2 ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>Escribe al menos 2 caracteres</div>
          ) : null
        )}
      </div>

      {saving && (
        <div style={{ padding: "0.5rem", textAlign: "center", fontSize: "0.7rem", color: "#64748b", borderTop: "1px solid #f1f5f9" }}>
          <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite", display: "inline", marginRight: "0.25rem" }} />
          Guardando destino...
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
