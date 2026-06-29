import { NextRequest, NextResponse } from 'next/server';
import { getContactos, createContacto } from '@/actions/crm';

export async function GET(req: NextRequest) {
  try {
    const entidadId = new URL(req.url).searchParams.get('entidad_id') ?? undefined;
    const data = await getContactos(entidadId);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await createContacto(body);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
