"use client";

import { useState } from "react";
import { useFacturacion } from "@/hooks/useFacturacion";
import FacturacionKpiGrid from "@/app/components/facturacion/FacturacionKpiGrid";
import TablaFacturas from "@/app/components/facturacion/TablaFacturas";
import ModalFacturar from "@/components/modals/ModalFacturar";

interface Props {
  expedienteId: string;
}

export default function FacturacionTab({ expedienteId }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const facturacion = useFacturacion(expedienteId);

  return (
    <>
      {!facturacion.loading && facturacion.facturas.length > 0 && (
        <FacturacionKpiGrid facturas={facturacion.facturas} />
      )}

      <TablaFacturas
        facturas={facturacion.facturas}
        loading={facturacion.loading}
        filteredFacturas={facturacion.filteredFacturas}
        paginatedFacturas={facturacion.paginatedFacturas}
        search={facturacion.search}
        onSearchChange={facturacion.handleSearchChange}
        currentPage={facturacion.currentPage}
        rowsPerPage={facturacion.rowsPerPage}
        onPageChange={facturacion.setCurrentPage}
        onRowsPerPageChange={facturacion.handleRowsPerPageChange}
        onAddFactura={() => setIsModalOpen(true)}
      />

      <ModalFacturar
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        expedienteId={expedienteId}
        onSuccess={facturacion.load}
      />
    </>
  );
}
