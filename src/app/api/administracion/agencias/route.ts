import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/supabaseServer';
import { decrypt } from "@/lib/encryption";

// Normaliza URLs de Supabase pegadas desde el dashboard (p. ej. con /rest/v1/ o barra final)
function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

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
    .select('id, nombre_comercial, razon_social, cif_nif, slug, plan_tipo, capacidad_tipo, estado, fecha_alta, email_general, telefono_general, direccion_central, color_corporativo, logo_url, supabase_url, supabase_service_role_key_enc, iv, auth_tag')
    .order('nombre_comercial', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get user counts from Admin DB
  const { data: allUsers } = await adminDb.from('usuarios').select('id, agencia_id');
  const userCountsMap: Record<string, number> = {};
  if (allUsers) {
    allUsers.forEach((u: any) => {
      if (u.agencia_id) {
        userCountsMap[u.agencia_id] = (userCountsMap[u.agencia_id] || 0) + 1;
      }
    });
  }

  // Get sub-tenant (oficinas) counts by connecting to each agency database
  const mappedAgencias = await Promise.all((data ?? []).map(async (agencia: any) => {
    let subtenantsCount = 0;
    let activeModules = {
      radar_activo: true,
      studio_activo: true,
      core_activo: true,
      pulse_activo: false,
      ledger_tax_activo: false
    };

    try {
      if (agencia.supabase_url && agencia.supabase_service_role_key_enc && agencia.iv && agencia.auth_tag) {
        const decryptedKey = decrypt(agencia.supabase_service_role_key_enc, agencia.iv, agencia.auth_tag);
        if (decryptedKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const agencyDb = createClient(agencia.supabase_url, decryptedKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
          });
          
          // Get offices count
          const { count, error: countErr } = await agencyDb
            .from('config_oficinas')
            .select('*', { count: 'exact', head: true });
          if (countErr) {
            console.error(`[API] Error counting config_oficinas for ${agencia.nombre_comercial}:`, countErr);
          } else if (count !== null) {
            subtenantsCount = count;
          }

          // Get active modules
          const { data: modData } = await agencyDb
            .from('config_modulos_tenant')
            .select('*')
            .limit(1)
            .maybeSingle();
          if (modData) {
            activeModules = {
              radar_activo: !!modData.radar_activo,
              studio_activo: !!modData.studio_activo,
              core_activo: !!modData.core_activo,
              pulse_activo: !!modData.pulse_activo,
              ledger_tax_activo: !!modData.ledger_tax_activo
            };
          }
        } else {
          console.warn(`[API] Decryption returned null for key of ${agencia.nombre_comercial}`);
        }
      }
    } catch (err: any) {
      console.error(`[API] Could not fetch data for agency ${agencia.nombre_comercial} (${agencia.id}):`, err.message || err);
    }

    const agentsCount = userCountsMap[agencia.id] || 0;

    // Quota calculations
    let baseBlockPrice = 0;
    const isFullBundle =
      activeModules.radar_activo &&
      activeModules.studio_activo &&
      activeModules.core_activo &&
      activeModules.pulse_activo &&
      activeModules.ledger_tax_activo;

    if (subtenantsCount === 0) {
      // Pricing for Starter plan (0 subtenants)
      if (isFullBundle) {
        baseBlockPrice = 99; // Pack Full
      } else {
        if (activeModules.studio_activo) baseBlockPrice += 37;
        if (activeModules.core_activo) baseBlockPrice += 22;
        if (activeModules.radar_activo) baseBlockPrice += 15;
        if (activeModules.pulse_activo) baseBlockPrice += 15;
        if (activeModules.ledger_tax_activo) baseBlockPrice += 22;
      }
    } else {
      // Pricing for Growth plan (1-3 subtenants base block)
      if (isFullBundle) {
        baseBlockPrice = 129; // Pack Full
      } else {
        if (activeModules.studio_activo) baseBlockPrice += 49;
        if (activeModules.core_activo) baseBlockPrice += 30;
        if (activeModules.radar_activo) baseBlockPrice += 20;
        if (activeModules.ledger_tax_activo) baseBlockPrice += 30;
        if (activeModules.pulse_activo) baseBlockPrice += 20;
      }
    }

    // Capacity scaling (only applies to Growth plan)
    let totalQuota = baseBlockPrice;
    if (subtenantsCount > 0) {
      const sExcess = Math.max(0, subtenantsCount - 3);
      const aExcess = Math.max(0, agentsCount - 9);
      const unitsNeeded = Math.max(sExcess, Math.ceil(aExcess / 3));

      const unitPrice = (baseBlockPrice / 3) * 1.20;
      const extraBlocks = Math.floor(unitsNeeded / 3);
      const remainingUnits = unitsNeeded % 3;
      const extraFee = (extraBlocks * baseBlockPrice) + (remainingUnits * unitPrice);
      totalQuota = baseBlockPrice + extraFee;
    }

    return {
      id: agencia.id,
      nombre_comercial: agencia.nombre_comercial,
      razon_social: agencia.razon_social,
      cif_nif: agencia.cif_nif,
      slug: agencia.slug,
      plan_tipo: agencia.plan_tipo,
      capacidad_tipo: agencia.capacidad_tipo || "Starter",
      estado: agencia.estado,
      fecha_alta: agencia.fecha_alta,
      email_general: agencia.email_general,
      telefono_general: agencia.telefono_general,
      direccion_central: agencia.direccion_central,
      color_corporativo: agencia.color_corporativo,
      logo_url: agencia.logo_url,
      agentes_count: agentsCount,
      subtenants_count: subtenantsCount,
      active_modules: activeModules,
      cuota_mensual: Math.round(totalQuota * 100) / 100, // round to 2 decimals
      tipo: agencia.capacidad_tipo || "Starter"
    };
  }));

  console.log("[API] Mapped agencies output:", mappedAgencias.map(a => ({ name: a.nombre_comercial, agents: a.agentes_count, subtenants: a.subtenants_count, quota: a.cuota_mensual })));

  return NextResponse.json({ agencias: mappedAgencias });
}

