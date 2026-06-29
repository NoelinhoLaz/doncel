import { NextResponse } from 'next/server';
import { createCotizacionLinea, deleteCotizacionLinea } from '@/actions/cotizaciones';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.cotizacion_id) return NextResponse.json({ success: false, error: 'cotizacion_id required' }, { status: 400 });
    const res = await createCotizacionLinea(body);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    const res = await deleteCotizacionLinea(id);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
