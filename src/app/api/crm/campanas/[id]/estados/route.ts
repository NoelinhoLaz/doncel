import { NextRequest, NextResponse } from 'next/server';
import { getEstadosCampana, createEstadoCampana, updateEstadoCampana, deleteEstadoCampana } from '@/actions/crm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getEstadosCampana(id);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await createEstadoCampana(id, body);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

// PATCH y DELETE reciben estadoId en el body
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { estadoId, ...payload } = body;
    if (!estadoId) return NextResponse.json({ success: false, error: 'estadoId requerido' }, { status: 400 });
    const data = await updateEstadoCampana(estadoId, payload);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.estadoId) return NextResponse.json({ success: false, error: 'estadoId requerido' }, { status: 400 });
    await deleteEstadoCampana(body.estadoId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
