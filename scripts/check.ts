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
  if (!agency) return;
  const key = decrypt(agency.supabase_service_role_key_enc, agency.iv, agency.auth_tag);
  const db = createClient(agency.supabase_url, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  const expId = "1587634d-0f9e-4535-89ad-76fd8de7249c";

  // Try selecting documento_id — if column doesn't exist, it will error
  const { data: servs, error } = await db.from("operativa_expedientes_servicios")
    .select("id, proveedor, descripcion, documento_id, pvp")
    .eq("expediente_id", expId);

  console.log("Error:", error?.message || "none");
  console.log("Servicios count:", servs?.length || 0);
  for (const s of (servs || [])) {
    console.log(`  ${s.id.slice(0,8)} "${(s.proveedor||'').slice(0,25)}" doc_id=${s.documento_id?.slice(0,8) || 'null'}`);
  }

  // Check the view
  const { data: v, error: ve } = await db.from("v_abonados_servicios").select("*");
  console.log("\nView error:", ve?.message || "none");
  console.log("View rows:", v?.length || 0);
  for (const r of (v || [])) {
    console.log(`  servicio=${r.servicio_id?.slice(0,8)} total=${r.total_abonado}`);
  }
}

main();
