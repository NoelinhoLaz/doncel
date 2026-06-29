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
  const supabase = createClient(agency.supabase_url, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  const sql = `
    SELECT
      cmb.match_metadatos->>'proveedor_nombre' AS proveedor,
      cmb.match_metadatos->>'documento_id' AS documento_id,
      cmb.match_metadatos->>'expediente_numero' AS exp_numero,
      cm.importe_total,
      cm.created_at::date AS fecha
    FROM contabilidad_movimientos cm
    JOIN contabilidad_movimientos_banco cmb ON cmb.id = cm.movimiento_banco_id
    WHERE cm.tipo = 'pago'
      AND cm.estado = 'confirmado'
      AND cmb.match_metadatos->>'proveedor_nombre' ILIKE '%HOTEL OR BLANC%'
    ORDER BY cm.created_at DESC;
  `;

  const { data: rows, error } = await supabase.rpc("exec_sql", { sql }).maybeSingle();
  if (error) {
    console.log("Error ejecutando SQL: intentando directamente...");
    // Try via raw query
    const { data: d1 } = await supabase
      .from("contabilidad_movimientos")
      .select("importe_total, created_at, movimiento_banco_id")
      .eq("tipo", "pago")
      .eq("estado", "confirmado");

    console.log(`Total movimientos: ${d1?.length || 0}`);
    
    let totalHotel = 0;
    for (const m of (d1 || [])) {
      const { data: b } = await supabase
        .from("contabilidad_movimientos_banco")
        .select("match_metadatos")
        .eq("id", m.movimiento_banco_id)
        .maybeSingle();
      
      if (b?.match_metadatos?.proveedor_nombre?.toUpperCase().includes("HOTEL OR BLANC")) {
        console.log(`  ${m.created_at?.slice(0,10)} ${m.importe_total}€`);
        totalHotel += Number(m.importe_total);
      }
    }
    console.log(`\nTotal pagado a HOTEL OR BLANC: ${totalHotel}€`);
  }
}

main();
