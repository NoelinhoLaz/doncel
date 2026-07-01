"use client";

import { useState } from "react";
import { useViajeros } from "@/hooks/useViajeros";
import ViajerosKpiGrid from "@/app/components/viajeros/ViajerosKpiGrid";
import TablaViajeros from "@/app/components/viajeros/TablaViajeros";
import ExportViajerosModal from "@/components/modals/ExportViajerosModal";

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
        onClearAllFilters={v.clearAllFilters}
        sortKey={v.sortKey}
        sortDirection={v.sortDirection}
        onSort={v.handleSort}
        currentPage={v.currentPage}
        rowsPerPage={v.rowsPerPage}
        onPageChange={v.setCurrentPage}
        onRowsPerPageChange={v.handleRowsPerPageChange}
        onExportClick={() => setIsExportOpen(true)}
      />

      <ExportViajerosModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        expedienteId={expedienteId}
      />
    </>
  );
}
