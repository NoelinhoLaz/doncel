import { NextRequest, NextResponse } from 'next/server';
import { getCampanas, createCampana, getCurrentAgentePublic } from '@/actions/crm';

export async function GET() {
  try {
    const [data, agente] = await Promise.all([getCampanas(), getCurrentAgentePublic()]);
    return NextResponse.json({ success: true, data, rol: agente.rol, agenteId: agente.usuarioId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await createCampana(body);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes('Solo Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
