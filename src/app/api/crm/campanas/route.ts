import { NextRequest, NextResponse } from 'next/server';
import { getCampanas, createCampana } from '@/actions/crm';

export async function GET() {
  try {
    const data = await getCampanas();
    return NextResponse.json({ success: true, data });
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
