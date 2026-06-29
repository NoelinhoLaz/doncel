import { NextRequest, NextResponse } from 'next/server';
import { getOportunidad, updateOportunidad, getHistorialEstados, deleteOportunidad } from '@/actions/crm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const incluirHistorial = new URL(req.url).searchParams.get('historial') === 'true';
    const [data, historial] = await Promise.all([
      getOportunidad(id),
      incluirHistorial ? getHistorialEstados(id) : Promise.resolve(undefined),
    ]);
    return NextResponse.json({ success: true, data, historial });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await updateOportunidad(id, body);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteOportunidad(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
