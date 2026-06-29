import { NextResponse } from 'next/server';
import { createCotizacion, getCotizacionWithLineas, getCotizaciones, updateCotizacionMeta } from '@/actions/cotizaciones';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createCotizacion({ expediente_id: body.expediente_id || null, titulo: body.titulo || body.nombre || null });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
    const body = await req.json();
    const result = await updateCotizacionMeta(id, body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (id) {
      const data = await getCotizacionWithLineas(id);
      return NextResponse.json({ success: true, data });
    }
    const data = await getCotizaciones();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
