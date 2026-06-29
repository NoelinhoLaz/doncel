"use client";

import { useState, useEffect, useRef } from "react";
import { Icons } from "@/lib/icons";
import { getEntidades, createEntidadCompleta } from "@/actions/entidades";
import { updateExpedienteContacto } from "@/actions/expedientes";
import { searchPlaces, getPlaceDetails } from "@/actions/places";
import styles from "@/app/expedientes/modals.module.css";
import type { ExpedienteRow } from "@/lib/utils/expedientesUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expediente: ExpedienteRow | null;
  onSuccess: () => void;
}

export default function ModalContactoExpediente({ isOpen, onClose, expediente, onSuccess }: Props) {
  const [allEntidades, setAllEntidades] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [placesSuggestions, setPlacesSuggestions] = useState<any[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  const placesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const skipPlacesSearchRef = useRef(false);

  // Load entidades when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    setIsDropdownOpen(false);
    setShowAddForm(false);
    const load = async () => {
      try {
        const ents = await getEntidades();
        setAllEntidades(ents || []);
      } catch (err) {
        console.error("Error loading entidades:", err);
      }
    };
    load();
  }, [isOpen]);

  // Google Places debounced autocomplete
  useEffect(() => {
    if (!showAddForm) return;
    if (skipPlacesSearchRef.current) {
      skipPlacesSearchRef.current = false;
      return;
    }
    if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    if (address.trim().length < 2) {
      setPlacesSuggestions([]);
      return;
    }
    placesDebounceRef.current = setTimeout(async () => {
      setPlacesLoading(true);
      try {
        const results = await searchPlaces(address);
        setPlacesSuggestions(results || []);
      } catch {
        setPlacesSuggestions([]);
      } finally {
        setPlacesLoading(false);
      }
    }, 300);
    return () => { if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current); };
  }, [address, showAddForm]);

  async function handleSelectPlace(suggestion: any) {
    setPlacesLoading(true);
    try {
      const details = await getPlaceDetails(suggestion.placeId);
      if (details) {
        const rawComponents =
          (details.googleMetadata as any)?.addressComponents ||
          (details.googleMetadata as any)?.address_components || [];
        let route = "";
        let streetNumber = "";
        for (const comp of rawComponents) {
          const types = comp.types || [];
          if (types.includes("route"))
            route = comp.longText || comp.long_name || comp.longName || "";
          if (types.includes("street_number"))
            streetNumber = comp.longText || comp.long_name || comp.longName || "";
        }
        const streetAndNumber = route
          ? streetNumber ? `${route}, ${streetNumber}` : route
          : details.formattedAddress?.split(",")[0] || "";

        skipPlacesSearchRef.current = true;
        setAddress(streetAndNumber);
        setCity(details.locality || "");
        setProvince(details.adminAreaL2 || details.adminAreaL1 || "");
        setPostalCode(details.postalCode || "");
        setTimeout(() => cityInputRef.current?.focus(), 50);
      }
    } catch (err) {
      console.error("Error fetching place details:", err);
    } finally {
      setPlacesLoading(false);
      setPlacesSuggestions([]);
    }
  }

  async function handleAssign(entidadId: string) {
    try {
      await updateExpedienteContacto(expediente!.realId, entidadId);
      onClose();
      onSuccess();
    } catch (err) {
      console.error("Error updating contact:", err);
    }
  }

  async function handleRemove() {
    if (!confirm("¿Estás seguro de que deseas quitar el contacto de este expediente?")) return;
    try {
      await updateExpedienteContacto(expediente!.realId, null);
      onClose();
      onSuccess();
    } catch (err) {
      console.error("Error clearing contact:", err);
    }
  }

  async function handleQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const payload = {
        nombre: name,
        email: email || undefined,
        direccion: address.trim()
          ? { calle: address, ciudad: city, provincia: province, codigo_postal: postalCode }
          : undefined,
      };
      const newEntity = await createEntidadCompleta(payload);
      if (newEntity) {
        await updateExpedienteContacto(expediente!.realId, newEntity.id);
        onClose();
        onSuccess();
      }
    } catch (err) {
      console.error("Error creating quick contact:", err);
      alert("Error al crear el contacto.");
    }
  }

  if (!isOpen || !expediente) return null;

  const filteredEntidades = allEntidades.filter((ent) => {
    const q = searchQuery.toLowerCase();
    return (
      ent.nombre?.toLowerCase().includes(q) ||
      ent.documento?.toLowerCase().includes(q) ||
      ent.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className={styles.overlay}
      onClick={() => { onClose(); }}
    >
      <div
        className={`${styles.modal} ${styles.contactModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.headerAlt}>
          <h3 className={styles.titleRow}>
            <span>👤 Asignar Contacto</span>
            <span className={styles.titleSub}>Exp. {expediente.id}</span>
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.contactBody}>
          {!showAddForm ? (
            <>
              {/* Entity search */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Buscar Entidad / Contacto existente</label>
                <div className={styles.searchWrapper}>
                  <Icons.Search size={16} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Escribe el nombre, NIF o email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    className={styles.searchInput}
                  />
                </div>

                {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
                  <span className={styles.searchHint}>Escribe al menos 3 letras para buscar...</span>
                )}

                {isDropdownOpen && searchQuery.trim().length >= 3 && (
                  <div className={styles.resultsDropdown}>
                    {filteredEntidades.length === 0 ? (
                      <div className={styles.noResults}>No se encontraron resultados</div>
                    ) : (
                      filteredEntidades.map((ent) => (
                        <div
                          key={ent.id}
                          className={styles.resultItem}
                          onClick={() => handleAssign(ent.id)}
                        >
                          <span className={styles.resultName}>{ent.nombre}</span>
                          <div className={styles.resultMeta}>
                            {ent.direccion?.ciudad && (
                              <span className={styles.resultCityTag}>
                                <Icons.Destino size={10} />
                                {ent.direccion.ciudad}
                              </span>
                            )}
                            {ent.email && <span>{ent.email}</span>}
                            {ent.documento && <span>· {ent.documento}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Current contact */}
              {expediente.contactoNombre && (
                <div className={styles.currentContactCard}>
                  <div className={styles.currentContactInfo}>
                    <span className={styles.currentContactLabel}>Contacto Actual</span>
                    <span className={styles.currentContactName}>{expediente.contactoNombre}</span>
                  </div>
                  <button className={styles.removeContactBtn} onClick={handleRemove}>
                    Quitar
                  </button>
                </div>
              )}

              {/* Divider + create button */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div className={styles.divider}>
                  <span className={styles.dividerLine} />
                  <span>¿No encuentras el contacto?</span>
                  <span className={styles.dividerLine} />
                </div>
                <button
                  className={styles.createContactBtn}
                  onClick={() => {
                    setName(searchQuery || "");
                    setEmail("");
                    setAddress("");
                    setCity("");
                    setProvince("");
                    setShowAddForm(true);
                  }}
                >
                  <Icons.Add size={16} />
                  <span>Crear Nuevo Contacto Rápido</span>
                </button>
              </div>
            </>
          ) : (
            /* Quick contact form */
            <form className={styles.quickForm} onSubmit={handleQuickCreate}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nombre de la entidad o persona"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                />
              </div>

              {/* Address with Google Places */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Dirección (Calle y Número)</label>
                <div className={styles.placesWrapper}>
                  <input
                    type="text"
                    placeholder="Buscar dirección con Google Places..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={styles.input}
                  />
                  {placesLoading && (
                    <span className={styles.placesLoadingHint}>Cargando...</span>
                  )}
                </div>

                {placesSuggestions.length > 0 && (
                  <>
                    <div className={styles.placesBackdrop} onClick={() => setPlacesSuggestions([])} />
                    <div className={styles.placesSuggestions}>
                      {placesSuggestions.map((s) => (
                        <div
                          key={s.placeId}
                          className={styles.placeItem}
                          onClick={() => handleSelectPlace(s)}
                        >
                          <div className={styles.placeMain}>{s.mainText}</div>
                          <div className={styles.placeSub}>{s.secondaryText}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Ciudad</label>
                  <input
                    ref={cityInputRef}
                    type="text"
                    placeholder="Ej. Madrid"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Provincia</label>
                  <input
                    type="text"
                    placeholder="Ej. Madrid"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Código Postal</label>
                <input
                  type="text"
                  placeholder="Ej. 28001"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.quickFormFooter}>
                <button type="button" className={styles.backBtn} onClick={() => setShowAddForm(false)}>
                  Atrás
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Crear y Asignar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
