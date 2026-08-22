"use client";

import { useState, useEffect, useMemo } from "react";
import { Icons } from "@/lib/icons";
import { Loader2, User, Users, Car, ArrowLeft } from "lucide-react";
import { crearViajeroCompleto, type TipoViajero } from "@/actions/viajeros";
import { getServiciosOpcionalesByExpediente } from "@/actions/servicios";

interface PagadorOption {
  entidad_id: string;
  nombre: string;
}

interface PagadorFormModal {
  modo: "existente" | "nuevo";
  entidadId: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string;
}

function pagadorVacio(pagadoresDisponibles: PagadorOption[]): PagadorFormModal {
  return {
    modo: pagadoresDisponibles.length > 0 ? "existente" : "nuevo",
    entidadId: "",
    nombre: "",
    apellidos: "",
    dni: "",
    email: "",
    telefono: "",
  };
}

interface AnadirViajeroModalProps {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  pvpViajero?: number | null;
  pagadoresDisponibles: PagadorOption[];
  onSuccess: () => void;
}

type Step = "tipo" | "datos" | "pagador" | "extras" | "pago" | "resumen";

const TIPOS: { value: TipoViajero; label: string; icon: any; desc: string }[] = [
  { value: "pasajero", label: "Pasajero", icon: User, desc: "Viajero que factura al pagador (con extras y forma de pago)" },
  { value: "acompanante", label: "Acompañante", icon: Users, desc: "Sin pagador ni facturación asociada" },
  { value: "chofer", label: "Chofer", icon: Car, desc: "Sin pagador ni facturación asociada" },
];

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.55rem 0.7rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontSize: "0.82rem", color: "#0f172a", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "0.3rem" };

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

