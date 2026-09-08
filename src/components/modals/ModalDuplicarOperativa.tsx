"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Copy, Link2, User, Search, Target, Check, Loader2 } from "lucide-react";

export interface ModalDuplicarOperativaProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: "cotizacion" | "propuesta";
  itemId: string;
  itemTitulo?: string;
  initialContactoId?: string | null;
  initialContactoNombre?: string | null;
  initialCampanaId?: string | null;
  initialCampanaNombre?: string | null;
  tieneVinculo: boolean;
  onConfirm: (params: {
    vincular: boolean;
    contactoId: string | null;
    campanaId: string | null;
  }) => Promise<void> | void;
}

export function ModalDuplicarOperativa({
  isOpen,
  onClose,
  tipo,
  itemId,
  itemTitulo,
  initialContactoId,
  initialContactoNombre,
  initialCampanaId,
  initialCampanaNombre,
  tieneVinculo,
  onConfirm,
}: ModalDuplicarOperativaProps) {
  const [vincular, setVincular] = useState(true);
  const [contactoId, setContactoId] = useState<string | null>(initialContactoId ?? null);
  const [contactoNombre, setContactoNombre] = useState<string | null>(initialContactoNombre ?? null);
  const [campanaId, setCampanaId] = useState<string | null>(initialCampanaId ?? null);

  // Estados para búsqueda de contacto
  const [busquedaContacto, setBusquedaContacto] = useState("");
  const [resultadosContacto, setResultadosContacto] = useState<any[]>([]);
  const [buscandoContacto, setBuscandoContacto] = useState(false);
  const [mostrarDropdownContacto, setMostrarDropdownContacto] = useState(false);
  const contactoWrapperRef = useRef<HTMLDivElement>(null);

  // Estados para lista de campañas
  const [campanas, setCampanas] = useState<{ id: string; nombre: string }[]>([]);
  const [cargandoCampanas, setCargandoCampanas] = useState(false);

  // Estado guardando
  const [procesando, setProcesando] = useState(false);

  // Sincronizar props iniciales al abrir
  useEffect(() => {
    if (isOpen) {
      setVincular(true);
      setContactoId(initialContactoId ?? null);
      setContactoNombre(initialContactoNombre ?? null);
      setCampanaId(initialCampanaId ?? null);
      setBusquedaContacto("");
      setResultadosContacto([]);
      setMostrarDropdownContacto(false);
    }
  }, [isOpen, initialContactoId, initialContactoNombre, initialCampanaId]);

  // Cargar campañas disponibles
  useEffect(() => {
    if (!isOpen) return;
    setCargandoCampanas(true);
    fetch("/api/crm/campanas")
      .then((r) => r.json())
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setCampanas(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setCargandoCampanas(false));
  }, [isOpen]);

  // Cerrar dropdown de contacto al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contactoWrapperRef.current && !contactoWrapperRef.current.contains(e.target as Node)) {
        setMostrarDropdownContacto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Búsqueda de contactos con debounce
  useEffect(() => {
    const q = busquedaContacto.trim();
    if (q.length < 2) {
      setResultadosContacto([]);
      return;
    }
    setBuscandoContacto(true);
    const timer = setTimeout(() => {
      fetch(`/api/entidades?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res?.data && Array.isArray(res.data)) {
            setResultadosContacto(res.data);
          } else {
            setResultadosContacto([]);
          }
        })
        .catch(() => setResultadosContacto([]))
        .finally(() => setBuscandoContacto(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [busquedaContacto]);

  if (!isOpen) return null;

  const esCotizacion = tipo === "cotizacion";
  const labelPrincipal = esCotizacion ? "cotización" : "propuesta";
  const labelVinculada = esCotizacion ? "propuestas vinculadas" : "cotización vinculada";

  const handleSubmitting = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    try {
      await onConfirm({
        vincular: tieneVinculo ? vincular : false,
        contactoId,
        campanaId,
      });
      onClose();
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "0.75rem",
          width: 480,
          maxWidth: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem 0.85rem",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "color-mix(in srgb, var(--primary-color, #475569) 12%, transparent)",
                color: "var(--primary-color, #475569)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Copy size={16} />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", display: "block" }}>
                Duplicar {labelPrincipal}
              </span>
              {itemTitulo && (
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {itemTitulo}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "#94a3b8",
              display: "flex",
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmitting} style={{ padding: "1.2rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {/* Opción duplicar vinculada si tiene vínculo */}
          {tieneVinculo && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "0.75rem 0.9rem",
              }}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={vincular}
                  onChange={(e) => setVincular(e.target.checked)}
                  style={{ marginTop: 3, accentColor: "var(--primary-color, #475569)", cursor: "pointer" }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>
                    <Link2 size={13} style={{ color: "var(--primary-color, #475569)" }} />
                    <span>Duplicar también las {labelVinculada}</span>
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 2 }}>
                    Se mantendrá el vínculo entre las copias duplicadas. Si desmarcas esta opción, solo se creará la copia independiente de esta {labelPrincipal}.
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Contacto Principal */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
              <User size={13} style={{ color: "var(--primary-color, #475569)" }} />
              <span>Contacto principal (Cliente)</span>
            </label>

            <div ref={contactoWrapperRef} style={{ position: "relative" }}>
              {contactoId ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.45rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontSize: "0.82rem",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {contactoNombre || "Cliente seleccionado"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setContactoId(null);
                      setContactoNombre(null);
                      setBusquedaContacto("");
                      setMostrarDropdownContacto(true);
                    }}
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "#64748b",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      marginLeft: 8,
                    }}
                    title="Cambiar cliente"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Search size={14} style={{ position: "absolute", left: 10, color: "#94a3b8" }} />
                    <input
                      type="text"
                      placeholder="Buscar cliente o entidad..."
                      value={busquedaContacto}
                      onChange={(e) => {
                        setBusquedaContacto(e.target.value);
                        setMostrarDropdownContacto(true);
                      }}
                      onFocus={() => setMostrarDropdownContacto(true)}
                      style={{
                        width: "100%",
                        padding: "0.45rem 0.75rem 0.45rem 2rem",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                        outline: "none",
                      }}
                    />
                    {buscandoContacto && (
                      <Loader2 size={13} className="animate-spin" style={{ position: "absolute", right: 10, color: "#94a3b8" }} />
                    )}
                  </div>

                  {mostrarDropdownContacto && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        zIndex: 100,
                        maxHeight: 180,
                        overflowY: "auto",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div
                        onClick={() => {
                          setContactoId(null);
                          setContactoNombre(null);
                          setMostrarDropdownContacto(false);
                        }}
                        style={{
                          padding: "0.45rem 0.75rem",
                          cursor: "pointer",
                          color: "#94a3b8",
                          fontStyle: "italic",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        Sin contacto asignado
                      </div>
                      {resultadosContacto.map((ent) => (
                        <div
                          key={ent.id}
                          onClick={() => {
                            setContactoId(ent.id);
                            setContactoNombre(ent.nombre);
                            setMostrarDropdownContacto(false);
                          }}
                          style={{
                            padding: "0.45rem 0.75rem",
                            cursor: "pointer",
                            color: "#1e293b",
                            borderBottom: "1px solid #f8fafc",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ fontWeight: 600 }}>{ent.nombre}</div>
                          {ent.email && <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{ent.email}</div>}
                        </div>
                      ))}
                      {busquedaContacto.trim().length >= 2 && resultadosContacto.length === 0 && !buscandoContacto && (
                        <div style={{ padding: "0.5rem 0.75rem", color: "#94a3b8", fontSize: "0.74rem" }}>
                          No se encontraron entidades.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Asignar a Campaña */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
              <Target size={13} style={{ color: "var(--primary-color, #475569)" }} />
              <span>Asignar a campaña</span>
            </label>
            <select
              value={campanaId || ""}
              onChange={(e) => setCampanaId(e.target.value ? e.target.value : null)}
              disabled={cargandoCampanas}
              style={{
                width: "100%",
                padding: "0.45rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: "0.82rem",
                color: "#1e293b",
                background: "#ffffff",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">Sin campaña</option>
              {campanas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Footer de Acciones */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              disabled={procesando}
              onClick={onClose}
              style={{
                border: "1px solid #e2e8f0",
                background: "#fff",
                borderRadius: 6,
                padding: "0.45rem 0.95rem",
                cursor: procesando ? "not-allowed" : "pointer",
                color: "#475569",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={procesando}
              style={{
                border: "none",
                background: "var(--primary-color, #1e293b)",
                borderRadius: 6,
                padding: "0.45rem 1.1rem",
                cursor: procesando ? "not-allowed" : "pointer",
                color: "#fff",
                fontSize: "0.82rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: procesando ? 0.75 : 1,
              }}
            >
              {procesando && <Loader2 size={13} className="animate-spin" />}
              <span>{procesando ? "Duplicando..." : `Duplicar ${labelPrincipal}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
