"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPropuestas, deletePropuesta, duplicarPropuesta, tienePropuestaCotizacionVinculada, unlinkCotizacionFromPropuesta } from "@/actions/propuestas";
import { Plus, Search, Eye, Pencil, Trash2, Copy, FileText, Calendar, LayoutTemplate, Share2, Check, Upload, SlidersHorizontal, Unlink, MoreVertical } from "lucide-react";
import styles from "./page.module.css";
import ImportarPropuestaPdfModal from "@/components/modals/ImportarPropuestaPdfModal";
import MultiSelectDropdown from "@/app/components/MultiSelectDropdown";

interface Propuesta {
  id: string;
  title: string;
  destination: string | null;
  destinos?: { id: string; nombre: string }[] | null;
  fecha_salida?: string | null;
  fecha_regreso?: string | null;
  created_at: string;
  contacto_id?: string | null;
  cotizacion_id?: string | null;
  contabilidad_entidades?: {
    id: string;
    nombre: string;
  } | null;
  landing?: {
    id: string;
    is_active: boolean;
    version_number: number;
    design_tokens: { uid: string; layout?: string }[];
    editor_content: { uid: string; tipo: string; titulo?: string; fechaDesde?: string; fechaHasta?: string }[];
  } | null;
  agente?: {
    id: string;
    auth_user_id: string;
    nombre: string;
    iniciales: string;
    avatar_url: string | null;
  } | null;
}

// Prioriza el campo destinos (array multi-destino); si está vacío, cae al antiguo
// campo destination (texto libre separado por comas) para propuestas sin migrar.
function getDestinosNombres(p: Propuesta): string[] {
  if (p.destinos && p.destinos.length > 0) return p.destinos.map(d => d.nombre).filter(Boolean);
  return (p.destination ?? "").split(",").map(d => d.trim()).filter(Boolean);
}

