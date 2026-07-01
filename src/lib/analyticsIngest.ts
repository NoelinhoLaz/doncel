import { createAdminServiceClient } from "@/lib/supabaseServer";

// Borra todas las filas de una cotización+localidad (independientemente de la categoría)
export async function deleteMetricaCotizacion(params: {
  cotizacion_id: string;
  localidad: string;
}) {
  try {
    const admin = createAdminServiceClient();
    const { error } = await (admin as any)
      .from("metricas_cotizaciones")
      .delete()
      .eq("cotizacion_id", params.cotizacion_id)
      .eq("localidad", params.localidad);
    if (error) console.error("[analytics] delete error:", error.message);
  } catch (err: any) {
    console.error("[analytics] delete exception:", err.message);
  }
}

export async function deleteTodasMetricasCotizacion(cotizacion_id: string) {
  try {
    const admin = createAdminServiceClient();
    const { error } = await (admin as any)
      .from("metricas_cotizaciones")
      .delete()
      .eq("cotizacion_id", cotizacion_id);
    if (error) console.error("[analytics] delete-all error:", error.message);
  } catch (err: any) {
    console.error("[analytics] delete-all exception:", err.message);
  }
}

export async function ingestMetricaCotizacion(params: {
  cotizacion_id: string;
  lat: number;
  lng: number;
  localidad: string;
  servicio_categoria: string;
  mes_viaje: string;
  total_plazas: number;
  tipo_grupo?: string;
  provincia?: string;
}) {
  try {
    const admin = createAdminServiceClient();
    const { error } = await (admin as any)
      .from("metricas_cotizaciones")
      .upsert(
        {
          cotizacion_id:      params.cotizacion_id,
          lat:                params.lat,
          lng:                params.lng,
          localidad:          params.localidad,
          servicio_categoria: params.servicio_categoria,
          destino_nombre:     params.localidad,
          mes_viaje:          params.mes_viaje,
          total_plazas:       params.total_plazas,
          tipo_grupo:         params.tipo_grupo ?? null,
          provincia:          params.provincia ?? null,
          tipo_servicio:      params.servicio_categoria, // backward compat
        },
        { onConflict: "cotizacion_id,localidad,servicio_categoria", ignoreDuplicates: false },
      );
    if (error) console.error("[analytics] ingest error:", error.message);
  } catch (err: any) {
    console.error("[analytics] ingest exception:", err.message);
  }
}
