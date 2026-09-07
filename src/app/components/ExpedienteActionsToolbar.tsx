"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Presentation, FolderOpen, Mail, Loader2, Link2, Plus, FileText } from "lucide-react";
import { LiaGoogleDrive } from "react-icons/lia";
import {
  getEntityLinks,
  linkCotizacionToExpediente,
  unlinkCotizacionFromExpediente,
  linkCotizacionToPresupuesto,
  linkPropuestaToExpediente,
  searchExpedientes,
  searchCotizaciones,
  searchPropuestas,
  searchPresupuestos,
  linkPropuestaToPresupuesto,
  createNewCotizacionLinked,
  createNewCotizacionLinkedToPresupuesto,
  createNewPropuestaLinked,
  createNewExpedienteLinked,
  createNewPresupuestoLinked,
} from "@/actions/expedientes";
import {
  crearPropuestaDesdeCotizacion,
  linkCotizacionToPropuesta,
  checkAjusteFechasCotizacion,
  linkCotizacionToPropuestaConAjuste,
} from "@/actions/propuestas";
import ImportarServiciosCotizacionModal from "@/components/modals/ImportarServiciosCotizacionModal";

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
  const [showLinkModal, setShowLinkModal] = useState<"cotizacion" | "propuesta" | "expediente" | "presupuesto" | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<"cotizacion" | "propuesta" | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  // Aviso de ajuste de fechas al vincular una propuesta con itinerario a una cotización
  const [ajusteFechas, setAjusteFechas] = useState<{
    cotizacionId: string;
    propuestaId: string;
    diasItinerario: number;
    diasCotizacion: number;
  } | null>(null);

  // Tras vincular/crear un expediente desde una cotización, ofrecer importar sus servicios
  const [importServiciosExpedienteId, setImportServiciosExpedienteId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdown]);

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
        } else if (showLinkModal === "presupuesto") {
          const res = await searchPresupuestos(searchQuery);
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
        } else if (initialPropuestaId) {
          const check = await checkAjusteFechasCotizacion(initialPropuestaId, targetId);
          if (check.requiereAjuste) {
            setAjusteFechas({
              cotizacionId: targetId,
              propuestaId: initialPropuestaId,
              diasItinerario: check.diasItinerario!,
              diasCotizacion: check.diasCotizacion!,
            });
            setLinking(false);
            return;
          }
          await linkCotizacionToPropuestaConAjuste(targetId, initialPropuestaId, false);
        }
      } else if (showLinkModal === "propuesta") {
        if (expId) {
          await linkPropuestaToExpediente(targetId, expId);
        } else if (initialCotizacionId) {
          const check = await checkAjusteFechasCotizacion(targetId, initialCotizacionId);
          if (check.requiereAjuste) {
            setAjusteFechas({
              cotizacionId: initialCotizacionId,
              propuestaId: targetId,
              diasItinerario: check.diasItinerario!,
              diasCotizacion: check.diasCotizacion!,
            });
            setLinking(false);
            return;
          }
          await linkCotizacionToPropuestaConAjuste(initialCotizacionId, targetId, false);
        } else {
          return;
        }
      } else if (showLinkModal === "expediente") {
        let cotVinculada: string | null = null;
        let res: { success: boolean; error?: string } | undefined;
        if (initialCotizacionId) {
          res = await linkCotizacionToExpediente(initialCotizacionId, targetId);
          if (res?.success) cotVinculada = initialCotizacionId;
        } else if (initialPropuestaId) {
          res = await linkPropuestaToExpediente(initialPropuestaId, targetId);
        } else if (initialPresupuestoId) {
          // Link the cotizacion already tied to this presupuesto to the expediente
          const cotId = links.cotizaciones[0]?.id;
          if (cotId) {
            res = await linkCotizacionToExpediente(cotId, targetId);
            if (res?.success) cotVinculada = cotId;
          }
        }
        if (res && !res.success) {
          alert(res.error || "No se pudo vincular el expediente.");
          setLinking(false);
          return;
        }
        if (cotVinculada) setImportServiciosExpedienteId(targetId);
      } else if (showLinkModal === "presupuesto") {
        if (initialCotizacionId) {
          await linkCotizacionToPresupuesto(initialCotizacionId, targetId);
        } else if (initialPropuestaId) {
          const cotId = links.cotizaciones[0]?.id;
          if (cotId) {
            await linkCotizacionToPresupuesto(cotId, targetId);
          } else {
            await linkPropuestaToPresupuesto(initialPropuestaId, targetId);
          }
        } else if (initialExpedienteId || links.expedienteId) {
          const expId = initialExpedienteId || links.expedienteId;
          const cotId = links.cotizaciones[0]?.id;
          if (cotId) {
            await linkCotizacionToPresupuesto(cotId, targetId);
          } else {
            const newCotRes = await createNewCotizacionLinked(expId);
            if (newCotRes.success && newCotRes.data?.id) {
              await linkCotizacionToPresupuesto(newCotRes.data.id, targetId);
            }
          }
        }
      }

      await loadLinks();
      setShowLinkModal(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      console.error("Linking error:", err);
      alert(err?.message || "Error al vincular el elemento.");
    } finally {
      setLinking(false);
    }
  };

  const confirmarAjusteFechas = async (ajustar: boolean) => {
    if (!ajusteFechas) return;
    setLinking(true);
    try {
      await linkCotizacionToPropuestaConAjuste(ajusteFechas.cotizacionId, ajusteFechas.propuestaId, ajustar);
      await loadLinks();
      setAjusteFechas(null);
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
        if (res.success && res.data) {
          setShowLinkModal(null);
          router.push(`/cotizaciones/nueva?id=${res.data.id}`);
          return;
        } else {
          throw new Error(res.error);
        }
      } else if (showLinkModal === "propuesta") {
        if (expId) {
          const res = await createNewPropuestaLinked(expId);
          if (res.success && res.data) {
            setShowLinkModal(null);
            router.push(`/propuestas/${res.data.id}`);
            return;
          } else {
            throw new Error(res.error);
          }
        } else if (initialCotizacionId) {
          const res = await crearPropuestaDesdeCotizacion(initialCotizacionId);
          if (res.success && res.data) {
            setShowLinkModal(null);
            router.push(`/propuestas/${res.data.id}`);
            return;
          } else {
            throw new Error(res.error);
          }
        } else {
          throw new Error("Sin expediente ni cotización vinculada");
        }
      } else if (showLinkModal === "expediente") {
        const type = initialCotizacionId ? "cotizacion" : "propuesta";
        const linkedId = initialCotizacionId || initialPropuestaId;
        if (!linkedId) return;
        const res = await createNewExpedienteLinked(linkedId, type);
        if (res.success && res.data) {
          alert(`Se ha creado el expediente "${res.data.numero} - ${res.data.referencia}" y se ha vinculado.`);
          if (type === "cotizacion") setImportServiciosExpedienteId(res.data.id);
        } else {
          throw new Error(res.error);
        }
      } else if (showLinkModal === "presupuesto") {
        const type = initialCotizacionId ? "cotizacion" : initialPropuestaId ? "propuesta" : "expediente";
        const linkedId = initialCotizacionId || initialPropuestaId || initialExpedienteId || links.expedienteId;
        const res = await createNewPresupuestoLinked(linkedId, type);
        if (res.success && res.data) {
          setShowLinkModal(null);
          router.push(`/presupuestos/nuevo?edit=${res.data.id}`);
          return;
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
    setActiveDropdown(null);
    if (hasPresup && links.presupuestoId) {
      router.push(`/presupuestos/nuevo?edit=${links.presupuestoId}`);
    } else {
      setShowLinkModal("presupuesto");
    }
  };

  const handleCotizacionClick = () => {
    if (links.cotizaciones.length > 1) {
      setActiveDropdown(prev => prev === "cotizacion" ? null : "cotizacion");
    } else if (hasCot && links.cotizaciones[0]?.id) {
      setActiveDropdown(null);
      router.push(`/cotizaciones/nueva?id=${links.cotizaciones[0].id}`);
    } else {
      setActiveDropdown(null);
      setShowLinkModal("cotizacion");
    }
  };

  const handlePropuestaClick = () => {
    if (links.propuestas.length > 1) {
      setActiveDropdown(prev => prev === "propuesta" ? null : "propuesta");
    } else if (hasProp && links.propuestas[0]?.id) {
      setActiveDropdown(null);
      router.push(`/propuestas/${links.propuestas[0].id}`);
    } else {
      setActiveDropdown(null);
      setShowLinkModal("propuesta");
    }
  };

  const handleFolderClick = () => {
    setActiveDropdown(null);
    const expId = initialExpedienteId || links.expedienteId;
    if (expId) {
      router.push(`/expedientes/${expId}`);
    } else {
      setShowLinkModal("expediente");
    }
  };

  const handleFolderUnlink = async (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveDropdown(null);
    const expId = initialExpedienteId || links.expedienteId;
    const cotId = initialCotizacionId || links.cotizaciones[0]?.id;
    if (!expId || !cotId) return;
    if (!confirm("¿Desvincular esta cotización y sus propuestas del expediente?")) return;
    setLinking(true);
    try {
      const res = await unlinkCotizacionFromExpediente(cotId);
      if (!res.success) {
        alert(res.error || "No se pudo desvincular el expediente.");
        return;
      }
      await loadLinks();
    } finally {
      setLinking(false);
    }
  };

  const handleMessagesClick = () => {
    setActiveDropdown(null);
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
    setActiveDropdown(null);
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
      <div ref={toolbarRef} style={{ position: "relative", display: "inline-flex" }}>
      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${darkPrimary}`, borderRadius: "8px", overflow: "hidden", background: darkPrimary }}>
        {/* Presupuesto Button */}
        <button
          title={hasPresup ? `Ver Solicitud: ${links.presupuesto?.titulo_viaje || links.presupuestoId}` : "Vincular Solicitud de Presupuesto"}
          onClick={handlePresupuestoClick}
          style={{
            position: "relative",
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
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <FileText size={17} />
        </button>

        {/* Cotizaciones Button */}
        <button
          title={links.cotizaciones.length > 1 ? `Ver cotizaciones (${links.cotizaciones.length})` : hasCot ? `Ver Cotización: ${links.cotizaciones[0].titulo}` : "Vincular Cotización"}
          onClick={handleCotizacionClick}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            border: "none",
            borderRight: `1px solid ${dividerColor}`,
            background: activeDropdown === "cotizacion" ? "rgba(255, 255, 255, 0.2)" : "transparent",
            color: "#ffffff",
            opacity: hasCot ? 1 : 0.4,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = activeDropdown === "cotizacion" ? "rgba(255, 255, 255, 0.2)" : "transparent"; }}
        >
          <Calculator size={17} />
          {links.cotizaciones.length > 1 && (
            <span style={{
              position: "absolute",
              top: "3px",
              right: "3px",
              backgroundColor: "#f59e0b",
              color: "#ffffff",
              fontSize: "0.6rem",
              fontWeight: 800,
              borderRadius: "9999px",
              minWidth: "13px",
              height: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 2px",
              lineHeight: 1,
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
            }}>
              {links.cotizaciones.length}
            </span>
          )}
        </button>

        {/* Propuestas Button */}
        <button
          title={links.propuestas.length > 1 ? `Ver propuestas (${links.propuestas.length})` : hasProp ? `Ver Propuesta: ${links.propuestas[0].title}` : "Vincular Propuesta"}
          onClick={handlePropuestaClick}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            border: "none",
            borderRight: `1px solid ${dividerColor}`,
            background: activeDropdown === "propuesta" ? "rgba(255, 255, 255, 0.2)" : "transparent",
            color: "#ffffff",
            opacity: hasProp ? 1 : 0.4,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = activeDropdown === "propuesta" ? "rgba(255, 255, 255, 0.2)" : "transparent"; }}
        >
          <Presentation size={17} />
          {links.propuestas.length > 1 && (
            <span style={{
              position: "absolute",
              top: "3px",
              right: "3px",
              backgroundColor: "#f59e0b",
              color: "#ffffff",
              fontSize: "0.6rem",
              fontWeight: 800,
              borderRadius: "9999px",
              minWidth: "13px",
              height: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 2px",
              lineHeight: 1,
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
            }}>
              {links.propuestas.length}
            </span>
          )}
        </button>

        {/* Expediente / Open Folder Button */}
        <button
          title={hasFolder ? "Ver Expediente (clic derecho para desvincular)" : "Vincular a Expediente"}
          onClick={handleFolderClick}
          onContextMenu={hasFolder ? handleFolderUnlink : undefined}
          style={{
            position: "relative",
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
          <LiaGoogleDrive size={19} />
        </button>
      </div>

      {/* Floating Dropdown */}
      {activeDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 9999,
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
            border: "1px solid #e2e8f0",
            minWidth: "250px",
            maxWidth: "340px",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ padding: "4px 8px 6px", fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{activeDropdown === "cotizacion" ? "Cotizaciones vinculadas" : "Propuestas vinculadas"}</span>
            <span style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: "9999px", fontSize: "0.65rem", fontWeight: 700, color: "#475569" }}>
              {activeDropdown === "cotizacion" ? links.cotizaciones.length : links.propuestas.length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "200px", overflowY: "auto" }}>
            {(activeDropdown === "cotizacion" ? links.cotizaciones : links.propuestas).map((item: any) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveDropdown(null);
                  if (activeDropdown === "cotizacion") router.push(`/cotizaciones/nueva?id=${item.id}`);
                  else router.push(`/propuestas/${item.id}`);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  width: "100%",
                  fontSize: "0.8rem",
                  color: "#1e293b",
                  fontWeight: 500,
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary-color, #4a88b5) 8%, white)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.titulo || item.title || `ID: ${item.id.substring(0, 8)}`}
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--primary-color, #4a88b5)", fontWeight: 700, flexShrink: 0 }}>
                  Ir →
                </span>
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "6px", marginTop: "2px" }}>
            <button
              onClick={() => {
                const target = activeDropdown;
                setActiveDropdown(null);
                setShowLinkModal(target);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                color: "var(--primary-color, #4a88b5)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f8fafc")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <Plus size={13} />
              <span>{activeDropdown === "cotizacion" ? "Gestionar / Crear cotización" : "Gestionar / Crear propuesta"}</span>
            </button>
          </div>
        </div>
      )}
    </div>

      {/* Linker search dialog */}
      {showLinkModal && (() => {
        const modalTitle = showLinkModal === "cotizacion" ? "Cotizaciones" : showLinkModal === "propuesta" ? "Propuestas" : showLinkModal === "expediente" ? "Expediente" : "Solicitud de Presupuesto";
        const createLabel = showLinkModal === "cotizacion" ? "Crear nueva cotización" : showLinkModal === "propuesta" ? "Crear nueva propuesta" : showLinkModal === "expediente" ? "Crear nuevo expediente" : "Crear nueva solicitud";
        const existingItems = showLinkModal === "cotizacion"
          ? links.cotizaciones
          : showLinkModal === "propuesta"
            ? links.propuestas
            : showLinkModal === "expediente"
              ? (links.expedienteId ? [{ id: links.expedienteId, titulo: links.expediente?.referencia || links.expediente?.numero || links.expedienteId }] : [])
              : (links.presupuestoId ? [{ id: links.presupuestoId, titulo: links.presupuesto?.titulo_viaje || `Solicitud #${links.presupuestoId.substring(0, 8)}` }] : []);
        const navigateToExisting = (item: any) => {
          if (showLinkModal === "cotizacion") router.push(`/cotizaciones/nueva?id=${item.id}`);
          else if (showLinkModal === "propuesta") router.push(`/propuestas/${item.id}`);
          else if (showLinkModal === "expediente") router.push(`/expedientes/${item.id}`);
          else router.push(`/presupuestos/nuevo?edit=${item.id}`);
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

      {/* Aviso de ajuste de fechas del itinerario al vincular */}
      {ajusteFechas && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10001, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#ffffff", width: "400px", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>Las fechas no coinciden</h3>
            <p style={{ fontSize: "0.82rem", color: "#475569", margin: 0, lineHeight: 1.5 }}>
              El itinerario de la propuesta tiene <strong>{ajusteFechas.diasItinerario} días</strong>, pero la cotización dura <strong>{ajusteFechas.diasCotizacion} días</strong>.
              {ajusteFechas.diasCotizacion < ajusteFechas.diasItinerario
                ? ` Si ajustas, se recortarán los últimos ${ajusteFechas.diasItinerario - ajusteFechas.diasCotizacion} día(s) del itinerario.`
                : ` Si ajustas, se añadirán ${ajusteFechas.diasCotizacion - ajusteFechas.diasItinerario} día(s) vacío(s) al final del itinerario.`}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "0.9rem" }}>
              <button
                disabled={linking}
                onClick={() => confirmarAjusteFechas(false)}
                style={{ padding: "8px 14px", fontSize: "0.78rem", fontWeight: 600, borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", cursor: linking ? "not-allowed" : "pointer" }}
              >
                Vincular sin ajustar
              </button>
              <button
                disabled={linking}
                onClick={() => confirmarAjusteFechas(true)}
                style={{ padding: "8px 14px", fontSize: "0.78rem", fontWeight: 600, borderRadius: "8px", border: "none", backgroundColor: "var(--primary-color, #4a88b5)", color: "#ffffff", cursor: linking ? "not-allowed" : "pointer", opacity: linking ? 0.7 : 1 }}
              >
                Ajustar y vincular
              </button>
            </div>
          </div>
        </div>
      )}

      {importServiciosExpedienteId && (
        <ImportarServiciosCotizacionModal
          isOpen={true}
          onClose={() => setImportServiciosExpedienteId(null)}
          expedienteId={importServiciosExpedienteId}
          onSuccess={() => setImportServiciosExpedienteId(null)}
        />
      )}
    </>
  );
}
