"use client";

import { useState } from "react";
import { useViajeros } from "@/hooks/useViajeros";
import ViajerosKpiGrid from "@/app/components/viajeros/ViajerosKpiGrid";
import TablaViajeros from "@/app/components/viajeros/TablaViajeros";
import ExportViajerosModal from "@/components/modals/ExportViajerosModal";
import AnularViajeroModal from "@/components/modals/AnularViajeroModal";
import AnadirViajeroModal from "@/components/modals/AnadirViajeroModal";
import NuevaDifusionModal from "@/components/modals/NuevaDifusionModal";
import { getDestinatariosPorEntidadIds, type EntidadDestinatarios } from "@/actions/difusiones";
import { reactivarViajero } from "@/actions/viajeros";

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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [difusionEntidades, setDifusionEntidades] = useState<EntidadDestinatarios[] | null>(null);
  const [loadingDifusion, setLoadingDifusion] = useState(false);

  const pagadorOptions = pagadores
    .filter((p: any) => p.entidad_id)
    .map((p: any) => ({ entidad_id: p.entidad_id, nombre: p.contabilidad_entidades?.nombre || "Sin nombre" }));

  const handleReactivar = async (viajero: any) => {
    if (!confirm(`¿Reactivar a ${viajero.name}?`)) return;
    const res = await reactivarViajero(viajero.id);
    if (res.success) v.reload();
    else alert(res.error || "Error al reactivar el viajero");
  };

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
      <ViajerosKpiGrid viajeros={v.viajerosConPagoStatus} loading={v.loading} />

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
        onReactivarClick={handleReactivar}
        onDifusionClick={handleAbrirDifusion}
        difusionLoading={loadingDifusion}
        onAddClick={() => setIsAddOpen(true)}
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

      <AnadirViajeroModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        expedienteId={expedienteId}
        pvpViajero={pvpViajero}
        pagadores={pagadorOptions}
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
