import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Sin esto, fast-xml-parser convierte valores numéricos-con-ceros-a-la-izquierda
  // (ej. "001260304") a number, perdiendo los ceros. Mantenemos todo como texto y
  // parseamos explícitamente donde hace falta un número real (importes).
  parseTagValue: false,
});

export interface OfiviajePago {
  documento: string;
  fechaVencto: string;
  fechaDoc: string;
  referenciaProvCte: string;
  documentoCobroPago: string;
  tipoOperacion: string;
  cuentaTesoreria: string;
  nombrePasajero: string;
  apunte: string;
  importePendiente: number;
  situacion: string;
  proveedorNombre: string;
  proveedorCuentaContable: string;
}

// Convierte un importe en formato español ("-1.018,50") a number. Se usa en
// vez de fieldsByObjectName()+parseFloat() para los importes porque el campo
// "Value" del XML pierde precisión en números grandes: Crystal Reports lo
// exporta en notación científica con pocas cifras significativas (ej.
// "-1.02E+003" en vez de -1018.50), mientras que "FormattedValue" conserva
// el valor exacto tal como se muestra en pantalla.
function parseImporteEspanol(texto: string): number {
  if (!texto) return 0;
  const normalizado = texto.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalizado);
  return isNaN(n) ? 0 : n;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function fieldsByObjectName(reportObjects: any): Record<string, string> {
  const objects = asArray(reportObjects);
  const result: Record<string, string> = {};
  for (const obj of objects) {
    const name = obj?.ObjectName;
    if (!name) continue;
    // Con parseTagValue:false, tanto Value como FormattedValue llegan como texto
    // sin perder ceros a la izquierda. Value es el más "técnico" (para importes,
    // sin separador de miles); se usa como preferido, con fallback a FormattedValue.
    const value = obj?.Value ?? obj?.TextValue ?? obj?.FormattedValue;
    if (value !== undefined) result[name] = String(value);
  }
  return result;
}

// Igual que fieldsByObjectName pero siempre devuelve FormattedValue, nunca
// Value — necesario para importes, donde Value puede venir en notación
// científica con precisión perdida en números grandes (ver parseImporteEspanol).
function formattedValuesByObjectName(reportObjects: any): Record<string, string> {
  const objects = asArray(reportObjects);
  const result: Record<string, string> = {};
  for (const obj of objects) {
    const name = obj?.ObjectName;
    if (!name) continue;
    const value = obj?.FormattedValue;
    if (value !== undefined) result[name] = String(value);
  }
  return result;
}

/**
 * Parsea un XML de "Situación de Pagos" de OFIviaje (formato Crystal Reports
 * FormattedReport) y devuelve la lista plana de pagos individuales (nivel Details),
 * cada uno con el nombre del proveedor heredado del grupo (Level 1) al que pertenece.
 */
