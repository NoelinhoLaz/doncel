"use client";

import { useState, useEffect } from "react";
import { updateExpediente } from "@/actions/expedientes";
import { getExpedienteServicios, toggleServicioOpcional, deleteExpedienteServicio } from "@/actions/servicios";
import { initForm, hasFormChanges, getPlazosSum, getTargetAmount, isPlazosSumValid } from "@/lib/utils/ajustes";

const DEFAULT_COMUNICACIONES = [
  { descripcion: "Confirmación de registro", activa: false, plantilla: "Contrato.pdf" },
  { descripcion: "Contrato combinado", activa: false, plantilla: "Contrato.pdf" },
  { descripcion: "Recordatorio de cobro", activa: false, plantilla: "Recordatorio.pdf" },
  { descripcion: "Formulario de satisfacción", activa: false, plantilla: "Form1.pdf" },
];

export function useAjustes(expedienteId: string, expediente: any) {
  const [form, setFormState] = useState(initForm(expediente));
  const [saving, setSaving] = useState(false);

  const [plazosList, setPlazosList] = useState<any[]>(() =>
    (expediente?.plazos || [])
      .filter((p: any) => !p.tipo || p.tipo === "pago")
      .map((p: any) => ({ id: p.id || crypto.randomUUID(), descripcion: p.descripcion || "", fecha: p.fecha || "", importe: p.importe || "" }))
  );

  const [cancelacionesList, setCancelacionesList] = useState<any[]>(() =>
    (expediente?.plazos || [])
      .filter((p: any) => p.tipo === "cancelacion")
      .map((c: any) => ({ id: c.id || crypto.randomUUID(), descripcion: c.descripcion || "", fecha_desde: c.fecha_desde || "", fecha_hasta: c.fecha_hasta || "", tipo_valor: c.tipo_valor || "importe", valor: c.valor || "" }))
  );

  const [serviciosList, setServiciosList] = useState<any[]>([]);
  const [serviciosLoaded, setServiciosLoaded] = useState(false);

  useEffect(() => {
    if (!expedienteId) return;
    getExpedienteServicios(expedienteId).then((data) => {
      setServiciosList((data || []).filter((s: any) => s.opcional === true));
      setServiciosLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId]);

  const [formasPagoAceptadas, setFormasPagoAceptadas] = useState<string[]>(
    () => expediente?.formas_pago_aceptadas || ["Transferencia"]
  );

  const [comunicacionesList, setComunicacionesList] = useState<any[]>(() => {
    const stored = expediente?.metadata?.comunicaciones_automaticas;
    if (stored && stored.length > 0) {
      return stored.map((c: any) => ({ id: c.id || crypto.randomUUID(), descripcion: c.descripcion || "", activa: c.activa ?? false, plantilla: c.plantilla || "" }));
    }
    return DEFAULT_COMUNICACIONES.map(c => ({ ...c, id: crypto.randomUUID() }));
  });

  const setField = (field: string, value: any) => setFormState(prev => ({ ...prev, [field]: value }));

  const hasChanges = () => hasFormChanges(form, expediente, formasPagoAceptadas, plazosList, cancelacionesList, comunicacionesList, []);

  async function handleToggleOpcional(id: string, opcional: boolean) {
    setServiciosList((prev) => prev.map((s) => s.id === id ? { ...s, opcional } : s));
    await toggleServicioOpcional(id, opcional);
  }

  async function handleDeleteServicio(id: string) {
    if (!confirm("¿Estás seguro de que deseas eliminar este servicio opcional?")) return;
    try {
      await deleteExpedienteServicio(id, expedienteId);
      const data = await getExpedienteServicios(expedienteId);
      setServiciosList((data || []).filter((s: any) => s.opcional === true));
    } catch (err: any) {
      alert(err.message || "Error al eliminar el servicio");
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const mergedPlazos = [
        ...plazosList.map(p => ({ tipo: "pago", descripcion: p.descripcion, fecha: p.fecha, importe: p.importe })),
        ...cancelacionesList.map(c => ({ tipo: "cancelacion", descripcion: c.descripcion, fecha_desde: c.fecha_desde, fecha_hasta: c.fecha_hasta, tipo_valor: c.tipo_valor, valor: c.valor })),
      ];
      const payload: any = {
        referencia: form.referencia,
        slug: form.slug || null,
        tipo_expediente: form.tipo_expediente as "grupo" | "vacacional" | "p2p",
        forma_pago: form.forma_pago as "un_pagador" | "varios_pagadores",
        formas_pago_aceptadas: formasPagoAceptadas,
        plazos: mergedPlazos,

        genera_apunte: form.genera_apunte,
        apuntes_desde: form.apuntes_desde || null,
        destino_principal: expediente?.destino_principal || null,
        entidad_id: expediente?.entidad_id || null,
        metadata: {
          ...(expediente?.metadata || {}),
          comunicaciones_automaticas: comunicacionesList.map(c => ({ descripcion: c.descripcion, activa: c.activa, plantilla: c.plantilla })),
          plazas_max: form.plazas_max || null,
          fecha_tope_registro: form.fecha_tope_registro || null,
        },
      };
      if (form.numero.trim()) payload.numero = form.numero.trim();
      if (form.fecha_inicio) payload.fecha_inicio = form.fecha_inicio;
      if (form.fecha_fin) payload.fecha_fin = form.fecha_fin;
      await updateExpediente(expedienteId, payload);
    } catch (err) {
      console.error("Error saving expediente:", err);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save every 10 seconds on changes
  useEffect(() => {
    if (!hasChanges() || saving) return;
    const timer = setTimeout(() => handleSave(), 10000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, plazosList, cancelacionesList, serviciosList, formasPagoAceptadas, comunicacionesList, saving]);

  return {
    form, setField, saving, handleSave, hasChanges,
    plazosList, setPlazosList,
    cancelacionesList, setCancelacionesList,
    serviciosList, setServiciosList, serviciosLoaded, handleToggleOpcional, handleDeleteServicio,
    formasPagoAceptadas, setFormasPagoAceptadas,
    comunicacionesList, setComunicacionesList,
    plazosSum: getPlazosSum(plazosList),
    targetAmount: getTargetAmount(form),
    plazosValid: isPlazosSumValid(plazosList, form),
  };
}
