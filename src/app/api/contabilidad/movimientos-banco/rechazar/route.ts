import { NextRequest, NextResponse } from 'next/server';
import { getAgencyDbClient } from '@/lib/agencyDb';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { movimiento_banco_id, estado = 'pendiente' } = body;

    if (!movimiento_banco_id) {
      return NextResponse.json(
        { error: 'El movimiento_banco_id es requerido.' },
        { status: 400 }
      );
    }

    const agencyDb = await getAgencyDbClient();

    // Actualizar el estado en la base de datos
    const { error } = await agencyDb
      .from('contabilidad_movimientos_banco')
      .update({
        estado: estado,
        match_score: null,
        match_propuesto_at: null,
        match_metadatos: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', movimiento_banco_id);

    if (error) {
      console.error('Error rejecting bank movement match:', error);
      return NextResponse.json(
        { error: `Error al rechazar propuesta: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in reject bank movement match route:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al rechazar propuesta.' },
      { status: 500 }
    );
  }
}
