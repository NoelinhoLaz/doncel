"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Check, ChevronDown, Loader2, X, Building2 } from "lucide-react";
import { getTopProveedores, getProveedorById, searchProveedores, createProveedor } from "@/actions/proveedores";

interface ProviderSelectorProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  label?: string;
}

const MIN_SEARCH_CHARS = 3;

export default function ProviderSelector({ value, onChange, compact, label }: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [topProviders, setTopProviders] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // Creation form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newRazonSocial, setNewRazonSocial] = useState("");
  const [newCif, setNewCif] = useState("");
  const [newCuentaContable, setNewCuentaContable] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);

  // Resolve current provider name on mount/value change
  useEffect(() => {
    if (!value) { setCurrentName(null); return; }
    if (label) { setCurrentName(label); return; }
    const found = [...topProviders, ...searchResults].find(p => p.id === value);
    if (found) { setCurrentName(found.nombre || found.razon_social); return; }
    setResolving(true);
    getProveedorById(value).then(p => {
      setCurrentName(p?.nombre || p?.razon_social || null);
      setResolving(false);
    });
  }, [value, label]);

  // Search effect — only searches when 3+ characters typed
  useEffect(() => {
    if (searchTerm.trim().length < MIN_SEARCH_CHARS) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchProveedores(searchTerm);
        setSearchResults(results);
      } catch (err) {
        console.error("Error searching providers:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const getProviderName = (id: string) => {
    const all = [...topProviders, ...searchResults];
    const found = all.find(p => p.id === id);
    return found?.nombre || found?.razon_social || id;
  };

  const openModal = async () => {
    setSearchTerm("");
    setShowCreateForm(false);
    setCreateError("");
    if (topProviders.length === 0) {
      const top = await getTopProveedores();
      setTopProviders(top);
    }
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setShowCreateForm(false);
  };

  const handleSelect = (providerId: string, providerName: string) => {
    onChange(providerId);
    closeModal();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim()) {
      setCreateError("El nombre es obligatorio");
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      const res = await createProveedor({
        nombre: newNombre.trim(),
        razon_social: newRazonSocial.trim() || undefined,
        cif: newCif.trim() || undefined,
        cuenta_contable: newCuentaContable.trim() || undefined
      });

      if (res.success && res.data) {
        const updatedTop = await getTopProveedores();
        setTopProviders(updatedTop);
        handleSelect(res.data.id, res.data.nombre);
        setNewNombre("");
        setNewRazonSocial("");
        setNewCif("");
        setNewCuentaContable("");
      }
    } catch (err: any) {
      setCreateError(err.message || "Error al crear el proveedor");
    } finally {
      setCreating(false);
    }
  };

  const displayedProviders = searchTerm.trim().length >= MIN_SEARCH_CHARS ? searchResults : topProviders;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Trigger */}
      <div
        onClick={openModal}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: compact ? "0.1rem 0.3rem" : "0.5rem 0.75rem",
          borderRadius: compact ? "6px" : "0.375rem",
          border: "1px solid #cbd5e1",
          fontSize: compact ? "0.7rem" : "0.85rem",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          cursor: "pointer",
          outline: "none",
          height: compact ? "25px" : "38px",
          boxSizing: "border-box"
        }}
      >
        <span style={{ color: value ? "#0f172a" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {resolving ? " " : value ? (currentName || getProviderName(value)) : "Seleccionar..."}
        </span>
        <ChevronDown size={14} style={{ color: "#64748b", flexShrink: 0 }} />
      </div>

      {/* Modal */}
      {isOpen && (
        <div
          onClick={closeModal}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "380px",
              maxHeight: "70vh",
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {!showCreateForm ? (
              <>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1rem 0.6rem 1rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>Seleccionar proveedor</h3>
                  <button onClick={closeModal} style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}>
                    <X size={14} />
                  </button>
                </div>

                {/* Search Header */}
                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #f1f5f9", borderTop: "1px solid #f1f5f9", padding: "0.5rem 1rem", gap: "0.5rem" }}>
                  <Search size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, CIF, razón social..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                    style={{
                      border: "none",
                      outline: "none",
                      width: "100%",
                      fontSize: "0.85rem",
                      color: "#0f172a",
                      backgroundColor: "transparent",
                      padding: "0.25rem 0"
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.15rem", flexShrink: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {searchTerm.trim().length > 0 && searchTerm.trim().length < MIN_SEARCH_CHARS && (
                  <div style={{ padding: "0.5rem 1rem", fontSize: "0.72rem", color: "#94a3b8" }}>
                    Escribe al menos {MIN_SEARCH_CHARS} letras para buscar
                  </div>
                )}

                {/* Providers List */}
                <div style={{ maxHeight: "280px", overflowY: "auto", padding: "0.25rem 0" }}>
                  {loading ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "2rem", gap: "0.5rem", color: "#64748b", fontSize: "0.8rem" }}>
                      <Loader2 size={16} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                      <span>Buscando...</span>
                    </div>
                  ) : displayedProviders.length > 0 ? (
                    <>
                      <div style={{ padding: "0.35rem 1rem", fontSize: "0.7rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {searchTerm.trim().length >= MIN_SEARCH_CHARS ? "Resultados de búsqueda" : "5 más usados"}
                      </div>
                      {displayedProviders.map((prov) => {
                        const isSelected = value === prov.id;
                        return (
                          <div
                            key={prov.id}
                            onClick={() => handleSelect(prov.id, prov.nombre)}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              padding: "0.5rem 1rem",
                              cursor: "pointer",
                              backgroundColor: isSelected ? "#f0fdf4" : "transparent",
                              transition: "background-color 0.15s",
                              borderBottom: "1px solid #f8fafc"
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "#0f172a" }}>
                                {prov.nombre}
                              </span>
                              {isSelected && <Check size={16} style={{ color: "#22c55e" }} />}
                            </div>
                            {prov.razon_social && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem", fontSize: "0.7rem", color: "#64748b" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }} title="Razón Social">
                                  <Building2 size={10} />
                                  {prov.razon_social}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div style={{ padding: "1.5rem 1rem", textAlign: "center" }}>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>
                        {searchTerm.trim().length >= MIN_SEARCH_CHARS
                          ? "No se encontraron proveedores"
                          : "No hay proveedores registrados aún"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div style={{ borderTop: "1px solid #f1f5f9", padding: "0.6rem 1rem", backgroundColor: "#f8fafc" }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px dashed #cbd5e1",
                      backgroundColor: "#ffffff",
                      color: "var(--primary-color, #475569)",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f1f5f9";
                      e.currentTarget.style.borderColor = "#94a3b8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                      e.currentTarget.style.borderColor = "#cbd5e1";
                    }}
                  >
                    <Plus size={14} />
                    <span>Añadir nuevo proveedor</span>
                  </button>
                </div>
              </>
            ) : (
              /* Creation Form */
              <form onSubmit={handleCreate} style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#0f172a" }}>
                    Nuevo proveedor
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {createError && (
                  <div style={{ padding: "0.4rem 0.6rem", borderRadius: "0.25rem", backgroundColor: "#fef2f2", color: "#ef4444", fontSize: "0.75rem", border: "1px solid #fca5a5" }}>
                    {createError}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "#475569" }}>Nombre Comercial *</label>
                  <input
                    type="text"
                    placeholder="Ej: Transportes Góngora"
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    autoFocus
                    required
                    style={{ padding: "0.45rem 0.6rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "#475569" }}>Razón Social</label>
                  <input
                    type="text"
                    placeholder="Ej: Transportes Góngora S.L."
                    value={newRazonSocial}
                    onChange={(e) => setNewRazonSocial(e.target.value)}
                    style={{ padding: "0.45rem 0.6rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "#475569" }}>CIF / NIF</label>
                    <input
                      type="text"
                      placeholder="B12345678"
                      value={newCif}
                      onChange={(e) => setNewCif(e.target.value)}
                      style={{ padding: "0.45rem 0.6rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "#475569" }}>Cta. Contable</label>
                    <input
                      type="text"
                      placeholder="40000001"
                      value={newCuentaContable}
                      onChange={(e) => setNewCuentaContable(e.target.value)}
                      style={{ padding: "0.45rem 0.6rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    style={{ flex: 1, padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", color: "#475569", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{ flex: 1, padding: "0.5rem", borderRadius: "0.375rem", border: "none", backgroundColor: "var(--primary-color, #475569)", color: "#ffffff", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                  >
                    {creating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
