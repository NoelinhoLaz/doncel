"use client";

import { useState } from "react";
import { useServicios } from "@/hooks/useServicios";
import ServiciosKpiGrid from "@/app/components/servicios/ServiciosKpiGrid";
import TablaServicios from "@/app/components/servicios/TablaServicios";
import ImportarCotizacionModal from "@/components/modals/ImportarCotizacionModal";
import MatchBancarioModal from "@/components/modals/MatchBancarioModal";
import ImportarPdfModal from "@/components/modals/ImportarPdfModal";
import ServicioFormModal from "@/components/modals/ServicioFormModal";
import ModalEnviarValoracion from "@/components/modals/ModalEnviarValoracion";
import ExportViajerosModal from "@/components/modals/ExportViajerosModal";

import TablaServiciosOpcionales from "@/app/components/servicios/TablaServiciosOpcionales";
import TablaServiciosNoOpcionales from "@/app/components/servicios/TablaServiciosNoOpcionales";
import ImportarServiciosModal from "@/components/modals/ImportarServiciosModal";
import ImportarServiciosNoOpcionalesModal from "@/components/modals/ImportarServiciosNoOpcionalesModal";

interface ServiciosTabProps {
  onOpenMatchModal?: () => void;
  expedienteId: string;
}

export default function ServiciosTab({ expedienteId, onOpenMatchModal }: ServiciosTabProps) {
  const s = useServicios(expedienteId);
  const [valoracionOpen, setValoracionOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedExportService, setSelectedExportService] = useState<any | null>(null);
  const [isImportarOpcionalesOpen, setIsImportarOpcionalesOpen] = useState(false);
  const [isImportarNoOpcionalesOpen, setIsImportarNoOpcionalesOpen] = useState(false);

  const handleOpenExport = (ser: any) => {
    setSelectedExportService(ser);
    setIsExportOpen(true);
  };

  return (
    <>
      <ServiciosKpiGrid
        kpis={s.kpis}
        serviciosCount={s.servicios.length}
        categoriesToRender={s.categoriesToRender}
      />

      <TablaServicios 
        s={s} 
        onOpenMatchModal={onOpenMatchModal} 
        onEnviarValoracion={() => setValoracionOpen(true)} 
        onExportClick={handleOpenExport}
      />

      <TablaServiciosNoOpcionales
        serviciosList={s.nonOptionalServicios}
        expedienteId={expedienteId}
        onDeleteServicio={s.handleDelete}
        onUpdateImporte={s.handleUpdateImporte}
        onAbrirManual={s.openAddService}
        onAbrirImportar={() => setIsImportarNoOpcionalesOpen(true)}
      />

      <TablaServiciosOpcionales
        serviciosList={s.optionalServicios}
        expedienteId={expedienteId}
        onToggleOpcional={s.handleToggleOpcional}
        onDeleteServicio={s.handleDelete}
        onUpdateImporte={s.handleUpdateImporte}
        onAbrirManual={s.openAddService}
        onAbrirImportar={() => setIsImportarOpcionalesOpen(true)}
      />

      <ImportarServiciosNoOpcionalesModal
        isOpen={isImportarNoOpcionalesOpen}
        onClose={() => setIsImportarNoOpcionalesOpen(false)}
        expedienteId={expedienteId}
        onSuccess={s.loadServicios}
      />

      <ImportarServiciosModal
        isOpen={isImportarOpcionalesOpen}
        onClose={() => setIsImportarOpcionalesOpen(false)}
        expedienteId={expedienteId}
        onSuccess={s.loadServicios}
      />

      <ImportarCotizacionModal
        isOpen={s.isImportCotizacionOpen}
        onClose={s.closeImportCotizacion}
        expedienteId={expedienteId}
        onImportSuccess={s.loadServicios}
      />

      <MatchBancarioModal
        isOpen={s.isMatchBancarioOpen}
        onClose={s.closeMatchBancario}
        selectedMatch={s.selectedMatch}
        onConciliado={() => { s.loadMatches(); s.loadServicios(); }}
      />

      <ImportarPdfModal
        isOpen={s.isImportPdfOpen}
        onClose={s.closeImportPdf}
        expedienteId={expedienteId}
        serviceTypes={s.serviceTypes}
        onImportSuccess={s.loadServicios}
      />

      <ServicioFormModal
        isOpen={s.isServiceFormOpen}
        onClose={s.closeServiceForm}
        expedienteId={expedienteId}
        editServiceId={s.editServiceId}
        serviceData={s.editServiceData}
        serviceTypes={s.serviceTypes}
        onSuccess={s.loadServicios}
      />

      {valoracionOpen && (
        <ModalEnviarValoracion
          expedienteId={expedienteId}
          servicios={s.servicios.map((ser: any) => ({
            id: ser.id,
            descripcion: ser.descripcion,
            tipo_label: ser.config_tipos_servicios?.etiqueta || ser.tipo || "",
          }))}
          onClose={() => setValoracionOpen(false)}
          onSent={() => setTimeout(() => setValoracionOpen(false), 1500)}
        />
      )}

      <ExportViajerosModal
        isOpen={isExportOpen}
        onClose={() => {
          setIsExportOpen(false);
          setSelectedExportService(null);
        }}
        expedienteId={expedienteId}
        selectedService={selectedExportService}
      />
    </>
  );
}
