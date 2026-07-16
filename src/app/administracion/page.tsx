"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptAgencySecrets, encryptAnonKey } from "@/actions/agencias";
import { Icons } from "@/lib/icons";
import listStyles from "../expedientes/page.module.css";
import styles from "./page.module.css";

interface Agencia {
  id: string;
  nombre_comercial: string;
  razon_social: string | null;
  cif_nif: string;
  slug: string;
  plan_tipo: string | null;
  capacidad_tipo: string | null;
  estado: string | null;
  fecha_alta: string | null;
  email_general: string | null;
  telefono_general: string | null;
  direccion_central: string | null;
  color_corporativo: string | null;
  logo_url: string | null;
  subtenants_count?: number;
  agentes_count?: number;
  cuota_mensual?: number;
  active_modules?: {
    radar_activo: boolean;
    studio_activo: boolean;
    core_activo: boolean;
    pulse_activo: boolean;
    ledger_tax_activo: boolean;
  };
  tipo?: string;
}

interface NuevaAgenciaForm {
  nombre_comercial: string;
  razon_social: string;
  cif_nif: string;
  slug: string;
  supabase_url: string;
  supabase_service_role_key_enc: string;
  supabase_anon_key: string;
  email_general: string;
  telefono_general: string;
  direccion_central: string;
  color_corporativo: string;
  plan_tipo: string;
  capacidad_tipo: string;
  radar_activo: boolean;
  studio_activo: boolean;
  core_activo: boolean;
  pulse_activo: boolean;
  ledger_tax_activo: boolean;
}

const FORM_EMPTY: NuevaAgenciaForm = {
  nombre_comercial: "",
  razon_social: "",
  cif_nif: "",
  slug: "",
  supabase_url: "",
  supabase_service_role_key_enc: "",
  supabase_anon_key: "",
  email_general: "",
  telefono_general: "",
  direccion_central: "",
  color_corporativo: "#475569",
  plan_tipo: "Basic",
  capacidad_tipo: "Starter",
  radar_activo: true,
  studio_activo: true,
  core_activo: true,
  pulse_activo: false,
  ledger_tax_activo: false,
};

