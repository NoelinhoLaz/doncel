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

// POST /api/administracion/agencias/owner — crea el primer usuario Owner de una agencia
export async function POST(req: NextRequest) {
  const user = await verifySuperAdmin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { agencia_id, nombre, apellidos, email, telefono, modo, password } = await req.json();

  if (!agencia_id || !nombre || !email) {
    return NextResponse.json({ error: 'agencia_id, nombre y email son obligatorios' }, { status: 400 });
  }

  if (modo === 'directo' && (!password || password.length < 6)) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const adminServiceSupabase = createAdminServiceClient();

  const { data: agencia, error: agenciaError } = await adminServiceSupabase
    .from('agencias')
    .select('id')
    .eq('id', agencia_id)
    .single();

  if (agenciaError || !agencia) {
    return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 404 });
  }

  let authUser;
  let authError;

  if (modo === 'directo') {
    // Crea el usuario directamente con contraseña y email ya confirmado (útil para emails ficticios de demo)
    const res = await adminServiceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, apellidos: apellidos || '' },
    });
    authUser = res.data;
    authError = res.error;
  } else {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const res = await adminServiceSupabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: { nombre, apellidos: apellidos || '' },
        redirectTo: `${appUrl}/login`,
      }
    );
    authUser = res.data;
    authError = res.error;
  }

  if (authError || !authUser?.user) {
    return NextResponse.json({ error: authError?.message || 'Error al crear usuario' }, { status: 500 });
  }

  const targetUserId = authUser.user.id;

  const { error: insertError } = await adminServiceSupabase
    .from('usuarios')
    .insert({
      id: targetUserId,
      auth_user_id: targetUserId,
      agencia_id,
      email,
      nombre,
      apellidos: apellidos || null,
      telefono: telefono || null,
      rol: 'Owner',
      estado: 'Activo',
      esta_activo: true,
    });

  if (insertError) {
    await adminServiceSupabase.auth.admin.deleteUser(targetUserId);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: targetUserId });
}
