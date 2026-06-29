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

  // 1. Check if the column exists
  console.log("1. Checking column...");
  const { data: colCheck } = await db.from("operativa_expedientes_servicios").select("documento_id").limit(1);
  console.log(`   Column exists: ${colCheck !== null} (error=${colCheck === null ? 'yes' : 'no'})`);

  // 2. Check servicios with documento_id
  console.log("\n2. Servicios:");
  const { data: servs } = await db.from("operativa_expedientes_servicios").select("id, proveedor, descripcion, documento_id, pvp").eq("expediente_id", expId);
  for (const s of (servs || [])) {
    console.log(`   ${s.id.slice(0,8)} "${(s.proveedor||'').slice(0,25)}" doc_id=${s.documento_id?.slice(0,8) || 'null'}`);
  }

  // 3. Check contabilidad_movimientos (tipo=pago, confirmado) for this expediente
  console.log("\n3. Contabilidad_movimientos (pago, confirmado):");
  const { data: cm } = await db.from("contabilidad_movimientos").select("id, importe_total, movimiento_banco_id").eq("tipo", "pago").eq("estado", "confirmado").eq("expediente_id", expId);
  for (const c of (cm || [])) {
    console.log(`   ${c.id.slice(0,8)} importe=${c.importe_total} banco=${c.movimiento_banco_id?.slice(0,8)}`);
  }

  // 4. Check the banco match_metadatos for the first movimiento
  console.log("\n4. Banco match_metadatos:");
  if (cm?.length) {
    const { data: b } = await db.from("contabilidad_movimientos_banco").select("match_metadatos").eq("id", cm[0].movimiento_banco_id).maybeSingle();
    if (b) {
      const mm = b.match_metadatos;
      console.log(`   origen=${mm?.origen || 'null'}`);
      console.log(`   servicio_id=${mm?.servicio_id?.slice(0,8) || 'null'}`);
      if (mm?.pagos) {
        for (const p of mm.pagos) {
          console.log(`   pago importe=${p.importe} documento_id=${p.documento_id?.slice(0,8) || 'null'}`);
        }
      }
    }
  }

  // 5. Verify the view
  console.log("\n5. v_abonados_servicios:");
  const { data: v } = await db.from("v_abonados_servicios").select("*");
  console.log(`   Rows: ${v?.length || 0}`);
  for (const r of (v || [])) {
    console.log(`   servicio=${r.servicio_id?.slice(0,8)} total=${r.total_abonado}`);
  }

  // 6. Check if the view definition matches what we expect
  console.log("\n6. Done. If abonado is 0, verify the backfill SQL was run.");
}

main();
