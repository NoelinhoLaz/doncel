export function formatEuro(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

/**
 * Convierte un texto de importe escrito por el usuario (con coma o punto como
 * separador decimal, nunca ambos) a number. Devuelve 0 si no es un número válido.
 */
export function parseImporte(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return raw;
  const n = parseFloat(raw.trim().replace(",", "."));
  return isNaN(n) ? 0 : n;
}

/**
 * Filtra la entrada de un campo de importe mientras se escribe: solo dígitos,
 * un signo negativo inicial opcional, y UN único separador decimal (coma o punto).
 * Una vez escrito uno de los dos, no permite añadir otro separador.
 */
export function sanitizeImporteInput(value: string): string {
  let v = value.replace(/[^\d,.\-]/g, "");
  const negative = v.startsWith("-");
  v = v.replace(/-/g, "");
  const firstSep = v.search(/[,.]/);
  if (firstSep !== -1) {
    const sep = v[firstSep];
    v = v.slice(0, firstSep + 1) + v.slice(firstSep + 1).replace(/[,.]/g, "");
    void sep;
  }
  return (negative ? "-" : "") + v;
}
