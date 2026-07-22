export interface MenuOverrideLike {
  etiqueta?: string;
  ocultaEnMenu?: boolean;
}

export interface MenuItemConfigLike {
  uid: string;
  etiqueta: string;
  ocultaEnMenu?: boolean;
}

export interface SeccionLike {
  uid: string;
  tipo: string;
  label: string;
  oculta?: boolean;
}

export interface MenuSeccionLike {
  menuOverrides?: Record<string, MenuOverrideLike>;
  menuItems?: MenuItemConfigLike[];
}

export interface MenuItemResuelto {
  uid: string;
  etiqueta: string;
}

/**
 * Calcula los items del menú siempre a partir de las secciones actuales de la página,
 * aplicando los overrides (etiqueta personalizada / oculta) guardados en la propia sección de menú.
 * Así el menú se mantiene dinámico: al añadir/quitar secciones, el menú se actualiza solo.
 */
export function resolverItemsMenu(seccion: MenuSeccionLike | undefined, todasSecciones: SeccionLike[] | undefined): MenuItemResuelto[] {
  const secciones = (todasSecciones ?? []).filter(s => s.tipo !== "menu" && !s.oculta);

  // Compatibilidad con menús antiguos que aún no migraron a menuOverrides.
  const overrides: Record<string, MenuOverrideLike> = seccion?.menuOverrides
    ?? Object.fromEntries((seccion?.menuItems ?? []).map(i => [i.uid, { etiqueta: i.etiqueta, ocultaEnMenu: i.ocultaEnMenu }]));

  return secciones
    .map(s => {
      const ov = overrides[s.uid];
      return { uid: s.uid, etiqueta: ov?.etiqueta || s.label, oculta: ov?.ocultaEnMenu ?? false };
    })
    .filter(i => !i.oculta)
    .map(({ uid, etiqueta }) => ({ uid, etiqueta }));
}
