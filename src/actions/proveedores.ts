"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentUsuario } from "@/actions/usuarios";

export async function getTopProveedores() {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: usageData } = await agencyDb
      .from("operativa_expedientes_servicios")
      .select("proveedor");

    const freqMap: Record<string, number> = {};
    if (usageData) {
      usageData.forEach((row: any) => {
        const name = row.proveedor?.trim().toLowerCase();
        if (name) freqMap[name] = (freqMap[name] || 0) + 1;
      });
    }

    const { data: allProv, error: provError } = await agencyDb
      .from("contabilidad_proveedores")
      .select("*");

    if (provError) throw provError;
    if (!allProv || allProv.length === 0) return [];

    const sorted = [...allProv].sort((a: any, b: any) => {
      const freqA = freqMap[a.nombre?.trim().toLowerCase()] || 0;
      const freqB = freqMap[b.nombre?.trim().toLowerCase()] || 0;
      if (freqA !== freqB) return freqB - freqA;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });

    return sorted.slice(0, 5);
  } catch (error: any) {
    console.error("Failed to get top proveedores:", error.message);
    return [];
  }
}

export async function getAllProveedores() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .select("id, nombre, razon_social");
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to get all proveedores:", error.message);
    return [];
  }
}

export async function getProveedorById(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .select("id, nombre, razon_social")
      .eq("id", id)
      .single();
    if (error) return null;
    return data;
  } catch (error: any) {
    console.error("Failed to get proveedor by id:", error.message);
    return null;
  }
}

export async function searchProveedores(searchQuery: string) {
  try {
    if (!searchQuery || searchQuery.trim().length < 3) return [];
    const agencyDb = await getAgencyDbClient();
    const cleanQuery = searchQuery.trim().toLowerCase();

    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .select("*")
      .or(`nombre.ilike.%${cleanQuery}%,razon_social.ilike.%${cleanQuery}%,"CIF".ilike.%${cleanQuery}%,cuenta_contable.ilike.%${cleanQuery}%`);

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Failed to search proveedores:", error.message);
    return [];
  }
}

export async function createProveedor(payload: {
  id?: string;
  nombre: string;
  razon_social?: string;
  cif?: string;
  cuenta_contable?: string;
  tipo?: string;
  observaciones?: string;
}) {
  try {
    const currentUser = await getCurrentUsuario();
    if (currentUser && currentUser.oficina_id) {
      const allowed = currentUser.parametros?.permisos_studio_proveedores?.crear;
      if (allowed === false) {
        throw new Error("No tienes permisos para crear proveedores en este tenant.");
      }
    }

    const agencyDb = await getAgencyDbClient();
    const newId = payload.id || Math.random().toString(36).substring(2, 11).toUpperCase();

    const { data, error } = await agencyDb
      .from("contabilidad_proveedores")
      .insert([{
        id: newId,
        nombre: payload.nombre,
        razon_social: payload.razon_social || null,
        "CIF": payload.cif || null,
        cuenta_contable: payload.cuenta_contable || null,
        tipo: payload.tipo || null,
        observaciones: payload.observaciones || null,
        creado_en: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to create proveedor:", error.message);
    throw new Error(error.message || "Failed to create proveedor");
  }
}
