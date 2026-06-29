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
  if (!agency) { return; }

  const key = decrypt(agency.supabase_service_role_key_enc, agency.iv, agency.auth_tag);
  if (!key) { return; }

  const db = createClient(agency.supabase_url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const expId = "1587634d-0f9e-4535-89ad-76fd8de7249c";

  // Get the HOTEL OR BLANC servicio
  const { data: sv } = await db.from("operativa_expedientes_servicios")
    .select("id, descripcion, condiciones")
    .eq("id", "c65a804e-8fcb-40f5-96cb-c4e72c031018")
    .single();
  console.log("Servicio HOTEL OR BLANC:", JSON.stringify(sv, null, 2));

  // Check what documentos are linked to this expediente
  const { data: docExps } = await db.from("operativa_documentos_expedientes")
    .select("documento_id, es_principal")
    .eq("expediente_id", expId);
  console.log("\nDocumentos vinculados al expediente:", JSON.stringify(docExps, null, 2));

  if (docExps && docExps.length > 0) {
    // Get the documentos info
    const docIds = docExps.map(d => d.documento_id);
    const { data: docs } = await db.from("operativa_documentos_proveedor")
      .select("id, documento_numero, extraccion_json")
      .in("id", docIds);
    console.log("\nDocumentos info:", JSON.stringify(docs, null, 2));
  }

  // Check the pagos in the match_metadatos for ef87ca60
  const { data: banco } = await db.from("contabilidad_movimientos_banco")
    .select("match_metadatos")
    .eq("id", "ef87ca60-d086-4919-9d49-61fc44de0922")
    .single();
  console.log("\nBanco match_metadatos:", JSON.stringify(banco?.match_metadatos, null, 2));
}

main();
