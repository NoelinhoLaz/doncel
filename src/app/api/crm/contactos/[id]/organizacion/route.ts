import { NextRequest, NextResponse } from 'next/server';
import { cambiarOrganizacionContacto } from '@/actions/crm';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.entidad_id) {
      return NextResponse.json({ success: false, error: 'entidad_id requerido' }, { status: 400 });
    }
    await cambiarOrganizacionContacto(id, body.entidad_id, body.motivo);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
