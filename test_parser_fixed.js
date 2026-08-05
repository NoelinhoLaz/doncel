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

let pagosExtraidos = 0;

for (let i = 0; i < gruposProveedor.length; i++) {
  const grupo = gruposProveedor[i];
  const nivel2 = grupo?.FormattedAreaPair;
  if (!nivel2) continue;

  const gruposNivel3 = asArray(nivel2.FormattedAreaPair).filter((g) => g?.["@_Level"] === "3");

  for (let j = 0; j < gruposNivel3.length; j++) {
    const g3 = gruposNivel3[j];
    
    // NUEVA LÓGICA: buscar Level 4 con Type="Details" dentro de g3.FormattedAreaPair
    const detallesAreas = asArray(g3?.FormattedAreaPair).filter((g) => g?.["@_Level"] === "4" && g?.["@_Type"] === "Details");

    for (let d = 0; d < detallesAreas.length; d++) {
      const detailsAreaPair = detallesAreas[d];
      const detailsArea = detailsAreaPair?.FormattedArea || detailsAreaPair;
      const sections = asArray(detailsArea?.FormattedSections?.FormattedSection);

      for (const section of sections) {
        const fields = fieldsByObjectName(section?.FormattedReportObjects?.FormattedReportObject);
        if (!fields["Documento1"]) continue;

        pagosExtraidos++;
        if (fields["Apunte1"] === "00116463" || fields["Apunte1"] === "00116464") {
          console.log(`✓ ENCONTRADO: ${fields["Apunte1"]} - ${fields["NombrePasajero1"]} - ${fields["ImportePendiente1"]}`);
        }
      }
    }
  }
}

console.log(`\n=== TOTAL PAGOS EXTRAÍDOS: ${pagosExtraidos} ===`);
