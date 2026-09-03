"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCobros } from "@/hooks/useCobros";
import CobrosKpiGrid from "@/app/components/cobros/CobrosKpiGrid";
import TablaPagadores from "@/app/components/cobros/TablaPagadores";
import ModalCobroOficina from "@/components/modals/ModalCobroOficina";
import NuevaDifusionModal from "@/components/modals/NuevaDifusionModal";
import { getDestinatariosPorEntidadIds, type EntidadDestinatarios } from "@/actions/difusiones";
import type { Pagador, MovimientoCobro } from "@/lib/types/cobros";

interface Props {
  pagadores: Pagador[];
  movimientos?: MovimientoCobro[];
  movimientosBanco?: any[];
  plazos?: any[];
  expedienteId?: string;
  onOpenMatchModal?: () => void;
}

export default function CobrosTab({
  pagadores,
  movimientos = [],
  movimientosBanco = [],
  plazos = [],
  expedienteId,
  onOpenMatchModal,
}: Props) {
  const router = useRouter();
  const cobros = useCobros(pagadores, movimientos, plazos, expedienteId);
  const [difusionEntidades, setDifusionEntidades] = useState<EntidadDestinatarios[] | null>(null);
  const [loadingDifusion, setLoadingDifusion] = useState(false);

  const handleAbrirDifusion = async () => {
    setLoadingDifusion(true);
    try {
      const entidadIds = cobros.filteredData.map((p) => p.entidad_id).filter(Boolean);
      const entidades = await getDestinatariosPorEntidadIds(entidadIds);
      setDifusionEntidades(entidades);
    } finally {
      setLoadingDifusion(false);
    }
  };

  return (
    <>
      <CobrosKpiGrid pagadores={pagadores} movimientos={movimientos} />

      <TablaPagadores
        paginatedData={cobros.paginatedData}
        filteredData={cobros.filteredData}
        movimientos={movimientos}
        movimientosBanco={movimientosBanco}
        viajerosByPagador={cobros.viajerosByPagador}
        abonadoNetoDe={cobros.abonadoNetoDe}
        globalPlazos={plazos}
        search={cobros.search}
        onSearchChange={cobros.handleSearchChange}
        currentPage={cobros.currentPage}
        rowsPerPage={cobros.rowsPerPage}
        onPageChange={cobros.setCurrentPage}
        onRowsPerPageChange={cobros.handleRowsPerPageChange}
        sortKey={cobros.sortKey}
        sortDirection={cobros.sortDirection}
        onSort={cobros.handleSort}
        expandedPagadores={cobros.expandedPagadores}
        onToggleExpand={cobros.toggleExpandPagador}
        isFilterRowOpen={cobros.isFilterRowOpen}
        onToggleFilterRow={() => cobros.setIsFilterRowOpen(!cobros.isFilterRowOpen)}
        openDropdown={cobros.openDropdown}
        onSetOpenDropdown={cobros.setOpenDropdown}
        activePlazoFilters={cobros.activePlazoFilters}
        onTogglePlazoFilter={cobros.togglePlazoFilter}
        onClearPlazoFilters={cobros.clearPlazoFilters}
        activeEstadoFilters={cobros.activeEstadoFilters}
        onToggleEstadoFilter={cobros.toggleEstadoFilter}
        onClearEstadoFilters={cobros.clearEstadoFilters}
        activeMedioPagoFilters={cobros.activeMedioPagoFilters}
        onToggleMedioPagoFilter={cobros.toggleMedioPagoFilter}
        onClearMedioPagoFilters={cobros.clearMedioPagoFilters}
        paymentPlazosList={cobros.paymentPlazosList}
        matchesCobros={cobros.matchesCobros}
        onOpenMatchModal={onOpenMatchModal}
        onAddCobro={() => cobros.setIsAddModalOpen(true)}
        onDifusionClick={handleAbrirDifusion}
        difusionLoading={loadingDifusion}
      />

      <ModalCobroOficina
        isOpen={cobros.isAddModalOpen}
        onClose={() => cobros.setIsAddModalOpen(false)}
        expedienteId={expedienteId || ""}
        pagadores={pagadores}
        viajeros={cobros.viajeros}
        onSuccess={() => router.refresh()}
      />

      {difusionEntidades && (
        <NuevaDifusionModal
          onClose={() => setDifusionEntidades(null)}
          onCreated={() => setDifusionEntidades(null)}
          initialEntidades={difusionEntidades}
          preseleccionar
        />
      )}
    </>
  );
}