export function parseOfiviajePagosXml(xml: string): OfiviajePago[] {
  const doc = parser.parse(xml);
  // Level 0 = <FormattedAreaPair Level="0" Type="Report"> (documento completo)
  const nivel0 = doc?.FormattedReport?.FormattedAreaPair;
  if (!nivel0) return [];

  const pagos: OfiviajePago[] = [];

  // Level 1 = agrupación por proveedor (CuentaContable + Nombre), hijo directo de Level 0
  const gruposProveedor = asArray(nivel0.FormattedAreaPair).filter((g: any) => g?.["@_Level"] === "1");

  for (const grupo of gruposProveedor) {
    // grupo.FormattedArea puede ser un único objeto o un array (Header + Footer(s)
    // hermanos bajo el mismo Level 1): seleccionar explícitamente el de Type="Header".
    const areaHeader = asArray(grupo?.FormattedArea).find((a: any) => a?.["@_Type"] === "Header");
    const headerFields = fieldsByObjectName(
      areaHeader?.FormattedSections?.FormattedSection?.FormattedReportObjects?.FormattedReportObject
    );
    const proveedorNombre = headerFields["Nombre1"] || "";
    const proveedorCuentaContable = headerFields["CuentaContable1"] || "";

    // Level 2 -> Level 3 (uno por vencimiento) -> Level 4 (Details)
    const nivel2 = grupo?.FormattedAreaPair;
    if (!nivel2) continue;
    const gruposNivel3 = asArray(nivel2.FormattedAreaPair).filter((g: any) => g?.["@_Level"] === "3");

    for (const g3 of gruposNivel3) {
      const detailsArea = g3?.FormattedAreaPair?.FormattedArea;
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

  return pagos;
}

export interface OfiviajeCobro {
  factura: string;
  fechaMovimiento: string;
  nombrePagador: string;
  conceptoMovimiento: string;
  importeCobro: number;
}

/**
 * Parsea un XML de "Liquidación de Cajas" de OFIviaje (formato Crystal Reports
 * FormattedReport, fichero TSRLiquidacionCajas_*) y devuelve solo los cobros
 * (entradas) del grupo "Transferencias", que son los únicos que llegan al
 * banco como tales (metálico y tarjeta se cobran en caja/TPV, no aparecen
 * como movimiento bancario individual).
 */
export function parseOfiviajeCobrosXml(xml: string): OfiviajeCobro[] {
  const doc = parser.parse(xml);
  // Level 0 = <FormattedAreaPair Level="0" Type="Report"> (documento completo)
  const nivel0 = doc?.FormattedReport?.FormattedAreaPair;
  if (!nivel0) return [];

  const cobros: OfiviajeCobro[] = [];

  // Level 1 = grupo raíz (envuelve cada Level 2); Level 2 = agrupación por
  // medio de pago (TituloGrupo: "Metálico (Euro)", "Tarjetas (Euro)",
  // "Transferencias (Euro)"). Solo interesa esta última.
  const gruposNivel1 = asArray(nivel0.FormattedAreaPair).filter((g: any) => g?.["@_Level"] === "1");

  for (const g1 of gruposNivel1) {
    const gruposMedioPago = asArray(g1?.FormattedAreaPair).filter((g: any) => g?.["@_Level"] === "2");

    for (const grupo of gruposMedioPago) {
      const areaHeader = asArray(grupo?.FormattedArea).find((a: any) => a?.["@_Type"] === "Header");
      const headerFields = fieldsByObjectName(
        areaHeader?.FormattedSections?.FormattedSection?.FormattedReportObjects?.FormattedReportObject
      );
      const tituloGrupo = headerFields["TituloGrupo1"] || "";
      if (!tituloGrupo.toLowerCase().includes("transferencia")) continue;

      // Cada fila de detalle es su propio <FormattedAreaPair Level="3" Type="Details">
      // hermano (no un único bloque con varias FormattedSection): hay que
      // recogerlos todos, no solo el primero.
      const detallesAreas = asArray(grupo?.FormattedAreaPair).filter((g: any) => g?.["@_Level"] === "3");

      for (const detallesArea of detallesAreas) {
        const sections = asArray(detallesArea?.FormattedArea?.FormattedSections?.FormattedSection);

        for (const section of sections) {
          const fields = fieldsByObjectName(section?.FormattedReportObjects?.FormattedReportObject);
          const importeCobro = fields["ImporteCobro1"];
          if (importeCobro === undefined || importeCobro === "") continue; // fila de salida (ImportePago), no interesa
          const formattedFields = formattedValuesByObjectName(section?.FormattedReportObjects?.FormattedReportObject);

          cobros.push({
            factura: fields["Factura1"] || "",
            fechaMovimiento: fields["FechaMovimiento1"] || "",
            nombrePagador: fields["NombrePagador1"] || "",
            conceptoMovimiento: fields["ConceptoMovimiento1"] || "",
            importeCobro: parseImporteEspanol(formattedFields["ImporteCobro1"] || ""),
          });
        }
      }
    }
  }

  return cobros;
}

// Convierte "dd/mm/yyyy" (formato OFIviaje) a "yyyy-mm-dd" (formato BD).
export function parseOfiviajeFecha(fecha: string): string | null {
  const match = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

// Convierte "dd/mm/yy" (formato del fichero de Liquidación de Cajas) a "yyyy-mm-dd".
export function parseOfiviajeFechaCorta(fecha: string): string | null {
  const match = fecha.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const [, dd, mm, yy] = match;
  return `20${yy}-${mm}-${dd}`;
}
