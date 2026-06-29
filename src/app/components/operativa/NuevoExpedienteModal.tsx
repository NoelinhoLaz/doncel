"use client";

import { Icons } from "@/lib/icons";
import { useNuevoExpediente } from "@/hooks/useNuevoExpediente";
import ContactoDropdownField from "./ContactoDropdownField";
import DestinoConPlacesField from "./DestinoConPlacesField";
import PlazosField from "./PlazosField";
import s from "@/components/modals/nuevoExpediente.module.css";

interface NuevoExpedienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expedienteToEdit?: any;
}

export default function NuevoExpedienteModal({ isOpen, onClose, onSuccess, expedienteToEdit }: NuevoExpedienteModalProps) {
  const h = useNuevoExpediente(isOpen, onClose, onSuccess, expedienteToEdit);

  if (!isOpen) return null;

  return (
    <div className={s.overlay}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <header className={s.header}>
          <div className={s.headerTitle}>
            <Icons.Expedientes size={20} />
            <h2>{expedienteToEdit ? "Editar Expediente" : "Crear Nuevo Expediente"}</h2>
          </div>
          <button onClick={onClose} className={s.closeBtn}><Icons.Close size={18} /></button>
        </header>

        <form onSubmit={h.handleSubmit} className={s.form}>
          <ContactoDropdownField
            entidades={h.entidades} contactoId={h.contactoId} onContactoChange={h.setContactoId}
            searchContacto={h.searchContacto} onSearchChange={h.setSearchContacto}
            isOpen={h.isContactoDropdownOpen} onOpenChange={h.setIsContactoDropdownOpen}
            searchRef={h.contactoSearchRef} onCreateContacto={h.handleCreateContacto}
            disabled={h.loading}
          />

          <div className={s.grid2}>
            {/* Número */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}>Número (Opcional)</label>
              <input type="number" placeholder="Autogenerado" value={h.numero} onChange={(e) => h.setNumero(e.target.value)} className={s.inp} disabled={h.loading} />
            </div>

            {/* Referencia */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}>Referencia *</label>
              <input type="text" placeholder="ej. 2025/2026 Roma" value={h.referencia} onChange={(e) => h.setReferencia(e.target.value)} className={s.inp} required disabled={h.loading} />
            </div>

            {/* Destino Principal */}
            <DestinoConPlacesField
              destinos={h.destinos} destinoPrincipal={h.destinoPrincipal} onDestinoChange={h.setDestinoPrincipal}
              searchDestino={h.searchDestino} onSearchChange={h.setSearchDestino}
              isDropdownOpen={h.isDestinoDropdownOpen} onDropdownChange={h.setIsDestinoDropdownOpen}
              showPlacesPanel={h.showPlacesPanel} placesQuery={h.placesQuery} onPlacesQueryChange={h.setPlacesQuery}
              placesSuggestions={h.placesSuggestions} placesLoading={h.placesLoading} placesInputRef={h.placesInputRef}
              onOpenPlaces={h.openPlacesPanel} onClosePlaces={h.closePlacesPanel}
              onSelectPlace={h.handleSelectPlace} onSaveWithoutGoogle={h.handleSaveWithoutGoogle}
              disabled={h.loading}
            />

            {/* Tipo */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}>Tipo Expediente</label>
              <select value={h.tipoExpediente} onChange={(e) => h.setTipoExpediente(e.target.value as any)} className={s.sel} disabled={h.loading}>
                <option value="vacacional">Vacacional</option>
                <option value="grupo">Grupo</option>
                <option value="p2p">P2P</option>
              </select>
            </div>

            {/* Fechas */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}>Fecha Inicio</label>
              <input type="date" value={h.fechaInicio} onChange={(e) => h.setFechaInicio(e.target.value)} className={s.inp} disabled={h.loading} />
            </div>
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}>Fecha Fin</label>
              <input type="date" value={h.fechaFin} onChange={(e) => h.setFechaFin(e.target.value)} className={s.inp} disabled={h.loading} />
            </div>

            {/* Forma de pago */}
            <div className={s.fieldWrap}>
              <label className={s.fieldLabel}>Forma de Pago</label>
              <select value={h.formaPago} onChange={(e) => h.setFormaPago(e.target.value as any)} className={s.sel} disabled={h.loading}>
                <option value="un_pagador">Un solo pagador</option>
                <option value="varios_pagadores">Varios pagadores (viajeros)</option>
              </select>
            </div>

            {/* Genera Apunte toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingTop: "1rem" }}>
              <label className={s.toggleWrap}>
                <input type="checkbox" checked={h.generaApunte} onChange={(e) => h.setGeneraApunte(e.target.checked)} className={s.toggleInput} disabled={h.loading} />
                <span className={`${s.toggleTrack} ${h.generaApunte ? s.toggleTrackOn : ""}`}>
                  <span className={`${s.toggleKnob} ${h.generaApunte ? s.toggleKnobOn : ""}`} />
                </span>
              </label>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>Generar apunte contable</span>
            </div>
          </div>

          {/* Formas de pago aceptadas */}
          <div className={s.formasPagoSection}>
            <span className={s.fieldLabel}>Formas de Pago Aceptadas</span>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", paddingTop: "0.25rem" }}>
              {["Transferencia", "Tarjeta", "Efectivo"].map((method) => (
                <label key={method} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" checked={h.formasPagoAceptadas.includes(method)} onChange={() => h.handleCheckboxChange(method)} style={{ width: "16px", height: "16px", accentColor: "var(--primary-color, #475569)" }} disabled={h.loading} />
                  <span>{method}</span>
                </label>
              ))}
            </div>
          </div>

          <PlazosField
            plazos={h.plazos} fechaPlazo={h.fechaPlazo} onFechaChange={h.setFechaPlazo}
            importePlazo={h.importePlazo} onImporteChange={h.setImportePlazo}
            editingPlazoId={h.editingPlazoId} onSavePlazo={h.handleSavePlazo}
            onEditPlazo={h.handleEditPlazo} onDeletePlazo={h.handleDeletePlazo}
            disabled={h.loading}
          />

          <footer className={s.footer}>
            <button type="button" onClick={onClose} className={s.btnCancel} disabled={h.loading}>Cancelar</button>
            <button type="submit" className={s.btnSubmit} disabled={h.loading}>
              {h.loading ? <><span className={s.spinner} /><span>Guardando...</span></> : <span>{expedienteToEdit ? "Guardar cambios" : "Crear Expediente"}</span>}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
