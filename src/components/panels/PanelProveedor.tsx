"use client";

import { useState, useEffect, useRef } from "react";
import { X, Building2, Phone, Mail, MapPin, FolderOpen, Package, Landmark, ChevronDown, ChevronRight, Plus, Tag, Tags, Pencil, Calculator } from "lucide-react";
import { getProveedorResumen, updateProveedorAlias, updateProveedor } from "@/actions/proveedores";
import TipoIcon from "@/app/components/cotizacion/TipoIcon";
import { MiniPager, useMiniPager } from "@/components/panels/MiniPager";

export type ProveedorDetalle = {
  id: string;
  nombre: string | null;
  razon_social?: string | null;
  tipo?: string | null;
  CIF?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  localidad?: string | null;
  comunidad?: string | null;
  pais?: string | null;
  nombre_contacto?: string | null;
  cargo?: string | null;
  observaciones?: string | null;
  alias?: string[] | null;
};

const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" };
const th: React.CSSProperties = { textAlign: "left", padding: "0.3rem 0.5rem 0.3rem 0", fontWeight: 600, color: "#94a3b8", fontSize: "0.65rem", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "0.4rem 0.5rem 0.4rem 0", color: "#1e293b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const inp: React.CSSProperties = { width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.55rem", borderRadius: 6, border: "1.5px solid #e2e8f0", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

function SeccionColapsable({ icon, titulo, count, isOpen, onToggle, children }: {
  icon: React.ReactNode;
  titulo: string;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: isOpen ? "0.5rem" : 0, userSelect: "none" }}
      >
        {isOpen ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
        <span style={{ display: "flex", color: "#64748b" }}>{icon}</span>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", flex: 1 }}>
          {titulo}{count !== undefined && ` (${count})`}
        </div>
      </div>
      {isOpen && children}
    </section>
  );
}

