import ExcelJS from "exceljs";
import { getMovimientosBancoSinPaginar, type MovimientosBancoFiltros } from "@/lib/banco/bancoService";

function formatDate(value: string | null) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return d && m && y ? `${d}/${m}/${y}` : value;
}

export async function POST(req: Request) {
  try {
    const filtros = (await req.json()) as MovimientosBancoFiltros;

    const { data } = await getMovimientosBancoSinPaginar(filtros);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Movimientos");

    worksheet.columns = [
      { header: "Fecha operación", key: "fecha_operacion", width: 16 },
      { header: "Fecha valor", key: "fecha_valor", width: 16 },
      { header: "Concepto", key: "concepto_original", width: 60 },
      { header: "Banco", key: "banco", width: 20 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "OFIviaje", key: "ofiviaje", width: 10 },
      { header: "Gasto Finan", key: "gasto_financiero", width: 12 },
      { header: "Importe", key: "importe", width: 14 },
    ];

    for (const mov of data) {
      worksheet.addRow({
        fecha_operacion: formatDate(mov.fecha_operacion),
        fecha_valor: formatDate(mov.fecha_valor),
        concepto_original: mov.concepto_original || "",
        banco: mov.config_cuentas_bancarias?.banco || "",
        estado: mov.estado || "",
        ofiviaje: mov.conciliado_externo ? "Sí" : "",
        gasto_financiero: mov.es_gasto_financiero ? "Sí" : "",
        importe: Number(mov.importe),
      });
    }

    worksheet.getColumn("importe").numFmt = "#,##0.00 €";

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="movimientos_bancarios.xlsx"',
      },
    });
  } catch (err: any) {
    console.error("Error exportando movimientos bancarios:", err);
    return new Response(JSON.stringify({ error: err.message || "Error al exportar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
