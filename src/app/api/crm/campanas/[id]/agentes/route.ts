import { NextRequest, NextResponse } from 'next/server';
import { getAgentesCampana, upsertAgenteCampana, removeAgenteCampana } from '@/actions/crm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getAgentesCampana(id);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await upsertAgenteCampana(id, body);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.agente_id) return NextResponse.json({ success: false, error: 'agente_id requerido' }, { status: 400 });
    await removeAgenteCampana(id, body.agente_id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
