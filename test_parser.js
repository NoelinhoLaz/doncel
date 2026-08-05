const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

const xml = fs.readFileSync('/Users/noellazueng/Downloads/TSRLstVPagos_9_VDoncel3_20260730_122052.xml', 'utf8');
const doc = parser.parse(xml);

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

const nivel0 = doc?.FormattedReport?.FormattedAreaPair;
if (!nivel0) {
  console.log('No FormattedAreaPair found at level 0');
  process.exit(1);
}

console.log('=== ESTRUCTURA DEL XML ===\n');

const gruposProveedor = asArray(nivel0.FormattedAreaPair).filter((g) => g?.["@_Level"] === "1");
console.log(`Grupos de proveedor (Level 1): ${gruposProveedor.length}`);

let pagosExtraidos = 0;

for (let i = 0; i < gruposProveedor.length; i++) {
  const grupo = gruposProveedor[i];
  const areaHeader = asArray(grupo?.FormattedArea).find((a) => a?.["@_Type"] === "Header");
  const headerFields = fieldsByObjectName(
    areaHeader?.FormattedSections?.FormattedSection?.FormattedReportObjects?.FormattedReportObject
  );
  const proveedorNombre = headerFields["Nombre1"] || "sin nombre";

  console.log(`\n[Proveedor ${i + 1}] ${proveedorNombre}`);

  // Level 2 -> Level 3 (uno por vencimiento) -> Level 4 (Details)
  const nivel2 = grupo?.FormattedAreaPair;
  if (!nivel2) {
    console.log('  - Sin FormattedAreaPair (nivel 2)');
    continue;
  }

  const gruposNivel3 = asArray(nivel2.FormattedAreaPair).filter((g) => g?.["@_Level"] === "3");
  console.log(`  - Grupos Level 3: ${gruposNivel3.length}`);

  for (let j = 0; j < gruposNivel3.length; j++) {
    const g3 = gruposNivel3[j];
    const detailsArea = g3?.FormattedAreaPair?.FormattedArea;
    const sections = asArray(detailsArea?.FormattedSections?.FormattedSection);

    console.log(`    [Vencimiento ${j + 1}] Sections: ${sections.length}`);

    for (let k = 0; k < sections.length; k++) {
      const section = sections[k];
      const fields = fieldsByObjectName(section?.FormattedReportObjects?.FormattedReportObject);
      if (!fields["Documento1"]) {
        console.log(`      Section ${k}: sin Documento1 (omitido)`);
        continue;
      }

      console.log(
        `      Section ${k}: ${fields["Documento1"]} | ${fields["Apunte1"]} | ${fields["NombrePasajero1"]} | ${fields["ImportePendiente1"]}`
      );
      pagosExtraidos++;
    }
  }
}

console.log(`\n=== TOTAL PAGOS EXTRAÍDOS: ${pagosExtraidos} ===`);
