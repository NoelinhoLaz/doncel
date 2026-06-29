import { NextResponse } from 'next/server';
import { updateCotizacionLinea } from '@/actions/cotizaciones';

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    const res = await updateCotizacionLinea(body.id, body);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
