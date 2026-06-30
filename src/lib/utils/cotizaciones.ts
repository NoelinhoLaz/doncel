import { getFullSchema } from "@/lib/serviceFormSchemas";

export function computeLineTotals(line: any): { total_neto: number; total_pvp: number } {
  const rawPlazas = line.plazas != null ? Number(line.plazas) : 0;
  const rawNoches = line.noches != null ? Number(line.noches) : 0;

  const plazas = rawPlazas === 0 ? 1 : rawPlazas;
  const noches = rawNoches === 0 ? 1 : rawNoches;

  const neto = Number(line.neto ?? 0);
  const pvp = Number(line.pvp ?? 0);
  return {
    total_neto: neto * plazas * noches,
    total_pvp: pvp * plazas * noches,
  };
}

export function getTipoSchema(item: any, tiposMap: Record<string, any>): any[] {
  const tipo = item?.config_tipos_servicios || tiposMap[item?.tipo];
  const schema = tipo?.contenido;
  let customRows: any[] = [];
  if (Array.isArray(schema)) {
    if (schema.length > 0 && Array.isArray(schema[0]?.columnas)) {
      customRows = schema;
    } else {
      customRows = schema.map((field: any, idx: number) => ({
        fila_id: `row_${idx + 1}`,
        columnas: [{
          ...field,
          ancho: field.ancho || 12,
          origen: field.origen || 'jsonb_detalles',
          propiedades: field.propiedades || field,
        }],
      }));
    }
  }
  return [...getFullSchema(tipo), ...customRows];
}
