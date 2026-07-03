"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Globe, FolderOpen, Mail, Paperclip, Loader2, Link2, Plus, FileText } from "lucide-react";
import {
  getEntityLinks,
  linkCotizacionToExpediente,
  linkCotizacionToPresupuesto,
  linkPropuestaToExpediente,
  searchExpedientes,
  searchCotizaciones,
  searchPropuestas,
  createNewCotizacionLinked,
  createNewCotizacionLinkedToPresupuesto,
  createNewPropuestaLinked,
  createNewExpedienteLinked
} from "@/actions/expedientes";

interface ExpedienteActionsToolbarProps {
  expedienteId?: string;
  cotizacionId?: string;
  propuestaId?: string;
  presupuestoId?: string;
}

export default function ExpedienteActionsToolbar({
  expedienteId: initialExpedienteId,
  cotizacionId: initialCotizacionId,
  propuestaId: initialPropuestaId,
  presupuestoId: initialPresupuestoId,
}: ExpedienteActionsToolbarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<any>({
    expedienteId: null,
    expediente: null,
    cotizaciones: [],
    propuestas: [],
    presupuestoId: initialPresupuestoId ?? null,
  });

  // Modals for linking
  const [showLinkModal, setShowLinkModal] = useState<"cotizacion" | "propuesta" | "expediente" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const res = await getEntityLinks({
        expedienteId: initialExpedienteId,
        cotizacionId: initialCotizacionId,
        propuestaId: initialPropuestaId,
        presupuestoId: initialPresupuestoId,
      });
      console.log("TOOLBAR LINKS LOADED:", res);
      if (res.success) {
        setLinks(res);
      }
    } catch (err) {
      console.error("Error loading entity links:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, [initialExpedienteId, initialCotizacionId, initialPropuestaId, initialPresupuestoId]);

  // Search entities for linking
  useEffect(() => {
    if (!showLinkModal) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        if (showLinkModal === "cotizacion") {
          const res = await searchCotizaciones(searchQuery);
          setSearchResults(res?.data || []);
        } else if (showLinkModal === "propuesta") {
          const res = await searchPropuestas(searchQuery);
          setSearchResults(res?.data || []);
        } else if (showLinkModal === "expediente") {
          const res = await searchExpedientes(searchQuery);
          setSearchResults(res?.data || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, showLinkModal]);

  const handleLinkAction = async (targetId: string) => {
    setLinking(true);
    try {
      const expId = initialExpedienteId || links.expedienteId;

      if (showLinkModal === "cotizacion") {
        if (expId) {
          await linkCotizacionToExpediente(targetId, expId);
        } else if (initialPresupuestoId) {
          await linkCotizacionToPresupuesto(targetId, initialPresupuestoId);
        }
      } else if (showLinkModal === "propuesta") {
        if (!expId) return;
        await linkPropuestaToExpediente(targetId, expId);
      } else if (showLinkModal === "expediente") {
        if (initialCotizacionId) {
          await linkCotizacionToExpediente(initialCotizacionId, targetId);
        } else if (initialPropuestaId) {
          await linkPropuestaToExpediente(initialPropuestaId, targetId);
        } else if (initialPresupuestoId) {
          // Link the cotizacion already tied to this presupuesto to the expediente
          const cotId = links.cotizaciones[0]?.id;
          if (cotId) await linkCotizacionToExpediente(cotId, targetId);
        }
      }
      
      await loadLinks();
      setShowLinkModal(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      console.error("Linking error:", err);
      alert("Error al vincular el elemento.");
    } finally {
      setLinking(false);
    }
  };

  const handleCreateAndLinkNew = async () => {
    const expId = initialExpedienteId || links.expedienteId;
    setLinking(true);
    try {
      if (showLinkModal === "cotizacion") {
        const res = expId
          ? await createNewCotizacionLinked(expId)
          : initialPresupuestoId
            ? await createNewCotizacionLinkedToPresupuesto(initialPresupuestoId)
            : { success: false, error: "Sin expediente ni presupuesto vinculado" };
        if (res.success) {
          setShowLinkModal(null);
          router.push(`/cotizaciones/nueva?id=${res.data.id}`);
          return;
        } else {
          throw new Error(res.error);
        }
      } else if (showLinkModal === "propuesta") {
        if (!expId) return;
        const res = await createNewPropuestaLinked(expId);
        if (res.success) {
          alert(`Se ha creado la propuesta "${res.data.nombre}" y se ha vinculado.`);
        } else {
          throw new Error(res.error);
        }
      } else if (showLinkModal === "expediente") {
        const type = initialCotizacionId ? "cotizacion" : "propuesta";
        const linkedId = initialCotizacionId || initialPropuestaId;
        if (!linkedId) return;
        const res = await createNewExpedienteLinked(linkedId, type);
        if (res.success) {
          alert(`Se ha creado el expediente "${res.data.numero} - ${res.data.referencia}" y se ha vinculado.`);
        } else {
          throw new Error(res.error);
        }
      }
      await loadLinks();
      setShowLinkModal(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      console.error("Creation error:", err);
      alert("Error al crear y vincular: " + err.message);
    } finally {
      setLinking(false);
    }
  };

  // Navigations
  const handlePresupuestoClick = () => {
    const presId = links.presupuestoId;
    if (presId) {
      router.push(`/presupuestos/nuevo?edit=${presId}`);
    }
  };

  const handleCotizacionClick = () => {
    if (hasCot && links.cotizaciones[0]?.id) {
      router.push(`/cotizaciones/nueva?id=${links.cotizaciones[0].id}`);
    } else {
      setShowLinkModal("cotizacion");
    }
  };

  const handlePropuestaClick = () => {
    if (hasProp && links.propuestas[0]?.id) {
      router.push(`/propuestas/${links.propuestas[0].id}`);
    } else {
      setShowLinkModal("propuesta");
    }
  };

  const handleFolderClick = () => {
    const expId = initialExpedienteId || links.expedienteId;
    if (expId) {
      router.push(`/expedientes/${expId}`);
    } else {
      setShowLinkModal("expediente");
    }
  };

  const handleMessagesClick = () => {
    const params = new URLSearchParams();
    if (initialExpedienteId || links.expedienteId) params.set("expediente_id", initialExpedienteId || links.expedienteId);
    if (initialCotizacionId || links.cotizaciones[0]?.id) params.set("cotizacion_id", initialCotizacionId || links.cotizaciones[0]?.id);
    if (initialPropuestaId  || links.propuestas[0]?.id)  params.set("propuesta_id",  initialPropuestaId  || links.propuestas[0]?.id);
    if (initialPresupuestoId || links.presupuestoId)     params.set("presupuesto_id", initialPresupuestoId || links.presupuestoId);
    const back = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
    if (back) params.set("back", back);
    router.push(`/comunicaciones?${params.toString()}`);
  };

  const handleAdjuntosClick = () => {
    if (links.expedienteId) {
      router.push(`/expedientes/${links.expedienteId}?tab=documentos`);
    } else {
      router.push("/expedientes");
    }
  };

  const hasPresup = !!links.presupuestoId;
  const hasCot = links.cotizaciones.length > 0;
  const hasProp = links.propuestas.length > 0;
  const hasFolder = !!links.expediente?.metadata?.drive_folder || !!links.expedienteId;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "190px", height: "38px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc" }}>
        <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite", color: "var(--primary-color, #4a88b5)" }} />
      </div>
    );
  }

  const darkPrimary = "color-mix(in srgb, var(--primary-color, #4a88b5) 80%, black)";
  const dividerColor = "color-mix(in srgb, var(--primary-color, #4a88b5) 60%, black)";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${darkPrimary}`, borderRadius: "8px", overflow: "hidden", background: darkPrimary }}>
        {/* Presupuesto Button */}
        <button
          title={hasPresup ? "Ver Solicitud de Presupuesto" : "Sin presupuesto vinculado"}
          onClick={handlePresupuestoClick}
          disabled={!hasPresup}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            border: "none",
            borderRight: `1px solid ${dividerColor}`,
            background: "transparent",
            color: "#ffffff",
            opacity: hasPresup ? 1 : 0.4,
            cursor: hasPresup ? "pointer" : "default",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { if (hasPresup) e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <FileText size={17} />
        </button>

        {/* Cotizaciones Button */}
        <button
          title={hasCot ? `Ver Cotización: ${links.cotizaciones[0].titulo}` : "Vincular Cotización"}
          onClick={handleCotizacionClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            border: "none",
            borderRight: `1px solid ${dividerColor}`,
            background: "transparent",
            color: "#ffffff",
            opacity: hasCot ? 1 : 0.4,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Receipt size={17} />
        </button>

        {/* Propuestas Button */}
        <button
          title={hasProp ? `Ver Propuesta: ${links.propuestas[0].title}` : "Vincular Propuesta"}
          onClick={handlePropuestaClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            border: "none",
            borderRight: `1px solid ${dividerColor}`,
            background: "transparent",
            color: "#ffffff",
            opacity: hasProp ? 1 : 0.4,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Globe size={17} />
        </button>

        {/* Expediente / Open Folder Button */}
        <button
          title={hasFolder ? "Ver Expediente" : "Vincular a Expediente"}
          onClick={handleFolderClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            border: "none",
            borderRight: `1px solid ${dividerColor}`,
            background: "transparent",
            color: "#ffffff",
            opacity: hasFolder ? 1 : 0.4,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <FolderOpen size={17} />
        </button>

        {/* Mensajes Button */}
        <button
          title="Bandeja de Mensajes"
          onClick={handleMessagesClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            border: "none",
            borderRight: `1px solid ${dividerColor}`,
            background: "transparent",
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Mail size={17} />
        </button>

        {/* Adjuntos Button */}
        <button
          title="Documentos / Adjuntos"
          onClick={handleAdjuntosClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            border: "none",
            background: "transparent",
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Paperclip size={17} />
        </button>
      </div>

      {/* Linker search dialog */}
      {showLinkModal && (() => {
        const modalTitle = showLinkModal === "cotizacion" ? "Cotizaciones" : showLinkModal === "propuesta" ? "Propuestas" : "Expediente";
        const createLabel = showLinkModal === "cotizacion" ? "Crear nueva cotización" : showLinkModal === "propuesta" ? "Crear nueva propuesta" : "Crear nuevo expediente";
        const existingItems = showLinkModal === "cotizacion" ? links.cotizaciones : showLinkModal === "propuesta" ? links.propuestas : (links.expedienteId ? [{ id: links.expedienteId, titulo: links.expediente?.referencia || links.expediente?.numero || links.expedienteId }] : []);
        const navigateToExisting = (item: any) => {
          if (showLinkModal === "cotizacion") router.push(`/cotizaciones/nueva?id=${item.id}`);
          else if (showLinkModal === "propuesta") router.push(`/propuestas/${item.id}`);
          else router.push(`/expedientes/${item.id}`);
          setShowLinkModal(null);
        };

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 10000, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ backgroundColor: "#ffffff", width: "420px", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>{modalTitle}</h3>
                <button
                  disabled={linking}
                  onClick={() => { setShowLinkModal(null); setSearchQuery(""); setSearchResults([]); }}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem", fontWeight: 500 }}
                >×</button>
              </div>

              {/* Existing linked items */}
              {existingItems.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Vinculados</div>
                  {existingItems.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => navigateToExisting(item)}
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "color-mix(in srgb, var(--primary-color, #4a88b5) 6%, white)", textAlign: "left", cursor: "pointer", width: "100%", fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary-color, #4a88b5) 12%, white)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary-color, #4a88b5) 6%, white)")}
                    >
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.titulo || item.title || item.nombre || item.referencia || `ID: ${item.id.substring(0, 8)}`}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--primary-color, #4a88b5)", fontWeight: 700, flexShrink: 0 }}>Ir →</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "-0.25rem" }} />

              {/* Search to link */}
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "-0.5rem" }}>Vincular otro</div>
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={linking}
                style={{ width: "100%", padding: "8px 12px", fontSize: "0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "160px", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "8px", padding: "4px" }}>
                {searching || linking ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem", gap: "8px" }}>
                    <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite", color: "var(--primary-color, #4a88b5)" }} />
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Procesando...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleLinkAction(item.id)}
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "6px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", width: "100%", fontSize: "0.78rem", color: "#334155" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <Link2 size={13} style={{ color: "var(--primary-color, #4a88b5)", flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.titulo || item.title || item.nombre || `ID: ${item.id.substring(0, 8)}`}
                      </span>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.72rem", color: "#94a3b8" }}>
                    Escribe para buscar.
                  </div>
                )}
              </div>

              {/* Footer: create new */}
              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
                <button
                  disabled={linking || searching}
                  onClick={handleCreateAndLinkNew}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "0.78rem", fontWeight: 600, borderRadius: "8px", border: "none", backgroundColor: "var(--primary-color, #4a88b5)", color: "#ffffff", cursor: (linking || searching) ? "not-allowed" : "pointer", opacity: (linking || searching) ? 0.7 : 1 }}
                  onMouseEnter={(e) => { if (!linking && !searching) e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary-color, #4a88b5) 85%, black)"; }}
                  onMouseLeave={(e) => { if (!linking && !searching) e.currentTarget.style.backgroundColor = "var(--primary-color, #4a88b5)"; }}
                >
                  <Plus size={13} />
                  {createLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
