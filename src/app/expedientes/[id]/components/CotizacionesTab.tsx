"use client";

import { useEffect } from "react";
import { useCotizacion } from "@/hooks/useCotizacion";
import TablaCotizacion from "@/app/components/cotizacion/TablaCotizacion";
import ResumenCotizacion from "@/app/components/cotizacion/ResumenCotizacion";
import ModalHistorialCotizacion from "@/components/modals/ModalHistorialCotizacion";
import ModalInfoServicio from "@/components/modals/ModalInfoServicio";
import styles from "../page.module.css";

interface CotizacionesTabProps {
  expedienteId?: string;
  hideHeader?: boolean;
  compactHeader?: boolean;
  hideSummary?: boolean;
  onTotalsChange?: (totals: { totalCost: number; totalRevenue: number }) => void;
  title?: string;
  cotizacionId?: string | null;
  initialCotizacion?: any | null;
  opcionalFilter?: boolean;
}

export default function CotizacionesTab({ expedienteId, hideHeader, compactHeader, hideSummary, onTotalsChange, title, cotizacionId, initialCotizacion, opcionalFilter }: CotizacionesTabProps) {
  const c = useCotizacion(cotizacionId, initialCotizacion, opcionalFilter);

  useEffect(() => {
    if (onTotalsChange) onTotalsChange({ totalCost: c.nonOpcionalCost, totalRevenue: c.nonOpcionalRevenue });
  }, [c.nonOpcionalCost, c.nonOpcionalRevenue, onTotalsChange]);

  const resumen = !hideSummary ? (
    <ResumenCotizacion
      totalCost={c.nonOpcionalCost}
      totalRevenue={c.nonOpcionalRevenue}
      summaryPlazas={c.summaryPlazas}
      summaryFree={c.summaryFree}
      summaryPvpViajero={c.summaryPvpViajero}
      hasEditedPvp={c.hasEditedPvp}
      onPvpChange={(v) => { c.setSummaryPvpViajero(v); c.setHasEditedPvp(true); }}
      onPlazasChange={c.setSummaryPlazas}
      onFreeChange={c.setSummaryFree}
    />
  ) : null;

  return (
    <>
      <div className={styles.tabContainer} style={{ overflow: 'visible', marginTop: compactHeader ? '-0.75rem' : '0px', borderRadius: '0.75rem' }}>
        <TablaCotizacion c={c} hideHeader={hideHeader} compactHeader={compactHeader} title={title} sidePanel={resumen} cotizacionId={cotizacionId} />
      </div>

      <ModalHistorialCotizacion
        isOpen={c.showHistoryModal}
        onClose={() => c.setShowHistoryModal(false)}
        items={c.allItems}
        tiposMap={c.tiposMap}
        onAddItem={(item, opcional) => {
          c.addItemFromHistory({ ...item, opcional });
          c.setShowHistoryModal(false);
        }}
      />

      <ModalInfoServicio
        item={c.infoModalItem}
        tiposMap={c.tiposMap}
        onClose={c.closeInfoModal}
        onSave={async (id, native, form, place) => {
          await c.handleSaveInfoModal(id, native, form, place);
          c.closeInfoModal();
        }}
      />
    </>
  );
}
