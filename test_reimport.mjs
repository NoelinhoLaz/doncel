import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

function parseImporteEspanol(texto) {
  if (!texto) return 0;
  const normalizado = texto.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalizado);
  return isNaN(n) ? 0 : n;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function fieldsByObjectName(reportObjects) {
  const objects = asArray(reportObjects);
  const result = {};
  for (const obj of objects) {
    const name = obj?.ObjectName;
    if (!name) continue;
    const value = obj?.Value ?? obj?.TextValue ?? obj?.FormattedValue;
    if (value !== undefined) result[name] = String(value);
  }
  return result;
}

function formattedValuesByObjectName(reportObjects) {
  const objects = asArray(reportObjects);
  const result = {};
  for (const obj of objects) {
    const name = obj?.ObjectName;
    if (!name) continue;
    const value = obj?.FormattedValue;
    if (value !== undefined) result[name] = String(value);
  }
  return result;
}

function parseOfiviajeFecha(fecha) {
  const match = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function parseOfiviajePagosXml(xml) {
  const doc = parser.parse(xml);
  const nivel0 = doc?.FormattedReport?.FormattedAreaPair;
  if (!nivel0) return [];

  const pagos = [];
  const gruposProveedor = asArray(nivel0.FormattedAreaPair).filter((g) => g?.["@_Level"] === "1");

  for (const grupo of gruposProveedor) {
    const areaHeader = asArray(grupo?.FormattedArea).find((a) => a?.["@_Type"] === "Header");
    const headerFields = fieldsByObjectName(
      areaHeader?.FormattedSections?.FormattedSection?.FormattedReportObjects?.FormattedReportObject
    );
    const proveedorNombre = headerFields["Nombre1"] || "";
    const proveedorCuentaContable = headerFields["CuentaContable1"] || "";

    const nivel2 = grupo?.FormattedAreaPair;
    if (!nivel2) continue;
    const gruposNivel3 = asArray(nivel2.FormattedAreaPair).filter((g) => g?.["@_Level"] === "3");

    for (const g3 of gruposNivel3) {
      // Soportar ambas estructuras: Level 3 Type="Group" con Level 4 Details, o Level 3 directo
      const detallesAreas = asArray(g3?.FormattedAreaPair).filter((g) => g?.["@_Level"] === "4" && g?.["@_Type"] === "Details");
      const detallesAFiltrar = detallesAreas.length > 0 ? detallesAreas : asArray(g3?.FormattedAreaPair).filter((g) => g?.["@_Type"] === "Details");

      for (const detailsAreaPair of detallesAFiltrar) {
        const detailsArea = detailsAreaPair?.FormattedArea || detailsAreaPair;
        const sections = asArray(detailsArea?.FormattedSections?.FormattedSection);
        for (const section of sections) {
          const fields = fieldsByObjectName(section?.FormattedReportObjects?.FormattedReportObject);
          if (!fields["Documento1"]) continue;
          const formattedFields = formattedValuesByObjectName(section?.FormattedReportObjects?.FormattedReportObject);

          pagos.push({
            documento: fields["Documento1"] || "",
            fechaVencto: fields["FechaVencto1"] || "",
            fechaDoc: fields["FechaDoc1"] || "",
            referenciaProvCte: fields["ReferenciaProvCte1"] || "",
            documentoCobroPago: fields["DocumentoCobroPago1"] || "",
            tipoOperacion: fields["TipoOperacion1"] || "",
            cuentaTesoreria: fields["CuentaTesoreria1"] || "",
            nombrePasajero: fields["NombrePasajero1"] || "",
            apunte: fields["Apunte1"] || "",
            importePendiente: parseImporteEspanol(formattedFields["ImportePendiente1"] || ""),
            situacion: fields["Situac1"] || "",
            proveedorNombre,
            proveedorCuentaContable,
          });
        }
      }
    }
  }

  return pagos;
}

// Main
const envContent = fs.readFileSync('.env.local', 'utf8');
const encKeyMatch = envContent.match(/ENCRYPTION_KEY=([a-f0-9]+)/);
const encryptionKey = encKeyMatch ? encKeyMatch[1] : null;

function decrypt(encryptedData, iv, authTag) {
  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  const encBuffer = Buffer.from(encryptedData, 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');
  const tagBuffer = Buffer.from(authTag, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  let decrypted = decipher.update(encBuffer, null, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const adminUrl = 'https://zaopmxkbjtdxjsdyeztx.supabase.co';
const adminKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphb3BteGtianRkeGpzZHllenR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ5MjIxMSwiZXhwIjoyMDg1MDY4MjExfQ.9k1NSfHTWXm7skN29OKEyzq2d1X-bNoTLUR1bTb95Rk';

const admin = createClient(adminUrl, adminKey);

(async () => {
  try {
    console.log('Cargando XML...');
    const xmlPath = '/Users/noellazueng/Downloads/TSRLstVPagos_9_VDoncel3_20260730_122052.xml';
    const xml = fs.readFileSync(xmlPath, 'utf8');

    console.log('Parseando XML con parser arreglado...');
    const pagos = parseOfiviajePagosXml(xml);
    console.log(`✓ Extraídos ${pagos.length} pagos`);

    // Verificar apuntes
    const apuntes00116463 = pagos.find(p => p.apunte === '00116463');
    const apuntes00116464 = pagos.find(p => p.apunte === '00116464');
    console.log(`✓ Apunte 00116463: ${apuntes00116463 ? 'SÍ' : 'NO'}`);
    console.log(`✓ Apunte 00116464: ${apuntes00116464 ? 'SÍ' : 'NO'}`);

    // Conectar a BD
    console.log('\nConectando a BD...');
    const { data: agencias } = await admin
      .from('agencias')
      .select('id, supabase_url, supabase_service_role_key_enc, iv, auth_tag')
      .eq('dominio', 'www.viajesdoncel.com')
      .single();

    const serviceRoleKey = decrypt(
      agencias.supabase_service_role_key_enc,
      agencias.iv,
      agencias.auth_tag
    );

    const agencyDb = createClient(agencias.supabase_url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    // Limpiar registros viejos del archivo
    console.log('Limpiando registros antiguos del archivo...');
    const { error: cleanError } = await agencyDb
      .from('ofi_pagos')
      .delete()
      .eq('drive_file_nombre', 'TSRLstVPagos_9_VDoncel3_20260730_122052.xml');

    if (cleanError) {
      console.error('Error limpiando:', cleanError.message);
    } else {
      console.log('✓ Limpieza completada');
    }

    // Obtener primera oficina
    const { data: oficinas } = await agencyDb
      .from('config_oficinas')
      .select('id')
      .limit(1);

    const oficinaId = oficinas?.[0]?.id;

    // Preparar rows
    const filas = pagos.map((p) => ({
      oficina_id: oficinaId,
      drive_file_id: 'manual_reimport_20260805',
      drive_file_nombre: 'TSRLstVPagos_9_VDoncel3_20260730_122052.xml',
      documento: p.documento,
      fecha_vencto: parseOfiviajeFecha(p.fechaVencto),
      fecha_doc: parseOfiviajeFecha(p.fechaDoc),
      referencia_prov_cte: p.referenciaProvCte || null,
      documento_cobro_pago: p.documentoCobroPago || null,
      tipo_operacion: p.tipoOperacion || null,
      cuenta_tesoreria: p.cuentaTesoreria || null,
      nombre_pasajero: p.nombrePasajero || null,
      apunte: p.apunte || null,
      importe_pendiente: p.importePendiente,
      situacion: p.situacion || null,
      proveedor_nombre: p.proveedorNombre || null,
      proveedor_cuenta_contable: p.proveedorCuentaContable || null,
    }));

    // Insertar
    console.log(`\nInsertando ${filas.length} registros en ofi_pagos...`);
    const { data: insertedData, error: insertError } = await agencyDb
      .from('ofi_pagos')
      .upsert(filas, {
        onConflict: 'oficina_id,documento,apunte',
        ignoreDuplicates: true,
      })
      .select('id');

    if (insertError) {
      console.error('Error inserting:', insertError.message);
      process.exit(1);
    }

    console.log(`✓ Insertados ${insertedData?.length || 0} registros`);

    // Verificar apuntes en BD
    console.log('\nVerificando apuntes en BD...');
    const { data: verificar } = await agencyDb
      .from('ofi_pagos')
      .select('*')
      .in('apunte', ['00116463', '00116464']);

    if (verificar?.length) {
      console.log(`✓ Encontrados ${verificar.length} apuntes:`);
      verificar.forEach(v => {
        console.log(`  - ${v.apunte}: ${v.nombre_pasajero} ${v.importe_pendiente}€`);
      });
    } else {
      console.log('❌ Apuntes no encontrados en BD después de inserción');
    }

  } catch (err) {
    console.error('Exception:', err.message);
    process.exit(1);
  }
  process.exit(0);
})();
