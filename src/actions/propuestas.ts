"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import { revalidatePath } from "next/cache";

export async function getPropuestas() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .select(`
        id, title, destination, created_at,
        landings(id, is_active, version_number, design_tokens, editor_content)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((p: any) => ({
      ...p,
      landing: Array.isArray(p.landings)
        ? (p.landings.find((l: any) => l.is_active) ?? p.landings[0] ?? null)
        : null,
      landings: undefined,
    }));
  } catch (e: any) {
    console.error("getPropuestas error:", e?.message, e?.stack?.split('\n')[1]);
    return { error: e?.message ?? "Error desconocido", data: [] };
  }
}

export async function deletePropuesta(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("operativa_propuestas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/propuestas");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

export async function getPropuesta(id: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("operativa_propuestas")
      .select(`id, title, destination, created_at, landings(id, is_active, design_tokens, editor_content)`)
      .eq("id", id)
      .single();
    if (error) throw error;
    const landing = Array.isArray(data.landings)
      ? (data.landings.find((l: any) => l.is_active) ?? data.landings[0] ?? null)
      : null;
    return { ...data, landing, landings: undefined };
  } catch (e: any) {
    console.error("getPropuesta:", e?.message);
    return null;
  }
}

export async function guardarPropuesta({
  propuestaId,
  editorContent,
  designTokens,
  cotizacionId,
}: {
  propuestaId?: string;
  editorContent: any[];
  designTokens: any[];
  cotizacionId?: string | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();

    if (propuestaId) {
      const { error } = await agencyDb
        .from("landings")
        .update({ editor_content: editorContent, design_tokens: designTokens })
        .eq("proposal_id", propuestaId)
        .eq("is_active", true);
      if (error) throw error;
      // Sincroniza el título en operativa_propuestas
      const portada = editorContent.find((s: any) => s.tipo === "portada");
      if (portada?.titulo) {
        await agencyDb.from("operativa_propuestas").update({ title: portada.titulo }).eq("id", propuestaId);
      }
      revalidatePath("/propuestas");
      return { ok: true, id: propuestaId };
    }

    // Título de la portada o fallback
    const portada = editorContent.find((s: any) => s.tipo === "portada");
    const title = portada?.titulo ?? "Nueva propuesta";

    const propInsert: any = { title, proposal_data: {} };
    if (cotizacionId) propInsert.cotizacion_id = cotizacionId;

    const { data: prop, error: propErr } = await agencyDb
      .from("operativa_propuestas")
      .insert(propInsert)
      .select("id")
      .single();
    if (propErr || !prop) throw propErr;

    // Si viene vinculada a una cotización, buscar el presupuesto_id y marcarlo como cotizado
    if (cotizacionId) {
      const { data: cot } = await agencyDb
        .from("operativa_cotizaciones")
        .select("presupuesto_id")
        .eq("id", cotizacionId)
        .single();
      if (cot?.presupuesto_id) {
        agencyDb
          .from("operativa_presupuestos")
          .update({ estado: "cotizado" })
          .eq("id", cot.presupuesto_id)
          .then(() => {});
      }
    }

    const { error: landingErr } = await agencyDb.from("landings").insert({
      proposal_id: prop.id,
      is_active: true,
      editor_content: editorContent,
      design_tokens: designTokens,
    });
    if (landingErr) throw landingErr;

    revalidatePath("/propuestas");
    return { ok: true, id: prop.id };
  } catch (e: any) {
    console.error("guardarPropuesta:", e?.message);
    return { ok: false, error: e?.message };
  }
}