export function PanelProveedor({ proveedor, onClose }: { proveedor: ProveedorDetalle; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [totalPagado, setTotalPagado] = useState(0);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ datos: true, alias: false, tipos: false, cotizaciones: false, expedientes: false, pagos: false });
  const [pagCotizaciones, setPagCotizaciones] = useState(0);
  const [pagExpedientes, setPagExpedientes] = useState(0);
  const [pagPagos, setPagPagos] = useState(0);
  const [alias, setAlias] = useState<string[]>(proveedor.alias ?? []);
  const [nuevoAlias, setNuevoAlias] = useState("");
  const [savingAlias, setSavingAlias] = useState(false);
  const [showNuevoAlias, setShowNuevoAlias] = useState(false);
  const aliasPickerRef = useRef<HTMLDivElement | null>(null);

  const [proveedorLocal, setProveedorLocal] = useState<ProveedorDetalle>(proveedor);
  const [hoveredDatos, setHoveredDatos] = useState(false);
  const [editingDatos, setEditingDatos] = useState(false);
  const [savingDatos, setSavingDatos] = useState(false);
  const [datosForm, setDatosForm] = useState({
    nombre: "", razon_social: "", cif: "", tipo: "", email: "", telefono: "",
    direccion: "", codigo_postal: "", localidad: "", comunidad: "", pais: "",
    nombre_contacto: "", cargo: "", observaciones: "",
  });

  useEffect(() => { setProveedorLocal(proveedor); }, [proveedor]);

  function abrirEdicionDatos() {
    setDatosForm({
      nombre: proveedorLocal.nombre ?? "",
      razon_social: proveedorLocal.razon_social ?? "",
      cif: proveedorLocal.CIF ?? "",
      tipo: proveedorLocal.tipo ?? "",
      email: proveedorLocal.email ?? "",
      telefono: proveedorLocal.telefono ?? "",
      direccion: proveedorLocal.direccion ?? "",
      codigo_postal: proveedorLocal.codigo_postal ?? "",
      localidad: proveedorLocal.localidad ?? "",
      comunidad: proveedorLocal.comunidad ?? "",
      pais: proveedorLocal.pais ?? "",
      nombre_contacto: proveedorLocal.nombre_contacto ?? "",
      cargo: proveedorLocal.cargo ?? "",
      observaciones: proveedorLocal.observaciones ?? "",
    });
    setEditingDatos(true);
  }

  const setDF = (key: keyof typeof datosForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDatosForm(prev => ({ ...prev, [key]: e.target.value }));

  async function guardarDatos() {
    setSavingDatos(true);
    try {
      const res = await updateProveedor(proveedorLocal.id, {
        nombre: datosForm.nombre,
        razon_social: datosForm.razon_social,
        cif: datosForm.cif,
        tipo: datosForm.tipo,
        email: datosForm.email,
        telefono: datosForm.telefono,
        direccion: datosForm.direccion,
        codigo_postal: datosForm.codigo_postal,
        localidad: datosForm.localidad,
        comunidad: datosForm.comunidad,
        pais: datosForm.pais,
        nombre_contacto: datosForm.nombre_contacto,
        cargo: datosForm.cargo,
        observaciones: datosForm.observaciones,
      });
      if (res.success) {
        setProveedorLocal(prev => ({ ...prev, ...res.data }));
        setEditingDatos(false);
      }
    } finally {
      setSavingDatos(false);
    }
  }

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (aliasPickerRef.current && !aliasPickerRef.current.contains(e.target as Node)) {
        setShowNuevoAlias(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setAlias(proveedor.alias ?? []);
  }, [proveedor.id]);

  async function guardarAlias(nuevaLista: string[]) {
    setSavingAlias(true);
    try {
      const res = await updateProveedorAlias(proveedor.id, nuevaLista);
      if (res.success) setAlias(res.data.alias ?? nuevaLista);
    } finally {
      setSavingAlias(false);
    }
  }

  function handleAnadirAlias() {
    const valor = nuevoAlias.trim();
    if (!valor || alias.includes(valor)) { setNuevoAlias(""); setShowNuevoAlias(false); return; }
    const nuevaLista = [...alias, valor];
    setAlias(nuevaLista);
    setNuevoAlias("");
    setShowNuevoAlias(false);
    guardarAlias(nuevaLista);
  }

  function handleEliminarAlias(valor: string) {
    const nuevaLista = alias.filter((a) => a !== valor);
    setAlias(nuevaLista);
    guardarAlias(nuevaLista);
  }

  useEffect(() => {
    if (!proveedor?.id) return;
    setLoading(true);
    getProveedorResumen(proveedor.id)
      .then(({ cotizaciones, servicios, pagos, totalPagado }) => {
        setCotizaciones(cotizaciones);
        setServicios(servicios);
        setPagos(pagos);
        setTotalPagado(totalPagado);
      })
      .finally(() => setLoading(false));
  }, [proveedor?.id]);

  if (!proveedor) return null;

  const direccionCompleta = [proveedorLocal.direccion, proveedorLocal.codigo_postal, proveedorLocal.localidad, proveedorLocal.comunidad, proveedorLocal.pais]
    .filter(Boolean)
    .join(", ");

  const tiposServicio = Array.from(
    cotizaciones.reduce((map: Map<string, { etiqueta: string; icono?: string }>, c: any) => {
      const tipo = c.config_tipos_servicios;
      const key = tipo?.id || c.tipo;
      if (key && !map.has(key)) map.set(key, { etiqueta: tipo?.etiqueta || c.tipo || "Sin tipo", icono: tipo?.icono });
      return map;
    }, new Map())
  ).map(([id, v]) => ({ id, ...v }));

  const cotizacionesAgrupadas = Array.from(
    cotizaciones.reduce((map: Map<string, string>, c: any) => {
      const id = c.cotizacion_id;
      if (id && !map.has(id)) map.set(id, c.operativa_cotizaciones?.titulo || "Cotización");
      return map;
    }, new Map<string, string>())
  ).map(([id, titulo]) => ({ id, titulo }));

  const pagadoPorExpediente = pagos.reduce((map: Map<string, number>, p: any) => {
    const id = p.expediente_id;
    if (id) map.set(id, (map.get(id) || 0) + Number(p.importe_total || 0));
    return map;
  }, new Map<string, number>());

  const expedientesAgrupados = Array.from(
    servicios.reduce((map: Map<string, { numero: string; cliente: string; total: number }>, s: any) => {
      const id = s.expediente_id;
      if (!id) return map;
      const exp = s.operativa_expedientes;
      const actual = map.get(id) || {
        numero: exp ? (exp.numero || exp.referencia) : "Expediente",
        cliente: exp?.contabilidad_entidades?.nombre ?? "",
        total: 0,
      };
      actual.total += Number(s.neto || 0) * Number(s.plazas || 1) * (Number(s.noches || 0) || 1);
      map.set(id, actual);
      return map;
    }, new Map<string, { numero: string; cliente: string; total: number }>())
  ).map(([id, v]) => {
    const pagado = pagadoPorExpediente.get(id) || 0;
    const situacion: "pagado" | "parcial" | "pendiente" =
      pagado <= 0 ? "pendiente" : pagado >= v.total - 0.01 ? "pagado" : "parcial";
    return { id, numero: v.numero, cliente: v.cliente, total: v.total, pagado, situacion };
  });

  const pagerCotizaciones = useMiniPager(cotizacionesAgrupadas, [pagCotizaciones, setPagCotizaciones]);
  const pagerExpedientes = useMiniPager(expedientesAgrupados, [pagExpedientes, setPagExpedientes]);
  const pagerPagos = useMiniPager(pagos, [pagPagos, setPagPagos]);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 1000 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 680, zIndex: 1001,
        background: "#fff",
        boxShadow: "-8px 0 32px rgba(15,23,42,0.12)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.25rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              {proveedorLocal.tipo || "Proveedor"}
            </div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.3, margin: 0, wordBreak: "break-word" }}>
              {proveedorLocal.nombre}
            </h2>
            {proveedorLocal.razon_social && proveedorLocal.razon_social !== proveedorLocal.nombre && (
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>{proveedorLocal.razon_social}</div>
            )}
          </div>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "#f1f5f9", borderRadius: "0.4rem", cursor: "pointer", color: "#64748b", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.5rem 1.25rem", background: "#eef2f7", borderBottom: "1px solid #e2e8f0", fontSize: "0.75rem", color: "#475569", fontWeight: 500 }}>
            <span style={{
              width: 12, height: 12, borderRadius: "50%",
              border: "2px solid #cbd5e1", borderTopColor: "var(--primary-color, #475569)",
              animation: "spin 0.7s linear infinite", flexShrink: 0,
            }} />
            Cargando datos del proveedor…
          </div>
        )}

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Datos del proveedor */}
          <SeccionColapsable
            icon={<Building2 size={17} />}
            titulo="Datos del proveedor"
            isOpen={!!openSections.datos}
            onToggle={() => toggleSection("datos")}
          >
            <div
              onMouseEnter={() => setHoveredDatos(true)}
              onMouseLeave={() => setHoveredDatos(false)}
              onClick={() => !editingDatos && abrirEdicionDatos()}
              style={{ position: "relative", cursor: editingDatos ? "default" : "pointer" }}
            >
              {!editingDatos && (
                <Pencil
                  size={11}
                  style={{ position: "absolute", top: -18, right: 0, color: "#94a3b8", opacity: hoveredDatos ? 1 : 0, transition: "opacity 0.12s", pointerEvents: "none" }}
                />
              )}

              {editingDatos ? (
                <div style={{ border: "1.5px solid var(--primary-color, #475569)", borderRadius: "0.75rem", padding: "1rem", background: "#fff", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Nombre</label>
                      <input value={datosForm.nombre} onChange={setDF("nombre")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Razón social</label>
                      <input value={datosForm.razon_social} onChange={setDF("razon_social")} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>CIF/NIF</label>
                      <input value={datosForm.cif} onChange={setDF("cif")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Tipo</label>
                      <input value={datosForm.tipo} onChange={setDF("tipo")} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Teléfono</label>
                      <input value={datosForm.telefono} onChange={setDF("telefono")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Email</label>
                      <input value={datosForm.email} onChange={setDF("email")} style={inp} />
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Dirección</label>
                    <input value={datosForm.direccion} onChange={setDF("direccion")} style={inp} />
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Código postal</label>
                      <input value={datosForm.codigo_postal} onChange={setDF("codigo_postal")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Localidad</label>
                      <input value={datosForm.localidad} onChange={setDF("localidad")} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Comunidad</label>
                      <input value={datosForm.comunidad} onChange={setDF("comunidad")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>País</label>
                      <input value={datosForm.pais} onChange={setDF("pais")} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Persona de contacto</label>
                      <input value={datosForm.nombre_contacto} onChange={setDF("nombre_contacto")} style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Cargo</label>
                      <input value={datosForm.cargo} onChange={setDF("cargo")} style={inp} />
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Observaciones</label>
                    <textarea value={datosForm.observaciones} onChange={setDF("observaciones")} rows={3} style={{ ...inp, resize: "vertical" }} />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => setEditingDatos(false)} style={{ fontSize: "0.75rem", padding: "0.35rem 0.85rem", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                    <button type="button" onClick={guardarDatos} disabled={savingDatos} style={{ fontSize: "0.75rem", padding: "0.35rem 0.85rem", borderRadius: 6, border: "none", background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", opacity: savingDatos ? 0.6 : 1 }}>
                      {savingDatos ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "1.5rem" }}>
                    {proveedorLocal.CIF && (
                      <div>
                        <label style={lbl}>CIF/NIF</label>
                        <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>{proveedorLocal.CIF}</div>
                      </div>
                    )}
                    {proveedorLocal.tipo && (
                      <div>
                        <label style={lbl}>Tipo</label>
                        <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>{proveedorLocal.tipo}</div>
                      </div>
                    )}
                  </div>

                  {(proveedorLocal.telefono || proveedorLocal.email) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {proveedorLocal.telefono && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#1e293b" }}>
                          <Phone size={13} color="#64748b" /> {proveedorLocal.telefono}
                        </div>
                      )}
                      {proveedorLocal.email && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#1e293b" }}>
                          <Mail size={13} color="#64748b" /> {proveedorLocal.email}
                        </div>
                      )}
                    </div>
                  )}

                  {direccionCompleta && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.85rem", color: "#1e293b" }}>
                      <MapPin size={13} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{direccionCompleta}</span>
                    </div>
                  )}

                  {(proveedorLocal.nombre_contacto || proveedorLocal.cargo) && (
                    <div>
                      <label style={lbl}>Persona de contacto</label>
                      <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>
                        {proveedorLocal.nombre_contacto}{proveedorLocal.cargo && ` — ${proveedorLocal.cargo}`}
                      </div>
                    </div>
                  )}

                  {proveedorLocal.observaciones && (
                    <div>
                      <label style={lbl}>Observaciones</label>
                      <div style={{ fontSize: "0.82rem", color: "#475569", whiteSpace: "pre-wrap" }}>{proveedorLocal.observaciones}</div>
                    </div>
                  )}

                  {!proveedorLocal.CIF && !proveedorLocal.tipo && !proveedorLocal.telefono && !proveedorLocal.email && !direccionCompleta && !proveedorLocal.nombre_contacto && !proveedorLocal.observaciones && (
                    <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin datos adicionales</div>
                  )}
                </div>
              )}
            </div>
          </SeccionColapsable>

          {/* Tipos de servicio cotizados */}
          <SeccionColapsable
            icon={<Tags size={17} />}
            titulo="Tipos de servicio"
            count={!loading ? tiposServicio.length : undefined}
            isOpen={!!openSections.tipos}
            onToggle={() => toggleSection("tipos")}
          >
            {loading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Cargando...</div>
            ) : tiposServicio.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin tipos de servicio registrados</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {tiposServicio.map((t) => (
                  <div
                    key={t.id}
                    title={t.etiqueta}
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 30, height: 30, borderRadius: 8,
                      background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0",
                    }}
                  >
                    <TipoIcon iconName={t.icono} size={15} />
                  </div>
                ))}
              </div>
            )}
          </SeccionColapsable>

          {/* Cotizaciones donde aparece el proveedor */}
          <SeccionColapsable
            icon={<Calculator size={17} />}
            titulo="Cotizaciones"
            count={!loading ? cotizacionesAgrupadas.length : undefined}
            isOpen={!!openSections.cotizaciones}
            onToggle={() => toggleSection("cotizaciones")}
          >
            {loading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Cargando...</div>
            ) : cotizacionesAgrupadas.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin cotizaciones registradas</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <th style={th}>Cotización</th>
                  </tr>
                </thead>
                <tbody>
                  {pagerCotizaciones.paginated.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < pagerCotizaciones.paginated.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                      <td style={td} title={c.titulo}>{c.titulo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <MiniPager page={pagerCotizaciones.page} totalPages={pagerCotizaciones.totalPages} onChange={setPagCotizaciones} />
          </SeccionColapsable>

          {/* Expedientes donde aparece el proveedor */}
          <SeccionColapsable
            icon={<FolderOpen size={17} />}
            titulo="Expedientes"
            count={!loading ? expedientesAgrupados.length : undefined}
            isOpen={!!openSections.expedientes}
            onToggle={() => toggleSection("expedientes")}
          >
            {loading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Cargando...</div>
            ) : expedientesAgrupados.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin expedientes registrados</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <th style={th}>Expediente</th>
                    <th style={{ ...th, textAlign: "right" }}>Importe</th>
                    <th style={{ ...th, textAlign: "right" }}>Situación</th>
                  </tr>
                </thead>
                <tbody>
                  {pagerExpedientes.paginated.map((e, i) => {
                    const situacionStyle = e.situacion === "pagado"
                      ? { bg: "#dcfce7", color: "#16a34a", label: "Pagado" }
                      : e.situacion === "parcial"
                        ? { bg: "#fef9c3", color: "#ca8a04", label: "Parcial" }
                        : { bg: "#fee2e2", color: "#dc2626", label: "Pendiente" };
                    return (
                      <tr key={e.id} style={{ borderBottom: i < pagerExpedientes.paginated.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                        <td style={td} title={`${e.numero}${e.cliente ? " — " + e.cliente : ""}`}>
                          {e.numero}{e.cliente && <span style={{ color: "#64748b", fontWeight: 400 }}> — {e.cliente}</span>}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>{e.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", height: 18, borderRadius: 99, background: situacionStyle.bg, color: situacionStyle.color, fontSize: "0.62rem", fontWeight: 600, padding: "0 7px", whiteSpace: "nowrap" }}>
                            {situacionStyle.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <MiniPager page={pagerExpedientes.page} totalPages={pagerExpedientes.totalPages} onChange={setPagExpedientes} />
          </SeccionColapsable>

          {/* Pagos confirmados al proveedor */}
          <SeccionColapsable
            icon={<Landmark size={17} />}
            titulo="Pagos"
            count={!loading ? pagos.length : undefined}
            isOpen={!!openSections.pagos}
            onToggle={() => toggleSection("pagos")}
          >
            {loading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Cargando...</div>
            ) : pagos.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>Sin pagos confirmados</div>
            ) : (
              <>
                <div style={{ fontSize: "0.8rem", color: "#334155", marginBottom: "0.5rem" }}>
                  Total pagado (confirmado): <strong>{totalPagado.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={th}>Fecha</th>
                      <th style={th}>Concepto</th>
                      <th style={{ ...th, textAlign: "right" }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagerPagos.paginated.map((p: any, i: number) => (
                      <tr key={p.id} style={{ borderBottom: i < pagerPagos.paginated.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                        <td style={td}>{p.fecha ? new Date(p.fecha).toLocaleDateString("es-ES") : "—"}</td>
                        <td style={td} title={p.concepto ?? ""}>{p.concepto ?? "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{Number(p.importe_total || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <MiniPager page={pagerPagos.page} totalPages={pagerPagos.totalPages} onChange={setPagPagos} />
              </>
            )}
          </SeccionColapsable>

          {/* Alias para conciliación bancaria: nombres alternativos con los que este
              proveedor puede aparecer en el concepto de un movimiento de banco. */}
          <SeccionColapsable
            icon={<Tag size={17} />}
            titulo="Alias"
            count={alias.length}
            isOpen={!!openSections.alias}
            onToggle={() => toggleSection("alias")}
          >
            <div style={{ position: "relative" }} ref={aliasPickerRef}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                {!showNuevoAlias && (
                  <button
                    type="button"
                    onClick={() => setShowNuevoAlias(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 600, color: "#ffffff", background: "var(--primary-color, #475569)", border: "none", cursor: "pointer", padding: "0.25rem 0.55rem", borderRadius: 6 }}
                  >
                    <Plus size={12} /> Añadir alias
                  </button>
                )}
              </div>

              <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "0 0 0.6rem 0" }}>
                Nombres alternativos con los que este proveedor puede aparecer en el concepto de un movimiento bancario, para mejorar la conciliación automática.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {alias.map((a) => (
                  <span
                    key={a}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: 99, fontSize: "0.7rem", fontWeight: 600,
                      background: "color-mix(in srgb, var(--primary-color, #475569) 12%, white)",
                      color: "var(--primary-color, #475569)",
                      border: "1px solid color-mix(in srgb, var(--primary-color, #475569) 30%, white)",
                    }}
                  >
                    {a}
                    <button
                      type="button"
                      onClick={() => handleEliminarAlias(a)}
                      disabled={savingAlias}
                      style={{ display: "flex", border: "none", background: "transparent", cursor: "pointer", color: "inherit", opacity: 0.7, padding: 0 }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>

              {showNuevoAlias && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300,
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                  boxShadow: "0 8px 32px rgba(15,23,42,0.14)", minWidth: 260, padding: "0.6rem", fontSize: "0.8rem",
                }}>
                  <input
                    autoFocus
                    type="text"
                    value={nuevoAlias}
                    onChange={(e) => setNuevoAlias(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAnadirAlias(); } if (e.key === "Escape") { setNuevoAlias(""); setShowNuevoAlias(false); } }}
                    placeholder="Nombre como aparece en el banco"
                    disabled={savingAlias}
                    style={{ width: "100%", padding: "0.35rem 0.5rem", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: "0.78rem", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: "0.5rem" }}>
                    <button type="button" onClick={() => { setNuevoAlias(""); setShowNuevoAlias(false); }} disabled={savingAlias} style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#64748b" }}>
                      Cancelar
                    </button>
                    <button type="button" onClick={handleAnadirAlias} disabled={savingAlias || !nuevoAlias.trim()} style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem", border: "none", borderRadius: 6, background: "var(--primary-color, #475569)", color: "#fff", cursor: "pointer", opacity: savingAlias || !nuevoAlias.trim() ? 0.6 : 1 }}>
                      Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {alias.length === 0 && !showNuevoAlias && (
              <div style={{ color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic", marginTop: "0.5rem" }}>Sin alias registrados</div>
            )}
          </SeccionColapsable>
        </div>
      </div>
    </>
  );
}
