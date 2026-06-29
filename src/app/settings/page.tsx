"use client";

import styles from "./page.module.css";
import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { getOficinas } from "@/actions/oficinas";
import { getAgencyUsuarios } from "@/actions/usuarios";
import { getCuentasBancarias, updateCuentaBancaria } from "@/actions/cuentasBancarias";
import { getCuentasContables } from "@/actions/libroDiario";
import { getCurrentAgencyDetails, updateAgencyColor, updateAgencyLogo, updateAgencySecondaryColor } from "@/actions/agencias";
import { getTiposServicios, deleteTipoServicio } from "@/actions/tiposServicios";
import { obtenerApiKeys } from "@/actions/apikeys";
import * as LucideIcons from "lucide-react";
import { renderLucideIcon, getInitials } from "@/lib/utils/settingsUtils";
import ModalOficina from "@/components/modals/ModalOficina";
import ModalCuenta from "@/components/modals/ModalCuenta";
import ModalUsuario from "@/components/modals/ModalUsuario";
import ModalTipoServicio from "@/components/modals/ModalTipoServicio";
import ModalTipoForm from "@/components/modals/ModalTipoForm";
import ModalApiKey from "@/components/modals/ModalApiKey";

const SECTIONS = [
  { id: "personalizar",   label: "Personalizar",      icon: <Icons.Settings size={16} /> },
  { id: "usuarios",       label: "Usuarios",           icon: <Icons.Viajeros size={16} /> },
  { id: "oficinas",       label: "Oficinas",           icon: <Icons.Servicios size={16} /> },
  { id: "cuentas",        label: "Cuentas Tesorería",  icon: <Icons.Cobros size={16} /> },
  { id: "tiposServicios", label: "Tipos Servicios",    icon: <Icons.Servicios size={16} /> },
  { id: "apikeys",        label: "API Keys",           icon: <Icons.Key size={16} /> },
];

