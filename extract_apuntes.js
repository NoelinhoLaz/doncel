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

const apuntesParseados = new Set();
const apuntesSinDocumento = [];

for (const grupo of gruposProveedor) {
  const nivel2 = grupo?.FormattedAreaPair;
  if (!nivel2) continue;

  const gruposNivel3 = asArray(nivel2.FormattedAreaPair).filter((g) => g?.["@_Level"] === "3");

  for (const g3 of gruposNivel3) {
    const detailsArea = g3?.FormattedAreaPair?.FormattedArea;
    const sections = asArray(detailsArea?.FormattedSections?.FormattedSection);

    for (const section of sections) {
      const fields = fieldsByObjectName(section?.FormattedReportObjects?.FormattedReportObject);
      if (!fields["Documento1"]) {
        apuntesSinDocumento.push(fields["Apunte1"] || "???");
      } else {
        apuntesParseados.add(fields["Apunte1"]);
      }
    }
  }
}

// Buscar todos los apuntes en el XML crudo
const allApuntesFromXml = new Set();
const apuntesRegex = /<ObjectName>Apunte1<\/ObjectName>\s*<FormattedValue>([^<]+)<\/FormattedValue>/g;
let match;
while ((match = apuntesRegex.exec(xml)) !== null) {
  allApuntesFromXml.add(match[1]);
}

console.log('Total apuntes en XML (raw): ' + allApuntesFromXml.size);
console.log('Total apuntes parseados: ' + apuntesParseados.size);
console.log('\nApuntes SIN Documento1 (' + apuntesSinDocumento.length + '):');
apuntesSinDocumento.forEach(a => console.log('  ' + a));

// Encontrar apuntes en el XML que no fueron parseados
const apuntesFaltantes = [...allApuntesFromXml].filter(a => !apuntesParseados.has(a) && !apuntesSinDocumento.includes(a));
console.log('\nApuntes faltantes del parser: ' + apuntesFaltantes.length);
apuntesFaltantes.forEach(a => console.log('  ' + a));