function calcularEdad(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento);
  if (isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

export default function AnadirViajeroModal({ isOpen, onClose, expedienteId, pvpViajero, pagadoresDisponibles, onSuccess }: AnadirViajeroModalProps) {
  const [step, setStep] = useState<Step>("tipo");
  const [tipo, setTipo] = useState<TipoViajero | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos del viajero
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [dni, setDni] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [sexo, setSexo] = useState<"M" | "F" | "">("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tutorNombre, setTutorNombre] = useState("");
  const [tutorTelefono, setTutorTelefono] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");

  const esMenor = useMemo(() => {
    const edad = calcularEdad(fechaNacimiento);
    return edad !== null && edad < 18;
  }, [fechaNacimiento]);

  // Pagadores (1 o más, reparto a partes iguales)
  const [pagadores, setPagadores] = useState<PagadorFormModal[]>([pagadorVacio(pagadoresDisponibles)]);

  function actualizarPagador(index: number, cambios: Partial<PagadorFormModal>) {
    setPagadores((prev) => prev.map((p, i) => (i === index ? { ...p, ...cambios } : p)));
  }

  function agregarPagador() {
    setPagadores((prev) => [...prev, pagadorVacio(pagadoresDisponibles)]);
  }

  function eliminarPagador(index: number) {
    setPagadores((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  // Extras
  const [extrasDisponibles, setExtrasDisponibles] = useState<{ id: string; nombre: string; pvp: number }[]>([]);
  const [extrasSeleccionados, setExtrasSeleccionados] = useState<Set<string>>(new Set());

  // Forma de pago
  const [medioPago, setMedioPago] = useState<"banco" | "efectivo" | "tarjeta" | "online">("banco");

  useEffect(() => {
    if (!isOpen) {
      setStep("tipo");
      setTipo(null);
      setError(null);
      setNombre(""); setApellidos(""); setDni(""); setFechaNacimiento(""); setSexo(""); setEmail(""); setTelefono("");
      setTutorNombre(""); setTutorTelefono(""); setTutorEmail("");
      setPagadores([pagadorVacio(pagadoresDisponibles)]);
      setExtrasSeleccionados(new Set());
      setMedioPago("banco");
    } else {
      getServiciosOpcionalesByExpediente(expedienteId).then(setExtrasDisponibles);
    }
  }, [isOpen, expedienteId]);

  if (!isOpen) return null;

  const importeExtras = extrasDisponibles
    .filter((e) => extrasSeleccionados.has(e.id))
    .reduce((s, e) => s + e.pvp, 0);
  const importeTotal = (pvpViajero || 0) + importeExtras;

  const selectTipo = (t: TipoViajero) => {
    setTipo(t);
    setStep("datos");
  };

  const toggleExtra = (id: string) => {
    setExtrasSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const datosValidos = nombre.trim() && apellidos.trim() && dni.trim() && (!esMenor || tutorNombre.trim());
  const pagadoresValidos =
    tipo !== "pasajero" ||
    pagadores.every((p) => (p.modo === "existente" ? !!p.entidadId : p.nombre.trim() && p.apellidos.trim() && p.dni.trim()));
  const importePorPagador = tipo === "pasajero" && pagadores.length > 0 ? importeTotal / pagadores.length : 0;

  const handleSiguienteDesdeDatos = () => {
    if (!datosValidos) { setError("Completa nombre, apellidos, documento y tutor (si es menor de edad)."); return; }
    setError(null);
    setStep(tipo === "pasajero" ? "pagador" : "resumen");
  };

  const handleSiguienteDesdePagador = () => {
    if (!pagadoresValidos) { setError("Selecciona un pagador existente o completa los datos de cada nuevo pagador."); return; }
    setError(null);
    setStep("extras");
  };

  const handleGuardar = async () => {
    if (!tipo) return;
    setSaving(true);
    setError(null);
    try {
      const extrasPayload = extrasDisponibles
        .filter((e) => extrasSeleccionados.has(e.id))
        .map((e) => ({ id: e.id, nombre: e.nombre, pvp: e.pvp, cantidad: 1 }));

      const res = await crearViajeroCompleto({
        expedienteId,
        tipo,
        viajero: {
          nombre: nombre.trim(),
          apellidos: apellidos.trim(),
          dni: dni.trim(),
          fecha_nacimiento: fechaNacimiento || null,
          sexo: sexo || null,
          email: email.trim() || null,
          telefono: telefono.trim() || null,
          extras: extrasPayload,
          tutor: esMenor && tutorNombre.trim() ? { nombre: tutorNombre.trim(), telefono: tutorTelefono.trim(), email: tutorEmail.trim() } : null,
        },
        pagadores: tipo === "pasajero"
          ? pagadores.map((p) => ({
              entidadId: p.modo === "existente" ? p.entidadId : undefined,
              nuevo: p.modo === "nuevo"
                ? { nombre: p.nombre.trim(), apellidos: p.apellidos.trim(), dni: p.dni.trim(), email: p.email.trim() || null, telefono: p.telefono.trim() || null }
                : undefined,
            }))
          : undefined,
        importeTotal: tipo === "pasajero" ? (pvpViajero || 0) : undefined,
        medioPago: tipo === "pasajero" ? medioPago : undefined,
      });

      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al crear el viajero");
    } finally {
      setSaving(false);
    }
  };

  const handleVolver = () => {
    if (step === "resumen") { setStep(tipo === "pasajero" ? "pago" : "datos"); return; }
    if (step === "pago") { setStep("extras"); return; }
    if (step === "extras") { setStep(tipo === "pasajero" ? "pagador" : "datos"); return; }
    if (step === "pagador") { setStep("datos"); return; }
    if (step === "datos") { setStep("tipo"); return; }
  };

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(12px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "540px", maxHeight: "82vh", overflowY: "auto", backgroundColor: "rgba(255, 255, 255, 0.98)", borderRadius: "1.5rem", padding: "1.5rem", boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)", border: "1px solid rgba(255, 255, 255, 0.8)" }}
      >
        {!saving && (
          <button
            onClick={onClose}
            style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
          >
            <Icons.Close size={16} />
          </button>
        )}

        {step !== "tipo" && (
          <button
            onClick={handleVolver}
            style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "none", color: "#64748b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: "0.75rem" }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
        )}

        {error && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

        {step === "tipo" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Añadir viajero</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1.25rem 0" }}>Selecciona el tipo de viajero a añadir.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {TIPOS.map((t) => {
                const IconComp = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => selectTipo(t.value)}
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.75rem", background: "#fff", cursor: "pointer", textAlign: "left" }}
                  >
                    <IconComp size={20} color="var(--primary-color, #475569)" />
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>{t.label}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "datos" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Datos del {tipo === "pasajero" ? "pasajero" : tipo === "acompanante" ? "acompañante" : "chofer"}</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Introduce los datos personales.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "flex", gap: "0.7rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nombre</label>
                  <input style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Apellidos</label>
                  <input style={inputStyle} value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.7rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>DNI / Pasaporte</label>
                  <input style={inputStyle} value={dni} onChange={(e) => setDni(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fecha de nacimiento</label>
                  <input type="date" style={inputStyle} value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.7rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Sexo</label>
                  <select style={{ ...inputStyle, background: "#fff" }} value={sexo} onChange={(e) => setSexo(e.target.value as any)}>
                    <option value="">—</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Teléfono</label>
                  <input style={inputStyle} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              {esMenor && (
                <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: "0.5rem", padding: "0.85rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#92400e", marginBottom: "0.6rem" }}>Es menor de edad — datos del tutor</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <input style={inputStyle} placeholder="Nombre del tutor" value={tutorNombre} onChange={(e) => setTutorNombre(e.target.value)} />
                    <div style={{ display: "flex", gap: "0.7rem" }}>
                      <input style={inputStyle} placeholder="Teléfono" value={tutorTelefono} onChange={(e) => setTutorTelefono(e.target.value)} />
                      <input type="email" style={inputStyle} placeholder="Email" value={tutorEmail} onChange={(e) => setTutorEmail(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={handleSiguienteDesdeDatos}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "pagador" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Cliente pagador</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>
              Selecciona quién paga este viaje. Si añades más de un pagador, el importe se reparte a partes iguales.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {pagadores.map((p, index) => (
                <div key={index} style={{ border: "1px solid #e2e8f0", borderRadius: "0.6rem", padding: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>Pagador {index + 1}</span>
                    {pagadores.length > 1 && (
                      <button
                        onClick={() => eliminarPagador(index)}
                        style={{ border: "none", background: "none", color: "#dc2626", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: 0 }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    {pagadoresDisponibles.length > 0 && (
                      <button
                        onClick={() => actualizarPagador(index, { modo: "existente" })}
                        style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", border: p.modo === "existente" ? "2px solid var(--primary-color, #475569)" : "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}
                      >
                        Pagador existente
                      </button>
                    )}
                    <button
                      onClick={() => actualizarPagador(index, { modo: "nuevo" })}
                      style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", border: p.modo === "nuevo" ? "2px solid var(--primary-color, #475569)" : "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}
                    >
                      Nuevo pagador
                    </button>
                  </div>

                  {p.modo === "existente" ? (
                    <div>
                      <label style={labelStyle}>Pagador</label>
                      <select
                        style={{ ...inputStyle, background: "#fff" }}
                        value={p.entidadId}
                        onChange={(e) => actualizarPagador(index, { entidadId: e.target.value })}
                      >
                        <option value="">Selecciona un pagador...</option>
                        {pagadoresDisponibles.map((op) => (
                          <option key={op.entidad_id} value={op.entidad_id}>{op.nombre}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                      <div style={{ display: "flex", gap: "0.7rem" }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Nombre</label>
                          <input style={inputStyle} value={p.nombre} onChange={(e) => actualizarPagador(index, { nombre: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Apellidos</label>
                          <input style={inputStyle} value={p.apellidos} onChange={(e) => actualizarPagador(index, { apellidos: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>DNI / CIF</label>
                        <input style={inputStyle} value={p.dni} onChange={(e) => actualizarPagador(index, { dni: e.target.value })} />
                      </div>
                      <div style={{ display: "flex", gap: "0.7rem" }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Email</label>
                          <input type="email" style={inputStyle} value={p.email} onChange={(e) => actualizarPagador(index, { email: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Teléfono</label>
                          <input style={inputStyle} value={p.telefono} onChange={(e) => actualizarPagador(index, { telefono: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={agregarPagador}
                style={{ alignSelf: "flex-start", border: "1px dashed #cbd5e1", background: "none", color: "var(--primary-color, #475569)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", padding: "0.5rem 0.9rem", borderRadius: "0.5rem" }}
              >
                + Añadir otro pagador
              </button>

              {pagadores.length > 1 && (
                <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>
                  Cada pagador abonará aproximadamente {importePorPagador.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €.
                </p>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={handleSiguienteDesdePagador}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "extras" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Extras</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Selecciona los extras opcionales para este viajero.</p>

            {extrasDisponibles.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center", padding: "1.5rem 0" }}>No hay extras opcionales configurados.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "260px", overflowY: "auto" }}>
                {extrasDisponibles.map((ex) => {
                  const checked = extrasSeleccionados.has(ex.id);
                  return (
                    <label key={ex.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", cursor: "pointer", backgroundColor: checked ? "#f8fafc" : "#fff" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleExtra(ex.id)} style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer" }} />
                      <span style={{ flex: 1, fontSize: "0.83rem", fontWeight: 600, color: "#0f172a" }}>{ex.nombre}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>{ex.pvp.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={() => setStep(tipo === "pasajero" ? "pago" : "resumen")}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "pago" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Forma de pago</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Los plazos de pago del pagador seguirán los plazos generales del expediente.</p>

            <div>
              <label style={labelStyle}>Medio de pago</label>
              <select style={{ ...inputStyle, background: "#fff" }} value={medioPago} onChange={(e) => setMedioPago(e.target.value as any)}>
                <option value="banco">Banco</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="online">Online</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={() => setStep("resumen")}
                style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "resumen" && (
          <>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>Confirmar</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Revisa los datos antes de guardar.</p>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.9rem 1rem", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b" }}>Tipo</span>
                <span style={{ fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>{tipo}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b" }}>Nombre</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{nombre} {apellidos}</span>
              </div>
              {tipo === "pasajero" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <span style={{ color: "#64748b" }}>{pagadores.length > 1 ? "Pagadores" : "Pagador"}</span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>
                      {pagadores
                        .map((p) => (p.modo === "existente" ? (pagadoresDisponibles.find((op) => op.entidad_id === p.entidadId)?.nombre || "—") : `${p.nombre} ${p.apellidos}`))
                        .join(", ")}
                    </span>
                  </div>
                  {extrasSeleccionados.size > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span style={{ color: "#64748b" }}>Extras</span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{extrasSeleccionados.size} seleccionado{extrasSeleccionados.size !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "0.25rem 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ color: "#64748b" }}>Importe total</span>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{importeTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1.25rem" }}>
              <button
                onClick={handleGuardar}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.1rem", borderRadius: "0.375rem", border: "none", background: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Crear viajero
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
