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

interface ServiciosTabProps {
  onOpenMatchModal?: () => void;
  expedienteId: string;
}

export default function ServiciosTab({ expedienteId, onOpenMatchModal }: ServiciosTabProps) {
  const s = useServicios(expedienteId);
  const [valoracionOpen, setValoracionOpen] = useState(false);

  return (
    <>
      <ServiciosKpiGrid
        kpis={s.kpis}
        serviciosCount={s.servicios.length}
        categoriesToRender={s.categoriesToRender}
      />

      <TablaServicios s={s} onOpenMatchModal={onOpenMatchModal} onEnviarValoracion={() => setValoracionOpen(true)} />

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
    </>
  );
}
