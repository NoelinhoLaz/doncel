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
const gruposProveedor = asArray(nivel0.FormattedAreaPair).filter((g) => g?.["@_Level"] === "1");

console.log('Buscando apuntes 00116463 y 00116464...\n');

for (let i = 0; i < gruposProveedor.length; i++) {
  const grupo = gruposProveedor[i];
  const nivel2 = grupo?.FormattedAreaPair;
  if (!nivel2) continue;

  const gruposNivel3 = asArray(nivel2.FormattedAreaPair).filter((g) => g?.["@_Level"] === "3");

  for (let j = 0; j < gruposNivel3.length; j++) {
    const g3 = gruposNivel3[j];
    const detailsArea = g3?.FormattedAreaPair?.FormattedArea;
    const sections = asArray(detailsArea?.FormattedSections?.FormattedSection);

    for (let k = 0; k < sections.length; k++) {
      const section = sections[k];
      const fields = fieldsByObjectName(section?.FormattedReportObjects?.FormattedReportObject);
      
      if (fields["Apunte1"] === "00116463" || fields["Apunte1"] === "00116464") {
        console.log(`\n✓ ENCONTRADO: ${fields["Apunte1"]}`);
        console.log(`  Documento1: "${fields["Documento1"]}"`);
        console.log(`  Tiene Documento1: ${!!fields["Documento1"]}`);
        console.log(`  NombrePasajero1: ${fields["NombrePasajero1"]}`);
        console.log(`  ImportePendiente1: ${fields["ImportePendiente1"]}`);
        console.log(`  FechaDoc1: ${fields["FechaDoc1"]}`);
        
        // Ver todos los campos
        console.log('  Todos los campos:');
        Object.keys(fields).forEach(k => {
          console.log(`    ${k}: "${fields[k]}"`);
        });
      }
    }
  }
}
