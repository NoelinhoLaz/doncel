import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";

// Inspecciona en detalle por qué un cliente aparece vinculado a varios expedientes:
// distingue si hay varias entidades distintas con el mismo nombre (duplicados) o si
// es la MISMA entidad (mismo id) vinculada de verdad a más de un expediente.
export async function GET(req: Request) {
  try {
    const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "Falta ?ids=uuid1,uuid2,..." }, { status: 400 });
    }

    const db = await getAgencyDbClient();

    const { data: entidades, error: e1 } = await db
      .from("contabilidad_entidades")
      .select("id, nombre, email, telefono, documento, agente_id")
      .in("id", ids);
    if (e1) throw e1;

    const { data: comoContacto } = await db
      .from("operativa_expedientes")
      .select("id, numero, referencia, entidad_id")
      .in("entidad_id", ids);

    const { data: comoPagador } = await db
      .from("operativa_pagadores_expedientes")
      .select("entidad_id, expediente_id, operativa_expedientes(id, numero, referencia)")
      .in("entidad_id", ids);

    const { data: comoViajero } = await db
      .from("operativa_viajeros_expedientes")
      .select("entidad_id, expediente_id, operativa_expedientes(id, numero, referencia)")
      .in("entidad_id", ids);

    const { data: comoTutor } = await db
      .from("operativa_viajeros_expedientes")
      .select("tutor_id, expediente_id, operativa_expedientes(id, numero, referencia)")
      .in("tutor_id", ids);

    // Buscar si existen OTRAS entidades con el mismo nombre (posibles duplicados)
    const nombres = [...new Set((entidades ?? []).map((e: any) => e.nombre))];
    const { data: homonimos } = await db
      .from("contabilidad_entidades")
      .select("id, nombre, email, telefono, documento")
      .in("nombre", nombres);

    return NextResponse.json({
      success: true,
      entidades,
      vinculos: {
        comoContacto: comoContacto ?? [],
        comoPagador: comoPagador ?? [],
        comoViajero: comoViajero ?? [],
        comoTutor: comoTutor ?? [],
      },
      homonimos, // todas las entidades (mismo id o no) que comparten nombre exacto
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
