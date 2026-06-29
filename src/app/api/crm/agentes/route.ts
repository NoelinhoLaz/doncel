import { NextResponse } from 'next/server';
import { getAgentes } from '@/actions/crm';

export async function GET() {
  try {
    const data = await getAgentes();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
