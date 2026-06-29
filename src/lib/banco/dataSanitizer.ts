export async function sanitizeDocumentStates(agencyDb: any) {
  const { data: todosLosDocs, error: errDocs } = await agencyDb
    .from("operativa_documentos_proveedor")
    .select("id, total_documento, importe_pagado, estado_pago");

  if (errDocs || !todosLosDocs) return;

  const { data: todosLosPagos, error: errPagos } = await agencyDb
    .from("operativa_documentos_pagos")
    .select("documento_id, importe, movimiento_banco_id");

  if (errPagos || !todosLosPagos) return;

  const pagosPorDoc = new Map<string, Array<{ importe: number; movimiento_banco_id: string | null }>>();
  todosLosPagos.forEach((p: any) => {
    pagosPorDoc.set(p.documento_id, (pagosPorDoc.get(p.documento_id) || []).concat([{ importe: Number(p.importe || 0), movimiento_banco_id: p.movimiento_banco_id }]));
  });

  for (const doc of todosLosDocs) {
    const pagosDoc = pagosPorDoc.get(doc.id) || [];
    const realAbonado = pagosDoc.reduce((sum, pago) => pago.movimiento_banco_id ? sum + pago.importe : sum, 0);
    const realEstado = realAbonado >= Number(doc.total_documento || 0)
      ? "PAGADO"
      : realAbonado > 0
        ? "PARCIAL"
        : "PENDIENTE";

    if (Number(doc.importe_pagado || 0) !== realAbonado || doc.estado_pago !== realEstado) {
      await agencyDb
        .from("operativa_documentos_proveedor")
        .update({ importe_pagado: realAbonado, estado_pago: realEstado, updated_at: new Date().toISOString() })
        .eq("id", doc.id);
    }
  }
}
