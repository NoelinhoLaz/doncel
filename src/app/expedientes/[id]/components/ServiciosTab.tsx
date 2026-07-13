"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useServicios } from "@/hooks/useServicios";
import ServiciosKpiGrid from "@/app/components/servicios/ServiciosKpiGrid";
import ImportarCotizacionModal from "@/components/modals/ImportarCotizacionModal";
import MatchBancarioModal from "@/components/modals/MatchBancarioModal";
import ImportarPdfModal from "@/components/modals/ImportarPdfModal";
import ServicioFormModal from "@/components/modals/ServicioFormModal";
import ModalInfoServicio from "@/components/modals/ModalInfoServicio";
import ModalEnviarValoracion from "@/components/modals/ModalEnviarValoracion";
import RegistrarPagoModal from "@/components/modals/RegistrarPagoModal";
import ConciliarPagoModal from "@/components/modals/ConciliarPagoModal";
import RegistrarDocumentoModal from "@/components/modals/RegistrarDocumentoModal";
const NuevaComunicacionModal = dynamic(() => import("@/app/expedientes/[id]/components/NuevaComunicacionModal"), { ssr: false });

import TablaServiciosNoOpcionales from "@/app/components/servicios/TablaServiciosNoOpcionales";
import PagosRealizadosList from "@/app/components/servicios/PagosRealizadosList";
import ImportarServiciosCotizacionModal from "@/components/modals/ImportarServiciosCotizacionModal";

interface ServiciosTabProps {
  onOpenMatchModal?: () => void;
  expedienteId: string;
}

export default function ServiciosTab({ expedienteId, onOpenMatchModal }: ServiciosTabProps) {
  const s = useServicios(expedienteId);
  const [valoracionOpen, setValoracionOpen] = useState(false);
  const [isImportarCotizacionOpen, setIsImportarCotizacionOpen] = useState(false);
  const [mailModalProveedor, setMailModalProveedor] = useState<{ nombre: string; email: string } | null>(null);

  return (
    <>
      <ServiciosKpiGrid
        kpis={s.kpis}
        serviciosCount={s.servicios.length}
        categoriesToRender={s.categoriesToRender}
      />

      <TablaServiciosNoOpcionales
        serviciosList={s.servicios}
        expedienteId={expedienteId}
        loading={s.loading}
        onDeleteServicio={s.handleDelete}
        onOpenInfo={s.openInfoModal}
        onOpenEmail={(item) => setMailModalProveedor({ nombre: item.proveedor || item.descripcion || "", email: item.proveedor_email || "" })}
        onUpdateImporte={s.handleUpdateImporte}
        onUpdateNoches={s.handleUpdateNoches}
        onUpdateDestino={s.handleUpdateDestino}
        onUpdateDescripcion={s.handleUpdateDescripcion}
        onUpdateProveedor={s.handleUpdateProveedor}
        onUpdatePlazas={s.handleUpdatePlazas}
        onUpdateTipo={s.handleUpdateTipo}
        onVincularCotizacion={s.handleVincularCotizacion}
        saveStatus={s.saveStatus}
        onAbrirManual={s.openAddService}
        onAbrirImportar={() => setIsImportarCotizacionOpen(true)}
        getTypeInfo={s.getTypeInfo}
        serviceTypes={s.serviceTypes}
        pendingMatchCount={s.pendingMatchCount}
        onOpenMatchModal={onOpenMatchModal}
        onRegistrarPago={s.openRegistrarPago}
        onRegistrarDocumento={s.openRegistrarDocumento}
        onEnviarValoracion={() => setValoracionOpen(true)}
        onOpenConciliar={s.openConciliarPago}
      />

      <PagosRealizadosList serviciosList={s.servicios} onConciliar={s.openConciliarPago} documentosPorMovimiento={s.documentosPorMovimiento} />

      <ImportarServiciosCotizacionModal
        isOpen={isImportarCotizacionOpen}
        onClose={() => setIsImportarCotizacionOpen(false)}
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

      <RegistrarPagoModal
        isOpen={s.isRegistrarPagoOpen}
        onClose={s.closeRegistrarPago}
        servicios={s.servicios}
        onSuccess={() => { s.loadServicios(); s.loadMatches(); }}
      />

      <ConciliarPagoModal
        isOpen={!!s.movimientoAConciliar}
        onClose={s.closeConciliarPago}
        expedienteId={expedienteId}
        movimientoId={s.movimientoAConciliar}
        onSuccess={() => { s.loadServicios(); s.loadMatches(); }}
      />

      <RegistrarDocumentoModal
        isOpen={s.isRegistrarDocumentoOpen}
        onClose={s.closeRegistrarDocumento}
        expedienteId={expedienteId}
        onSuccess={() => { s.loadServicios(); s.loadDocumentos(); }}
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

      {s.infoModalItem && (
        <ModalInfoServicio
          item={s.infoModalItem}
          tiposMap={s.tiposMap}
          onClose={s.closeInfoModal}
          onSave={async (id, native, form, place) => {
            await s.handleSaveInfoModal(id, native, form, place);
            s.closeInfoModal();
          }}
        />
      )}

      {mailModalProveedor && (
        <NuevaComunicacionModal
          expedienteId={expedienteId}
          destinatarioInicial={mailModalProveedor}
          onClose={() => setMailModalProveedor(null)}
          onSent={() => setMailModalProveedor(null)}
        />
      )}
    </>
  );
}
