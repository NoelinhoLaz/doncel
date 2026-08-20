"use client";

import { useState } from "react";
import { useViajeros } from "@/hooks/useViajeros";
import ViajerosKpiGrid from "@/app/components/viajeros/ViajerosKpiGrid";
import TablaViajeros from "@/app/components/viajeros/TablaViajeros";
import ExportViajerosModal from "@/components/modals/ExportViajerosModal";
import AnularViajeroModal from "@/components/modals/AnularViajeroModal";
import NuevaDifusionModal from "@/components/modals/NuevaDifusionModal";
import { getDestinatariosPorEntidadIds, type EntidadDestinatarios } from "@/actions/difusiones";

interface Props {
  expedienteId: string;
  fechaSalida?: string;
  pvpViajero?: number | null;
  pagadores?: any[];
  plazos?: any[];
  onOpenMatchModal?: () => void;
}

export default function ViajerosTab({ expedienteId, fechaSalida, pvpViajero, pagadores = [], plazos = [], onOpenMatchModal }: Props) {
  const v = useViajeros(expedienteId, fechaSalida, pvpViajero, pagadores, plazos);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [viajeroAAnular, setViajeroAAnular] = useState<any | null>(null);
  const [difusionEntidades, setDifusionEntidades] = useState<EntidadDestinatarios[] | null>(null);
  const [loadingDifusion, setLoadingDifusion] = useState(false);

  const handleAbrirDifusion = async () => {
    setLoadingDifusion(true);
    try {
      const entidadIds = v.filteredData
        .filter((viajero) => viajero.status !== "ANULADO")
        .map((viajero) => viajero.entidad_id)
        .filter(Boolean);
      const entidades = await getDestinatariosPorEntidadIds(entidadIds);
      setDifusionEntidades(entidades);
    } finally {
      setLoadingDifusion(false);
    }
  };

  return (
    <>
      <ViajerosKpiGrid viajeros={v.viajeros} loading={v.loading} />

      <TablaViajeros
        viajeros={v.viajeros}
        loading={v.loading}
        filteredData={v.filteredData}
        paginatedData={v.paginatedData}
        extrasIconMap={v.extrasIconMap}
        pagadorMap={v.pagadorMap}
        globalPlazos={plazos}
        paymentPlazosList={v.paymentPlazosList}
        dynamicExtras={v.dynamicExtras}
        matchesCobros={v.matchesCobros}
        onOpenMatchModal={onOpenMatchModal}
        search={v.search}
        onSearchChange={v.handleSearchChange}
        isFilterRowOpen={v.isFilterRowOpen}
        onToggleFilterRow={() => v.setIsFilterRowOpen(!v.isFilterRowOpen)}
        openDropdown={v.openDropdown}
        onSetOpenDropdown={v.setOpenDropdown}
        activePlazoFilters={v.activePlazoFilters}
        onTogglePlazoFilter={v.togglePlazoFilter}
        activeExtraFilters={v.activeExtraFilters}
        onToggleExtraFilter={v.toggleExtraFilter}
        activeNewsletterFilters={v.activeNewsletterFilters}
        onToggleNewsletterFilter={v.toggleNewsletterFilter}
        activeContratoFilters={v.activeContratoFilters}
        onToggleContratoFilter={v.toggleContratoFilter}
        activeEstadoFilters={v.activeEstadoFilters}
        onToggleEstadoFilter={v.toggleEstadoFilter}
        activePagoStatusFilters={v.activePagoStatusFilters}
        onTogglePagoStatusFilter={v.togglePagoStatusFilter}
        onClearAllFilters={v.clearAllFilters}
        sortKey={v.sortKey}
        sortDirection={v.sortDirection}
        onSort={v.handleSort}
        currentPage={v.currentPage}
        rowsPerPage={v.rowsPerPage}
        onPageChange={v.setCurrentPage}
        onRowsPerPageChange={v.handleRowsPerPageChange}
        onExportClick={() => setIsExportOpen(true)}
        onAnularClick={setViajeroAAnular}
        onDifusionClick={handleAbrirDifusion}
        difusionLoading={loadingDifusion}
      />

      <ExportViajerosModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        expedienteId={expedienteId}
      />

      <AnularViajeroModal
        isOpen={!!viajeroAAnular}
        onClose={() => setViajeroAAnular(null)}
        viajero={viajeroAAnular}
        expedienteId={expedienteId}
        onSuccess={v.reload}
      />

      {difusionEntidades && (
        <NuevaDifusionModal
          onClose={() => setDifusionEntidades(null)}
          onCreated={() => setDifusionEntidades(null)}
          initialEntidades={difusionEntidades}
        />
      )}
    </>
  );
}
