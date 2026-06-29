import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/supabaseServer';

async function verifySuperAdmin() {
  const sessionClient = await createAdminServerClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return null;

  const adminDb = createAdminServiceClient();
  const { data: usuario } = await adminDb
    .from('usuarios')
    .select('rol')
    .eq('auth_user_id', user.id)
    .single();

  return usuario?.rol === 'SuperAdmin' ? user : null;
}

// GET /api/administracion/agencias
export async function GET() {
  const user = await verifySuperAdmin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const adminDb = createAdminServiceClient();
  const { data, error } = await adminDb
    .from('agencias')
    .select('id, nombre_comercial, razon_social, cif_nif, slug, plan_tipo, estado, fecha_alta, email_general, telefono_general, direccion_central, color_corporativo, logo_url')
    .order('nombre_comercial', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agencias: data ?? [] });
}

// POST /api/administracion/agencias — crear agencia
export async function POST(req: NextRequest) {
  const user = await verifySuperAdmin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const adminDb = createAdminServiceClient();

  const { error } = await adminDb.from('agencias').insert([body]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// PATCH /api/administracion/agencias?id=xxx — actualizar agencia
export async function PATCH(req: NextRequest) {
  const user = await verifySuperAdmin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const body = await req.json();
  const adminDb = createAdminServiceClient();

  const { error } = await adminDb.from('agencias').update(body).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
