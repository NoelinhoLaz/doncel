import { NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/supabaseServer';
import { getAgencyDbClient } from '@/lib/agencyDb';

// POST /api/crm/sync-agentes
// One-shot: sincroniza todos los usuarios activos de la agencia actual a crm_agentes.
// Solo ejecutable por Admin o SuperAdmin.
export async function POST() {
  const adminServerClient = await createAdminServerClient();
  const { data: { user }, error: userError } = await adminServerClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const adminServiceClient = createAdminServiceClient();

  const { data: usuarioActual } = await adminServiceClient
    .from('usuarios')
    .select('rol, agencia_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!usuarioActual || !['Admin', 'SuperAdmin'].includes(usuarioActual.rol)) {
    return NextResponse.json({ error: 'Solo Admin o SuperAdmin puede ejecutar esta acción' }, { status: 403 });
  }

  // Obtener todos los usuarios activos de esta agencia desde BD Admin
  const { data: usuarios, error: usuariosError } = await adminServiceClient
    .from('usuarios')
    .select('id, auth_user_id, nombre, apellidos, avatar_url, rol, esta_activo')
    .eq('agencia_id', usuarioActual.agencia_id)
    .eq('esta_activo', true);

  if (usuariosError || !usuarios) {
    return NextResponse.json({ error: 'Error al obtener usuarios de BD Admin', detail: usuariosError?.message }, { status: 500 });
  }

  // Conectar a la BD de la agencia
  const agencyDb = await getAgencyDbClient();

  // Preparar filas para upsert
  const filas = usuarios
    .filter(u => u.auth_user_id) // solo los que tienen auth_user_id
    .map(u => ({
      id:         u.id,
      auth_uid:   u.auth_user_id,
      nombre:     u.nombre ?? '',
      apellidos:  u.apellidos ?? null,
      avatar_url: u.avatar_url ?? null,
      rol:        u.rol,
      activo:     u.esta_activo ?? true,
      synced_at:  new Date().toISOString(),
    }));

  if (filas.length === 0) {
    return NextResponse.json({ ok: true, sincronizados: 0, mensaje: 'No hay usuarios con auth_user_id para sincronizar' });
  }

  const { error: upsertError } = await agencyDb
    .from('crm_agentes')
    .upsert(filas, { onConflict: 'id' });

  if (upsertError) {
    return NextResponse.json({ error: 'Error al hacer upsert en crm_agentes', detail: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sincronizados: filas.length,
    agentes: filas.map(f => ({ id: f.id, nombre: `${f.nombre} ${f.apellidos ?? ''}`.trim(), rol: f.rol })),
  });
}