export default function PropuestasPage() {
  const router = useRouter();
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [duplicarModal, setDuplicarModal] = useState<string | null>(null);
  const [confirmarDesvincular, setConfirmarDesvincular] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [desvinculando, setDesvinculando] = useState(false);
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [currentRol, setCurrentRol] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [enlaceCopiado, setEnlaceCopiado] = useState<string | null>(null);
  const [importarModalOpen, setImportarModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [agenteFilter, setAgenteFilter] = useState<string[]>([]);
  const [destinoFilter, setDestinoFilter] = useState<string[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [agenteFilterInicializado, setAgenteFilterInicializado] = useState(false);

  async function copiarEnlacePublico(id: string) {
    const url = `${window.location.origin}/propuestas/${id}/preview`;
    try {
      await navigator.clipboard.writeText(url);
      setEnlaceCopiado(id);
      setTimeout(() => setEnlaceCopiado(prev => (prev === id ? null : prev)), 2000);
    } catch (e) {
      console.error("Error al copiar enlace:", e);
    }
  }

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.success) {
        setCurrentAuthUserId(d.data.authUserId);
        setCurrentRol(d.data.rol);
      }
      setAuthLoaded(true);
    }).catch(() => setAuthLoaded(true));
  }, []);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!menuAbierto) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuAbierto]);

  useEffect(() => {
    if (agenteFilterInicializado) return;
    if (!currentAuthUserId || propuestas.length === 0) return;
    const propia = propuestas.find(p => p.agente?.id === currentAuthUserId || p.agente?.auth_user_id === currentAuthUserId);
    if (propia?.agente?.nombre) {
      setAgenteFilter([propia.agente.nombre]);
    }
    setAgenteFilterInicializado(true);
  }, [currentAuthUserId, propuestas, agenteFilterInicializado]);

  async function cargar() {
    setLoading(true);
    const result = await getPropuestas();
    if (Array.isArray(result)) {
      setPropuestas(result as Propuesta[]);
    } else if ("data" in result) {
      console.error("Error cargando propuestas:", (result as any).error);
      setPropuestas([]);
    }
    setLoading(false);
  }

  async function borrar(id: string) {
    const result = await deletePropuesta(id);
    if (!result.ok) {
      alert(result.error ?? "No se pudo eliminar la propuesta");
    }
    setConfirmarBorrar(null);
    cargar();
  }

  async function iniciarDuplicar(id: string) {
    const check = await tienePropuestaCotizacionVinculada(id);
    if (check.tieneCotizacion) {
      setDuplicarModal(id);
    } else {
      const r = await duplicarPropuesta(id, false);
      if (r.ok) cargar();
    }
  }

  async function confirmarDuplicar(vincular: boolean) {
    if (!duplicarModal) return;
    const id = duplicarModal;
    setDuplicarModal(null);
    const r = await duplicarPropuesta(id, vincular);
    if (r.ok) cargar();
  }

  async function desvincular(id: string) {
    setDesvinculando(true);
    const result = await unlinkCotizacionFromPropuesta(id);
    if (!result.success) {
      alert(result.error ?? "No se pudo desvincular la propuesta de la cotización");
    }
    setDesvinculando(false);
    setConfirmarDesvincular(null);
    cargar();
  }

  const isAdminRol = currentRol ? ["Admin", "SuperAdmin", "Owner"].includes(currentRol) : false;

  const puedeEditar = (p: Propuesta) => {
    if (!authLoaded) return false;
    if (isAdminRol) return true;
    if (!p.agente) return true;
    return p.agente.id === currentAuthUserId || p.agente.auth_user_id === currentAuthUserId;
  };

  const agenteOptions = useMemo(() => {
    const names = propuestas.map(p => p.agente?.nombre).filter((n): n is string => !!n);
    return Array.from(new Set(names)).sort();
  }, [propuestas]);

  const destinoOptions = useMemo(() => {
    const names: string[] = [];
    propuestas.forEach(p => {
      getDestinosNombres(p).forEach(d => names.push(d));
    });
    return Array.from(new Set(names)).sort();
  }, [propuestas]);

  const propuestaFecha = (p: Propuesta) => {
    const content = p.landing?.editor_content;
    const itinerario = Array.isArray(content) ? content.find((s: any) => s.tipo === "itinerario") : null;
    return { desde: itinerario?.fechaDesde as string | undefined, hasta: itinerario?.fechaHasta as string | undefined };
  };

  const filtradas = propuestas.filter(p => {
    const matchesSearch =
      (p.title ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
      getDestinosNombres(p).join(", ").toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.contabilidad_entidades?.nombre ?? "").toLowerCase().includes(busqueda.toLowerCase());
    if (!matchesSearch) return false;

    if (agenteFilter.length > 0 && (!p.agente?.nombre || !agenteFilter.includes(p.agente.nombre))) return false;

    if (destinoFilter.length > 0) {
      const dests = getDestinosNombres(p);
      if (!dests.some(d => destinoFilter.includes(d))) return false;
    }

    if (fechaDesde || fechaHasta) {
      const { desde, hasta } = propuestaFecha(p);
      if (fechaDesde && desde && desde < fechaDesde) return false;
      if (fechaHasta && hasta && hasta > fechaHasta) return false;
    }

    return true;
  });

  const activeFilterCount = [agenteFilter.length > 0, destinoFilter.length > 0, !!fechaDesde, !!fechaHasta].filter(Boolean).length;

  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\*\*/g, "").trim();

  const titulo = (p: Propuesta) => {
    return stripHtml(p.title ?? "Sin título");
  };

  const secciones = (p: Propuesta) => {
    const content = p.landing?.editor_content;
    return Array.isArray(content) ? content.length : 0;
  };

  const fechasViaje = (p: Propuesta): { desde: string; hasta: string } | null => {
    if (p.fecha_salida && p.fecha_regreso) return { desde: p.fecha_salida, hasta: p.fecha_regreso };
    const content = p.landing?.editor_content;
    if (!Array.isArray(content)) return null;
    const itinerario = content.find((s: any) => s.tipo === "itinerario");
    if (!itinerario?.fechaDesde || !itinerario?.fechaHasta) return null;
    return { desde: itinerario.fechaDesde, hasta: itinerario.fechaHasta };
  };

  const diasNoches = (p: Propuesta): { dias: number; noches: number } | null => {
    const fechas = fechasViaje(p);
    if (!fechas) return null;
    const start = new Date(fechas.desde);
    const end = new Date(fechas.hasta);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0) return null;
    return { dias: diffDays, noches: diffDays - 1 };
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Propuestas Visuales</h1>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "auto" }}>
            <FileText size={18} style={{ color: "#475569" }} />
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
              Propuestas ({filtradas.length})
            </h2>
          </div>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Buscar por título o destino…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <button
            type="button"
            title="Filtrar"
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: "0.5rem", border: "1px solid #cbd5e1",
              background: showFilters ? "#cbd5e1" : "#fff", color: "#475569", cursor: "pointer", transition: "all 0.15s",
              padding: 0, position: "relative", flexShrink: 0
            }}
          >
            <SlidersHorizontal size={15} />
            {activeFilterCount > 0 && (
              <span
                key={activeFilterCount}
                style={{
                  position: "absolute", top: -6, right: -6, minWidth: "16px", height: "16px",
                  padding: "0 4px", borderRadius: "999px", background: "var(--primary-color, #6366f1)",
                  color: "#fff", fontSize: "0.62rem", fontWeight: 700, display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            title="Importar propuesta desde PDF"
            onClick={() => setImportarModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: "0.5rem", border: "1px solid #cbd5e1",
              background: "#fff", color: "#475569", cursor: "pointer", padding: 0, flexShrink: 0
            }}
          >
            <Upload size={15} />
          </button>
          <button
            type="button"
            title="Nueva propuesta"
            onClick={() => router.push("/propuestas/nueva")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: "0.5rem", border: "none",
              background: "var(--primary-color, #6366f1)", color: "#fff", cursor: "pointer", padding: 0, flexShrink: 0
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {showFilters && (
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", padding: "1rem", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ width: "200px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Agente</label>
              <MultiSelectDropdown
                options={agenteOptions}
                selected={agenteFilter}
                onChange={setAgenteFilter}
                placeholder="Agentes"
                style={{ padding: "0.3rem 0.5rem" }}
              />
            </div>
            <div style={{ width: "240px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Destino</label>
              <MultiSelectDropdown
                options={destinoOptions}
                selected={destinoFilter}
                onChange={setDestinoFilter}
                placeholder="Destinos"
                style={{ padding: "0.3rem 0.5rem" }}
              />
            </div>
            <div style={{ width: "160px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
                style={{ padding: "0.3rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "#fff", width: "100%" }}
              />
            </div>
            <div style={{ width: "160px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)}
                style={{ padding: "0.3rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "#fff", width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                onClick={() => { setAgenteFilter([]); setDestinoFilter([]); setFechaDesde(""); setFechaHasta(""); }}
                style={{ padding: "0.35rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.75rem", background: "#fff", color: "#475569", cursor: "pointer", fontWeight: 500 }}
              >
                Limpiar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className={styles.empty}>
            <div className={styles.spinner} />
          </div>
        ) : filtradas.length === 0 ? (
          <div className={styles.empty}>
            <FileText size={36} className={styles.emptyIcon} />
            <p>{busqueda ? "Sin resultados" : "Aún no hay propuestas"}</p>
            {!busqueda && (
              <button className={styles.btnNueva} onClick={() => router.push("/propuestas/nueva")}>
                <Plus size={14} /> Crear primera propuesta
              </button>
            )}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Título</th>
                <th>Destino</th>
                <th>Secciones</th>
                <th>Fechas viaje</th>
                <th>D/N</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(p => {
                const editable = puedeEditar(p);
                return (
                <tr
                  key={p.id}
                  className={styles.row}
                  onClick={() => editable && router.push(`/propuestas/${p.id}`)}
                  style={{ cursor: editable ? undefined : "default" }}
                >
                  <td>
                    <div className={styles.titleCell}>
                      {p.agente?.avatar_url ? (
                        <img
                          src={p.agente.avatar_url}
                          alt={p.agente.nombre}
                          title={p.agente.nombre}
                          style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", display: "block", flexShrink: 0, border: "1.5px solid #e2e8f0" }}
                        />
                      ) : (
                        <div
                          title={p.agente?.nombre ?? "Agente"}
                          style={{
                            width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                            background: "color-mix(in srgb, var(--primary-color, #6366f1) 30%, transparent)",
                            color: "var(--primary-color, #4f46e5)",
                            letterSpacing: "-0.5px",
                          }}
                        >
                          {p.agente?.iniciales ?? "?"}
                        </div>
                      )}
                      <div>
                        {p.contabilidad_entidades?.nombre && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, marginBottom: "0.1rem", textTransform: "uppercase" }}>
                            {p.contabilidad_entidades.nombre}
                          </div>
                        )}
                        <div className={styles.titleMain} style={{ fontWeight: 300 }}>{titulo(p)}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.cellMuted}>
                    {(() => {
                      const dests = getDestinosNombres(p);
                      if (dests.length === 0) return "—";
                      return (
                        <span className={styles.destCell}>
                          {dests[0]}
                          {dests.length > 1 && (
                            <span className={styles.destMore} title={dests.slice(1).join(", ")}>
                              +{dests.length - 1}
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <span className={styles.badge}>
                      <LayoutTemplate size={11} />
                      {secciones(p)}
                    </span>
                  </td>
                  <td className={styles.cellMuted}>
                    {(() => {
                      const fechas = fechasViaje(p);
                      if (!fechas) return "—";
                      const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
                      return (
                        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                          <span>{fmt(fechas.desde)}</span>
                          <span>{fmt(fechas.hasta)}</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className={styles.cellMuted}>
                    {(() => {
                      const dn = diasNoches(p);
                      return dn ? `${dn.dias}D/${dn.noches}N` : "—";
                    })()}
                  </td>
                  <td className={styles.cellMuted}>
                    <span className={styles.dateCell}>
                      <Calendar size={12} />
                      {new Date(p.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
                    <button
                      className={styles.actionBtn}
                      title="Más acciones"
                      onClick={() => setMenuAbierto(menuAbierto === p.id ? null : p.id)}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {menuAbierto === p.id && (
                      <div
                        ref={menuRef}
                        style={{
                          position: "absolute",
                          top: "50%",
                          right: "calc(100% + 0.4rem)",
                          transform: "translateY(-50%)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          background: "#1e293b",
                          borderRadius: "999px",
                          padding: "0.3rem",
                          boxShadow: "0 8px 20px rgba(15,23,42,0.25)",
                          zIndex: 20,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          className={styles.actionBtnDark}
                          title={editable ? "Editar" : "Solo el creador o un administrador puede editar"}
                          disabled={!editable}
                          style={!editable ? { color: "#64748b", cursor: "not-allowed" } : undefined}
                          onClick={() => { if (editable) { setMenuAbierto(null); router.push(`/propuestas/${p.id}`); } }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className={styles.actionBtnDark}
                          title="Previsualizar"
                          onClick={() => { setMenuAbierto(null); window.open(`/propuestas/${p.id}/preview`, "_blank"); }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className={styles.actionBtnDark}
                          title={enlaceCopiado === p.id ? "¡Enlace copiado!" : "Copiar enlace público para compartir"}
                          onClick={() => copiarEnlacePublico(p.id)}
                          style={enlaceCopiado === p.id ? { color: "#4ade80" } : undefined}
                        >
                          {enlaceCopiado === p.id ? <Check size={14} /> : <Share2 size={14} />}
                        </button>
                        <button
                          className={styles.actionBtnDark}
                          title="Duplicar"
                          onClick={() => { setMenuAbierto(null); iniciarDuplicar(p.id); }}
                        >
                          <Copy size={14} />
                        </button>
                        {p.cotizacion_id && (
                          <button
                            className={styles.actionBtnDark}
                            title="Desvincular cotización"
                            onClick={() => { setMenuAbierto(null); setConfirmarDesvincular(p.id); }}
                          >
                            <Unlink size={14} />
                          </button>
                        )}
                        <button
                          className={styles.actionBtnDark}
                          title={editable ? "Eliminar" : "Solo el creador o un administrador puede eliminar"}
                          disabled={!editable}
                          style={!editable ? { color: "#64748b", cursor: "not-allowed" } : { color: "#f87171" }}
                          onClick={() => { if (editable) { setMenuAbierto(null); setConfirmarBorrar(p.id); } }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal confirmar borrar */}
      {confirmarBorrar && (
        <div className={styles.modalOverlay} onClick={() => setConfirmarBorrar(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>¿Eliminar propuesta?</p>
            <p className={styles.modalText}>Esta acción no se puede deshacer. Se eliminará la propuesta y su landing.</p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setConfirmarBorrar(null)}>Cancelar</button>
              <button className={styles.modalConfirm} onClick={() => borrar(confirmarBorrar)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal duplicar propuesta con cotización vinculada */}
      {duplicarModal && (
        <div className={styles.modalOverlay} onClick={() => setDuplicarModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Duplicar propuesta</p>
            <p className={styles.modalText}>
              Esta propuesta tiene una cotización vinculada. ¿Deseas duplicar también la cotización y mantener el vínculo en la copia?
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setDuplicarModal(null)}>Cancelar</button>
              <button className={styles.modalCancel} onClick={() => confirmarDuplicar(false)}>Solo propuesta</button>
              <button className={styles.modalConfirm} onClick={() => confirmarDuplicar(true)}>Duplicar ambas</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar desvincular cotización */}
      {confirmarDesvincular && (
        <div className={styles.modalOverlay} onClick={() => !desvinculando && setConfirmarDesvincular(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>¿Desvincular cotización?</p>
            <p className={styles.modalText}>
              La propuesta dejará de estar asociada a su cotización. La propuesta y la cotización seguirán existiendo por separado.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} disabled={desvinculando} onClick={() => setConfirmarDesvincular(null)}>Cancelar</button>
              <button className={styles.modalConfirm} disabled={desvinculando} onClick={() => desvincular(confirmarDesvincular)}>
                {desvinculando ? "Desvinculando..." : "Desvincular"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportarPropuestaPdfModal
        isOpen={importarModalOpen}
        onClose={() => setImportarModalOpen(false)}
        onImportSuccess={(id) => router.push(`/propuestas/${id}`)}
      />
    </div>
  );
}
