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

  const expId = "1587634d-0f9e-4535-89ad-76fd8de7249c";

  // First, backfill documento_id for HOTEL OR BLANC and VIP CLASS
  console.log("Backfilling documento_id...");
  
  // HOTEL OR BLANC: doc "26.0893" → 1864ab84
  const { error: e1 } = await supabase
    .from("operativa_expedientes_servicios")
    .update({ documento_id: "1864ab84-ef56-43a9-8a76-6da3fc73de41" })
    .eq("id", "c65a804e-8fcb-40f5-96cb-c4e72c031018");
  console.log(`  HOTEL OR BLANC: ${e1 ? 'ERROR: '+e1.message : 'OK'}`);

  // VIP CLASS: doc "13410" → 079a49c4
  const { error: e2 } = await supabase
    .from("operativa_expedientes_servicios")
    .update({ documento_id: "079a49c4-ecaf-438a-8971-c6feb4397c2d" })
    .eq("id", "c50d848a-512f-4c0d-bb00-f4a4f9d9cdee");
  console.log(`  VIP CLASS: ${e2 ? 'ERROR: '+e2.message : 'OK'}`);

  // Now print the corrected SQL to run in Supabase SQL editor
  console.log("\nEjecuta esto en el SQL Editor de Supabase:");
  console.log(`
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
    AND (cmb.match_metadatos->>'origen' IS NULL OR cmb.match_metadatos->>'origen' != 'servicio')
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
`);

  // Verify after running
  console.log("Después de ejecutar el SQL, presiona Enter para verificar...");
  process.stdin.once("data", async () => {
    const { data: v } = await supabase.from("v_abonados_servicios").select("*");
    console.log("View rows:", v?.length || 0);
    for (const r of (v || [])) {
      const { data: s } = await supabase.from("operativa_expedientes_servicios").select("proveedor").eq("id", r.servicio_id).maybeSingle();
      console.log(`  ${s?.proveedor?.slice(0,25)?.padEnd(25) || r.servicio_id?.slice(0,8)} abonado=${r.total_abonado}`);
    }
    process.exit(0);
  });
}

main();