export default function AdministracionPage() {
  // Auth state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [showLoginTooltip, setShowLoginTooltip] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const loginTooltipRef = useRef<HTMLDivElement>(null);
  const loginBtnRef = useRef<HTMLButtonElement>(null);

  // Data state
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAgenciaId, setEditingAgenciaId] = useState<string | null>(null);
  const [form, setForm] = useState<NuevaAgenciaForm>(FORM_EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Owner creation state
  const [ownerModalAgenciaId, setOwnerModalAgenciaId] = useState<string | null>(null);
  const [ownerForm, setOwnerForm] = useState({ nombre: "", apellidos: "", email: "", telefono: "", modo: "invitar", password: "" });
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerSuccess, setOwnerSuccess] = useState<string | null>(null);

  // Check existing session on mount
  useEffect(() => {
    checkSession();

    const { data: listener } = supabaseAdmin.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsSuperAdmin(false);
        setCurrentUserName(null);
        setAgencias([]);
        setAuthLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Close tooltip on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        loginTooltipRef.current &&
        !loginTooltipRef.current.contains(e.target as Node) &&
        loginBtnRef.current &&
        !loginBtnRef.current.contains(e.target as Node)
      ) {
        setShowLoginTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function checkSession() {
    setAuthLoading(true);
    const { data: { session } } = await supabaseAdmin.auth.getSession();
    if (session?.user) {
      await verifyAndLoadUser(session.user.id, session.access_token);
    } else {
      setAuthLoading(false);
    }
  }

  // Verifica el rol consultando la tabla usuarios por auth_user_id usando nuestra API interna para evitar RLS y bundler hangs
  async function verifyAndLoadUser(authUserId: string, accessToken: string) {
    try {
      let data = null;
      const res = await fetch(`/api/perfil?authUserId=${authUserId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const resData = await res.json();
        data = resData.usuario;
      }

      if (!data) {
        setIsSuperAdmin(false);
        setCurrentUserName(null);
        return;
      }

      if (data.rol === "SuperAdmin") {
        setIsSuperAdmin(true);
        setCurrentUserName(`${data.nombre} ${data.apellidos}`.trim());
        await loadAgencias();
      } else {
        // Rol insuficiente — cerrar sesión
        await supabaseAdmin.auth.signOut();
        setIsSuperAdmin(false);
        setCurrentUserName(null);
      }
    } catch {
      setIsSuperAdmin(false);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Introduce email y contraseña.");
      return;
    }
    try {
      setLoginLoading(true);
      setLoginError(null);

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;

      // Verificar rol en la tabla usuarios usando nuestra API interna para evitar RLS
      let userData = null;
      const res = await fetch(`/api/perfil?authUserId=${data.user.id}`, {
        headers: { Authorization: `Bearer ${data.session?.access_token}` },
      });
      if (res.ok) {
        const resData = await res.json();
        userData = resData.usuario;
      }

      if (!userData || userData.rol !== "SuperAdmin") {
        await supabaseAdmin.auth.signOut();
        setLoginError("Acceso denegado. Se requiere rol SuperAdmin.");
        return;
      }

      setIsSuperAdmin(true);
      setCurrentUserName(`${userData.nombre} ${userData.apellidos}`.trim());
      setShowLoginTooltip(false);
      setLoginEmail("");
      setLoginPassword("");
      await loadAgencias();
    } catch (err: any) {
      setLoginError(err?.message || "Error al iniciar sesión.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await supabaseAdmin.auth.signOut();
    setIsSuperAdmin(false);
    setCurrentUserName(null);
    setAgencias([]);
  }

  async function loadAgencias() {
    try {
      setDataLoading(true);
      const res = await fetch('/api/administracion/agencias');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAgencias(json.agencias ?? []);
    } catch (err) {
      console.error("Error al cargar agencias:", err);
      setAgencias([]);
    } finally {
      setDataLoading(false);
    }
  }

  async function handleGuardar() {
    if (!form.nombre_comercial || !form.cif_nif || !form.slug) {
      setSaveError("Los campos Nombre, CIF/NIF y Slug son obligatorios.");
      return;
    }
    if (!editingAgenciaId && (!form.supabase_url || !form.supabase_service_role_key_enc)) {
      setSaveError("Al crear, los campos Supabase URL y Service Key son obligatorios.");
      return;
    }
    try {
      setSaving(true);
      setSaveError(null);
      
      let payload: any = {
        nombre_comercial: form.nombre_comercial,
        razon_social: form.razon_social || null,
        cif_nif: form.cif_nif,
        slug: form.slug,
        email_general: form.email_general || null,
        telefono_general: form.telefono_general || null,
        direccion_central: form.direccion_central || null,
        color_corporativo: form.color_corporativo || null,
        plan_tipo: form.plan_tipo,
        capacidad_tipo: form.capacidad_tipo,
        radar_activo: form.radar_activo,
        studio_activo: form.studio_activo,
        core_activo: form.core_activo,
        pulse_activo: form.pulse_activo,
        ledger_tax_activo: form.ledger_tax_activo,
      };

      if (form.supabase_url) {
        payload.supabase_url = form.supabase_url;
      }

      if (!editingAgenciaId) {
        payload.estado = "Activo";
      }

      if (form.supabase_service_role_key_enc) {
        const encryptedSecrets = await encryptAgencySecrets(
          form.supabase_service_role_key_enc,
          form.supabase_anon_key || undefined
        );
        payload.supabase_service_role_key_enc = encryptedSecrets.supabase_service_role_key_enc;
        payload.encryption_iv = encryptedSecrets.iv;
        payload.iv = encryptedSecrets.iv;
        payload.auth_tag = encryptedSecrets.auth_tag;
        if (encryptedSecrets.supabase_anon_key_enc) {
          payload.supabase_anon_key_enc = encryptedSecrets.supabase_anon_key_enc;
          payload.supabase_anon_key_iv  = encryptedSecrets.supabase_anon_key_iv;
          payload.supabase_anon_key_tag = encryptedSecrets.supabase_anon_key_tag;
        }
      } else if (form.supabase_anon_key) {
        // Actualizar solo la anon key sin tocar la service role
        const encrypted = await encryptAnonKey(form.supabase_anon_key);
        payload.supabase_anon_key_enc = encrypted.supabase_anon_key_enc;
        payload.supabase_anon_key_iv  = encrypted.supabase_anon_key_iv;
        payload.supabase_anon_key_tag = encrypted.supabase_anon_key_tag;
      }

      if (editingAgenciaId) {
        const res = await fetch(`/api/administracion/agencias?id=${editingAgenciaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Error al actualizar');
      } else {
        const res = await fetch('/api/administracion/agencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Error al crear');
      }
      
      setShowModal(false);
      setEditingAgenciaId(null);
      setForm(FORM_EMPTY);
      await loadAgencias();
    } catch (err: any) {
      setSaveError(err?.message || "Error al guardar la agencia.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateOwner() {
    if (!ownerModalAgenciaId) return;
    if (!ownerForm.nombre || !ownerForm.email) {
      setOwnerError("Nombre y email son obligatorios.");
      return;
    }
    if (ownerForm.modo === "directo" && ownerForm.password.length < 6) {
      setOwnerError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    try {
      setOwnerSaving(true);
      setOwnerError(null);
      const res = await fetch('/api/administracion/agencias/owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencia_id: ownerModalAgenciaId, ...ownerForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear el usuario Owner');

      setOwnerSuccess(
        ownerForm.modo === "directo"
          ? `Usuario creado. Ya puede iniciar sesión con ${ownerForm.email} y la contraseña indicada.`
          : `Invitación enviada a ${ownerForm.email}.`
      );
      setOwnerForm({ nombre: "", apellidos: "", email: "", telefono: "", modo: "invitar", password: "" });
      await loadAgencias();
    } catch (err: any) {
      setOwnerError(err?.message || "Error al crear el usuario Owner.");
    } finally {
      setOwnerSaving(false);
    }
  }

  function handleSlugAutoComplete(nombre: string) {
    const slug = nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    setForm((f) => ({ ...f, nombre_comercial: nombre, slug }));
  }

  const filteredAgencias = agencias.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.nombre_comercial.toLowerCase().includes(q) ||
      a.cif_nif.toLowerCase().includes(q) ||
      (a.email_general && a.email_general.toLowerCase().includes(q)) ||
      (a.direccion_central && a.direccion_central.toLowerCase().includes(q))
    );
  });

  return (
    <div className={listStyles.container}>
      {/* HEADER */}
      <header className={listStyles.header} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className={listStyles.title}>Administración de tenants</h1>

        {/* LOGIN / LOGOUT */}
        <div className={styles.loginArea}>
          {isSuperAdmin ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className={styles.superAdminBadge}>
                <Icons.Key size={11} />
                {currentUserName || "SuperAdmin"}
              </span>
              <button className={styles.logoutBtn} onClick={handleLogout} title="Cerrar sesión">
                <Icons.Logout size={15} />
              </button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <button
                ref={loginBtnRef}
                className={styles.loginBtn}
                onClick={() => { setShowLoginTooltip(v => !v); setLoginError(null); }}
                title="Iniciar sesión como SuperAdmin"
              >
                <Icons.Key size={15} />
                <span>Acceder</span>
              </button>

              {showLoginTooltip && (
                <div className={styles.loginTooltip} ref={loginTooltipRef}>
                  <div className={styles.loginTooltipArrow} />
                  <p className={styles.loginTooltipTitle}>Acceso SuperAdmin</p>
                  <form onSubmit={handleLogin} className={styles.loginForm}>
                    <div className={styles.loginField}>
                      <label className={styles.loginLabel}>Email</label>
                      <input
                        type="email"
                        autoFocus
                        className={styles.loginInput}
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="admin@ejemplo.com"
                      />
                    </div>
                    <div className={styles.loginField}>
                      <label className={styles.loginLabel}>Contraseña</label>
                      <input
                        type="password"
                        className={styles.loginInput}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    {loginError && <p className={styles.loginError}>{loginError}</p>}
                    <button type="submit" className={styles.loginSubmit} disabled={loginLoading}>
                      {loginLoading ? "Verificando..." : "Iniciar sesión"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* CONTENIDO */}
      {authLoading ? (
        <div className={styles.accessDenied}>
          <p style={{ color: "#94a3b8" }}>Verificando sesión...</p>
        </div>
      ) : !isSuperAdmin ? (
        <div className={styles.accessDenied}>
          <Icons.Key size={36} style={{ color: "#cbd5e1", marginBottom: "0.75rem" }} />
          <p>Acceso restringido a usuarios con rol <strong>SuperAdmin</strong>.</p>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            Pulsa <strong>Acceder</strong> en la esquina superior derecha para identificarte.
          </p>
        </div>
      ) : (
        <>
          {/* LISTADO */}
          <div className={listStyles.tableContainer}>
            <div className={listStyles.listHeaderTop}>
              <div className={listStyles.listTitleWrapper}>
                <Icons.Landmark size={18} className={listStyles.titleIcon} />
                <h2 className={listStyles.listTitle}>Agencias ({filteredAgencias.length})</h2>
              </div>
              <div className={listStyles.actionsWrapper}>
                <div className={listStyles.searchWrapper}>
                  <Icons.Search size={16} className={listStyles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Buscar agencia..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={listStyles.searchInput}
                  />
                </div>
                <button
                  className={listStyles.addActionButton}
                  title="Añadir Agencia"
                  onClick={() => { setEditingAgenciaId(null); setForm(FORM_EMPTY); setShowModal(true); setSaveError(null); }}
                >
                  <Icons.Add size={18} />
                </button>
              </div>
            </div>

            <table className={listStyles.table}>
              <thead>
                <tr>
                  <th>Agencia</th>
                  <th>CIF / NIF</th>
                  <th>Contacto</th>
                  <th style={{ textAlign: "center" }}>Agencias</th>
                  <th style={{ textAlign: "center" }}>Agentes</th>
                  <th>Módulos</th>
                  <th>Tipo</th>
                  <th>Cuota</th>
                  <th style={{ textAlign: "right" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {dataLoading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                      Cargando agencias...
                    </td>
                  </tr>
                ) : filteredAgencias.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                      {searchQuery ? "No se encontraron agencias que coincidan." : "No hay agencias registradas. Pulsa + para añadir la primera."}
                    </td>
                  </tr>
                ) : (
                  filteredAgencias.map((agencia) => (
                    <tr key={agencia.id} className={listStyles.clickableRow}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          {agencia.color_corporativo && (
                            <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: agencia.color_corporativo, flexShrink: 0 }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.825rem" }}>{agencia.nombre_comercial}</div>
                            {agencia.razon_social && <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{agencia.razon_social}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{agencia.cif_nif}</td>
                      <td>
                        <div style={{ fontSize: "0.8rem", color: "#334155" }}>{agencia.email_general || "-"}</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{agencia.telefono_general || ""}</div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>
                          <strong>{agencia.subtenants_count ?? 0}</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>
                          <strong>{agencia.agentes_count ?? 0}</strong>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <span title="RADAR (CRM)" style={{ opacity: agencia.active_modules?.radar_activo ? 1 : 0.25, color: agencia.active_modules?.radar_activo ? "#3189F4" : "#64748b" }}>
                            <Icons.Target size={16} strokeWidth={2.8} />
                          </span>
                          <span title="STUDIO (Propuestas)" style={{ opacity: agencia.active_modules?.studio_activo ? 1 : 0.25, color: agencia.active_modules?.studio_activo ? "#41CDD7" : "#64748b" }}>
                            <Icons.Presupuestos size={16} strokeWidth={2.8} />
                          </span>
                          <span title="CORE (Expedientes)" style={{ opacity: agencia.active_modules?.core_activo ? 1 : 0.25, color: agencia.active_modules?.core_activo ? "#6F38E6" : "#64748b" }}>
                            <Icons.Expedientes size={16} strokeWidth={2.8} />
                          </span>
                          <span title="PULSE (Fidelización)" style={{ opacity: agencia.active_modules?.pulse_activo ? 1 : 0.25, color: agencia.active_modules?.pulse_activo ? "#F62976" : "#64748b" }}>
                            <Icons.Heart size={16} strokeWidth={2.8} />
                          </span>
                          <span title="AUDIT (Contabilidad)" style={{ opacity: agencia.active_modules?.ledger_tax_activo ? 1 : 0.25, color: agencia.active_modules?.ledger_tax_activo ? "#FFE04D" : "#64748b" }}>
                            <Icons.Euro size={16} strokeWidth={2.8} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusTag} ${agencia.tipo === "Growth" ? styles.statusPremium : styles.statusBasic}`}>
                          {agencia.tipo || "Starter"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.85rem" }}>
                        {agencia.cuota_mensual !== undefined ? `${agencia.cuota_mensual.toFixed(2)} €` : "-"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", alignItems: "center" }}>
                          <span className={`${styles.statusTag} ${agencia.estado === "Activo" ? styles.statusSuccess : styles.statusPending}`}>
                            {agencia.estado || "Activo"}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAgenciaId(agencia.id);
                              setForm({
                                ...FORM_EMPTY,
                                nombre_comercial: agencia.nombre_comercial,
                                razon_social: agencia.razon_social || "",
                                cif_nif: agencia.cif_nif,
                                slug: agencia.slug,
                                email_general: agencia.email_general || "",
                                telefono_general: agencia.telefono_general || "",
                                direccion_central: agencia.direccion_central || "",
                                color_corporativo: agencia.color_corporativo || "#475569",
                                plan_tipo: agencia.plan_tipo || "Basic",
                                capacidad_tipo: agencia.capacidad_tipo || "Starter",
                                radar_activo: agencia.active_modules?.radar_activo ?? true,
                                studio_activo: agencia.active_modules?.studio_activo ?? true,
                                core_activo: agencia.active_modules?.core_activo ?? true,
                                pulse_activo: agencia.active_modules?.pulse_activo ?? false,
                                ledger_tax_activo: agencia.active_modules?.ledger_tax_activo ?? false,
                              });
                              setShowModal(true);
                            }}
                            title="Editar Agencia"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                          >
                            <Icons.Edit size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOwnerModalAgenciaId(agencia.id);
                              setOwnerForm({ nombre: "", apellidos: "", email: "", telefono: "", modo: "invitar", password: "" });
                              setOwnerError(null);
                              setOwnerSuccess(null);
                            }}
                            title="Crear usuario Owner"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                          >
                            <Icons.Key size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MODAL NUEVA AGENCIA */}
          {showModal && (
            <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>{editingAgenciaId ? "Editar Agencia" : "Nueva Agencia"}</h2>
                  <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                    <Icons.ChevronDown size={18} style={{ transform: "rotate(45deg)" }} />
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Nombre Comercial *</label>
                      <input className={styles.formInput} value={form.nombre_comercial}
                        onChange={(e) => handleSlugAutoComplete(e.target.value)}
                        placeholder="Viajes Ejemplo S.L." />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Razón Social</label>
                      <input className={styles.formInput} value={form.razon_social}
                        onChange={(e) => setForm(f => ({ ...f, razon_social: e.target.value }))}
                        placeholder="Viajes Ejemplo S.L.U." />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>CIF / NIF *</label>
                      <input className={styles.formInput} value={form.cif_nif}
                        onChange={(e) => setForm(f => ({ ...f, cif_nif: e.target.value }))}
                        placeholder="B12345678" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Slug *</label>
                      <input className={styles.formInput} value={form.slug}
                        onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
                        placeholder="viajes-ejemplo" />
                    </div>
                    <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                      <label className={styles.formLabel}>Supabase URL {!editingAgenciaId && "*"}</label>
                      <input className={styles.formInput} value={form.supabase_url}
                        onChange={(e) => setForm(f => ({ ...f, supabase_url: e.target.value }))}
                        placeholder={editingAgenciaId ? "Dejar en blanco para mantener el actual" : "https://xxxxxxxxxxxx.supabase.co"} />
                    </div>
                    <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                      <label className={styles.formLabel}>Supabase Service Role Key {!editingAgenciaId && "*"}</label>
                      <input className={styles.formInput} type="password" value={form.supabase_service_role_key_enc}
                        onChange={(e) => setForm(f => ({ ...f, supabase_service_role_key_enc: e.target.value }))}
                        placeholder={editingAgenciaId ? "Dejar en blanco para mantener la actual" : "eyJhbGci..."} />
                    </div>
                    <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                      <label className={styles.formLabel}>Supabase Anon Key</label>
                      <input className={styles.formInput} type="password" value={form.supabase_anon_key}
                        onChange={(e) => setForm(f => ({ ...f, supabase_anon_key: e.target.value }))}
                        placeholder={editingAgenciaId ? "Dejar en blanco para mantener la actual" : "eyJhbGci..."} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Email General</label>
                      <input className={styles.formInput} type="email" value={form.email_general}
                        onChange={(e) => setForm(f => ({ ...f, email_general: e.target.value }))}
                        placeholder="info@agencia.com" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Teléfono</label>
                      <input className={styles.formInput} value={form.telefono_general}
                        onChange={(e) => setForm(f => ({ ...f, telefono_general: e.target.value }))}
                        placeholder="+34 910 000 000" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Dirección Central</label>
                      <input className={styles.formInput} value={form.direccion_central}
                        onChange={(e) => setForm(f => ({ ...f, direccion_central: e.target.value }))}
                        placeholder="Calle Mayor 1, Madrid" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Color Corporativo</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input type="color" value={form.color_corporativo}
                          onChange={(e) => setForm(f => ({ ...f, color_corporativo: e.target.value }))}
                          style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                        <input className={styles.formInput} value={form.color_corporativo}
                          onChange={(e) => setForm(f => ({ ...f, color_corporativo: e.target.value }))}
                          placeholder="#475569" style={{ fontFamily: "monospace" }} />
                      </div>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Plan</label>
                      <select className={styles.formInput} value={form.plan_tipo}
                        onChange={(e) => setForm(f => ({ ...f, plan_tipo: e.target.value }))}>
                        <option value="Basic">Basic</option>
                        <option value="Premium">Premium</option>
                        <option value="Enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Capacidad</label>
                      <select className={styles.formInput} value={form.capacidad_tipo}
                        onChange={(e) => setForm(f => ({ ...f, capacidad_tipo: e.target.value }))}>
                        <option value="Starter">Starter (sin sucursales)</option>
                        <option value="Growth">Growth (con sucursales)</option>
                      </select>
                    </div>
                    <div className={styles.formGroup} style={{ gridColumn: "span 2", marginTop: "1rem" }}>
                      <label className={styles.formLabel} style={{ fontWeight: 600, borderBottom: "1px solid #e2e8f0", paddingBottom: "0.25rem", marginBottom: "0.5rem" }}>
                        Módulos Suscritos (Capa 1)
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "0.5rem" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
                          <input type="checkbox" checked={form.radar_activo} onChange={(e) => setForm(f => ({ ...f, radar_activo: e.target.checked }))} />
                          RADAR (CRM)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
                          <input type="checkbox" checked={form.studio_activo} onChange={(e) => setForm(f => ({ ...f, studio_activo: e.target.checked }))} />
                          STUDIO (Propuestas)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
                          <input type="checkbox" checked={form.core_activo} onChange={(e) => setForm(f => ({ ...f, core_activo: e.target.checked }))} />
                          CORE (Expedientes)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
                          <input type="checkbox" checked={form.pulse_activo} onChange={(e) => setForm(f => ({ ...f, pulse_activo: e.target.checked }))} />
                          PULSE (Fidelización)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
                          <input type="checkbox" checked={form.ledger_tax_activo} onChange={(e) => setForm(f => ({ ...f, ledger_tax_activo: e.target.checked }))} />
                          AUDIT (Contabilidad)
                        </label>
                      </div>
                    </div>
                  </div>
                  {saveError && <div className={styles.formError}>{saveError}</div>}
                </div>
                <div className={styles.modalFooter}>
                  <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
                  <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar Agencia"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL CREAR OWNER */}
          {ownerModalAgenciaId && (
            <div className={styles.modalOverlay} onClick={() => setOwnerModalAgenciaId(null)}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Crear usuario Owner</h2>
                  <button className={styles.modalClose} onClick={() => setOwnerModalAgenciaId(null)}>
                    <Icons.ChevronDown size={18} style={{ transform: "rotate(45deg)" }} />
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                    <label className={styles.formLabel}>Modo de alta</label>
                    <select className={styles.formInput} value={ownerForm.modo}
                      onChange={(e) => setOwnerForm(f => ({ ...f, modo: e.target.value }))}>
                      <option value="invitar">Invitar por email (el usuario fija su contraseña)</option>
                      <option value="directo">Crear directo con contraseña (útil para emails ficticios de demo)</option>
                    </select>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>
                    {ownerForm.modo === "directo"
                      ? "El usuario se crea con el email ya confirmado y podrá iniciar sesión de inmediato con la contraseña que definas."
                      : "Se enviará un email de invitación para que el usuario establezca su contraseña y pueda acceder como Owner de esta agencia."}
                  </p>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Nombre *</label>
                      <input className={styles.formInput} value={ownerForm.nombre}
                        onChange={(e) => setOwnerForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Nombre" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Apellidos</label>
                      <input className={styles.formInput} value={ownerForm.apellidos}
                        onChange={(e) => setOwnerForm(f => ({ ...f, apellidos: e.target.value }))}
                        placeholder="Apellidos" />
                    </div>
                    <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                      <label className={styles.formLabel}>Email *</label>
                      <input className={styles.formInput} type="email" value={ownerForm.email}
                        onChange={(e) => setOwnerForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="owner@agencia.com" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Teléfono</label>
                      <input className={styles.formInput} value={ownerForm.telefono}
                        onChange={(e) => setOwnerForm(f => ({ ...f, telefono: e.target.value }))}
                        placeholder="+34 600 000 000" />
                    </div>
                    {ownerForm.modo === "directo" && (
                      <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                        <label className={styles.formLabel}>Contraseña *</label>
                        <input className={styles.formInput} type="password" value={ownerForm.password}
                          onChange={(e) => setOwnerForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="Mínimo 6 caracteres" />
                      </div>
                    )}
                  </div>
                  {ownerError && <div className={styles.formError}>{ownerError}</div>}
                  {ownerSuccess && <div style={{ color: "#16a34a", fontSize: "0.8rem", marginTop: "0.5rem" }}>{ownerSuccess}</div>}
                </div>
                <div className={styles.modalFooter}>
                  <button className={styles.btnSecondary} onClick={() => setOwnerModalAgenciaId(null)}>Cerrar</button>
                  <button className={styles.btnPrimary} onClick={handleCreateOwner} disabled={ownerSaving}>
                    {ownerSaving ? "Guardando..." : ownerForm.modo === "directo" ? "Crear usuario" : "Enviar invitación"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
