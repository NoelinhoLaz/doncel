"use client";

import * as LucideIcons from "lucide-react";
import { useState, useEffect } from "react";
import { Icons } from "@/lib/icons";
import { useAjustes } from "@/hooks/useAjustes";
import { getExpedienteServicios } from "@/actions/servicios";
import { getTiposServicios } from "@/actions/tiposServicios";
import InfoExpedienteSection from "@/app/components/ajustes/InfoExpedienteSection";
import ServiciosPlazosSection from "@/app/components/ajustes/ServiciosPlazosSection";
import ComunicacionesSection from "@/app/components/ajustes/ComunicacionesSection";
import ServicioFormModal from "@/components/modals/ServicioFormModal";
import ImportarServiciosModal from "@/components/modals/ImportarServiciosModal";
import styles from "../page.module.css";

const DEFAULT_TYPES = [
  { id: "transporte", label: "Transporte", icono: "Plane", color: "#0369a1", bg: "#e0f2fe" },
  { id: "alojamiento", label: "Alojamiento", icono: "Bed", color: "#4338ca", bg: "#e0e7ff" },
  { id: "actividad", label: "Actividad", icono: "Compass", color: "#be185d", bg: "#fce7f3" },
  { id: "otros", label: "Otros", icono: "FolderPlus", color: "#475569", bg: "#f1f5f9" },
];
const TYPE_COLORS = [
  { color: "#0369a1", bg: "#e0f2fe" }, { color: "#4338ca", bg: "#e0e7ff" },
  { color: "#be185d", bg: "#fce7f3" }, { color: "#16a34a", bg: "#dcfce7" },
  { color: "#7c3aed", bg: "#f3e8ff" }, { color: "#ca8a04", bg: "#fef9c3" },
  { color: "#ea580c", bg: "#ffedd5" },
];

interface AjustesTabProps {
  expedienteId: string;
  expediente?: any;
}

export default function AjustesTab({ expedienteId, expediente }: AjustesTabProps) {
  const a = useAjustes(expedienteId, expediente);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<any[]>(DEFAULT_TYPES);

  useEffect(() => {
    getTiposServicios()
      .then((types) => {
        if (types?.length) {
          setServiceTypes(types.map((t: any, i: number) => ({ id: t.id, label: t.etiqueta, icono: t.icono, ...TYPE_COLORS[i % TYPE_COLORS.length] })));
        }
      })
      .catch(() => {});
  }, []);

  async function handleServicioCreado() {
    const data = await getExpedienteServicios(expedienteId);
    a.setServiciosList((data || []).filter((s: any) => s.opcional === true));
    setModalOpen(false);
  }

  return (
    <div className={styles.tabContainer}>
      <div className={styles.listHeaderTop} style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className={styles.listTitleWrapper}>
          <Icons.Settings size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Ajustes del expediente</h2>
        </div>
        <button
          className={styles.addActionButton}
          title="Guardar cambios"
          onClick={a.handleSave}
          disabled={a.saving || !a.hasChanges()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: a.saving ? "0.4rem" : "0",
            width: a.saving ? "auto" : "32px", height: "32px",
            padding: a.saving ? "0 0.65rem" : "0",
            borderRadius: "0.5rem",
            backgroundColor: (!a.saving && a.hasChanges()) ? "#64748b" : "var(--primary-color, #475569)",
            color: "#ffffff", border: "none",
            cursor: (a.saving || !a.hasChanges()) ? "default" : "pointer",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            transition: "all 0.3s ease", boxSizing: "border-box",
          }}
        >
          <LucideIcons.Save size={16} style={{ color: a.saving ? "#38bdf8" : "#ffffff" }} />
          {a.saving && <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#ffffff", whiteSpace: "nowrap" }}>Guardando...</span>}
        </button>
      </div>

      <InfoExpedienteSection
        form={a.form}
        setField={a.setField}
        expediente={expediente}
        formasPagoAceptadas={a.formasPagoAceptadas}
        setFormasPagoAceptadas={a.setFormasPagoAceptadas}
      />

      <ServiciosPlazosSection
        serviciosList={a.serviciosList}
        serviciosLoaded={a.serviciosLoaded}
        onToggleOpcional={a.handleToggleOpcional}
        onAbrirModal={() => setModalOpen(true)}
        onAbrirImportarModal={() => setImportModalOpen(true)}
        plazosList={a.plazosList}
        setPlazosList={a.setPlazosList}
        cancelacionesList={a.cancelacionesList}
        setCancelacionesList={a.setCancelacionesList}
        plazosValid={a.plazosValid}
        plazosSum={a.plazosSum}
        targetAmount={a.targetAmount}
        formaPago={a.form.forma_pago}
      />

      <ComunicacionesSection
        comunicacionesList={a.comunicacionesList}
        setComunicacionesList={a.setComunicacionesList}
      />

      <ServicioFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        expedienteId={expedienteId}
        editServiceId={null}
        serviceData={null}
        serviceTypes={serviceTypes}
        onSuccess={handleServicioCreado}
      />

      <ImportarServiciosModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        expedienteId={expedienteId}
        onSuccess={handleServicioCreado}
      />
    </div>
  );
}
