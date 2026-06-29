"use client";

import { useState, useEffect } from "react";
import { getAllServicios } from "@/actions/servicios";

const MOCK_TEMPLATES = [
  { id: "t1", tipo: "transporte", proveedor: "Autocares ALSA", descripcion: "Autobús Ida y Vuelta", neto: 1200, pvp: 1500, opcional: false },
  { id: "t2", tipo: "alojamiento", proveedor: "Hotel Riu Plaza", descripcion: "Habitación Doble PC (5 noches)", neto: 450, pvp: 550, opcional: false },
  { id: "t3", tipo: "otros", proveedor: "IATI Seguros", descripcion: "Seguro de viaje básico", neto: 12, pvp: 18, opcional: false },
  { id: "t4", tipo: "actividad", proveedor: "Civitatis", descripcion: "Excursión a Versalles con Guía", neto: 45, pvp: 65, opcional: true, minimo_plazas: 10 },
  { id: "t5", tipo: "actividad", proveedor: "Louvre Museum", descripcion: "Entrada Museo del Louvre sin colas", neto: 17, pvp: 22, opcional: true },
  { id: "t6", tipo: "actividad", proveedor: "Bateaux Parisiens", descripcion: "Cena Crucero por el Sena", neto: 75, pvp: 95, opcional: true, minimo_plazas: 15 },
  { id: "t7", tipo: "alojamiento", proveedor: "Hotel Riu Plaza", descripcion: "Suplemento Habitación Individual", neto: 150, pvp: 200, opcional: true }
];

export interface ServicioFormState {
  opcional: boolean;
  tipo: string;
  proveedor: string;
  descripcion: string;
  minimoPlazas: string;
  plazas: string;
  neto: string;
  pvp: string;
  total: string;
  totalEdited: boolean;
  formLoading: boolean;
  showForm: boolean;
  templateSearch: string;
  recommendedTemplates: any[];
  allServicesCatalog: any[];
}

