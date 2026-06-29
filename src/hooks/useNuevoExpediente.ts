"use client";

import { useState, useEffect, useRef } from "react";
import { createExpediente, updateExpediente } from "@/actions/expedientes";
import { getDestinos, createDestino, createDestinoFromPlace } from "@/actions/destinos";
import { getEntidades, createEntidad } from "@/actions/entidades";
import { searchPlaces, getPlaceDetails } from "@/actions/places";
import type { PlaceSuggestion } from "@/actions/places";

export interface Plazo {
  id: string;
  fecha: string;
  importe: number;
}

export function useNuevoExpediente(
  isOpen: boolean,
  onClose: () => void,
  onSuccess: () => void,
  expedienteToEdit?: any
) {
  const [loading, setLoading] = useState(false);
  const [destinos, setDestinos] = useState<any[]>([]);
  const [searchDestino, setSearchDestino] = useState("");
  const [isDestinoDropdownOpen, setIsDestinoDropdownOpen] = useState(false);
  const [showPlacesPanel, setShowPlacesPanel] = useState(false);
  const [placesQuery, setPlacesQuery] = useState("");
  const [placesSuggestions, setPlacesSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const placesInputRef = useRef<HTMLInputElement>(null);
  const placesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [entidades, setEntidades] = useState<any[]>([]);
  const [contactoId, setContactoId] = useState("");
  const [searchContacto, setSearchContacto] = useState("");
  const [isContactoDropdownOpen, setIsContactoDropdownOpen] = useState(false);
  const contactoSearchRef = useRef<HTMLInputElement>(null);
  const [numero, setNumero] = useState("");
  const [referencia, setReferencia] = useState("");
  const [destinoPrincipal, setDestinoPrincipal] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoExpediente, setTipoExpediente] = useState<"grupo" | "vacacional" | "p2p">("vacacional");
  const [formaPago, setFormaPago] = useState<"un_pagador" | "varios_pagadores">("un_pagador");
  const [formasPagoAceptadas, setFormasPagoAceptadas] = useState<string[]>(["Transferencia"]);
  const [generaApunte, setGeneraApunte] = useState(false);
  const [plazos, setPlazos] = useState<Plazo[]>([]);
  const [fechaPlazo, setFechaPlazo] = useState("");
  const [importePlazo, setImportePlazo] = useState("");
  const [editingPlazoId, setEditingPlazoId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([getDestinos(), getEntidades()])
      .then(([d, e]) => { setDestinos(d || []); setEntidades(e || []); })
      .catch(() => {});
  }, [isOpen]);

  const resetForm = () => {
    setNumero(""); setReferencia(""); setDestinoPrincipal(""); setFechaInicio(""); setFechaFin("");
    setTipoExpediente("vacacional"); setFormaPago("un_pagador"); setFormasPagoAceptadas(["Transferencia"]);
    setPlazos([]); setGeneraApunte(false); setContactoId(""); setSearchContacto(""); setSearchDestino("");
    setPlacesQuery(""); setPlacesSuggestions([]); setShowPlacesPanel(false);
  };

  useEffect(() => {
    if (!isOpen) { resetForm(); return; }
    if (!expedienteToEdit) return;
    setNumero(expedienteToEdit.numero?.toString() || "");
    setReferencia(expedienteToEdit.referencia || "");
    setDestinoPrincipal(expedienteToEdit.destino_principal || "");
    setFechaInicio(expedienteToEdit.fecha_inicio || "");
    setFechaFin(expedienteToEdit.fecha_fin || "");
    setTipoExpediente(expedienteToEdit.tipo_expediente || "vacacional");
    setFormaPago(expedienteToEdit.forma_pago || "un_pagador");
    setFormasPagoAceptadas(expedienteToEdit.formas_pago_aceptadas || ["Transferencia"]);
    setPlazos((expedienteToEdit.plazos || []).map((p: any) => ({ id: crypto.randomUUID(), fecha: p.fecha, importe: Number(p.importe || 0) })));
    setGeneraApunte(expedienteToEdit.genera_apunte ?? false);
    setContactoId(expedienteToEdit.entidad_id || "");
    setSearchContacto(""); setSearchDestino(""); setPlacesQuery(""); setPlacesSuggestions([]); setShowPlacesPanel(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, expedienteToEdit]);

  useEffect(() => {
    if (showPlacesPanel && placesInputRef.current) setTimeout(() => placesInputRef.current?.focus(), 50);
  }, [showPlacesPanel]);

  useEffect(() => {
    if (isContactoDropdownOpen && contactoSearchRef.current) setTimeout(() => contactoSearchRef.current?.focus(), 50);
  }, [isContactoDropdownOpen]);

  useEffect(() => {
    if (!showPlacesPanel) return;
    if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    if (placesQuery.trim().length < 2) { setPlacesSuggestions([]); return; }
    placesDebounceRef.current = setTimeout(async () => {
      setPlacesLoading(true);
      try { setPlacesSuggestions(await searchPlaces(placesQuery)); }
      catch { setPlacesSuggestions([]); }
      finally { setPlacesLoading(false); }
    }, 300);
    return () => { if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current); };
  }, [placesQuery, showPlacesPanel]);

  const openPlacesPanel = () => { setPlacesQuery(searchDestino.trim()); setPlacesSuggestions([]); setShowPlacesPanel(true); };
  const closePlacesPanel = () => { setShowPlacesPanel(false); setPlacesQuery(""); setPlacesSuggestions([]); };

  const handleSelectPlace = async (suggestion: PlaceSuggestion) => {
    setPlacesLoading(true);
    try {
      const details = await getPlaceDetails(suggestion.placeId);
      if (!details) throw new Error("No se obtuvieron detalles del lugar");
      const newDest = await createDestinoFromPlace(details);
      if (newDest) {
        setDestinos(prev => [...prev, newDest].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setDestinoPrincipal(newDest.id);
      }
    } catch (err: any) {
      alert("Error al crear destino: " + err.message);
    } finally {
      setPlacesLoading(false); closePlacesPanel(); setSearchDestino(""); setIsDestinoDropdownOpen(false);
    }
  };

  const handleSaveWithoutGoogle = async () => {
    const name = placesQuery.trim() || searchDestino.trim();
    if (!name) return;
    setPlacesLoading(true);
    try {
      const newDest = await createDestino(name);
      if (newDest) {
        setDestinos(prev => [...prev, newDest].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setDestinoPrincipal(newDest.id);
      }
    } catch (err: any) {
      alert("Error al crear destino: " + err.message);
    } finally {
      setPlacesLoading(false); closePlacesPanel(); setSearchDestino(""); setIsDestinoDropdownOpen(false);
    }
  };

  const handleCreateContacto = async () => {
    const name = searchContacto.trim() || (prompt("Introduce el nombre del nuevo contacto:") ?? "").trim();
    if (!name) return;
    setLoading(true);
    try {
      const newEnt = await createEntidad(name);
      if (newEnt) {
        setEntidades(prev => [...prev, newEnt].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setContactoId(newEnt.id); setSearchContacto(""); setIsContactoDropdownOpen(false);
      }
    } catch (err: any) {
      alert("Error al crear contacto: " + err.message);
    } finally { setLoading(false); }
  };

  const handleCheckboxChange = (method: string) => {
    setFormasPagoAceptadas(prev => prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]);
  };

  const handleSavePlazo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaPlazo || !importePlazo) { alert("Por favor, introduce una fecha y un importe."); return; }
    const val = parseFloat(importePlazo);
    if (isNaN(val) || val <= 0) { alert("Introduce un importe numérico válido."); return; }
    if (editingPlazoId) {
      setPlazos(prev => prev.map(p => p.id === editingPlazoId ? { ...p, fecha: fechaPlazo, importe: val } : p));
      setEditingPlazoId(null);
    } else {
      setPlazos(prev => [...prev, { id: crypto.randomUUID(), fecha: fechaPlazo, importe: val }]);
    }
    setFechaPlazo(""); setImportePlazo("");
  };

  const handleEditPlazo = (plazo: Plazo) => { setEditingPlazoId(plazo.id); setFechaPlazo(plazo.fecha); setImportePlazo(plazo.importe.toString()); };

  const handleDeletePlazo = (id: string) => {
    setPlazos(prev => prev.filter(p => p.id !== id));
    if (editingPlazoId === id) { setEditingPlazoId(null); setFechaPlazo(""); setImportePlazo(""); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referencia.trim()) { alert("Por favor, introduce una referencia."); return; }
    if (!destinoPrincipal.trim()) { alert("Por favor, introduce un destino principal."); return; }
    setLoading(true);
    try {
      const payload: any = {
        referencia, destino_principal: destinoPrincipal, entidad_id: contactoId || null,
        fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null,
        tipo_expediente: tipoExpediente, forma_pago: formaPago,
        formas_pago_aceptadas: formasPagoAceptadas,
        plazos: plazos.map(p => ({ fecha: p.fecha, importe: p.importe })),
        genera_apunte: generaApunte,
      };
      if (numero.trim()) payload.numero = numero.trim();
      if (expedienteToEdit?.id) await updateExpediente(expedienteToEdit.id, payload);
      else await createExpediente(payload);
      onSuccess(); onClose();
    } catch (err: any) {
      alert("Error al guardar el expediente: " + err.message);
    } finally { setLoading(false); }
  };

  return {
    loading,
    destinos, searchDestino, setSearchDestino, isDestinoDropdownOpen, setIsDestinoDropdownOpen,
    showPlacesPanel, placesQuery, setPlacesQuery, placesSuggestions, placesLoading, placesInputRef,
    openPlacesPanel, closePlacesPanel, handleSelectPlace, handleSaveWithoutGoogle,
    entidades, contactoId, setContactoId, searchContacto, setSearchContacto,
    isContactoDropdownOpen, setIsContactoDropdownOpen, contactoSearchRef, handleCreateContacto,
    numero, setNumero, referencia, setReferencia, destinoPrincipal, setDestinoPrincipal,
    fechaInicio, setFechaInicio, fechaFin, setFechaFin,
    tipoExpediente, setTipoExpediente, formaPago, setFormaPago,
    formasPagoAceptadas, generaApunte, setGeneraApunte, handleCheckboxChange,
    plazos, fechaPlazo, setFechaPlazo, importePlazo, setImportePlazo, editingPlazoId,
    handleSavePlazo, handleEditPlazo, handleDeletePlazo, handleSubmit,
  };
}
