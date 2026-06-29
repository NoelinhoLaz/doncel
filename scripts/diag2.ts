import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function decrypt(encryptedHex: string, ivHex: string, authTagHex: string): string | null {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL!,
    process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  const { data: agencias } = await admin.from("agencias").select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag");
  const agency = agencias?.find((a: any) => a.supabase_url?.includes("pmwuaczeyjnfkahpjlcm"));
  if (!agency) { console.error("Agency not found"); return; }

  const key = decrypt(agency.supabase_service_role_key_enc, agency.iv, agency.auth_tag);
  if (!key) { console.error("Failed to decrypt key"); return; }

  const db = createClient(agency.supabase_url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const expId = "1587634d-0f9e-4535-89ad-76fd8de7249c";

  // 1. Check ALL contabilidad_movimientos (tipo=pago, confirmado) for this expediente
  console.log("=== CONTABILIDAD_MOVIMIENTOS (tipo=pago, estado=confirmado) for expediente ===");
  const { data: pagosExp } = await db
    .from("contabilidad_movimientos")
    .select("id, importe_total, movimiento_banco_id, concepto, created_at")
    .eq("tipo", "pago")
    .eq("estado", "confirmado")
    .eq("expediente_id", expId);

  console.log(`Found ${pagosExp?.length || 0} records`);
  for (const p of (pagosExp || [])) {
    // Check if the banco movement has servicio_id
    if (p.movimiento_banco_id) {
      const { data: b } = await db.from("contabilidad_movimientos_banco")
        .select("id, match_metadatos")
        .eq("id", p.movimiento_banco_id)
        .maybeSingle();
      const mm = b?.match_metadatos;
      console.log(`  ${p.id.slice(0,8)} importe=${p.importe_total} banco=${p.movimiento_banco_id.slice(0,8)} servicio_id=${mm?.servicio_id?.slice(0,8)||'null'} origen=${mm?.origen||'null'}`);
    } else {
      console.log(`  ${p.id.slice(0,8)} importe=${p.importe_total} banco=null`);
    }
  }

  // 2. Check servicios and their abonado per the view
  console.log("\n=== SERVICIOS con abonado from view ===");
  const { data: servicios } = await db
    .from("operativa_expedientes_servicios")
    .select("id, proveedor, descripcion, total, pvp")
    .eq("expediente_id", expId);

  for (const s of (servicios || [])) {
    const { data: ab } = await db
      .from("v_abonados_servicios")
      .select("total_abonado")
      .eq("servicio_id", s.id)
      .maybeSingle();
    console.log(`  ${s.id.slice(0,8)} "${(s.proveedor||'').slice(0,25)}" pvp=${s.pvp} abonado=${ab?.total_abonado ?? 0}`);
  }

  // 3. Check what the view actually returns
  console.log("\n=== V_ABONADOS_SERVICIOS raw output ===");
  const { data: rawAbonos } = await db.from("v_abonados_servicios").select("*");
  console.log(`Total rows: ${rawAbonos?.length || 0}`);
  for (const a of (rawAbonos || [])) {
    console.log(`  servicio=${a.servicio_id?.slice(0,8)} total=${a.total_abonado}`);
  }
}

main();
