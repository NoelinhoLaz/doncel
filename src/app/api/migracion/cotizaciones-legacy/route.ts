import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentAgentePublic } from "@/actions/crm";
import { getTiposServicios } from "@/actions/tiposServicios";

// Mapeo de tipo legacy → etiqueta de tipo servicio en la nueva BD
const TIPO_MAP: Record<string, string[]> = {
  alojamiento:  ["alojamiento", "hotel", "hospedaje"],
  transporte:   ["transporte", "vuelo", "avión", "autobus", "bus", "transfer"],
  entradas:     ["entradas", "entrada", "monumento", "museo", "visita"],
  actividades:  ["actividades", "actividad", "excursión"],
  guias:        ["guias", "guía", "guia"],
  restauracion: ["restauracion", "restauración", "comida", "cena", "almuerzo"],
  seguro:       ["seguro"],
  suplementos:  ["suplementos", "suplemento"],
  extrasViajero:["extras", "extra"],
  monitores:    ["monitores", "monitor"],
  packs:        ["pack", "packs"],
};

function findTipoId(tiposMap: Record<string, any>, categoria: string): string | null {
  const keywords = TIPO_MAP[categoria] ?? [categoria.toLowerCase()];
  for (const tipo of Object.values(tiposMap)) {
    const etq = (tipo.etiqueta ?? "").toLowerCase();
    if (keywords.some(k => etq.includes(k))) return tipo.id;
  }
  return Object.keys(tiposMap)[0] ?? null;
}

function convertirServicios(servicios: any, tiposMap: Record<string, any>): any[] {
  const lineas: any[] = [];

  const push = (categoria: string, items: any[]) => {
    for (const s of items) {
      const tipoId = findTipoId(tiposMap, categoria);
      const linea: any = {
        tipo: tipoId,
        descripcion: s.observaciones || s.notas || s.descripcion || s.nombre || "",
        proveedor: null,
        destino: null,
        plazas: null,
        noches: null,
        neto: null,
        pvp: null,
        opcional: s.esExtra ?? false,
        checked: true,
      };

      // Extraer proveedor si viene como string
      if (s.proveedor && typeof s.proveedor === "string" && s.proveedor.trim()) {
        linea._proveedor_nombre = s.proveedor.trim();
      }

      switch (categoria) {
        case "alojamiento":
          linea.descripcion = [s.nombreAlojamiento, s.tipoAlojamiento, s.categoria, s.regimen, s.uso].filter(Boolean).join(" · ");
          linea.neto = s.precio ?? null;
          linea.noches = s.noches ?? null;
          linea.plazas = s.personas ?? null;
          break;
        case "transporte":
          linea.descripcion = [s.medioTransporte, s.compania, s.clase, s.tipoServicio, s.observaciones].filter(Boolean).join(" · ");
          linea.neto = s.precio ?? null;
          linea.plazas = s.plazas ?? null;
          break;
        case "entradas":
        case "actividades":
          linea.descripcion = [s.nombre, s.tipo, s.horario, s.notas].filter(Boolean).join(" · ");
          linea.neto = s.precio != null ? Number(s.precio) : null;
          linea.plazas = s.cantidad != null ? Number(s.cantidad) : null;
          break;
        case "guias":
          linea.descripcion = [s.tipoServicio, s.idioma, s.especialidad, s.observaciones].filter(Boolean).join(" · ");
          linea.neto = s.precioUnitario ?? null;
          linea.plazas = s.numeroGuias ?? null;
          break;
        case "restauracion":
          linea.descripcion = [s.tipo, s.nombre, s.horario].filter(Boolean).join(" · ");
          linea.neto = s.precio ?? null;
          linea.plazas = s.cantidad != null ? Number(s.cantidad) : (s.plazas ?? null);
          linea.noches = s.dias ?? null;
          break;
        case "seguro":
          linea.descripcion = [s.tipoSeguro, s.coberturaPrincipal, s.descripcion].filter(Boolean).join(" · ");
          linea.neto = s.importe ?? null;
          linea.plazas = s.plazas ?? null;
          break;
        case "extrasViajero":
          linea.descripcion = s.descripcion ?? "";
          linea.neto = s.neto ?? null;
          linea.pvp = s.pvp ?? null;
          linea.opcional = true;
          break;
        default:
          linea.neto = s.precio ?? s.precioUnitario ?? s.importe ?? null;
          linea.plazas = s.plazas ?? s.cantidad ?? null;
      }

      lineas.push(linea);
    }
  };

  for (const [cat, items] of Object.entries(servicios)) {
    if (Array.isArray(items) && items.length > 0) push(cat, items);
  }

  return lineas;
}

