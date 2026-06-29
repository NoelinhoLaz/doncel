#!/usr/bin/env node
/**
 * Uso: ANON_KEY="eyJhbGci..." node scripts/encrypt_anon_key.js
 *
 * Lee ENCRYPTION_KEY de .env.local y cifra la anon key de Supabase
 * con AES-256-GCM (mismo algoritmo que src/lib/encryption.ts).
 *
 * Salida: el UPDATE SQL listo para pegar en el admin DB.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Leer .env.local ────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
const envVars = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const ENCRYPTION_KEY = envVars.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.error('ERROR: ENCRYPTION_KEY no encontrada en .env.local');
  process.exit(1);
}

const ANON_KEY = process.env.ANON_KEY;
if (!ANON_KEY) {
  console.error('ERROR: pasa la anon key así:  ANON_KEY="eyJhbGci..." node scripts/encrypt_anon_key.js');
  process.exit(1);
}

// ── Cifrar ─────────────────────────────────────────────────────────────────────
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

let enc = cipher.update(ANON_KEY, 'utf8', 'hex');
enc += cipher.final('hex');
const tag = cipher.getAuthTag().toString('hex');
const ivHex = iv.toString('hex');

// ── Output ─────────────────────────────────────────────────────────────────────
console.log('\n✅ Valores cifrados:\n');
console.log(`  enc: ${enc}`);
console.log(`  iv:  ${ivHex}`);
console.log(`  tag: ${tag}`);
console.log('\n── SQL para el admin DB ──────────────────────────────────────────\n');
console.log(`UPDATE public.agencias SET`);
console.log(`  supabase_anon_key_enc = '${enc}',`);
console.log(`  supabase_anon_key_iv  = '${ivHex}',`);
console.log(`  supabase_anon_key_tag = '${tag}'`);
console.log(`WHERE id = 'TU_AGENCIA_UUID';`);
console.log('');
