import type { Pagador } from "@/lib/types/cobros";

export function getPaymentPlazos(pagador: Pagador, globalPlazos: any[]): any[] {
  let list = (pagador as any).plazos;
  if (!list || !Array.isArray(list) || list.length === 0) list = globalPlazos;
  if (!list || !Array.isArray(list)) return [];
  return list.filter((p: any) => !p.tipo || p.tipo === "pago");
}

export function getPlazoDetail(
  pagador: Pagador,
  globalPlazos: any[],
  plazoIndex: number
): { color: string; tooltip: string } {
  const paymentPlazos = getPaymentPlazos(pagador, globalPlazos);
  if (paymentPlazos.length === 0) return { color: "gray", tooltip: "Sin plazos de pago" };

  const sorted = [...paymentPlazos].sort((a, b) => {
    if (a.fecha && b.fecha) return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    return 0;
  });

  const importeAbonado = Number(pagador.importe_abonado || 0);
  let cumulative = 0;

  for (let i = 0; i < sorted.length; i++) {
    const plazoImporte = Number(sorted[i].importe || 0);
    cumulative += plazoImporte;
    const previousCumulative = cumulative - plazoImporte;

    if (i === plazoIndex) {
      const desc = sorted[i].descripcion || `Plazo ${i + 1}`;
      if (importeAbonado >= cumulative) {
        return { color: "green", tooltip: `${desc}: ${plazoImporte} € de ${plazoImporte} € (Completado)` };
      } else if (importeAbonado <= previousCumulative) {
        return { color: "gray", tooltip: `${desc}: 0 € de ${plazoImporte} € (Pendiente)` };
      } else {
        const parcial = importeAbonado - previousCumulative;
        return { color: "orange", tooltip: `${desc}: ${parcial} € de ${plazoImporte} € (Parcial)` };
      }
    }
  }

  return { color: "gray", tooltip: "Sin datos de plazo" };
}
