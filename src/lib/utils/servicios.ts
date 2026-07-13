// Calcula siempre el total en vivo desde pvp*plazas*noches, sin depender de la columna
// "total" persistida en operativa_expedientes_servicios: esa columna se ha guardado con
// criterios distintos en distintos flujos a lo largo del tiempo (a veces sin noches, a veces
// con un valor manual desconectado de pvp/plazas) y no es una fuente fiable para KPIs/gráficas.
export function getServiceTotal(service: any): number {
  const pvpValue = Number(service.pvp || 0);
  const plazasValue = Number(service.plazas || 1);
  const nochesValue = Number(service.noches || 0) || 1;
  return pvpValue * (plazasValue > 0 ? plazasValue : 1) * nochesValue;
}

export function calculateMargin(pvp: number, neto: number): { margin: number; marginPercent: number } {
  const margin = pvp - neto;
  const marginPercent = pvp > 0 ? Math.round((margin / pvp) * 100) : 0;
  return { margin, marginPercent };
}

export interface Kpis {
  totalCost: number;
  obligatorioCost: number;
  opcionalCost: number;
  obligatorioCount: number;
  opcionalCount: number;
  obligatorioPercent: number;
  opcionalPercent: number;
  obligatorioPagadoCount: number;
  obligatorioParcialCount: number;
  opcionalPagadoCount: number;
  opcionalParcialCount: number;
}

function countPagoEstados(servicios: any[]): { pagado: number; parcial: number } {
  let pagado = 0;
  let parcial = 0;
  for (const s of servicios) {
    const abonado = Number(s.abonado ?? 0);
    const noches = Number(s.noches || 0) || 1;
    const totalPvp = Number(s.pvp || 0) * Number(s.plazas || 1) * noches;
    if (totalPvp > 0 && abonado >= totalPvp) pagado++;
    else if (abonado > 0) parcial++;
  }
  return { pagado, parcial };
}

export function calculateKpis(servicios: any[]): Kpis {
  const totalCost = servicios.reduce((sum, s) => sum + getServiceTotal(s), 0);
  const obligatorios = servicios.filter(s => !s.opcional);
  const opcionales = servicios.filter(s => s.opcional);
  const obligatorioCost = obligatorios.reduce((sum, s) => sum + getServiceTotal(s), 0);
  const opcionalCost = opcionales.reduce((sum, s) => sum + getServiceTotal(s), 0);

  const obligatorioCount = obligatorios.length;
  const opcionalCount = opcionales.length;
  const totalCount = servicios.length;

  const obligatorioPercent = totalCount > 0 ? Math.round((obligatorioCount / totalCount) * 100) : 0;
  const opcionalPercent = totalCount > 0 ? Math.round((opcionalCount / totalCount) * 100) : 0;

  const obligatorioEstados = countPagoEstados(obligatorios);
  const opcionalEstados = countPagoEstados(opcionales);

  return {
    totalCost,
    obligatorioCost,
    opcionalCost,
    obligatorioCount,
    opcionalCount,
    obligatorioPercent,
    opcionalPercent,
    obligatorioPagadoCount: obligatorioEstados.pagado,
    obligatorioParcialCount: obligatorioEstados.parcial,
    opcionalPagadoCount: opcionalEstados.pagado,
    opcionalParcialCount: opcionalEstados.parcial,
  };
}

export function calculateCategoryCosts(
  servicios: any[],
  serviceTypes: any[],
  getTypeInfo: (typeId: string) => any
): any[] {
  const visibleServicios = servicios.filter((ser) => !ser.opcional);
  
  const dynamicCosts = visibleServicios.reduce((acc, s) => {
    const lineas = (s.lineas || []) as any[];
    const serviceTotal = getServiceTotal(s);
    
    if (lineas.length > 0) {
      const totalPvpLineas = lineas.reduce((sum: number, l: any) => sum + Number(l.pvp || 0), 0);
      const ratio = totalPvpLineas > 0 ? serviceTotal / totalPvpLineas : 1;
      for (const l of lineas) {
        const amount = Number(l.pvp || 0) * ratio;
        const matchedType = serviceTypes.find(t => t.id === l.tipo || t.label.toLowerCase() === l.tipo?.toLowerCase());
        const typeKey = matchedType ? matchedType.id : 'otros';
        acc[typeKey] = (acc[typeKey] || 0) + amount;
      }
    } else {
      const amount = serviceTotal;
      const matchedType = serviceTypes.find(t => t.id === s.tipo || t.label.toLowerCase() === s.tipo?.toLowerCase());
      const typeKey = matchedType ? matchedType.id : 'otros';
      acc[typeKey] = (acc[typeKey] || 0) + amount;
    }
    
    acc.totalVisible += serviceTotal;
    return acc;
  }, { totalVisible: 0 } as Record<string, number>);

  const totalVisible = dynamicCosts.totalVisible || 0;

  const categoriesToRender = serviceTypes.map(t => {
    const cost = dynamicCosts[t.id] || 0;
    const percent = totalVisible > 0 ? Math.round((cost / totalVisible) * 100) : 0;
    return {
      id: t.id,
      label: t.label,
      cost,
      percent,
      color: t.color
    };
  }).filter(c => c.cost > 0);

  const otrosCostVal = dynamicCosts['otros'] || 0;
  if (otrosCostVal > 0) {
    const existingOtros = categoriesToRender.find(c => c.label.toLowerCase() === 'otros');
    if (existingOtros) {
      existingOtros.cost += otrosCostVal;
      existingOtros.percent = totalVisible > 0 ? Math.round((existingOtros.cost / totalVisible) * 100) : 0;
    } else {
      const percent = totalVisible > 0 ? Math.round((otrosCostVal / totalVisible) * 100) : 0;
      categoriesToRender.push({
        id: 'otros',
        label: 'Otros',
        cost: otrosCostVal,
        percent,
        color: '#475569'
      });
    }
  }

  categoriesToRender.sort((a, b) => b.cost - a.cost);
  return categoriesToRender;
}

export function serviceHasMatch(ser: any, matchesPendientes: any[]): any | null {
  if (!matchesPendientes.length) return null;
  const prov = (ser.proveedor || "").toLowerCase().trim();
  if (!prov) return null;
  return matchesPendientes.find((m: any) => {
    const matchProv = (m.match_metadatos?.proveedor_nombre || "").toLowerCase().trim();
    return matchProv && (prov.includes(matchProv) || matchProv.includes(prov));
  }) || null;
}
