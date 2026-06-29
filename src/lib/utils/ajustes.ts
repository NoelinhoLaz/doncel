export function initForm(e: any) {
  return {
    numero: e?.numero || "",
    referencia: e?.referencia || "",
    slug: e?.slug || "",
    tipo_expediente: e?.tipo_expediente || "vacacional",
    forma_pago: e?.forma_pago || "un_pagador",
    estado: e?.estado || "abierto",
    fecha_inicio: e?.fecha_inicio ? String(e.fecha_inicio).split("T")[0] : "",
    fecha_fin: e?.fecha_fin ? String(e.fecha_fin).split("T")[0] : "",
    pvp_viajero: e?.pvp_viajero != null ? String(e.pvp_viajero) : "",
    pvp_total: e?.pvp_total != null ? String(e.pvp_total) : "",
    genera_apunte: e?.genera_apunte ?? false,
    apuntes_desde: e?.apuntes_desde ? String(e.apuntes_desde).split("T")[0] : "",
    plazas_max: e?.metadata?.plazas_max ?? "",
    fecha_tope_registro: e?.metadata?.fecha_tope_registro
      ? String(e.metadata.fecha_tope_registro).split("T")[0]
      : "",
  };
}

export function listEquals(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].descripcion !== b[i].descripcion ||
      a[i].fecha !== b[i].fecha ||
      String(a[i].importe) !== String(b[i].importe)
    ) return false;
  }
  return true;
}

export function cancelacionesListEquals(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].descripcion !== b[i].descripcion ||
      a[i].fecha_desde !== b[i].fecha_desde ||
      a[i].fecha_hasta !== b[i].fecha_hasta ||
      a[i].tipo_valor !== b[i].tipo_valor ||
      String(a[i].valor) !== String(b[i].valor)
    ) return false;
  }
  return true;
}

export function arraysEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  return [...a].sort().every((val, i) => val === [...b].sort()[i]);
}

export function getPlazosSum(plazosList: any[]): number {
  return plazosList.reduce((acc, curr) => acc + (parseFloat(curr.importe) || 0), 0);
}

export function getTargetAmount(form: { forma_pago: string; pvp_total: string; pvp_viajero: string }): number {
  return form.forma_pago === "un_pagador"
    ? parseFloat(form.pvp_total) || 0
    : parseFloat(form.pvp_viajero) || 0;
}

export function isPlazosSumValid(plazosList: any[], form: { forma_pago: string; pvp_total: string; pvp_viajero: string }): boolean {
  if (plazosList.length === 0) return true;
  return Math.abs(getPlazosSum(plazosList) - getTargetAmount(form)) < 0.01;
}

export function serviciosListEquals(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].descripcion !== b[i].descripcion ||
      a[i].tipo !== b[i].tipo ||
      a[i].extra !== b[i].extra ||
      String(a[i].neto) !== String(b[i].neto) ||
      String(a[i].pvp) !== String(b[i].pvp) ||
      String(a[i].plazas_minimas) !== String(b[i].plazas_minimas) ||
      a[i].proveedor !== b[i].proveedor ||
      a[i].destino !== b[i].destino
    ) return false;
  }
  return true;
}

export function hasFormChanges(
  form: ReturnType<typeof initForm>,
  expediente: any,
  formasPagoAceptadas: string[],
  plazosList: any[],
  cancelacionesList: any[],
  comunicacionesList: any[],
  serviciosList: any[],
): boolean {
  const o = expediente || {};
  const origServicios = (o.servicios_opcionales || []).map((s: any) => ({
    descripcion: s.descripcion || "",
    tipo: s.tipo || "",
    extra: s.extra || "",
    neto: s.neto || "",
    pvp: s.pvp || "",
    plazas_minimas: s.plazas_minimas || "",
    proveedor: s.proveedor || "",
    destino: s.destino || "",
  }));
  const origPlazos = (o.plazos || [])
    .filter((p: any) => !p.tipo || p.tipo === "pago")
    .map((p: any) => ({ descripcion: p.descripcion || "", fecha: p.fecha || "", importe: p.importe || "" }));
  const origCancelaciones = (o.plazos || [])
    .filter((p: any) => p.tipo === "cancelacion")
    .map((c: any) => ({
      descripcion: c.descripcion || "",
      fecha_desde: c.fecha_desde || "",
      fecha_hasta: c.fecha_hasta || "",
      tipo_valor: c.tipo_valor || "importe",
      valor: c.valor || "",
    }));

  return (
    form.numero !== (o.numero || "") ||
    form.referencia !== (o.referencia || "") ||
    form.slug !== (o.slug || "") ||
    form.tipo_expediente !== (o.tipo_expediente || "vacacional") ||
    form.forma_pago !== (o.forma_pago || "un_pagador") ||
    form.fecha_inicio !== (o.fecha_inicio ? String(o.fecha_inicio).split("T")[0] : "") ||
    form.fecha_fin !== (o.fecha_fin ? String(o.fecha_fin).split("T")[0] : "") ||
    form.pvp_viajero !== (o.pvp_viajero != null ? String(o.pvp_viajero) : "") ||
    form.pvp_total !== (o.pvp_total != null ? String(o.pvp_total) : "") ||
    form.genera_apunte !== (o.genera_apunte ?? false) ||
    form.apuntes_desde !== (o.apuntes_desde ? String(o.apuntes_desde).split("T")[0] : "") ||
    form.plazas_max !== (o.metadata?.plazas_max ?? "") ||
    form.fecha_tope_registro !== (o.metadata?.fecha_tope_registro ? String(o.metadata.fecha_tope_registro).split("T")[0] : "") ||
    !arraysEqual(formasPagoAceptadas, o.formas_pago_aceptadas || []) ||
    !serviciosListEquals(serviciosList, origServicios) ||
    !listEquals(plazosList, origPlazos) ||
    !cancelacionesListEquals(cancelacionesList, origCancelaciones) ||
    JSON.stringify(comunicacionesList.map(c => ({ descripcion: c.descripcion, activa: c.activa, plantilla: c.plantilla }))) !==
      JSON.stringify((o.metadata?.comunicaciones_automaticas || []).map((c: any) => ({
        descripcion: c.descripcion || "", activa: c.activa ?? false, plantilla: c.plantilla || "",
      })))
  );
}
