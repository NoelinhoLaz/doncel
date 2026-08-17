"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPropuestas, deletePropuesta, duplicarPropuesta, tienePropuestaCotizacionVinculada } from "@/actions/propuestas";
import { Plus, Search, Eye, Pencil, Trash2, Copy, FileText, Calendar, LayoutTemplate, Share2, Check, Upload } from "lucide-react";
import styles from "./page.module.css";
import ImportarPropuestaPdfModal from "@/components/modals/ImportarPropuestaPdfModal";

interface Propuesta {
  id: string;
  title: string;
  destination: string | null;
  created_at: string;
  contacto_id?: string | null;
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

export default function PropuestasPage() {
  const router = useRouter();
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [duplicarModal, setDuplicarModal] = useState<string | null>(null);
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [currentRol, setCurrentRol] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [enlaceCopiado, setEnlaceCopiado] = useState<string | null>(null);
  const [importarModalOpen, setImportarModalOpen] = useState(false);

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
    await deletePropuesta(id);
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

  const isAdminRol = currentRol ? ["Admin", "SuperAdmin", "Owner"].includes(currentRol) : false;

  const puedeEditar = (p: Propuesta) => {
    if (!authLoaded) return false;
    if (isAdminRol) return true;
    if (!p.agente) return true;
    return p.agente.id === currentAuthUserId || p.agente.auth_user_id === currentAuthUserId;
  };

  const filtradas = propuestas.filter(p =>
    (p.title ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.destination ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.contabilidad_entidades?.nombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\*\*/g, "").trim();

  const titulo = (p: Propuesta) => {
    const content = p.landing?.editor_content;
    if (!Array.isArray(content)) return p.title ?? "Sin título";
    const portada = content.find((s: any) => s.tipo === "portada");
    const raw = portada?.titulo ?? p.title ?? "Sin título";
    return stripHtml(raw);
  };

  const secciones = (p: Propuesta) => {
    const content = p.landing?.editor_content;
    return Array.isArray(content) ? content.length : 0;
  };

  const diasNoches = (p: Propuesta): { dias: number; noches: number } | null => {
    const content = p.landing?.editor_content;
    if (!Array.isArray(content)) return null;
    const itinerario = content.find((s: any) => s.tipo === "itinerario");
    if (!itinerario?.fechaDesde || !itinerario?.fechaHasta) return null;
    const start = new Date(itinerario.fechaDesde);
    const end = new Date(itinerario.fechaHasta);
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
            <h1 className={styles.title}>Propuestas</h1>
            <p className={styles.subtitle}>{propuestas.length} propuesta{propuestas.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className={styles.btnNueva}
              style={{ background: "#ffffff", color: "#334155", border: "1px solid #cbd5e1" }}
              onClick={() => setImportarModalOpen(true)}
            >
              <Upload size={16} />
              Importar
            </button>
            <button className={styles.btnNueva} onClick={() => router.push("/propuestas/nueva")}>
              <Plus size={16} />
              Nueva propuesta
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Buscar por título o destino…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>

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
                          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, marginBottom: "0.1rem" }}>
                            {p.contabilidad_entidades.nombre}
                          </div>
                        )}
                        <div className={styles.titleMain} style={{ fontWeight: 300 }}>{titulo(p)}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.cellMuted}>
                    {(() => {
                      const dests = (p.destination ?? "").split(",").map(d => d.trim()).filter(Boolean);
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
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionBtn}
                        title={editable ? "Editar" : "Solo el creador o un administrador puede editar"}
                        disabled={!editable}
                        style={!editable ? { color: "#cbd5e1", cursor: "not-allowed" } : undefined}
                        onClick={() => editable && router.push(`/propuestas/${p.id}`)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button className={styles.actionBtn} title="Previsualizar" onClick={() => window.open(`/propuestas/${p.id}/preview`, "_blank")}>
                        <Eye size={14} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        title={enlaceCopiado === p.id ? "¡Enlace copiado!" : "Copiar enlace público para compartir"}
                        onClick={() => copiarEnlacePublico(p.id)}
                        style={enlaceCopiado === p.id ? { color: "#16a34a" } : undefined}
                      >
                        {enlaceCopiado === p.id ? <Check size={14} /> : <Share2 size={14} />}
                      </button>
                      <button className={styles.actionBtn} title="Duplicar" onClick={() => iniciarDuplicar(p.id)}>
                        <Copy size={14} />
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        title="Eliminar"
                        onClick={() => setConfirmarBorrar(p.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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

      <ImportarPropuestaPdfModal
        isOpen={importarModalOpen}
        onClose={() => setImportarModalOpen(false)}
        onImportSuccess={(id) => router.push(`/propuestas/${id}`)}
      />
    </div>
  );
}
