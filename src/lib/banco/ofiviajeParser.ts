import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
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
    const value = obj?.Value ?? obj?.TextValue ?? obj?.FormattedValue;
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
    const headerFields = fieldsByObjectName(
      grupo?.FormattedArea?.FormattedSections?.FormattedSection?.FormattedReportObjects
        ?.FormattedReportObject
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
          importePendiente: parseFloat(fields["ImportePendiente1"] || "0"),
          situacion: fields["Situac1"] || "",
          proveedorNombre,
          proveedorCuentaContable,
        });
      }
    }
  }

  return pagos;
}

// Convierte "dd/mm/yyyy" (formato OFIviaje) a "yyyy-mm-dd" (formato BD).
export function parseOfiviajeFecha(fecha: string): string | null {
  const match = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}
