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
  if (!key) { console.error("No key"); return; }
  const db = createClient(agency.supabase_url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  const { data, error } = await db
    .from("config_cuentas_contables")
    .select("id, codigo, descripcion, tipo, permite_apuntes")
    .order("codigo", { ascending: true });

  console.log("Error:", error?.message || "none");
  console.log("Rows:", data?.length || 0);
  if (data) {
    for (const r of data) {
      console.log(`  ${r.codigo} ${r.descripcion?.slice(0,40)} tipo=${r.tipo} apuntes=${r.permite_apuntes}`);
    }
  }
}

main();
