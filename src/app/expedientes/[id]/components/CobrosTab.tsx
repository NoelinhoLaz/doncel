"use client";

import { useRouter } from "next/navigation";
import { useCobros } from "@/hooks/useCobros";
import CobrosKpiGrid from "@/app/components/cobros/CobrosKpiGrid";
import TablaPagadores from "@/app/components/cobros/TablaPagadores";
import ModalCobroOficina from "@/components/modals/ModalCobroOficina";
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

  return (
    <>
      <CobrosKpiGrid pagadores={pagadores} movimientos={movimientos} />

      <TablaPagadores
        paginatedData={cobros.paginatedData}
        filteredData={cobros.filteredData}
        movimientos={movimientos}
        movimientosBanco={movimientosBanco}
        viajerosByPagador={cobros.viajerosByPagador}
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
        paymentPlazosList={cobros.paymentPlazosList}
        matchesCobros={cobros.matchesCobros}
        onOpenMatchModal={onOpenMatchModal}
        onAddCobro={() => cobros.setIsAddModalOpen(true)}
      />

      <ModalCobroOficina
        isOpen={cobros.isAddModalOpen}
        onClose={() => cobros.setIsAddModalOpen(false)}
        expedienteId={expedienteId || ""}
        pagadores={pagadores}
        viajeros={cobros.viajeros}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