export function useServicioForm({
  isOpen,
  editServiceId,
  serviceData,
  serviceTypes,
}: {
  isOpen: boolean;
  editServiceId: string | null;
  serviceData: any | null;
  serviceTypes: any[];
}) {
  const [opcional, setOpcional] = useState(false);
  const [tipo, setTipo] = useState("transporte");
  const [proveedor, setProveedor] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [minimoPlazas, setMinimoPlazas] = useState("");
  const [plazas, setPlazas] = useState("1");
  const [neto, setNeto] = useState("");
  const [pvp, setPvp] = useState("");
  const [total, setTotal] = useState("");
  const [totalEdited, setTotalEdited] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [recommendedTemplates, setRecommendedTemplates] = useState<any[]>([]);
  const [allServicesCatalog, setAllServicesCatalog] = useState<any[]>([]);

  const loadRecommendedCatalog = async () => {
    try {
      const allDbServices = await getAllServicios();
      const freqMap: Record<string, { count: number; item: any }> = {};

      if (allDbServices && allDbServices.length > 0) {
        allDbServices.forEach((ser: any) => {
          const key = `${(ser.descripcion || "").trim()}#${(ser.proveedor || "").trim()}#${ser.neto}#${ser.pvp}#${ser.tipo}`.toLowerCase();
          if (!freqMap[key]) {
            freqMap[key] = {
              count: 1,
              item: {
                id: ser.id,
                tipo: ser.tipo || "transporte",
                proveedor: ser.proveedor || "",
                descripcion: ser.descripcion || "",
                neto: Number(ser.neto || 0),
                pvp: Number(ser.pvp || 0),
                opcional: ser.opcional || false,
                minimo_plazas: ser.minimo_plazas || null,
                detalles: ser.detalles ?? null,
                dbUsed: true,
              },
            };
          } else {
            freqMap[key].count += 1;
          }
        });
      }

      const uniqueDbServices = Object.values(freqMap).sort((a, b) => b.count - a.count);
      const normalizedMocks = MOCK_TEMPLATES.map((t, idx) => ({
        id: `mock-${idx}`,
        tipo: t.tipo,
        proveedor: t.proveedor,
        descripcion: t.descripcion,
        neto: t.neto,
        pvp: t.pvp,
        opcional: t.opcional,
        minimo_plazas: (t as any).minimo_plazas || null,
        dbUsed: false,
      }));

      const mergedPool: any[] = [];
      const seenKeys = new Set<string>();

      uniqueDbServices.forEach(({ count, item }) => {
        seenKeys.add(`${item.descripcion}#${item.proveedor}`.toLowerCase());
        mergedPool.push({ ...item, usageCount: count, isMostUsed: false });
      });

      normalizedMocks.forEach((mock) => {
        if (!seenKeys.has(`${mock.descripcion}#${mock.proveedor}`.toLowerCase())) {
          mergedPool.push({ ...mock, usageCount: 0, isMostUsed: false });
        }
      });

      setAllServicesCatalog(mergedPool);
      setRecommendedTemplates(
        mergedPool.slice(0, 5).map((item, idx) => ({
          ...item,
          isMostUsed: (item.usageCount && item.usageCount > 0) || idx < 3,
        }))
      );
    } catch (err) {
      console.error("Error loading recommended catalog:", err);
      setRecommendedTemplates(MOCK_TEMPLATES.slice(0, 5).map((m) => ({ ...m, isMostUsed: true, usageCount: 0 })));
      setAllServicesCatalog(MOCK_TEMPLATES.map((m) => ({ ...m, isMostUsed: false, usageCount: 0 })));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editServiceId && serviceData) {
      setOpcional(Boolean(serviceData.opcional));
      setTipo(serviceData.tipo || serviceTypes[0]?.id || "transporte");
      setProveedor(serviceData.proveedor || "");
      setDescripcion(serviceData.descripcion || "");
      setMinimoPlazas(serviceData.minimo_plazas?.toString() || "");
      setPlazas(serviceData.plazas?.toString() || "1");
      setNeto(serviceData.neto?.toString() || "");
      setPvp(serviceData.pvp?.toString() || "");
      setTotal(
        serviceData.total !== undefined && serviceData.total !== null
          ? serviceData.total.toString()
          : ((serviceData.pvp || 0) * (serviceData.plazas || 1)).toFixed(2)
      );
      setTotalEdited(serviceData.total !== undefined && serviceData.total !== null);
      setShowForm(true);
    } else {
      setOpcional(false);
      setTipo(serviceTypes[0]?.id || "transporte");
      setProveedor("");
      setDescripcion("");
      setMinimoPlazas("");
      setPlazas("1");
      setNeto("");
      setPvp("");
      setTotal("");
      setTotalEdited(false);
      setTemplateSearch("");
      setShowForm(false);
      loadRecommendedCatalog();
    }
  }, [isOpen, editServiceId, serviceData, serviceTypes]);

  useEffect(() => {
    if (!totalEdited) {
      setTotal(((parseFloat(pvp) || 0) * (parseInt(plazas) || 1)).toFixed(2));
    }
  }, [pvp, plazas, totalEdited]);

  const applyTemplate = (template: any) => {
    const resolvedType = serviceTypes.find(
      (st) => st.id === template.tipo || st.label.toLowerCase() === template.tipo?.toLowerCase()
    );
    setTipo(resolvedType ? resolvedType.id : serviceTypes[0]?.id || "");
    setProveedor(template.proveedor);
    setDescripcion(template.descripcion);
    setNeto(template.neto.toString());
    setPvp(template.pvp.toString());
    setTotal("");
    setTotalEdited(false);
    setMinimoPlazas(template.minimo_plazas?.toString() || "");
    setShowForm(true);
  };

  const displayTemplates =
    templateSearch.trim() === ""
      ? recommendedTemplates.filter((t) => t.opcional === opcional)
      : allServicesCatalog
          .filter((t) => t.opcional === opcional)
          .filter(
            (t) =>
              (t.descripcion || "").toLowerCase().includes(templateSearch.toLowerCase()) ||
              (t.proveedor || "").toLowerCase().includes(templateSearch.toLowerCase())
          );

  return {
    // state
    opcional, setOpcional,
    tipo, setTipo,
    proveedor, setProveedor,
    descripcion, setDescripcion,
    minimoPlazas, setMinimoPlazas,
    plazas, setPlazas,
    neto, setNeto,
    pvp, setPvp,
    total, setTotal,
    totalEdited, setTotalEdited,
    formLoading, setFormLoading,
    showForm, setShowForm,
    templateSearch, setTemplateSearch,
    displayTemplates,
    // actions
    applyTemplate,
  };
}
