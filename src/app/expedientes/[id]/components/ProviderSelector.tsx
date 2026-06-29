"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Check, ChevronDown, Loader2, X, Briefcase, Building2, CreditCard, Hash } from "lucide-react";
import { getTopProveedores, getProveedorById, searchProveedores, createProveedor } from "@/actions/proveedores";

interface ProviderSelectorProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  label?: string;
}

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

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search effect
  useEffect(() => {
    if (searchTerm.trim().length < 3) {
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

  const handleSelect = (providerId: string, providerName: string) => {
    onChange(providerId);
    setIsOpen(false);
    setSearchTerm("");
    setShowCreateForm(false);
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

  const displayedProviders = searchTerm.trim().length >= 3 ? searchResults : topProviders;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger Button/Input */}
      <div
        onClick={async () => {
          if (!isOpen) {
            setSearchTerm("");
            setShowCreateForm(false);
            if (topProviders.length === 0) {
              const top = await getTopProveedores();
              setTopProviders(top);
            }
          }
          setIsOpen(!isOpen);
        }}
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
          {resolving ? "\u00A0" : value ? (currentName || getProviderName(value)) : "Seleccionar..."}
        </span>
        <ChevronDown size={14} style={{ color: "#64748b", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
      </div>

      {/* Dropdown Card */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "240px",
            backgroundColor: "#ffffff",
            borderRadius: "0.5rem",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0",
            zIndex: 99999,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.15s ease-out"
          }}
        >
          {!showCreateForm ? (
            <>
              {/* Search Header */}
              <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #f1f5f9", padding: "0.5rem 0.75rem", gap: "0.5rem" }}>
                <Search size={16} style={{ color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, CIF, razón social, cuenta..."
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
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.15rem" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Providers List */}
              <div style={{ maxHeight: "240px", overflowY: "auto", padding: "0.25rem 0" }}>
                {loading ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "2rem", gap: "0.5rem", color: "#64748b", fontSize: "0.8rem" }}>
                    <Loader2 size={16} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                    <span>Buscando...</span>
                  </div>
                ) : displayedProviders.length > 0 ? (
                  <>
                    <div style={{ padding: "0.35rem 0.75rem", fontSize: "0.7rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {searchTerm.trim().length >= 3 ? "Resultados de búsqueda" : "5 más usados"}
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
                            padding: "0.5rem 0.75rem",
                            cursor: "pointer",
                            backgroundColor: isSelected ? "#f0fdf4" : "transparent",
                            transition: "background-color 0.15s",
                            borderBottom: "1px solid #f8fafc"
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "#0f172a" }}>
                              {prov.nombre}
                            </span>
                            {isSelected && <Check size={16} style={{ color: "#22c55e" }} />}
                          </div>
                          
                          {/* Details row */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem", fontSize: "0.7rem", color: "#64748b" }}>
                            {prov.razon_social && (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }} title="Razón Social">
                                <Building2 size={10} />
                                {prov.razon_social}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div style={{ padding: "1.5rem 1rem", textAlign: "center" }}>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>
                      {searchTerm.trim().length >= 3 
                        ? "No se encontraron proveedores" 
                        : "No hay proveedores registrados aún"}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{ borderTop: "1px solid #f1f5f9", padding: "0.4rem 0.5rem", backgroundColor: "#f8fafc" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    padding: "0.45rem",
                    borderRadius: "0.25rem",
                    border: "1px dashed #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#db2777",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fff1f2";
                    e.currentTarget.style.borderColor = "#fda4af";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }}
                >
                  <Plus size={14} />
                  <span>Crear proveedor nuevo</span>
                </button>
              </div>
            </>
          ) : (
            /* Creation Form */
            <form onSubmit={handleCreate} style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Nuevo Proveedor
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

              {/* Nombre */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "#475569" }}>Nombre Comercial *</label>
                <input
                  type="text"
                  placeholder="Ej: Transportes Góngora"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  required
                  style={{
                    padding: "0.4rem 0.6rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.8rem",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#0f172a"
                  }}
                />
              </div>

              {/* Razón Social */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "#475569" }}>Razón Social</label>
                <input
                  type="text"
                  placeholder="Ej: Transportes Góngora S.L."
                  value={newRazonSocial}
                  onChange={(e) => setNewRazonSocial(e.target.value)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.8rem",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#0f172a"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {/* CIF / NIF */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "#475569" }}>CIF / NIF</label>
                  <input
                    type="text"
                    placeholder="B12345678"
                    value={newCif}
                    onChange={(e) => setNewCif(e.target.value)}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.8rem",
                      outline: "none",
                      backgroundColor: "#ffffff",
                      color: "#0f172a"
                    }}
                  />
                </div>

                {/* Cuenta Contable */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "#475569" }}>Cta. Contable</label>
                  <input
                    type="text"
                    placeholder="40000001"
                    value={newCuentaContable}
                    onChange={(e) => setNewCuentaContable(e.target.value)}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.8rem",
                      outline: "none",
                      backgroundColor: "#ffffff",
                      color: "#0f172a"
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    flex: 1,
                    padding: "0.45rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    flex: 1,
                    padding: "0.45rem",
                    borderRadius: "0.25rem",
                    border: "none",
                    backgroundColor: "#db2777",
                    color: "#ffffff",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem"
                  }}
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
      )}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
