"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { Icons } from "@/lib/icons";
import { createExpedienteServicio, updateExpedienteServicio } from "@/actions/servicios";
import { useServicioForm } from "./useServicioForm";
import ServicioCatalogo from "./ServicioCatalogo";
import ServicioDetalleForm from "./ServicioDetalleForm";

interface ServicioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  editServiceId: string | null;
  serviceData: any | null;
  serviceTypes: any[];
  onSuccess: () => void;
}

export default function ServicioFormModal({
  isOpen,
  onClose,
  expedienteId,
  editServiceId,
  serviceData,
  serviceTypes,
  onSuccess,
}: ServicioFormModalProps) {
  const form = useServicioForm({ isOpen, editServiceId, serviceData, serviceTypes });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion.trim()) {
      alert("Por favor, rellena todos los campos obligatorios.");
      return;
    }

    const pvpVal = parseFloat(form.pvp) || 0;
    const plazasVal = parseInt(form.plazas) || 1;
    const totalVal = form.total ? parseFloat(form.total) || pvpVal * plazasVal : pvpVal * plazasVal;
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    const targetTipo = isUuid(form.tipo) ? form.tipo : null;
    const minPlazasVal = form.opcional && form.minimoPlazas ? parseInt(form.minimoPlazas) || null : null;

    form.setFormLoading(true);
    try {
      if (editServiceId) {
        await updateExpedienteServicio(editServiceId, {
          tipo: targetTipo as any,
          proveedor: form.proveedor,
          descripcion: form.descripcion,
          neto: parseFloat(form.neto) || 0,
          pvp: pvpVal,
          plazas: plazasVal,
          total: totalVal,
          opcional: form.opcional,
          minimo_plazas: minPlazasVal,
        });
      } else {
        await createExpedienteServicio({
          expediente_id: expedienteId,
          tipo: targetTipo as any,
          proveedor: form.proveedor,
          descripcion: form.descripcion,
          neto: parseFloat(form.neto) || 0,
          pvp: pvpVal,
          plazas: plazasVal,
          total: totalVal,
          opcional: form.opcional,
          minimo_plazas: minPlazasVal,
        } as any);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error al crear/actualizar el servicio: " + err.message);
    } finally {
      form.setFormLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(8px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "500px", maxHeight: "90vh", backgroundColor: "#ffffff", borderRadius: "1rem", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#475569" }}>
            {form.showForm && !editServiceId ? (
              <button
                type="button"
                onClick={() => form.setShowForm(false)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.2rem", borderRadius: "50%", color: "#64748b" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                title="Volver al catálogo"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <Plus size={18} />
            )}
            <h2 style={{ fontSize: "1.05rem", fontWeight: "600", margin: 0 }}>
              {editServiceId ? "Editar Servicio del Expediente" : form.showForm ? "Configurar Detalles de Servicio" : "Añadir Servicio al Expediente"}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Icons.Close size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", overflowY: "auto", padding: "1.5rem", gap: "1.25rem" }}>
          {/* Tipo de Asignación */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Tipo de Asignación *</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", backgroundColor: "#f8fafc", padding: "0.25rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
              {[{ label: "General", value: false, activeColor: "#16a34a" }, { label: "Opcional", value: true, activeColor: "#db2777" }].map(({ label, value, activeColor }) => (
                <button
                  key={label}
                  type="button"
                  disabled={!!editServiceId}
                  onClick={() => form.setOpcional(value)}
                  style={{
                    padding: "0.45rem", border: "none", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: "600",
                    cursor: editServiceId ? "not-allowed" : "pointer",
                    backgroundColor: form.opcional === value ? "#ffffff" : "transparent",
                    color: form.opcional === value ? activeColor : "#64748b",
                    boxShadow: form.opcional === value ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)" : "none",
                    transition: "all 0.2s",
                    opacity: editServiceId && form.opcional !== value ? 0.5 : 1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!form.showForm ? (
            <ServicioCatalogo
              opcional={form.opcional}
              templateSearch={form.templateSearch}
              onSearchChange={form.setTemplateSearch}
              displayTemplates={form.displayTemplates}
              onSelectTemplate={form.applyTemplate}
              onCreateFromScratch={() => form.setShowForm(true)}
            />
          ) : (
            <ServicioDetalleForm
              editServiceId={editServiceId}
              serviceTypes={serviceTypes}
              tipo={form.tipo} setTipo={form.setTipo}
              proveedor={form.proveedor} setProveedor={form.setProveedor}
              descripcion={form.descripcion} setDescripcion={form.setDescripcion}
              opcional={form.opcional}
              minimoPlazas={form.minimoPlazas} setMinimoPlazas={form.setMinimoPlazas}
              plazas={form.plazas} setPlazas={form.setPlazas}
              neto={form.neto} setNeto={form.setNeto}
              pvp={form.pvp} setPvp={form.setPvp}
              total={form.total} setTotal={form.setTotal} setTotalEdited={form.setTotalEdited}
              formLoading={form.formLoading}
              onBack={() => form.setShowForm(false)}
            />
          )}
        </form>
      </div>
    </div>
  );
}