export default function SettingsPage() {
  // ── UI state ────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState("personalizar");

  // ── Personalizar ────────────────────────────────────────────
  const [headerColor, setHeaderColor] = useState("#475569");
  const [secondaryColor, setSecondaryColor] = useState("#22c55e");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Lists ────────────────────────────────────────────────────
  const [oficinas, setOficinas] = useState<any[]>([]);
  const [loadingOficinas, setLoadingOficinas] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [cuentasContables, setCuentasContables] = useState<any[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [tiposServicios, setTiposServicios] = useState<any[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [apiKeysList, setApiKeysList] = useState<any[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);

  // ── Modal open/editing state ─────────────────────────────────
  const [isOficinaModalOpen, setIsOficinaModalOpen] = useState(false);

  const [isCuentaModalOpen, setIsCuentaModalOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<any | null>(null);

  const [isUsuarioModalOpen, setIsUsuarioModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<any | null>(null);

  const [isTipoModalOpen, setIsTipoModalOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<any | null>(null);

  const [isTipoFormModalOpen, setIsTipoFormModalOpen] = useState(false);
  const [editingTipoForm, setEditingTipoForm] = useState<any | null>(null);

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // ── Bootstrap color/logo from DB ────────────────────────────
  useEffect(() => {
    async function loadConfig() {
      if (typeof window !== "undefined") {
        const sc = localStorage.getItem("momo_primary_color");
        if (sc) setHeaderColor(sc);
        const ssc = localStorage.getItem("momo_secondary_color");
        if (ssc) setSecondaryColor(ssc);
      }
      try {
        const details = await getCurrentAgencyDetails();
        if (details) {
          if (details.color_corporativo) {
            setHeaderColor(details.color_corporativo);
            localStorage.setItem("momo_primary_color", details.color_corporativo);
          }
          if (details.color_secundario) {
            setSecondaryColor(details.color_secundario);
            localStorage.setItem("momo_secondary_color", details.color_secundario);
          }
          if (details.logo_url) setLogoUrl(details.logo_url);
        }
      } catch (err: any) {
        console.warn("Error al cargar la configuración de la agencia:", err?.message || err);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--header-bg", headerColor);
    document.documentElement.style.setProperty("--primary-color", headerColor);
  }, [headerColor]);

  // ── Data fetchers ────────────────────────────────────────────
  async function fetchOficinas() {
    try { setLoadingOficinas(true); setOficinas(await getOficinas()); }
    catch (err) { console.error(err); }
    finally { setLoadingOficinas(false); }
  }

  async function fetchUsuarios() {
    try { setLoadingUsuarios(true); setUsuarios(await getAgencyUsuarios()); }
    catch (err) { console.error(err); }
    finally { setLoadingUsuarios(false); }
  }

  async function fetchCuentas() {
    try {
      setLoadingCuentas(true);
      setCuentasBancarias(await getCuentasBancarias());
    } catch (err) { console.error(err); }
    try { setCuentasContables(await getCuentasContables()); }
    catch (err) { console.error(err); }
    finally { setLoadingCuentas(false); }
  }

  async function fetchTiposServicios() {
    try { setLoadingTipos(true); setTiposServicios(await getTiposServicios()); }
    catch (err) { console.error(err); }
    finally { setLoadingTipos(false); }
  }

  async function fetchApiKeys() {
    setLoadingApiKeys(true);
    const res = await obtenerApiKeys();
    if (res.success && res.data) setApiKeysList(res.data);
    setLoadingApiKeys(false);
  }

  useEffect(() => {
    if (activeSection === "oficinas") { fetchOficinas(); }
    else if (activeSection === "usuarios") { fetchUsuarios(); fetchOficinas(); fetchCuentas(); }
    else if (activeSection === "cuentas") { fetchCuentas(); fetchOficinas(); }
    else if (activeSection === "tiposServicios") { fetchTiposServicios(); }
    else if (activeSection === "apikeys") { fetchApiKeys(); }
  }, [activeSection]);

  // ── Color / logo handlers ────────────────────────────────────
  const saveColor = async (color: string) => {
    setLoading(true);
    if (typeof window !== "undefined") localStorage.setItem("momo_primary_color", color);
    try { await updateAgencyColor(color); }
    catch (err: any) { console.warn("Error al guardar color:", err?.message); }
    finally { setLoading(false); }
  };

  const saveSecondaryColor = async (color: string) => {
    setLoading(true);
    if (typeof window !== "undefined") localStorage.setItem("momo_secondary_color", color);
    try { await updateAgencySecondaryColor(color); }
    catch (err: any) { console.warn("Error al guardar color secundario:", err?.message); }
    finally { setLoading(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Por favor, selecciona un archivo de imagen válido."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("La imagen no debe superar los 2MB."); return; }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const b64 = event.target?.result as string;
      setLoading(true);
      try {
        const res = await updateAgencyLogo(b64);
        if (res?.success) setLogoUrl(b64);
      } catch (err: any) { alert("Error al guardar el logo: " + err.message); }
      finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDelete = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar el logo de la agencia?")) return;
    setLoading(true);
    try {
      const res = await updateAgencyLogo(null);
      if (res?.success) setLogoUrl(null);
    } catch (err: any) { alert("Error al eliminar el logo: " + err.message); }
    finally { setLoading(false); }
  };

  // ── Tipo de servicio: delete ─────────────────────────────────
  const handleDeleteTipo = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este tipo de servicio?")) return;
    try {
      await deleteTipoServicio(id);
      fetchTiposServicios();
    } catch (err: any) { alert("Error al eliminar: " + err.message); }
  };

  // ── Helpers ──────────────────────────────────────────────────
  const getOficinaName = (id: string) => oficinas.find(o => o.id === id)?.nombre ?? "-";
  const getUserCuentas = (ids: any) =>
    (Array.isArray(ids) ? ids : []).map((id: string) => cuentasBancarias.find(c => c.id === id)).filter(Boolean);

  // ── Section renderers ────────────────────────────────────────
  const renderPersonalizar = () => (
    <div className={styles.personalizarWrapper}>
      <h2 className={styles.settingTitle} style={{ marginBottom: "1rem" }}>Logo de la Agencia</h2>
      <div className={styles.logoSection}>
        <div className={styles.logoPreview}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo de la Agencia" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            : <span className={styles.logoEmpty}>Sin logo</span>
          }
        </div>
        <div className={styles.logoActions}>
          <div className={styles.logoButtons}>
            <label className={styles.logoUploadLabel}>
              Seleccionar Logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} disabled={loading} />
            </label>
            {logoUrl && (
              <button onClick={handleLogoDelete} disabled={loading} className={styles.logoDeleteBtn}>
                Eliminar
              </button>
            )}
          </div>
          <span className={styles.logoHint}>Formatos recomendados: PNG, JPG, SVG. Máx. 2MB.</span>
        </div>
      </div>

      <div className={styles.colorsRow}>
        <div className={styles.colorBlock}>
          <h2 className={styles.settingTitle}>Color principal</h2>
          <div className={styles.colorPickerContainer}>
            <input type="color" value={headerColor} onChange={e => setHeaderColor(e.target.value)} onBlur={() => saveColor(headerColor)} className={styles.colorInput} disabled={loading} />
            <div className={styles.colorInfo}><span className={styles.colorValue}>{headerColor}</span></div>
          </div>
        </div>
        <div className={styles.colorBlock}>
          <h2 className={styles.settingTitle}>Color secundario</h2>
          <div className={styles.colorPickerContainer}>
            <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} onBlur={() => saveSecondaryColor(secondaryColor)} className={styles.colorInput} disabled={loading} />
            <div className={styles.colorInfo}><span className={styles.colorValue}>{secondaryColor}</span></div>
          </div>
        </div>
      </div>
      {loading && <span className={styles.saveStatus}>Guardando cambios...</span>}
    </div>
  );

  const renderUsuarios = () => (
    <div className={styles.tableContainer}>
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Icons.Viajeros size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Gestión de Usuarios</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <button className={styles.addActionButton} title="Añadir Usuario"
            onClick={() => { setEditingUsuario(null); setIsUsuarioModalOpen(true); }}>
            <Icons.Add size={18} />
          </button>
        </div>
      </div>
      <table className={styles.table}>
        <thead><tr>
          <th>Usuario</th><th>Contacto</th><th>Oficina</th><th>Cuentas Bancarias</th><th>Rol</th>
          <th style={{ textAlign: "right" }}>Acciones</th>
        </tr></thead>
        <tbody>
          {loadingUsuarios ? (
            <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Cargando usuarios...</td></tr>
          ) : usuarios.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>No hay usuarios registrados para esta agencia.</td></tr>
          ) : usuarios.map(u => {
            const userCuentas = getUserCuentas(u.cuentas_bancarias);
            return (
              <tr key={u.id}>
                <td>
                  <div className={styles.userNameWrapper}>
                    <div className={styles.userAvatar}>{getInitials(u.nombre || "", u.apellidos || "")}</div>
                    <span style={{ fontWeight: 600 }}>{`${u.nombre || ""} ${u.apellidos || ""}`.trim()}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem", fontSize: "0.85rem" }}>
                    <span>{u.email}</span>
                    {u.telefono && <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{u.telefono}</span>}
                  </div>
                </td>
                <td><span style={{ fontSize: "0.85rem" }}>{getOficinaName(u.oficina)}</span></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    {userCuentas.length === 0 ? (
                      <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Sin cuentas asignadas</span>
                    ) : (
                      <>
                        <span className={styles.statusTag} style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}
                          title={`${userCuentas[0].banco} - ${userCuentas[0].iban}`}>
                          {userCuentas[0].banco}
                        </span>
                        {userCuentas.length > 1 && (
                          <span className={styles.statusTag} style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", backgroundColor: "#e2e8f0", color: "#475569", border: "1px solid #cbd5e1", cursor: "help", fontWeight: 600 }}
                            title={userCuentas.slice(1).map((c: any) => `${c.banco} (${c.iban})`).join(", ")}>
                            +{userCuentas.length - 1}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", backgroundColor: "#e2e8f0", borderRadius: "6px", color: "#475569", fontWeight: 500 }}>
                    {u.rol}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => { setEditingUsuario(u); setIsUsuarioModalOpen(true); }}
                    className={styles.addActionButton}
                    style={{ display: "inline-flex", padding: "0.25rem 0.45rem", width: "auto", height: "auto", backgroundColor: "#e2e8f0", color: "#475569", fontSize: "0.75rem", gap: "0.25rem", alignItems: "center" }}
                    title="Editar Usuario">
                    Editar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderOficinas = () => (
    <div className={styles.tableContainer}>
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Icons.Servicios size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Gestión de Oficinas</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <button className={styles.addActionButton} title="Añadir Oficina" onClick={() => setIsOficinaModalOpen(true)}>
            <Icons.Add size={18} />
          </button>
        </div>
      </div>
      <table className={styles.table}>
        <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th style={{ textAlign: "right" }}>Estado</th></tr></thead>
        <tbody>
          {loadingOficinas ? (
            <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Cargando oficinas...</td></tr>
          ) : oficinas.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>No hay oficinas creadas. Pulsa el botón + para añadir una.</td></tr>
          ) : oficinas.map(a => (
            <tr key={a.id}>
              <td>{a.nombre}</td>
              <td>{a.telefono || "-"}</td>
              <td>{a.email || "-"}</td>
              <td style={{ textAlign: "right" }}>
                <span className={`${styles.statusTag} ${a.activa ? styles.statusSuccess : styles.statusPending}`}>
                  {a.activa ? "Activa" : "Inactiva"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCuentas = () => (
    <>
      <div className={styles.tableContainer}>
        <div className={styles.listHeaderTop}>
          <div className={styles.listTitleWrapper}>
            <Icons.Cobros size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Cuentas Tesorería</h2>
          </div>
          <div className={styles.actionsWrapper}>
            <button className={styles.addActionButton} title="Añadir Cuenta"
              onClick={() => { setEditingCuenta(null); setIsCuentaModalOpen(true); }}>
              <Icons.Add size={18} />
            </button>
          </div>
        </div>
        <table className={styles.table}>
          <thead><tr><th>Banco</th><th>Número (IBAN)</th><th>Oficina</th><th>Cta. Contable</th><th style={{ textAlign: "right" }}>Acciones</th></tr></thead>
          <tbody>
            {loadingCuentas ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Cargando cuentas bancarias...</td></tr>
            ) : cuentasBancarias.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>No hay cuentas bancarias creadas. Pulsa el botón + para añadir una.</td></tr>
            ) : cuentasBancarias.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className={`${styles.statusTag} ${c.activa ? styles.statusSuccess : styles.statusPending}`} style={{ padding: "0.15rem 0.4rem", fontSize: "0.65rem" }}>
                      {c.activa ? "Activa" : "Inactiva"}
                    </span>
                    {c.banco}
                  </div>
                </td>
                <td style={{ fontFamily: "monospace" }}>{c.iban}</td>
                <td>{c.config_oficinas?.nombre || "-"}</td>
                <td>
                  {c.cuenta_contable
                    ? <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", backgroundColor: "#f1f5f9", borderRadius: "4px", color: "#475569", fontFamily: "monospace" }}>{c.cuenta_contable}</span>
                    : "-"}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => { setEditingCuenta(c); setIsCuentaModalOpen(true); }}
                    className={styles.addActionButton}
                    style={{ display: "inline-flex", padding: "0.25rem 0.45rem", width: "auto", height: "auto", backgroundColor: "#e2e8f0", color: "#475569", fontSize: "0.75rem", gap: "0.25rem", alignItems: "center" }}
                    title="Editar Cuenta">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.listHeaderTop}>
          <div className={styles.listTitleWrapper}>
            <Icons.Settings size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Plan General de Cuentas</h2>
          </div>
        </div>
        <table className={styles.table}>
          <thead><tr><th>Código</th><th>Descripción</th><th>Tipo</th><th style={{ textAlign: "center" }}>Permite Apuntes</th></tr></thead>
          <tbody>
            {cuentasContables.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>No hay cuentas contables configuradas.</td></tr>
            ) : cuentasContables.map(c => (
              <tr key={c.id}>
                <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{c.codigo}</td>
                <td>{c.descripcion}</td>
                <td>
                  <span style={{
                    display: "inline-flex", padding: "0.15rem 0.4rem", borderRadius: "0.25rem",
                    fontSize: "0.65rem", fontWeight: 600, textTransform: "capitalize",
                    backgroundColor: c.tipo === "activo" ? "#eff6ff" : c.tipo === "pasivo" ? "#fef2f2" : c.tipo === "ingreso" ? "#f0fdf4" : c.tipo === "gasto" ? "#fff7ed" : "#f5f5f5",
                    color: c.tipo === "activo" ? "#2563eb" : c.tipo === "pasivo" ? "#dc2626" : c.tipo === "ingreso" ? "#16a34a" : c.tipo === "gasto" ? "#ea580c" : "#64748b",
                  }}>
                    {c.tipo}
                  </span>
                </td>
                <td style={{ textAlign: "center" }}>
                  {c.permite_apuntes
                    ? <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.85rem" }}>✓</span>
                    : <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderTiposServicios = () => (
    <div className={styles.sectionCard}>
      <div className={styles.listHeaderTop} style={{ margin: "-1.25rem -1.25rem 1.5rem", borderRadius: "1rem 1rem 0 0" }}>
        <div className={styles.listTitleWrapper}>
          <Icons.Servicios size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Tipos de Servicios</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <button className={styles.addActionButton} title="Añadir Tipo de Servicio"
            onClick={() => { setEditingTipo(null); setIsTipoModalOpen(true); }}
            style={{ backgroundColor: "var(--primary-color)", color: "#ffffff" }}>
            <span style={{ fontSize: "1rem", lineHeight: 1 }}>+</span>
          </button>
        </div>
      </div>

      {loadingTipos ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Cargando tipos de servicios...</div>
      ) : tiposServicios.length === 0 ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>No hay tipos de servicios configurados aún. ¡Crea el primero!</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Icono</th>
                <th>Etiqueta</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tiposServicios.map(t => (
                <tr key={t.id}>
                  <td>
                    <div style={{ display: "inline-flex", padding: "0.25rem", borderRadius: "50%", backgroundColor: "#f1f5f9", color: "var(--primary-color)" }}>
                      {renderLucideIcon(t.icono, 16)}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, color: "#0f172a", cursor: "pointer" }}
                    onClick={() => { setEditingTipoForm(t); setIsTipoFormModalOpen(true); }}
                    title="Editar formulario de este tipo">
                    {t.etiqueta}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      <button onClick={() => { setEditingTipoForm(t); setIsTipoFormModalOpen(true); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#334155" }} title="Formulario">
                        <LucideIcons.FileText size={16} />
                      </button>
                      <button onClick={() => { setEditingTipo(t); setIsTipoModalOpen(true); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }} title="Editar">
                        <LucideIcons.Pencil size={16} />
                      </button>
                      <button onClick={() => handleDeleteTipo(t.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }} title="Eliminar">
                        <LucideIcons.Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderApiKeys = () => (
    <div className={styles.tableContainer}>
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Icons.Key size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Claves de API (API Keys)</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <button className={styles.addActionButton} title="Crear API Key" onClick={() => setIsApiKeyModalOpen(true)}>
            <Icons.Add size={18} />
          </button>
        </div>
      </div>
      <table className={styles.table}>
        <thead><tr><th>Nombre</th><th>Clave API</th><th>Fecha de Creación</th><th style={{ textAlign: "right" }}>Estado</th></tr></thead>
        <tbody>
          {apiKeysList.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
              {loadingApiKeys ? "Cargando claves..." : "No hay API Keys configuradas."}
            </td></tr>
          )}
          {apiKeysList.map(k => (
            <tr key={k.id}>
              <td>{k.nombre}</td>
              <td style={{ fontFamily: "monospace", color: "#64748b" }}>{k.key}</td>
              <td>{k.creado}</td>
              <td style={{ textAlign: "right" }}>
                <span className={`${styles.statusTag} ${k.estado === "Activa" ? styles.statusSuccess : styles.statusPending}`}>
                  {k.estado}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "personalizar":   return renderPersonalizar();
      case "usuarios":       return renderUsuarios();
      case "oficinas":       return renderOficinas();
      case "cuentas":        return renderCuentas();
      case "tiposServicios": return renderTiposServicios();
      case "apikeys":        return renderApiKeys();
      default:               return null;
    }
  };

  return (
    <div className={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", width: "100%" }}>
        <h1 className={styles.title} style={{ margin: 0 }}>Ajustes</h1>
      </div>

      <div className={styles.settingsLayout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>MENÚ</span>
          </div>
          <nav className={styles.nav}>
            {SECTIONS.map(section => (
              <button
                key={section.id}
                className={`${styles.navItem} ${activeSection === section.id ? styles.active : ""}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className={styles.content}>
          {renderContent()}
        </section>
      </div>

      <ModalOficina
        isOpen={isOficinaModalOpen}
        onClose={() => setIsOficinaModalOpen(false)}
        onSuccess={fetchOficinas}
      />

      <ModalCuenta
        isOpen={isCuentaModalOpen}
        onClose={() => setIsCuentaModalOpen(false)}
        editingCuenta={editingCuenta}
        oficinas={oficinas}
        onSuccess={fetchCuentas}
      />

      <ModalUsuario
        isOpen={isUsuarioModalOpen}
        onClose={() => setIsUsuarioModalOpen(false)}
        editingUsuario={editingUsuario}
        oficinas={oficinas}
        cuentasBancarias={cuentasBancarias}
        onSuccess={fetchUsuarios}
      />

      <ModalTipoServicio
        isOpen={isTipoModalOpen}
        onClose={() => setIsTipoModalOpen(false)}
        editingTipo={editingTipo}
        onSuccess={fetchTiposServicios}
      />

      <ModalTipoForm
        isOpen={isTipoFormModalOpen}
        onClose={() => setIsTipoFormModalOpen(false)}
        editingTipoForm={editingTipoForm}
        onSuccess={fetchTiposServicios}
      />

      <ModalApiKey
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSuccess={fetchApiKeys}
      />
    </div>
  );
}
