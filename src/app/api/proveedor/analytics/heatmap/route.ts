import { NextRequest, NextResponse } from "next/server";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import { getProveedorSession } from "@/actions/proveedor";

export async function GET(request: NextRequest) {
  const session = await getProveedorSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const meses         = searchParams.getAll("mes");
  const anios         = searchParams.getAll("anio");
  const tipos         = searchParams.getAll("tipo");
  const tiposServicio = searchParams.getAll("tipo_servicio");

  const admin = createAdminServiceClient();
  let query = (admin as any)
    .from("metricas_cotizaciones")
    .select("cotizacion_id, lat, lng, localidad, mes_viaje, total_plazas, tipo_grupo, servicio_categoria");

  // Filtro mes+año
  if (meses.length > 0 && anios.length > 0) {
    const fechas: string[] = [];
    for (const anio of anios) {
      for (const mes of meses) {
        fechas.push(`${anio}-${mes.padStart(2, "0")}-01`);
      }
    }
    query = query.in("mes_viaje", fechas);
  } else if (anios.length > 0 && meses.length === 0) {
    const desde = `${Math.min(...anios.map(Number))}-01-01`;
    const hasta = `${Math.max(...anios.map(Number)) + 1}-01-01`;
    query = query.gte("mes_viaje", desde).lt("mes_viaje", hasta);
  }

  if (tipos.length > 0)         query = query.in("tipo_grupo", tipos);
  if (tiposServicio.length > 0) query = query.in("servicio_categoria", tiposServicio);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows: any[] = data ?? [];

  // Filtro de mes sin año en JS
  if (meses.length > 0 && anios.length === 0) {
    const mesNums = meses.map(m => m.padStart(2, "0"));
    rows = rows.filter(r => mesNums.includes(String(r.mes_viaje).slice(5, 7)));
  }

  // ── Consolidación en 2 pasos (regla del Pasajero Único) ──────────────────
  //
  // Paso 1: por cada (cotizacion_id, localidad) tomamos MAX(total_plazas).
  //   - Escenario A: Hotel MP + Hotel PC en Espot → misma clave → MAX = 50 (no 100)
  //   - Escenario B: Hotel Budapest + Parlamento Budapest → misma clave → MAX = 75
  //   - Escenario C: Hotel París + Hotel Budapest → claves distintas → 60 en París, 60 en Budapest
  //
  // Paso 2: agrupamos por (localidad, lat, lng) y SUMAMOS los MAX de distintas cotizaciones.
  //   - Dos grupos distintos al mismo destino sí suman (demanda real agregada).

  // Paso 1 — MAX por (cotizacion_id, localidad)
  const paso1 = new Map<string, { lat: number; lng: number; localidad: string; plazas: number; tipo: string; categorias: Set<string> }>();
  for (const r of rows) {
    const key = `${r.cotizacion_id}__${r.localidad}`;
    const existing = paso1.get(key);
    const plazas = Number(r.total_plazas) || 1;
    if (!existing) {
      const categorias = new Set<string>();
      if (r.servicio_categoria) categorias.add(r.servicio_categoria);
      paso1.set(key, {
        lat: Number(r.lat),
        lng: Number(r.lng),
        localidad: r.localidad ?? "",
        plazas,
        tipo: r.tipo_grupo ?? "",
        categorias,
      });
    } else {
      if (plazas > existing.plazas) existing.plazas = plazas;
      if (r.servicio_categoria) existing.categorias.add(r.servicio_categoria);
    }
  }

  // Paso 2 — SUM por (localidad, lat redondeado, lng redondeado)
  const paso2 = new Map<string, { lat: number; lng: number; nombre: string; plazas: number; tipo: string; categorias: Set<string> }>();
  for (const v of paso1.values()) {
    const latR = Math.round(v.lat * 100) / 100;
    const lngR = Math.round(v.lng * 100) / 100;
    const key  = `${v.localidad}__${latR}__${lngR}`;
    const existing = paso2.get(key);
    if (!existing) {
      paso2.set(key, { lat: latR, lng: lngR, nombre: v.localidad, plazas: v.plazas, tipo: v.tipo, categorias: new Set(v.categorias) });
    } else {
      existing.plazas += v.plazas;
      v.categorias.forEach(c => existing.categorias.add(c));
    }
  }

  const puntos = Array.from(paso2.values()).map(v => ({
    ...v,
    categorias: Array.from(v.categorias).sort(),
  }));
  const tiposServicioUnicos = [...new Set(rows.map(r => r.servicio_categoria).filter(Boolean))].sort();

  return NextResponse.json({ puntos, tiposServicio: tiposServicioUnicos });
}
