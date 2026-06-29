import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function decrypt(...a: any[]): string | null {
  const [encryptedHex, ivHex, authTagHex] = a;
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const enc = Buffer.from(encryptedHex, "hex");
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv).setAuthTag(authTag);
  let r = d.update(enc);
  return Buffer.concat([r, d.final()]).toString("utf8");
}

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL!, process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: ag } = await admin.from("agencias").select("id, supabase_url, supabase_service_role_key_enc, iv, auth_tag");
  const agency = ag?.find((a: any) => a.supabase_url?.includes("pmwuaczeyjnfkahpjlcm"));
  if (!agency) { console.error("Agency not found"); return; }
  const key = decrypt(agency.supabase_service_role_key_enc, agency.iv, agency.auth_tag);
  const db = createClient(agency.supabase_url, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  const expId = "1587634d-0f9e-4535-89ad-76fd8de7249c";

  // Fetch contabilidad_movimientos for this expediente
  const { data: movs } = await db
    .from("contabilidad_movimientos")
    .select("id, importe_total, concepto, created_at, movimiento_banco_id")
    .eq("tipo", "pago")
    .eq("estado", "confirmado")
    .eq("expediente_id", expId);

  console.log("=== CONTABILIDAD_MOVIMIENTOS ===");
  for (const m of (movs || [])) {
    console.log(`  ${m.id.slice(0,8)} importe=${m.importe_total} banco=${m.movimiento_banco_id?.slice(0,8)} concepto="${m.concepto?.slice(0,50)}"`);
  }

  // Fetch bancos
  const bancoIds = [...new Set((movs || []).map((m: any) => m.movimiento_banco_id).filter(Boolean))];
  console.log(`\n=== BANCOS (${bancoIds.length}) ===`);
  for (const bid of bancoIds) {
    const { data: b } = await db.from("contabilidad_movimientos_banco")
      .select("id, fecha_operacion, concepto_original, importe, match_metadatos")
      .eq("id", bid)
      .maybeSingle();
    if (b) {
      console.log(`  ${b.id.slice(0,8)} fecha=${b.fecha_operacion} importe=${b.importe} concepto="${b.concepto_original?.slice(0,50) || 'null'}"`);
      console.log(`    match_metadatos.proveedor=${b.match_metadatos?.proveedor_nombre}`);
      console.log(`    match_metadatos.servicio_id=${b.match_metadatos?.servicio_id?.slice(0,8) || 'null'}`);
      console.log(`    match_metadatos.origen=${b.match_metadatos?.origen || 'null'}`);
      if (b.match_metadatos?.pagos) {
        for (const p of b.match_metadatos.pagos) {
          console.log(`    pago importe=${p.importe} documento_id=${p.documento_id?.slice(0,8) || 'null'}`);
        }
      }
    }
  }

  // Fetch servicios
  console.log("\n=== SERVICIOS ===");
  const { data: servs } = await db
    .from("operativa_expedientes_servicios")
    .select("id, proveedor, descripcion, documento_id, pvp")
    .eq("expediente_id", expId);

  for (const s of (servs || [])) {
    console.log(`  ${s.id.slice(0,8)} "${(s.proveedor||'').slice(0,25)}" doc=${s.documento_id?.slice(0,8) || 'null'} pvp=${s.pvp}`);

    // Check linking
    for (const m of (movs || [])) {
      const { data: b } = await db.from("contabilidad_movimientos_banco")
        .select("id, fecha_operacion, concepto_original, importe, match_metadatos")
        .eq("id", m.movimiento_banco_id)
        .maybeSingle();
      if (!b) continue;
      const mm = b.match_metadatos;
      let linked = false;
      if (mm?.servicio_id === s.id) linked = true;
      else if (s.documento_id && mm?.pagos) linked = mm.pagos.some((p: any) => p.documento_id === s.documento_id);
      if (linked) {
        console.log(`    ← banco ${b.id.slice(0,8)} importe=${b.importe} fecha=${b.fecha_operacion} concepto="${b.concepto_original?.slice(0,40) || 'null'}"`);
      }
    }
  }
}

main();
