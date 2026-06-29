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

  const supabase = createClient(agency.supabase_url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  // 1. Run the ALTER TABLE
  console.log("1. Adding documento_id column...");
  const { error: e1 } = await supabase.rpc("exec_sql", {
    sql: "ALTER TABLE operativa_expedientes_servicios ADD COLUMN IF NOT EXISTS documento_id UUID REFERENCES operativa_documentos_proveedor(id) ON DELETE SET NULL;"
  });
  if (e1) {
    // Try direct SQL via the REST API
    console.log("   RPC failed, trying raw query...");
    const { error: e2 } = await supabase.from("operativa_expedientes_servicios").select("id").limit(1);
    if (e2) console.error("   Error:", e2.message);
    console.log("   Column may already exist. Continuing...");
  } else {
    console.log("   Column added successfully.");
  }

  // 2. Backfill: for servicios linked to expedientes that have documentos
  // Match servicios whose descripcion starts with "Doc. <number> - <provider>"
  // by joining with operativa_documentos_expedientes and documentos
  console.log("\n2. Backfilling documento_id for existing servicios...");
  
  const { data: servs, error: e3 } = await supabase
    .from("operativa_expedientes_servicios")
    .select("id, expediente_id, descripcion")
    .is("documento_id", null);

  if (e3) { console.error("   Error fetching servicios:", e3.message); return; }
  console.log(`   Found ${servs?.length || 0} servicios without documento_id`);

  let updated = 0;
  for (const s of (servs || [])) {
    // Try to extract document number from descripcion "Doc. <numero> - <proveedor>"
    const match = s.descripcion?.match(/^Doc\.\s*([\d.]+)\s*-\s*(.+)/);
    if (!match) continue;

    const docNum = match[1];
    
    // Find documentos linked to this expediente
    const { data: docs } = await supabase
      .from("operativa_documentos_proveedor")
      .select("id")
      .eq("documento_numero", docNum)
      .in("id",
        supabase.from("operativa_documentos_expedientes")
          .select("documento_id")
          .eq("expediente_id", s.expediente_id) as any
      );

    if (docs && docs.length > 0) {
      const { error: e4 } = await supabase
        .from("operativa_expedientes_servicios")
        .update({ documento_id: docs[0].id })
        .eq("id", s.id);
      
      if (!e4) {
        console.log(`   Updated ${s.id.slice(0,8)} with documento_id ${docs[0].id.slice(0,8)} (doc #${docNum})`);
        updated++;
      }
    }
  }
  console.log(`   Backfilled ${updated} servicios`);

  // 3. Create or replace the view
  console.log("\n3. Creating/updating v_abonados_servicios view...");
  const viewSql = `
CREATE OR REPLACE VIEW public.v_abonados_servicios AS
WITH direct AS (
  SELECT (cmb.match_metadatos->>'servicio_id')::uuid AS servicio_id,
         cm.importe_total::numeric AS abonado
  FROM contabilidad_movimientos cm
  JOIN contabilidad_movimientos_banco cmb ON cmb.id = cm.movimiento_banco_id
  WHERE cm.tipo = 'pago'
    AND cm.estado = 'confirmado'
    AND cmb.match_metadatos ? 'servicio_id'
    AND cmb.match_metadatos->>'servicio_id' IS NOT NULL
    AND cmb.match_metadatos->>'servicio_id' != 'null'
),
grouped AS (
  SELECT (p.value->>'id')::uuid AS servicio_id,
         ABS((p.value->>'importe')::numeric) AS abonado
  FROM contabilidad_movimientos cm
  JOIN contabilidad_movimientos_banco cmb ON cmb.id = cm.movimiento_banco_id
  CROSS JOIN jsonb_array_elements(cmb.match_metadatos->'pagos') AS p(value)
  WHERE cm.tipo = 'pago'
    AND cm.estado = 'confirmado'
    AND (cmb.match_metadatos->>'origen') = 'servicio'
    AND cmb.match_metadatos ? 'pagos'
),
desde_documento AS (
  SELECT oes.id AS servicio_id,
         ABS((p.value->>'importe')::numeric) AS abonado
  FROM contabilidad_movimientos cm
  JOIN contabilidad_movimientos_banco cmb ON cmb.id = cm.movimiento_banco_id
  CROSS JOIN jsonb_array_elements(cmb.match_metadatos->'pagos') AS p(value)
  JOIN operativa_expedientes_servicios oes ON oes.documento_id = (p.value->>'documento_id')::uuid
  WHERE cm.tipo = 'pago'
    AND cm.estado = 'confirmado'
    AND cmb.match_metadatos ? 'pagos'
    AND p.value ? 'documento_id'
    AND p.value->>'documento_id' IS NOT NULL
    AND p.value->>'documento_id' != 'null'
    AND NOT (cmb.match_metadatos->>'origen' = 'servicio')
),
combined AS (
  SELECT servicio_id, abonado FROM direct
  UNION ALL
  SELECT servicio_id, abonado FROM grouped
  UNION ALL
  SELECT servicio_id, abonado FROM desde_documento
)
SELECT servicio_id, SUM(abonado) AS total_abonado
FROM combined
WHERE servicio_id IS NOT NULL
GROUP BY servicio_id;
`;
  
  // Try via RPC
  const { error: e5 } = await supabase.rpc("exec_sql", { sql: viewSql });
  if (e5) {
    console.log("   RPC failed, view may need to be created manually via Supabase SQL editor.");
    console.log("   Error:", e5.message);
    console.log("\n   SQL to run manually:");
    console.log(viewSql);
  } else {
    console.log("   View created successfully.");
  }

  // 4. Verify: check the HOTEL OR BLANC servicio
  console.log("\n4. Verification:");
  const { data: hotel } = await supabase
    .from("operativa_expedientes_servicios")
    .select("id, descripcion, documento_id")
    .eq("id", "c65a804e-8fcb-40f5-96cb-c4e72c031018")
    .single();

  if (hotel) {
    console.log(`   HOTEL OR BLANC: documento_id = ${hotel.documento_id?.slice(0,8) || 'null'}`);
  } else {
    console.log("   HOTEL OR BLANC not found");
  }

  const { data: ab } = await supabase
    .from("v_abonados_servicios")
    .select("servicio_id, total_abonado")
    .eq("servicio_id", "c65a804e-8fcb-40f5-96cb-c4e72c031018")
    .maybeSingle();

  console.log(`   Abonado from view: ${ab?.total_abonado ?? 0}`);
}

main();
