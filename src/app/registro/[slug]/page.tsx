import { notFound } from "next/navigation";
import { headers } from "next/headers";
import RegistroClient from "./RegistroClient";
import type { ViajeInfo } from "@/types/registro";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClientByDomain } from "@/lib/agencyDb";
import { getServiciosOpcionalesByDomain } from "@/actions/servicios";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getViajeBySlug(slug: string, domain: string | null): Promise<ViajeInfo | null> {
  try {
    if (!domain) return null;

    const agency = await getAgencyDbClientByDomain(domain);
    if (!agency) return null;

    const { data, error } = await agency.db
      .from("operativa_expedientes")
      .select(`
        id,
        slug,
        referencia,
        fecha_inicio,
        fecha_fin,
        pvp_viajero,
        pvp_total,
        forma_pago,
        formas_pago_aceptadas,
        plazos,
        oficina_id,
        maestro_destinos ( nombre )
      `)
      .eq("slug", slug)
      .single();

    if (error || !data) return null;

    const expedienteId = (data as any).id as string;

    // Servicios marcados como opcionales en operativa_expedientes_servicios
    const oficinaId = (data as any).oficina_id as string | null;
    const [serviciosOpcionales, viajeroRows, cuentaBancariaRow] = await Promise.all([
      getServiciosOpcionalesByDomain(expedienteId, domain),
      agency.db
        .from("operativa_viajeros_expedientes")
        .select("extras")
        .eq("expediente_id", expedienteId),
      oficinaId
        ? agency.db
            .from("config_cuentas_bancarias")
            .select("iban, banco")
            .eq("oficina_id", oficinaId)
            .eq("activa", true)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const totalViajeros = (viajeroRows.data || []).length;
    const seleccionadosPorExtra: Record<string, number> = {};
    for (const row of viajeroRows.data || []) {
      const rowExtras = Array.isArray(row.extras) ? row.extras : [];
      for (const e of rowExtras) {
        if (e?.id) seleccionadosPorExtra[e.id] = (seleccionadosPorExtra[e.id] || 0) + 1;
      }
    }

    const extras = serviciosOpcionales.map((s: any) => ({
      id: s.id,
      nombre: s.nombre,
      pvp: s.pvp,
      seleccionados: seleccionadosPorExtra[s.id] ?? 0,
      totalViajeros,
    }));

    const formasPago: string[] = (data.formas_pago_aceptadas as string[]) ?? [];
    const LABELS: Record<string, string> = {
      Transferencia: "Transferencia bancaria",
      "TPV virtual": "Tarjeta (TPV virtual)",
      "TPV fisico": "Tarjeta (TPV físico)",
      Efectivo: "Efectivo",
      Organizador: "Pago al organizador",
    };
    const metodoPago = formasPago.map(f => ({ id: f, nombre: LABELS[f] ?? f }));

    const pvpViajero =
      data.forma_pago === "varios_pagadores"
        ? parseFloat(data.pvp_viajero as any) || 0
        : parseFloat(data.pvp_total as any) || 0;

    return {
      slug: data.slug as string,
      nombre: data.referencia,
      destino: (data.maestro_destinos as any)?.nombre ?? "",
      fecha_salida: data.fecha_inicio ? String(data.fecha_inicio).split("T")[0] : "",
      fecha_vuelta: data.fecha_fin ? String(data.fecha_fin).split("T")[0] : "",
      pvp_por_viajero: pvpViajero,
      extras,
      metodo_pago: metodoPago,
      varios_pagadores: data.forma_pago === "varios_pagadores",
      iban_transferencia: (cuentaBancariaRow as any)?.data?.iban ?? null,
      plazos: ((data.plazos as any[]) ?? [])
        .filter((p: any) => !p.tipo || p.tipo === "pago")
        .map((p: any) => ({
          descripcion: p.descripcion || "",
          fecha: p.fecha || "",
          importe: parseFloat(p.importe) || 0,
        })),
    };
  } catch {
    return null;
  }
}

async function getAgencyBranding(domain: string | null): Promise<{ logoUrl: string | null; color: string | null }> {
  if (!domain) return { logoUrl: null, color: null };
  try {
    const supabase = createAdminServiceClient();
    const { data } = await supabase
      .from("agencias")
      .select("logo_url, color_corporativo")
      .eq("dominio", domain)
      .single();
    return {
      logoUrl: data?.logo_url ?? null,
      color: data?.color_corporativo ?? null,
    };
  } catch {
    return { logoUrl: null, color: null };
  }
}

export default async function RegistroPage({ params }: Props) {
  const { slug } = await params;
  const headersList = await headers();
  const domain =
    process.env.NEXT_PUBLIC_AGENCY_DOMAIN_OVERRIDE ||
    (() => {
      const host = headersList.get("host") || "";
      if (!host || host.startsWith("localhost") || host.startsWith("127.0.0.1")) return null;
      return host.split(":")[0];
    })();

  const [viaje, { logoUrl, color }] = await Promise.all([
    getViajeBySlug(slug, domain),
    getAgencyBranding(domain),
  ]);

  if (!viaje) notFound();

  return <RegistroClient viaje={viaje} logoUrl={logoUrl} brandColor={color} domain={domain ?? ""} />;
}