export async function POST(req: Request) {
  try {
    const agente = await getCurrentAgentePublic();
    const isOwner = ["Owner", "SuperAdmin", "Admin"].includes(agente.rol ?? "");
    if (!isOwner) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

    const { modo = "preview", limite = 50 } = await req.json().catch(() => ({}));

    const agencyDb = await getAgencyDbClient();
    const tiposList = await getTiposServicios();
    const tiposMap = Object.fromEntries(tiposList.map((t: any) => [t.id, t]));

    // Leer cotizaciones legacy
    const { data: legacyCots, error } = await agencyDb
      .from("cotizaciones")
      .select("id, titulo, descripcion, plazas, pvp_viajero, costes_viajero, estado, centro_id, usuario_id, dia_salida, dia_regreso, servicios, numero, created_at")
      .eq("es_version_actual", true)
      .order("created_at", { ascending: false })
      .limit(limite);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    if (!legacyCots?.length) return NextResponse.json({ success: true, data: [], mensaje: "No hay cotizaciones legacy" });

    if (modo === "preview") {
      const preview = legacyCots.map((c: any) => {
        const servicios = c.servicios ?? {};
        const lineas = convertirServicios(servicios, tiposMap);
        return {
          id: c.id,
          numero: c.numero,
          titulo: c.titulo,
          estado: c.estado,
          lineas_count: lineas.length,
          total: Object.values(servicios).flat().reduce((s: number, sv: any) => s + (Number((sv as any).total) || 0), 0),
        };
      });
      return NextResponse.json({ success: true, data: preview, total: legacyCots.length });
    }

    // modo === "import" — crear cotizaciones nuevas
    const resultados: any[] = [];
    for (const legacyCot of legacyCots) {
      try {
        const servicios = legacyCot.servicios ?? {};
        const lineas = convertirServicios(servicios, tiposMap);

        // Crear cotización en operativa_cotizaciones
        const { data: nuevaCot, error: errCot } = await agencyDb
          .from("operativa_cotizaciones")
          .insert({
            nombre: legacyCot.titulo || legacyCot.numero || "Importada",
            estado: legacyCot.estado === "aceptada" ? "aceptada" : legacyCot.estado === "enviada" ? "enviada" : "borrador",
            agente_id: legacyCot.usuario_id ?? null,
            notas: legacyCot.descripcion ?? null,
          })
          .select("id")
          .single();

        if (errCot || !nuevaCot) {
          resultados.push({ id: legacyCot.id, titulo: legacyCot.titulo, error: errCot?.message ?? "Error creando cotización" });
          continue;
        }

        // Insertar líneas
        const lineasPayload = lineas.map((l: any) => ({
          cotizacion_id: nuevaCot.id,
          tipo: l.tipo,
          descripcion: l.descripcion,
          plazas: l.plazas,
          noches: l.noches,
          neto: l.neto,
          pvp: l.pvp,
          opcional: l.opcional,
          checked: l.checked,
          total_neto: l.neto != null && l.plazas != null ? Number(l.neto) * Number(l.plazas) * (l.noches ?? 1) : null,
          total_pvp: l.pvp != null && l.plazas != null ? Number(l.pvp) * Number(l.plazas) * (l.noches ?? 1) : null,
        }));

        if (lineasPayload.length) {
          await agencyDb.from("operativa_cotizacion_lineas").insert(lineasPayload);
        }

        resultados.push({ id: legacyCot.id, nueva_id: nuevaCot.id, titulo: legacyCot.titulo, lineas: lineasPayload.length, ok: true });
      } catch (e: any) {
        resultados.push({ id: legacyCot.id, titulo: legacyCot.titulo, error: e.message });
      }
    }

    const ok = resultados.filter(r => r.ok).length;
    return NextResponse.json({ success: true, importadas: ok, errores: resultados.filter(r => r.error).length, data: resultados });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
