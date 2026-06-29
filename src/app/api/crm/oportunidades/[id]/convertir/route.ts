import { NextRequest, NextResponse } from 'next/server';
import { convertirOportunidadAExpediente } from '@/actions/crm';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.expediente_id) {
      return NextResponse.json({ success: false, error: 'expediente_id requerido' }, { status: 400 });
    }
    await convertirOportunidadAExpediente(id, body.expediente_id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