// POST /api/administracion/agencias — crear agencia
export async function POST(req: NextRequest) {
  const user = await verifySuperAdmin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  // Los módulos (radar_activo, core_activo, etc.) viven en config_modulos_tenant
  // dentro de la BD de la propia agencia, no en la tabla 'agencias' de la BD Admin.
  const { radar_activo, studio_activo, core_activo, pulse_activo, ledger_tax_activo, ...agenciaFields } = body;
  if (agenciaFields.supabase_url) {
    agenciaFields.supabase_url = normalizeSupabaseUrl(agenciaFields.supabase_url);
  }
  const adminDb = createAdminServiceClient();

  const { error } = await adminDb.from('agencias').insert([agenciaFields]);
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
  const {
    nombre_comercial, razon_social, cif_nif, slug, email_general, telefono_general, direccion_central, color_corporativo, plan_tipo, capacidad_tipo, estado,
    supabase_url,
    radar_activo, studio_activo, core_activo, pulse_activo, ledger_tax_activo
  } = body;

  const adminDb = createAdminServiceClient();

  const updatePayload: any = {};
  if (nombre_comercial !== undefined) updatePayload.nombre_comercial = nombre_comercial;
  if (razon_social !== undefined) updatePayload.razon_social = razon_social;
  if (cif_nif !== undefined) updatePayload.cif_nif = cif_nif;
  if (slug !== undefined) updatePayload.slug = slug;
  if (email_general !== undefined) updatePayload.email_general = email_general;
  if (telefono_general !== undefined) updatePayload.telefono_general = telefono_general;
  if (direccion_central !== undefined) updatePayload.direccion_central = direccion_central;
  if (color_corporativo !== undefined) updatePayload.color_corporativo = color_corporativo;
  if (plan_tipo !== undefined) updatePayload.plan_tipo = plan_tipo;
  if (capacidad_tipo !== undefined) updatePayload.capacidad_tipo = capacidad_tipo;
  if (supabase_url) updatePayload.supabase_url = normalizeSupabaseUrl(supabase_url);
  if (estado !== undefined) updatePayload.estado = estado;

  const { error } = await adminDb.from('agencias').update(updatePayload).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update modules if any is provided
  if (radar_activo !== undefined || studio_activo !== undefined || core_activo !== undefined || pulse_activo !== undefined || ledger_tax_activo !== undefined) {
    const { data: agency } = await adminDb
      .from('agencias')
      .select('supabase_url, supabase_service_role_key_enc, iv, auth_tag')
      .eq('id', id)
      .single();

    if (agency && agency.supabase_url && agency.supabase_service_role_key_enc && agency.iv && agency.auth_tag) {
      const decryptedKey = decrypt(agency.supabase_service_role_key_enc, agency.iv, agency.auth_tag);
      if (decryptedKey) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const agencyDb = createClient(agency.supabase_url, decryptedKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
          });
          
          const { data: firstRow } = await agencyDb.from('config_modulos_tenant').select('id').limit(1).maybeSingle();
          if (firstRow) {
            const updateFields: any = {};
            if (radar_activo !== undefined) updateFields.radar_activo = !!radar_activo;
            if (studio_activo !== undefined) updateFields.studio_activo = !!studio_activo;
            if (core_activo !== undefined) updateFields.core_activo = !!core_activo;
            if (pulse_activo !== undefined) updateFields.pulse_activo = !!pulse_activo;
            if (ledger_tax_activo !== undefined) updateFields.ledger_tax_activo = !!ledger_tax_activo;
            updateFields.updated_at = new Date().toISOString();

            await agencyDb.from('config_modulos_tenant').update(updateFields).eq('id', firstRow.id);
          } else {
            await agencyDb.from('config_modulos_tenant').insert({
              radar_activo: !!radar_activo,
              studio_activo: !!studio_activo,
              core_activo: !!core_activo,
              pulse_activo: !!pulse_activo,
              ledger_tax_activo: !!ledger_tax_activo
            });
          }
        } catch (err: any) {
          console.error(`[API] Error updating config_modulos_tenant for agency ${id}:`, err.message || err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
