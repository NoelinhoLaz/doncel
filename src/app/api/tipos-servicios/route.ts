import { NextResponse } from 'next/server';
import { getAgencyDbClient } from '@/lib/agencyDb';

export async function GET() {
  try {
    const db = await getAgencyDbClient();
    const { data } = await db
      .from('config_tipos_servicios')
      .select('id, etiqueta, icono')
      .order('etiqueta', { ascending: true });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
