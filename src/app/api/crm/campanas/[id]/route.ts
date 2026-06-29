import { NextRequest, NextResponse } from 'next/server';
import { getCampana, updateCampana, deleteCampana, getCurrentAgentePublic } from '@/actions/crm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [data, agente] = await Promise.all([getCampana(id), getCurrentAgentePublic()]);
    return NextResponse.json({ success: true, data, rol: agente.rol, agenteId: agente.usuarioId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await updateCampana(id, body);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteCampana(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
